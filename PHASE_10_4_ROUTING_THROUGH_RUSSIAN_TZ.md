# Phase 10.4 — Routing through Russian

## Goal
Extend the accepted Phase 10.2/10.3 direct matching flow with a factual two-stage fallback route through Russian for foreign-to-foreign translation works, without introducing persisted route stages yet.

## Baseline
- Phase 10.2 read-only direct matching API is canonical.
- Phase 10.3 manager selection UI is canonical.
- Executor capabilities are bidirectional.
- Availability is factual: FREE / BUSY / UNAVAILABLE / VACATION / UNKNOWN.
- `UNKNOWN` is never treated as FREE.
- Existing `Order -> OrderWork -> ExecutorAssignment` stays intact.

## Scope
For a work such as `Японский -> Английский`, when Russian exists in the canonical language catalog, construct a deterministic internal fallback route:
1. `Японский -> Русский`
2. `Русский -> Английский`

Each stage exposes the same factual candidate contract as direct matching:
- executor identity;
- matched capability pair;
- service;
- default rate and rate unit;
- availability state;
- deadline compatibility.

The backend returns stage candidate sets. It does not persist stages, assignments, volumes, costs, or automatic selections in Phase 10.4.

## Eligibility
Routing is available only when:
- the work is otherwise matchable;
- source and target are both non-Russian;
- source and target are different;
- active canonical Russian language exists.

For RU->EN / EN->RU works no routed fallback is generated because Russian is already an endpoint.

## Manager UI
The existing `Подобрать исполнителя` panel keeps direct candidates first.
For eligible foreign-to-foreign work it also shows `Маршрут через русский` with exactly two sequential stage blocks.

The manager can inspect factual candidates per stage and select one candidate for each stage in local UI state. Selection is not persisted yet. The UI must explicitly communicate that route persistence/volumes arrive in Phase 10.5 rather than silently creating ambiguous ordinary assignments.

Blocked candidates remain visible and cannot be selected. AVAILABLE and UNKNOWN remain selectable, consistent with Phase 10.3.

## No-candidate states
If either stage has no capability candidates, show `Исполнитель не найден` for that stage and preserve the existing manual-assignment path. Do not synthesize a route.

## Out of scope
- persisted RouteStage model;
- migration;
- route-stage actual volume;
- route-stage cost persistence;
- Finance changes;
- automatic assignment;
- automatic BUSY generation;
- route chains through languages other than Russian;
- scoring/rating/recommendation percentages;
- Phase 10.9 mobile stabilization.

## Acceptance criteria
1. JP->EN can expose JP->RU and RU->EN candidate sets from real ExecutorDirection rows.
2. Bidirectional capabilities work on both stages.
3. Direct foreign-to-foreign candidates remain visible and are not replaced by routing.
4. RU endpoint works do not generate a redundant Russian route.
5. Availability state and deadline compatibility are preserved per stage.
6. Missing candidates are explicit per stage.
7. No database mutation occurs when loading or selecting a routed candidate in Phase 10.4.
8. Existing direct matching/manual assignment behavior remains unchanged.
9. No migration is added.
10. Phase 0–10.3 regression audits continue to pass.
