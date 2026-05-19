"""FastAPI dependency wrappers."""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_session


async def db_session() -> AsyncIterator[AsyncSession]:
    """Yield a per-request AsyncSession.

    Thin re-export so callers can ``Depends(db_session)`` without touching
    ``database`` internals directly.
    """

    async for session in get_session():
        yield session


SessionDep = Depends(db_session)
