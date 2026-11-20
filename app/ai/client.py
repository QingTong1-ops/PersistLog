from __future__ import annotations

from typing import Any, Protocol

import httpx

from app.ai.json_utils import parse_json_content
from app.core.config import get_settings
from app.core.errors import AppError


class JSONProvider(Protocol):
    name: str
    model: str

    def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        timeout_seconds: float,
    ) -> dict[str, Any]: ...


class OpenAICompatibleJSONClient:
    """Generic OpenAI-compatible JSON completion client for AI tasks."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        name: str = "openai_compatible",
        temperature: float = 0.1,
    ) -> None:
        self.name = name
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.temperature = temperature

    def _endpoint(self) -> str:
        if self.base_url.endswith("/chat/completions"):
            return self.base_url
        return f"{self.base_url}/chat/completions"

    def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
        }
        try:
            response = httpx.post(
                self._endpoint(),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=timeout_seconds,
                follow_redirects=False,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                "AI_PROVIDER_ERROR",
                "AI 服务请求失败",
                status_code=502,
                details={"provider": self.name, "reason": type(exc).__name__},
                retryable=True,
            ) from exc

        if response.status_code != 200:
            raise AppError(
                "AI_PROVIDER_ERROR",
                "AI 服务返回错误",
                status_code=502,
                details={
                    "provider": self.name,
                    "status": response.status_code,
                    "body": response.text[:300],
                },
                retryable=response.status_code >= 500 or response.status_code == 429,
            )

        try:
            body = response.json()
            content = body["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise AppError(
                "AI_PROVIDER_ERROR",
                "AI 响应结构不正确",
                status_code=502,
                details={"provider": self.name},
                retryable=True,
            ) from exc
        return parse_json_content(content, self.name)


class UnavailableJSONProvider:
    name = "unavailable"
    model = ""

    def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        raise AppError(
            "AI_PROVIDER_NOT_CONFIGURED",
            "AI Provider 尚未配置",
            status_code=503,
            details={"provider": self.name},
        )


def get_json_provider(provider: str | None = None) -> JSONProvider:
    settings = get_settings()
    selected = (provider or settings.ai_provider).lower()
    if selected in {"deepseek", "openai_compatible"}:
        if settings.ai_api_key and settings.ai_model and settings.ai_base_url:
            return OpenAICompatibleJSONClient(
                base_url=settings.ai_base_url,
                api_key=settings.ai_api_key,
                model=settings.ai_model,
                name=selected,
            )
    return UnavailableJSONProvider()
