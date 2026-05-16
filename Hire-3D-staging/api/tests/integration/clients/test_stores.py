from __future__ import annotations

from uuid import uuid4

import pytest

from clients.stores import ClientsStore
from clients.types import (
    BusinessStage,
    ClientCreate,
    ClientStatus,
    ClientUpdate,
    UKRegion,
)
from tests.factories import make_client, make_user


@pytest.fixture
def store(session):
    return ClientsStore(session=session)


def _make_payload(*, assigned_operator_id, **overrides) -> ClientCreate:
    base = dict(
        company_name="New Co",
        primary_contact_name="Jane",
        primary_contact_email="jane@new.example.com",
        headcount_at_engagement=5,
        business_stage=BusinessStage.GROWTH,
        region=UKRegion.LONDON,
        assigned_operator_id=assigned_operator_id,
        status=ClientStatus.ACTIVE,
    )
    base.update(overrides)
    return ClientCreate(**base)


class TestCreate:
    async def test_persists_client(self, store, session):
        operator = await make_user(session, role="OPERATOR")
        await session.commit()

        payload = _make_payload(assigned_operator_id=operator.id)
        created = await store.create(payload)

        assert created.id is not None
        assert created.company_name == "New Co"
        assert created.assigned_operator_id == operator.id


class TestGetById:
    async def test_found(self, store, session):
        client = await make_client(session)
        await session.commit()

        result = await store.get_by_id(client.id)

        assert result is not None
        assert result.id == client.id

    async def test_missing(self, store):
        assert await store.get_by_id(uuid4()) is None


class TestListAll:
    async def test_returns_all_in_recent_first_order(self, store, session):
        first = await make_client(session, company_name="First")
        second = await make_client(session, company_name="Second")
        await session.commit()

        rows = await store.list_all()

        ids = [r.id for r in rows]
        assert first.id in ids and second.id in ids
        assert ids.index(second.id) < ids.index(first.id)


class TestListByOperator:
    async def test_returns_only_assigned(self, store, session):
        op_a = await make_user(session, email="a@op.example.com", role="OPERATOR")
        op_b = await make_user(session, email="b@op.example.com", role="OPERATOR")
        mine = await make_client(session, assigned_operator_id=op_a.id)
        await make_client(
            session,
            assigned_operator_id=op_b.id,
            primary_contact_email="other@x.example.com",
        )
        await session.commit()

        rows = await store.list_by_operator(op_a.id)

        assert [r.id for r in rows] == [mine.id]


class TestUpdate:
    async def test_overwrites_fields(self, store, session):
        client = await make_client(session, company_name="Old")
        await session.commit()

        payload = ClientUpdate.model_validate(client, from_attributes=True)
        payload = payload.model_copy(update={"company_name": "Renamed"})
        updated = await store.update(client, payload)

        assert updated.company_name == "Renamed"
