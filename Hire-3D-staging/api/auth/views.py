from __future__ import annotations

from typing import Annotated, Union
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response

from auth.dependencies import get_current_user, require_permission
from common.limiter import limiter
from common.types import NoDataResponse, Response as ApiResponse
from settings import Settings, get_settings
from users.models import User

from .services import AuthService, get_auth_service
from .types import (
    AccessTokenResponse,
    IssuedTokens,
    LoginRequest,
    TOTPChallengeResponse,
    TOTPConfirmRequest,
    TOTPSetupResponse,
    TOTPVerifyRequest,
    TokenResponse,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

_REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=not settings.is_development and not settings.is_testing,
        samesite="strict",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=_REFRESH_COOKIE, path="/api/v1/auth")


def _login_rate_limit() -> str:
    return f"{get_settings().LOGIN_RATE_LIMIT_PER_MINUTE}/minute"


@router.post(
    "/login",
    operation_id="login",
    response_model=ApiResponse[Union[TokenResponse, TOTPChallengeResponse]],
)
@limiter.limit(_login_rate_limit)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ApiResponse[TokenResponse | TOTPChallengeResponse]:
    result = await service.login(body.email, body.password)
    if isinstance(result, IssuedTokens):
        _set_refresh_cookie(response, result.refresh_token, settings)
        return ApiResponse(data=TokenResponse(access_token=result.access_token))
    return ApiResponse(data=result)


@router.post(
    "/refresh", operation_id="refresh", response_model=ApiResponse[AccessTokenResponse]
)
async def refresh(
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> ApiResponse[AccessTokenResponse]:
    token = request.cookies.get(_REFRESH_COOKIE)
    tokens = await service.refresh(token or "")
    return ApiResponse(data=tokens)


@router.post("/logout", operation_id="logout", response_model=NoDataResponse)
async def logout(
    request: Request,
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> NoDataResponse:
    token = request.cookies.get(_REFRESH_COOKIE)
    if token:
        await service.logout(token)
    _clear_refresh_cookie(response)
    return NoDataResponse()


@router.post(
    "/totp/setup",
    operation_id="totpSetup",
    response_model=ApiResponse[TOTPSetupResponse],
)
async def totp_setup(
    service: Annotated[AuthService, Depends(get_auth_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[TOTPSetupResponse]:
    result = await service.setup_totp(current_user)
    return ApiResponse(data=result)


@router.delete("/totp", operation_id="totpDisable", response_model=NoDataResponse)
async def totp_disable(
    service: Annotated[AuthService, Depends(get_auth_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NoDataResponse:
    await service.disable_totp(current_user)
    return NoDataResponse()


@router.post("/totp/verify", operation_id="totpVerify", response_model=NoDataResponse)
async def totp_verify(
    body: TOTPVerifyRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NoDataResponse:
    await service.verify_totp(current_user, body.code)
    return NoDataResponse()


@router.delete(
    "/sessions/{user_id}", operation_id="revokeSessions", response_model=NoDataResponse
)
async def revoke_sessions(
    user_id: UUID,
    service: Annotated[AuthService, Depends(get_auth_service)],
    _: Annotated[User, Depends(require_permission("users:update"))],
) -> NoDataResponse:
    await service.revoke_user_sessions(user_id)
    return NoDataResponse()


@router.post(
    "/totp/confirm",
    operation_id="totpConfirm",
    response_model=ApiResponse[TokenResponse],
)
async def totp_confirm(
    body: TOTPConfirmRequest,
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ApiResponse[TokenResponse]:
    result = await service.confirm_totp(body.totp_token, body.code)
    _set_refresh_cookie(response, result.refresh_token, settings)
    return ApiResponse(data=TokenResponse(access_token=result.access_token))
