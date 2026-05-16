from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from common.database import Base
from common.mixins import IdentityMixin, MetadataMixin, TimestampMixin
from .types import AuditStatus, EngagementMeta, FeeStatus, Product, RiskRating


class Engagement(IdentityMixin, TimestampMixin, MetadataMixin[EngagementMeta], Base):
    __tablename__ = "engagements"

    client_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    product: Mapped[Product] = mapped_column(String(50), nullable=False)
    engagement_date: Mapped[date] = mapped_column(Date, nullable=False)
    fee_charged: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    fee_status: Mapped[FeeStatus] = mapped_column(String(50), nullable=False)
    audit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    report_issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    audit_status: Mapped[AuditStatus] = mapped_column(
        String(50), nullable=False, default=AuditStatus.SCHEDULED
    )
    overall_rag: Mapped[RiskRating | None] = mapped_column(String(50), nullable=True)
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_review_due: Mapped[date | None] = mapped_column(Date, nullable=True)
    engagement_letter_signed_at: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )
    invoice_raised_at: Mapped[date | None] = mapped_column(Date, nullable=True)
