"""Markdown plan parser used as the deterministic first pass of import."""

from __future__ import annotations

import re
from datetime import date
from typing import Any

META_RE = re.compile(r"^-\s*(开始|结束|每日可用)\s*[：:]\s*(.+)$")
STAGE_RE = re.compile(r"^##\s+(.+)$")
WEEK_RE = re.compile(r"^###\s+(?:第\s*(\d+)\s*周[：:]\s*)?(.+)$")
TASK_RE = re.compile(r"^-\s*(?:\[[ xX]\]\s*)?(.+)$")
SUB_RE = re.compile(
    r"^\s{2,}-\s*(产出|验收|学习目标|类型|优先级|资料|能力)\s*[：:]\s*(.+)$"
)
MINUTES_RE = re.compile(r"[（(](\d+)\s*分钟[)）]")
DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")
MMDD_RE = re.compile(r"(\d{1,2})/(\d{1,2})")


def _parse_date(value: str | None, fallback_year: int) -> date | None:
    if not value:
        return None
    match = DATE_RE.search(value)
    if match:
        return date.fromisoformat(match.group(1))
    match = MMDD_RE.search(value)
    if match:
        return date(fallback_year, int(match.group(1)), int(match.group(2)))
    return None


def _clean_stage_name(name: str) -> str:
    text = name.strip()
    text = re.sub(r"^阶段[一二三四五六七八九十百0-9]+[：:]\s*", "", text)
    return text.strip() or "导入阶段"


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


def _extract_minutes(title: str) -> tuple[str, int]:
    match = MINUTES_RE.search(title)
    if not match:
        return title.strip(), 45
    minutes = int(match.group(1))
    cleaned = MINUTES_RE.sub("", title).strip()
    return cleaned, minutes


def _split_list(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"[、,，]", value) if item.strip()]


def parse_markdown(text: str) -> dict[str, Any]:
    """Parse a Markdown plan into a route draft.

    The parser is intentionally tolerant: missing structure is filled with
    defaults and surfaced later by the validator.
    """
    lines = text.splitlines()
    title: str | None = None
    start_raw: str | None = None
    end_raw: str | None = None
    daily_minutes: int | None = None

    stages: list[dict[str, Any]] = []
    current_stage: dict[str, Any] | None = None
    current_week: dict[str, Any] | None = None
    current_task: dict[str, Any] | None = None
    week_counter = 0

    def ensure_stage() -> dict[str, Any]:
        nonlocal current_stage
        if current_stage is None:
            current_stage = {"name": "导入阶段", "objective": "", "weeks": []}
            stages.append(current_stage)
        return current_stage

    def ensure_week() -> dict[str, Any]:
        nonlocal current_week, week_counter
        stage = ensure_stage()
        if current_week is None:
            week_counter += 1
            current_week = {
                "week_no": week_counter,
                "focus": "第 1 周",
                "milestone": "",
                "tasks": [],
            }
            stage["weeks"].append(current_week)
        return current_week

    fallback_year = date.today().year

    for line_no, raw_line in enumerate(lines, start=1):
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("# ") and not stripped.startswith("## "):
            title = stripped[2:].strip()
            continue

        meta = META_RE.match(stripped)
        if meta:
            key, value = meta.group(1), meta.group(2).strip()
            if key == "开始":
                start_raw = value
            elif key == "结束":
                end_raw = value
            else:
                minutes = re.search(r"(\d+)", value)
                daily_minutes = int(minutes.group(1)) if minutes else None
            continue

        stage_match = STAGE_RE.match(stripped)
        if stage_match:
            current_stage = {
                "name": _clean_stage_name(stage_match.group(1)),
                "objective": "",
                "weeks": [],
            }
            stages.append(current_stage)
            current_week = None
            current_task = None
            week_counter = 0
            continue

        week_match = WEEK_RE.match(stripped)
        if week_match:
            stage = ensure_stage()
            if week_match.group(1):
                week_no = int(week_match.group(1))
                week_counter = max(week_counter, week_no)
            else:
                week_counter += 1
                week_no = week_counter
            current_week = {
                "week_no": week_no,
                "focus": week_match.group(2).strip() or f"第 {week_no} 周",
                "milestone": "",
                "tasks": [],
            }
            stage["weeks"].append(current_week)
            current_task = None
            continue

        sub = SUB_RE.match(line)
        if sub and current_task is not None:
            key, value = sub.group(1), sub.group(2).strip()
            if key == "产出":
                current_task["deliverable"] = value
            elif key == "验收":
                current_task["acceptance_criteria"] = value
            elif key == "学习目标":
                current_task["learning_objective"] = value
            elif key == "类型":
                current_task["task_type"] = value
            elif key == "优先级":
                current_task["priority"] = value
            elif key == "资料":
                current_task["resources"] = _split_list(value)
            elif key == "能力":
                current_task["capability_tags"] = _split_list(value)
            continue

        task_match = TASK_RE.match(stripped)
        if task_match:
            week = ensure_week()
            task_title, minutes = _extract_minutes(task_match.group(1))
            current_task = {
                "title": task_title,
                "task_type": _infer_task_type(task_title),
                "priority": "P1",
                "estimated_minutes": minutes,
                "planned_date": None,
                "deliverable": "",
                "acceptance_criteria": "",
                "learning_objective": "",
                "description": "",
                "resources": [],
                "capability_tags": [],
                "source_locator": f"line {line_no}",
            }
            week["tasks"].append(current_task)

    start_date = _parse_date(start_raw, fallback_year)
    end_date = _parse_date(end_raw, start_date.year if start_date else fallback_year)

    route = {
        "title": title or "导入计划",
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "daily_available_minutes": daily_minutes,
        "stages": stages,
    }
    return {"route": route, "assumptions": [], "warnings": []}
