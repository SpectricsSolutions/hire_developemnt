from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest

from assessments import gates
from assessments.gates import GateInputs
from assessments.types import GateName


@pytest.fixture
def engagement():
    e = MagicMock()
    e.engagement_letter_signed_at = None
    e.invoice_raised_at = None
    return e


@pytest.fixture
def assessment():
    a = MagicMock()
    a.phase_1_started_at = None
    a.phase_1_closed_at = None
    return a


class TestEngagementLetterGate:
    def test_passes_when_signed(self, engagement):
        engagement.engagement_letter_signed_at = date(2026, 5, 1)
        gate, passed, reason = gates.evaluate_engagement_letter(
            GateInputs(engagement=engagement, assessment=None)
        )
        assert gate == GateName.ENGAGEMENT_LETTER_SIGNED
        assert passed is True
        assert reason is None

    def test_fails_when_not_signed(self, engagement):
        gate, passed, reason = gates.evaluate_engagement_letter(
            GateInputs(engagement=engagement, assessment=None)
        )
        assert passed is False
        assert "signed" in reason.lower()


class TestInvoiceRaisedGate:
    def test_passes_when_invoice_raised(self, engagement):
        engagement.invoice_raised_at = date(2026, 5, 2)
        _, passed, reason = gates.evaluate_invoice_raised(
            GateInputs(engagement=engagement, assessment=None)
        )
        assert passed is True
        assert reason is None

    def test_fails_when_not_invoiced(self, engagement):
        _, passed, reason = gates.evaluate_invoice_raised(
            GateInputs(engagement=engagement, assessment=None)
        )
        assert passed is False
        assert "invoice" in reason.lower()


class TestPhase1ClosedGate:
    def test_passes_when_closed(self, engagement, assessment):
        assessment.phase_1_closed_at = datetime.now(timezone.utc)
        _, passed, _ = gates.evaluate_phase_1_closed(
            GateInputs(engagement=engagement, assessment=assessment)
        )
        assert passed is True

    def test_fails_when_no_assessment(self, engagement):
        _, passed, reason = gates.evaluate_phase_1_closed(
            GateInputs(engagement=engagement, assessment=None)
        )
        assert passed is False
        assert "phase 1" in reason.lower()

    def test_fails_when_phase_1_open(self, engagement, assessment):
        _, passed, _ = gates.evaluate_phase_1_closed(
            GateInputs(engagement=engagement, assessment=assessment)
        )
        assert passed is False


class TestStructuralGates:
    """Always-passing gates that record structural enforcement for auditability."""

    def test_no_rag_during_phase_1_passes(self, engagement, assessment):
        gate, passed, reason = gates.evaluate_no_rag_during_phase_1(
            GateInputs(engagement=engagement, assessment=assessment)
        )
        assert gate == GateName.NO_RAG_DURING_PHASE_1
        assert passed is True
        assert reason is None

    def test_phase_2_mandatory_fields_currently_passes(self, engagement, assessment):
        # Placeholder until findings ship in Phase C.
        _, passed, _ = gates.evaluate_phase_2_mandatory_fields(
            GateInputs(engagement=engagement, assessment=assessment)
        )
        assert passed is True


class TestRunHelper:
    def test_runs_each_evaluator_in_order(self, engagement, assessment):
        results = gates.run(
            (
                gates.evaluate_engagement_letter,
                gates.evaluate_invoice_raised,
            ),
            GateInputs(engagement=engagement, assessment=assessment),
        )
        assert [r[0] for r in results] == [
            GateName.ENGAGEMENT_LETTER_SIGNED,
            GateName.INVOICE_RAISED,
        ]
