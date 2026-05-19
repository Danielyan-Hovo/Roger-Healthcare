"""Async SQLAlchemy engine, session factory, and startup helpers.

Uses asyncpg under the hood for non-blocking I/O on every DB call. The
``wait_for_db`` helper retries connection attempts with exponential backoff
so the API container can come up before Postgres is fully ready without
crashing the process.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    echo=False,
    pool_pre_ping=True,
    future=True,
)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a per-request AsyncSession."""

    async with AsyncSessionLocal() as session:
        yield session


async def wait_for_db(
    max_seconds: int | None = None,
    initial_backoff: float | None = None,
    max_backoff: float | None = None,
) -> None:
    """Block until the database accepts connections, or raise after ``max_seconds``.

    Uses bounded exponential backoff so we don't hammer Postgres while it
    is still initializing.
    """

    s = get_settings()
    deadline = time.monotonic() + (max_seconds or s.db_connect_max_seconds)
    backoff = initial_backoff or s.db_connect_initial_backoff
    backoff_cap = max_backoff or s.db_connect_max_backoff

    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            async with engine.connect() as conn:
                await conn.execute(_ping_stmt())
            logger.info("database connection established")
            return
        except Exception as exc:  # noqa: BLE001 — broad on purpose during startup
            last_error = exc
            logger.warning("waiting for database: %s", exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, backoff_cap)

    raise RuntimeError(
        f"database did not become ready within {max_seconds}s: {last_error}"
    )


def _ping_stmt():
    """Tiny no-op statement used purely to validate a live connection."""

    from sqlalchemy import text

    return text("SELECT 1")


async def create_all() -> None:
    """Create tables for any model registered on ``Base``.

    For a take-home demo this is simpler than Alembic; in production we'd
    swap this out for migrations.
    """

    from . import models  # noqa: F401 — ensure models are imported

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
