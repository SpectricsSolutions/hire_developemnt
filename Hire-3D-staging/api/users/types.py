from __future__ import annotations

import enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from common.types import camel_config


@enum.unique
class UserStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"
    SUSPENDED = "SUSPENDED"


class UserMeta(BaseModel): ...


class UserCreate(BaseModel):
    model_config = camel_config

    name: str = Field(min_length=1, max_length=50)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: str | None = Field(default=None, max_length=100)
    status: UserStatus | None = None


class UserRead(BaseModel):
    model_config = camel_config

    id: UUID
    name: str
    email: str
    role: str | None
    status: UserStatus


class UserUpdate(BaseModel):
    model_config = camel_config

    name: str | None = Field(default=None, min_length=1, max_length=50)
    role: str | None = Field(default=None, max_length=100)
    status: UserStatus | None = None
