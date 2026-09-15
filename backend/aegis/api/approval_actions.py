"""Approval resolution: approve/deny. Approving creates the JIT grant (FR-08)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.domain import ApprovalStatus, EventType
from aegis.models import ApprovalRequest, AuthorizationRequest, McpTool
from aegis.schemas import ApprovalOut, ApprovalResolve
from aegis.services.audit import AuditService
from aegis.services.grants import JITGrantService
from aegis.services.delegations import _aware  # noqa: F401
from aegis.api.approvals import _to_out, _utcnow, _is_uuid
from aegis.api.deps import not_found

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.post("/{approval_id}/approve", response_model=ApprovalOut)
async def approve(approval_id: str, body: ApprovalResolve, session: AsyncSession = Depends(get_session)):
    return await _resolve(approval_id, body, True, session)


@router.post("/{approval_id}/deny", response_model=ApprovalOut)
async def deny(approval_id: str, body: ApprovalResolve, session: AsyncSession = Depends(get_session)):
    return await _resolve(approval_id, body, False, session)


async def _resolve(approval_id: str, body: ApprovalResolve, approve: bool, session: AsyncSession) -> ApprovalOut:
    row = await session.get(ApprovalRequest, uuid.UUID(approval_id))
    if row is None:
        raise not_found("Approval not found", "APPROVAL_NOT_FOUND")
    if row.status != ApprovalStatus.PENDING.value:
        raise HTTPException(
            status_code=409,
            detail={"error": f"Approval already resolved ({row.status})", "code": "ALREADY_RESOLVED"},
        )
    if row.expires_at is not None and _aware(row.expires_at) <= _utcnow():
        row.status = ApprovalStatus.EXPIRED.value
        row.resolved_at = _utcnow()
        row.resolution_reason = "Expired without resolution"
        await session.flush()
        raise HTTPException(status_code=409, detail={"error": "Approval request expired", "code": "APPROVAL_EXPIRED"})

    auth = None
    if row.authorization_request_id:
        auth = await session.get(AuthorizationRequest, row.authorization_request_id)
    audit = AuditService(session)

    row.status = ApprovalStatus.APPROVED.value if approve else ApprovalStatus.DENIED.value
    row.resolved_at = _utcnow()
    row.resolved_by = body.approver_id
    row.resolution_reason = body.reason or ("Approved" if approve else "Denied")
    await session.flush()

    trace_id = auth.trace_id if auth else f"tr-appr-{uuid.uuid4().hex[:12]}"
    await audit.record_event(
        trace_id=trace_id,
        event_type=EventType.APPROVAL_RESOLVED.value,
        agent_id=auth.agent_id if auth else None,
        initiating_user_id=auth.initiating_user_id if auth else None,
        action=auth.action if auth else None,
        decision="APPROVED" if approve else "DENIED",
        status=row.status,
        metadata={
            "approval_id": str(row.id),
            "approver_id": body.approver_id,
            "reason": row.resolution_reason,
        },
    )

    # Approval completes the authorization: create the JIT grant now (FR-07).
    if approve and auth is not None:
        tool_name = (auth.intent or {}).get("tool") or auth.action
        grants = JITGrantService(session)
        tool = (await session.execute(
            select(McpTool).where(McpTool.name == tool_name)
        )).scalars().first()
        grant = await grants.create_grant(
            agent_id=auth.agent_id,
            tool_name=tool_name,
            tool_id=tool.id if tool else None,
            scope={"tool": tool_name, "approved": True},
            ttl_seconds=300,
            trace_id=auth.trace_id,
        )
        await audit.record_event(
            trace_id=auth.trace_id,
            event_type=EventType.GRANT_CREATED.value,
            agent_id=auth.agent_id,
            initiating_user_id=auth.initiating_user_id,
            action=auth.action,
            tool_id=tool.id if tool else None,
            decision="ALLOW",
            status="ACTIVE",
            metadata={
                "grant_id": str(grant.id),
                "approval_id": str(row.id),
                "via": "human_approval",
            },
        )
    return _to_out(row, auth)


from sqlalchemy import select  # noqa: E402  (used in _resolve)
