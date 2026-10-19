from __future__ import annotations

import math
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.planning import TaskOccurrence
from app.models.profile import UserProfile
from app.models.route import Route, Task
from app.models.user import User
from app.schemas.dashboard import (
    DashboardForecast,
    DashboardOverview,
    DistributionBucket,
    DistributionResponse,
    ForecastRoute,
    RouteProgressOut,
    TrendPoint,
    TrendResponse,
)
from app.services import planning_service

TASK_TYPE_LABELS = {
    "algorithm": "算法",
    "fundamentals": "基础原理",
    "engineering": "工程能力",
    "project": "项目",
    "resume": "简历",
    "apply": "投递",
    "review": "复盘",
    "interview": "面试",
    "reflection": "反思",
}
STATUS_LABELS = {
    "pending": "待开始",
    "in_progress": "进行中",
    "completed": "已完成",
    "postponed": "已延期",
    "skipped": "已跳过",
    "blocked": "已阻塞",
    "abandoned": "已放弃",
}
PRIORITY_LABELS = {"P0": "P0 必须", "P1": "P1 重要", "P2": "P2 可选"}


def _capacity(db: Session, user: User) -> int:
    profile = db.get(UserProfile, user.id)
    if profile is None:
        return 96
    return max(int(profile.daily_available_minutes * float(profile.planning_capacity_factor)), 30)


def _range(end: date, days: int) -> tuple[date, date]:
    days = max(1, min(days, 90))
    return end - timedelta(days=days - 1), end


def _occurrences(db: Session, user: User, start: date, end: date) -> list[TaskOccurrence]:
    return list(
        db.scalars(
            select(TaskOccurrence)
            .where(
                TaskOccurrence.user_id == user.id,
                TaskOccurrence.occurrence_date >= start,
                TaskOccurrence.occurrence_date <= end,
                TaskOccurrence.daily_plan_id.is_not(None),
                TaskOccurrence.status != "abandoned",
            )
            .order_by(TaskOccurrence.occurrence_date, TaskOccurrence.created_at)
        )
    )


def _task_map(db: Session, occurrences: list[TaskOccurrence]) -> dict[str, Task]:
    task_ids = {occurrence.task_id for occurrence in occurrences}
    if not task_ids:
        return {}
    return {
        task.id: task
        for task in db.scalars(select(Task).where(Task.id.in_(task_ids)))
    }


def _counts(occurrences: list[TaskOccurrence]) -> tuple[int, int, int, int, int]:
    planned = len(occurrences)
    completed = sum(1 for item in occurrences if item.status == "completed")
    planned_minutes = sum(item.planned_minutes for item in occurrences)
    actual_minutes = sum(item.actual_minutes or 0 for item in occurrences)
    carry_over = sum(1 for item in occurrences if item.carry_over_from_id is not None)
    return planned, completed, planned_minutes, actual_minutes, carry_over


def _route_progress(db: Session, user: User) -> RouteProgressOut:
    tasks = list(
        db.scalars(
            select(Task).where(
                Task.user_id == user.id,
                Task.status == "active",
                Task.deleted_at.is_(None),
            )
        )
    )
    task_ids = {task.id for task in tasks}
    completed_ids: set[str] = set()
    if task_ids:
        completed_ids = {
            task_id
            for task_id in db.scalars(
                select(TaskOccurrence.task_id)
                .where(
                    TaskOccurrence.user_id == user.id,
                    TaskOccurrence.status == "completed",
                    TaskOccurrence.task_id.in_(task_ids),
                )
                .distinct()
            )
        }
    total = len(task_ids)
    completed = len(completed_ids & task_ids)
    return RouteProgressOut(
        total_tasks=total,
        completed_tasks=completed,
        percent=(completed / total * 100.0) if total else 0.0,
    )


def overview(db: Session, user: User, end: date, days: int = 7) -> DashboardOverview:
    start, end = _range(end, days)
    occurrences = _occurrences(db, user, start, end)
    planned, completed, planned_minutes, actual_minutes, carry_over = _counts(occurrences)
    active_routes = int(
        db.scalar(
            select(func.count(Route.id)).where(
                Route.user_id == user.id,
                Route.status == "active",
                Route.deleted_at.is_(None),
            )
        )
        or 0
    )
    return DashboardOverview(
        start_date=start,
        end_date=end,
        timezone=user.timezone,
        planned_tasks=planned,
        completed_tasks=completed,
        completion_rate=(completed / planned) if planned else 0.0,
        planned_minutes=planned_minutes,
        actual_minutes=actual_minutes,
        carry_over_count=carry_over,
        carry_over_rate=(carry_over / planned) if planned else 0.0,
        active_routes=active_routes,
        route_progress=_route_progress(db, user),
    )


