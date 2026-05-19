"""FastAPI application bootstrap."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router as api_router
from .config import get_settings
from .database import create_all, wait_for_db
from .errors import install_exception_handlers
from .schemas import HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("roger.main")


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    logger.info("startup: waiting for database...")
    await wait_for_db()
    logger.info("startup: ensuring schema...")
    await create_all()
    logger.info("startup: complete")
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Roger Health — Patient Encounter Portal",
        version="1.0.0",
        description=(
            "Backend API for the Roger Health Patient Encounter Portal. "
            "Provides patient management with optimistic locking and AI-powered "
            "transcript summarization."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/healthz", response_model=HealthResponse, tags=["health"])
    async def healthz() -> HealthResponse:
        return HealthResponse(status="ok")

    return app


app = create_app()
