# Phase 10.4 Implementation Report — Routing through Russian

Build ID: `phase10-routing-through-russian-20260918-r1`
Baseline: `Lingvo_Connect_Admin_Phase_10_3_Matching_UI_v1.zip`

## Implemented

- Refactored the deterministic candidate matcher so the same factual matching primitive can evaluate arbitrary stage language pairs without changing direct-match semantics.
- Direct candidates remain first and unchanged.
- Added read-only `routed_match` to the existing executor-candidates response.
- For foreign-to-foreign works with active canonical `Русский`, the backend builds exactly two stages:
  1. source -> Русский
  2. Русский -> target
- Each stage returns real ExecutorDirection capability matches, default rate/unit, persisted availability and deadline compatibility.
- `UNKNOWN` availability remains unknown and manager-selectable; blocking states remain visible and unavailable for selection.
- Russian endpoint works do not create a redundant routed fallback.
- No route is invented when canonical Russian is absent from the language catalog.
- Frontend Phase 10.3 matching panel now shows a separate `Маршрут через русский` section for eligible works.
- The manager can locally select one factual candidate per stage. These selections intentionally remain UI state only in Phase 10.4.
- The UI explicitly states that persisted production stages, stage volume and cost are Phase 10.5 work. Routed choices are not flattened into ordinary ExecutorAssignment rows.
- Existing manual assignment and direct candidate selection remain unchanged.

## Intentionally not implemented

- RouteStage persistence or migration.
- Per-stage actual translated volume.
- Per-stage persisted rate/cost/status.
- Finance mutations.
- Automatic assignment or hidden recommendation scoring.
- Automatic BUSY creation.
- More than one intermediary language.
- Brand patch / final mobile stabilization.

## Verification actually run

### Backend
- `python -m py_compile` for modified matching/router modules: PASS.
- Targeted Phase 10.2 + 10.4 operations tests: 3 PASS.
- Full `tests/test_crm.py` + `tests/test_operations.py`: 18 PASS.
- Test execution used temporary external `/mnt/data/test_shims` for unavailable `pyotp`/`xlrd` imports only; shims are not included in the project.
- Alembic CLI: `0019_executor_availability (head)`. No migration added by Phase 10.4.

### Frontend/static
- Foundation audit: PASS; contrast failures below 4.5: 0.
- CSS ownership audit: PASS.
- Phase 08 owner regression audit: PASS.
- Phase 09 release-candidate audit: PASS.
- Phase 10.1 availability audit: PASS.
- Phase 10.3 matching UI audit: PASS.
- New Phase 10.4 routing audit: PASS.
- TypeScript compiler API syntax-only transpile over 44 `src/**/*.ts(x)` files: 0 syntax diagnostics.
- CSS `!important` debt remains 30 project-wide; no new `!important` was added.

### Not claimed as passed

A full Next.js typecheck/build and browser Playwright run were not executed because the source archive does not contain the frontend dependency tree (`node_modules`). A global `tsc` invocation reaches the project but reports missing React/Next/Playwright type packages, so it is not treated as a product typecheck result.

## Local acceptance focus

1. Open a persisted foreign-to-foreign work, e.g. `Японский -> Английский`.
2. Click `Подобрать исполнителя`.
3. Verify direct candidates remain first when any exist.
4. Verify `Маршрут через русский` shows exactly:
   - `Японский -> Русский`
   - `Русский -> Английский`.
5. Verify real candidates, rates and availability appear independently per stage.
6. Select one non-blocked candidate in each stage and verify the route-ready message appears.
7. Verify reloading/closing does not create ordinary executor assignments from the route selections yet.
8. Verify a `Русский -> Английский` work does not show the routed fallback.
