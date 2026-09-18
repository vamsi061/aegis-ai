"""Delegation endpoints (docs/api-spec.md section 5)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.schemas import DelegationCreate, DelegationOut
from aegis.services.delegations import DelegationError, DelegationService
from aegis.services import delegations_ext  # noqa: F401

delegation_router = APIRouter(prefix="/delegations", tags=["delegation"])


def _out(d, trace_id: str) -> DelegationOut:
    return DelegationOut(
        delegation_id=str(d.id),
        trace_id=trace_id,
        source_agent_id=str(d.source_agent_id),
        target_agent_id=str(d.target_agent_id),
        status=d.status,
        effective_scope=d.effective_scope,
        expires_at=d.expires_at,
    )


@delegation_router.post("", response_model=DelegationOut, status_code=201)
async def create_delegation(body: DelegationCreate, session: AsyncSession = Depends(get_session)):
    service = DelegationService(session)
    try:
        result = await service.create_delegation(body)
    except DelegationError as exc:
        if exc.code == "PRIVILEGE_ESCALATION":
            # The service already wrote the denial evidence (security alert +
            # DELEGATION_DENIED audit event). Commit it before raising so the
            # request-scoped rollback cannot erase the append-only record.
            await session.commit()
        code = 404 if exc.code == "AGENT_NOT_FOUND" else 403
        raise HTTPException(status_code=code, detail={"error": str(exc), "code": exc.code}) from exc
    return _out(result["delegation"], result["trace_id"])


@delegation_router.get("", response_model=list[DelegationOut])
async def list_delegations(
    active_only: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
):
    service = DelegationService(session)
    rows = await service.list_delegations(active_only)
    return [_out(d, d.trace_id) for d in rows]