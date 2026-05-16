from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from common.exceptions import NotFoundError
from engagements.services import EngagementsService


@pytest.fixture
def store():
    return MagicMock()


@pytest.fixture
def audit_service():
    svc = MagicMock()
    svc.log_create = AsyncMock()
    svc.log_update = AsyncMock()
    return svc


@pytest.fixture
def service(store, audit_service):
    return EngagementsService(store=store, audit_service=audit_service)


def make_engagement(*, client_id=None):
    engagement = MagicMock()
    engagement.id = uuid4()
    engagement.client_id = client_id or uuid4()
    return engagement


class TestCreateEngagement:
    async def test_persists_and_audits(self, service, store, audit_service):
        client_id = uuid4()
        created = make_engagement(client_id=client_id)
        store.create = AsyncMock(return_value=created)
        data = MagicMock()
        data.model_dump.return_value = {"product": "HIRE_3D_CORE"}

        result = await service.create_engagement(client_id, data)

        assert result is created
        store.create.assert_awaited_once_with(client_id, data)
        audit_service.log_create.assert_awaited_once()


class TestListEngagements:
    async def test_delegates_to_store(self, service, store):
        client_id = uuid4()
        store.list_by_client = AsyncMock(return_value=[make_engagement()])

        result = await service.list_engagements(client_id)

        assert len(result) == 1
        store.list_by_client.assert_awaited_once_with(client_id)


class TestGetEngagement:
    async def test_returns_engagement(self, service, store):
        client_id = uuid4()
        engagement = make_engagement(client_id=client_id)
        store.get_by_id = AsyncMock(return_value=engagement)

        result = await service.get_engagement(client_id, engagement.id)

        assert result is engagement

    async def test_missing_raises(self, service, store):
        store.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundError):
            await service.get_engagement(uuid4(), uuid4())

    async def test_mismatched_client_raises(self, service, store):
        engagement = make_engagement()
        store.get_by_id = AsyncMock(return_value=engagement)

        with pytest.raises(NotFoundError):
            await service.get_engagement(uuid4(), engagement.id)


class TestUpdateEngagement:
    async def test_updates_and_audits(self, service, store, audit_service, monkeypatch):
        client_id = uuid4()
        engagement = make_engagement(client_id=client_id)
        updated = make_engagement(client_id=client_id)
        store.get_by_id = AsyncMock(return_value=engagement)
        store.update = AsyncMock(return_value=updated)
        data = MagicMock()
        data.model_dump.return_value = {"product": "HIRE_READY"}

        before_snapshot = MagicMock()
        before_snapshot.model_dump.return_value = {"product": "HIRE_3D_CORE"}
        monkeypatch.setattr(
            "engagements.services.EngagementUpdate.model_validate",
            lambda *_, **__: before_snapshot,
        )

        result = await service.update_engagement(client_id, engagement.id, data)

        assert result is updated
        store.update.assert_awaited_once_with(engagement, data)
        audit_service.log_update.assert_awaited_once()

    async def test_missing_raises(self, service, store):
        store.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundError):
            await service.update_engagement(uuid4(), uuid4(), MagicMock())

    async def test_wrong_client_raises(self, service, store):
        engagement = make_engagement()
        store.get_by_id = AsyncMock(return_value=engagement)

        with pytest.raises(NotFoundError):
            await service.update_engagement(uuid4(), engagement.id, MagicMock())
