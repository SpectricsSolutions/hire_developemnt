# Developer Guidelines

## Principles

- **SOLID** — Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion. Every class and function should have one reason to change.
- **Clean over clever** — Prefer obvious code over terse code. Name things for what they are, not how they work.
- **Baby steps** — Small, atomic commits. Each commit should leave the codebase in a working state.
- **No assumptions** — If intent is unclear, ask. Don't infer requirements from surrounding code.
- **Consistency** — Follow the patterns already established. New code should look like existing code in the same layer.

---

## Git

- Branch from `staging` for all feature and fix work.
- Merge to `staging` first; `master` is production.
- Commit messages: imperative, lowercase, no period. `fix: token expiry check` not `Fixed the token expiry check.`
- One logical change per commit. Avoid "WIP" commits on shared branches.
- Pre-commit hook runs linting. Do not bypass it (`--no-verify`).

---

## API (FastAPI / Python)

### Layer Responsibilities

| Layer | Owns | Does NOT own |
|---|---|---|
| `views.py` | HTTP in/out, status codes, response shaping | Business rules, DB queries |
| `services.py` | Business logic, validation, orchestration | HTTP concerns, raw SQL |
| `stores.py` | SQLAlchemy queries, DB I/O | Business rules, HTTP concerns |
| `models.py` | ORM table definitions, column types | Serialization, business logic |
| `types.py` | Pydantic request/response schemas, enums | ORM, DB |

Never mix layers. A store must not raise an `HTTPException`; a view must not write a query.

### Adding a New Feature Module

1. Create a directory under `api/` named after the domain (e.g., `api/candidates/`).
2. Add `models.py`, `types.py`, `stores.py`, `services.py`, `views.py` — only the files needed.
3. Register the router in `api/__init__.py` with a versioned prefix (`/api/v1/<resource>`).
4. Create an Alembic migration if the model introduces new tables or columns.

### Models

- Inherit the appropriate mixins (`IdentityMixin`, `TimestampMixin`, etc.) from `api/mixins.py`.
- Use `PydanticType` for JSONB columns backed by a Pydantic model.
- Define `__tablename__` explicitly. Use lowercase snake_case plural (`refresh_tokens`, not `RefreshToken`).

### Schemas (types.py)

- Separate request and response schemas. Do not reuse the same schema for both.
- Response schemas must never leak password hashes, internal tokens, or system fields.
- **Imports stay at module top.** Do not bury `import` statements inside functions or methods to dodge a circular import — restructure the dependency instead.
- **Response/read DTOs use `read_config`** from `common/types.py` (`alias_generator=to_camel`, `populate_by_name=True`, `from_attributes=True`). Request DTOs use `camel_config`.
- **No hand-rolled mappers in views.** Call `XRead.model_validate(orm_row)` directly. If a field is computed (e.g. `actor_name` looked up via a join), default it to `None` in the read schema and patch it in via `model_copy(update={...})`.
- **DTO rule for parameters:** any function or method that takes 3+ related kwargs accepts a Pydantic model instead of a flat parameter list. Examples in the codebase: `ClientViewer`, `ResourceRef`, `RoleCreate`/`RoleUpdate` passed straight through to the store.

### Exceptions

Use the custom exceptions from `common/exceptions.py`. Do not raise `HTTPException` in services or stores — only in views if absolutely needed. Each exception maps to a specific HTTP status via the registered handler in `api/__init__.py`.

### Authorization

- Gate routes with `require_permission("perm:name")` from `auth/dependencies.py`. Multiple required permissions: pass them all to `require_permission(...)` (AND semantics).
- **Authorization decisions belong in the service layer**, not in views. If a permission inspection produces a per-request scope (e.g. "can read all clients"), wrap it in a small DTO (see `ClientViewer`) and pass it into the service. Never read `current_user.permissions` from inside a view.
- `User.permissions: ClassVar[set[str]]` is populated per-request by `get_current_user`. It's not a column; do not persist it.

> Some authorization paths have known soft edges (e.g. `RolesService` silently drops unknown permission names). See [`docs/DESIGN_NOTES.md`](./DESIGN_NOTES.md) for the full list and the conditions that should trigger a revisit.

### Audit Logging

Use `AuditService` from `audits/services.py` whenever a service mutates a resource. Methods accept a `ResourceRef(type, id)` DTO followed by the relevant before/after payload:

```python
await self.audit_service.log_create(
    ResourceRef(type="client", id=client.id),
    after=data.model_dump(mode="json"),
)
```

Available: `log_create`, `log_update`, `log_delete`, `log_login`, `log_logout`. Audit writes never raise — failures are logged and swallowed so the parent operation cannot break. Login/logout pull `actor_id` from the request context if not given explicitly.

### Dependency Injection

