from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register


def test_job_target_crud_and_primary(client: TestClient) -> None:
    body = register(client)
    headers = auth_header(body["access_token"])

    first = client.post(
        "/api/v1/job-targets",
        headers=headers,
        json={"title": "后端开发", "priority": "P0", "is_primary": True},
    )
    assert first.status_code == 201, first.text
    first_id = first.json()["id"]
    assert first.json()["is_primary"] is True

    second = client.post(
        "/api/v1/job-targets",
        headers=headers,
        json={"title": "基础架构", "priority": "P1"},
    )
    assert second.status_code == 201
    second_id = second.json()["id"]

    listing = client.get("/api/v1/job-targets", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 2

    switched = client.patch(
        f"/api/v1/job-targets/{second_id}",
        headers=headers,
        json={"is_primary": True},
    )
    assert switched.status_code == 200
    assert switched.json()["is_primary"] is True

    listing = client.get("/api/v1/job-targets", headers=headers).json()
    by_id = {item["id"]: item for item in listing}
    assert by_id[first_id]["is_primary"] is False
    assert by_id[second_id]["is_primary"] is True

    archived = client.delete(f"/api/v1/job-targets/{first_id}", headers=headers)
    assert archived.status_code == 204

    active = client.get("/api/v1/job-targets", headers=headers).json()
    assert [item["id"] for item in active] == [second_id]

    all_targets = client.get(
        "/api/v1/job-targets?include_archived=true", headers=headers
    ).json()
    assert len(all_targets) == 2


def test_job_target_user_isolation(client: TestClient) -> None:
    alice = register(client, email="alice@example.com")
    bob = register(client, email="bob@example.com")
    alice_headers = auth_header(alice["access_token"])
    bob_headers = auth_header(bob["access_token"])

    created = client.post(
        "/api/v1/job-targets",
        headers=alice_headers,
        json={"title": "Alice 的岗位"},
    )
    target_id = created.json()["id"]

    patch = client.patch(
        f"/api/v1/job-targets/{target_id}",
        headers=bob_headers,
        json={"title": "篡改"},
    )
    assert patch.status_code == 404
    assert patch.json()["error"]["code"] == "JOB_TARGET_NOT_FOUND"

    delete = client.delete(
        f"/api/v1/job-targets/{target_id}",
        headers=bob_headers,
    )
    assert delete.status_code == 404
