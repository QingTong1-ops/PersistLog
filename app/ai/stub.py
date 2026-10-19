from __future__ import annotations

import copy
from typing import Any

from app.ai.base import PlanNormalizer


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
    return UnavailablePlanNormalizer()
