from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, Request
from sqlalchemy.orm import Session

from app.api.v1.router import router as api_v1_router
from app.core.config import Settings, get_settings
from app.core.db import check_database, get_db
from app.core.errors import AppError, install_exception_handlers
from app.core.logging import configure_logging

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.debug)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        logger.info("starting %s (%s)", settings.app_name, settings.app_env)
        yield
        logger.info("stopping %s", settings.app_name)

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        debug=settings.debug,
        lifespan=lifespan,
    )
    install_exception_handlers(app)

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    app.include_router(api_v1_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {
            "app": settings.app_name,
            "version": settings.version,
            "docs": "/docs",
            "health": "/health",
        }

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "app": settings.app_name,
            "env": settings.app_env,
            "version": settings.version,
        }

    @app.get("/health/db", tags=["meta"])
    def health_db(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
        del db
        try:
            check_database()
        except Exception as exc:  # noqa: BLE001
            raise AppError(
                code="DATABASE_UNAVAILABLE",
                message="数据库不可用",
                status_code=503,
                details={"reason": type(exc).__name__},
            ) from exc
        return {"status": "ok", "database": "ok"}

    return app


app = create_app()
