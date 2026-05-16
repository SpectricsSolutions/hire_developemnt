from __future__ import annotations

import enum
from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import (
    BaseModel,
    Field,
    SerializerFunctionWrapHandler,
    ValidationInfo,
    field_validator,
    model_serializer,
)

from common.types import camel_config, read_config


@enum.unique
class Product(enum.StrEnum):
    HIRE_READY = "HIRE_READY"
    THE_CHECK = "THE_CHECK"
    HIRE_3D_CORE = "HIRE_3D_CORE"
    HIRE_3D_ENHANCED = "HIRE_3D_ENHANCED"


@enum.unique
class FeeStatus(enum.StrEnum):
    INVOICED = "INVOICED"
    PAID = "PAID"
    OVERDUE = "OVERDUE"


@enum.unique
class AuditStatus(enum.StrEnum):
    SCHEDULED = "SCHEDULED"
    PHASE_1_COMPLETE = "PHASE_1_COMPLETE"
    PHASE_2_COMPLETE = "PHASE_2_COMPLETE"
    REPORT_ISSUED = "REPORT_ISSUED"


@enum.unique
class RiskRating(enum.StrEnum):
    RED = "RED"
    AMBER_RED = "AMBER_RED"
    AMBER = "AMBER"
    GREEN_AMBER = "GREEN_AMBER"
    GREEN = "GREEN"


class EngagementMeta(BaseModel): ...


class EngagementBase(BaseModel):
    model_config = camel_config

    product: Product
    engagement_date: date
    fee_charged: Decimal = Field(max_digits=10, decimal_places=2, ge=0)
    fee_status: FeeStatus
    audit_date: date | None = None
    report_issued_date: date | None = None
    audit_status: AuditStatus = AuditStatus.SCHEDULED
    next_review_due: date | None = None
    engagement_letter_signed_at: date | None = None
    invoice_raised_at: date | None = None

    @field_validator("audit_date")
    @classmethod
    def _audit_date_after_engagement(
        cls, v: date | None, info: ValidationInfo
    ) -> date | None:
        engagement_date = info.data.get("engagement_date")
        if v and engagement_date and v < engagement_date:
            raise ValueError("Audit date must be on or after the engagement date.")
        return v

    @field_validator("report_issued_date")
    @classmethod
    def _report_after_audit_or_engagement(
        cls, v: date | None, info: ValidationInfo
    ) -> date | None:
        if v is None:
            return v
        boundary = info.data.get("audit_date") or info.data.get("engagement_date")
        if boundary and v < boundary:
            raise ValueError(
                "Report issued date must be on or after the audit date "
                "(or engagement date if no audit date is set)."
            )
        return v

    @field_validator("next_review_due")
    @classmethod
    def _review_after_engagement(
        cls, v: date | None, info: ValidationInfo
    ) -> date | None:
        engagement_date = info.data.get("engagement_date")
        if v and engagement_date and v < engagement_date:
            raise ValueError("Next review due must be on or after the engagement date.")
        return v


class EngagementCreate(EngagementBase): ...


class EngagementUpdate(EngagementBase): ...


class EngagementRead(BaseModel):
    model_config = read_config

    id: UUID
    client_id: UUID
    product: Product
    engagement_date: date
    fee_charged: Decimal | None = None
    fee_status: FeeStatus | None = None
    audit_date: date | None
    report_issued_date: date | None
    audit_status: AuditStatus
    overall_rag: RiskRating | None
    risk_score: int | None
    next_review_due: date | None
    engagement_letter_signed_at: date | None
    invoice_raised_at: date | None

    @model_serializer(mode="wrap")
    def _drop_redacted_fees(self, handler: SerializerFunctionWrapHandler) -> dict:
        data = handler(self)
        if self.fee_charged is None:
            data.pop("feeCharged", None)
            data.pop("fee_charged", None)
        if self.fee_status is None:
            data.pop("feeStatus", None)
            data.pop("fee_status", None)
        return data


class EngagementViewer(BaseModel):
    actor_id: UUID
    can_read_fees: bool

    def redact(self, read: EngagementRead) -> EngagementRead:
        if self.can_read_fees:
            return read
        return read.model_copy(update={"fee_charged": None, "fee_status": None})
