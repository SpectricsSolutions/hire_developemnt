from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from audits.stores import AuditStore
from audits.types import AuditAction, AuditLogQuery, AuditMeta
from common.datetime import get_utc_now
from tests.factories import make_user


@pytest.fixture
def store(session):
    return AuditStore(session=session)


async def _create_log(store, *, action=AuditAction.CREATE, **overrides):
    payload = dict(
        actor_id=None,
        action=action,
        resource_type="client",
        event=None,
        resource_id=uuid4(),
        ip_address=None,
        meta=AuditMeta(),
    )
    payload.update(overrides)
    return await store.create(**payload)


class TestCreate:
    async def test_persists_log(self, store, session):
        actor = await make_user(session)
        await session.commit()

        log = await _create_log(
            store, actor_id=actor.id, meta=AuditMeta(after={"name": "X"})
        )

        assert log.id is not None
        assert log.actor_id == actor.id
        assert log.meta.after == {"name": "X"}


class TestList:
    async def test_filters_by_action(self, store):
        await _create_log(store, action=AuditAction.CREATE)
        await _create_log(store, action=AuditAction.UPDATE)

        rows, total = await store.list(AuditLogQuery(action=AuditAction.CREATE))

        assert total == 1
        assert rows[0].action == AuditAction.CREATE

    async def test_filters_by_resource_type(self, store):
        await _create_log(store, resource_type="client")
        await _create_log(store, resource_type="user")

        rows, total = await store.list(AuditLogQuery(resource_type="user"))

        assert total == 1
        assert rows[0].resource_type == "user"

    async def test_filters_by_actor(self, store, session):
        actor = await make_user(session)
        await session.commit()
        await _create_log(store, actor_id=actor.id)
        await _create_log(store)  # actor_id=None

        rows, total = await store.list(AuditLogQuery(actor_id=actor.id))

        assert total == 1
        assert rows[0].actor_id == actor.id

    async def test_filters_by_time_window(self, store):
        await _create_log(store)
        rows, total = await store.list(
            AuditLogQuery(after=get_utc_now() + timedelta(minutes=5))
        )
        assert total == 0

    async def test_orders_recent_first_and_paginates(self, store):
        for _ in range(3):
            await _create_log(store)

        rows, total = await store.list(AuditLogQuery(limit=2, offset=0))

        assert total == 3
        assert len(rows) == 2
        assert rows[0].created_at >= rows[1].created_at
