from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ImportIssueOut(BaseModel):
    severity: str
    code: str
    message: str
    suggestion: str | None = None
    source_locator: str | None = None


class ImportCreated(BaseModel):
    import_id: str
    job_id: str
    status: str


class ImportPreview(BaseModel):
    import_id: str
    status: str
    route: dict[str, Any] | None = None
    assumptions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    stats: dict[str, int] = Field(default_factory=dict)
    issues: list[ImportIssueOut] = Field(default_factory=list)
    updated_at: datetime


class ImportSummary(BaseModel):
    import_id: str
    status: str
    format: str
    file_name: str | None = None
    route_id: str | None = None
    created_at: datetime


class ImportDetail(ImportPreview):
    format: str
    file_name: str | None = None
    route_id: str | None = None
    created_at: datetime


class PreviewUpdate(BaseModel):
    route: dict[str, Any]


class ImportConfirmResponse(BaseModel):
    route_id: str
    status: str = "active"
    created_tasks: int
