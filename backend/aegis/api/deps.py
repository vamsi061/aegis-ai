"""Shared API helpers: mapping service models to response schemas."""

from typing import Any

from fastapi import HTTPException

from aegis.domain import AgentStatus
from aegis.models import Agent
from aegis.schemas import AgentOut


def to_agent_out(agent: Agent, capabilities: list[str] | set[str]) -> AgentOut:
    return AgentOut(
        agent_id=str(agent.id),
        external_identity_id=agent.external_identity_id,
        name=agent.name,
        description=agent.description,
        owner_user_id=str(agent.owner_user_id),
        purpose=agent.purpose,
        environment=agent.environment,
        risk_level=agent.risk_level,
        status=AgentStatus(agent.status),
        data_scope=list(agent.data_scope or []),
        capabilities=sorted(capabilities),
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


def not_found(message: str = "Resource not found", code: str = "NOT_FOUND") -> HTTPException:
    return HTTPException(status_code=404, detail={"error": message, "code": code})


def bad_request(message: str, code: str = "BAD_REQUEST") -> HTTPException:
    return HTTPException(status_code=400, detail={"error": message, "code": code})


def conflict(message: str, code: str = "CONFLICT") -> HTTPException:
    return HTTPException(status_code=409, detail={"error": message, "code": code})
