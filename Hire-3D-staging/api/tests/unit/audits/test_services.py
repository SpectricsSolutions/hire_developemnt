from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from audits.services import AuditService
from audits.types import AuditAction, ResourceRef
from common.audit_context import set_actor_id, set_ip_address


@pytest.fixture
def store():
    s = MagicMock()
    s.create = AsyncMock()
    return s


@pytest.fixture
def service(store):
    return AuditService(store=store, session=MagicMock())


@pytest.fixture(autouse=True)
def _reset_context():
    set_actor_id(None)
    set_ip_address(None)


class TestLogCreate:
    async def test_writes_create_action(self, service, store):
        actor_id = uuid4()
        set_actor_id(actor_id)
        ref = ResourceRef(type="client", id=uuid4())

        await service.log_create(ref, after={"name": "Acme"})

        store.create.assert_awaited_once()
        kwargs = store.create.call_args.kwargs
        assert kwargs["action"] == AuditAction.CREATE
        assert kwargs["resource_type"] == "client"
        assert kwargs["resource_id"] == ref.id
        assert kwargs["actor_id"] == actor_id
        assert kwargs["meta"].after == {"name": "Acme"}
        assert kwargs["meta"].before is None


class TestLogUpdate:
    async def test_records_before_and_after(self, service, store):
        ref = ResourceRef(type="user", id=uuid4())

        await service.log_update(
            ref, before={"status": "PENDING"}, after={"status": "ACTIVE"}
        )

        kwargs = store.create.call_args.kwargs
        assert kwargs["action"] == AuditAction.UPDATE
        assert kwargs["meta"].before == {"status": "PENDING"}
        assert kwargs["meta"].after == {"status": "ACTIVE"}


class TestLogDelete:
    async def test_records_before_only(self, service, store):
        ref = ResourceRef(type="user", id=uuid4())

        await service.log_delete(ref, before={"name": "X"})

        kwargs = store.create.call_args.kwargs
        assert kwargs["action"] == AuditAction.DELETE
        assert kwargs["meta"].before == {"name": "X"}
        assert kwargs["meta"].after is None


class TestLogLogin:
    async def test_writes_login_event(self, service, store):
        actor_id = uuid4()

        await service.log_login(actor_id=actor_id)

        kwargs = store.create.call_args.kwargs
        assert kwargs["action"] == AuditAction.LOGIN
        assert kwargs["resource_type"] == "session"
        assert kwargs["event"] == "user.login"
        assert kwargs["actor_id"] == actor_id


class TestLogLogout:
    async def test_explicit_actor(self, service, store):
        actor_id = uuid4()

        await service.log_logout(actor_id=actor_id)

        kwargs = store.create.call_args.kwargs
        assert kwargs["action"] == AuditAction.LOGOUT
        assert kwargs["actor_id"] == actor_id

    async def test_falls_back_to_context_actor(self, service, store):
        actor_id = uuid4()
        set_actor_id(actor_id)

        await service.log_logout()

        assert store.create.call_args.kwargs["actor_id"] == actor_id


class TestRecordSwallowsErrors:
    async def test_does_not_raise_when_store_fails(self, service, store):
        store.create.side_effect = RuntimeError("DB down")

        # Must not propagate — auditing should never break the parent operation.
        await service.log_create(ResourceRef(type="client", id=uuid4()), after={})
