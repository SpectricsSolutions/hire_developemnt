from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from common.database import Base
from common.mixins import IdentityMixin, MetadataMixin, TimestampMixin
from .types import BusinessStage, ClientMeta, ClientStatus, UKRegion


class Client(IdentityMixin, TimestampMixin, MetadataMixin[ClientMeta], Base):
    __tablename__ = "clients"

    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    companies_house_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    primary_contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    primary_contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    headcount_at_engagement: Mapped[int] = mapped_column(Integer, nullable=False)
    current_headcount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    business_stage: Mapped[BusinessStage] = mapped_column(String(50), nullable=False)
    region: Mapped[UKRegion] = mapped_column(String(50), nullable=False)
    assigned_operator_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    introducer_fee_applicable: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True
    )
    status: Mapped[ClientStatus] = mapped_column(
        String(50), nullable=False, default=ClientStatus.ACTIVE
    )
