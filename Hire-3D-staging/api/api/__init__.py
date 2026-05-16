from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from loguru import logger
from slowapi.errors import RateLimitExceeded

from common.audit_context import set_ip_address
from common.exceptions import (
    UnauthorizedError,
    NotFoundError,
    InternalServerError,
    DuplicateResourceError,
    ForbiddenError,
    ConflictError,
    GateBlockedError,
)
from assessments.views import router as assessments_router
from audits.views import router as audits_router
from auth.views import router as auth_router
from clients.views import router as clients_router
from controls.views import router as controls_router
from engagements.views import router as engagements_router
from roles.views import router as roles_router
from users.views import router as users_router
from common.limiter import limiter
from settings import get_settings

settings = get_settings()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    debug=settings.DEBUG,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else None,
)

app.state.limiter = limiter


@app.middleware("http")
async def audit_context_middleware(request: Request, call_next):
    set_ip_address(request.client.host if request.client else None)
    return await call_next(request)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(
    _: Request, __: RateLimitExceeded
) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "message": "Too many requests. Please try again later.",
        },
    )


if settings.is_development:  # pragma: no cover
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(roles_router)
app.include_router(clients_router)
app.include_router(engagements_router)
app.include_router(controls_router)
app.include_router(assessments_router)
app.include_router(audits_router)


@app.get("/health", include_in_schema=False)
async def health() -> dict:
    return {"status": "ok"}


if not settings.is_development and not settings.is_testing:  # pragma: no cover
    static = Path("static")
    assets = static / "assets"

    if not assets.exists():
        raise RuntimeError(f"Assets directory not found: {assets}")

    app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}")
    def serve_ui(path: str) -> Response:
        if (
            path.startswith("api/")
            or path.startswith("docs")
            or path.startswith("redoc")
            or path.startswith("openapi.json")
        ):
            return JSONResponse(
                status_code=404, content={"success": False, "message": "Not found."}
            )

        file = static / path
        if file.exists() and file.is_file():
            return FileResponse(file)
        return FileResponse(static / "index.html")


@app.exception_handler(404)
async def not_found_error_handler(_, __):  # pyright: ignore
    return JSONResponse(
        status_code=404, content={"success": False, "message": "Not found."}
    )


@app.exception_handler(400)
async def bad_request_error_handler(_, __):  # pyright: ignore  # pragma: no cover
    return JSONResponse(
        status_code=400, content={"success": False, "message": "Bad request."}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):
    errors: dict[str, str] = {}
    for err in exc.errors():
        path = [
            str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path")
        ]
        field = ".".join(path) if path else "_"
        errors.setdefault(field, err.get("msg", "Invalid value."))

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "Validation error.",
            "errors": errors,
            "data": None,
        },
    )


@app.exception_handler(405)
async def method_not_allowed_error_handler(_, __):  # pyright: ignore
    return JSONResponse(
        status_code=405, content={"success": False, "message": "Method not allowed."}
    )


@app.exception_handler(500)
async def internal_server_error_handler(_, __):  # pragma: no cover
    return JSONResponse(
        status_code=500, content={"success": False, "message": "Internal server error."}
    )


@app.exception_handler(UnauthorizedError)
async def unauthorized_exception_handler(_, __):
    return JSONResponse(
        status_code=401, content={"success": False, "message": "Unauthorized."}
    )


@app.exception_handler(NotFoundError)
async def not_found_exception_handler(_, __):
    return JSONResponse(
        status_code=404, content={"success": False, "message": "Resource not found."}
    )


@app.exception_handler(InternalServerError)
async def internal_server_exception_handler(_, e: Exception):  # pragma: no cover
    logger.error("Internal server error: {}", e)

    return JSONResponse(
        status_code=500, content={"success": False, "message": "Internal server error."}
    )


@app.exception_handler(DuplicateResourceError)
async def duplicate_resource_exception_handler(_, e: DuplicateResourceError):
    return JSONResponse(status_code=409, content={"success": False, "message": str(e)})


@app.exception_handler(ForbiddenError)
async def forbidden_exception_handler(_, e: ForbiddenError):
    return JSONResponse(status_code=403, content={"success": False, "message": str(e)})


@app.exception_handler(ConflictError)
async def conflict_exception_handler(_, e: ConflictError):  # pragma: no cover
    return JSONResponse(status_code=409, content={"success": False, "message": str(e)})


@app.exception_handler(GateBlockedError)
async def gate_blocked_exception_handler(_, e: GateBlockedError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": e.message,
            "errors": e.errors,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_, e: Exception):  # pragma: no cover
    logger.exception("Unhandled exception", exc_info=e)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error."},
    )
