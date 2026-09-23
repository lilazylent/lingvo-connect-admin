# Phase 16 — Implementation Report

Implemented the first owner-feedback production correction batch as one cohesive release. Roles/permissions were intentionally implemented last after pricing, numbering and layout corrections.

## Delivered
- Base urgency changed from x1.5 to x1.0 across model/API/frontend defaults.
- Tariff urgency removed from Settings; tariff form now adapts language/unit controls to the selected service.
- Order number output changed to `YY-NNNN`; migration normalizes historical `YY-0-NNNN` values.
- Orders toolbar gets responsive 3/2/1-column fallbacks and shared mobile overflow hardening.
- Written-translation work editor follows the owner-requested two-column field grouping.
- Translator type labels clarified.
- Calculation step widths rebuilt so tariff unit and auto calculation text remain readable.
- Payment method constrained to cash / cashless / deposit.
- Added dynamic DB-backed role definitions and module permissions with backend enforcement.
- Added role administration UI and dynamic role assignment in invitations/users.
- Preserved last-admin protection and protected system ADMIN role.
- Added Alembic revision-length fix required for clean production installs.
- Added `compose.beget.yml` containing the production network aliases and frontend bind fix discovered during Beget deployment.
- Added Phase 16 static UI audit.

## Verification performed in this build workspace
- Python syntax compilation: passed for application, routers, migrations and tests.
- Backend regression suite: **69 tests passed** across applications, auth/RBAC, CRM, preferences, operations, pre-release cleanup and TOTP concurrency. The isolated runner used a temporary local TOTP shim only because the container does not have `pyotp` installed; the project source/dependencies were not changed by that shim.
- TypeScript/TSX syntax transpilation through the installed TypeScript compiler: passed for all 45 frontend source files.
- `audit:phase16-owner-feedback`: 11/11 checks passed.
- Full `npm ci` / Next production build could not be executed in this isolated container because external package-registry access is disabled. No `node_modules`, build cache or generated dependency artifacts are included in the release ZIP.
- Spreadsheet import tests were not part of the 69-test run because the isolated runner lacks `xlrd/xlwt`; Phase 16 does not modify spreadsheet-import code.

## Deployment note
Before production deployment, run normal backend migrations and rebuild affected frontend/backend services. The Beget override must be used together with `docker-compose.prod.yml`; do not delete production volumes.

## Owner Patch 02 — order title removal
- Removed the user-facing `Название заказа` field from new-order and order-edit flows.
- Removed title/fallback rendering from table, Kanban, order card, dashboard, client order history and order file context.
- Changed order search copy/behavior to canonical order number plus client/executor context.
- Simplified spreadsheet order import so a title column is no longer required; generated CRM number is the order identity.
- Retained the DB title column only as an internal compatibility field; new orders store the generated number there so older integrations are not broken.
- Folded in the two post-package TypeScript fixes in `crm-settings.tsx` so this ZIP contains the buildable Phase 16 source rather than the original broken package.
