"""Agent registry service (FR-01, FR-02): identity, lifecycle, capabilities."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.adapters.identity import MockIdentityProvider
from aegis.domain import AGENT_LIFECYCLE_TRANSITIONS, AgentStatus, EventType
from aegis.models import Agent, AgentCapability, AgentLifecycleEvent
from aegis.schemas import AgentCreate, AgentUpdate
from aegis.services.audit import AuditService


def _u(value: Any) -> uuid.UUID | None:
    if value in (None, ""):
        return None
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


class LifecycleError(Exception):
    def __init__(self, message: str, code: str = "LIFECYCLE_INVALID_TRANSITION"):
        super().__init__(message)
        self.code = code


class RegistryService:
    def __init__(self, session: AsyncSession, identity_provider=None):
        self.session = session
        self.identity = identity_provider or MockIdentityProvider()

    async def register_agent(self, data: AgentCreate, actor_user_id: str | None = None) -> Agent:
        external_id = await self.identity.register_agent_identity(data.name, data.owner_user_id)
        agent = Agent(
            external_identity_id=external_id,
            name=data.name,
            description=data.description,
            owner_user_id=data.owner_user_id,
            purpose=data.purpose,
            environment=data.environment,
            risk_level=data.risk_level.value if hasattr(data.risk_level, "value") else str(data.risk_level),
            status=AgentStatus.PENDING.value,
            data_scope=list(data.data_scope),
            metadata_json=dict(data.metadata),
        )
        self.session.add(agent)
        await self.session.flush()

        for capability in data.capabilities:
            self.session.add(
                AgentCapability(agent_id=agent.id, capability=capability, scope={}, enabled=True)
            )
        self.session.add(
            AgentLifecycleEvent(
                agent_id=agent.id, from_status=None, to_status=AgentStatus.PENDING.value,
                actor_user_id=actor_user_id, reason="Agent registered",
            )
        )
        await self.session.flush()
        return agent

    async def get_agent(self, agent_id: str) -> Agent | None:
        return await self.session.get(Agent, _u(agent_id))

    async def get_agent_by_name(self, name: str) -> Agent | None:
        result = await self.session.execute(select(Agent).where(Agent.name == name))
        return result.scalars().first()

    async def list_agents(self, status: str | None = None) -> list[Agent]:
        stmt = select(Agent).order_by(Agent.created_at.asc())
        if status:
            stmt = stmt.where(Agent.status == status.upper())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_capabilities(self, agent_id: Any) -> list[AgentCapability]:
        result = await self.session.execute(
            select(AgentCapability).where(
                AgentCapability.agent_id == _u(agent_id), AgentCapability.enabled.is_(True)
            )
        )
        return list(result.scalars().all())

    async def set_capabilities(self, agent_id: str, capabilities: list[str]) -> None:
        agent = await self.get_agent(agent_id)
        if not agent:
            raise LifecycleError("Agent not found", code="AGENT_NOT_FOUND")
        result = await self.session.execute(
            select(AgentCapability).where(AgentCapability.agent_id == agent.id)
        )
        existing = {c.capability: c for c in result.scalars().all()}
        for name in capabilities:
            if name in existing:
                existing[name].enabled = True
            else:
                self.session.add(AgentCapability(agent_id=agent.id, capability=name, scope={}, enabled=True))
        for name, cap in existing.items():
            if name not in capabilities:
                cap.enabled = False
        await self.session.flush()

    async def transition(
        self, agent_id: str, to_status: AgentStatus, actor_user_id: str | None, reason: str | None
    ) -> Agent:
        agent = await self.get_agent(agent_id)
        if not agent:
            raise LifecycleError("Agent not found", code="AGENT_NOT_FOUND")
        try:
            current = AgentStatus(agent.status)
        except ValueError:
            current = AgentStatus.PENDING
        if to_status is current:
            return agent
        if to_status not in AGENT_LIFECYCLE_TRANSITIONS.get(current, set()):
            raise LifecycleError(
                f"Transition {current.value} -> {to_status.value} is not permitted",
                code="LIFECYCLE_INVALID_TRANSITION",
            )
        from_status = agent.status
        agent.status = to_status.value
        agent.updated_at = agent.updated_at  # onupdate handles this
        self.session.add(
            AgentLifecycleEvent(
                agent_id=agent.id, from_status=from_status, to_status=to_status.value,
                actor_user_id=actor_user_id, reason=reason or f"Transition to {to_status.value}",
            )
        )
        await self.session.flush()
        return agent
