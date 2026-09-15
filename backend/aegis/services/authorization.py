"""Authorization orchestrator (FR-04..FR-08): intent -> policy -> grant/approval."""

import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.config import get_settings
from aegis.domain import AlertType, ApprovalStatus, Decision, EventType, risk_level_for
from aegis.engine.intent import DeterministicIntentProvider
from aegis.engine.pdp import evaluate_policy
from aegis.engine.types import Intent, PolicyContext
from aegis.models import Agent, ApprovalRequest, AuthorizationRequest, McpTool, PolicyDecision
from aegis.schemas import (
    ApprovalNeededOut,
    AuthorizeRequest,
    AuthorizeResponse,
    GrantOut,
    IntentOut,
)
from aegis.services.audit import AuditService
from aegis.services.grants import JITGrantService
from aegis.services.registry import RegistryService


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RateLimiter:
    """Per-agent sliding-window limiter producing RATE_LIMIT decisions."""

    def __init__(self, per_minute: int):
        self.per_minute = per_minute
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> bool:
        now = time.monotonic()
        window = self._events[key]
        while window and now - window[0] > 60.0:
            window.popleft()
        if len(window) >= self.per_minute:
            return False
        window.append(now)
        return True


_ALERT_TYPE_BY_POLICY = {
    "INJECTION-001": AlertType.PROMPT_INJECTION.value,
    "MCP-001": AlertType.UNAUTHORIZED_TOOL.value,
    "TRAVEL-002": AlertType.PURPOSE_VIOLATION.value,
    "SECURITY-001": AlertType.SUSPENDED_AGENT.value,
    "FAIL-CLOSED": AlertType.UNAUTHORIZED_TOOL.value,
}


class AuthorizationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.registry = RegistryService(session)
        self.intent_provider = DeterministicIntentProvider()
        self.grants = JITGrantService(session)
        self.audit = AuditService(session)
        self.rate_limiter = RateLimiter(self.settings.rate_limit_per_minute)
        self._pending_approval_meta: dict[uuid.UUID, dict] = {}

    async def _load_tool(self, tool_name: str) -> McpTool | None:
        result = await self.session.execute(
            select(McpTool).where(McpTool.name == tool_name)
        )
        return result.scalars().first()

    async def _tool_status(self, tool: McpTool | None) -> str | None:
        """Tool is usable only when it and its server are ACTIVE (MCP-001)."""
        if tool is None:
            return None
        status = tool.status or ""
        if status == "ACTIVE":
            from aegis.models import McpServer

            server = await self.session.get(McpServer, tool.server_id)
            if server is not None:
                status = server.status or status
        return status
    async def _create_approval(
        self,
        request: AuthorizeRequest,
        agent: Agent,
        intent: Intent,
        result,
        trace_id: str,
    ) -> ApprovalRequest:
        """Create a PENDING human-approval request (FR-08) with hard TTL."""
        approval = ApprovalRequest(
            authorization_request_id=None,  # linked in _persist after auth_request insert
            risk_score=result.risk_score,
            reason=result.reason,
            status=ApprovalStatus.PENDING.value,
            requested_at=_utcnow(),
            expires_at=_utcnow() + timedelta(seconds=self.settings.approval_ttl_seconds),
        )
        self.session.add(approval)
        await self.session.flush()
        return approval

    async def authorize(self, request: AuthorizeRequest) -> AuthorizeResponse:
        t0 = time.perf_counter()
        trace_id = f"tr-{uuid.uuid4().hex[:20]}"
        agent = await self.registry.get_agent(request.agent_id)

        # Fail closed on unknown agents (NFR-01).
        if agent is None:
            await self.audit.create_alert(
                trace_id=trace_id,
                agent_id=None,
                alert_type=AlertType.UNAUTHORIZED_TOOL.value,
                description=f"Authorization request for unknown agent {request.agent_id}",
            )
            return self._deny_response(
                trace_id=trace_id,
                reason="Agent is not registered in Aegis; failing closed",
                policy_key="FAIL-CLOSED",
                risk_score=90,
                intent=None,
            )

        from aegis.services import delegations_ext  # noqa: F401
        from aegis.services.delegations import DelegationService

        delegation_service = DelegationService(self.session)
        effective_capabilities = await delegation_service.target_effective_capabilities(agent.id)

        intent = self.intent_provider.extract(request)
        tool = await self._load_tool(request.tool)

        ctx = PolicyContext(
            agent_id=str(agent.id),
            agent_name=agent.name,
            agent_status=agent.status,
            purpose=agent.purpose,
            owner_user_id=str(agent.owner_user_id),
            environment=agent.environment,
            capabilities=sorted(effective_capabilities),
            action=intent.action,
            tool=request.tool,
            target=request.target,
            intent=intent,
            payload=request.input or {},
            context=request.context or {},
            tool_registered=tool is not None,
            tool_status=await self._tool_status(tool),
            tool_risk_level=tool.risk_level if tool else "LOW",
        )

        # RATE_LIMIT decision: after identity, before policy evaluation.
        if not self.rate_limiter.check(str(agent.id)):
            response = self._deny_response(
                trace_id=trace_id,
                reason="Rate limit exceeded for this agent; retry later",
                policy_key="RATE-LIMIT",
                risk_score=40,
                intent=intent,
                decision=Decision.RATE_LIMIT,
            )
            await self._persist(
                trace_id=trace_id, agent=agent, request=request, intent=intent,
                response=response, tool=tool, latency_ms=int((time.perf_counter() - t0) * 1000),
            )
            return response

        result = evaluate_policy(ctx)

        response = AuthorizeResponse(
            request_id=str(uuid.uuid4()),
            trace_id=trace_id,
            decision=result.decision,
            risk_score=result.risk_score,
            risk_level=risk_level_for(result.risk_score).value,
            policy_id=result.policy_key,
            policy_version=result.policy_version,
            reason=result.reason,
            intent=IntentOut(**intent.to_dict()),
        )

        approval: ApprovalRequest | None = None
        if result.decision is Decision.ALLOW:
            grant = await self.grants.create_grant(
                agent_id=agent.id,
                tool_name=request.tool,
                tool_id=tool.id if tool else None,
                scope={"tool": request.tool, "capabilities": [request.tool], "target": request.target},
                ttl_seconds=result.ttl_seconds,
                trace_id=trace_id,
            )
            response.grant = GrantOut(
                grant_id=str(grant.id), expires_at=grant.expires_at, scope=grant.scope
            )
        elif result.decision is Decision.REQUIRE_HUMAN_APPROVAL:
            approval = await self._create_approval(request, agent, intent, result, trace_id)
            response.approval = ApprovalNeededOut(
                approval_id=str(approval.id), expires_at=approval.expires_at
            )

        await self._persist(
            trace_id=trace_id, agent=agent, request=request, intent=intent,
            response=response, tool=tool, latency_ms=int((time.perf_counter() - t0) * 1000),
            result=result, approval=approval,
        )
        return response

    async def _persist(
        self, *, trace_id, agent: Agent, request: AuthorizeRequest, intent: Intent,
        response: AuthorizeResponse, tool, latency_ms: int, result=None, approval=None,
    ) -> None:
        decision_value = (
            response.decision.value if hasattr(response.decision, "value") else str(response.decision)
        )
        auth_request = AuthorizationRequest(
            trace_id=trace_id,
            agent_id=agent.id,
            initiating_user_id=request.initiating_user_id,
            action=request.action,
            target=request.target,
            tool_id=tool.id if tool else None,
            intent=intent.to_dict(),
            context=request.context or {},
        )
        self.session.add(auth_request)
        await self.session.flush()

        self.session.add(
            PolicyDecision(
                authorization_request_id=auth_request.id,
                policy_key=response.policy_id,
                policy_version=response.policy_version,
                decision=decision_value,
                reason=response.reason,
                risk_score=response.risk_score,
            )
        )

        if approval is not None:
            approval.authorization_request_id = auth_request.id

        await self.audit.record_event(
            trace_id=trace_id,
            event_type=EventType.AUTHORIZATION_REQUESTED.value,
            agent_id=agent.id,
            initiating_user_id=request.initiating_user_id,
            action=request.action,
            tool_id=tool.id if tool else None,
            resource=request.target,
            intent=intent.to_dict(),
            status="RECEIVED",
            metadata={"policy_key": response.policy_id},
        )
        await self.audit.record_event(
            trace_id=trace_id,
            event_type=EventType.POLICY_DECISION.value,
            agent_id=agent.id,
            initiating_user_id=request.initiating_user_id,
            action=request.action,
            tool_id=tool.id if tool else None,
            decision=decision_value,
            risk_score=response.risk_score,
            latency_ms=latency_ms,
            status="DECIDED",
            metadata={
                "policy_key": response.policy_id,
                "policy_version": response.policy_version,
                "reason": response.reason,
            },
        )

        if response.grant is not None:
            await self.audit.record_event(
                trace_id=trace_id,
                event_type=EventType.GRANT_CREATED.value,
                agent_id=agent.id,
                initiating_user_id=request.initiating_user_id,
                action=request.action,
                tool_id=tool.id if tool else None,
                decision="ALLOW",
                status="ACTIVE",
                metadata={
                    "grant_id": response.grant.grant_id,
                    "expires_at": response.grant.expires_at.isoformat(),
                },
            )

        if approval is not None:
            await self.audit.record_event(
                trace_id=trace_id,
                event_type=EventType.APPROVAL_REQUESTED.value,
                agent_id=agent.id,
                initiating_user_id=request.initiating_user_id,
                action=request.action,
                tool_id=tool.id if tool else None,
                status="PENDING",
                metadata={
                    "approval_id": str(approval.id),
                    "expires_at": approval.expires_at.isoformat(),
                    "risk_score": approval.risk_score,
                },
            )

        alert_type = _ALERT_TYPE_BY_POLICY.get(response.policy_id or "")
        if result is not None and "alert" in (result.matched_conditions or {}):
            alert_type = result.matched_conditions["alert"]
        if alert_type and decision_value in ("DENY",):
            await self.audit.create_alert(
                trace_id=trace_id,
                agent_id=agent.id,
                alert_type=alert_type,
                description=f"{response.reason} (tool={request.tool})",
            )

    def _deny_response(
        self, *, trace_id, reason, policy_key, risk_score, intent, decision=Decision.DENY
    ) -> AuthorizeResponse:
        return AuthorizeResponse(
            request_id=str(uuid.uuid4()),
            trace_id=trace_id,
            decision=decision,
            risk_score=risk_score,
            risk_level=risk_level_for(risk_score).value,
            policy_id=policy_key,
            policy_version=1,
            reason=reason,
            intent=IntentOut(**intent.to_dict()) if intent else None,
        )

    @staticmethod
    def _uid(value):
        if value in (None, ""):
            return None
        import uuid as _uuid

        return value if isinstance(value, _uuid.UUID) else _uuid.UUID(str(value))

