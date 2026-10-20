from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from app.ai import openai_compatible
from app.ai.openai_compatible import OpenAICompatiblePlanNormalizer
from app.ai.stub import (
    StubPlanNormalizer,
    UnavailablePlanNormalizer,
    get_plan_normalizer,
)
from app.core.errors import AppError


class FakeResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = json.dumps(self._payload)

    def json(self) -> dict:
        return self._payload


def _normalizer() -> OpenAICompatiblePlanNormalizer:
    return OpenAICompatiblePlanNormalizer(
        base_url="https://api.example.com/v1",
        api_key="test-key",
        model="test-model",
        name="deepseek",
    )


def _chat_response(content: str) -> FakeResponse:
    return FakeResponse(
        payload={
            "choices": [
                {"message": {"role": "assistant", "content": content}},
            ]
        }
    )


def test_normalizes_json_content(monkeypatch) -> None:
    content = json.dumps(
        {
            "route": {
                "title": "测试路线",
                "start_date": "2026-10-20",
                "end_date": "2026-11-20",
                "stages": [],
            },
            "assumptions": ["a"],
        }
    )
    monkeypatch.setattr(
        openai_compatible.httpx, "post", lambda *args, **kwargs: _chat_response(content)
    )
    result = _normalizer().normalize_plan("plan", {"route": {"stages": []}})
    assert result["route"]["title"] == "测试路线"
    assert result["warnings"] == []


def test_strips_markdown_code_fence(monkeypatch) -> None:
    content = '```json\n{"route": {"title": "x", "stages": []}}\n```'
    monkeypatch.setattr(
        openai_compatible.httpx, "post", lambda *args, **kwargs: _chat_response(content)
    )
    result = _normalizer().normalize_plan("plan", {"route": {"stages": []}})
    assert result["route"]["title"] == "x"


def test_invalid_json_raises_provider_error(monkeypatch) -> None:
    monkeypatch.setattr(
        openai_compatible.httpx,
        "post",
        lambda *args, **kwargs: _chat_response("not json"),
    )
    with pytest.raises(AppError) as exc_info:
        _normalizer().normalize_plan("plan", {"route": {"stages": []}})
    assert exc_info.value.code == "AI_PROVIDER_ERROR"


def test_non_200_raises_provider_error(monkeypatch) -> None:
    monkeypatch.setattr(
        openai_compatible.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(status_code=500, payload={"error": "boom"}),
    )
    with pytest.raises(AppError) as exc_info:
        _normalizer().normalize_plan("plan", {"route": {"stages": []}})
    assert exc_info.value.code == "AI_PROVIDER_ERROR"


def test_factory_selects_configured_provider(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.ai.stub.get_settings",
        lambda: SimpleNamespace(
            ai_api_key="key",
            ai_model="model",
            ai_base_url="https://api.example.com",
        ),
    )
    normalizer = get_plan_normalizer("deepseek")
    assert isinstance(normalizer, OpenAICompatiblePlanNormalizer)
    assert normalizer.name == "deepseek"


def test_factory_falls_back_to_unavailable_without_config(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.ai.stub.get_settings",
        lambda: SimpleNamespace(ai_api_key="", ai_model="", ai_base_url=""),
    )
    assert isinstance(get_plan_normalizer("deepseek"), UnavailablePlanNormalizer)
    assert isinstance(get_plan_normalizer("stub"), StubPlanNormalizer)
