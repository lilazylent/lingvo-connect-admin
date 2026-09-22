# Phase 12 Owner Patch 02 — Implementation Report

Build ID: `phase13-internal-works-20260919-r1`

## Root cause
The routed matching UI maintained `routeSelections` and manual `rateOverrides` separately from `DraftWork.executor_assignments`. A card could display `Выбран для этапа` while Step 06 still had zero assignments. The final route-confirmation control was additionally unavailable for candidates whose availability was `UNKNOWN`, because backend validation required the route to be `complete` (= FREE candidate on every stage).

## Implemented
- Routed candidate click immediately creates/replaces the stage `DraftExecutorAssignment`.
- Manual rate updates the already-selected assignment immediately.
- Existing assignments restore route-selection state and their saved rate is the effective displayed rate.
- Auto-suggestion no longer marks candidates as selected before manager confirmation.
- Backend routed persistence accepts `AVAILABLE` and explicit `UNKNOWN`, rejects `UNAVAILABLE`.
- Existing `assignmentPrice()` remains the wizard preview calculator; backend `assignment_auto_amount()` remains the persisted source of truth.
- Small Phase 05 owner CSS fix aligns `По умолчанию` left and stabilizes the availability badge.

## Regression case added
JA -> EN routed via RU, no availability periods, 14,534 chars, rates 500 ₽ and 250 ₽:
- each stage = 8.1 conditional pages;
- stage costs = 4,050 ₽ and 2,025 ₽;
- total executor cost = 6,075 ₽;
- persisted/reloaded rates and total remain identical.

## Verification
- `pytest -q tests/test_crm.py tests/test_operations.py`: 24 passed.
- Python compile: PASS.
- Alembic heads: `0021_order_number_v2 (head)`; no new migration.
- Foundation audit: PASS; contrast failures: 0.
- CSS ownership + Phase 08/09/10/11/12 audits: PASS.
- New assignment/calculator audit: PASS.
- CSS `!important`: remains baseline 30.
- TS syntax diagnostics (`TS1xxx`) for `crm-orders.tsx`: 0. Full typecheck/build is not claimed because the source ZIP has no installed frontend dependencies.
