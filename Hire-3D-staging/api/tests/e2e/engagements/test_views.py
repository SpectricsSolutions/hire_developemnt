from __future__ import annotations

from uuid import uuid4

import pytest

from tests.factories import (
    DEFAULT_PASSWORD,
    make_client,
    make_engagement,
    make_user,
)


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


def _engagement_payload() -> dict:
    return {
        "product": "HIRE_3D_CORE",
        "engagementDate": "2026-02-01",
        "feeCharged": "2000.00",
        "feeStatus": "INVOICED",
        "auditStatus": "SCHEDULED",
    }


class TestCreateEngagement:
    async def test_admin_can_create(self, client, admin_user, operator_user, session):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.post(
            f"/api/v1/clients/{target.id}/engagements",
            headers={"Authorization": f"Bearer {token}"},
            json=_engagement_payload(),
        )

        assert response.status_code == 201
        body = response.json()
        assert body["data"]["product"] == "HIRE_3D_CORE"
        assert body["data"]["clientId"] == str(target.id)

    async def test_viewer_cannot_create(
        self, client, viewer_user, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, viewer_user)
        response = await client.post(
            f"/api/v1/clients/{target.id}/engagements",
            headers={"Authorization": f"Bearer {token}"},
            json=_engagement_payload(),
        )

        assert response.status_code == 403

    async def test_validation_error_envelope(
        self, client, admin_user, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, admin_user)
        payload = _engagement_payload()
        payload["engagementDate"] = "not-a-date"

        response = await client.post(
            f"/api/v1/clients/{target.id}/engagements",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )

        assert response.status_code == 422
        body = response.json()
        assert body["success"] is False
        assert "engagementDate" in body["errors"]


class TestListEngagements:
    async def test_returns_engagements_for_client(
        self, client, admin_user, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.get(
            f"/api/v1/clients/{target.id}/engagements",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert len(response.json()["data"]) == 1


class TestGetEngagement:
    async def test_returns_engagement(self, client, admin_user, operator_user, session):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.get(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["id"] == str(engagement.id)

    async def test_unknown_returns_404(
        self, client, admin_user, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.get(
            f"/api/v1/clients/{target.id}/engagements/{uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404

    async def test_wrong_client_returns_404(
        self, client, admin_user, operator_user, session
    ):
        a = await make_client(session, assigned_operator_id=operator_user.id)
        b = await make_client(
            session,
            assigned_operator_id=operator_user.id,
            company_name="Other",
            primary_contact_email="other@b.example.com",
        )
        engagement = await make_engagement(session, client_id=a.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.get(
            f"/api/v1/clients/{b.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404


class TestFeeRedaction:
    async def test_admin_sees_fee_fields(
        self, client, admin_user, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.get(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        body = response.json()["data"]
        assert "feeCharged" in body
        assert "feeStatus" in body

    async def test_operator_response_omits_fee_fields(
        self, client, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, operator_user)

        get_response = await client.get(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        get_body = get_response.json()["data"]
        assert "feeCharged" not in get_body
        assert "feeStatus" not in get_body
        assert get_body["product"] == engagement.product.value

        list_response = await client.get(
            f"/api/v1/clients/{target.id}/engagements",
            headers={"Authorization": f"Bearer {token}"},
        )
        for item in list_response.json()["data"]:
            assert "feeCharged" not in item
            assert "feeStatus" not in item

    async def test_operator_update_response_omits_fee_fields(
        self, client, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, operator_user)
        payload = _engagement_payload()
        payload["feeStatus"] = "PAID"

        response = await client.put(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )

        assert response.status_code == 200
        body = response.json()["data"]
        assert "feeCharged" not in body
        assert "feeStatus" not in body

    async def test_viewer_response_omits_fee_fields(
        self, client, viewer_user, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, viewer_user)
        response = await client.get(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        body = response.json()["data"]
        assert "feeCharged" not in body
        assert "feeStatus" not in body


class TestUpdateEngagement:
    async def test_admin_can_update(self, client, admin_user, operator_user, session):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, admin_user)
        payload = _engagement_payload()
        payload["feeStatus"] = "PAID"

        response = await client.put(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )

        assert response.status_code == 200
        assert response.json()["data"]["feeStatus"] == "PAID"

    async def test_viewer_cannot_update(
        self, client, viewer_user, operator_user, session
    ):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, viewer_user)
        response = await client.put(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
            json=_engagement_payload(),
        )

        assert response.status_code == 403


class TestDeleteEngagement:
    async def test_admin_can_delete(self, client, admin_user, operator_user, session):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.delete(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        follow_up = await client.get(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert follow_up.status_code == 404

    async def test_operator_cannot_delete(self, client, operator_user, session):
        target = await make_client(session, assigned_operator_id=operator_user.id)
        engagement = await make_engagement(session, client_id=target.id)
        await session.commit()

        token = await _login(client, operator_user)
        response = await client.delete(
            f"/api/v1/clients/{target.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_wrong_client_returns_404(
        self, client, admin_user, operator_user, session
    ):
        a = await make_client(session, assigned_operator_id=operator_user.id)
        b = await make_client(
            session,
            assigned_operator_id=operator_user.id,
            company_name="Other",
            primary_contact_email="other@b.example.com",
        )
        engagement = await make_engagement(session, client_id=a.id)
        await session.commit()

        token = await _login(client, admin_user)
        response = await client.delete(
            f"/api/v1/clients/{b.id}/engagements/{engagement.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404
