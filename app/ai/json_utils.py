from __future__ import annotations

import json
from typing import Any

from app.core.errors import AppError


def parse_json_content(content: Any, provider: str) -> dict[str, Any]:
    """Parse an OpenAI-compatible message content into a JSON object."""
    if not isinstance(content, str):
        raise AppError(
            "AI_PROVIDER_ERROR",
            "AI 未返回文本内容",
            status_code=502,
            details={"provider": provider},
        )
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else ""
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AppError(
            "AI_PROVIDER_ERROR",
            "AI 返回的 JSON 无法解析",
            status_code=502,
            details={"provider": provider},
            retryable=True,
        ) from exc
    if not isinstance(parsed, dict):
        raise AppError(
            "AI_PROVIDER_ERROR",
            "AI 返回的 JSON 不是对象",
            status_code=502,
            details={"provider": provider},
            retryable=True,
        )
    return parsed
