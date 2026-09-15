"""Audit & lineage service (FR-11, FR-12, NFR-02).

audit_events is append-only from the application perspective: rows are only
ever inserted, never updated or deleted through this service.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.models import AuditEvent, SecurityAlert

SECURITY_ALERT_SEVERITY = {
    "PROMPT_INJECTION": "CRITICAL",
    "PRIVILEGE_ESCALATION": "HIGH",
    "UNAUTHORIZED_TOOL": "HIGH",
    "PURPOSE_VIOLATION": "MEDIUM",
    "SUSPENDED_AGENT": "MEDIUM",
    "RATE_LIMIT_ABUSE": "LOW",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _u(value: Any) -> uuid.UUID | None:
    if value in (None, ""):
        return None
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


class AuditService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def record_event(
        self,
        *,
        trace_id: str,
        event_type: str,
        agent_id: Any = None,
        initiating_user_id: Any = None,
        parent_agent_id: Any = None,
        action: str | None = None,
        tool_id: Any = None,
        resource: str | None = None,
        intent: dict | None = None,
        decision: str | None = None,
        policy_id: Any = None,
        risk_score: int | None = None,
        latency_ms: int | None = None,
        token_usage: int | None = None,
        estimated_cost: float | None = None,
        status: str | None = None,
        metadata: dict | None = None,
        parent_event_id: Any = None,
    ) -> AuditEvent:
        event = AuditEvent(
            trace_id=trace_id,
            parent_event_id=_u(parent_event_id),
            initiating_user_id=initiating_user_id,
            agent_id=_u(agent_id),
            parent_agent_id=_u(parent_agent_id),
            event_type=event_type,
            action=action,
            tool_id=_u(tool_id),
            resource=resource,
            intent=intent,
            decision=decision,
            policy_id=_u(policy_id),
            risk_score=risk_score,
            latency_ms=latency_ms,
            token_usage=token_usage,
            estimated_cost=Decimal(str(estimated_cost)) if estimated_cost is not None else None,
            status=status,
            metadata_json=metadata or {},
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def create_alert(
        self,
        *,
        trace_id: str | None,
        agent_id: Any,
        alert_type: str,
        description: str,
        severity: str | None = None,
    ) -> SecurityAlert:
        alert = SecurityAlert(
            trace_id=trace_id,
            agent_id=_u(agent_id),
            alert_type=alert_type,
            severity=severity or SECURITY_ALERT_SEVERITY.get(alert_type, "MEDIUM"),
            description=description,
            status="OPEN",
        )
        self.session.add(alert)
        await self.session.flush()
        return alert

    async def list_events(
        self,
        *,
        trace_id: str | None = None,
        agent_id: str | None = None,
        decision: str | None = None,
        event_type: str | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        limit: int = 200,
    ) -> list[AuditEvent]:
        stmt = select(AuditEvent).order_by(AuditEvent.timestamp.asc()).limit(min(limit, 1000))
        if trace_id:
            stmt = stmt.where(AuditEvent.trace_id == trace_id)
        if agent_id:
            stmt = stmt.where(AuditEvent.agent_id == _u(agent_id))
        if decision:
            stmt = stmt.where(AuditEvent.decision == decision.upper())
        if event_type:
            stmt = stmt.where(AuditEvent.event_type == event_type.upper())
        if since:
            stmt = stmt.where(AuditEvent.timestamp >= since)
        if until:
            stmt = stmt.where(AuditEvent.timestamp <= until)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_trace(self, trace_id: str) -> dict[str, Any] | None:
        """Complete lineage: events + grants + delegations for a trace."""
        events = await self.list_events(trace_id=trace_id, limit=1000)
        grants = (await self.session.execute(
            select_from_grants(trace_id)
        )).scalars().all()
        delegations = (await self.session.execute(
            select_from_delegations(trace_id)
        )).scalars().all()
        return {
            "trace_id": trace_id,
            "events": events,
            "grants": list(grants),
            "delegations": list(delegations),
        }

    async def list_alerts(self, status: str | None = None, limit: int = 200) -> list[SecurityAlert]:
        stmt = select(SecurityAlert).order_by(SecurityAlert.created_at.desc()).limit(min(limit, 1000))
        if status:
            stmt = stmt.where(SecurityAlert.status == status.upper())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def resolve_alert(self, alert_id: str, reason: str | None = None) -> SecurityAlert | None:
        alert = await self.session.get(SecurityAlert, _u(alert_id))
        if not alert:
            return None
        alert.status = "RESOLVED"
        alert.resolved_at = _utcnow()
        if reason:
            alert.description = f"{alert.description} | Resolution: {reason}"
        await self.session.flush()
        return alert


def select_from_grants(trace_id: str):
    from aegis.models import AccessGrant

    return select(AccessGrant).where(AccessGrant.trace_id == trace_id)


def select_from_delegations(trace_id: str):
    from aegis.models import Delegation

    return select(Delegation).where(Delegation.trace_id == trace_id)
