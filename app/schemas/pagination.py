from __future__ import annotations

from pydantic import BaseModel, Field


class Page[T](BaseModel):
    """Stable list envelope for P2/P3 endpoints.

    Existing P1 list endpoints keep returning arrays; new endpoints use this
    envelope so filtered totals are not inferred from the current page.
    """

    items: list[T]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)
