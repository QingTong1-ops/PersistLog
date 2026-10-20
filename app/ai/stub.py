from __future__ import annotations

import copy
from typing import Any

from app.ai.base import PlanNormalizer
from app.ai.openai_compatible import OpenAICompatiblePlanNormalizer
from app.core.config import get_settings


class StubPlanNormalizer:
    """Deterministic local normalizer used while no model API key is configured."""

    name = "stub"

    def normalize_plan(self, text: str, rule_draft: dict[str, Any]) -> dict[str, Any]:
        result = copy.deepcopy(rule_draft)
        assumptions = result.setdefault("assumptions", [])
        assumptions.append("当前使用本地 Stub 解析，未调用外部模型")
        return result


class UnavailablePlanNormalizer:
    """Fails clearly when a non-stub provider is configured without implementation."""

    name = "unavailable"

    def normalize_plan(self, text: str, rule_draft: dict[str, Any]) -> dict[str, Any]:
        from app.core.errors import AppError

        raise AppError(
            "AI_PROVIDER_NOT_CONFIGURED",
            "AI Provider 尚未配置",
            status_code=503,
            details={"provider": self.name},
        )


def get_plan_normalizer(provider: str) -> PlanNormalizer:
    if provider == "stub":
        return StubPlanNormalizer()
    if provider in {"deepseek", "openai_compatible"}:
        settings = get_settings()
        if settings.ai_api_key and settings.ai_model and settings.ai_base_url:
            return OpenAICompatiblePlanNormalizer(
                base_url=settings.ai_base_url,
                api_key=settings.ai_api_key,
                model=settings.ai_model,
                name=provider,
            )
    return UnavailablePlanNormalizer()
