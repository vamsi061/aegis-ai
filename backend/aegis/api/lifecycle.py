"""Agent lifecycle transitions: suspend / retire / activate."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.domain import AgentStatus, EventType
from aegis.schemas import AgentActionOut
from aegis.services.audit import AuditService
from aegis.services.grants import JITGrantService
from aegis.services.registry import LifecycleError, RegistryService
from aegis.services import delegations_ext  # noqa: F401
from aegis.services.delegations import DelegationService
from aegis.api.agents import router as _agents_router  # noqa: F401 (keeps router import graph simple)
from aegis.api.deps import not_found

router = APIRouter(prefix="/agents", tags=["agents"])


async def _transition(agent_id: str, target: AgentStatus, reason: str, session: AsyncSession) -> AgentActionOut:
    registry = RegistryService(session)
    audit = AuditService(session)
    grants = JITGrantService(session)
    delegation_service = DelegationService(session)

    agent = await registry.get_agent(agent_id)
    if agent is None:
        raise not_found("Agent not found", "AGENT_NOT_FOUND")

    try:
        agent = await registry.transition(agent_id, target, actor_user_id=None, reason=reason)
    except LifecycleError as exc:
        raise HTTPException(status_code=409, detail={"error": str(exc), "code": exc.code}) from exc

    revoked = 0
    if target in (AgentStatus.SUSPENDED, AgentStatus.RETIRED):
        revoked = await grants.revoke_agent_grants(agent_id, reason)
        await delegation_service.revoke_for_agent(agent_id, reason)

    await audit.record_event(
        trace_id=f"tr-{agent.id.hex[:16]}",
        event_type=EventType.AGENT_LIFECYCLE.value,
        agent_id=agent.id,
        action=target.value,
        status=reason,
        metadata={"revoked_grants": revoked},
    )
    return AgentActionOut(agent_id=str(agent.id), status=AgentStatus(agent.status), revoked_grants=revoked)


@router.post("/{agent_id}/suspend", response_model=AgentActionOut)
async def suspend_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    return await _transition(agent_id, AgentStatus.SUSPENDED, "Suspended by administrator", session)


@router.post("/{agent_id}/retire", response_model=AgentActionOut)
async def retire_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    return await _transition(agent_id, AgentStatus.RETIRED, "Retired by administrator", session)


@router.post("/{agent_id}/activate", response_model=AgentActionOut)
async def activate_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    """Activate a PENDING agent (ownership re-attestation point for demo)."""
    return await _transition(agent_id, AgentStatus.ACTIVE, "Activated by administrator", session)