from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

from app.schemas.common import serialize_utc_datetime


def test_naive_datetime_is_treated_as_utc() -> None:
    value = datetime(2026, 10, 20, 1, 2, 3, 456000)
    assert serialize_utc_datetime(value) == "2026-10-20T01:02:03.456Z"


def test_aware_datetime_is_converted_to_utc() -> None:
    value = datetime(2026, 10, 20, 9, 2, 3, tzinfo=timezone(timedelta(hours=8)))
    assert serialize_utc_datetime(value) == "2026-10-20T01:02:03.000Z"


def test_utc_datetime_keeps_z_suffix() -> None:
    value = datetime(2026, 10, 20, 1, 2, 3, tzinfo=UTC)
    assert serialize_utc_datetime(value).endswith("Z")
