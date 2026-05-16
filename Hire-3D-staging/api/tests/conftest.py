from __future__ import annotations

import asyncio
import os

os.environ.setdefault("ENVIRONMENT", "TESTING")

import asyncpg
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from api import app
from common.database import Base, get_db
from common.limiter import limiter
from settings import get_settings


async def _ensure_test_db(settings) -> None:
    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USERNAME,
        password=settings.DB_PASSWORD.get_secret_value(),
        database="postgres",
    )
    exists = await conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1", settings.DB_NAME
    )
    if not exists:
        await conn.execute(f'CREATE DATABASE "{settings.DB_NAME}"')
    await conn.close()


async def _create_tables(url: str) -> None:
    engine = create_async_engine(url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()


async def _drop_tables(url: str) -> None:
    engine = create_async_engine(url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> None:
    limiter._storage.reset()


@pytest.fixture(autouse=True)
async def clean_db(db_url: str) -> None:
    engine = create_async_engine(db_url, poolclass=NullPool)
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    await engine.dispose()


@pytest.fixture(scope="session")
def db_url() -> str:
    settings = get_settings()
    asyncio.run(_ensure_test_db(settings))
    asyncio.run(_create_tables(settings.database_url))

    yield settings.database_url

    asyncio.run(_drop_tables(settings.database_url))


@pytest.fixture
async def session(db_url: str):
    engine = create_async_engine(db_url, poolclass=NullPool)
    async with AsyncSession(engine, expire_on_commit=False) as _session:
        yield _session
    await engine.dispose()


@pytest.fixture
async def client(session: AsyncSession):
    async def _override_get_db():
        yield session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
