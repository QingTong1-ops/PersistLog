"""Validation and normalization for imported route drafts."""

from __future__ import annotations

import copy
from datetime import date, timedelta
from typing import Any

ALLOWED_TASK_TYPES = {
    "algorithm",
    "fundamentals",
    "engineering",
    "project",
    "resume",
    "apply",
    "review",
    "interview",
    "reflection",
}


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.replace("，", ",").split(",") if item.strip()]
    return []


def _issue(
    issues: list[dict[str, Any]],
    severity: str,
    code: str,
    message: str,
    *,
    suggestion: str | None = None,
    source_locator: str | None = None,
) -> None:
    issues.append(
        {
            "severity": severity,
            "code": code,
            "message": message,
            "suggestion": suggestion,
            "source_locator": source_locator,
        }
    )


def _infer_task_type(title: str) -> str:
    lower = title.lower()
    if any(key in lower for key in ("算法", "leetcode", "复杂度", "动态规划", "二叉树")):
        return "algorithm"
    if any(key in lower for key in ("项目", "系统设计", "架构", "接口设计")):
        return "project"
    if any(key in lower for key in ("工程", "缓存", "消息队列", "部署", "监控")):
        return "engineering"
    if any(key in lower for key in ("简历", "投递")):
        return "resume"
    if any(key in lower for key in ("面试", "复盘")):
        return "interview"
    return "fundamentals"


