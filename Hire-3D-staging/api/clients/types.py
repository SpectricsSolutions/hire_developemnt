from __future__ import annotations

import enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from common.types import PhoneStr, camel_config, read_config


@enum.unique
class ClientStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    AUDIT_IN_PROGRESS = "AUDIT_IN_PROGRESS"
    REPORT_ISSUED = "REPORT_ISSUED"
    FOLLOW_UP_DUE = "FOLLOW_UP_DUE"
    INACTIVE = "INACTIVE"


@enum.unique
class BusinessStage(enum.StrEnum):
    PRE_HIRE = "PRE_HIRE"
    EARLY = "EARLY"
    GROWTH = "GROWTH"
    ESTABLISHED = "ESTABLISHED"


@enum.unique
class UKRegion(enum.StrEnum):
    EAST_MIDLANDS = "EAST_MIDLANDS"
    EAST_OF_ENGLAND = "EAST_OF_ENGLAND"
    LONDON = "LONDON"
    NORTH_EAST = "NORTH_EAST"
    NORTH_WEST = "NORTH_WEST"
    SOUTH_EAST = "SOUTH_EAST"
    SOUTH_WEST = "SOUTH_WEST"
    WEST_MIDLANDS = "WEST_MIDLANDS"
    YORKSHIRE_AND_THE_HUMBER = "YORKSHIRE_AND_THE_HUMBER"
    NORTHERN_IRELAND = "NORTHERN_IRELAND"
    SCOTLAND = "SCOTLAND"
    WALES = "WALES"


class ClientMeta(BaseModel): ...


class ClientBase(BaseModel):
    model_config = camel_config

    company_name: str = Field(min_length=1, max_length=255)
    companies_house_number: str | None = Field(
        default=None, min_length=1, max_length=50
    )
    primary_contact_name: str = Field(min_length=1, max_length=100)
    primary_contact_email: EmailStr = Field(max_length=255)
    primary_contact_phone: PhoneStr | None = None
    sector: str | None = Field(default=None, min_length=1, max_length=100)
    headcount_at_engagement: int = Field(ge=0, le=10_000_000)
    current_headcount: int | None = Field(default=None, ge=0, le=10_000_000)
    business_stage: BusinessStage
    region: UKRegion
    assigned_operator_id: UUID
    internal_notes: str | None = None
    introducer_fee_applicable: bool | None = None
    status: ClientStatus


class ClientCreate(ClientBase):
    status: ClientStatus = ClientStatus.ACTIVE


class ClientUpdate(ClientBase): ...


class ClientRead(BaseModel):
    model_config = read_config

    id: UUID
    company_name: str
    companies_house_number: str | None
    primary_contact_name: str
    primary_contact_email: str
    primary_contact_phone: PhoneStr | None
    sector: str | None
    headcount_at_engagement: int
    current_headcount: int | None
    business_stage: BusinessStage
    region: UKRegion
    assigned_operator_id: UUID | None
    internal_notes: str | None
    introducer_fee_applicable: bool | None
    status: ClientStatus


class ClientViewer(BaseModel):
    actor_id: UUID
    can_read_all: bool
