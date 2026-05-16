"""Generate baseline calibration anchors per control.

The HIRE Partnerships source documents do not yet include per-control
calibration text for each RAG band. The seeded anchors here give operators
a credible starting point — admin refines them via the calibration editor.

THE CHECK uses 3-band RAG (Red / Amber / Green); HIRE 3D Core and Enhanced
use 5-band RAG (Red / Amber-Red / Amber / Green-Amber / Green).
"""

from __future__ import annotations

from dataclasses import dataclass

from controls.types import HIRE_3D_RAG_LEVELS, RAGLevel, THE_CHECK_RAG_LEVELS
from engagements.types import Product

from .parser import ParsedControl


@dataclass(frozen=True)
class AnchorTemplate:
    rag_level: RAGLevel
    summary: str
    severity_hint: int | None = None


_THE_CHECK_TEMPLATES: tuple[AnchorTemplate, ...] = (
    AnchorTemplate(
        RAGLevel.GREEN,
        "All required items demonstrated; documents produced on request and "
        "consistent with described practice.",
        severity_hint=4,
    ),
    AnchorTemplate(
        RAGLevel.AMBER,
        "Some required items demonstrated, but gaps consistent with the "
        "partial-evidence patterns are present.",
        severity_hint=3,
    ),
    AnchorTemplate(
        RAGLevel.RED,
        "Required items materially absent; founder cannot demonstrate "
        "compliance; one or more partial-evidence patterns clearly observed.",
        severity_hint=1,
    ),
)


_HIRE_3D_TEMPLATES: tuple[AnchorTemplate, ...] = (
    AnchorTemplate(
        RAGLevel.GREEN,
        "Full evidence: every item in 'What You Are Looking For' demonstrated, "
        "documentation comprehensive, current, and accessible without delay.",
        severity_hint=5,
    ),
    AnchorTemplate(
        RAGLevel.GREEN_AMBER,
        "Substantively compliant: all items present but with minor gaps in "
        "currency, completeness, or access control.",
        severity_hint=4,
    ),
    AnchorTemplate(
        RAGLevel.AMBER,
        "Partial compliance: one or more 'What You Are Looking For' items "
        "missing or weak; partial-evidence patterns observed; remediation needed.",
        severity_hint=3,
    ),
    AnchorTemplate(
        RAGLevel.AMBER_RED,
        "Significant gap: multiple partial-evidence patterns; key controls "
        "missing; investor or regulator would flag on inspection.",
        severity_hint=2,
    ),
    AnchorTemplate(
        RAGLevel.RED,
        "Material absence: required items not in place; founder cannot "
        "demonstrate basic compliance; immediate exposure to enforcement.",
        severity_hint=1,
    ),
)


@dataclass(frozen=True)
class SeededAnchor:
    rag_level: RAGLevel
    description: str
    severity_hint: int | None


def anchors_for(product: Product, parsed: ParsedControl) -> list[SeededAnchor]:
    templates = (
        _THE_CHECK_TEMPLATES
        if product == Product.THE_CHECK
        else _HIRE_3D_TEMPLATES
        if product in (Product.HIRE_3D_CORE, Product.HIRE_3D_ENHANCED)
        else ()
    )
    if not templates:
        return []

    # Sanity check: templates cover the expected rag levels for this product.
    expected = (
        THE_CHECK_RAG_LEVELS if product == Product.THE_CHECK else HIRE_3D_RAG_LEVELS
    )
    template_levels = {t.rag_level for t in templates}
    assert set(expected) == template_levels, (
        f"Calibration templates do not cover all RAG levels for {product}"
    )

    return [
        SeededAnchor(
            rag_level=t.rag_level,
            description=_compose_description(t, parsed),
            severity_hint=t.severity_hint,
        )
        for t in templates
    ]


def _compose_description(template: AnchorTemplate, parsed: ParsedControl) -> str:
    """Add control-specific cues to the band's generic summary."""

    cue = ""
    if template.rag_level in (RAGLevel.RED, RAGLevel.AMBER_RED, RAGLevel.AMBER):
        if parsed.if_partial:
            cue = (
                " Examples for this control: " + "; ".join(parsed.if_partial[:3]) + "."
            )
    elif template.rag_level in (RAGLevel.GREEN, RAGLevel.GREEN_AMBER):
        if parsed.looking_for:
            cue = (
                " Examples for this control: " + "; ".join(parsed.looking_for[:3]) + "."
            )
    return template.summary + cue
