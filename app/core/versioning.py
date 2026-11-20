from __future__ import annotations

from app.core.errors import AppError


def parse_if_match(value: str | None) -> int | None:
    """Parse a simple If-Match value: 3, "3", or W/"3"."""
    if value is None or not value.strip():
        return None
    raw = value.strip()
    if raw.startswith("W/"):
        raw = raw[2:].strip()
    if len(raw) >= 2 and raw[0] == '"' and raw[-1] == '"':
        raw = raw[1:-1]
    try:
        version = int(raw)
    except ValueError as exc:
        raise AppError(
            "INVALID_VERSION_HEADER",
            "If-Match 必须是整数版本号",
            status_code=400,
        ) from exc
    if version < 1:
        raise AppError(
            "INVALID_VERSION_HEADER",
            "版本号必须大于 0",
            status_code=400,
        )
    return version


def resolve_expected_version(
    if_match: str | None,
    body_version: int | None,
) -> int | None:
    header_version = parse_if_match(if_match)
    if (
        header_version is not None
        and body_version is not None
        and header_version != body_version
    ):
        raise AppError(
            "VERSION_MISMATCH",
            "If-Match 与请求体版本不一致",
            status_code=400,
            details={"if_match": header_version, "body_version": body_version},
        )
    return header_version if header_version is not None else body_version


def ensure_version(current: int, expected: int | None) -> None:
    if expected is None:
        raise AppError(
            "VERSION_REQUIRED",
            "更新请求必须携带 version",
            status_code=422,
        )
    if expected != current:
        raise AppError(
            "VERSION_CONFLICT",
            "资源版本已变化，请刷新后重试",
            status_code=409,
            details={"current_version": current, "expected_version": expected},
        )


def bump_version(current: int) -> int:
    return current + 1
