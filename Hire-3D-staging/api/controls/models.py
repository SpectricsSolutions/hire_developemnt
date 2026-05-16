from __future__ import annotations

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from common.database import Base
from common.mixins import IdentityMixin, MetadataMixin, TimestampMixin

from .types import ControlTemplateMeta, Domain, RAGLevel


class ControlTemplate(
    IdentityMixin,
    TimestampMixin,
    MetadataMixin[ControlTemplateMeta],
    Base,
):
    __tablename__ = "control_templates"
    __table_args__ = (
        UniqueConstraint("product", "code", name="uq_control_templates_product_code"),
        CheckConstraint(
            "(product = 'THE_CHECK' AND domain IS NULL) "
            "OR (product IN ('HIRE_3D_CORE', 'HIRE_3D_ENHANCED') AND domain IS NOT NULL) "
            "OR (product = 'HIRE_READY')",
            name="ck_control_templates_domain_matches_product",
        ),
    )

    product: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    domain: Mapped[Domain | None] = mapped_column(String(1), nullable=True)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    what_testing: Mapped[str] = mapped_column(Text, nullable=False)
    why_matters: Mapped[str] = mapped_column(Text, nullable=False)
    primary_question: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_prompts: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    looking_for: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    sampling: Mapped[str | None] = mapped_column(Text, nullable=True)
    if_partial: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    calibration_anchors: Mapped[list["CalibrationAnchor"]] = relationship(
        "CalibrationAnchor",
        back_populates="control_template",
        cascade="all, delete-orphan",
        order_by="CalibrationAnchor.rag_level",
    )


class CalibrationAnchor(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "calibration_anchors"
    __table_args__ = (
        UniqueConstraint(
            "control_template_id",
            "rag_level",
            name="uq_calibration_anchors_template_rag",
        ),
        CheckConstraint(
            "severity_hint IS NULL OR (severity_hint BETWEEN 1 AND 5)",
            name="ck_calibration_anchors_severity_range",
        ),
    )

    control_template_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("control_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rag_level: Mapped[RAGLevel] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity_hint: Mapped[int | None] = mapped_column(Integer, nullable=True)

    control_template: Mapped["ControlTemplate"] = relationship(
        "ControlTemplate", back_populates="calibration_anchors"
    )
