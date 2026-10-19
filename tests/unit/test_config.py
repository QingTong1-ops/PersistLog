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
