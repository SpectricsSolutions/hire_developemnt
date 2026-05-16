from __future__ import annotations

import pytest

from tests.factories import DEFAULT_PASSWORD, make_user


@pytest.fixture
async def admin_user(session):
    return await make_user(session, email="admin@example.com", role="ADMIN")


@pytest.fixture
async def viewer_user(session):
    return await make_user(session, email="viewer@example.com", role="VIEWER")


async def _login(client, user) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": DEFAULT_PASSWORD},
    )
    return response.json()["data"]["accessToken"]


class TestListAuditLogs:
    async def test_admin_can_list(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)  # logs a LOGIN audit entry

        response = await client.get(
            "/api/v1/audit-logs",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "items" in body["data"]
        assert "total" in body["data"]
        # The login itself produced at least one entry.
        assert body["data"]["total"] >= 1
        item = body["data"]["items"][0]
        assert item["action"] == "LOGIN"
        assert item["actorName"] == admin_user.name

    async def test_viewer_is_forbidden(self, client, viewer_user, session):
        await session.commit()
        token = await _login(client, viewer_user)

        response = await client.get(
            "/api/v1/audit-logs",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_unauthenticated_is_401(self, client):
        response = await client.get("/api/v1/audit-logs")
        assert response.status_code == 401

    async def test_filters_by_action(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.get(
            "/api/v1/audit-logs?action=LOGIN",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        for item in response.json()["data"]["items"]:
            assert item["action"] == "LOGIN"


class TestNoMutationEndpoints:
    async def test_post_not_allowed(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.post(
            "/api/v1/audit-logs",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )

        assert response.status_code == 405

    async def test_delete_not_allowed(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.delete(
            "/api/v1/audit-logs",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 405
