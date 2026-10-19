from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models.notification import NotificationChannel, NotificationOutbox
from app.models.planning import TaskOccurrence
from app.models.route import Task
from app.models.user import User
from app.services import dashboard_service, notification_service, planning_service
from app.worker.celery_app import celery_app

settings = get_settings()


def _channels(db: Session) -> list[NotificationChannel]:
    return list(
        db.scalars(
            select(NotificationChannel).where(NotificationChannel.status == "active")
        )
    )


def _link(path: str) -> str:
    return f"{settings.web_base_url.rstrip('/')}/{path.lstrip('/')}"


def _enqueue(
    db: Session,
    user: User,
    channel: NotificationChannel,
    *,
    template_code: str,
    event_type: str,
    payload: dict,
    dedup_key: str,
) -> NotificationOutbox | None:
    return notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code=template_code,
        payload=payload,
        dedup_key=dedup_key,
        event_type=event_type,
    )


@celery_app.task(name="app.worker.tasks.notification_tasks.send_morning_reports")
def send_morning_reports() -> int:
    db = SessionLocal()
    try:
        queued = 0
        for channel in _channels(db):
            user = db.get(User, channel.user_id)
            if user is None:
                continue
            plan = planning_service.ensure_today(db, user)
            summary = plan.summary_json or {}
            payload = {
                "date": plan.plan_date.isoformat(),
                "planned_tasks": len(summary.get("selected", [])),
                "planned_minutes": summary.get("planned_minutes", 0),
                "focus": summary.get("focus", "按计划推进"),
                "today_link": _link("/today"),
            }
            if _enqueue(
                db,
                user,
                channel,
                template_code="morning",
                event_type="morning",
                payload=payload,
                dedup_key=f"morning:{user.id}:{plan.plan_date.isoformat()}",
            ):
                queued += 1
        notification_service.send_pending(db)
        return queued
    finally:
        db.close()


@celery_app.task(name="app.worker.tasks.notification_tasks.send_evening_reports")
def send_evening_reports() -> int:
    db = SessionLocal()
    try:
        queued = 0
        for channel in _channels(db):
            user = db.get(User, channel.user_id)
            if user is None:
                continue
            today = planning_service.get_today(db, user)
            payload = {
                "completed_tasks": today.summary.completed_tasks,
                "planned_tasks": today.summary.planned_tasks,
                "completion_rate": f"{today.summary.completion_rate:.0%}",
                "actual_minutes": today.summary.actual_minutes,
                "carry_count": len(today.carry_over),
                "today_link": _link("/today"),
            }
            if _enqueue(
                db,
                user,
                channel,
                template_code="evening",
                event_type="evening",
                payload=payload,
                dedup_key=f"evening:{user.id}:{today.date.isoformat()}",
            ):
                queued += 1
        notification_service.send_pending(db)
        return queued
    finally:
        db.close()


@celery_app.task(name="app.worker.tasks.notification_tasks.send_overdue_reminders")
def send_overdue_reminders() -> int:
    db = SessionLocal()
    try:
        queued = 0
        for channel in _channels(db):
            user = db.get(User, channel.user_id)
            if user is None:
                continue
            day = planning_service.logical_today(db, user)
            completed_task_ids = select(TaskOccurrence.task_id).where(
                TaskOccurrence.user_id == user.id,
                TaskOccurrence.status == "completed",
            )
            overdue_count = int(
                db.scalar(
                    select(func.count(Task.id)).where(
                        Task.user_id == user.id,
                        Task.status == "active",
                        Task.deleted_at.is_(None),
                        Task.planned_date.is_not(None),
                        Task.planned_date < day,
                        Task.id.not_in(completed_task_ids),
                    )
                )
                or 0
            )
            if overdue_count == 0:
                continue
            if _enqueue(
                db,
                user,
                channel,
                template_code="overdue",
                event_type="overdue",
                payload={"overdue_count": overdue_count, "today_link": _link("/today")},
                dedup_key=f"overdue:{user.id}:{day.isoformat()}",
            ):
                queued += 1
        notification_service.send_pending(db)
        return queued
    finally:
        db.close()


@celery_app.task(name="app.worker.tasks.notification_tasks.send_carry_over_reminders")
def send_carry_over_reminders() -> int:
    db = SessionLocal()
    try:
        queued = 0
        for channel in _channels(db):
            user = db.get(User, channel.user_id)
            if user is None:
                continue
            day = planning_service.logical_today(db, user)
            carry_count = int(
                db.scalar(
                    select(func.count(TaskOccurrence.id)).where(
                        TaskOccurrence.user_id == user.id,
                        TaskOccurrence.occurrence_date == day,
                        TaskOccurrence.carry_over_from_id.is_not(None),
                    )
                )
                or 0
            )
            if carry_count == 0:
                continue
            forecast = dashboard_service.forecast(db, user)
            if _enqueue(
                db,
                user,
                channel,
                template_code="carry_over",
                event_type="carry_over",
                payload={
                    "carry_count": carry_count,
                    "forecast_date": forecast.forecast_end_date.isoformat(),
                    "today_link": _link("/today"),
                },
                dedup_key=f"carry_over:{user.id}:{day.isoformat()}",
            ):
                queued += 1
        notification_service.send_pending(db)
        return queued
    finally:
        db.close()


@celery_app.task(name="app.worker.tasks.notification_tasks.send_weekly_summaries")
def send_weekly_summaries() -> int:
    db = SessionLocal()
    try:
        queued = 0
        for channel in _channels(db):
            user = db.get(User, channel.user_id)
            if user is None:
                continue
            day = planning_service.logical_today(db, user)
            overview = dashboard_service.overview(db, user, day, 7)
            start = day - timedelta(days=6)
            active_days = int(
                db.scalar(
                    select(func.count(func.distinct(TaskOccurrence.occurrence_date))).where(
                        TaskOccurrence.user_id == user.id,
                        TaskOccurrence.occurrence_date >= start,
                        TaskOccurrence.occurrence_date <= day,
                        TaskOccurrence.daily_plan_id.is_not(None),
                    )
                )
                or 0
            )
            next_focus = db.scalar(
                select(Task.title)
                .where(
                    Task.user_id == user.id,
                    Task.status == "active",
                    Task.deleted_at.is_(None),
                )
                .order_by(Task.priority, Task.planned_date)
                .limit(1)
            )
            payload = {
                "completion_rate": f"{overview.completion_rate:.0%}",
                "active_days": active_days,
                "actual_minutes": overview.actual_minutes,
                "carry_count": overview.carry_over_count,
                "next_focus": next_focus or "保持节奏",
                "dashboard_link": _link("/dashboard"),
            }
            if _enqueue(
                db,
                user,
                channel,
                template_code="weekly",
                event_type="weekly",
                payload=payload,
                dedup_key=f"weekly:{user.id}:{day.isoformat()}",
            ):
                queued += 1
        notification_service.send_pending(db)
        return queued
    finally:
        db.close()
