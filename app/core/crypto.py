from __future__ import annotations

from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.core.errors import AppError


def _fernet() -> Fernet:
    key = get_settings().encryption_key
    if not key:
        raise AppError(
            "ENCRYPTION_KEY_MISSING",
            "服务端未配置加密密钥",
            status_code=500,
        )
    try:
        return Fernet(key.encode("utf-8"))
    except ValueError as exc:
        raise AppError(
            "ENCRYPTION_KEY_INVALID",
            "服务端加密密钥格式错误",
            status_code=500,
        ) from exc


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise AppError(
            "NOTIFICATION_CHANNEL_INVALID",
            "通知渠道配置无法解密",
            status_code=422,
        ) from exc


def mask_webhook(url: str) -> str:
    try:
        parts = urlsplit(url)
    except ValueError:
        return "***"
    query = parse_qs(parts.query)
    key = (query.get("key") or [""])[0]
    masked = f"****{key[-4:]}" if key else "****"
    query["key"] = [masked]
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query, doseq=True, safe="*"), "")
    )
