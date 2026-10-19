from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: str
    action: str
    target_type: str | None = None
    target_id: str | None = None
    before: dict | None = None
    after: dict | None = None
    request_id: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    created_at: datetime
