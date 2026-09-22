# Phase 10.1 Owner Correction — Executor Team Calendar

Build: `phase10-availability-calendar-20260917-r2`
Baseline: `phase10-availability-foundation-20260916-r1`

## Owner feedback addressed

The first availability UI was too narrow and local: the create/edit form lived inside the executor detail panel, causing visible grid overflow (especially the comment field) and forcing the manager to inspect executors one by one.

The corrected UX makes availability a team-level workspace.

## Implemented

- Added `Список / Календарь` switch to the Executors route.
- Added a dedicated team calendar matrix:
  - rows = real executors from the current filtered database page;
  - columns = seven calendar dates;
  - cells = persisted `FREE / BUSY / UNAVAILABLE / VACATION` state;
  - empty cell = `Доступность не указана`, never implicit free.
- Added previous week / today / next week navigation.
- Kept existing executor filters, archive mode and pagination.
- Added sticky executor-name column and local horizontal scrolling for date columns.
- Clicking a cell opens a bounded editor dialog.
- Existing interval -> edit the whole interval; empty day -> create a one-day interval by default.
- Editor supports state, start/end dates, comment and deletion.
- Removed the cramped inline editor from executor detail.
- Executor detail `Доступность` now shows saved periods + `Открыть календарь исполнителей`.
- No backend schema/API changes were required; migration `0019_executor_availability` remains unchanged.
- No matching, candidate ranking, route building or Finance logic was added.

## Verification actually run

- `npm run audit:foundation` — PASS
- `npm run audit:css-ownership` — PASS
- `npm run audit:phase8-owner` — PASS
- `npm run audit:phase9` — PASS
- `npm run audit:phase10-availability` — PASS
- `tinycss2` parse of `phase4-directories.css` — 0 parse errors
- Python `compileall` for API/Alembic — PASS
- CSS `!important` count remains 30

## Checks not claimed as passed

- Full Next production build/typecheck/lint: archive has no frontend `node_modules`.
- Playwright runtime suite: same dependency limitation.
- Targeted backend pytest could not collect because this execution environment lacks `pyotp`; backend code was not changed in this correction.

## Local acceptance focus

1. Open `Исполнители` -> `Календарь`.
2. Confirm names are rows and dates are columns.
3. Confirm existing persisted periods paint only their covered dates.
4. Click an empty cell and add a status period.
5. Click a filled cell and edit/delete the existing interval.
6. Check 1440 / 1024 / 768 / 390 widths: only the calendar grid should scroll horizontally; the document itself should not.
7. Open one executor -> `Доступность`: there must be no cramped inline form, only summary + calendar shortcut.
