"""Health/readiness endpoints (docs/api-spec.md section 9)."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.config import get_settings
from aegis.db import get_session
from aegis.schemas import ReadyOut

health_router = APIRouter(tags=["health"])


@health_router.get("/health")
async def health():
    settings = get_settings()
    return {"status": "ok", "service": settings.app_name, "environment": settings.environment}


@health_router.get("/ready", response_model=ReadyOut)
async def ready(session: AsyncSession = Depends(get_session)):
    try:
        await session.execute(text("SELECT 1"))
        return ReadyOut(ready=True, database="connected")
    except Exception:
        return ReadyOut(ready=False, database="unavailable")