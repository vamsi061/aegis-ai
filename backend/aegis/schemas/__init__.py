"""Pydantic request/response contracts matching docs/api-spec.md."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from aegis.domain import AgentStatus, Decision, RiskLevel


def _uid(value: uuid.UUID | str | None) -> str | None:
    if value is None:
        return None
    return str(value)


# --- Agent Registry -------------------------------------------------------


class AgentCreate(BaseModel):
    name: str
    description: str | None = None
    owner_user_id: str
    purpose: str
    environment: str = "demo"
    risk_level: RiskLevel = RiskLevel.MEDIUM
    data_scope: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    description: str | None = None
    purpose: str | None = None
    risk_level: RiskLevel | None = None
    data_scope: list[str] | None = None
    capabilities: list[str] | None = None
    metadata: dict[str, Any] | None = None


class AgentOut(BaseModel):
    agent_id: str
    external_identity_id: str
    name: str
    description: str | None
    owner_user_id: str
    purpose: str
    environment: str
    risk_level: str
    status: AgentStatus
    data_scope: list[str]
    capabilities: list[str]
    created_at: datetime
    updated_at: datetime


class AgentActionOut(BaseModel):
    agent_id: str
    status: AgentStatus
    revoked_grants: int = 0


# --- Authorization ---------------------------------------------------------


class AuthorizeRequest(BaseModel):
    agent_id: str
    initiating_user_id: str | None = None
    action: str
    tool: str
    target: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)


class IntentOut(BaseModel):
    action: str
    target: str | None = None
    tool: str | None = None
    data_scope: list[str] = Field(default_factory=list)
    sensitivity: str = "LOW"
    amount: float | None = None
    risk_indicators: list[str] = Field(default_factory=list)
    source: str = "deterministic"


class GrantOut(BaseModel):
    grant_id: str
    expires_at: datetime
    scope: dict[str, Any] = Field(default_factory=dict)


class ApprovalNeededOut(BaseModel):
    approval_id: str
    expires_at: datetime


class AuthorizeResponse(BaseModel):
    request_id: str
    trace_id: str
    decision: Decision
    risk_score: int
    risk_level: str
    policy_id: str | None = None
    policy_version: int | None = None
    reason: str
    intent: IntentOut | None = None
    grant: GrantOut | None = None
    approval: ApprovalNeededOut | None = None


# --- Tool Execution --------------------------------------------------------


class ToolExecuteRequest(BaseModel):
    grant_id: str
    input: dict[str, Any] = Field(default_factory=dict)


class ToolExecuteResponse(BaseModel):
    status: str
    tool: str
    result: Any = None
    trace_id: str
    executed_at: datetime


# --- Approvals --------------------------------------------------------------


class ApprovalResolve(BaseModel):
    approver_id: str
    reason: str | None = None


class ApprovalOut(BaseModel):
    approval_id: str
    authorization_request_id: str
    agent_id: str | None
    tool: str | None
    action: str | None
    initiating_user_id: str | None
    risk_score: int
    reason: str
    status: str
    requested_at: datetime
    expires_at: datetime
    resolved_by: str | None = None
    resolution_reason: str | None = None


# Registry/governance schemas live in schemas/registry.py (single source of
# truth); re-export them here so `from aegis.schemas import X` works everywhere.
from aegis.schemas.registry import (  # noqa: E402, F401
    AccessGrantOut,
    AlertOut,
    AlertResolve,
    AuditEventOut,
    AuditTraceOut,
    AuditTraceStep,
    DelegationCreate,
    DelegationOut,
    DelegationScope,
    ErrorOut,
    HealthOut,
    IdOut,
    McpServerCreate,
    McpServerOut,
    McpToolCreate,
    McpToolOut,
    PolicyDetailOut,
    PolicyOut,
    PolicyVersionOut,
    ReadyOut,
)
