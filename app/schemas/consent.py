from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import UTCDateTime

ConsentScope = Literal["ai_import", "privacy_policy"]


class ConsentUpdate(BaseModel):
    scope: ConsentScope
    version: str = Field(min_length=1, max_length=32)
    granted: bool


class ConsentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scope: str
    version: str
    granted_at: UTCDateTime
    revoked_at: UTCDateTime | None = None
