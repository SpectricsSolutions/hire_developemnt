# API

FastAPI + SQLAlchemy 2.0 async stack. Python 3.13+, PostgreSQL via asyncpg.

---

## Structure

```
api/
  api/          # FastAPI app factory, middleware, exception handlers, route registration
  common/       # Shared infrastructure (db, mixins, types, exceptions, abstracts)
  auth/         # Login, logout, refresh, TOTP 2FA
  users/        # Users domain
  roles/        # Roles & permissions (dynamic RBAC)
  clients/      # Client records
  engagements/  # Per-product engagements attached to a client
  audits/       # Append-only audit log
  migrations/   # Alembic migrations
  settings.py   # Pydantic settings
  main.py       # Entrypoint
```

Each domain follows the same layered pattern: **views → service → store → model**.

---

## Layers

| Layer | File | Responsibility |
|---|---|---|
| Views | `views.py` | FastAPI route handlers, request/response shaping |
| Service | `services.py` | Business logic, authorization, orchestration |
| Store | `stores.py` | SQLAlchemy queries (data access only) |
| Model | `models.py` | ORM table definitions |
| Types | `types.py` | Enums, Pydantic schemas |

Dependencies flow downward. Views import services; services import stores. Never the other way.

---

## Response Envelope

Every endpoint wraps its payload in a uniform envelope.

**Success:**
```json
{ "success": true, "message": "...", "data": <T> }
```

**Error:**
```json
{ "success": false, "message": "...", "errors": { "<field>": "<message>" } }
```

`errors` is only present on `422` validation responses. Field keys use the same casing the request body sent (camelCase by default — see *DTOs* below).

The validation handler strips the `body`/`query`/`path` prefix and joins nested paths with `.` (e.g. `engagements.0.feeCharged`). First error per field wins.

| Exception | HTTP |
|---|---|
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `DuplicateResourceError` | 409 |
| `ConflictError` | 409 |
| `RequestValidationError` | 422 (with `errors` map) |
| `RateLimitExceeded` | 429 |
| `InternalServerError` | 500 |
| Any uncaught `Exception` | 500 (catch-all logs + masks) |

All custom exceptions live in `common/exceptions.py` and are mapped to HTTP responses by handlers in `api/__init__.py`. Stores and services raise these directly — they never raise `HTTPException`. A catch-all `@app.exception_handler(Exception)` guarantees every error response carries the envelope shape; raw Python exceptions are logged and masked as `500 Internal server error.`.

**Frontend protocol contract.** Every status code is handled uniformly via `app/src/lib/api-errors.ts`:

- `applyApiError(err, setError, fallback, overrides?)` — inside form submit handlers.
- `notifyApiError(err, fallback, overrides?)` — for page fetches and other non-form contexts.
- `apiErrorMessage(err, fallback, overrides?)` — when you need the message string itself.

These helpers apply project-wide defaults: `401` → "session expired", `403` → "no permission", `404`/`429` → friendly defaults, `409` and other 4xx → use the server's specific `message`, `5xx` → always masked. Per-form overrides are passed via the `overrides` map (e.g. `{ 401: 'Invalid email or password' }` on the login form). Never open-code `if (err.status === …)` chains in callers — adjust the helper instead.

---

## Common Infrastructure

### Database (`common/database.py`)
- Async SQLAlchemy engine on asyncpg.
- `AsyncSessionLocal` factory (`expire_on_commit=False`).
- `NullPool` in tests; pooled in dev/staging/prod.
- `get_db()` async generator — injected via `Depends`.

### Mixins (`common/mixins.py`)

| Mixin | Adds |
|---|---|
| `IdentityMixin` | `id` UUID PK, auto-generated |
| `TimestampMixin` | `created_at`, `updated_at` — TZ-aware, auto-managed |
| `MetadataMixin[T]` | `meta` JSONB — auto-marshalled via Pydantic `T` |
| `CreatedByMixin` / `UpdatedByMixin` | Nullable FK → `users.id` |

`MetadataMixin[T]` uses a `PydanticType` `TypeDecorator` to convert between the Pydantic model and JSONB transparently — no manual `model_dump` / `model_validate` in callers.

### DTO Configs (`common/types.py`)

| Config | Use for | Behaviour |
|---|---|---|
| `camel_config` | Request DTOs | `alias_generator=to_camel`, `populate_by_name=True` |
| `read_config` | Response DTOs (read models) | Same as above + `from_attributes=True` |

Read DTOs (`UserRead`, `ClientRead`, `EngagementRead`, `RoleRead`, `AuditLogRead`, …) attach `model_config = read_config` and views call `XRead.model_validate(orm_row)` directly. **Do not** write hand-rolled `_to_read(orm) -> XRead` mappers.

### Standard Wrappers
- `Response[T]` — `{ data: T, message, success }`
- `NoDataResponse` — for operations that don't return a payload

---

## Authentication

JWT access tokens (HS256, 15-minute expiry) paired with UUID refresh tokens.

- Refresh tokens persisted in `refresh_tokens` (7-day expiry, revocable, tracks `ip_address` and `last_used_at`).
- Refresh tokens delivered as `httponly` `secure` `samesite=strict` cookies on `/api/v1/auth`.
- Passwords hashed with Argon2 (`argon2-cffi`).
- Optional TOTP 2FA enrolment per user (`auth/types.py`).

The `get_current_user` dependency (in `auth/dependencies.py`) decodes the bearer token, loads the `User`, attaches a runtime-only `permissions: set[str]` attribute, and seeds the audit context with `actor_id`.

