from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.schemas.common import UTCDateTime


class JobOut(BaseModel):
    id: str
    job_type: str
    status: str
    progress: float
    result_ref: str | None = None
    error: dict[str, Any] | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
