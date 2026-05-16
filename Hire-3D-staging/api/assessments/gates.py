"""Pure-function gate evaluation.

Each evaluator returns ``(passed, reason)`` where ``reason`` is ``None`` on
pass and a human-readable explanation on fail. Callers persist the results
via ``AssessmentsStore.record_gate_checks``.
"""

from __future__ import annotations

from dataclasses import dataclass

from engagements.models import Engagement

from .models import Assessment
from .types import GateName

GateResult = tuple[GateName, bool, str | None]


@dataclass(frozen=True)
class GateInputs:
    engagement: Engagement
    assessment: Assessment | None


def evaluate_engagement_letter(inputs: GateInputs) -> GateResult:
    if inputs.engagement.engagement_letter_signed_at is None:
        return (
            GateName.ENGAGEMENT_LETTER_SIGNED,
            False,
            "Engagement letter not yet recorded as signed.",
        )
    return (GateName.ENGAGEMENT_LETTER_SIGNED, True, None)


def evaluate_invoice_raised(inputs: GateInputs) -> GateResult:
    if inputs.engagement.invoice_raised_at is None:
        return (
            GateName.INVOICE_RAISED,
            False,
            "Invoice has not been raised against this engagement.",
        )
    return (GateName.INVOICE_RAISED, True, None)


def evaluate_no_rag_during_phase_1(inputs: GateInputs) -> GateResult:
    """Structural enforcement: API has no Phase-1 endpoints that accept RAG.

    Always passes; recorded for auditability.
    """
    return (GateName.NO_RAG_DURING_PHASE_1, True, None)


def evaluate_phase_1_closed(inputs: GateInputs) -> GateResult:
    if inputs.assessment is None or inputs.assessment.phase_1_closed_at is None:
        return (
            GateName.PHASE_1_CLOSED,
            False,
            "Phase 1 must be actively closed before Phase 2 can be opened.",
        )
    return (GateName.PHASE_1_CLOSED, True, None)


def evaluate_phase_2_mandatory_fields(inputs: GateInputs) -> GateResult:
    """Placeholder: requires the Findings Log built in Phase C.

    Until findings exist, this gate cannot be enforced. We return True so
    that submissions are not blocked here pre-Phase-C; the dedicated Phase-2
    submit endpoint will be wired to a real check once findings ship.
    """
    return (
        GateName.PHASE_2_MANDATORY_FIELDS_COMPLETE,
        True,
        None,
    )


# Gates evaluated for each transition.
START_GATES = (evaluate_engagement_letter, evaluate_invoice_raised)
CLOSE_PHASE_1_GATES = (evaluate_no_rag_during_phase_1,)
SUBMIT_PHASE_2_GATES = (
    evaluate_phase_1_closed,
    evaluate_phase_2_mandatory_fields,
)


def run(evaluators: tuple, inputs: GateInputs) -> list[GateResult]:
    return [fn(inputs) for fn in evaluators]
