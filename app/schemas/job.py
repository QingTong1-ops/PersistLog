from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class JobOut(BaseModel):
    id: str
    job_type: str
    status: str
    progress: float
    result_ref: str | None = None
    error: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
