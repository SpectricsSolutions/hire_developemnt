from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from common.types import camel_config


class LoginRequest(BaseModel):
    model_config = camel_config

    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=1, max_length=256)


@dataclass
class IssuedTokens:
    access_token: str
    refresh_token: str


class TokenResponse(BaseModel):
    model_config = camel_config

    requires_2fa: Literal[False] = False
    access_token: str
    token_type: str = "bearer"


class TOTPChallengeResponse(BaseModel):
    model_config = camel_config

    requires_2fa: Literal[True] = True
    totp_token: str


class TOTPSetupResponse(BaseModel):
    model_config = camel_config

    qr_uri: str
    issuer: str


class TOTPVerifyRequest(BaseModel):
    model_config = camel_config

    code: str = Field(pattern=r"^\d{6}$")


class TOTPConfirmRequest(BaseModel):
    model_config = camel_config

    totp_token: str = Field(min_length=1, max_length=512)
    code: str = Field(pattern=r"^\d{6}$")


class AccessTokenResponse(BaseModel):
    model_config = camel_config

    access_token: str
    token_type: str = "bearer"
