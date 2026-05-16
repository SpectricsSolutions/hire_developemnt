from __future__ import annotations

from uuid import uuid4

import pytest

from tests.factories import DEFAULT_PASSWORD, make_client, make_engagement, make_user


@pytest.fixture
async def admin_user(session):
    return await make_user(session, email="admin@example.com", role="ADMIN")


@pytest.fixture
async def operator_user(session):
    return await make_user(session, email="operator@example.com", role="OPERATOR")


@pytest.fixture
async def viewer_user(session):
    return await make_user(session, email="viewer@example.com", role="VIEWER")


async def _login(client, user) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": DEFAULT_PASSWORD},
    )
    return response.json()["data"]["accessToken"]


def _client_payload(operator_id) -> dict:
    return {
        "companyName": "Acme Ltd",
        "primaryContactName": "Jane Doe",
        "primaryContactEmail": "jane@acme.example.com",
        "headcountAtEngagement": 25,
        "businessStage": "GROWTH",
        "region": "LONDON",
        "assignedOperatorId": str(operator_id),
        "status": "ACTIVE",
    }


class TestCreateClient:
    async def test_admin_can_create(self, client, admin_user, operator_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.post(
            "/api/v1/clients",
            headers={"Authorization": f"Bearer {token}"},
            json=_client_payload(operator_user.id),
        )

        assert response.status_code == 201
        body = response.json()
        assert body["success"] is True
        assert body["data"]["companyName"] == "Acme Ltd"

    async def test_operator_cannot_create(self, client, operator_user, session):
        await session.commit()
        token = await _login(client, operator_user)

        response = await client.post(
            "/api/v1/clients",
            headers={"Authorization": f"Bearer {token}"},
            json=_client_payload(operator_user.id),
        )

        assert response.status_code == 403

    async def test_validation_error_envelope(
        self, client, admin_user, operator_user, session
    ):
        await session.commit()
        token = await _login(client, admin_user)

        payload = _client_payload(operator_user.id)
        payload["primaryContactEmail"] = "not-an-email"

        response = await client.post(
            "/api/v1/clients",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )

        assert response.status_code == 422
        body = response.json()
        assert body["success"] is False
        assert body["message"] == "Validation error."
        assert "primaryContactEmail" in body["errors"]


class TestListClients:
    async def test_admin_sees_all(self, client, admin_user, operator_user, session):
        await make_client(
            session, assigned_operator_id=operator_user.id, company_name="A"
        )
        await make_client(
            session,
            assigned_operator_id=operator_user.id,
            company_name="B",
            primary_contact_email="b@acme.example.com",
        )
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.get(
            "/api/v1/clients", headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        assert len(response.json()["data"]) == 2

    async def test_operator_sees_only_assigned(self, client, operator_user, session):
        other = await make_user(session, email="other@example.com", role="OPERATOR")
        mine = await make_client(
            session, assigned_operator_id=operator_user.id, company_name="Mine"
        )
        await make_client(
            session,
            assigned_operator_id=other.id,
            company_name="Theirs",
            primary_contact_email="theirs@acme.example.com",
        )
        await session.commit()

        token = await _login(client, operator_user)
        response = await client.get(
            "/api/v1/clients", headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        ids = [c["id"] for c in response.json()["data"]]
        assert ids == [str(mine.id)]

    async def test_unauthenticated_is_401(self, client):
        response = await client.get("/api/v1/clients")
        assert response.status_code == 401


class TestGetClient:
    async def test_admin_can_read_any(self, client, admin_user, operator_user, session):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.get(
            f"/api/v1/clients/{target.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["id"] == str(target.id)

    async def test_operator_can_read_assigned(self, client, operator_user, session):
        mine = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, operator_user)
        response = await client.get(
            f"/api/v1/clients/{mine.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200

    async def test_operator_cannot_read_unassigned(
        self, client, operator_user, session
    ):
        other = await make_user(session, email="other@example.com", role="OPERATOR")
        target = await make_client(session, assigned_operator_id=other.id)
        await session.commit()

        token = await _login(client, operator_user)
        response = await client.get(
            f"/api/v1/clients/{target.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_unknown_returns_404(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.get(
            f"/api/v1/clients/{uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404


class TestUpdateClient:
    async def test_admin_can_update(self, client, admin_user, operator_user, session):
        existing = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, admin_user)
        payload = _client_payload(operator_user.id)
        payload["companyName"] = "Renamed"

        response = await client.put(
            f"/api/v1/clients/{existing.id}",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )

        assert response.status_code == 200
        assert response.json()["data"]["companyName"] == "Renamed"

    async def test_viewer_cannot_update(
        self, client, viewer_user, operator_user, session
    ):
        existing = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, viewer_user)
        response = await client.put(
            f"/api/v1/clients/{existing.id}",
            headers={"Authorization": f"Bearer {token}"},
            json=_client_payload(operator_user.id),
        )

        assert response.status_code == 403


class TestDeleteClient:
    async def test_admin_can_delete(self, client, admin_user, operator_user, session):
        existing = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.delete(
            f"/api/v1/clients/{existing.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        follow_up = await client.get(
            f"/api/v1/clients/{existing.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert follow_up.status_code == 404

    async def test_operator_cannot_delete(self, client, operator_user, session):
        existing = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, operator_user)
        response = await client.delete(
            f"/api/v1/clients/{existing.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_unknown_returns_404(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.delete(
            f"/api/v1/clients/{uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404

    async def test_with_engagements_returns_409(
        self, client, admin_user, operator_user, session
    ):
        existing = await make_client(session, assigned_operator_id=operator_user.id)
        await make_engagement(session, client_id=existing.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.delete(
            f"/api/v1/clients/{existing.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 409
        assert response.json()["success"] is False
