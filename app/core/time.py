from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def utcnow() -> datetime:
    return datetime.now(UTC)


def user_now(tz: str, now: datetime | None = None) -> datetime:
    current = now or utcnow()
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    return current.astimezone(ZoneInfo(tz))


def user_today(tz: str, day_boundary_hour: int = 4, now: datetime | None = None) -> date:
    """Return the logical day in the user's timezone.

    A day starts at ``day_boundary_hour`` local time. For example, with a 04:00
    boundary, 03:59 belongs to the previous day and 04:00 belongs to the new day.
    """
    if not 0 <= day_boundary_hour <= 23:
        raise ValueError("day_boundary_hour must be between 0 and 23")
    local = user_now(tz, now)
    if local.hour < day_boundary_hour:
        return (local - timedelta(days=1)).date()
    return local.date()


def day_window(tz: str, day: date, day_boundary_hour: int = 4) -> tuple[datetime, datetime]:
    """Return the UTC [start, end) window for a logical day."""
    if not 0 <= day_boundary_hour <= 23:
        raise ValueError("day_boundary_hour must be between 0 and 23")
    zone = ZoneInfo(tz)
    local_start = datetime.combine(day, time(hour=day_boundary_hour), tzinfo=zone)
    local_end = local_start + timedelta(days=1)
    return local_start.astimezone(UTC), local_end.astimezone(UTC)
