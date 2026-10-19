from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def new_uuid() -> str:
    return str(uuid4())


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    file_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("files.id", ondelete="RESTRICT"), nullable=False
    )
    format: Mapped[str] = mapped_column(String(16), nullable=False, default="markdown")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="uploaded")
    parser_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ai_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ai_runs.id", ondelete="SET NULL"), nullable=True
    )
    created_route_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("routes.id", ondelete="SET NULL"), nullable=True
    )
    summary_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ImportItem(Base):
    __tablename__ = "import_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    batch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False
    )
    source_locator: Mapped[str | None] = mapped_column(String(500), nullable=True)
    normalized_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="valid")
    error_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ImportIssue(Base):
    __tablename__ = "import_issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    batch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("import_items.id", ondelete="CASCADE"), nullable=True
    )
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    suggestion: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
