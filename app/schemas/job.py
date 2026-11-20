from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.schemas.common import UTCDateTime


class JobOut(BaseModel):
    id: str
    job_type: str
    status: str
    stage: str | None = None
    steps: list[dict[str, Any]] | None = None
    progress: float
    attempt: int = 0
    max_attempts: int = 2
    retryable: bool = True
    result_ref: str | None = None
    result_version: str | None = None
    error: dict[str, Any] | None = None
    started_at: UTCDateTime | None = None
    finished_at: UTCDateTime | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
