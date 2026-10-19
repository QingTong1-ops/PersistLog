import app.worker.tasks.import_tasks  # noqa: F401
import app.worker.tasks.notification_tasks  # noqa: F401
from app.worker.celery_app import celery_app


def test_worker_tasks_registered() -> None:
    expected = {
        "app.worker.tasks.import_tasks.process_import",
        "app.worker.tasks.notification_tasks.send_morning_reports",
        "app.worker.tasks.notification_tasks.send_evening_reports",
        "app.worker.tasks.notification_tasks.send_overdue_reminders",
        "app.worker.tasks.notification_tasks.send_carry_over_reminders",
        "app.worker.tasks.notification_tasks.send_weekly_summaries",
    }
    assert expected <= set(celery_app.tasks)


def test_beat_schedule_matches_product_defaults() -> None:
    schedule = celery_app.conf.beat_schedule
    assert {
        "morning-report",
        "evening-report",
        "overdue-reminder",
        "carry-over-reminder",
        "weekly-summary",
    } <= set(schedule)
    assert schedule["morning-report"]["schedule"].hour == {7}
    assert schedule["morning-report"]["schedule"].minute == {30}
    assert schedule["evening-report"]["schedule"].hour == {20}
    assert schedule["overdue-reminder"]["schedule"].hour == {20}
    assert schedule["weekly-summary"]["schedule"].day_of_week == {0}
