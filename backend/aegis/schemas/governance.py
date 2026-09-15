"""Delegation, MCP, audit, alerts and misc schemas (part 2 split)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from aegis.domain import RiskLevel
from aegis.schemas import _uid


class DelegationScope(BaseModel):
    capabilities: list[str] = Field(default_factory=list)


class DelegationCreate(BaseModel):
    source_agent_id: str
    target_agent_id: str
    requested_scope: DelegationScope
    ttl_seconds: int = Field(default=300, le=900)


class DelegationOut(BaseModel):
    delegation_id: str
    trace_id: str
    source_agent_id: str
    target_agent_id: str
    status: str
    effective_scope: dict[str, Any]
    expires_at: datetime


class McpServerCreate(BaseModel):
    name: str
    endpoint: str | None = None
    owner_user_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class McpServerOut(BaseModel):
    server_id: str
    name: str
    endpoint: str | None
    status: str
    created_at: datetime


class McpToolCreate(BaseModel):
    name: str
    description: str | None = None
    risk_level: RiskLevel = RiskLevel.LOW
    input_schema: dict[str, Any] = Field(default_factory=dict)


class McpToolOut(BaseModel):
    tool_id: str
    server_id: str
    name: str
    description: str | None
    risk_level: str
    status: str


class AuditEventOut(BaseModel):
    event_id: str
    trace_id: str
    timestamp: datetime
    event_type: str
    action: str | None
    agent_id: str | None
    parent_agent_id: str | None
    tool_id: str | None
    resource: str | None
    intent: dict[str, Any] | None
    decision: str | None
    policy_key: str | None = None
    risk_score: int | None
    latency_ms: int | None
    token_usage: int | None
    estimated_cost: float | None
    status: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuditTraceStep(BaseModel):
    seq: int
    event_id: str
    event_type: str
    agent_id: str | None
    action: str | None
    decision: str | None
    detail: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime


class AuditTraceOut(BaseModel):
    trace_id: str
    steps: list[AuditTraceStep]
    grants: list[dict[str, Any]] = Field(default_factory=list)
    delegations: list[dict[str, Any]] = Field(default_factory=list)


class AlertOut(BaseModel):
    alert_id: str
    trace_id: str | None
    agent_id: str | None
    alert_type: str
    severity: str
    description: str
    status: str
    created_at: datetime
    resolved_at: datetime | None = None


class AlertResolve(BaseModel):
    resolved_by: str | None = None
    reason: str | None = None


class ErrorOut(BaseModel):
    error: str
    code: str
    detail: Any = None


class HealthOut(BaseModel):
    status: str
    service: str
    environment: str


class ReadyOut(BaseModel):
    ready: bool
    database: str


class IdOut(BaseModel):
    id: str


class AgentListOut(BaseModel):
    agents: list[Any]


# Re-exported from registry.py to keep a single source of truth.
from aegis.schemas.registry import (  # noqa: E402, F401
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
    ReadyOut,
)

