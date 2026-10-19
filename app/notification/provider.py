from __future__ import annotations

import json
import logging
import re
from typing import Protocol
from urllib.parse import parse_qs, urlsplit

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

WECOM_HOST = "qyapi.weixin.qq.com"
WECOM_PATH = "/cgi-bin/webhook/send"
KEY_RE = re.compile(r"^[A-Za-z0-9_-]{8,128}$")
MAX_CONTENT_BYTES = 64 * 1024


class NotificationSendError(Exception):
    pass


def validate_webhook_url(url: str) -> str:
    if not url or len(url) > 1000:
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "Webhook 地址不合法", status_code=422)
    try:
        parts = urlsplit(url)
    except ValueError as exc:
        raise AppError(
            "NOTIFICATION_CHANNEL_INVALID", "Webhook 地址不合法", status_code=422
        ) from exc
    if parts.scheme != "https":
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "Webhook 必须使用 HTTPS", status_code=422)
    if parts.hostname != WECOM_HOST:
        raise AppError(
            "NOTIFICATION_CHANNEL_INVALID",
            "仅支持企业微信群机器人 Webhook",
            status_code=422,
        )
    if parts.port not in (None, 443):
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "Webhook 端口不合法", status_code=422)
    if parts.path != WECOM_PATH:
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "Webhook 路径不合法", status_code=422)
    if parts.username or parts.password or parts.fragment:
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "Webhook 地址不合法", status_code=422)
    query = parse_qs(parts.query, keep_blank_values=True)
    if set(query) != {"key"}:
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "Webhook 必须且只能包含 key", status_code=422)
    key = (query.get("key") or [""])[0]
    if not KEY_RE.fullmatch(key):
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "Webhook key 不合法", status_code=422)
    return url


class NotificationProvider(Protocol):
    def send(self, webhook_url: str, content: str) -> None: ...


class LoggingProvider:
    """Test/dev provider: never opens a network connection."""

    def send(self, webhook_url: str, content: str) -> None:
        del webhook_url
        logger.info("notification preview: %s", content[:500])


class WeComProvider:
    def send(self, webhook_url: str, content: str) -> None:
        validate_webhook_url(webhook_url)
        payload = {
            "msgtype": "markdown",
            "markdown": {"content": content[:4000]},
        }
        try:
            response = httpx.post(
                webhook_url,
                json=payload,
                timeout=10.0,
                follow_redirects=False,
            )
        except httpx.HTTPError as exc:
            raise NotificationSendError(f"企业微信请求失败: {exc}") from exc
        if response.status_code != 200:
            raise NotificationSendError(f"企业微信 HTTP {response.status_code}")
        if len(response.content) > MAX_CONTENT_BYTES:
            raise NotificationSendError("企业微信响应超过大小限制")
        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            raise NotificationSendError("企业微信响应不是合法 JSON") from exc
        if data.get("errcode") != 0:
            raise NotificationSendError(
                f"企业微信错误 {data.get('errcode')}: {data.get('errmsg', '')}"
            )


def get_provider() -> NotificationProvider:
    settings = get_settings()
    if settings.app_env == "test" or settings.notification_provider == "logging":
        return LoggingProvider()
    return WeComProvider()
