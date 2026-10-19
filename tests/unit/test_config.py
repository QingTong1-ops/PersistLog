from app.core.config import Settings


def test_resolved_database_url_prefers_test_db() -> None:
    settings = Settings(
        _env_file=None,
        app_env="test",
        test_database_url="mysql+pymysql://u:p@127.0.0.1:3306/persistlog_test",
    )
    assert settings.resolved_database_url().endswith("/persistlog_test")


def test_resolved_database_url_uses_main_db_in_dev() -> None:
    settings = Settings(
        _env_file=None,
        app_env="dev",
        database_url="mysql+pymysql://u:p@127.0.0.1:3306/persistlog",
        test_database_url="mysql+pymysql://u:p@127.0.0.1:3306/persistlog_test",
    )
    assert settings.resolved_database_url().endswith("/persistlog")


def test_cors_origins_are_split_and_trimmed() -> None:
    settings = Settings(
        _env_file=None,
        cors_origins="http://localhost:3000, https://app.example.com ,",
    )
    assert settings.cors_origin_list == [
        "http://localhost:3000",
        "https://app.example.com",
    ]


def test_refresh_cookie_security_defaults() -> None:
    dev = Settings(_env_file=None, app_env="dev")
    prod = Settings(_env_file=None, app_env="prod")
    assert dev.resolved_refresh_cookie_secure() is False
    assert prod.resolved_refresh_cookie_secure() is True
    assert dev.refresh_cookie_path == "/api/v1/auth"


def test_refresh_cookie_secure_can_be_overridden() -> None:
    settings = Settings(
        _env_file=None,
        app_env="dev",
        refresh_cookie_secure=True,
    )
    assert settings.resolved_refresh_cookie_secure() is True
