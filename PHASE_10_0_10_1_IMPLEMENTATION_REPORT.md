# Lingvo Connect — Phase 10.0 + 10.1 implementation report

Build ID: `phase10-availability-calendar-20260917-r2`  
Baseline: `phase09-mvp-release-candidate-20260916-r3`

## Scope

Implemented only the approved Phase 10 foundation:

- architecture freeze for the future matching/routing engine;
- persisted executor availability calendar;
- Executor UI for real availability intervals;
- API CRUD, overlap protection, optimistic versions and activity logging;
- additive Alembic migration;
- static regression/audit coverage.

Matching, direct candidates, routing through Russian, ranking, Finance changes and automatic schedule generation were intentionally **not** implemented.

## Architecture decision

The existing business chain remains canonical:

`Order -> OrderWork -> ExecutorAssignment`

Phase 10 matching will extend this chain later. No `MatchedAssignmentV2`/parallel assignment subsystem was introduced.

Existing manual multi-executor assignment/split behavior remains untouched. Future automatic route stages will use one executor per production stage.

Executor capabilities continue to come from `ExecutorDirection`:

- canonical service code;
- bidirectional language pair;
- default rate;
- rate unit.

## Availability persistence

Added `ExecutorAvailability` / `executor_availability`.

States:

- `FREE` — Свободен;
- `BUSY` — Занят;
- `UNAVAILABLE` — Недоступен;
- `VACATION` — Отпуск.

Intervals use inclusive dates. Active intervals for one executor are not allowed to overlap. An empty calendar means availability is unknown; the system must not silently interpret it as free.

Migration:

`0019_executor_availability -> 0018_archive_status_scopes`

The migration is additive and does not rewrite existing executors, orders or assignments.

## API

Added:

- `GET /api/admin/executors/{executor_id}/availability`
- `POST /api/admin/executors/{executor_id}/availability`
- `PATCH /api/admin/executors/{executor_id}/availability/{availability_id}`
- `DELETE /api/admin/executors/{executor_id}/availability/{availability_id}?version=N`

Server validation rejects:

- end date before start date;
- overlapping active intervals;
- stale edit/remove versions;
- writes to archived executors.

Availability changes are written into the existing operational activity stream.

## Executor UI

Added a real `Доступность` tab to Executor detail.

Manager can:

- add a period;
- select a persisted state;
- edit a period;
- remove a period;
- add an optional note.

The empty state explicitly says `Доступность не указана` and explains that absence of calendar data is not treated as free.

Styles stay under the existing `phase4-directories.css` owner. No new competing Phase 10 stylesheet or token namespace was introduced.

## Regression / provenance

Updated current build provenance to:

`phase10-availability-calendar-20260917-r2`

Existing Phase 08/09 static provenance checks were updated only to follow the new build ID; their behavioral expectations were not relaxed.

`AGENTS.md`, the MVP phase ledger and CSS ownership map now record the Phase 10.0/10.1 contract.

## Verification actually executed

### Passed

- Python source/test compile: PASS.
- Alembic graph: PASS — one head: `0019_executor_availability`.
- Frontend foundation audit: PASS.
- CSS ownership audit: PASS.
- Phase 08 owner regression audit: PASS.
- Phase 09 release-candidate audit: PASS.
- New Phase 10 availability static audit: PASS.
- WCAG foundation contrast failures below 4.5: `0`.
- New `!important` declarations: `0`; total remains `30`.
- TS/TSX parser check over `apps/admin-web/src`: 44 files, 0 syntax diagnostics.
- New Phase 10 E2E spec TypeScript parse: 0 syntax diagnostics.

### Could not be executed in this container

Targeted backend pytest collection is blocked by the environment because `pyotp==2.9.0` is not installed. The package is declared in `apps/api/pyproject.toml`; an install attempt also failed because this execution environment has no network access.

Therefore the implementation report does **not** claim backend runtime tests passed here.

Frontend `node_modules` is also absent, so full Next `typecheck`, lint, production build and Playwright browser run were not claimed as executed. Static Node audits run without project dependencies and did pass.

## Local acceptance gate

Before promoting Phase 10.1 to the Phase 10.2 baseline, run locally with project dependencies installed:

1. `alembic upgrade head`;
2. backend targeted/full pytest;
3. frontend `npm run typecheck`;
4. `npm run lint`;
5. `npm run build`;
6. Phase 04 + Phase 10 Playwright tests;
7. manual Light/Dark and 320–1440+ Executor availability QA.

## Next phase boundary

Phase 10.2 may begin only after this foundation is accepted. Its first responsibility is the matching engine: determine direct suitable executor candidates from real service/language capabilities + availability, without auto-selecting a candidate.


## Owner correction 2026-09-17 — team calendar UX

The first 10.1 UI placed the availability editor inside the narrow executor detail panel. Owner review showed that this was the wrong operational level and also produced visible grid overflow for the comment field.

Corrected implementation:

- added `Список / Календарь` view switch to Executors;
- added a dedicated executor-by-date calendar matrix using real executor rows and persisted availability intervals;
- added previous/current/next week navigation;
- kept executor pagination and existing filters;
- made executor name column sticky and the date grid locally horizontally scrollable;
- clicking a date cell opens a bounded create/edit/delete availability dialog;
- removed the cramped inline editor from executor detail;
- executor detail `Доступность` now shows only a compact period summary plus a shortcut to the team calendar;
- no database or API contract changes were required; migration `0019_executor_availability` remains the head introduced by Phase 10.1.

Verification performed for this correction:

- `npm run audit:foundation` — PASS;
- `npm run audit:css-ownership` — PASS;
- `npm run audit:phase8-owner` — PASS;
- `npm run audit:phase9` — PASS after updating its boundary check to allow Phase 10.1 availability while still forbidding Phase 10 matching/routing markers;
- `npm run audit:phase10-availability` — PASS;
- `tinycss2` parse of `phase4-directories.css` — 0 parse errors;
- Python `compileall` for API + Alembic — PASS;
- targeted backend pytest could not collect because this execution environment still lacks `pyotp`; no backend code was changed in this owner correction;
- full Next build / Playwright were not run because the provided archive does not contain frontend `node_modules`.
