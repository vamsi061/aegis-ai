"""Approval endpoints: list, get, approve, deny (approval -> JIT grant)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.domain import ApprovalStatus, EventType
from aegis.models import ApprovalRequest, AuthorizationRequest, McpTool
from aegis.schemas import ApprovalOut, ApprovalResolve
from aegis.services.audit import AuditService
from aegis.services.grants import JITGrantService
from aegis.api.deps import not_found

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _utcnow():
    return datetime.now(timezone.utc)


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except Exception:
        return False


def _to_out(r: ApprovalRequest, auth: AuthorizationRequest | None) -> ApprovalOut:
    return ApprovalOut(
        approval_id=str(r.id),
        authorization_request_id=str(r.authorization_request_id) if r.authorization_request_id else "",
        agent_id=str(auth.agent_id) if auth else None,
        tool=(auth.intent or {}).get("tool") if auth else None,
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


@router.get("", response_model=list[ApprovalOut])
async def list_approvals(
    status: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
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
    return [_to_out(r, auth_rows.get(r.authorization_request_id)) for r in rows]


@router.get("/{approval_id}", response_model=ApprovalOut)
async def get_approval(approval_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(ApprovalRequest, uuid.UUID(approval_id))
    if row is None:
        raise not_found("Approval not found", "APPROVAL_NOT_FOUND")
    auth = None
    if row.authorization_request_id:
        auth = await session.get(AuthorizationRequest, row.authorization_request_id)
    return _to_out(row, auth)