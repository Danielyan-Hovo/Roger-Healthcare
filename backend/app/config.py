"""Runtime configuration loaded from environment variables.

The Anthropic API key is intentionally read from the environment and never
hard-coded. The production model name is hard-coded as a constant so the
deployment is deterministic and easy to audit.
"""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Hard-coded production model (per spec).
ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://roger:roger@db:5432/roger"
    anthropic_api_key: str | None = None

    cors_allow_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost",
        "http://127.0.0.1:5173",
    ]

    db_connect_max_seconds: int = 30
    db_connect_initial_backoff: float = 0.5
    db_connect_max_backoff: float = 4.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
    )
