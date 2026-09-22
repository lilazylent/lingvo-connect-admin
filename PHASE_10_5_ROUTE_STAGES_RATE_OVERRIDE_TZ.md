# Phase 10.5 — Persisted Route Stages, Actual Volume and Per-Assignment Rate Override

Baseline: `phase10-client-demo-matching-20260918-r1`

## Goal
Finalize the production semantics of executor assignments created by direct matching or the composite `A → RU → B` route. Each persisted assignment/stage must retain its route metadata, actual executor volume, billing unit, assignment-specific rate and calculated cost. In Step 05 `Исполнители`, managers must be able to override the suggested executor rate before assignment without changing the executor directory default rate.

## Existing source of truth
The current model already persists executor assignments with `route_stage_index`, route source/target languages, character/page volume, billing unit, rate, auto cost, actual cost, deadline and status. Reuse it. Do not introduce a parallel RouteStage table unless a verified gap requires it.

## Functional requirements
1. Direct match candidate cards show the directory default rate and a compact `Ставка вручную` action.
2. Activating manual rate reveals an assignment-specific rate input seeded from the default rate.
3. Selecting the candidate copies the overridden rate into the draft assignment. The executor directory default rate remains unchanged.
4. Composite route candidates support the same override independently for Stage 01 and Stage 02.
5. `Назначить предложенных исполнителей` persists the selected rate for each stage.
6. Existing assignment editor remains the authoritative detailed editor for actual character/page volume, billing unit, rate, deadline and cost.
7. Each routed stage can have a different actual volume after translation; cost is calculated from that stage's own volume and rate.
8. No hidden AI score or synthetic rate. Blank manual override falls back to the stored default rate.
9. No Phase 10.6 finance redesign in this phase; preserve current totals behavior.

## Acceptance criteria
- Direct candidate default 700 can be overridden to 850 before assignment; resulting assignment rate is 850 while executor default remains 700.
- Stage 01 and Stage 02 can use independent rates.
- Persisted routed assignments retain stage index, language pair, actual volume, rate and auto cost after order creation/readback.
- Changing Stage 01 actual volume does not mutate Stage 02 volume.
- Manual total-cost override continues to work independently from manual rate.
- Existing direct matching, routing, availability and old manual assignments regressions remain green.

## Non-goals
- Finance UI redesign.
- Automatic workload calendar updates.
- Arbitrary multi-hop routing.
- New route persistence subsystem.
- Brand/mobile final passes.
