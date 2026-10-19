from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ConsentScope = Literal["ai_import", "privacy_policy"]


class ConsentUpdate(BaseModel):
    scope: ConsentScope
    version: str = Field(min_length=1, max_length=32)
    granted: bool


class ConsentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scope: str
    version: str
    granted_at: datetime
    revoked_at: datetime | None = None
