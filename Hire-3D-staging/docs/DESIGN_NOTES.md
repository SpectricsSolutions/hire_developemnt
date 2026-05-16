# Design Notes

Behavioural choices that aren't obvious from reading the code. Each note captures the **decision**, the **reason**, and a **revisit when** trigger so we can re-evaluate when conditions change.

Add a note here whenever a reviewer might reasonably ask "why does it do that?" and the answer is not in the diff.

---

## Permissions: silent-drop on unknown names

**Where:** `roles/services.py` — `RolesService.create_role` and `update_role`.

**Decision:** when a request supplies permission names (`RoleCreate.permissions` / `RoleUpdate.permissions`), the service resolves them via `RolesStore.get_permissions_by_names(names)` and uses **only** the rows that match. Unknown names are silently ignored — no `422`, no `409`, no warning. The role is created/updated with a possibly smaller permission set than the admin asked for.

**Reason:** kept lenient deliberately while RBAC is still maturing. The cost of strictness today is small, but it would couple the API contract tightly to the seeded `ALL_PERMISSIONS` list — every change to that list could surface as a `422` for callers that haven't been updated.

**Why this is a real footgun:** permissions are a fixed, seeded set (currently 13 entries). Admins typing them by hand or pasting them in cannot detect typos through the UI — the role looks created successfully, and the gap is only noticed when a user can't perform an action they expected to be granted.

**Revisit when:**
- A `GET /api/v1/permissions` endpoint exists so the frontend can offer a checklist instead of free-text → at that point the FE can prevent invalid names entirely and the server can flip to strict (return 422 listing the unknown names) cheaply.
- We see real bug reports tracing back to a typo'd permission name.

**If we flip later** — drop-in change in `RolesService.create_role` / `update_role`:
```python
permissions = await self.store.get_permissions_by_names(data.permissions)
unknown = set(data.permissions) - {p.name for p in permissions}
if unknown:
    raise ConflictError(f"Unknown permission(s): {', '.join(sorted(unknown))}")
```

---

## `meta` columns default to `{}` not `null`

**Where:** `common/mixins.py` — `MetadataMixin[T]`. Affects `clients`, `engagements`, `users` (whose `Meta` Pydantic models are currently empty placeholders) and `audit_logs` (whose `AuditMeta` carries real `before`/`after` payload).

**Decision:** `meta` is `nullable=False` and an empty meta-model serialises to `{}`. Never `null`.

**Reason:** the `MetadataMixin[T]` contract is *"every row has a typed `T` payload."* Once a real field appears on `ClientMeta` (for example), readers can dereference `client.meta.foo` without `None` guards. Switching to nullable now would propagate `Mapped[T | None]` through the type system for zero current benefit and force every future reader to coalesce.

**Cost of the current choice:** a few wasted bytes per row for the empty placeholders.

**Revisit when:**
- The empty meta columns (`ClientMeta`, `EngagementMeta`, `UserMeta`) still have no fields a year from now → drop the columns entirely rather than flip them nullable.

---

## `audit_logs` is append-only at the database

**Where:** migration `f3c1d9a2b847_audit_logs_append_only` installs Postgres `BEFORE UPDATE` and `BEFORE DELETE` triggers that raise `audit_logs is append-only`.

**Decision:** even with full SQL access (e.g. via the bastion), nobody can mutate the audit trail without first dropping the trigger.

**Reason:** the audit trail backs compliance. A defence-in-depth control here is cheap and mostly invisible to application code (we never UPDATE/DELETE these rows anyway).

**Test-environment note:** `Base.metadata.create_all` (used in `tests/conftest.py`) does not run migrations, so the trigger is **not present in the test DB**. Integration tests can't lock down the trigger directly. Acceptable trade-off: we test the application contract (no UPDATE/DELETE endpoints exist; the service only writes), and trust the migration as the source of truth for the DB-level invariant.

---

## `User.permissions` is a runtime attribute, not a column

**Where:** `users/models.py` declares `permissions: ClassVar[set[str]]`. `auth/dependencies.py:get_current_user` populates it per request.

**Decision:** permissions are *not* persisted on the `User` row. They're computed from `User.role.permissions` at the start of every authenticated request and stitched onto the loaded model so views and services can read `current_user.permissions` without an extra round trip.

**Reason:** keeps the data model normalised (single source of truth: `role_permissions`) while giving downstream code a fast, read-friendly view.

**Pitfall:** code that reaches `User` outside the auth flow (e.g. `tests/factories.make_user`) does **not** get `permissions` set. Unit tests that exercise authorization must seed the attribute themselves. The mock factory in `tests/unit/auth/helpers.py` sets `user.permissions = set()` by default for that reason.

**Revisit when:**
- Permissions become user-scoped (per-user grants outside their role) → at that point `permissions` may need to be a relationship, not a derived set.

---

## API errors always carry `{success, message, errors?}`

**Where:** `api/__init__.py` exception handlers, including the catch-all `@app.exception_handler(Exception)`.

**Decision:** every response from our app — happy path or any error — is wrapped in the envelope. The catch-all guarantees even uncaught Python exceptions return `500 {"success": false, "message": "Internal server error."}`, never plain text.

**Frontend assumption built on this:** `app/src/lib/api-errors.ts` resolves messages with `err.message || …` fallbacks for the rare cases where the response did not come from us (network failure, Cloudflare/ALB intermediary error). 5xx server messages are always masked client-side regardless.

---

## 401 default in `applyApiError` overrides the server message

**Where:** `app/src/lib/api-errors.ts` — `STATUS_DEFAULTS[401]`.

**Decision:** the helper hard-substitutes `"Your session has expired. Please sign in again."` for any `401`, regardless of what the API said. The login form passes its own override `{ 401: 'Invalid email or password' }` to undo this for bad-credentials.

**Reason:** the API's 401 handler returns a fixed `"Unauthorized."` string — not user-friendly. Outside the login flow, a 401 almost always means the access token expired.

**Watch out for:** any new endpoint returning a 401 with a message we *want* to surface (e.g. "Your IP has been blocked"). Pass `{ 401: undefined }`-equivalent — currently the helper has no opt-out sentinel; if this comes up, add one (e.g. a `null` value in `overrides` meaning "use server message").
