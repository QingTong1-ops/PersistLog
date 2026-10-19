from app.services.markdown_parser import parse_markdown

PLAN = """# 30 天后端冲刺

- 开始：2099-01-01
- 结束：2099-01-30
- 每日可用：120 分钟

## 阶段一：基础夯实（01/01 - 01/15）

### 第 1 周：网络基础

- [ ] TCP 三次握手（45 分钟）
  - 产出：口述录音/笔记
  - 验收：不看资料讲清状态机
- [ ] HTTP 缓存（30 分钟）
  - 产出：思维导图
  - 验收：能区分强缓存/协商缓存
"""


def test_parse_markdown_plan() -> None:
    draft = parse_markdown(PLAN)
    route = draft["route"]
    assert route["title"] == "30 天后端冲刺"
    assert route["start_date"] == "2099-01-01"
    assert route["end_date"] == "2099-01-30"
    assert route["daily_available_minutes"] == 120
    assert len(route["stages"]) == 1
    stage = route["stages"][0]
    assert "基础夯实" in stage["name"]
    assert len(stage["weeks"]) == 1
    week = stage["weeks"][0]
    assert week["week_no"] == 1
    assert week["focus"] == "网络基础"
    assert len(week["tasks"]) == 2
    first = week["tasks"][0]
    assert first["title"] == "TCP 三次握手"
    assert first["estimated_minutes"] == 45
    assert first["deliverable"] == "口述录音/笔记"
    assert first["acceptance_criteria"] == "不看资料讲清状态机"
    assert first["task_type"] == "fundamentals"
    assert first["source_locator"].startswith("line ")
