"""Audit endpoints: event query + trace lineage (FR-11)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.schemas import AuditEventOut, AuditTraceOut, AuditTraceStep
from aegis.services.audit import AuditService
from aegis.api.deps import not_found

audit_router = APIRouter(prefix="/audit", tags=["audit"])

_TRACE_DETAIL_KEYS = (
    "policy_key", "policy_version", "reason", "grant_id", "approval_id",
    "delegation_id", "effective_scope", "expires_at", "alert_id",
    "source_scope", "target_allowed", "requested", "via",
)


def _event_out(e) -> AuditEventOut:
    meta = dict(e.metadata_json or {})
    return AuditEventOut(
        event_id=str(e.id),
        trace_id=e.trace_id,
        timestamp=e.timestamp,
        event_type=e.event_type,
        action=e.action,
        agent_id=str(e.agent_id) if e.agent_id else None,
        parent_agent_id=str(e.parent_agent_id) if e.parent_agent_id else None,
        tool_id=str(e.tool_id) if e.tool_id else None,
        resource=e.resource,
        intent=e.intent,
        decision=e.decision,
        policy_key=meta.get("policy_key"),
        risk_score=e.risk_score,
        latency_ms=e.latency_ms,
        token_usage=e.token_usage,
        estimated_cost=float(e.estimated_cost) if e.estimated_cost is not None else None,
        status=e.status,
        metadata=meta,
    )


@audit_router.get("/events", response_model=list[AuditEventOut])
async def list_events(
    trace_id: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    decision: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    limit: int = Query(default=200, le=1000),
    session: AsyncSession = Depends(get_session),
):
    audit = AuditService(session)
    rows = await audit.list_events(
        trace_id=trace_id, agent_id=agent_id, decision=decision,
        event_type=event_type, since=since, until=until, limit=limit,
    )
    return [_event_out(e) for e in rows]


@audit_router.get("/traces/{trace_id}", response_model=AuditTraceOut)
async def get_trace(trace_id: str, session: AsyncSession = Depends(get_session)):
    audit = AuditService(session)
    data = await audit.get_trace(trace_id)
    if not data["events"]:
        raise not_found("Trace not found", "TRACE_NOT_FOUND")

    steps = []
    for seq, e in enumerate(data["events"], start=1):
        meta = dict(e.metadata_json or {})
        steps.append(
            AuditTraceStep(
                seq=seq,
                event_id=str(e.id),
                event_type=e.event_type,
                agent_id=str(e.agent_id) if e.agent_id else None,
                action=e.action,
                decision=e.decision,
                detail={k: v for k, v in meta.items() if k in _TRACE_DETAIL_KEYS},
                timestamp=e.timestamp,
            )
        )

    grants = [
        {
            "grant_id": str(g.id),
            "tool": g.tool_name,
            "status": g.status,
            "scope": g.scope,
            "issued_at": g.issued_at.isoformat(),
            "expires_at": g.expires_at.isoformat(),
        }
        for g in data["grants"]
    ]
    delegations = [
        {
            "delegation_id": str(d.id),
            "source_agent_id": str(d.source_agent_id),
            "target_agent_id": str(d.target_agent_id),
            "status": d.status,
            "effective_scope": d.effective_scope,
            "expires_at": d.expires_at.isoformat(),
        }
        for d in data["delegations"]
    ]
    return AuditTraceOut(trace_id=trace_id, steps=steps, grants=grants, delegations=delegations)