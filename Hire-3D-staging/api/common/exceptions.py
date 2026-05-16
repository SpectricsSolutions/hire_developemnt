from __future__ import annotations


class UnauthorizedError(Exception): ...


class NotFoundError(Exception): ...


class InternalServerError(Exception): ...


class DuplicateResourceError(Exception): ...


class ForbiddenError(Exception): ...


class ConflictError(Exception): ...


class GateBlockedError(Exception):
    """Raised when an assessment transition is blocked by failed hard gates."""

    def __init__(self, message: str, errors: dict[str, str]) -> None:
        super().__init__(message)
        self.message = message
        self.errors = errors
