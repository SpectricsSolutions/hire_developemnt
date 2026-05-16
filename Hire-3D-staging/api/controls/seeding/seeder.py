"""Idempotent seeder for control templates and calibration anchors.

Reads the HIRE Partnerships source markdown bundled at
``api/controls/seeding/sources/`` and upserts ``control_templates`` and
``calibration_anchors`` rows. Safe to run multiple times — existing rows are
updated to match the source while admin-set fields (``is_active``, ``version``)
are preserved.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from controls.models import CalibrationAnchor, ControlTemplate
from controls.types import ControlTemplateMeta
from engagements.types import Product

from .calibration import anchors_for
from .parser import ParsedControl, parse_markdown

SOURCES_DIR = Path(__file__).parent / "sources"

PRODUCT_SOURCES: tuple[tuple[Product, str], ...] = (
    (Product.THE_CHECK, "the_check.md"),
    (Product.HIRE_3D_CORE, "hire_3d_core.md"),
    (Product.HIRE_3D_ENHANCED, "hire_3d_enhanced.md"),
)


def _load_parsed(product: Product) -> list[ParsedControl]:
    filename = dict(PRODUCT_SOURCES)[product]
    return parse_markdown(SOURCES_DIR / filename)


def seed_controls(session: Session) -> None:
    for product, _ in PRODUCT_SOURCES:
        parsed_list = _load_parsed(product)
        existing = {
            t.code: t
            for t in session.execute(
                select(ControlTemplate).where(ControlTemplate.product == product.value)
            )
            .scalars()
            .all()
        }

        for sort_order, parsed in enumerate(parsed_list, start=1):
            template = existing.get(parsed.code)
            if template is None:
                template = ControlTemplate(
                    product=product.value,
                    domain=parsed.domain,
                    code=parsed.code,
                    title=parsed.title,
                    what_testing=parsed.what_testing,
                    why_matters=parsed.why_matters,
                    primary_question=parsed.primary_question,
                    evidence_prompts=parsed.evidence_prompts,
                    looking_for=parsed.looking_for,
                    sampling=parsed.sampling,
                    if_partial=parsed.if_partial,
                    sort_order=sort_order,
                    is_active=True,
                    version=1,
                    meta=ControlTemplateMeta().model_dump(mode="json"),
                )
                session.add(template)
                session.flush()
            else:
                template.title = parsed.title
                template.domain = parsed.domain
                template.what_testing = parsed.what_testing
                template.why_matters = parsed.why_matters
                template.primary_question = parsed.primary_question
                template.evidence_prompts = parsed.evidence_prompts
                template.looking_for = parsed.looking_for
                template.sampling = parsed.sampling
                template.if_partial = parsed.if_partial
                template.sort_order = sort_order
                session.flush()

            _sync_anchors(session, template, parsed, product)

    session.commit()


def _sync_anchors(
    session: Session,
    template: ControlTemplate,
    parsed: ParsedControl,
    product: Product,
) -> None:
    seeded = anchors_for(product, parsed)
    existing = {
        a.rag_level: a
        for a in session.execute(
            select(CalibrationAnchor).where(
                CalibrationAnchor.control_template_id == template.id
            )
        )
        .scalars()
        .all()
    }

    for anchor in seeded:
        row = existing.get(anchor.rag_level)
        if row is None:
            session.add(
                CalibrationAnchor(
                    control_template_id=template.id,
                    rag_level=anchor.rag_level,
                    description=anchor.description,
                    severity_hint=anchor.severity_hint,
                )
            )
        elif row.description == "" or row.description is None:
            # Don't clobber admin-edited descriptions.
            row.description = anchor.description
            if row.severity_hint is None:
                row.severity_hint = anchor.severity_hint
    session.flush()
