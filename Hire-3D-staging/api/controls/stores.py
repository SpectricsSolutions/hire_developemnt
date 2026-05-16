from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from common.abstracts import Store
from common.database import get_db
from engagements.types import Product

from .models import CalibrationAnchor, ControlTemplate
from .types import (
    CalibrationAnchorCreate,
    CalibrationAnchorUpdate,
    ControlTemplateCreate,
    ControlTemplateMeta,
    ControlTemplateUpdate,
    Domain,
)


class ControlsStore(Store):
    async def list(
        self,
        *,
        product: Product | None = None,
        domain: Domain | None = None,
        active_only: bool = False,
    ) -> list[ControlTemplate]:
        stmt = select(ControlTemplate).options(
            selectinload(ControlTemplate.calibration_anchors)
        )
        if product is not None:
            stmt = stmt.where(ControlTemplate.product == product.value)
        if domain is not None:
            stmt = stmt.where(ControlTemplate.domain == domain.value)
        if active_only:
            stmt = stmt.where(ControlTemplate.is_active.is_(True))
        stmt = stmt.order_by(
            ControlTemplate.product, ControlTemplate.sort_order, ControlTemplate.code
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_id(self, template_id: UUID) -> ControlTemplate | None:
        result = await self.session.execute(
            select(ControlTemplate)
            .where(ControlTemplate.id == template_id)
            .options(selectinload(ControlTemplate.calibration_anchors))
        )
        return result.scalar_one_or_none()

    async def create_template(self, data: ControlTemplateCreate) -> ControlTemplate:
        template = ControlTemplate(
            product=data.product.value,
            domain=data.domain.value if data.domain else None,
            code=data.code,
            title=data.title,
            what_testing=data.what_testing,
            why_matters=data.why_matters,
            primary_question=data.primary_question,
            evidence_prompts=list(data.evidence_prompts),
            looking_for=list(data.looking_for),
            sampling=data.sampling,
            if_partial=list(data.if_partial),
            sort_order=data.sort_order,
            is_active=data.is_active,
            version=1,
            meta=ControlTemplateMeta().model_dump(mode="json"),
        )
        self.session.add(template)
        await self.session.flush()
        for anchor in data.calibration_anchors:
            self.session.add(
                CalibrationAnchor(
                    control_template_id=template.id,
                    rag_level=anchor.rag_level,
                    description=anchor.description,
                    severity_hint=anchor.severity_hint,
                )
            )
        await self.session.commit()
        return await self._refreshed(template.id)

    async def update_template(
        self, template: ControlTemplate, data: ControlTemplateUpdate
    ) -> ControlTemplate:
        template.product = data.product.value
        template.domain = data.domain.value if data.domain else None
        template.code = data.code
        template.title = data.title
        template.what_testing = data.what_testing
        template.why_matters = data.why_matters
        template.primary_question = data.primary_question
        template.evidence_prompts = list(data.evidence_prompts)
        template.looking_for = list(data.looking_for)
        template.sampling = data.sampling
        template.if_partial = list(data.if_partial)
        template.sort_order = data.sort_order
        template.is_active = data.is_active
        template.version = template.version + 1

        if data.calibration_anchors is not None:
            await self.session.execute(
                CalibrationAnchor.__table__.delete().where(
                    CalibrationAnchor.control_template_id == template.id
                )
            )
            for anchor in data.calibration_anchors:
                self.session.add(
                    CalibrationAnchor(
                        control_template_id=template.id,
                        rag_level=anchor.rag_level,
                        description=anchor.description,
                        severity_hint=anchor.severity_hint,
                    )
                )

        await self.session.commit()
        return await self._refreshed(template.id)

    async def delete_template(self, template: ControlTemplate) -> None:
        await self.session.delete(template)
        await self.session.commit()

    async def upsert_anchor(
        self,
        *,
        template_id: UUID,
        rag_level: str,
        data: CalibrationAnchorUpdate | CalibrationAnchorCreate,
    ) -> CalibrationAnchor:
        result = await self.session.execute(
            select(CalibrationAnchor).where(
                CalibrationAnchor.control_template_id == template_id,
                CalibrationAnchor.rag_level == rag_level,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = CalibrationAnchor(
                control_template_id=template_id,
                rag_level=data.rag_level,
                description=data.description,
                severity_hint=data.severity_hint,
            )
            self.session.add(row)
        else:
            row.description = data.description
            row.severity_hint = data.severity_hint
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def delete_anchor(self, anchor: CalibrationAnchor) -> None:
        await self.session.delete(anchor)
        await self.session.commit()

    async def get_anchor(self, anchor_id: UUID) -> CalibrationAnchor | None:
        result = await self.session.execute(
            select(CalibrationAnchor).where(CalibrationAnchor.id == anchor_id)
        )
        return result.scalar_one_or_none()

    async def _refreshed(self, template_id: UUID) -> ControlTemplate:
        result = await self.session.execute(
            select(ControlTemplate)
            .where(ControlTemplate.id == template_id)
            .options(selectinload(ControlTemplate.calibration_anchors))
        )
        return result.scalar_one()


async def get_controls_store(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ControlsStore:
    return ControlsStore(session=session)
