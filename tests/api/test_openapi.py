from __future__ import annotations

from fastapi.testclient import TestClient


def test_openapi_contract_is_available(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    paths = schema["paths"]
    assert "/api/v1/auth/login" in paths
    assert "/api/v1/today" in paths
    assert "/api/v1/dashboard/overview" in paths
    assert "/api/v1/notification-channels" in paths
    assert "/api/v1/audit-logs" in paths

    for path in paths:
        assert path.startswith("/api/v1/") or path in {"/", "/health", "/health/db"}

    operation_ids = [
        operation["operationId"]
        for methods in paths.values()
        for operation in methods.values()
        if isinstance(operation, dict) and "operationId" in operation
    ]
    assert len(operation_ids) == len(set(operation_ids))

    schemes = schema["components"]["securitySchemes"]
    assert "HTTPBearer" in schemes
