from __future__ import annotations

import enum
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from common.types import camel_config, read_config


@enum.unique
class AssessmentPhase(enum.StrEnum):
    NOT_STARTED = "NOT_STARTED"
    PHASE_1_IN_PROGRESS = "PHASE_1_IN_PROGRESS"
    PHASE_1_CLOSED = "PHASE_1_CLOSED"
    PHASE_2_SUBMITTED = "PHASE_2_SUBMITTED"
    CANCELLED = "CANCELLED"


@enum.unique
class GateName(enum.StrEnum):
    """The seven hard gates from PRODUCT_SPEC §Hard Gates."""

    ENGAGEMENT_LETTER_SIGNED = "ENGAGEMENT_LETTER_SIGNED"
    INVOICE_RAISED = "INVOICE_RAISED"
    NO_RAG_DURING_PHASE_1 = "NO_RAG_DURING_PHASE_1"
    PHASE_1_CLOSED = "PHASE_1_CLOSED"
    PHASE_2_MANDATORY_FIELDS_COMPLETE = "PHASE_2_MANDATORY_FIELDS_COMPLETE"
    QA_SIGN_OFF = "QA_SIGN_OFF"
    ADMIN_REPORT_REVIEW = "ADMIN_REPORT_REVIEW"


class AssessmentRead(BaseModel):
    model_config = read_config

    id: UUID
    engagement_id: UUID
    phase: AssessmentPhase = AssessmentPhase.NOT_STARTED
    phase_1_started_at: datetime | None
    phase_1_started_by_id: UUID | None
    phase_1_closed_at: datetime | None
    phase_1_closed_by_id: UUID | None
    phase_2_submitted_at: datetime | None
    phase_2_submitted_by_id: UUID | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime


class GateStatus(BaseModel):
    model_config = camel_config

    gate: GateName
    passed: bool
    reason: str | None = None


class GateReport(BaseModel):
    model_config = camel_config

    engagement_id: UUID
    assessment_id: UUID | None
    gates: list[GateStatus]

    @property
    def all_passed(self) -> bool:
        return all(g.passed for g in self.gates)


class GateCheckRead(BaseModel):
    model_config = read_config

    id: UUID
    assessment_id: UUID | None
    engagement_id: UUID
    gate: GateName
    passed: bool
    reason: str | None
    checked_at: datetime
    actor_id: UUID | None
