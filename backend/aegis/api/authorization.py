"""Authorization + tool execution + approvals + delegation APIs."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.config import get_settings
from aegis.db import get_session
from aegis.domain import ApprovalStatus, Decision, EventType
from aegis.models import ApprovalRequest, AuthorizationRequest, McpTool
from aegis.schemas import (
    ApprovalNeededOut,
    ApprovalOut,
    ApprovalResolve,
    AuthorizeRequest,
    AuthorizeResponse,
    DelegationCreate,
    DelegationOut,
    ToolExecuteRequest,
    ToolExecuteResponse,
)
from aegis.services.audit import AuditService
from aegis.services.authorization import AuthorizationService
from aegis.services.delegations import DelegationError, DelegationService
from aegis.services import delegations_ext  # noqa: F401
from aegis.services.grants import JITGrantService
from aegis.api.deps import not_found

router = APIRouter(tags=["authorization"])


@router.post("/authorize", response_model=AuthorizeResponse)
async def authorize(body: AuthorizeRequest, session: AsyncSession = Depends(get_session)):
    service = AuthorizationService(session)
    return await service.authorize(body)


@router.post("/tools/{tool_name}/execute", response_model=ToolExecuteResponse)
async def execute_tool(
    tool_name: str,
    body: ToolExecuteRequest,
    session: AsyncSession = Depends(get_session),
):
    """MCP/Tool Gateway: the only governed execution path for tools."""
    settings = get_settings()
    grants = JITGrantService(session)
    audit = AuditService(session)
    registry_stub = None

    from aegis.adapters.tools import MockToolExecutor

    grant = await grants.get_active_grant(body.grant_id)
    if grant is None:
        raise HTTPException(
            status_code=403,
            detail={"error": "Grant is missing, inactive or expired", "code": "GRANT_INVALID"},
        )
    if (grant.tool_name or "") != tool_name:
        raise HTTPException(
            status_code=403,
            detail={"error": "Grant does not cover this tool", "code": "GRANT_TOOL_MISMATCH"},
        )

    from aegis.models import Agent

    agent = await session.get(Agent, grant.agent_id)
    if agent is None or agent.status != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail={"error": "Agent is not active", "code": "AGENT_NOT_ACTIVE"},
        )

    tool = (await session.execute(
        select(McpTool).where(McpTool.name == tool_name, McpTool.status == "ACTIVE")
    )).scalars().first()
    if tool is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Tool is not registered", "code": "TOOL_NOT_FOUND"},
        )

    trace_id = grant.trace_id or f"tr-{uuid.uuid4().hex[:20]}"
    result = await MockToolExecutor().execute(tool_name, tool.id, body.input or {})
    await audit.record_event(
        trace_id=trace_id,
        event_type=EventType.TOOL_EXECUTION.value,
        agent_id=agent.id,
        action=tool_name,
        tool_id=tool.id,
        decision="ALLOW",
        risk_score=10,
        status="EXECUTED",
        metadata={"grant_id": str(grant.id), "token_usage": 420, "estimated_cost": 0.0007},
    )
    return ToolExecuteResponse(
        status="EXECUTED",
        tool=tool_name,
        result=result,
        trace_id=trace_id,
        executed_at=datetime.now(timezone.utc),
    )


@router.get("/approvals", response_model=list[ApprovalOut])
async def list_approvals(
    status: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    from aegis.services.authorization import _ALERT_TYPE_BY_POLICY  # noqa: F401

    stmt = select(ApprovalRequest).order_by(ApprovalRequest.requested_at.desc()).limit(200)
    if status:
        stmt = stmt.where(ApprovalRequest.status == status.upper())
    rows = (await session.execute(stmt)).scalars().all()

    auth_ids = [r.authorization_request_id for r in rows if r.authorization_request_id]
    auth_rows = {}
    if auth_ids:
        auth_rows = {
            r.id: r for r in (await session.execute(
                select(AuthorizationRequest).where(AuthorizationRequest.id.in_(auth_ids))
            )).scalars().all()
        }

    out = []
    for r in rows:
        auth = auth_rows.get(r.authorization_request_id)
        out.append(
            ApprovalOut(
                approval_id=str(r.id),
                authorization_request_id=str(r.authorization_request_id) if r.authorization_request_id else "",
                agent_id=str(auth.agent_id) if auth else None,
                tool=None,
                action=auth.action if auth else None,
                initiating_user_id=str(auth.initiating_user_id) if auth and auth.initiating_user_id else None,
                risk_score=r.risk_score,
                reason=r.reason,
                status=r.status,
                requested_at=r.requested_at,
                expires_at=r.expires_at,
                resolved_by=str(r.resolved_by) if r.resolved_by else None,
                resolution_reason=r.resolution_reason,
            )
        )
    return out
