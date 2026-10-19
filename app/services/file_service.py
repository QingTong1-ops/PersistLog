from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.models.system import StoredFile
from app.models.user import User
from app.storage import get_storage

settings = get_settings()
ALLOWED_EXTENSIONS = {".md", ".markdown"}


def save_import_upload(db: Session, user: User, upload: UploadFile) -> StoredFile:
    original_name = upload.filename or "plan.md"
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise AppError(
            "UNSUPPORTED_FILE_TYPE",
            "仅支持 .md / .markdown 文件",
            status_code=422,
            details={"filename": original_name},
        )

    data = upload.file.read()
    if len(data) > settings.max_upload_bytes:
        raise AppError(
            "FILE_TOO_LARGE",
            "文件超过大小限制",
            status_code=413,
            details={"max_bytes": settings.max_upload_bytes},
        )
    if not data:
        raise AppError("EMPTY_FILE", "文件为空", status_code=422)
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise AppError("INVALID_FILE_ENCODING", "文件必须是 UTF-8 编码", status_code=422) from exc

    file_id = str(uuid.uuid4())
    storage_key = f"users/{user.id}/imports/{file_id}/source.md"
    get_storage().save(storage_key, data)

    stored = StoredFile(
        id=file_id,
        user_id=user.id,
        storage_key=storage_key,
        original_name=original_name,
        mime_type=upload.content_type or "text/markdown",
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        status="ready",
    )
    db.add(stored)
    db.flush()
    return stored


def read_text(stored: StoredFile) -> str:
    data = get_storage().read(stored.storage_key)
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise AppError("INVALID_FILE_ENCODING", "文件必须是 UTF-8 编码", status_code=422) from exc
