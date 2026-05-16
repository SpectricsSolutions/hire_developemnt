from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from assessments.services import AssessmentsService
from assessments.types import AssessmentPhase, GateName
from common.exceptions import ConflictError, GateBlockedError


@pytest.fixture
def store():
    s = MagicMock()
    s.get_by_engagement = AsyncMock(return_value=None)
    s.get_by_id = AsyncMock(return_value=None)
    s.create = AsyncMock()
    s.save = AsyncMock(side_effect=lambda a: a)
    s.record_gate_checks = AsyncMock()
    return s


@pytest.fixture
def session():
    s = MagicMock()
    s.get = AsyncMock()
    s.commit = AsyncMock()
    return s


@pytest.fixture
def audit_service():
    a = MagicMock()
    a.log_create = AsyncMock()
    a.log_update = AsyncMock()
    return a


@pytest.fixture
def service(store, session, audit_service):
    return AssessmentsService(store=store, session=session, audit_service=audit_service)


def make_engagement(*, signed=date(2026, 5, 1), invoiced=date(2026, 5, 2)):
    e = MagicMock()
    e.id = uuid4()
    e.engagement_letter_signed_at = signed
    e.invoice_raised_at = invoiced
    e.audit_status = "SCHEDULED"
    return e


def make_assessment(
    *,
    phase_1_started=None,
    phase_1_closed=None,
    phase_2_submitted=None,
    cancelled=None,
):
    a = MagicMock()
    a.id = uuid4()
    a.engagement_id = uuid4()
    a.phase_1_started_at = phase_1_started
    a.phase_1_closed_at = phase_1_closed
    a.phase_2_submitted_at = phase_2_submitted
    a.cancelled_at = cancelled
    return a


class TestStartAssessment:
    async def test_blocks_when_letter_unsigned(
        self, service, store, session, audit_service
    ):
        engagement = make_engagement(signed=None)
        session.get = AsyncMock(return_value=engagement)

        with pytest.raises(GateBlockedError) as exc:
            await service.start_assessment(engagement.id, actor_id=uuid4())

        assert GateName.ENGAGEMENT_LETTER_SIGNED.value in exc.value.errors
        store.create.assert_not_awaited()
        audit_service.log_create.assert_not_awaited()
        # Gate checks are still recorded for auditability.
        store.record_gate_checks.assert_awaited()

    async def test_blocks_when_invoice_not_raised(self, service, session):
        engagement = make_engagement(invoiced=None)
        session.get = AsyncMock(return_value=engagement)

        with pytest.raises(GateBlockedError) as exc:
            await service.start_assessment(engagement.id, actor_id=uuid4())

        assert GateName.INVOICE_RAISED.value in exc.value.errors

    async def test_starts_when_gates_pass(self, service, store, session, audit_service):
        engagement = make_engagement()
        session.get = AsyncMock(return_value=engagement)
        created = make_assessment(phase_1_started=datetime.now(timezone.utc))
        store.create = AsyncMock(return_value=created)

        result = await service.start_assessment(engagement.id, actor_id=uuid4())

        assert result is created
        store.create.assert_awaited_once()
        audit_service.log_create.assert_awaited_once()

    async def test_rejects_when_active_assessment_exists(self, service, store, session):
        engagement = make_engagement()
        session.get = AsyncMock(return_value=engagement)
        store.get_by_engagement = AsyncMock(
            return_value=make_assessment(phase_1_started=datetime.now(timezone.utc))
        )

        with pytest.raises(ConflictError):
            await service.start_assessment(engagement.id, actor_id=uuid4())


class TestClosePhase1:
    async def test_closes_when_in_progress(
        self, service, store, session, audit_service
    ):
        engagement = make_engagement()
        session.get = AsyncMock(return_value=engagement)
        assessment = make_assessment(phase_1_started=datetime.now(timezone.utc))
        store.get_by_id = AsyncMock(return_value=assessment)

        result = await service.close_phase_1(assessment.id, actor_id=uuid4())

        assert result.phase_1_closed_at is not None
        audit_service.log_update.assert_awaited_once()

    async def test_blocks_double_close(self, service, store):
        assessment = make_assessment(
            phase_1_started=datetime.now(timezone.utc),
            phase_1_closed=datetime.now(timezone.utc),
        )
        store.get_by_id = AsyncMock(return_value=assessment)

        with pytest.raises(ConflictError):
            await service.close_phase_1(assessment.id, actor_id=uuid4())


class TestSubmitPhase2:
    async def test_blocks_when_phase_1_open(self, service, store):
        assessment = make_assessment(phase_1_started=datetime.now(timezone.utc))
        store.get_by_id = AsyncMock(return_value=assessment)

        with pytest.raises(ConflictError):
            await service.submit_phase_2(assessment.id, actor_id=uuid4())

    async def test_submits_when_phase_1_closed(
        self, service, store, session, audit_service
    ):
        engagement = make_engagement()
        session.get = AsyncMock(return_value=engagement)
        assessment = make_assessment(
            phase_1_started=datetime.now(timezone.utc),
            phase_1_closed=datetime.now(timezone.utc),
        )
        store.get_by_id = AsyncMock(return_value=assessment)

        result = await service.submit_phase_2(assessment.id, actor_id=uuid4())

        assert result.phase_2_submitted_at is not None
        audit_service.log_update.assert_awaited_once()


class TestDerivePhase:
    def test_not_started(self, service):
        assert service.derive_phase(None) == AssessmentPhase.NOT_STARTED

    def test_phase_1_in_progress(self, service):
        a = make_assessment(phase_1_started=datetime.now(timezone.utc))
        assert service.derive_phase(a) == AssessmentPhase.PHASE_1_IN_PROGRESS

    def test_phase_1_closed(self, service):
        a = make_assessment(
            phase_1_started=datetime.now(timezone.utc),
            phase_1_closed=datetime.now(timezone.utc),
        )
        assert service.derive_phase(a) == AssessmentPhase.PHASE_1_CLOSED

    def test_phase_2_submitted(self, service):
        a = make_assessment(
            phase_1_started=datetime.now(timezone.utc),
            phase_1_closed=datetime.now(timezone.utc),
            phase_2_submitted=datetime.now(timezone.utc),
        )
        assert service.derive_phase(a) == AssessmentPhase.PHASE_2_SUBMITTED

    def test_cancelled_overrides(self, service):
        a = make_assessment(
            phase_1_started=datetime.now(timezone.utc),
            cancelled=datetime.now(timezone.utc),
        )
        assert service.derive_phase(a) == AssessmentPhase.CANCELLED
