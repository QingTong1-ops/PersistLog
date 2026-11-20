from __future__ import annotations

from app.api.deps import PaginationParams
from app.schemas.pagination import Page


def test_page_envelope_keeps_total_independent_of_items() -> None:
    page = Page[dict](
        items=[{"id": "1"}, {"id": "2"}],
        total=42,
        limit=2,
        offset=0,
    )
    assert page.total == 42
    assert page.limit == 2
    assert page.offset == 0
    assert len(page.items) == 2


def test_pagination_params_values() -> None:
    params = PaginationParams(limit=50, offset=10)
    assert params.limit == 50
    assert params.offset == 10
