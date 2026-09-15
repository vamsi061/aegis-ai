"""Security alert endpoints (FR-13 evidence)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.schemas import AlertOut, AlertResolve
from aegis.services.audit import AuditService
from aegis.api.deps import not_found

alerts_router = APIRouter(prefix="/alerts", tags=["alerts"])


@alerts_router.get("", response_model=list[AlertOut])
async def list_alerts(
    status: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    audit = AuditService(session)
    rows = await audit.list_alerts(status)
    return [
        AlertOut(
            alert_id=str(a.id),
            trace_id=a.trace_id,
            agent_id=str(a.agent_id) if a.agent_id else None,
            alert_type=a.alert_type,
            severity=a.severity,
            description=a.description,
            status=a.status,
            created_at=a.created_at,
            resolved_at=a.resolved_at,
        )
        for a in rows
    ]


@alerts_router.post("/{alert_id}/resolve", response_model=AlertOut)
async def resolve_alert(alert_id: str, body: AlertResolve, session: AsyncSession = Depends(get_session)):
    audit = AuditService(session)
    alert = await audit.resolve_alert(alert_id, body.reason)
    if alert is None:
        raise not_found("Alert not found", "ALERT_NOT_FOUND")
    return AlertOut(
        alert_id=str(alert.id),
        trace_id=alert.trace_id,
        agent_id=str(alert.agent_id) if alert.agent_id else None,
        alert_type=alert.alert_type,
        severity=alert.severity,
        description=alert.description,
        status=alert.status,
        created_at=alert.created_at,
        resolved_at=alert.resolved_at,
    )