def trends(db: Session, user: User, end: date, days: int = 14) -> TrendResponse:
    start, end = _range(end, days)
    occurrences = _occurrences(db, user, start, end)
    by_date: dict[date, list[TaskOccurrence]] = {}
    for occurrence in occurrences:
        by_date.setdefault(occurrence.occurrence_date, []).append(occurrence)

    points: list[TrendPoint] = []
    cursor = start
    while cursor <= end:
        entries = by_date.get(cursor, [])
        planned, completed, planned_minutes, actual_minutes, carry_over = _counts(entries)
        points.append(
            TrendPoint(
                date=cursor,
                planned_tasks=planned,
                completed_tasks=completed,
                completion_rate=(completed / planned) if planned else 0.0,
                planned_minutes=planned_minutes,
                actual_minutes=actual_minutes,
                carry_over_count=carry_over,
            )
        )
        cursor += timedelta(days=1)
    return TrendResponse(
        start_date=start,
        end_date=end,
        timezone=user.timezone,
        points=points,
    )


def _bucket(
    key: str,
    label: str,
    occurrences: list[TaskOccurrence],
) -> DistributionBucket:
    planned, completed, planned_minutes, actual_minutes, _ = _counts(occurrences)
    return DistributionBucket(
        key=key,
        label=label,
        planned_tasks=planned,
        completed_tasks=completed,
        planned_minutes=planned_minutes,
        actual_minutes=actual_minutes,
    )


def distribution(db: Session, user: User, end: date, days: int = 7) -> DistributionResponse:
    start, end = _range(end, days)
    occurrences = _occurrences(db, user, start, end)
    tasks = _task_map(db, occurrences)
    route_ids = {task.route_id for task in tasks.values() if task.route_id}
    routes = {
        route.id: route
        for route in db.scalars(select(Route).where(Route.id.in_(route_ids)))
    } if route_ids else {}

    def grouped(key_fn) -> dict[str, list[TaskOccurrence]]:
        result: dict[str, list[TaskOccurrence]] = {}
        for occurrence in occurrences:
            task = tasks.get(occurrence.task_id)
            result.setdefault(key_fn(occurrence, task), []).append(occurrence)
        return result

    by_task_type = [
        _bucket(
            key,
            TASK_TYPE_LABELS.get(key, key),
            entries,
        )
        for key, entries in grouped(
            lambda occurrence, task: task.task_type if task else "unknown"
        ).items()
    ]
    by_route = [
        _bucket(
            key,
            routes[key].title if key in routes else "未归属路线",
            entries,
        )
        for key, entries in grouped(
            lambda occurrence, task: task.route_id if task and task.route_id else "unassigned"
        ).items()
    ]
    by_status = [
        _bucket(key, STATUS_LABELS.get(key, key), entries)
        for key, entries in grouped(lambda occurrence, task: occurrence.status).items()
    ]
    by_priority = [
        _bucket(key, PRIORITY_LABELS.get(key, key), entries)
        for key, entries in grouped(
            lambda occurrence, task: task.priority if task else "P1"
        ).items()
    ]

    for buckets in (by_task_type, by_route, by_status, by_priority):
        buckets.sort(key=lambda item: (-item.planned_tasks, item.key))

    return DistributionResponse(
        start_date=start,
        end_date=end,
        timezone=user.timezone,
        by_task_type=by_task_type,
        by_route=by_route,
        by_status=by_status,
        by_priority=by_priority,
    )


def forecast(db: Session, user: User) -> DashboardForecast:
    today = planning_service.logical_today(db, user)
    active_routes = list(
        db.scalars(
            select(Route)
            .where(
                Route.user_id == user.id,
                Route.status == "active",
                Route.deleted_at.is_(None),
            )
            .order_by(Route.created_at)
        )
    )
    route_forecasts: list[ForecastRoute] = []
    remaining = 0
    for route in active_routes:
        result = planning_service.forecast_route(db, user, route.id)
        remaining += result.remaining_minutes
        route_forecasts.append(
            ForecastRoute(
                route_id=route.id,
                title=route.title,
                remaining_minutes=result.remaining_minutes,
                forecast_end_date=result.forecast_end_date,
            )
        )
    throughput = _capacity(db, user)
    forecast_days = math.ceil(remaining / throughput * 1.1) if remaining else 0
    forecast_end = today + timedelta(days=forecast_days)
    return DashboardForecast(
        generated_at=datetime.now(UTC).replace(tzinfo=None),
        timezone=user.timezone,
        throughput_minutes=throughput,
        remaining_minutes=remaining,
        forecast_days=forecast_days,
        forecast_end_date=forecast_end,
        routes=route_forecasts,
    )
