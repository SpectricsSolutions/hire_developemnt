from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from auth.dependencies import require_permission
from common.types import Response
from users.models import User

from .services import AssessmentsService, get_assessments_service
from .types import (
    AssessmentRead,
    GateCheckRead,
    GateReport,
)

router = APIRouter(prefix="/api/v1", tags=["Assessments"])


def _to_read(service: AssessmentsService, assessment) -> AssessmentRead:
    payload = AssessmentRead.model_validate(assessment).model_copy(
        update={"phase": service.derive_phase(assessment)}
    )
    return payload


# ---- Engagement-scoped endpoints ----


@router.get(
    "/engagements/{engagement_id}/gates",
    operation_id="getEngagementGates",
)
async def get_engagement_gates(
    engagement_id: UUID,
    _: Annotated[User, Depends(require_permission("assessments:read"))],
    service: Annotated[AssessmentsService, Depends(get_assessments_service)],
) -> Response[GateReport]:
    report = await service.gate_report(engagement_id)
    return Response(data=report)


@router.get(
    "/engagements/{engagement_id}/assessment",
    operation_id="getEngagementAssessment",
)
async def get_engagement_assessment(
    engagement_id: UUID,
    _: Annotated[User, Depends(require_permission("assessments:read"))],
    service: Annotated[AssessmentsService, Depends(get_assessments_service)],
) -> Response[AssessmentRead | None]:
    assessment = await service.get_for_engagement(engagement_id)
    if assessment is None:
        return Response(
            data=None,
            message="No assessment has been started for this engagement.",
        )
    return Response(data=_to_read(service, assessment))


@router.post(
    "/engagements/{engagement_id}/assessment/start",
    operation_id="startAssessment",
    status_code=201,
)
async def start_assessment(
    engagement_id: UUID,
    current_user: Annotated[User, Depends(require_permission("assessments:start"))],
    service: Annotated[AssessmentsService, Depends(get_assessments_service)],
) -> Response[AssessmentRead]:
    assessment = await service.start_assessment(engagement_id, actor_id=current_user.id)
    return Response(
        data=_to_read(service, assessment),
        message="Phase 1 started.",
    )


# ---- Assessment-scoped endpoints ----


@router.post(
    "/assessments/{assessment_id}/close-phase-1",
    operation_id="closeAssessmentPhase1",
)
async def close_phase_1(
    assessment_id: UUID,
    current_user: Annotated[
        User, Depends(require_permission("assessments:close_phase_1"))
    ],
    service: Annotated[AssessmentsService, Depends(get_assessments_service)],
) -> Response[AssessmentRead]:
    assessment = await service.close_phase_1(assessment_id, actor_id=current_user.id)
    return Response(
        data=_to_read(service, assessment),
        message="Phase 1 closed. Phase 2 is now available.",
    )


@router.post(
    "/assessments/{assessment_id}/submit-phase-2",
    operation_id="submitAssessmentPhase2",
)
async def submit_phase_2(
    assessment_id: UUID,
    current_user: Annotated[
        User, Depends(require_permission("assessments:submit_phase_2"))
    ],
    service: Annotated[AssessmentsService, Depends(get_assessments_service)],
) -> Response[AssessmentRead]:
    assessment = await service.submit_phase_2(assessment_id, actor_id=current_user.id)
    return Response(
        data=_to_read(service, assessment),
        message="Phase 2 submitted.",
    )


@router.post(
    "/assessments/{assessment_id}/cancel",
    operation_id="cancelAssessment",
)
async def cancel_assessment(
    assessment_id: UUID,
    current_user: Annotated[User, Depends(require_permission("assessments:cancel"))],
    service: Annotated[AssessmentsService, Depends(get_assessments_service)],
) -> Response[AssessmentRead]:
    assessment = await service.cancel(assessment_id, actor_id=current_user.id)
    return Response(
        data=_to_read(service, assessment),
        message="Assessment cancelled.",
    )


@router.get(
    "/engagements/{engagement_id}/gate-checks",
    operation_id="listGateChecks",
)
async def list_gate_checks(
    engagement_id: UUID,
    _: Annotated[User, Depends(require_permission("assessments:read"))],
    service: Annotated[AssessmentsService, Depends(get_assessments_service)],
) -> Response[list[GateCheckRead]]:
    rows = await service.list_gate_checks(engagement_id)
    return Response(data=rows)
