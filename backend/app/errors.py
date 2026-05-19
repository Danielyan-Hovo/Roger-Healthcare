"""Centralized exception types and FastAPI exception handlers."""

from __future__ import annotations

import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AISummaryError(RuntimeError):
    """Raised by the AI summary service when the upstream call fails.

    The encounter persistence flow catches this so the row is still saved
    and the API caller sees a 200 with a placeholder summary instead of a
    server-side 5xx.
    """


def install_exception_handlers(app: FastAPI) -> None:
    """Attach JSON-formatted exception handlers to the FastAPI app."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(  # noqa: ANN202
        request: Request, exc: StarletteHTTPException
    ):
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.detail if isinstance(exc.detail, (dict, list)) else {"error": exc.detail}),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(  # noqa: ANN202
        request: Request, exc: RequestValidationError
    ):
        return JSONResponse(
            status_code=422,
            content={"error": "validation_error", "detail": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(  # noqa: ANN202
        request: Request, exc: Exception
    ):
        logger.error(
            "unhandled exception on %s %s: %s\n%s",
            request.method,
            request.url.path,
            exc,
            traceback.format_exc(),
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "message": "An unexpected error occurred.",
            },
        )


def _envelope(detail):
    if isinstance(detail, dict):
        return detail
    return {"detail": detail}
