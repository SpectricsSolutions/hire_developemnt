from __future__ import annotations

from typing import Annotated, Any, Generic, TypeVar

import phonenumbers
from pydantic import AfterValidator, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import Dialect
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

T = TypeVar("T", bound=BaseModel | list[BaseModel])
M = TypeVar("M", bound=BaseModel)

camel_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
read_config = ConfigDict(
    alias_generator=to_camel, populate_by_name=True, from_attributes=True
)


def _normalize_phone(value: str) -> str:
    """Validate against libphonenumber and normalise to E.164."""
    try:
        parsed = phonenumbers.parse(value, None)
    except phonenumbers.NumberParseException as e:
        raise ValueError("Invalid phone number.") from e
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Invalid phone number.")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


# Globally validated phone string. Input must include the country code
# (e.g. "+44 20 7123 4567"); spacing/hyphens/parens are accepted. Stored as E.164.
PhoneStr = Annotated[str, AfterValidator(_normalize_phone)]


class PydanticType(TypeDecorator[M]):
    impl = JSONB
    cache_ok = True

    def __init__(self, pydantic_type: type[M]) -> None:
        super().__init__()
        self.pydantic_type = pydantic_type

    def process_bind_param(
        self, value: M | dict[str, Any] | None, dialect: Dialect
    ) -> dict[str, Any] | None:
        if value is None:
            return None
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json")
        return value

    def process_result_value(
        self, value: dict[str, Any] | None, dialect: Dialect
    ) -> M | None:
        if value is None:
            return None
        return self.pydantic_type.model_validate(value)


class BaseResponse(BaseModel):
    model_config = camel_config

    message: str = Field(
        default="Operation successful.",
        description="A message describing the result of the operation.",
    )
    success: bool = Field(
        default=True,
        description="Indicates whether the operation was successful.",
    )


class NoDataResponse(BaseResponse): ...


class Response(BaseResponse, Generic[T]):
    data: T