Wire new dependencies through `Depends()` following the existing pattern in `api/dependencies.py`. Do not import settings or the DB session directly inside business logic — inject them.

### Async

All DB operations are async. Never use synchronous SQLAlchemy calls. Every function touching the DB must be `async def` and awaited.

---

## Database & Migrations

- Every schema change requires an Alembic migration.
- Migration filenames describe the change: `create_candidates_table`, `add_status_to_users`.
- Never edit an existing migration that has been applied to any environment.
- Test the migration both `upgrade` and `downgrade` locally before pushing.

---

## Testing

### What to Test

- **Unit tests** — Service layer logic: edge cases, error paths, role checks. Mock the store.
- **Integration tests** — Store layer: verify queries against a real DB. Do not mock.
- **E2E tests** — Critical HTTP flows (auth, CRUD). Use `AsyncClient` against a real DB.

### Conventions

- Use factories (`api/tests/factories.py`) for test data. Do not hardcode IDs or emails.
- Each test is self-contained. Rely on `clean_db` for teardown — do not manually delete rows.
- Name tests: `test_<what>_<given_condition>` (e.g., `test_login_with_invalid_password`).
- A test that passes with a mock but would fail with real infrastructure is not a passing test.

### Running

```bash
make test              # full suite (spins up test DB automatically)
make api-test-watch    # watch mode for TDD
uv run pytest -k "test_login" -v   # single test by name
```

---

## Frontend (React / TypeScript)

### Structure

- Pages live under `app/src/pages/`. One file per route.
- Shared UI components (no business logic) go in `app/src/components/`.
- Feature-specific components co-locate with their page or in a subfolder.
- The generated API client (`app/src/client/`) is read-only — never edit it manually. Regenerate with `make generate-client`.

### Forms

Use `react-hook-form` + `zod`. Define the schema first, derive the TypeScript type from it, pass the schema to `useForm`.

**API errors go through `app/src/lib/api-errors.ts`.** Three helpers cover every shape:

| Helper | Use when |
|---|---|
| `applyApiError(err, setError, fallback, overrides?)` | Inside a form submit handler — `422` becomes per-field errors via `setError`; everything else toasts. |
| `notifyApiError(err, fallback, overrides?)` | Outside a form (page fetches, button actions) — toasts the resolved message. |
| `apiErrorMessage(err, fallback, overrides?)` | When you need the message string itself (e.g. inline error UI in a dialog). |

```ts
// in a form
try { await createClient({ body: values }) }
catch (err) { applyApiError(err, form.setError, 'Failed to create client') }

// in a page fetch
listRoles()
  .then(...)
  .catch(err => notifyApiError(err, 'Failed to load roles'))
```

The helpers enforce the API protocol uniformly — see `docs/API.md` "Response Envelope" for the contract. Defaults applied automatically:

| Status | Default behaviour |
|---|---|
| `401` | "Your session has expired. Please sign in again." (fixed — server msg is generic) |
| `403` | Server's `message` if specific (e.g. "Your account is pending approval"); otherwise "You don't have permission to perform this action." |
| `404` | "Not found." (fixed — server msg is generic) |
| `409` and other 4xx | Server's `message` (specific — e.g. `ConflictError` detail) |
| `422` | `applyApiError` writes per-field errors; `notifyApiError` toasts the protocol message |
| `429` | "Too many requests. Please slow down and try again." |
| `5xx` | Always masked as "Something went wrong. Please try again." (server message never echoed) |

The `overrides` map lets a form override per-status messages — e.g. login passes `{ 401: 'Invalid email or password' }` so a bad-credentials response doesn't say "session expired". **Do not** open-code per-status `if (err.status === ...)` chains in callers; either add the override, or — if a default is wrong project-wide — change the default in `api-errors.ts`.

### State

Prefer local component state. Reach for context only when state must cross many layers. Do not introduce a global state library without discussion.

### Styling

TailwindCSS only. No inline styles, no CSS modules, no separate `.css` files for component styles. Follow shadcn/ui patterns for new components.

### Types

Do not use `any`. If a type is genuinely unknown, use `unknown` and narrow it. Avoid type assertions (`as`) except when wrapping third-party APIs with known shapes.

---

## Infrastructure (Terraform)

- All changes go through `staging` before `production`.
- `terraform fmt -recursive infra/` must pass before any PR (CI enforces this).
- Do not hardcode resource names — use variables and locals.
- Tag every resource: at minimum `environment` and `project`.
- State is remote (HCP Terraform). Never run `terraform apply` locally against production.

---

## Code Review Checklist

Before requesting review:

- [ ] Linting passes (`make lint`)
- [ ] All tests pass (`make test`)
- [ ] New behavior has tests
- [ ] No secrets or credentials in code
- [ ] Response schemas don't leak sensitive fields
- [ ] Migrations are reversible
- [ ] PR description explains *why*, not just *what*
