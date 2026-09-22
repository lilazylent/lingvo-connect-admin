# Phase 10.6 — Finance Integration Implementation Report

Build ID: `phase10-finance-integration-20260918-r1`

## Baseline
Implemented strictly on top of `Lingvo_Connect_Admin_Phase_10_5_Route_Stages_Rate_v1.zip`.

## Goal
Make persisted direct and routed executor assignment costs a transparent, auditable part of existing order economics without changing client pricing, tariff logic, matching, routing, or availability.

## What changed

### Backend finance source of truth
The existing `finance()` function remains the only order-economics calculator. It now additionally returns `executor_breakdown` grouped by work, with persisted active assignment details:
- executor identity;
- route stage index and direction;
- actual character/page volume;
- billing unit;
- assignment rate;
- calculated cost;
- actual cost;
- manual total-cost marker;
- paid amount/deadline/status metadata already present on the assignment.

Canonical totals remain:
- revenue = active `OrderWork.price` sum;
- executor cost = active persisted assignment costs, with legacy `OrderWork.executor_cost` used only for works with no active assignment rows;
- profit = revenue - executor cost;
- margin = profit / revenue × 100 (zero-safe).

This avoids double-counting routed stages and preserves old orders.

### Finance UI
`Заказ → Финансы` keeps the approved Phase 05 metric strip and gains a compact `Структура выплат` section.

For each work it shows the factual executor cost. Persisted assignments are shown separately. Routed assignments expose `Этап 01`, `Этап 02`, their language direction, executor, actual volume, assignment rate and actual cost. Direct assignments are labelled `Прямое назначение`.

When an assignment uses a manual total-cost override, the UI explicitly marks `Итог задан вручную`.

The UI renders backend finance facts; it does not independently calculate canonical profit or margin.

### Persistence / migrations
No schema change was necessary. Phase 10.5 already persisted all required route-stage and cost data on `ExecutorAssignment`.

Alembic remains:
`0020_executor_route_metadata (head)`

## Verification actually run

### Backend
`PYTHONPATH=/mnt/data/test_shims:. pytest -q tests/test_crm.py tests/test_operations.py`
- **20 passed**

The Phase 10 routed-order test now also asserts:
- client revenue: 4000.00;
- two executor stage costs: 2125.00 + 915.00;
- total executor cost: 3040.00;
- profit: 960.00;
- margin: 24.00%;
- two assignment rows in the finance breakdown;
- route stages remain 01 and 02.

`python -m compileall -q apps/api/app`
- **PASS**

`alembic heads`
- **PASS** — single head `0020_executor_route_metadata`

### Frontend/static regression
Actually run and passed:
- `audit-frontend-foundation.mjs`
- `audit-css-ownership.mjs`
- `audit-phase8-owner-patch.mjs`
- `audit-phase9-release-candidate.mjs`
- `audit-phase10-availability.mjs`
- `audit-phase10-matching-ui.mjs`
- `audit-phase10-routing.mjs`
- `audit-phase10-client-demo.mjs`
- `audit-phase10-route-stages.mjs`
- `audit-phase10-finance.mjs`

Foundation results remain:
- missing required tokens: 0;
- contrast failures below 4.5: 0;
- `!important`: 30, no new declaration introduced.

Global TypeScript CLI parsed the source with **0 TS1xxx syntax diagnostics**. Full typecheck cannot be treated as passed because project dependencies/types are not installed in this runtime.

### Production build
`npm run build` was attempted and stopped with `next: not found` because the source archive intentionally does not contain `node_modules`. Therefore production build is **NOT CLAIMED AS PASS** here. Local Docker rebuild is required and is the correct final runtime gate.

## Scope intentionally not changed
- client tariffs and client-price calculation;
- matching/ranking rules;
- availability calendar;
- Russian routing rules;
- assignment default/manual-rate semantics;
- automatic calendar BUSY generation;
- database schema;
- order statuses/pipelines;
- Phase 10.7 branding;
- Phase 10.9 mobile stabilization.

## Recommended client-demo check
Create or open a routed `JA → EN` order with two persisted stages, assign different rates/volumes, then open `Финансы`. Confirm that `Выплаты исполнителям` equals the sum of the two stage costs and that `Структура выплат` shows both stages independently while client revenue remains unchanged.
