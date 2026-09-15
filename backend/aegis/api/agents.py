"""Agent Registry API (docs/api-spec.md section 1)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.domain import AgentStatus, EventType
from aegis.schemas import AgentActionOut, AgentCreate, AgentOut, AgentUpdate
from aegis.services.audit import AuditService
from aegis.services.grants import JITGrantService
from aegis.services.registry import LifecycleError, RegistryService
from aegis.services import delegations_ext  # noqa: F401
from aegis.services.delegations import DelegationService
from aegis.api.deps import not_found, to_agent_out

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("", response_model=AgentOut, status_code=201)
async def register_agent(body: AgentCreate, session: AsyncSession = Depends(get_session)):
    registry = RegistryService(session)
    audit = AuditService(session)
    agent = await registry.register_agent(body, actor_user_id=body.owner_user_id)
    await audit.record_event(
        trace_id=f"tr-{agent.id.hex[:16]}",
        event_type=EventType.AGENT_LIFECYCLE.value,
        agent_id=agent.id,
        action="REGISTER",
        status="PENDING",
        metadata={"name": agent.name, "owner_user_id": str(agent.owner_user_id)},
    )
    caps = await registry.get_capabilities(agent.id)
    return to_agent_out(agent, {c.capability for c in caps})


@router.get("", response_model=list[AgentOut])
async def list_agents(
    status: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    registry = RegistryService(session)
    agents = await registry.list_agents(status)
    out = []
    for agent in agents:
        caps = await registry.get_capabilities(agent.id)
        out.append(to_agent_out(agent, {c.capability for c in caps}))
    return out


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    registry = RegistryService(session)
    agent = await registry.get_agent(agent_id)
    if agent is None:
        raise not_found("Agent not found", "AGENT_NOT_FOUND")
    caps = await registry.get_capabilities(agent.id)
    return to_agent_out(agent, {c.capability for c in caps})


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(agent_id: str, body: AgentUpdate, session: AsyncSession = Depends(get_session)):
    registry = RegistryService(session)
    agent = await registry.get_agent(agent_id)
    if agent is None:
        raise not_found("Agent not found", "AGENT_NOT_FOUND")

    if body.description is not None:
        agent.description = body.description
    if body.purpose is not None:
        agent.purpose = body.purpose
    if body.risk_level is not None:
        agent.risk_level = body.risk_level.value if hasattr(body.risk_level, "value") else str(body.risk_level)
    if body.data_scope is not None:
        agent.data_scope = list(body.data_scope)
    if body.metadata is not None:
        agent.metadata_json = dict(body.metadata)
    if body.capabilities is not None:
        await registry.set_capabilities(agent_id, body.capabilities)
    await session.flush()

    caps = await registry.get_capabilities(agent.id)
    return to_agent_out(agent, {c.capability for c in caps})