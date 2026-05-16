# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|---|---|
| Install dependencies | `make setup` |
| Run dev servers (API + app) | `make dev` |
| Run API only | `make api-dev` |
| Run app only | `make app-dev` |
| Lint all (API + app + Terraform) | `make lint` |
| Lint Terraform only | `make tf-lint` |
| Format all | `make fmt` |
| Run all tests | `make test` |
| Run API tests in watch mode | `make api-test-watch` |
| Run frontend tests | `make app-test` |
| Run frontend tests in watch mode | `make app-test-watch` (uses `pnpm test:watch`) |
| Build frontend | `make build` |
| Start local DB | `make docker-up` |
| Generate API client | `make clients` |
| Clean build & coverage artifacts | `make clean` |

Run a single test file:
```bash
uv run pytest api/tests/e2e/auth/test_views.py -v
```

Run a single test by name:
```bash
uv run pytest -k "test_login" -v
```

## Architecture

Monorepo with three top-level concerns: `api/` (FastAPI), `app/` (React), `infra/` (Terraform/AWS).

### API Layer Structure

Every feature module under `api/` follows a strict layered pattern:

```
views.py    → FastAPI route handlers (thin, delegates to service)
services.py → Business logic, validation, orchestration
stores.py   → SQLAlchemy queries (data access only)
models.py   → ORM table definitions
types.py    → Pydantic schemas and enums for this domain
```

Dependencies flow downward only. Views import services, services import stores — never upward.

### Dependency Injection

FastAPI `Depends()` wires the stack: `get_db` → `AsyncSession`, `get_auth_store` → `AuthStore(session)`, `get_auth_service` → `AuthService(store, settings)`. The `get_current_user` dependency decodes the JWT bearer token, loads the active user, and attaches a runtime-only `permissions: set[str]` attribute. `require_permission(*names)` wraps `get_current_user` to enforce RBAC (AND semantics across multiple required permissions).

Authorization decisions belong in services, not views. If a permission inspection produces a per-request scope (e.g. "can read all clients"), wrap it in a small DTO (see `ClientViewer`) and pass it down — never read `current_user.permissions` from inside business logic.

### DTOs & Read Schemas

- **Request DTOs** use `model_config = camel_config` (camelCase aliases, populate by name).
- **Response/read DTOs** use `read_config` — same as `camel_config` plus `from_attributes=True`. Views call `XRead.model_validate(orm_row)` directly; no hand-rolled `_to_read` mappers.
- **Function/method parameters:** any 3+ related kwargs are wrapped in a Pydantic model (e.g. `ResourceRef`, `ClientViewer`, request DTOs passed straight through to stores).

### Response Envelope

All API responses are wrapped:
- **Success:** `{ "data": T, "message": str, "success": true }`
- **Error:** `{ "success": false, "message": str, "errors"?: { field: msg } }`

The `RequestValidationError` handler returns `422` with a flat `errors` map. It strips the `body`/`query`/`path` prefix and dot-joins nested paths (e.g. `engagements.0.feeCharged`); first error per field wins. The frontend's `applyApiError` helper (`app/src/lib/form-errors.ts`) maps this envelope onto react-hook-form field errors — every form's submit handler routes errors through it instead of open-coding 422 handling.

Exception handlers in `api/__init__.py` map custom exceptions (`UnauthorizedError`, `NotFoundError`, etc.) to the appropriate HTTP status and envelope format. Custom exceptions live in `common/exceptions.py`; stores and services raise these directly — never `HTTPException`.

### Audit Logging

`AuditService` records mutations. Methods take a `ResourceRef(type, id)` DTO plus the relevant before/after payload — `log_create(ref, *, after)`, `log_update(ref, *, before, after)`, `log_delete(ref, *, before)`, plus `log_login` / `log_logout` for auth events. Audit writes never raise; failures are logged and swallowed. The `audit_logs` table is append-only — a Postgres trigger blocks UPDATE/DELETE.

### Database

- Async SQLAlchemy 2.0 with asyncpg driver. All queries use `AsyncSession`.
- Models inherit mixins: `IdentityMixin` (UUID PK), `TimestampMixin` (created_at/updated_at), `MetadataMixin[T]` (JSONB via `PydanticType`).
- Migrations managed with Alembic (`api/migrations/`). Applied automatically on container start.
- Test database runs on port `5433` with tmpfs storage; config loaded from `api/.env.test`.
- Pool: size=5, overflow=10, recycle=1800s. Tests use `NullPool`.

### Authentication

JWT access tokens (HS256, 15-min expiry) paired with UUID refresh tokens stored in the `refresh_tokens` table (7-day expiry, revocable, tracks `ip_address` and `last_used_at`). Passwords hashed with Argon2.

### Frontend

React 19 with React Router v7. Routes are lazy-loaded via dynamic imports in `app/src/router.tsx`. The TypeScript API client is generated from the backend's OpenAPI spec (`make generate-client`) and lives under `app/src/client/`. Forms use `react-hook-form` + `zod`. UI components come from `shadcn/ui` + TailwindCSS v4.

### Production Serving

In production, FastAPI serves the compiled React app from `/static/index.html` with a catch-all route. In development, Vite runs separately on port 3000 with the API on port 8000.

### Infrastructure

Terraform state is managed via HCP Terraform. Two environments: `staging` and `production` under `infra/environments/`. Deployments push a Docker image (multi-stage: Node build → Python runtime) to ECR, then update ECS task definitions. AWS region is `eu-west-2`.

## Testing

Three test tiers under `api/tests/`:
- `unit/` — Services tested with mocked stores (no DB)
- `integration/` — Stores tested against a real test DB
- `e2e/` — Full HTTP stack via `httpx.AsyncClient` with a real DB

The `conftest.py` `clean_db` fixture auto-truncates all tables between tests. Test data is created via factories in `api/tests/factories.py` (e.g., `make_user()`).

## Environment

Copy `.env.example` to `.env` and fill in values. The API reads config from `api/settings.py` (Pydantic Settings, `@lru_cache`). Three setting groups: `AppSettings`, `DatabaseSettings`, `AuthSettings` — merged into a single `Settings` class.