def validate_route_draft(
    draft: dict[str, Any],
    *,
    daily_capacity_minutes: int,
    today: date | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, int]]:
    """Normalize a route draft, assign missing dates and return issues/stats."""
    result = copy.deepcopy(draft)
    route = result.setdefault("route", {})
    issues: list[dict[str, Any]] = []
    capacity = max(int(daily_capacity_minutes), 30)
    today = today or date.today()

    route["title"] = str(route.get("title") or "导入计划").strip() or "导入计划"
    start = _parse_date(route.get("start_date")) or today
    end = _parse_date(route.get("end_date")) or (start + timedelta(days=30))
    if end < start:
        end = start + timedelta(days=30)
        _issue(
            issues,
            "warning",
            "END_BEFORE_START",
            "结束日期早于开始日期，已自动延长为 30 天",
        )

    if start < today:
        delta = (today - start).days
        start = today
        end = end + timedelta(days=delta)
        _issue(
            issues,
            "warning",
            "START_DATE_SHIFTED",
            f"开始日期早于今天，已整体平移 {delta} 天",
        )

    route["start_date"] = start.isoformat()
    route["end_date"] = end.isoformat()

    stages = route.get("stages")
    if not isinstance(stages, list) or not stages:
        stages = [{"name": "导入阶段", "objective": "", "weeks": []}]
        route["stages"] = stages
        _issue(issues, "error", "NO_STAGES", "计划中没有识别到阶段")

    tasks_with_dates: list[dict[str, Any]] = []
    day_used: dict[date, int] = {}
    total_tasks = 0

    for stage in stages:
        if not isinstance(stage, dict):
            continue
        stage["name"] = str(stage.get("name") or "导入阶段").strip() or "导入阶段"
        stage["objective"] = str(stage.get("objective") or "")
        weeks = stage.get("weeks")
        if not isinstance(weeks, list):
            weeks = []
            stage["weeks"] = weeks
        for week in weeks:
            if not isinstance(week, dict):
                continue
            week["week_no"] = int(week.get("week_no") or 1)
            week["focus"] = str(week.get("focus") or f"第 {week['week_no']} 周")
            week["milestone"] = str(week.get("milestone") or "")
            tasks = week.get("tasks")
            if not isinstance(tasks, list):
                tasks = []
                week["tasks"] = tasks

            for task in tasks:
                if not isinstance(task, dict):
                    continue
                total_tasks += 1
                locator = task.get("source_locator")

                title = str(task.get("title") or "").strip()
                if not title:
                    title = "未命名任务"
                    _issue(
                        issues,
                        "warning",
                        "MISSING_TITLE",
                        "任务缺少标题，已使用默认标题",
                        source_locator=locator,
                    )
                task["title"] = title

                task_type = str(task.get("task_type") or "").strip()
                if task_type not in ALLOWED_TASK_TYPES:
                    task_type = _infer_task_type(title)
                    _issue(
                        issues,
                        "warning",
                        "INVALID_TASK_TYPE",
                        f"任务类型无效，已推断为 {task_type}",
                        source_locator=locator,
                    )
                task["task_type"] = task_type

                try:
                    raw_minutes = int(task.get("estimated_minutes") or 45)
                except (TypeError, ValueError):
                    raw_minutes = 45
                if raw_minutes < 15 or raw_minutes > 120:
                    _issue(
                        issues,
                        "warning",
                        "TASK_DURATION_OUT_OF_RANGE",
                        "任务时长建议在 15–120 分钟之间",
                        suggestion="考虑拆分或合并该任务",
                        source_locator=locator,
                    )
                task["estimated_minutes"] = min(max(raw_minutes, 15), 120)

                priority = str(task.get("priority") or "P1").upper()
                if priority not in {"P0", "P1", "P2"}:
                    priority = "P1"
                    _issue(
                        issues,
                        "warning",
                        "INVALID_PRIORITY",
                        "任务优先级无效，已使用 P1",
                        source_locator=locator,
                    )
                task["priority"] = priority

                for field, label in (
                    ("deliverable", "产出"),
                    ("acceptance_criteria", "验收标准"),
                ):
                    value = str(task.get(field) or "").strip()
                    if not value:
                        value = "待补充"
                        _issue(
                            issues,
                            "warning",
                            f"MISSING_{field.upper()}",
                            f"任务缺少{label}，已填入“待补充”",
                            source_locator=locator,
                        )
                    task[field] = value

                task["learning_objective"] = str(task.get("learning_objective") or "")
                task["description"] = str(task.get("description") or "")
                task["resources"] = _as_list(task.get("resources"))
                task["capability_tags"] = _as_list(task.get("capability_tags"))
                task["source_locator"] = locator

                planned = _parse_date(task.get("planned_date"))
                if planned is not None and (planned < start or planned > end):
                    _issue(
                        issues,
                        "warning",
                        "TASK_DATE_OUT_OF_RANGE",
                        "任务日期超出路线范围，稍后将重新分配",
                        source_locator=locator,
                    )
                    planned = None
                task["planned_date"] = planned.isoformat() if planned else None
                if planned is not None:
                    tasks_with_dates.append(task)
                    day_used[planned] = day_used.get(planned, 0) + task["estimated_minutes"]

    if total_tasks == 0:
        _issue(issues, "error", "NO_TASKS", "计划中没有识别到任何任务")

    # Assign dates for tasks without an explicit date by daily capacity.
    cursor = start
    for stage in stages:
        for week in stage.get("weeks", []):
            for task in week.get("tasks", []):
                if task["planned_date"] is not None:
                    continue
                while day_used.get(cursor, 0) + task["estimated_minutes"] > capacity:
                    if task["estimated_minutes"] > capacity:
                        break
                    cursor += timedelta(days=1)
                if cursor > end:
                    end = cursor
                task["planned_date"] = cursor.isoformat()
                day_used[cursor] = day_used.get(cursor, 0) + task["estimated_minutes"]
                tasks_with_dates.append(task)

    route["end_date"] = end.isoformat()

    # Duplicate and capacity checks.
    seen: set[tuple[str, str]] = set()
    for task in tasks_with_dates:
        key = (task["title"], task.get("planned_date") or "")
        if key in seen:
            _issue(
                issues,
                "warning",
                "DUPLICATE_TASK",
                "同一天存在同名任务",
                suggestion="确认是否需要合并或改名",
                source_locator=task.get("source_locator"),
            )
        seen.add(key)

    for planned, used in sorted(day_used.items()):
        if planned < start or planned > end:
            _issue(
                issues,
                "error",
                "TASK_DATE_OUT_OF_RANGE",
                f"{planned.isoformat()} 的任务超出路线范围",
            )
        elif used > capacity:
            _issue(
                issues,
                "warning",
                "DAY_OVER_CAPACITY",
                f"{planned.isoformat()} 计划 {used} 分钟，超过每日容量 {capacity} 分钟",
                suggestion="减少任务或延长路线",
            )

    total_minutes = sum(task["estimated_minutes"] for task in tasks_with_dates)
    total_capacity = max((end - start).days + 1, 1) * capacity
    if total_minutes > total_capacity * 0.8:
        _issue(
            issues,
            "warning",
            "TOTAL_OVER_CAPACITY",
            f"总计划 {total_minutes} 分钟，超过可用容量 {int(total_capacity * 0.8)} 分钟",
            suggestion="降低任务量或延长路线",
        )

    # Derive stage/week dates from task dates.
    for stage_item in stages:
        if not isinstance(stage_item, dict):
            continue
        stage_tasks = [
            task
            for week in stage_item.get("weeks", [])
            for task in week.get("tasks", [])
            if task.get("planned_date")
        ]
        if stage_tasks:
            dates = sorted(_parse_date(task["planned_date"]) for task in stage_tasks)
            stage_item["start_date"] = dates[0].isoformat()
            stage_item["end_date"] = dates[-1].isoformat()
        else:
            stage_item["start_date"] = start.isoformat()
            stage_item["end_date"] = end.isoformat()
        for week in stage_item.get("weeks", []):
            week_tasks = [task for task in week.get("tasks", []) if task.get("planned_date")]
            if week_tasks:
                dates = sorted(_parse_date(task["planned_date"]) for task in week_tasks)
                week["start_date"] = dates[0].isoformat()
                week["end_date"] = dates[-1].isoformat()
            else:
                week["start_date"] = stage_item["start_date"]
                week["end_date"] = stage_item["end_date"]

    stats = {
        "stages": len(stages),
        "weeks": sum(len(stage.get("weeks", [])) for stage in stages),
        "tasks": total_tasks,
        "total_minutes": total_minutes,
    }
    result["route"] = route
    result["issues"] = issues
    result["stats"] = stats
    return result, issues, stats
