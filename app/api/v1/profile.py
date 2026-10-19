from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.profile import (
    ProfileOut,
    ProfileUpdate,
    SettingsOut,
    SettingsUpdate,
)
from app.services import profile_service

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: CurrentUser, db: DbSession) -> ProfileOut:
    return profile_service.get_profile_out(db, user)


@router.put("/profile", response_model=ProfileOut)
def update_profile(user: CurrentUser, db: DbSession, payload: ProfileUpdate) -> ProfileOut:
    return profile_service.update_profile(db, user, payload)


@router.get("/settings", response_model=SettingsOut)
def get_settings(user: CurrentUser, db: DbSession) -> SettingsOut:
    return profile_service.get_settings_out(db, user)


@router.put("/settings", response_model=SettingsOut)
def update_settings(
    user: CurrentUser, db: DbSession, payload: SettingsUpdate
) -> SettingsOut:
    return profile_service.update_settings(db, user, payload)
