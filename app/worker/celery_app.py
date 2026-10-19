from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "persistlog",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone=settings.timezone,
    enable_utc=True,
    task_always_eager=settings.app_env == "test",
    broker_connection_retry_on_startup=True,
    # Fail fast when publishing so the API can fall back to inline processing
    # instead of hanging on an unavailable broker.
    broker_connection_timeout=2,
    task_publish_retry=False,
)
celery_app.conf.beat_schedule = {
    "morning-report": {
        "task": "app.worker.tasks.notification_tasks.send_morning_reports",
        "schedule": crontab(hour=7, minute=30),
    },
    "evening-report": {
        "task": "app.worker.tasks.notification_tasks.send_evening_reports",
        "schedule": crontab(hour=20, minute=30),
    },
    "overdue-reminder": {
        "task": "app.worker.tasks.notification_tasks.send_overdue_reminders",
        "schedule": crontab(hour=20, minute=0),
    },
    "carry-over-reminder": {
        "task": "app.worker.tasks.notification_tasks.send_carry_over_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    "weekly-summary": {
        "task": "app.worker.tasks.notification_tasks.send_weekly_summaries",
        "schedule": crontab(day_of_week=0, hour=20, minute=0),
    },
}
celery_app.conf.imports = (
    "app.worker.tasks.import_tasks",
    "app.worker.tasks.notification_tasks",
)
celery_app.autodiscover_tasks(["app.worker.tasks"])
