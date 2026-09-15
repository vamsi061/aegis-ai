"""Audit events and security alerts (append-only from the application)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, func, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from aegis.models.base import Base, JSONType, _uuid


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    trace_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    parent_event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    initiating_user_id: Mapped[str | None] = mapped_column(String(64))
    agent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    parent_agent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str | None] = mapped_column(String(255))
    tool_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    resource: Mapped[str | None] = mapped_column(String(255))
    intent: Mapped[dict | None] = mapped_column(JSONType)
    decision: Mapped[str | None] = mapped_column(String(40), index=True)
    policy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    risk_score: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    token_usage: Mapped[int | None] = mapped_column(Integer)
    estimated_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))
    status: Mapped[str | None] = mapped_column(String(40))
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONType, nullable=False, default=dict)

    __table_args__ = (Index("ix_audit_created", "timestamp"),)


class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    trace_id: Mapped[str | None] = mapped_column(String(128), index=True)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    alert_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
