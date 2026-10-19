from datetime import date, timedelta

from app.services.import_validation import validate_route_draft


def _draft(*, start: date, tasks: list[dict]) -> dict:
    return {
        "route": {
            "title": "测试计划",
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=7)).isoformat(),
            "stages": [
                {
                    "name": "阶段一",
                    "objective": "",
                    "weeks": [
                        {
                            "week_no": 1,
                            "focus": "第一周",
                            "milestone": "",
                            "tasks": tasks,
                        }
                    ],
                }
            ],
        }
    }


def test_validation_fills_missing_fields_and_assigns_date() -> None:
    today = date(2099, 1, 1)
    draft = _draft(
        start=today,
        tasks=[
            {
                "title": "任务 A",
                "estimated_minutes": 300,
                "task_type": "fundamentals",
                "priority": "P1",
                "planned_date": None,
            }
        ],
    )
    result, issues, stats = validate_route_draft(
        draft, daily_capacity_minutes=120, today=today
    )
    task = result["route"]["stages"][0]["weeks"][0]["tasks"][0]
    assert task["deliverable"] == "待补充"
    assert task["acceptance_criteria"] == "待补充"
    assert task["planned_date"] == today.isoformat()
    assert stats["tasks"] == 1
    assert any(issue["code"] == "TASK_DURATION_OUT_OF_RANGE" for issue in issues)


def test_validation_empty_plan_is_error() -> None:
    today = date(2099, 1, 1)
    draft = _draft(start=today, tasks=[])
    _, issues, stats = validate_route_draft(draft, daily_capacity_minutes=120, today=today)
    assert stats["tasks"] == 0
    assert any(issue["code"] == "NO_TASKS" for issue in issues)


def test_validation_shifts_past_start_date() -> None:
    today = date(2099, 1, 10)
    draft = _draft(
        start=date(2099, 1, 1),
        tasks=[
            {
                "title": "任务 A",
                "estimated_minutes": 45,
                "task_type": "fundamentals",
                "priority": "P1",
                "planned_date": "2099-01-01",
            }
        ],
    )
    result, issues, _ = validate_route_draft(draft, daily_capacity_minutes=120, today=today)
    assert result["route"]["start_date"] == today.isoformat()
    assert any(issue["code"] == "START_DATE_SHIFTED" for issue in issues)
