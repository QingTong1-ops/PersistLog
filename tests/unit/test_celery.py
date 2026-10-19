import app.worker.tasks.notification_tasks  # noqa: F401
from app.worker.celery_app import celery_app


def test_notification_tasks_registered() -> None:
    expected = {
        "app.worker.tasks.notification_tasks.send_morning_reports",
        "app.worker.tasks.notification_tasks.send_evening_reports",
        "app.worker.tasks.notification_tasks.send_overdue_reminders",
        "app.worker.tasks.notification_tasks.send_carry_over_reminders",
        "app.worker.tasks.notification_tasks.send_weekly_summaries",
    }
    assert expected <= set(celery_app.tasks)
