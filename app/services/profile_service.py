from __future__ import annotations

from datetime import time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.profile import ProfileOut, ProfileUpdate, SettingsOut, SettingsUpdate


def _validate_timezone(name: str) -> None:
    try:
        ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise AppError("INVALID_TIMEZONE", f"无效的时区: {name}", status_code=422) from exc


def get_profile(db: Session, user: User) -> UserProfile:
    profile = db.get(UserProfile, user.id)
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def get_profile_out(db: Session, user: User) -> ProfileOut:
    profile = get_profile(db, user)
    return ProfileOut.model_validate(profile)


def update_profile(db: Session, user: User, payload: ProfileUpdate) -> ProfileOut:
    data = payload.model_dump(exclude_unset=True)
    profile = get_profile(db, user)

    if "display_name" in data and data["display_name"] is not None:
        user.display_name = data["display_name"]
    if "timezone" in data and data["timezone"] is not None:
        _validate_timezone(data["timezone"])
        user.timezone = data["timezone"]

    profile_fields = {
        "education",
        "major",
        "graduation_year",
        "work_years",
        "daily_available_minutes",
        "planning_capacity_factor",
        "preferred_start_time",
        "preferred_end_time",
        "bio",
    }
    for field in profile_fields:
        if field in data:
            setattr(profile, field, data[field])

    if "tech_stack" in data:
        profile.tech_stack_json = data["tech_stack"]
    if "day_boundary_hour" in data and data["day_boundary_hour"] is not None:
        profile.day_boundary_time = time(hour=data["day_boundary_hour"])

    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return ProfileOut.model_validate(profile)


def get_settings_out(db: Session, user: User) -> SettingsOut:
    profile = get_profile(db, user)
    return SettingsOut(
        timezone=user.timezone,
        daily_available_minutes=profile.daily_available_minutes,
        planning_capacity_factor=float(profile.planning_capacity_factor),
        day_boundary_hour=profile.day_boundary_time.hour,
    )


def update_settings(db: Session, user: User, payload: SettingsUpdate) -> SettingsOut:
    data = payload.model_dump(exclude_unset=True)
    profile = get_profile(db, user)
    if "timezone" in data and data["timezone"] is not None:
        _validate_timezone(data["timezone"])
        user.timezone = data["timezone"]
    if "daily_available_minutes" in data and data["daily_available_minutes"] is not None:
        profile.daily_available_minutes = data["daily_available_minutes"]
    if (
        "planning_capacity_factor" in data
        and data["planning_capacity_factor"] is not None
    ):
        profile.planning_capacity_factor = data["planning_capacity_factor"]
    if "day_boundary_hour" in data and data["day_boundary_hour"] is not None:
        profile.day_boundary_time = time(hour=data["day_boundary_hour"])
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return get_settings_out(db, user)
