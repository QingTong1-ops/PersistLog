"""Bootstrap the local MySQL database from docs/schema.sql.

Usage:
    python scripts/init_db.py
    python scripts/init_db.py --url "mysql+pymysql://root:...@127.0.0.1:3306/persistlog_test?charset=utf8mb4" --create-database
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pymysql
from sqlalchemy.engine import URL, make_url

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import get_settings  # noqa: E402

DEFAULT_SCHEMA = PROJECT_ROOT / "docs" / "schema.sql"
DATABASE_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")


def split_statements(sql: str) -> list[str]:
    lines = [line for line in sql.splitlines() if not line.strip().startswith("--")]
    body = "\n".join(lines)
    return [statement.strip() for statement in body.split(";") if statement.strip()]


def connect(url: URL, database: str | None) -> pymysql.connections.Connection:
    return pymysql.connect(
        host=url.host or "127.0.0.1",
        port=url.port or 3306,
        user=url.username or "root",
        password=url.password or "",
        database=database,
        charset="utf8mb4",
        autocommit=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=None, help="SQLAlchemy database URL")
    parser.add_argument("--test", action="store_true", help="use TEST_DATABASE_URL")
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--create-database", action="store_true")
    args = parser.parse_args()

    settings = get_settings()
    if args.url:
        url_str = args.url
    elif args.test:
        url_str = settings.test_database_url or ""
    else:
        url_str = settings.database_url
    if not url_str:
        print("database URL is not configured", file=sys.stderr)
        return 2

    url = make_url(url_str)
    if not url.database:
        print("database name is required", file=sys.stderr)
        return 2
    if not DATABASE_NAME_RE.match(url.database):
        print(f"invalid database name: {url.database!r}", file=sys.stderr)
        return 2

    if args.create_database:
        with connect(url, None) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"CREATE DATABASE IF NOT EXISTS `{url.database}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
                )
        print(f"database ready: {url.database}")

    if not args.schema.exists():
        print(f"schema not found: {args.schema}", file=sys.stderr)
        return 2

    statements = split_statements(args.schema.read_text(encoding="utf-8"))
    with connect(url, url.database) as connection:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
            cursor.execute("SHOW TABLES")
            tables = [row[0] for row in cursor.fetchall()]

    print(f"applied {len(statements)} statements to {url.database}")
    print(f"tables ({len(tables)}): {', '.join(tables)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
