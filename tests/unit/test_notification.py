from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from app.core.crypto import mask_webhook
from app.core.errors import AppError
from app.notification.provider import validate_webhook_url
from app.services.notification_service import (
    in_quiet_hours,
    normalize_quiet_hours,
    render_template,
)

VALID_WEBHOOK = (
    "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?"
    "key=0123456789abcdef-1234-5678-90ab-cdef01234567"
)


def test_validate_webhook() -> None:
    assert validate_webhook_url(VALID_WEBHOOK) == VALID_WEBHOOK
    for url in (
        "http://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=0123456789abcdef",
        "https://evil.example.com/cgi-bin/webhook/send?key=0123456789abcdef",
        "https://qyapi.weixin.qq.com/other?key=0123456789abcdef",
        "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=short",
        "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=0123456789abcdef&x=1",
    ):
        with pytest.raises(AppError):
            validate_webhook_url(url)


def test_mask_webhook() -> None:
    masked = mask_webhook(VALID_WEBHOOK)
    assert "0123456789abcdef" not in masked
    assert "****4567" in masked


def test_render_template() -> None:
    assert render_template("完成 {completed}/{planned}", {"completed": 2, "planned": 3}) == "完成 2/3"
    assert render_template("缺少 {unknown}", {}) == "缺少 "


def test_quiet_hours() -> None:
    zone = ZoneInfo("Asia/Shanghai")
    quiet = {"start": "23:00", "end": "07:00"}
    assert in_quiet_hours(datetime(2026, 1, 1, 23, 30, tzinfo=zone), quiet)
    assert in_quiet_hours(datetime(2026, 1, 2, 6, 30, tzinfo=zone), quiet)
    assert not in_quiet_hours(datetime(2026, 1, 1, 12, 0, tzinfo=zone), quiet)
    assert normalize_quiet_hours(None) == {"start": "23:00", "end": "07:00"}
