"""Read-only JIT grant registry endpoints (UI: access state visibility).

Grants are created exclusively by the authorization/approval flows. These
endpoints expose their current state; `active_only=true` excludes both
explicitly revoked grants AND grants whose TTL has elapsed (effective status),
regardless of the stored status column.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.models import AccessGrant, Agent
from aegis.schemas import AccessGrantOut
from aegis.api.deps import not_found

router = APIRouter(prefix="/grants", tags=["grants"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _effective_status(grant: AccessGrant) -> str:
    """REVOKED > time-expired > stored status (matches JITGrantService rules)."""
    if grant.status == "REVOKED":
        return "REVOKED"
    if grant.status == "ACTIVE" and grant.expires_at is not None:
        expires = grant.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= _utcnow():
            return "EXPIRED"
    return grant.status


def _to_out(g: AccessGrant) -> AccessGrantOut:
    return AccessGrantOut(
        grant_id=str(g.id),
        agent_id=str(g.agent_id),
        tool_name=g.tool_name,
        tool_id=str(g.tool_id) if g.tool_id else None,
        scope=g.scope or {},
        trace_id=g.trace_id,
        issued_at=g.issued_at,
        expires_at=g.expires_at,
        status=_effective_status(g),
    )


@router.get("", response_model=list[AccessGrantOut])
async def list_grants(
    agent_id: uuid.UUID | None = Query(default=None),
    active_only: bool = Query(default=False),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, le=1000),
    session: AsyncSession = Depends(get_session),
):
    if agent_id is not None:
        agent = await session.get(Agent, agent_id)
        if agent is None:
            raise not_found("Agent not found", "AGENT_NOT_FOUND")

    stmt = select(AccessGrant).order_by(AccessGrant.issued_at.desc()).limit(limit)
    if agent_id is not None:
        stmt = stmt.where(AccessGrant.agent_id == agent_id)
    if status:
        stmt = stmt.where(AccessGrant.status == status.upper())

    rows = (await session.execute(stmt)).scalars().all()
    grants = [_to_out(g) for g in rows]
    if active_only:
        grants = [g for g in grants if g.status == "ACTIVE"]
    return grants


@router.get("/{grant_id}", response_model=AccessGrantOut)
async def get_grant(grant_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    g = await session.get(AccessGrant, grant_id)
    if g is None:
        raise not_found("Grant not found", "GRANT_NOT_FOUND")
    return _to_out(g)
