# Phase 13 Implementation Report

Build ID: `phase13-internal-works-20260919-r1`

## Implemented
- Added persisted `OrderWork.client_billable` with migration `0022_non_billable_works`.
- Existing works default to billable during migration.
- Wizard and work editor expose `Не учитывать в расчёте для клиента`.
- Wizard client total excludes internal works.
- Backend `finance()` client revenue excludes internal works while executor cost still includes all assignments.
- Client payment `amount_due` is synchronized from billable works only.
- Preliminary client calculation text filters out internal works entirely.
- Finance executor breakdown identifies internal works.
- Order work cards mark internal works and show client cost as `Не учитывается`.
- Routed assignment confirmation now collapses to `Исполнители успешно назначены` with `Редактировать`.

## Data model
New additive migration:
`0022_non_billable_works` -> adds `order_works.client_billable BOOLEAN NOT NULL` and index.

## Verification
- `tests/test_crm.py + tests/test_operations.py`: 25 PASS.
- Python compile: PASS.
- Alembic heads: exactly `0022_non_billable_works (head)`.
- Foundation audit: PASS, contrast failures 0.
- CSS ownership: PASS.
- Phase 08/09/10/11/12 audits: PASS.
- Phase 13 audit: PASS.
- Production build attempted but cannot run in this source archive environment because `node_modules` is absent (`next: not found`).
- Full backend suite collection is additionally blocked in this environment by missing optional test dependency `xlwt`; targeted CRM/operations regression suite passes.

## Intentionally not implemented
Phase 14 dynamic service-specific field schemas remain frozen until Oleg provides the authoritative service-to-fields matrix.
