from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.exc import IntegrityError

from audits.services import AuditService, get_audit_service
from audits.types import ResourceRef
from common.exceptions import ConflictError, NotFoundError
from engagements.types import Product

from .models import CalibrationAnchor, ControlTemplate
from .stores import ControlsStore, get_controls_store
from .types import (
    CalibrationAnchorCreate,
    CalibrationAnchorUpdate,
    ControlTemplateCreate,
    ControlTemplateUpdate,
    Domain,
)


class ControlsService:
    def __init__(self, store: ControlsStore, audit_service: AuditService) -> None:
        self.store = store
        self.audit_service = audit_service

    async def list_templates(
        self,
        *,
        product: Product | None = None,
        domain: Domain | None = None,
        active_only: bool = False,
    ) -> list[ControlTemplate]:
        return await self.store.list(
            product=product, domain=domain, active_only=active_only
        )

    async def get_template(self, template_id: UUID) -> ControlTemplate:
        template = await self.store.get_by_id(template_id)
        if template is None:
            raise NotFoundError
        return template

    async def create_template(self, data: ControlTemplateCreate) -> ControlTemplate:
        try:
            template = await self.store.create_template(data)
        except IntegrityError as exc:
            raise ConflictError(
                f"A control with code '{data.code}' already exists for {data.product.value}."
            ) from exc

        await self.audit_service.log_create(
            ResourceRef(type="control_template", id=template.id),
            after=data.model_dump(mode="json"),
        )
        return template

    async def update_template(
        self, template_id: UUID, data: ControlTemplateUpdate
    ) -> ControlTemplate:
        template = await self.get_template(template_id)
        before = _template_snapshot(template)
        try:
            updated = await self.store.update_template(template, data)
        except IntegrityError as exc:
            raise ConflictError(
                f"A control with code '{data.code}' already exists for {data.product.value}."
            ) from exc

        await self.audit_service.log_update(
            ResourceRef(type="control_template", id=template_id),
            before=before,
            after=data.model_dump(mode="json"),
        )
        return updated

    async def delete_template(self, template_id: UUID) -> None:
        template = await self.get_template(template_id)
        before = _template_snapshot(template)
        try:
            await self.store.delete_template(template)
        except IntegrityError as exc:
            raise ConflictError(
                "Cannot delete a control template referenced by existing assessments."
            ) from exc
        await self.audit_service.log_delete(
            ResourceRef(type="control_template", id=template_id),
            before=before,
        )

    async def upsert_anchor(
        self,
        template_id: UUID,
        data: CalibrationAnchorCreate,
    ) -> CalibrationAnchor:
        template = await self.get_template(template_id)
        anchor = await self.store.upsert_anchor(
            template_id=template.id,
            rag_level=data.rag_level.value,
            data=data,
        )
        await self.audit_service.log_update(
            ResourceRef(type="calibration_anchor", id=anchor.id),
            before={"control_template_id": str(template.id)},
            after=data.model_dump(mode="json"),
        )
        return anchor

    async def update_anchor(
        self,
        anchor_id: UUID,
        data: CalibrationAnchorUpdate,
    ) -> CalibrationAnchor:
        anchor = await self.store.get_anchor(anchor_id)
        if anchor is None:
            raise NotFoundError
        before = {
            "rag_level": anchor.rag_level,
            "description": anchor.description,
            "severity_hint": anchor.severity_hint,
        }
        anchor = await self.store.upsert_anchor(
            template_id=anchor.control_template_id,
            rag_level=data.rag_level.value,
            data=data,
        )
        await self.audit_service.log_update(
            ResourceRef(type="calibration_anchor", id=anchor.id),
            before=before,
            after=data.model_dump(mode="json"),
        )
        return anchor

    async def delete_anchor(self, anchor_id: UUID) -> None:
        anchor = await self.store.get_anchor(anchor_id)
        if anchor is None:
            raise NotFoundError
        before = {
            "control_template_id": str(anchor.control_template_id),
            "rag_level": anchor.rag_level,
            "description": anchor.description,
            "severity_hint": anchor.severity_hint,
        }
        await self.store.delete_anchor(anchor)
        await self.audit_service.log_delete(
            ResourceRef(type="calibration_anchor", id=anchor_id),
            before=before,
        )


def _template_snapshot(template: ControlTemplate) -> dict:
    return {
        "product": template.product,
        "domain": template.domain,
        "code": template.code,
        "title": template.title,
        "what_testing": template.what_testing,
        "why_matters": template.why_matters,
        "primary_question": template.primary_question,
        "evidence_prompts": template.evidence_prompts,
        "looking_for": template.looking_for,
        "sampling": template.sampling,
        "if_partial": template.if_partial,
        "sort_order": template.sort_order,
        "is_active": template.is_active,
        "version": template.version,
    }


async def get_controls_service(
    store: Annotated[ControlsStore, Depends(get_controls_store)],
    audit_service: Annotated[AuditService, Depends(get_audit_service)],
) -> ControlsService:
    return ControlsService(store=store, audit_service=audit_service)
