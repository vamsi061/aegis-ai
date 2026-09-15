"""FastAPI application factory (docs/architecture.md section 2.1)."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from aegis.api.agents import router as agents_router
from aegis.api.alerts import alerts_router
from aegis.api.audit import audit_router
from aegis.api.authorization import router as authorization_router
from aegis.api.delegations import delegation_router
from aegis.api.health import health_router
from aegis.api.lifecycle import router as lifecycle_router
from aegis.api.mcp import mcp_router
from aegis.api.policies import router as policies_router
from aegis.api.grants import router as grants_router
from aegis.api.approvals import router as approvals_router
from aegis.api.approval_actions import router as approval_actions_router
from aegis.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed demo data idempotently on startup."""
    from aegis.db import get_engine, get_sessionmaker
    from aegis.models.base import Base
    from aegis.seed import seed

    eng = get_engine()
    if not get_settings().database_url.startswith("sqlite"):
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        maker = get_sessionmaker()
        async with maker() as session:
            await seed(session)
            await session.commit()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Agentic AI governance and identity control plane",
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def trace_header_middleware(request: Request, call_next):
        response = await call_next(request)
        response.headers["x-aegis-service"] = "aegis-ai"
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logging.getLogger("aegis.api").exception("Unhandled error on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "code": "INTERNAL_ERROR"},
        )

    api_prefix = "/api/v1"
    app.include_router(agents_router, prefix=api_prefix)
    app.include_router(lifecycle_router, prefix=api_prefix)
    app.include_router(authorization_router, prefix=api_prefix)
    app.include_router(approvals_router, prefix=api_prefix)
    app.include_router(approval_actions_router, prefix=api_prefix)
    app.include_router(delegation_router, prefix=api_prefix)
    app.include_router(mcp_router, prefix=api_prefix)
    app.include_router(policies_router, prefix=api_prefix)
    app.include_router(grants_router, prefix=api_prefix)
    app.include_router(audit_router, prefix=api_prefix)
    app.include_router(alerts_router, prefix=api_prefix)
    app.include_router(health_router, prefix=api_prefix)
    return app


app = create_app()

