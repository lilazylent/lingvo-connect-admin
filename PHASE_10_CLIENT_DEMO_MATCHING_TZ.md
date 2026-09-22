# Lingvo Connect — Priority Client Demo Matching Patch

## Goal
Deliver the agreed executor-matching flow in the **new order wizard, Step 05 «Исполнители»** before the client meeting, using the existing Phase 10 backend matcher and availability calendar as the source of truth.

## Baseline
Source of truth: `Lingvo_Connect_Admin_Phase_10_4_Routing_v1`.

Existing accepted foundation:
- bidirectional `ExecutorDirection` language pairs;
- factual `ExecutorAvailability` calendar (`FREE`, `BUSY`, `UNAVAILABLE`, `VACATION`, unknown when no row exists);
- direct matching backend;
- fallback `A → Русский → B` discovery;
- manager-controlled assignment editor.

## Required behavior
### Direct match
For `A → B`, find executors whose saved unordered language pair is `A ↔ B` and whose service matches the work.
- `FREE` on the required date = automatically viable.
- `BUSY`, `UNAVAILABLE`, `VACATION` = visible factual evidence but not a suggested/assignable primary option.
- no calendar evidence = `Доступность не указана`; manual manager selection remains possible.
- multiple equally available direct candidates are ordered deterministically; known positive lower rate is used as a stable tie-breaker, then name/id.

A confirmed available direct candidate suppresses the composite fallback route.

### Composite route
Only when there is no confirmed available direct candidate and both endpoints are non-Russian:
1. `A → Русский`
2. `Русский → B`

The route is considered complete only when each stage has at least one `AVAILABLE` executor.
The UI automatically preselects the first deterministic available candidate per stage as the proposed route, but does **not** persist it until the manager clicks `Назначить предложенных исполнителей`.

### New-order wizard Step 05
Matching starts automatically when Step 05 is rendered. The wizard sends the unsaved work parameters to a backend preview endpoint; no matching business logic is duplicated in React.

Direct candidates show:
- executor name;
- matched pair;
- service;
- default rate/unit when present;
- availability state;
- required date.

Composite route shows two explicit stage blocks with the same factual candidate contract.

### Persistence
The pre-existing `ExecutorAssignment` model could store multiple executors but could not distinguish which executor handled `JA → RU` vs `RU → EN`. Therefore a minimal additive extension is required:
- `route_stage_index` nullable integer;
- `route_source_language` string;
- `route_target_language` string.

No separate RouteStage aggregate/table is introduced.
Manual/direct assignments continue to use null/empty route metadata.
Composite assignments must contain exactly stages 1 and 2 and are revalidated against current matching/availability before persistence.

## API
New read-only preview endpoint:
`POST /api/admin/orders/executor-candidates/preview`

Input:
- `service_code` / `work_type`;
- `source_language`;
- `target_language`;
- `deadline`;
- `executor_deadline`;
- optional `order_deadline`.

It calls the same backend matching engine as persisted-work matching.

Existing persisted endpoint remains:
`GET /api/admin/orders/{order_id}/works/{work_id}/executor-candidates`

## Numbered badge correction
The semantically identical square work-number badge uses a shared `.lc-number-badge` pattern:
- grid centering;
- equal width/height;
- zero padding/margin drift;
- line-height 1;
- tabular numerals.

Applied to order work cards and work-editor numbered modules (`01`, `02`, etc.) through the Phase 05 owner stylesheet.

## Acceptance criteria
1. RU → EN finds an available RU ↔ EN executor.
2. EN → RU finds the same capability.
3. JA → EN without a direct available executor exposes JA → RU → EN.
4. A BUSY stage executor does not make a composite route complete.
5. An available direct JA ↔ EN executor takes priority over the RU route.
6. No matching capability yields an explicit no-match/manual path.
7. Multiple direct candidates have stable deterministic ordering.
8. Wizard Step 05 automatically calls backend preview matching.
9. Composite route confirmation persists two assignment rows with stage metadata.
10. Route assignments are revalidated before save.
11. The numbered `01`/`02` work badges are centered by the shared owner style.
12. Existing direct/manual assignment flows remain compatible.
