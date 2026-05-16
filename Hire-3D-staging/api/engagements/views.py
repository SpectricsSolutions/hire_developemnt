from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from auth.dependencies import require_permission
from common.types import NoDataResponse, Response
from users.models import User

from .services import EngagementsService, get_engagements_service
from .types import (
    EngagementCreate,
    EngagementRead,
    EngagementUpdate,
    EngagementViewer,
)

router = APIRouter(
    prefix="/api/v1/clients/{client_id}/engagements", tags=["Engagements"]
)


def get_viewer(
    current_user: Annotated[User, Depends(require_permission("engagements:read"))],
) -> EngagementViewer:
    return EngagementViewer(
        actor_id=current_user.id,
        can_read_fees="engagements:read_fees" in current_user.permissions,
    )


@router.post(
    "",
    operation_id="createEngagement",
    status_code=201,
)
async def create_engagement(
    client_id: UUID,
    body: EngagementCreate,
    _: Annotated[User, Depends(require_permission("engagements:create"))],
    viewer: Annotated[EngagementViewer, Depends(get_viewer)],
    service: Annotated[EngagementsService, Depends(get_engagements_service)],
) -> Response[EngagementRead]:
    engagement = await service.create_engagement(client_id, body)
    return Response(
        data=viewer.redact(EngagementRead.model_validate(engagement)),
        message="Engagement created successfully.",
    )


@router.get("", operation_id="listEngagements")
async def list_engagements(
    client_id: UUID,
    viewer: Annotated[EngagementViewer, Depends(get_viewer)],
    service: Annotated[EngagementsService, Depends(get_engagements_service)],
) -> Response[list[EngagementRead]]:
    engagements = await service.list_engagements(client_id)
    return Response(
        data=[viewer.redact(EngagementRead.model_validate(e)) for e in engagements]
    )


@router.get(
    "/{engagement_id}",
    operation_id="getEngagement",
)
async def get_engagement(
    client_id: UUID,
    engagement_id: UUID,
    viewer: Annotated[EngagementViewer, Depends(get_viewer)],
    service: Annotated[EngagementsService, Depends(get_engagements_service)],
) -> Response[EngagementRead]:
    engagement = await service.get_engagement(client_id, engagement_id)
    return Response(data=viewer.redact(EngagementRead.model_validate(engagement)))


@router.put(
    "/{engagement_id}",
    operation_id="updateEngagement",
)
async def update_engagement(
    client_id: UUID,
    engagement_id: UUID,
    body: EngagementUpdate,
    _: Annotated[User, Depends(require_permission("engagements:update"))],
    viewer: Annotated[EngagementViewer, Depends(get_viewer)],
    service: Annotated[EngagementsService, Depends(get_engagements_service)],
) -> Response[EngagementRead]:
    engagement = await service.update_engagement(client_id, engagement_id, body)
    return Response(
        data=viewer.redact(EngagementRead.model_validate(engagement)),
        message="Engagement updated successfully.",
    )


@router.delete("/{engagement_id}", operation_id="deleteEngagement")
async def delete_engagement(
    client_id: UUID,
    engagement_id: UUID,
    _: Annotated[User, Depends(require_permission("engagements:delete"))],
    service: Annotated[EngagementsService, Depends(get_engagements_service)],
) -> NoDataResponse:
    await service.delete_engagement(client_id, engagement_id)
    return NoDataResponse(message="Engagement deleted successfully.")
