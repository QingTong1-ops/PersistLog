from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.dashboard import (
    DashboardForecast,
    DashboardOverview,
    DistributionResponse,
    TrendResponse,
)
from app.services import dashboard_service, planning_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _end_date(user: CurrentUser, db: DbSession, value: date | None) -> date:
    return value or planning_service.logical_today(db, user)


@router.get("/overview", response_model=DashboardOverview)
def get_overview(
    user: CurrentUser,
    db: DbSession,
    on_date: Annotated[date | None, Query(alias="date")] = None,
    days: Annotated[int, Query(ge=1, le=90)] = 7,
) -> DashboardOverview:
    return dashboard_service.overview(db, user, _end_date(user, db, on_date), days)


@router.get("/trends", response_model=TrendResponse)
def get_trends(
    user: CurrentUser,
    db: DbSession,
    on_date: Annotated[date | None, Query(alias="date")] = None,
    days: Annotated[int, Query(ge=1, le=90)] = 14,
) -> TrendResponse:
    return dashboard_service.trends(db, user, _end_date(user, db, on_date), days)


@router.get("/distribution", response_model=DistributionResponse)
def get_distribution(
    user: CurrentUser,
    db: DbSession,
    on_date: Annotated[date | None, Query(alias="date")] = None,
    days: Annotated[int, Query(ge=1, le=90)] = 7,
) -> DistributionResponse:
    return dashboard_service.distribution(
        db, user, _end_date(user, db, on_date), days
    )


@router.get("/forecast", response_model=DashboardForecast)
def get_forecast(user: CurrentUser, db: DbSession) -> DashboardForecast:
    return dashboard_service.forecast(db, user)
