import logging

from app.core.logging import SensitiveDataFilter, redact_sensitive


def test_redact_sensitive_values() -> None:
    assert "secret" not in redact_sensitive("password=secret")
    assert "abc123" not in redact_sensitive("Authorization: Bearer abc123")
    assert "abcdef" not in redact_sensitive(
        "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abcdef"
    )
    assert redact_sensitive("normal message") == "normal message"


def test_sensitive_filter_scrubs_record() -> None:
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="webhook_url=https://example.com?key=abcdef token=%s",
        args=("abc123",),
        exc_info=None,
    )
    SensitiveDataFilter().filter(record)
    message = record.getMessage()
    assert "abcdef" not in message
    assert "abc123" not in message
