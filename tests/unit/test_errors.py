from app.core.errors import AppError


def test_app_error_carries_code_and_status() -> None:
    error = AppError("IMPORT_INVALID", "导入失败", status_code=422, details={"count": 2})
    assert error.code == "IMPORT_INVALID"
    assert error.status_code == 422
    assert error.details == {"count": 2}
    assert str(error) == "导入失败"
