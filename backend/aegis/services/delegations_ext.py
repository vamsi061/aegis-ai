"""A2A delegation service (part 2): grant path, revocation, queries."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from aegis.domain import DelegationStatus, EventType
from aegis.models import Delegation
from aegis.services.delegations import DelegationService as _Base
from aegis.services.delegations import DelegationError, _aware, _capabilities_of, _u, _utcnow  # noqa: F401


async def _grant_delegation_impl(
    self,
    *,
    trace: str,
    source,
    target,
    requested: set[str],
    effective: set[str],
    ttl_seconds: int,
    parent_event_id,
):
    expires_at = _utcnow() + timedelta(seconds=max(ttl_seconds, 1))
    delegation = Delegation(
        trace_id=trace,
        source_agent_id=source.id,
        target_agent_id=target.id,
        requested_scope={"capabilities": sorted(requested)},
        effective_scope={"capabilities": sorted(effective)},
        status=DelegationStatus.ACTIVE.value,
        issued_at=_utcnow(),
        expires_at=expires_at,
    )
    self.session.add(delegation)
    await self.session.flush()

    await self.audit.record_event(
        trace_id=trace,
        event_type=EventType.DELEGATION_GRANTED.value,
        agent_id=target.id,
        parent_agent_id=source.id,
        decision="ALLOW",
        risk_score=20,
        status="ACTIVE",
        metadata={
            "delegation_id": str(delegation.id),
            "effective_scope": sorted(effective),
            "expires_at": expires_at.isoformat(),
            "policy_key": "DELEGATION-001",
        },
        parent_event_id=parent_event_id,
    )
    return {"delegation": delegation, "trace_id": trace}


_Base._grant_delegation = _grant_delegation_impl  # type: ignore[attr-defined]


async def revoke_for_agent_impl(self, agent_id, reason: str) -> int:
    """Cascade revocation: delegations to or from this agent."""
    aid = _u(agent_id)
    result = await self.session.execute(
        update(Delegation)
        .where(
            Delegation.status == "ACTIVE",
            (Delegation.source_agent_id == aid) | (Delegation.target_agent_id == aid),
        )
        .values(status="REVOKED", revoked_at=_utcnow())
    )
    await self.session.flush()
    return int(result.rowcount or 0)


_Base.revoke_for_agent = revoke_for_agent_impl  # type: ignore[attr-defined]


async def list_delegations_impl(self, active_only: bool = False) -> list[Delegation]:
    stmt = select(Delegation).order_by(Delegation.issued_at.desc()).limit(200)
    if active_only:
        stmt = stmt.where(Delegation.status == "ACTIVE")
    result = await self.session.execute(stmt)
    return list(result.scalars().all())


_Base.list_delegations = list_delegations_impl  # type: ignore[attr-defined]


async def target_effective_capabilities_impl(self, target_agent_id) -> set[str]:
    """Capabilities the target may use, including via active delegations."""
    from aegis.models import AgentCapability

    aid = _u(target_agent_id)
    caps = (await self.session.execute(
        select(AgentCapability.capability).where(
            AgentCapability.agent_id == aid, AgentCapability.enabled.is_(True)
        )
    )).scalars().all()
    effective = set(caps)
    delegs = (await self.session.execute(
        select(Delegation).where(
            Delegation.target_agent_id == aid, Delegation.status == "ACTIVE"
        )
    )).scalars().all()
    now = _utcnow()
    for d in delegs:
        if d.expires_at is None or _aware(d.expires_at) <= now:
            d.status = DelegationStatus.EXPIRED.value
            continue
        effective |= set(d.effective_scope.get("capabilities", []))
    return effective


_Base.target_effective_capabilities = target_effective_capabilities_impl  # type: ignore[attr-defined]
