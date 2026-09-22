# Phase 11 — Implementation Report

Build ID: `phase11-data-integrity-20260918-r1`
Baseline: `phase10-finance-integration-20260918-r1`

## Goal
Close the client-review blocking persistence/calculator issues without starting the deferred service-driven work-form redesign.

## Implemented

### Conditional-page business rule
- Added a canonical backend helper for `1800 characters = 1 conditional page`.
- Character-derived conditional pages now round **upward to one decimal place**.
- Examples: `1800 -> 1.0`, `1801 -> 1.1`, `3601 -> 2.1`.
- Tariff `min_quantity` remains separate: a tariff may still bill a minimum of 1 page without corrupting the operational page count.
- Frontend draft calculation now uses the exact same ceil-to-tenth rule.
- Removed the frontend-only artificial `Math.max(1, ...)` from character-derived assignment/work volume calculation.

### Executor persistence / manual rate regression protection
The current Phase 10 persistence model was re-read before changes. It already persists manual per-assignment rate in `ExecutorAssignment.rate`; no new DB column was required.

Added an end-to-end backend regression proving that after wizard create and a fresh order GET:
- selected `executor_id` remains persisted;
- assignment-specific manual rate remains persisted;
- calculated conditional page count remains persisted;
- assignment cost remains persisted;
- order Finance executor cost remains identical;
- `ExecutorDirection.default_rate` is not mutated by an order-specific override.

This directly covers the client-reported failure mode instead of introducing a duplicate persistence mechanism.

## Database
No migration was required.

Alembic head remains:
`0020_executor_route_metadata`

## Verification actually executed
- `pytest tests/test_crm.py tests/test_operations.py -q`: **21 passed**.
- Python `compileall`: PASS.
- Alembic graph: exactly one head, `0020_executor_route_metadata`.
- Foundation audit: PASS, contrast failures 0.
- CSS ownership audit: PASS.
- Phase 08 / 09 regression audits: PASS.
- Phase 10 availability / matching UI / routing / client-demo / route-stage / finance audits: PASS.
- New Phase 11 data-integrity audit: PASS.
- CSS `!important` baseline remains 30; no new declaration was added.

### Production build
`npm run build` was attempted. The source archive does not contain `node_modules`, so the environment returned `next: not found`. Production build is therefore **not claimed as passed** and must be verified by the user's Docker frontend build.

## Explicitly deferred
- `YY-NNNN` order numbering and created-date presentation -> Phase 12.
- Internal/non-billable works -> Phase 13.
- Dynamic `service -> field schema` work-form redesign -> Phase 14, blocked until Oleg provides the canonical matrix.
