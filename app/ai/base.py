"""AI provider interfaces."""

from __future__ import annotations

from typing import Any, Protocol


class PlanNormalizer(Protocol):
    name: str

    def normalize_plan(self, text: str, rule_draft: dict[str, Any]) -> dict[str, Any]:
        """Return a normalized route draft for the given source text."""
        ...
