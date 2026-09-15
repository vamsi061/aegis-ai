"""A2A delegation service (FR-10).

effective_scope = requested_scope
                  INTERSECT source_effective_scope
                  INTERSECT target_allowed_capabilities
Empty intersection -> DENY (privilege escalation, docs/policy-spec.md section 8).
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.domain import AlertType, DelegationStatus, EventType
from aegis.models import Agent, AgentCapability, Delegation
from aegis.schemas import DelegationCreate
from aegis.services.audit import AuditService


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _u(value: Any) -> uuid.UUID | None:
    if value in (None, ""):
        return None
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _aware(dt: datetime | None) -> datetime | None:
    """SQLite returns naive UTC datetimes; normalize for comparison."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class DelegationError(Exception):
    def __init__(self, message: str, code: str = "DELEGATION_DENIED"):
        super().__init__(message)
        self.code = code


async def _capabilities_of(session: AsyncSession, agent_id: uuid.UUID) -> set[str]:
    rows = (await session.execute(
        select(AgentCapability.capability).where(
            AgentCapability.agent_id == agent_id, AgentCapability.enabled.is_(True)
        )
    )).scalars().all()
    return set(rows)


class DelegationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.audit = AuditService(session)

    async def create_delegation(self, data: DelegationCreate, trace_id: str | None = None) -> dict:
        trace = trace_id or f"tr-del-{uuid.uuid4().hex[:16]}"

        source = await self.session.get(Agent, _u(data.source_agent_id))
        target = await self.session.get(Agent, _u(data.target_agent_id))
        if source is None or target is None:
            raise DelegationError("Source or target agent does not exist", code="AGENT_NOT_FOUND")

        requested = set(data.requested_scope.capabilities)
        source_effective = await _capabilities_of(self.session, source.id)
        target_allowed = await _capabilities_of(self.session, target.id)
        effective = requested & source_effective & target_allowed

        # Expire stale delegations for bookkeeping clarity.
        await self.session.execute(
            update(Delegation)
            .where(
                Delegation.status == "ACTIVE",
                Delegation.expires_at.isnot(None),
                Delegation.expires_at <= _utcnow(),
            )
            .values(status="EXPIRED", revoked_at=_utcnow())
        )
        await self.session.flush()

        event = await self.audit.record_event(
            trace_id=trace,
            event_type=EventType.DELEGATION_REQUESTED.value,
            agent_id=target.id,
            parent_agent_id=source.id,
            action="a2a_delegation",
            intent={"requested_scope": sorted(requested)},
        )

        if not effective:
            alert = await self.audit.create_alert(
                trace_id=trace,
                agent_id=source.id,
                alert_type=AlertType.PRIVILEGE_ESCALATION.value,
                description=(
                    f"Delegation {sorted(requested)} from {source.name} exceeds source authority "
                    f"(source scope: {sorted(source_effective)}, "
                    f"target allowed: {sorted(target_allowed)})"
                ),
            )
            await self.audit.record_event(
                trace_id=trace,
                event_type=EventType.DELEGATION_DENIED.value,
                agent_id=target.id,
                parent_agent_id=source.id,
                decision="DENY",
                risk_score=80,
                status="BLOCKED",
                metadata={
                    "alert_id": str(alert.id),
                    "source_scope": sorted(source_effective),
                    "target_allowed": sorted(target_allowed),
                    "requested": sorted(requested),
                    "policy_key": "DELEGATION-001",
                },
                parent_event_id=event.id,
            )
            raise DelegationError(
                "Delegation exceeds source authority (DELEGATION-001)",
                code="PRIVILEGE_ESCALATION",
            )

        return await self._grant_delegation(
            trace=trace, source=source, target=target, requested=requested,
            effective=effective, ttl_seconds=int(data.ttl_seconds), parent_event_id=event.id,
        )
