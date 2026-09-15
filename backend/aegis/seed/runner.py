"""Seed runner: creates tables and demo data idempotently."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.engine import seed_policies
from aegis.models import AgentCapability, AgentLifecycleEvent, Agent, McpServer, McpTool, Policy, PolicyVersion
from aegis.seed.data import DEMO_AGENTS, MCP_SERVERS, MCP_TOOLS
from aegis.schemas import AgentCreate
from aegis.services.registry import RegistryService

logger = logging.getLogger("aegis.seed")


async def seed(session: AsyncSession) -> dict:
    created = {"agents": 0, "tools": 0, "policies": 0}

    # --- MCP servers & tools -------------------------------------------------
    for server_def in MCP_SERVERS:
        exists = (await session.execute(
            select(McpServer).where(McpServer.name == server_def["name"])
        )).scalars().first()
        if not exists:
            session.add(McpServer(**server_def))
    await session.flush()

    servers = {s.name: s for s in (await session.execute(select(McpServer))).scalars().all()}
    for server_name, tool_name, risk, description in MCP_TOOLS:
        exists = (await session.execute(
            select(McpTool).where(McpTool.server_id == servers[server_name].id, McpTool.name == tool_name)
        )).scalars().first()
        if not exists:
            session.add(
                McpTool(
                    server_id=servers[server_name].id,
                    name=tool_name,
                    description=description,
                    risk_level=risk,
                    status="ACTIVE",
                    input_schema={"type": "object"},
                )
            )
            created["tools"] += 1
    await session.flush()

    # --- Demo agents ----------------------------------------------------------
    registry = RegistryService(session)
    for agent_def in DEMO_AGENTS:
        exists = (await session.execute(
            select(Agent).where(Agent.name == agent_def["name"])
        )).scalars().first()
        if exists:
            continue
        agent = await registry.register_agent(AgentCreate(**agent_def), actor_user_id="user-admin")
        # Activate demo agents directly (registration -> PENDING -> ACTIVE).
        agent.status = "ACTIVE"
        session.add(
            AgentLifecycleEvent(
                agent_id=agent.id,
                from_status="PENDING",
                to_status="ACTIVE",
                actor_user_id=None,
                reason="Demo seeding: approved at registration",
            )
        )
        created["agents"] += 1
    await session.flush()

    # --- Policies (policy-as-code, versioned) ---------------------------------
    for policy_def in seed_policies.SEED_POLICIES:
        row = (await session.execute(
            select(Policy).where(Policy.policy_key == policy_def["policy_key"])
        )).scalars().first()
        if row is None:
            row = Policy(
                policy_key=policy_def["policy_key"],
                name=policy_def["name"],
                description=policy_def.get("description"),
                priority=policy_def.get("priority", 100),
                status="ACTIVE",
            )
            session.add(row)
            await session.flush()
            created["policies"] += 1
        version_row = (await session.execute(
            select(PolicyVersion).where(
                PolicyVersion.policy_id == row.id,
                PolicyVersion.version == policy_def.get("version", 1),
            )
        )).scalars().first()
        if version_row is None:
            session.add(
                PolicyVersion(
                    policy_id=row.id,
                    version=policy_def.get("version", 1),
                    definition=policy_def,
                    decision=policy_def["decision"],
                )
            )
    await session.flush()
    logger.info("seed complete: %s", created)
    return created
