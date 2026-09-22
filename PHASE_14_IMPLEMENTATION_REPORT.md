# Phase 14 — Implementation Report

Build: `phase14-service-driven-forms-20260921-r1`

## Implemented
- Added `app/service_definitions.py` as the canonical service schema for the matrix.
- Added migration `0024_service_work_fields`.
- Added service-specific OrderWork/ExecutorAssignment quantities: documents, seconds, hours, start date/time, certification mode.
- Rebuilt the Work draft UI around service-first dynamic fields.
- Added company-certification `Сшивка` / `Постранично` behavior.
- Applied the confirmed conditional-page minimum and upward rounding rule.
- Added seconds-based audio and hours-based interpreting volumes without inventing an unconfirmed audio minimum.
- Made tariff display and pricing requests service-aware.
- Made executor matching service-aware (`LANGUAGE_PAIR`, `SOURCE_LANGUAGE`, `SERVICE_ONLY`).
- Limited RU transit routing to written translation.
- Made backend assignment persistence sanitize quantities/billing unit against the canonical service schema.
- Kept internal/non-billable works and client/executor finance separation intact.
- Kept client balance/deposit/customer accounts/site integration explicitly out of scope.

## Verification
- Python compile: PASS.
- Backend regression suite: `tests/test_crm.py tests/test_operations.py` → **26 passed**.
- Alembic head: `0024_service_work_fields` (single head).
- Isolated migration `0024` smoke test: PASS.
- Phase 08–13.5 regression audits: PASS.
- Phase 14 service-driven audit: PASS.
- CSS ownership/foundation: PASS.
- Contrast failures below 4.5: 0.
- `!important`: 30, unchanged from baseline.
- TypeScript parse/syntax pass via global `tsc --noResolve`: 0 TS1xxx syntax diagnostics. Full typecheck cannot be established without project dependencies.
- `npm run build` was attempted, but the supplied source archive has no `node_modules`, so the local environment returns `next: not found`. Production build is therefore not claimed as passed.

## Migration note
A full historical Alembic chain cannot be smoke-tested against SQLite because earlier project migration `0002_applications` contains PostgreSQL `CREATE SEQUENCE`. The new `0024` migration itself was executed successfully in an isolated Alembic migration context, and backend regression tests pass.
