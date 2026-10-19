from datetime import UTC, date, datetime

import pytest
from app.core.time import day_window, user_today


def test_user_today_respects_day_boundary_before() -> None:
    # 2026-10-19 19:59 UTC = 2026-10-20 03:59 Asia/Shanghai
    now = datetime(2026, 10, 19, 19, 59, tzinfo=UTC)
    assert user_today("Asia/Shanghai", 4, now) == date(2026, 10, 19)


def test_user_today_respects_day_boundary_at_start() -> None:
    # 2026-10-19 20:00 UTC = 2026-10-20 04:00 Asia/Shanghai
    now = datetime(2026, 10, 19, 20, 0, tzinfo=UTC)
    assert user_today("Asia/Shanghai", 4, now) == date(2026, 10, 20)


def test_day_window_is_half_open_and_utc() -> None:
    start, end = day_window("Asia/Shanghai", date(2026, 10, 20), 4)
    assert start == datetime(2026, 10, 19, 20, 0, tzinfo=UTC)
    assert end == datetime(2026, 10, 20, 20, 0, tzinfo=UTC)
    assert end > start


def test_day_boundary_validation() -> None:
    with pytest.raises(ValueError):
        user_today("Asia/Shanghai", 24)
