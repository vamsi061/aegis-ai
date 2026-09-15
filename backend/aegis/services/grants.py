"""JIT access grants (FR-03, FR-07): short-lived, task-scoped, revocable."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.models import AccessGrant


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    """SQLite returns naive UTC datetimes; normalize for comparison."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _u(value: Any) -> uuid.UUID | None:
    if value in (None, ""):
        return None
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


class JITGrantService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_grant(
        self,
        *,
        agent_id: Any,
        tool_name: str,
        tool_id: Any = None,
        scope: dict | None = None,
        ttl_seconds: int = 300,
        trace_id: str | None = None,
        intent_id: Any = None,
    ) -> AccessGrant:
        grant = AccessGrant(
            agent_id=_u(agent_id),
            tool_id=_u(tool_id),
            tool_name=tool_name,
            scope=scope or {},
            trace_id=trace_id,
            intent_id=_u(intent_id),
            status="ACTIVE",
            issued_at=_utcnow(),
            expires_at=_utcnow() + timedelta(seconds=max(int(ttl_seconds), 1)),
        )
        self.session.add(grant)
        await self.session.flush()
        return grant

    async def get_active_grant(self, grant_id: str) -> AccessGrant | None:
        grant = await self.session.get(AccessGrant, _u(grant_id))
        if grant is None:
            return None
        if grant.status != "ACTIVE":
            return None
        if grant.expires_at is not None and _aware(grant.expires_at) <= _utcnow():
            grant.status = "EXPIRED"
            await self.session.flush()
            return None
        return grant

    async def revoke_agent_grants(self, agent_id: Any, reason: str) -> int:
        result = await self.session.execute(
            update(AccessGrant)
            .where(AccessGrant.agent_id == _u(agent_id), AccessGrant.status == "ACTIVE")
            .values(status="REVOKED", revoked_at=_utcnow(), revocation_reason=reason)
        )
        await self.session.flush()
        return int(result.rowcount or 0)

    async def list_grants(self, agent_id: Any | None = None, active_only: bool = False) -> list[AccessGrant]:
        stmt = select(AccessGrant).order_by(AccessGrant.issued_at.desc()).limit(200)
        if agent_id:
            stmt = stmt.where(AccessGrant.agent_id == _u(agent_id))
        if active_only:
            stmt = stmt.where(AccessGrant.status == "ACTIVE")
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