```python
from auth.dependencies import require_permission

@router.post("", operation_id="createClient", status_code=201)
async def create_client(
    body: ClientCreate,
    _: Annotated[User, Depends(require_permission("clients:create"))],
    service: Annotated[ClientsService, Depends(get_clients_service)],
) -> Response[ClientRead]: ...
```

`require_permission(*names)` is the only RBAC gate at the view layer. **Never** read `current_user.permissions` directly inside business logic — push the decision into the service via a small DTO instead (e.g. `ClientViewer(actor_id, can_read_all)`).

### Audit Context

`common/audit_context.py` exposes `set_actor_id` / `get_actor_id` and `set_ip_address` / `get_ip_address` — `ContextVar`-backed and populated by middleware + `get_current_user`. Audit writes pick these up automatically; callers don't pass them through.

---

## Authorization (Dynamic RBAC)

Permissions are stored rows, not enum values. A role is a named bundle of permission names; users hold one role.

- `roles` table — `name`, `description`, `is_system`.
- `permissions` table — fixed seeded list (`ALL_PERMISSIONS` in `roles/types.py`).
- `role_permissions` — many-to-many.
- System roles (`ADMIN`, `OPERATOR`, `VIEWER`) seed defined in `SYSTEM_ROLES` and applied via `roles/seeding.py`. They cannot be renamed or deleted.

Custom roles can be created via `POST /api/v1/roles` (requires `roles:manage`).

`auth.dependencies.get_current_user` populates `User.permissions: set[str]` for the request from `role.permissions`. `require_permission(...)` checks set membership.

---

## Auditing

Use the `AuditService` to record state changes. Service methods take a `ResourceRef` DTO + the relevant before/after payload — never positional `resource_type` / `resource_id` args.

```python
from audits.types import ResourceRef

await self.audit_service.log_create(
    ResourceRef(type="client", id=client.id),
    after=data.model_dump(mode="json"),
)

await self.audit_service.log_update(
    ResourceRef(type="user", id=user_id),
    before=before,
    after=after,
)
```

Methods:

| Method | Purpose |
|---|---|
| `log_create(ref, *, after)` | Resource created |
| `log_update(ref, *, before, after)` | Resource mutated |
| `log_delete(ref, *, before)` | Resource removed |
| `log_login(*, actor_id)` | Auth event |
| `log_logout(*, actor_id=None)` | Auth event (falls back to context actor) |

Audit writes never raise — `_record` swallows store errors and logs them, so a failed audit can't break the parent operation.

The `audit_logs` table is **append-only**: a Postgres `BEFORE UPDATE` / `BEFORE DELETE` trigger raises (`f3c1d9a2b847_audit_logs_append_only`). There is no `PUT` / `DELETE` endpoint.

---

## Domain Reference

### User (`users/models.py`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | String(50) | |
| `email` | String(255) | Unique |
| `password` | String(255) | Argon2 hash |
| `avatar` | String(255) | |
| `role_id` | UUID | Nullable FK → `roles.id` (`ON DELETE SET NULL`) |
| `status` | String(50) | `UserStatus` enum |
| `meta` | JSONB | `UserMeta` Pydantic model |

Runtime-only (not a column): `permissions: ClassVar[set[str]]` — populated per request by `get_current_user`.

**Enum:** `UserStatus` — `ACTIVE`, `INACTIVE`, `PENDING`, `SUSPENDED`.

### Role / Permission (`roles/models.py`)

`Role(name, description, is_system, permissions: list[Permission])` — many-to-many via `role_permissions`. Permissions are seeded from `ALL_PERMISSIONS`. `is_system=True` roles are protected from rename and delete.

### Client (`clients/models.py`)

Hire3D engagement client. Tracks contact info, headcount, sector, region, business stage, status, and the assigned operator (FK → `users.id`, nullable). Operators see only their assigned clients (`clients:read`); admins/viewers with `clients:read_all` see everything (enforced in `ClientsService`, not in views).

### Engagement (`engagements/models.py`)

A scoped piece of work for a `Client` — product type, fees, audit dates, audit status, risk rating. Nested under `/api/v1/clients/{client_id}/engagements`. Cross-client access is rejected with `404` to avoid leaking existence.

### AuditLog (`audits/models.py`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `actor_id` | UUID | Nullable FK → users (`SET NULL` — survives user deletion) |
| `action` | String(50) | `AuditAction` enum |
| `event` | String(100) | Nullable. Business intent (e.g. `user.login`) |
| `resource_type` | String(50) | `client`, `user`, `engagement`, `session`, … |
| `resource_id` | UUID | Nullable (auth events have no resource) |
| `ip_address` | String(45) | IPv4 / IPv6 |
| `meta` | JSONB | `AuditMeta(before, after)` |
| `created_at` | TimestampTZ | Immutable — no `updated_at` |

Indexes: `actor_id`, `event`, `(resource_type, resource_id)`, `created_at`.

**Enum:** `AuditAction` — `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`.

---

## Settings (`settings.py`)

Three groups (`AppSettings`, `DatabaseSettings`, `AuthSettings`) merge into a single `Settings` class, loaded once via `@lru_cache`.

| Key | Default | Notes |
|---|---|---|
| `DB_HOST` | — | Required |
| `DB_PORT` | `5432` | |
| `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | — | Required (`SecretStr` for password) |
| `POOL_SIZE` | `5` | `NullPool` in test env |
| `MAX_OVERFLOW` | `10` | |
| `JWT_SECRET` | — | Required |
| `JWT_EXPIRE_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh cookie lifetime |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | — | slowapi limit on `/auth/login` |
| `ENVIRONMENT` | `PRODUCTION` | `DEVELOPMENT`, `STAGING`, `TESTING` |
| `DEBUG` | `False` | SQL echo + OpenAPI docs |
