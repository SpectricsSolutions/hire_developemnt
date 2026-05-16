from __future__ import annotations

from datetime import timedelta
from typing import Annotated
from uuid import UUID

import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends
from jose import JWTError, jwt

from audits.services import AuditService, get_audit_service
from common.audit_context import get_ip_address
from common.datetime import get_utc_now
from common.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from settings import Settings, get_settings
from users.models import User
from users.types import UserStatus

from .stores import AuthStore, get_auth_store
from .types import (
    AccessTokenResponse,
    IssuedTokens,
    TOTPChallengeResponse,
    TOTPSetupResponse,
)

_ph = PasswordHasher()

_TOTP_CHALLENGE_TYPE = "totp_challenge"


def decode_access_token(token: str, settings: Settings) -> dict:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET.get_secret_value(),
            algorithms=["HS256"],
        )
    except JWTError:
        raise UnauthorizedError


class AuthService:
    def __init__(
        self,
        store: AuthStore,
        settings: Settings,
        audit_service: AuditService,
    ) -> None:
        self.store = store
        self.settings = settings
        self.audit_service = audit_service

    async def _permissions_for(self, user: User) -> list[str]:
        return await self.store.get_permissions_for_user(user.id)

    async def login(
        self, email: str, password: str
    ) -> IssuedTokens | TOTPChallengeResponse:
        user = await self.store.get_user_by_email(email)
        if not user:
            raise UnauthorizedError

        try:
            _ph.verify(user.password, password)
        except VerifyMismatchError:
            raise UnauthorizedError

        if user.status == UserStatus.PENDING:
            raise ForbiddenError(
                "Your account is pending approval. Please contact your administrator."
            )

        if user.status != UserStatus.ACTIVE:
            raise UnauthorizedError

        totp_record = await self.store.get_user_totp(user.id)
        if totp_record and totp_record.is_enabled:
            return TOTPChallengeResponse(totp_token=self._issue_totp_token(user))

        permissions = await self._permissions_for(user)
        access_token = self._issue_access_token(
            user, totp_enabled=False, permissions=permissions
        )
        refresh_token = await self.store.create_refresh_token(
            user_id=user.id,
            expires_at=get_utc_now()
            + timedelta(days=self.settings.REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=get_ip_address(),
        )

        await self.audit_service.log_login(actor_id=user.id)

        return IssuedTokens(
            access_token=access_token,
            refresh_token=str(refresh_token.token),
        )

    async def refresh(self, raw_token: str) -> AccessTokenResponse:
        try:
            token_uuid = UUID(raw_token)
        except ValueError:
            raise UnauthorizedError

        record = await self.store.get_refresh_token(token_uuid)
        if not record:
            raise UnauthorizedError
        if record.revoked_at is not None:
            raise UnauthorizedError
        if record.expires_at <= get_utc_now():
            raise UnauthorizedError

        await self.store.update_last_used(record.id)

        user = await self.store.get_user_by_id(record.user_id)
        if not user or user.status != UserStatus.ACTIVE:
            raise UnauthorizedError

        totp_record = await self.store.get_user_totp(user.id)
        totp_enabled = totp_record is not None and totp_record.is_enabled
        permissions = await self._permissions_for(user)

        return AccessTokenResponse(
            access_token=self._issue_access_token(
                user, totp_enabled=totp_enabled, permissions=permissions
            )
        )

    async def logout(self, raw_token: str) -> None:
        try:
            token_uuid = UUID(raw_token)
        except ValueError:
            return

        record = await self.store.get_refresh_token(token_uuid)
        if record and record.revoked_at is None:
            await self.store.revoke_refresh_token(record.id)
            await self.audit_service.log_logout(actor_id=record.user_id)

    async def revoke_user_sessions(self, user_id: UUID) -> None:
        user = await self.store.get_user_by_id(user_id)
        if not user:
            raise NotFoundError

        await self.store.revoke_all_user_tokens(user_id)
        await self.audit_service.log_logout()

    async def setup_totp(self, user: User) -> TOTPSetupResponse:
        secret = pyotp.random_base32()
        await self.store.upsert_user_totp(user_id=user.id, secret=secret)
        qr_uri = pyotp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name=self.settings.TOTP_ISSUER,
        )
        return TOTPSetupResponse(qr_uri=qr_uri, issuer=self.settings.TOTP_ISSUER)

    async def disable_totp(self, user: User) -> None:
        record = await self.store.get_user_totp(user.id)
        if not record or not record.is_enabled:
            raise NotFoundError

        await self.store.delete_user_totp(user.id)

    async def verify_totp(self, user: User, code: str) -> None:
        record = await self.store.get_user_totp(user.id)
        if not record:
            raise UnauthorizedError

        if not pyotp.TOTP(record.secret).verify(code):
            raise UnauthorizedError

        await self.store.enable_user_totp(user.id)

    async def confirm_totp(self, totp_token: str, code: str) -> IssuedTokens:
        payload = self._decode_totp_token(totp_token)

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError

        user = await self.store.get_user_by_id(UUID(user_id))
        if not user or user.status != UserStatus.ACTIVE:
            raise UnauthorizedError

        record = await self.store.get_user_totp(user.id)
        if not record or not record.is_enabled:
            raise UnauthorizedError

        if not pyotp.TOTP(record.secret).verify(code):
            raise UnauthorizedError

        permissions = await self._permissions_for(user)
        access_token = self._issue_access_token(
            user, totp_enabled=True, permissions=permissions
        )
        refresh_token = await self.store.create_refresh_token(
            user_id=user.id,
            expires_at=get_utc_now()
            + timedelta(days=self.settings.REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=get_ip_address(),
        )

        await self.audit_service.log_login(actor_id=user.id)

        return IssuedTokens(
            access_token=access_token,
            refresh_token=str(refresh_token.token),
        )

    def _issue_access_token(
        self,
        user: User,
        *,
        totp_enabled: bool = False,
        permissions: list[str] | None = None,
    ) -> str:
        now = get_utc_now()
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role.name if user.role else None,
            "permissions": permissions or [],
            "totp_enabled": totp_enabled,
            "iat": now,
            "exp": now
            + timedelta(minutes=self.settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        }
        return jwt.encode(
            payload,
            self.settings.JWT_SECRET.get_secret_value(),
            algorithm="HS256",
        )

    def _issue_totp_token(self, user: User) -> str:
        now = get_utc_now()
        payload = {
            "sub": str(user.id),
            "type": _TOTP_CHALLENGE_TYPE,
            "iat": now,
            "exp": now + timedelta(minutes=self.settings.TOTP_TOKEN_EXPIRE_MINUTES),
        }
        return jwt.encode(
            payload,
            self.settings.JWT_SECRET.get_secret_value(),
            algorithm="HS256",
        )

    def _decode_totp_token(self, token: str) -> dict:
        try:
            payload = jwt.decode(
                token,
                self.settings.JWT_SECRET.get_secret_value(),
                algorithms=["HS256"],
            )
        except JWTError:
            raise UnauthorizedError

        if payload.get("type") != _TOTP_CHALLENGE_TYPE:
            raise UnauthorizedError

        return payload


async def get_auth_service(
    store: Annotated[AuthStore, Depends(get_auth_store)],
    settings: Annotated[Settings, Depends(get_settings)],
    audit_service: Annotated[AuditService, Depends(get_audit_service)],
) -> AuthService:
    return AuthService(store=store, settings=settings, audit_service=audit_service)
