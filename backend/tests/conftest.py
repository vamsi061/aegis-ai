"""Shared pytest fixtures: SQLite database, seeded demo data, ASGI client."""

import asyncio
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"  # in-memory, must be set pre-import

from sqlalchemy import select  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from aegis.db import reset_engine_for_tests, get_sessionmaker  # noqa: E402
from aegis.models import Agent  # noqa: E402
from aegis.models.base import Base  # noqa: E402
from aegis.seed import seed  # noqa: E402


@pytest_asyncio.fixture
async def db_session():
    reset_engine_for_tests()
    from aegis.db import get_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    import aegis.db as db_mod

    eng = get_engine()
    # Recreate engine with StaticPool so the in-memory DB is shared.
    from sqlalchemy.ext.asyncio import create_async_engine

    eng = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    db_mod._engine = eng
    db_mod._sessionmaker = async_sessionmaker(eng, expire_on_commit=False, class_=AsyncSession)

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = get_sessionmaker()
    async with maker() as session:
        await seed(session)
        await session.commit()
        yield session
    await eng.dispose()
    reset_engine_for_tests()


@pytest_asyncio.fixture
async def agent_ids(db_session):
    rows = (await db_session.execute(select(Agent))).scalars().all()
    return {a.name: str(a.id) for a in rows}


@pytest_asyncio.fixture
async def client():
    from aegis.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
