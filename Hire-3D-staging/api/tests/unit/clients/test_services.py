from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from clients.services import ClientsService
from clients.types import ClientViewer
from common.exceptions import ForbiddenError, NotFoundError


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
    return ClientsService(store=store, audit_service=audit_service)


def make_client(*, assigned_operator_id=None):
    client = MagicMock()
    client.id = uuid4()
    client.assigned_operator_id = assigned_operator_id or uuid4()
    return client


class TestCreateClient:
    async def test_persists_and_audits(self, service, store, audit_service):
        created = make_client()
        store.create = AsyncMock(return_value=created)
        data = MagicMock()
        data.model_dump.return_value = {"company_name": "Acme"}

        result = await service.create_client(data)

        assert result is created
        store.create.assert_awaited_once_with(data)
        audit_service.log_create.assert_awaited_once()


class TestListClients:
    async def test_admin_lists_all(self, service, store):
        store.list_all = AsyncMock(return_value=[make_client()])
        store.list_by_operator = AsyncMock()

        viewer = ClientViewer(actor_id=uuid4(), can_read_all=True)
        result = await service.list_clients(viewer)

        assert len(result) == 1
        store.list_all.assert_awaited_once()
        store.list_by_operator.assert_not_awaited()

    async def test_operator_lists_only_assigned(self, service, store):
        actor_id = uuid4()
        store.list_by_operator = AsyncMock(return_value=[])
        store.list_all = AsyncMock()

        viewer = ClientViewer(actor_id=actor_id, can_read_all=False)
        await service.list_clients(viewer)

        store.list_by_operator.assert_awaited_once_with(actor_id)
        store.list_all.assert_not_awaited()


class TestGetClient:
    async def test_admin_can_read_any(self, service, store):
        client = make_client()
        store.get_by_id = AsyncMock(return_value=client)

        viewer = ClientViewer(actor_id=uuid4(), can_read_all=True)
        result = await service.get_client(client.id, viewer)

        assert result is client

    async def test_operator_can_read_assigned(self, service, store):
        actor_id = uuid4()
        client = make_client(assigned_operator_id=actor_id)
        store.get_by_id = AsyncMock(return_value=client)

        viewer = ClientViewer(actor_id=actor_id, can_read_all=False)
        result = await service.get_client(client.id, viewer)

        assert result is client

    async def test_operator_cannot_read_unassigned(self, service, store):
        client = make_client(assigned_operator_id=uuid4())
        store.get_by_id = AsyncMock(return_value=client)

        viewer = ClientViewer(actor_id=uuid4(), can_read_all=False)
        with pytest.raises(ForbiddenError):
            await service.get_client(client.id, viewer)

    async def test_not_found_raises(self, service, store):
        store.get_by_id = AsyncMock(return_value=None)

        viewer = ClientViewer(actor_id=uuid4(), can_read_all=True)
        with pytest.raises(NotFoundError):
            await service.get_client(uuid4(), viewer)


class TestUpdateClient:
    async def test_updates_and_audits(self, service, store, audit_service, monkeypatch):
        client = make_client()
        updated = make_client()
        store.get_by_id = AsyncMock(return_value=client)
        store.update = AsyncMock(return_value=updated)
        data = MagicMock()
        data.model_dump.return_value = {"company_name": "New"}

        before_snapshot = MagicMock()
        before_snapshot.model_dump.return_value = {"company_name": "Old"}
        monkeypatch.setattr(
            "clients.services.ClientUpdate.model_validate",
            lambda *_, **__: before_snapshot,
        )

        result = await service.update_client(client.id, data)

        assert result is updated
        store.update.assert_awaited_once_with(client, data)
        audit_service.log_update.assert_awaited_once()
        kwargs = audit_service.log_update.call_args.kwargs
        assert kwargs["before"] == {"company_name": "Old"}
        assert kwargs["after"] == {"company_name": "New"}

    async def test_not_found_raises(self, service, store):
        store.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundError):
            await service.update_client(uuid4(), MagicMock())
