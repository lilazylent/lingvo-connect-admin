# Phase 10.1 Owner Correction — Executor Team Calendar

## Baseline
Use `phase10-availability-foundation-20260916-r1` as the implementation baseline. Preserve the persisted availability model/API and all Phase 0–9 frozen behavior.

## Goal
Replace the cramped executor-detail availability editor with a full operational team calendar while retaining a compact executor-specific summary.

## Required UX
1. Executors has `Список / Календарь` views.
2. `Календарь` is a table/matrix: executor rows from the real database list, date columns, persisted availability state in each cell.
3. Empty cells mean `Доступность не указана`, never implicit free.
4. Calendar supports previous week, today/current week, next week.
5. Keep existing search/language/service/archive filters and executor pagination.
6. Keep the executor-name column visible while the date grid scrolls horizontally.
7. Clicking a date cell opens a bounded editor dialog for state, start date, end date and comment. If the day is inside an existing interval, edit that interval. Otherwise create a new one-day interval by default.
8. The dialog supports delete when editing an existing interval.
9. Executor detail `Доступность` contains only saved-period summary + `Открыть календарь исполнителей`; no cramped inline form.
10. 320–1440+ responsive behavior must not create document-level horizontal overflow.

## Boundaries
- Do not change `ExecutorAvailability` persistence or migration unless required by a proven defect.
- Do not implement candidate matching, ranking, routing, JP→RU→EN, automatic assignment or Finance changes.
- No fake availability values.
- No new `!important`.
- Keep styles in the Phase 04 directory owner because this remains the Executors workspace.

## Verification
Run foundation, CSS ownership, Phase 08, Phase 09 and Phase 10.1 audits. Parse touched CSS, compile backend, and run targeted tests/build/e2e only when dependencies are available. Never claim an unavailable check passed.
