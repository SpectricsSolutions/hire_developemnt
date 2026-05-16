from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from auth.dependencies import require_permission
from common.types import NoDataResponse, Response
from engagements.types import Product
from users.models import User

from .services import ControlsService, get_controls_service
from .types import (
    CalibrationAnchorCreate,
    CalibrationAnchorRead,
    CalibrationAnchorUpdate,
    ControlTemplateCreate,
    ControlTemplateRead,
    ControlTemplateUpdate,
    Domain,
)

router = APIRouter(prefix="/api/v1", tags=["Controls"])


# ---- Control templates ----


@router.get("/control-templates", operation_id="listControlTemplates")
async def list_control_templates(
    _: Annotated[User, Depends(require_permission("controls:read"))],
    service: Annotated[ControlsService, Depends(get_controls_service)],
    product: Annotated[Product | None, Query()] = None,
    domain: Annotated[Domain | None, Query()] = None,
    active_only: Annotated[bool, Query(alias="activeOnly")] = False,
) -> Response[list[ControlTemplateRead]]:
    templates = await service.list_templates(
        product=product, domain=domain, active_only=active_only
    )
    return Response(data=[ControlTemplateRead.model_validate(t) for t in templates])


@router.get(
    "/control-templates/{template_id}",
    operation_id="getControlTemplate",
)
async def get_control_template(
    template_id: UUID,
    _: Annotated[User, Depends(require_permission("controls:read"))],
    service: Annotated[ControlsService, Depends(get_controls_service)],
) -> Response[ControlTemplateRead]:
    template = await service.get_template(template_id)
    return Response(data=ControlTemplateRead.model_validate(template))


@router.post(
    "/control-templates",
    operation_id="createControlTemplate",
    status_code=201,
)
async def create_control_template(
    body: ControlTemplateCreate,
    _: Annotated[User, Depends(require_permission("controls:manage"))],
    service: Annotated[ControlsService, Depends(get_controls_service)],
) -> Response[ControlTemplateRead]:
    template = await service.create_template(body)
    return Response(
        data=ControlTemplateRead.model_validate(template),
        message="Control template created successfully.",
    )


@router.put(
    "/control-templates/{template_id}",
    operation_id="updateControlTemplate",
)
async def update_control_template(
    template_id: UUID,
    body: ControlTemplateUpdate,
    _: Annotated[User, Depends(require_permission("controls:manage"))],
    service: Annotated[ControlsService, Depends(get_controls_service)],
) -> Response[ControlTemplateRead]:
    template = await service.update_template(template_id, body)
    return Response(
        data=ControlTemplateRead.model_validate(template),
        message="Control template updated successfully.",
    )


@router.delete(
    "/control-templates/{template_id}",
    operation_id="deleteControlTemplate",
)
async def delete_control_template(
    template_id: UUID,
    _: Annotated[User, Depends(require_permission("controls:manage"))],
    service: Annotated[ControlsService, Depends(get_controls_service)],
) -> NoDataResponse:
    await service.delete_template(template_id)
    return NoDataResponse(message="Control template deleted successfully.")


# ---- Calibration anchors ----


@router.put(
    "/control-templates/{template_id}/calibration-anchors",
    operation_id="upsertCalibrationAnchor",
)
async def upsert_calibration_anchor(
    template_id: UUID,
    body: CalibrationAnchorCreate,
    _: Annotated[User, Depends(require_permission("controls:manage"))],
    service: Annotated[ControlsService, Depends(get_controls_service)],
) -> Response[CalibrationAnchorRead]:
    anchor = await service.upsert_anchor(template_id, body)
    return Response(
        data=CalibrationAnchorRead.model_validate(anchor),
        message="Calibration anchor saved.",
    )


@router.put(
    "/calibration-anchors/{anchor_id}",
    operation_id="updateCalibrationAnchor",
)
async def update_calibration_anchor(
    anchor_id: UUID,
    body: CalibrationAnchorUpdate,
    _: Annotated[User, Depends(require_permission("controls:manage"))],
    service: Annotated[ControlsService, Depends(get_controls_service)],
) -> Response[CalibrationAnchorRead]:
    anchor = await service.update_anchor(anchor_id, body)
    return Response(
        data=CalibrationAnchorRead.model_validate(anchor),
        message="Calibration anchor updated.",
    )


@router.delete(
    "/calibration-anchors/{anchor_id}",
    operation_id="deleteCalibrationAnchor",
)
async def delete_calibration_anchor(
    anchor_id: UUID,
    _: Annotated[User, Depends(require_permission("controls:manage"))],
    service: Annotated[ControlsService, Depends(get_controls_service)],
) -> NoDataResponse:
    await service.delete_anchor(anchor_id)
    return NoDataResponse(message="Calibration anchor deleted.")
