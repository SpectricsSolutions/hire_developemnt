from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest

from engagements.stores import EngagementsStore
from engagements.types import (
    AuditStatus,
    EngagementCreate,
    EngagementUpdate,
    FeeStatus,
    Product,
)
from tests.factories import make_client, make_engagement


@pytest.fixture
def store(session):
    return EngagementsStore(session=session)


def _make_payload(**overrides) -> EngagementCreate:
    base = dict(
        product=Product.HIRE_3D_CORE,
        engagement_date=date(2026, 1, 15),
        fee_charged=Decimal("1500.00"),
        fee_status=FeeStatus.INVOICED,
        audit_date=None,
        report_issued_date=None,
        audit_status=AuditStatus.SCHEDULED,
        next_review_due=None,
    )
    base.update(overrides)
    return EngagementCreate(**base)


class TestCreate:
    async def test_persists_engagement(self, store, session):
        client = await make_client(session)
        await session.commit()

        engagement = await store.create(client.id, _make_payload())

        assert engagement.id is not None
        assert engagement.client_id == client.id
        assert engagement.product == Product.HIRE_3D_CORE


class TestGetById:
    async def test_found(self, store, session):
        client = await make_client(session)
        engagement = await make_engagement(session, client_id=client.id)
        await session.commit()

        result = await store.get_by_id(engagement.id)

        assert result is not None
        assert result.id == engagement.id

    async def test_missing(self, store):
        assert await store.get_by_id(uuid4()) is None


class TestListByClient:
    async def test_orders_by_engagement_date_desc(self, store, session):
        client = await make_client(session)
        older = await make_engagement(
            session, client_id=client.id, engagement_date=date(2026, 1, 1)
        )
        newer = await make_engagement(
            session, client_id=client.id, engagement_date=date(2026, 6, 1)
        )
        await session.commit()

        rows = await store.list_by_client(client.id)

        assert [r.id for r in rows] == [newer.id, older.id]

    async def test_ignores_other_clients(self, store, session):
        client_a = await make_client(session, company_name="A")
        client_b = await make_client(
            session, company_name="B", primary_contact_email="b@a.example.com"
        )
        mine = await make_engagement(session, client_id=client_a.id)
        await make_engagement(session, client_id=client_b.id)
        await session.commit()

        rows = await store.list_by_client(client_a.id)

        assert [r.id for r in rows] == [mine.id]


class TestUpdate:
    async def test_overwrites_fields(self, store, session):
        client = await make_client(session)
        engagement = await make_engagement(session, client_id=client.id)
        await session.commit()

        payload = EngagementUpdate.model_validate(engagement, from_attributes=True)
        payload = payload.model_copy(update={"fee_status": FeeStatus.PAID})

        updated = await store.update(engagement, payload)

        assert updated.fee_status == FeeStatus.PAID
