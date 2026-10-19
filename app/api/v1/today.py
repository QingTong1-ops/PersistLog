from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.planning import (
    BlockRequest,
    CompleteRequest,
    ForecastOut,
    OccurrenceOut,
    OccurrenceUpdate,
    SkipRequest,
    SplitRequest,
    TodayResponse,
)
from app.services import planning_service

router = APIRouter(tags=["planning"])


@router.get("/today", response_model=TodayResponse)
def get_today(
    user: CurrentUser,
    db: DbSession,
    on_date: Annotated[date | None, Query(alias="date")] = None,
) -> TodayResponse:
    return planning_service.get_today(db, user, on_date)


@router.post("/today/generate", response_model=TodayResponse)
def generate_today(
    user: CurrentUser,
    db: DbSession,
    on_date: Annotated[date | None, Query(alias="date")] = None,
) -> TodayResponse:
    return planning_service.get_today(db, user, on_date)


@router.get("/routes/{route_id}/forecast", response_model=ForecastOut)
def forecast_route(user: CurrentUser, db: DbSession, route_id: str) -> ForecastOut:
    return planning_service.forecast_route(db, user, route_id)


@router.post("/task-occurrences/{occurrence_id}/start", response_model=OccurrenceOut)
def start_occurrence(
    user: CurrentUser, db: DbSession, occurrence_id: str
) -> OccurrenceOut:
    return planning_service.start_occurrence(db, user, occurrence_id)


@router.post("/task-occurrences/{occurrence_id}/complete", response_model=OccurrenceOut)
def complete_occurrence(
    user: CurrentUser,
    db: DbSession,
    occurrence_id: str,
    payload: CompleteRequest | None = None,
) -> OccurrenceOut:
    return planning_service.complete_occurrence(
        db, user, occurrence_id, payload or CompleteRequest()
    )


@router.post("/task-occurrences/{occurrence_id}/postpone", response_model=OccurrenceOut)
def postpone_occurrence(
    user: CurrentUser, db: DbSession, occurrence_id: str
) -> OccurrenceOut:
    return planning_service.postpone_occurrence(db, user, occurrence_id)


@router.post("/task-occurrences/{occurrence_id}/skip", response_model=OccurrenceOut)
def skip_occurrence(
    user: CurrentUser, db: DbSession, occurrence_id: str, payload: SkipRequest
) -> OccurrenceOut:
    return planning_service.skip_occurrence(db, user, occurrence_id, payload)


@router.post("/task-occurrences/{occurrence_id}/block", response_model=OccurrenceOut)
def block_occurrence(
    user: CurrentUser, db: DbSession, occurrence_id: str, payload: BlockRequest
) -> OccurrenceOut:
    return planning_service.block_occurrence(db, user, occurrence_id, payload)


@router.post("/task-occurrences/{occurrence_id}/unblock", response_model=OccurrenceOut)
def unblock_occurrence(
    user: CurrentUser, db: DbSession, occurrence_id: str
) -> OccurrenceOut:
    return planning_service.unblock_occurrence(db, user, occurrence_id)


@router.post("/task-occurrences/{occurrence_id}/abandon", response_model=OccurrenceOut)
def abandon_occurrence(
    user: CurrentUser, db: DbSession, occurrence_id: str
) -> OccurrenceOut:
    return planning_service.abandon_occurrence(db, user, occurrence_id)


@router.patch("/task-occurrences/{occurrence_id}", response_model=OccurrenceOut)
def update_occurrence(
    user: CurrentUser,
    db: DbSession,
    occurrence_id: str,
    payload: OccurrenceUpdate,
) -> OccurrenceOut:
    return planning_service.update_occurrence(db, user, occurrence_id, payload)


@router.post(
    "/task-occurrences/{occurrence_id}/split",
    response_model=list[OccurrenceOut],
)
def split_occurrence(
    user: CurrentUser, db: DbSession, occurrence_id: str, payload: SplitRequest
) -> list[OccurrenceOut]:
    return planning_service.split_occurrence(db, user, occurrence_id, payload)
