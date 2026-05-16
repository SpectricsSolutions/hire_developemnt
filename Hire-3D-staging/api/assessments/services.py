from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from audits.services import AuditService, get_audit_service
from audits.types import ResourceRef
from common.database import get_db
from common.datetime import get_utc_now
from common.exceptions import ConflictError, GateBlockedError, NotFoundError
from engagements.models import Engagement
from engagements.types import AuditStatus

from . import gates
from .gates import GateInputs
from .models import Assessment
from .stores import AssessmentsStore, get_assessments_store
from .types import (
    AssessmentPhase,
    GateCheckRead,
    GateName,
    GateReport,
    GateStatus,
)


class AssessmentsService:
    def __init__(
        self,
        store: AssessmentsStore,
        session: AsyncSession,
        audit_service: AuditService,
    ) -> None:
        self.store = store
        self.session = session
        self.audit_service = audit_service

    async def get_engagement(self, engagement_id: UUID) -> Engagement:
        engagement = await self.session.get(Engagement, engagement_id)
        if engagement is None:
            raise NotFoundError
        return engagement

    async def get_for_engagement(self, engagement_id: UUID) -> Assessment | None:
        return await self.store.get_by_engagement(engagement_id)

    async def get_by_id(self, assessment_id: UUID) -> Assessment:
        assessment = await self.store.get_by_id(assessment_id)
        if assessment is None:
            raise NotFoundError
        return assessment

    async def list_gate_checks(self, engagement_id: UUID) -> list[GateCheckRead]:
        rows = await self.store.list_gate_checks(engagement_id=engagement_id)
        return [GateCheckRead.model_validate(r) for r in rows]

    async def gate_report(self, engagement_id: UUID) -> GateReport:
        engagement = await self.get_engagement(engagement_id)
        assessment = await self.store.get_by_engagement(engagement_id)
        inputs = GateInputs(engagement=engagement, assessment=assessment)

        evaluators = (
            gates.evaluate_engagement_letter,
            gates.evaluate_invoice_raised,
            gates.evaluate_no_rag_during_phase_1,
            gates.evaluate_phase_1_closed,
            gates.evaluate_phase_2_mandatory_fields,
        )
        results = [fn(inputs) for fn in evaluators]
        return GateReport(
            engagement_id=engagement_id,
            assessment_id=assessment.id if assessment else None,
            gates=[GateStatus(gate=g, passed=p, reason=r) for (g, p, r) in results],
        )

    async def start_assessment(
        self, engagement_id: UUID, *, actor_id: UUID
    ) -> Assessment:
        engagement = await self.get_engagement(engagement_id)
        existing = await self.store.get_by_engagement(engagement_id)
        if existing is not None and existing.cancelled_at is None:
            raise ConflictError(
                "An assessment is already in progress for this engagement."
            )

        results = gates.run(
            gates.START_GATES, GateInputs(engagement=engagement, assessment=None)
        )
        await self.store.record_gate_checks(
            engagement_id=engagement_id,
            assessment_id=None,
            actor_id=actor_id,
            results=results,
        )
        self._raise_if_blocked(results, "Cannot start assessment: hard gates failed.")

        assessment = await self.store.create(
            engagement_id=engagement_id, started_by_id=actor_id
        )
        await self._sync_engagement_status(engagement, AuditStatus.SCHEDULED)

        await self.audit_service.log_create(
            ResourceRef(type="assessment", id=assessment.id),
            after={
                "engagement_id": str(engagement_id),
                "phase_1_started_at": assessment.phase_1_started_at.isoformat(),
            },
        )
        return assessment

    async def close_phase_1(self, assessment_id: UUID, *, actor_id: UUID) -> Assessment:
        assessment = await self.get_by_id(assessment_id)
        if assessment.cancelled_at is not None:
            raise ConflictError("Assessment has been cancelled.")
        if assessment.phase_1_started_at is None:
            raise ConflictError("Phase 1 has not been started.")
        if assessment.phase_1_closed_at is not None:
            raise ConflictError("Phase 1 is already closed.")

        engagement = await self.get_engagement(assessment.engagement_id)
        results = gates.run(
            gates.CLOSE_PHASE_1_GATES,
            GateInputs(engagement=engagement, assessment=assessment),
        )
        await self.store.record_gate_checks(
            engagement_id=assessment.engagement_id,
            assessment_id=assessment.id,
            actor_id=actor_id,
            results=results,
        )
        self._raise_if_blocked(results, "Cannot close Phase 1: hard gates failed.")

        before = {"phase_1_closed_at": None}
        assessment.phase_1_closed_at = get_utc_now()
        assessment.phase_1_closed_by_id = actor_id
        await self.store.save(assessment)
        await self._sync_engagement_status(engagement, AuditStatus.PHASE_1_COMPLETE)

        await self.audit_service.log_update(
            ResourceRef(type="assessment", id=assessment.id),
            before=before,
            after={"phase_1_closed_at": assessment.phase_1_closed_at.isoformat()},
        )
        return assessment

    async def submit_phase_2(
        self, assessment_id: UUID, *, actor_id: UUID
    ) -> Assessment:
        assessment = await self.get_by_id(assessment_id)
        if assessment.cancelled_at is not None:
            raise ConflictError("Assessment has been cancelled.")
        if assessment.phase_1_closed_at is None:
            raise ConflictError(
                "Phase 1 must be closed before Phase 2 can be submitted."
            )
        if assessment.phase_2_submitted_at is not None:
            raise ConflictError("Phase 2 has already been submitted.")

        engagement = await self.get_engagement(assessment.engagement_id)
        results = gates.run(
            gates.SUBMIT_PHASE_2_GATES,
            GateInputs(engagement=engagement, assessment=assessment),
        )
        await self.store.record_gate_checks(
            engagement_id=assessment.engagement_id,
            assessment_id=assessment.id,
            actor_id=actor_id,
            results=results,
        )
        self._raise_if_blocked(results, "Cannot submit Phase 2: hard gates failed.")

        before = {"phase_2_submitted_at": None}
        assessment.phase_2_submitted_at = get_utc_now()
        assessment.phase_2_submitted_by_id = actor_id
        await self.store.save(assessment)
        await self._sync_engagement_status(engagement, AuditStatus.PHASE_2_COMPLETE)

        await self.audit_service.log_update(
            ResourceRef(type="assessment", id=assessment.id),
            before=before,
            after={"phase_2_submitted_at": assessment.phase_2_submitted_at.isoformat()},
        )
        return assessment

    async def cancel(self, assessment_id: UUID, *, actor_id: UUID) -> Assessment:
        assessment = await self.get_by_id(assessment_id)
        if assessment.cancelled_at is not None:
            raise ConflictError("Assessment is already cancelled.")
        if assessment.phase_2_submitted_at is not None:
            raise ConflictError("Cannot cancel a submitted assessment.")

        before = {"cancelled_at": None}
        assessment.cancelled_at = get_utc_now()
        await self.store.save(assessment)

        await self.audit_service.log_update(
            ResourceRef(type="assessment", id=assessment.id),
            before=before,
            after={"cancelled_at": assessment.cancelled_at.isoformat()},
        )
        return assessment

    @staticmethod
    def derive_phase(assessment: Assessment | None) -> AssessmentPhase:
        if assessment is None:
            return AssessmentPhase.NOT_STARTED
        if assessment.cancelled_at is not None:
            return AssessmentPhase.CANCELLED
        if assessment.phase_2_submitted_at is not None:
            return AssessmentPhase.PHASE_2_SUBMITTED
        if assessment.phase_1_closed_at is not None:
            return AssessmentPhase.PHASE_1_CLOSED
        if assessment.phase_1_started_at is not None:
            return AssessmentPhase.PHASE_1_IN_PROGRESS
        return AssessmentPhase.NOT_STARTED

    def _raise_if_blocked(
        self, results: list[tuple[GateName, bool, str | None]], message: str
    ) -> None:
        failed = {
            gate.value: reason for (gate, passed, reason) in results if not passed
        }
        if failed:
            raise GateBlockedError(message, errors=failed)

    async def _sync_engagement_status(
        self, engagement: Engagement, status: AuditStatus
    ) -> None:
        if engagement.audit_status == status:
            return
        engagement.audit_status = status
        await self.session.commit()


async def get_assessments_service(
    store: Annotated[AssessmentsStore, Depends(get_assessments_store)],
    session: Annotated[AsyncSession, Depends(get_db)],
    audit_service: Annotated[AuditService, Depends(get_audit_service)],
) -> AssessmentsService:
    return AssessmentsService(store=store, session=session, audit_service=audit_service)
