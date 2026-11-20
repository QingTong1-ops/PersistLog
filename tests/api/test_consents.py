from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register


def test_consent_grant_and_revoke(client: TestClient) -> None:
    body = register(client)
    headers = auth_header(body["access_token"])

    granted = client.put(
        "/api/v1/consents",
        headers=headers,
        json={"scope": "ai_import", "version": "1.0", "granted": True},
    )
    assert granted.status_code == 200, granted.text
    assert granted.json()["scope"] == "ai_import"
    assert granted.json()["revoked_at"] is None

    listing = client.get("/api/v1/consents", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    revoked = client.put(
        "/api/v1/consents",
        headers=headers,
        json={"scope": "ai_import", "version": "1.0", "granted": False},
    )
    assert revoked.status_code == 200
    assert revoked.json()["revoked_at"] is not None


def test_purpose_specific_consent_scopes(client: TestClient) -> None:
    body = register(client, email="consent-scopes@example.com")
    headers = auth_header(body["access_token"])
    for scope in ("ai_code_review", "ai_route_generation", "ai_quiz_feedback"):
        response = client.put(
            "/api/v1/consents",
            headers=headers,
            json={"scope": scope, "version": "v1", "granted": True},
        )
        assert response.status_code == 200, response.text
        assert response.json()["scope"] == scope


def test_consent_invalid_scope(client: TestClient) -> None:
    body = register(client)
    response = client.put(
        "/api/v1/consents",
        headers=auth_header(body["access_token"]),
        json={"scope": "unknown", "version": "1.0", "granted": True},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
