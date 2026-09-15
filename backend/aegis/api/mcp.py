"""MCP registry endpoints (docs/api-spec.md section 6)."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.models import McpServer, McpTool
from aegis.schemas import McpServerCreate, McpServerOut, McpToolCreate, McpToolOut
from aegis.api.deps import not_found

mcp_router = APIRouter(prefix="/mcp", tags=["mcp"])


@mcp_router.post("/servers", response_model=McpServerOut, status_code=201)
async def register_server(body: McpServerCreate, session: AsyncSession = Depends(get_session)):
    row = McpServer(name=body.name, endpoint=body.endpoint, status="ACTIVE", metadata_json=body.metadata)
    session.add(row)
    await session.flush()
    return McpServerOut(
        server_id=str(row.id), name=row.name, endpoint=row.endpoint,
        status=row.status, created_at=row.created_at,
    )


@mcp_router.get("/servers", response_model=list[McpServerOut])
async def list_servers(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(McpServer).order_by(McpServer.created_at.asc()))).scalars().all()
    return [
        McpServerOut(server_id=str(r.id), name=r.name, endpoint=r.endpoint, status=r.status, created_at=r.created_at)
        for r in rows
    ]


@mcp_router.post("/servers/{server_id}/tools", response_model=McpToolOut, status_code=201)
async def register_tool(server_id: str, body: McpToolCreate, session: AsyncSession = Depends(get_session)):
    server = await session.get(McpServer, uuid.UUID(server_id))
    if server is None:
        raise not_found("Server not found", "SERVER_NOT_FOUND")
    row = McpTool(
        server_id=server.id,
        name=body.name,
        description=body.description,
        risk_level=body.risk_level.value if hasattr(body.risk_level, "value") else str(body.risk_level),
        status="ACTIVE",
        input_schema=body.input_schema,
    )
    session.add(row)
    await session.flush()
    return McpToolOut(
        tool_id=str(row.id), server_id=str(row.server_id), name=row.name,
        description=row.description, risk_level=row.risk_level, status=row.status,
    )


@mcp_router.get("/tools", response_model=list[McpToolOut])
async def list_tools(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(McpTool).order_by(McpTool.name.asc()))).scalars().all()
    return [
        McpToolOut(
            tool_id=str(r.id), server_id=str(r.server_id), name=r.name,
            description=r.description, risk_level=r.risk_level, status=r.status,
        )
        for r in rows
    ]