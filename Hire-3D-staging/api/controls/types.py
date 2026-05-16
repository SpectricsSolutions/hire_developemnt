from __future__ import annotations

import enum
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from common.types import camel_config, read_config
from engagements.types import Product


@enum.unique
class Domain(enum.StrEnum):
    A = "A"
    B = "B"
    C = "C"


@enum.unique
class RAGLevel(enum.StrEnum):
    RED = "RED"
    AMBER_RED = "AMBER_RED"
    AMBER = "AMBER"
    GREEN_AMBER = "GREEN_AMBER"
    GREEN = "GREEN"


# 3-level RAG used by THE CHECK; HIRE 3D Core/Enhanced use the full 5-level set.
THE_CHECK_RAG_LEVELS: tuple[RAGLevel, ...] = (
    RAGLevel.RED,
    RAGLevel.AMBER,
    RAGLevel.GREEN,
)
HIRE_3D_RAG_LEVELS: tuple[RAGLevel, ...] = tuple(RAGLevel)


def rag_levels_for(product: Product) -> tuple[RAGLevel, ...]:
    if product == Product.THE_CHECK:
        return THE_CHECK_RAG_LEVELS
    if product in (Product.HIRE_3D_CORE, Product.HIRE_3D_ENHANCED):
        return HIRE_3D_RAG_LEVELS
    return ()


class CalibrationAnchorBase(BaseModel):
    model_config = camel_config

    rag_level: RAGLevel
    description: str = Field(min_length=1)
    severity_hint: int | None = Field(default=None, ge=1, le=5)


class CalibrationAnchorCreate(CalibrationAnchorBase): ...


class CalibrationAnchorUpdate(CalibrationAnchorBase): ...


class CalibrationAnchorRead(BaseModel):
    model_config = read_config

    id: UUID
    control_template_id: UUID
    rag_level: RAGLevel
    description: str
    severity_hint: int | None
    created_at: datetime
    updated_at: datetime


class ControlTemplateBase(BaseModel):
    model_config = camel_config

    product: Product
    domain: Domain | None = None
    code: str = Field(min_length=1, max_length=10)
    title: str = Field(min_length=1, max_length=255)
    what_testing: str = Field(min_length=1)
    why_matters: str = Field(min_length=1)
    primary_question: str = Field(min_length=1)
    evidence_prompts: list[str] = Field(default_factory=list)
    looking_for: list[str] = Field(default_factory=list)
    sampling: str | None = None
    if_partial: list[str] = Field(default_factory=list)
    sort_order: int = 0
    is_active: bool = True

    @field_validator("evidence_prompts", "looking_for", "if_partial")
    @classmethod
    def _strip_blank(cls, v: list[str]) -> list[str]:
        return [item.strip() for item in v if item and item.strip()]

    @model_validator(mode="after")
    def _domain_matches_product(self) -> ControlTemplateBase:
        if self.product == Product.THE_CHECK and self.domain is not None:
            raise ValueError("THE CHECK controls must not have a domain.")
        if (
            self.product in (Product.HIRE_3D_CORE, Product.HIRE_3D_ENHANCED)
            and self.domain is None
        ):
            raise ValueError("HIRE 3D controls must have a domain (A, B, or C).")
        return self


class ControlTemplateCreate(ControlTemplateBase):
    calibration_anchors: list[CalibrationAnchorCreate] = Field(default_factory=list)


class ControlTemplateUpdate(ControlTemplateBase):
    calibration_anchors: list[CalibrationAnchorCreate] | None = None


class ControlTemplateRead(BaseModel):
    model_config = read_config

    id: UUID
    product: Product
    domain: Domain | None
    code: str
    title: str
    what_testing: str
    why_matters: str
    primary_question: str
    evidence_prompts: list[str]
    looking_for: list[str]
    sampling: str | None
    if_partial: list[str]
    sort_order: int
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime
    calibration_anchors: list[CalibrationAnchorRead] = Field(default_factory=list)


class ControlTemplateMeta(BaseModel): ...
