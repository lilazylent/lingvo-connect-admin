# Phase 10.5 — Implementation Report

Build ID: `phase10-route-stages-rate-20260918-r1`
Baseline: `phase10-client-demo-matching-20260918-r1`

## Scope delivered

Phase 10.5 formalizes the already introduced persisted routed assignments instead of creating a second route-stage subsystem. `ExecutorAssignment` remains the production record for direct and routed work and already stores stage index/languages, actual volume, billing unit, assignment rate, auto cost, actual cost, deadline and status.

The owner-requested Step 05 rate override is now available directly on matching candidates:

- every direct candidate keeps its stored executor-direction default rate visible;
- `Ставка вручную` reveals an assignment-specific rate input;
- the input starts from the default rate but writes only to the order assignment draft;
- `Вернуть ставку по умолчанию` discards the override;
- route Stage 01 and Stage 02 use independent override keys and may therefore have different rates;
- selecting/confirming the candidate copies the effective rate into the existing `DraftExecutorAssignment`;
- executor directory `default_rate` is never mutated by the override.

The detailed assignment editor remains the source for the final actual stage volume (`character_count` / `page_count`), billing unit, rate, deadline and optional manual total cost. Backend persistence and `assignment_auto_amount` remain the cost source of truth.

## Data model / API

No new persisted model and no new migration were required in Phase 10.5.

The current baseline already contains migration `0020_executor_route_metadata`, which added the minimal route metadata required by the prior client-demo patch. Phase 10.5 reuses:

- `route_stage_index`
- `route_source_language`
- `route_target_language`
- `character_count`
- `page_count`
- `billing_unit`
- `rate`
- `auto_cost`
- `cost`

No API contract was changed.

## Regression coverage added

The existing routed-wizard backend test now persists two route stages with deliberately different production values:

- Stage 01: 4500 characters, assignment rate 850 ₽ (directory default remains 720 ₽), expected auto cost 2125 ₽;
- Stage 02: 2700 characters, assignment rate 610 ₽ (directory default remains 620 ₽), expected auto cost 915 ₽.

It verifies that stage volume/rate/cost remain independent and that assignment-specific rate overrides do not mutate executor directory defaults.

## Verification actually run

- Python compile: PASS.
- `pytest -q apps/api/tests/test_crm.py apps/api/tests/test_operations.py`: **20 passed**.
- Alembic heads: **one head** — `0020_executor_route_metadata`.
- Foundation audit: PASS; missing tokens 0; contrast failures below 4.5: 0.
- CSS ownership audit: PASS.
- Phase 08 owner regression audit: PASS.
- Phase 09 release-candidate audit: PASS.
- Phase 10.1 availability audit: PASS.
- Phase 10.3 matching UI audit: PASS.
- Phase 10.4 routing audit: PASS.
- Client-demo matching audit: PASS.
- New Phase 10.5 route-stage/rate audit: PASS.
- TypeScript/TSX syntax transpile: PASS, 44 files.
- Global CSS `!important` count remains **30**; no new declarations added.

## Production build

`npm run build` was attempted. It could not start because the source archive intentionally contains no `node_modules`, so the local container reports `next: not found`. Therefore production build is **NOT CLAIMED AS PASS** in this environment. The Docker frontend rebuild below is the runtime gate on the user's machine.

## Explicit non-goals preserved

- no Phase 10.6 Finance redesign;
- no automatic calendar workload generation;
- no arbitrary multi-hop routing;
- no hidden ranking percentage/AI score;
- no brand redesign;
- no final mobile stabilization pass.
