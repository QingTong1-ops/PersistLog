from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from app.ai.harness import AIGateway, AITaskSpec
from app.core.errors import AppError
from app.models.user import User

ExpectedDecision = Literal["accepted", "needs_review", "rejected", "error"]


@dataclass(frozen=True)
class EvalCase:
    name: str
    payload: Any
    expected: ExpectedDecision


@dataclass(frozen=True)
class EvalCaseResult:
    name: str
    expected: ExpectedDecision
    actual: ExpectedDecision
    passed: bool
    quality: float | None = None
    error: str | None = None


@dataclass
class EvalReport:
    results: list[EvalCaseResult] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.results)

    @property
    def passed(self) -> int:
        return sum(1 for result in self.results if result.passed)

    @property
    def pass_rate(self) -> float:
        return self.passed / self.total if self.total else 0.0

    @property
    def all_passed(self) -> bool:
        return self.total > 0 and self.passed == self.total


def run_eval_cases(
    gateway: AIGateway,
    spec: AITaskSpec,
    cases: list[EvalCase],
    *,
    user: User,
) -> EvalReport:
    """Run a small fixed set of cases and compare the gate decision.

    This is intentionally a library primitive; concrete task datasets and the
    CLI runner are wired when the first P2 task spec is added.
    """
    report = EvalReport()
    for case in cases:
        actual: ExpectedDecision
        quality: float | None = None
        error: str | None = None
        try:
            result = gateway.run(spec, case.payload, user=user)
            actual = result.quality.decision
            quality = result.quality.overall
        except AppError as exc:
            error = exc.code
            if exc.code == "AI_OUTPUT_REJECTED":
                actual = "rejected"
                details = exc.details or {}
                quality_payload = details.get("quality")
                if isinstance(quality_payload, dict):
                    quality = quality_payload.get("overall")
            else:
                actual = "error"
        report.results.append(
            EvalCaseResult(
                name=case.name,
                expected=case.expected,
                actual=actual,
                passed=actual == case.expected,
                quality=quality,
                error=error,
            )
        )
    return report
