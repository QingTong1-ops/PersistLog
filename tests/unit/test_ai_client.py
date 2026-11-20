from __future__ import annotations

import json

import pytest
from app.ai import client as ai_client
from app.ai.client import OpenAICompatibleJSONClient
from app.core.errors import AppError


class FakeResponse:
    def __init__(self, status_code: int, payload: dict) -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self) -> dict:
        return self._payload


def _client() -> OpenAICompatibleJSONClient:
    return OpenAICompatibleJSONClient(
        base_url="https://api.example.com/v1",
        api_key="test-key",
        model="test-model",
        name="deepseek",
    )


def test_complete_json_parses_content(monkeypatch) -> None:
    monkeypatch.setattr(
        ai_client.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            200,
            {"choices": [{"message": {"content": '{"answer": "ok"}'}}]},
        ),
    )
    result = _client().complete_json(
        system_prompt="system",
        user_prompt="user",
        timeout_seconds=10,
    )
    assert result == {"answer": "ok"}


def test_provider_5xx_is_retryable(monkeypatch) -> None:
    monkeypatch.setattr(
        ai_client.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(500, {"error": "boom"}),
    )
    with pytest.raises(AppError) as exc:
        _client().complete_json(
            system_prompt="system",
            user_prompt="user",
            timeout_seconds=10,
        )
    assert exc.value.code == "AI_PROVIDER_ERROR"
    assert exc.value.retryable is True


def test_provider_4xx_is_not_retryable(monkeypatch) -> None:
    monkeypatch.setattr(
        ai_client.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(400, {"error": "bad"}),
    )
    with pytest.raises(AppError) as exc:
        _client().complete_json(
            system_prompt="system",
            user_prompt="user",
            timeout_seconds=10,
        )
    assert exc.value.code == "AI_PROVIDER_ERROR"
    assert exc.value.retryable is False
