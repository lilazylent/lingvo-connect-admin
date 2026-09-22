# Phase 15 Pre-Release Audit Report

Build ID: `phase15-pre-release-audit-20260922-r2`

## Scope

Full pre-release audit of the Phase 15 CRM baseline before the first production commit and hosting rollout. The pass covered frontend action wiring, backend authorization and persistence, user administration, transient menus/popovers, database migration state, production configuration, secret hygiene, and regression audits.

## Defects found and fixed

### 1. User deletion was frontend-only
The Users UI called `DELETE /api/admin/users/{id}`, but the backend had no matching route. This was a real broken end-to-end action.

Fixed by adding a protected ADMIN-only delete endpoint with CSRF enforcement and database persistence.

Safety rules:
- an administrator cannot delete their own account;
- the last active ADMIN cannot be deleted or demoted/deactivated;
- a user referenced by operational CRM history through RESTRICT foreign keys is not hard-deleted; the API returns 409 and the account should be deactivated instead;
- authentication-only recovery codes and sessions are removed for a deletable unused account;
- deletion is recorded in the audit log.

### 2. ADMIN/MANAGER administration path was re-verified
The backend remains the authorization boundary. MANAGER cannot call user-administration endpoints directly.

ADMIN can:
- create users;
- create MANAGER or ADMIN accounts;
- change roles;
- activate/deactivate accounts;
- reset passwords;
- reset 2FA;
- delete an unused account subject to integrity safeguards.

MANAGER cannot:
- list/manage CRM users;
- create users;
- promote roles;
- reset another user's password/2FA;
- delete users;
- mutate ADMIN-only system configuration.

New backend regression tests cover direct API access, not merely hidden frontend buttons.

### 3. Three-dot action menus were inconsistent
Users and Orders already used the shared `ActionMenu`, while Applications still used a legacy `<details>` row menu. Dashboard also contained decorative `•••` that did not perform an action.

Fixed by:
- migrating Applications to the shared `ActionMenu`;
- removing the legacy document listener/menu path;
- replacing the fake Dashboard dots with a real navigation arrow;
- retaining one shared action-menu implementation for actual three-dot actions.

The shared menu:
- renders through `createPortal(document.body)`;
- uses fixed positioning;
- clamps to the viewport;
- flips upward when needed;
- closes on outside pointer interaction;
- closes on Escape;
- recalculates on resize/scroll.

### 4. Profile popover lifecycle
The profile menu now also closes on outside click in addition to Escape, preventing persistent floating UI when the user clicks elsewhere.

## Production hardening added

### Environment validation
Production settings now reject unsafe configuration when `ENVIRONMENT=production`:
- `COOKIE_SECURE` must be true;
- `ADMIN_WEB_ORIGIN` must be HTTPS;
- `PUBLIC_SITE_ORIGIN` must be HTTPS.

### CORS / API documentation
- production CORS is limited to the exact configured admin/public origins;
- localhost origins are development-only;
- FastAPI `/docs`, `/redoc`, and `/openapi.json` are disabled in production.

### Production Docker Compose
Added `docker-compose.prod.yml`:
- PostgreSQL has no public host port;
- backend is bound to localhost only;
- frontend is bound to localhost only;
- only the reverse proxy should be Internet-facing;
- database and application storage use persistent volumes;
- production env and health checks are explicit.

Added `.env.production.example` and `.env.example` with placeholders only.

### Repository hygiene
Added root `.gitignore` covering secrets, private keys, test databases, caches, node_modules, build output, local uploads and IDE artifacts.
Generated test/build artifacts were removed before packaging.

## Verification actually executed

### Frontend static audits
PASS:
- frontend foundation / contrast audit;
- CSS ownership audit;
- Phase 8–15 regression audits (during this pre-release pass);
- dedicated pre-release RBAC/action audit;
- Phase 15 deposit audit;
- UI-copy guard.

Current CSS debt baseline remains unchanged at 30 `!important` declarations. Contrast audit reports no failures below 4.5.

### Backend
PASS:
- `python -m compileall -q app`;
- `tests/test_auth.py`: 18 passed;
- `tests/test_applications.py`: 11 passed in the preceding isolated suite run;
- `tests/test_crm.py`: 19 passed in isolated run;
- `tests/test_operations.py`: 9 passed;
- `tests/test_crm_preferences.py`: 4 passed;
- `tests/test_totp_concurrency.py`: 1 passed;
- import tests excluding the real legacy XLS round-trip: 3 passed.

A combined auth/applications invocation printed all passing test markers but the container command transport timed out during teardown; the suites were therefore also validated separately rather than treating the timeout as a successful combined run.

### Database
PASS:
- single Alembic head: `0025_client_deposit_ledger`;
- no new migration is required by this pre-release patch.

## Environment limitations

The current execution container has no Docker daemon/binary, no network access, and does not contain the project `node_modules`. Therefore these checks cannot honestly be claimed here:
- real `docker compose build`;
- full Next.js production build;
- real legacy `.xls` round-trip using the external `xlrd/xlwt` packages.

Temporary test-only shims were used outside the project solely to run non-XLS backend suites and are not included in the release archive.

These three checks are mandatory in the deployment/SSH production pass before cutover.

## Database/business impact

- No business-calculation rules were changed.
- No schema migration was added.
- Existing Phase 15 deposit logic is unchanged.
- Existing customer, order, executor, tariff and finance data models remain compatible.

## Release status

This archive is the pre-release release candidate for the first CRM repository commit. It resolves the discovered broken user-delete action, strengthens RBAC safety, normalizes action-menu behavior, and adds production-safe configuration defaults without changing CRM business scope.
