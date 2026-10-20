from __future__ import annotations

from fastapi import APIRouter, Query, Request, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.route import (
    RouteAdjust,
    RouteCreate,
    RouteDetail,
    RouteSummary,
    RouteUpdate,
    RouteVersionDetail,
    RouteVersionSummary,
    StageCreate,
    StageUpdate,
    WeekCreate,
    WeekUpdate,
)
from app.services import audit_service, route_service

router = APIRouter(prefix="/routes", tags=["routes"])
stage_router = APIRouter(prefix="/stages", tags=["routes"])


@router.get("", response_model=list[RouteSummary])
def list_routes(
    user: CurrentUser,
    db: DbSession,
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="按状态过滤；默认排除 archived，传 all 返回全部",
    ),
) -> list[RouteSummary]:
    return [
        RouteSummary.model_validate(route)
        for route in route_service.list_routes(db, user, status=status_filter)
    ]


@router.post("", response_model=RouteDetail, status_code=status.HTTP_201_CREATED)
def create_route(user: CurrentUser, db: DbSession, payload: RouteCreate) -> RouteDetail:
    return route_service.create_route(db, user, payload)


@router.get("/{route_id}", response_model=RouteDetail)
def get_route(user: CurrentUser, db: DbSession, route_id: str) -> RouteDetail:
    route = route_service.get_route(db, user, route_id)
    return route_service.route_detail(db, route)


@router.patch("/{route_id}", response_model=RouteDetail)
def update_route(
    user: CurrentUser, db: DbSession, route_id: str, payload: RouteUpdate
) -> RouteDetail:
    return route_service.update_route(db, user, route_id, payload)


@router.post("/{route_id}/activate", response_model=RouteDetail)
def activate_route(user: CurrentUser, db: DbSession, route_id: str) -> RouteDetail:
    return route_service.activate_route(db, user, route_id)


@router.post("/{route_id}/pause", response_model=RouteDetail)
def pause_route(user: CurrentUser, db: DbSession, route_id: str) -> RouteDetail:
    return route_service.pause_route(db, user, route_id)


@router.post("/{route_id}/resume", response_model=RouteDetail)
def resume_route(user: CurrentUser, db: DbSession, route_id: str) -> RouteDetail:
    return route_service.resume_route(db, user, route_id)


@router.post("/{route_id}/archive", response_model=RouteDetail)
def archive_route(user: CurrentUser, db: DbSession, route_id: str) -> RouteDetail:
    return route_service.archive_route(db, user, route_id)


@router.post("/{route_id}/adjust", response_model=RouteDetail)
def adjust_route(
    user: CurrentUser,
    db: DbSession,
    request: Request,
    route_id: str,
    payload: RouteAdjust,
) -> RouteDetail:
    result = route_service.adjust_route(db, user, route_id, payload)
    audit_service.record(
        db,
        user,
        action="route.adjust",
        target_type="route",
        target_id=route_id,
        after={
            "start_date": result.start_date.isoformat(),
            "end_date": result.end_date.isoformat(),
            "daily_capacity_minutes": result.daily_capacity_minutes,
        },
        request=request,
    )
    return result


@router.get("/{route_id}/versions", response_model=list[RouteVersionSummary])
def list_versions(
    user: CurrentUser, db: DbSession, route_id: str
) -> list[RouteVersionSummary]:
    return [
        RouteVersionSummary.model_validate(version)
        for version in route_service.list_versions(db, user, route_id)
    ]


@router.get("/{route_id}/versions/{version_no}", response_model=RouteVersionDetail)
def get_version(
    user: CurrentUser, db: DbSession, route_id: str, version_no: int
) -> RouteVersionDetail:
    version = route_service.get_version(db, user, route_id, version_no)
    return RouteVersionDetail(
        version_no=version.version_no,
        change_type=version.change_type,
        change_summary=version.change_summary,
        created_at=version.created_at,
        snapshot=version.snapshot_json,
    )


@router.post("/{route_id}/stages", response_model=RouteDetail)
def create_stage(
    user: CurrentUser, db: DbSession, route_id: str, payload: StageCreate
) -> RouteDetail:
    return route_service.create_stage(db, user, route_id, payload)


@router.patch("/{route_id}/stages/{stage_id}", response_model=RouteDetail)
def update_stage(
    user: CurrentUser,
    db: DbSession,
    route_id: str,
    stage_id: str,
    payload: StageUpdate,
) -> RouteDetail:
    return route_service.update_stage(db, user, route_id, stage_id, payload)


@router.delete("/{route_id}/stages/{stage_id}", response_model=RouteDetail)
def delete_stage(
    user: CurrentUser, db: DbSession, route_id: str, stage_id: str
) -> RouteDetail:
    return route_service.delete_stage(db, user, route_id, stage_id)


@stage_router.post("/{stage_id}/weeks", response_model=RouteDetail)
def create_week(
    user: CurrentUser, db: DbSession, stage_id: str, payload: WeekCreate
) -> RouteDetail:
    return route_service.create_week(db, user, stage_id, payload)


@stage_router.patch("/{stage_id}/weeks/{week_id}", response_model=RouteDetail)
def update_week(
    user: CurrentUser,
    db: DbSession,
    stage_id: str,
    week_id: str,
    payload: WeekUpdate,
) -> RouteDetail:
    return route_service.update_week(db, user, stage_id, week_id, payload)


@stage_router.delete("/{stage_id}/weeks/{week_id}", response_model=RouteDetail)
def delete_week(
    user: CurrentUser, db: DbSession, stage_id: str, week_id: str
) -> RouteDetail:
    return route_service.delete_week(db, user, stage_id, week_id)
