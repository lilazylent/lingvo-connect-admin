# Phase 10.3 — Direct Matching UI Implementation Report

Build ID: `phase10-direct-matching-ui-20260918-r1`
Baseline: `Lingvo_Connect_Admin_Phase_10_2_Direct_Matching_v1.zip`

## Result

Phase 10.3 integrates the existing Phase 10.2 read-only direct executor candidate API into the existing OrderWork assignment editor. No parallel assignment model, backend mutation endpoint, route-stage system, routing-through-Russian logic, Finance change, or migration was introduced.

## Implemented behavior

### Manager-triggered matching

For an existing persisted work opened through `Работы -> Изменить`, the `Исполнители и их объём` header now contains:

- `Подобрать исполнителя`
- existing `Добавить исполнителя +`

Candidate loading occurs only after the manager presses `Подобрать исполнителя`.

Endpoint consumed:

`GET /api/admin/orders/{order_id}/works/{work_id}/executor-candidates`

### Candidate presentation

The UI renders backend facts only:

- executor name;
- matched saved language pair;
- canonical service/name;
- default rate and rate unit;
- required matching date;
- factual availability state;
- saved availability period/note when present.

State presentation:

- `AVAILABLE` -> `Свободен`;
- `UNKNOWN` -> `Доступность не указана`;
- blocking persisted states -> `Занят`, `Отпуск`, or `Недоступен`.

No score, percentage, rating, synthetic recommendation, "best" marker, or frontend re-ranking was added.

### Manual selection boundary

Selecting a candidate creates a normal `DraftExecutorAssignment` inside the existing `ExecutorAssignmentsEditor`.

Autofilled defaults:

- executor id;
- saved executor default rate;
- saved rate unit;
- current work character/page volume;
- executor deadline, otherwise work deadline;
- existing work deadline time fallback.

The manager may still edit the assignment-specific rate, unit, volume, deadline, cost mode and status before saving.

Selection itself does **not** write to the backend. Persistence remains behind the existing `Сохранить работу` action.

If the executor is already in the draft, the candidate action becomes `Уже выбран`; no duplicate assignment is created.

A candidate blocked on the matched required date remains visible for explanation but the action is disabled as `Недоступен на срок`.

`UNKNOWN` remains manager-selectable because the system does not invent unavailability or availability; the explicit warning remains visible.

### Safe stale-data handling

The Phase 10.2 endpoint evaluates persisted work fields. Therefore direct matching is disabled when the manager has unsaved changes to:

- service;
- source language;
- target language;
- executor deadline;
- work deadline.

The UI asks the manager to save the work before refreshing candidates. This prevents a candidate list based on stale persisted matching inputs.

New unsaved works keep the existing manual assignment flow and do not call persisted matching.

### Empty/error states

- missing matching inputs -> explicit `Недостаточно данных для подбора` with the missing fields;
- zero direct candidates -> `Исполнитель не найден` plus `Добавить вручную`;
- request failure -> existing shared `ErrorState`;
- loading -> existing shared `LoadingState`.

## UX / CSS ownership

All new Orders matching UI styles live in the existing Phase 05 owner:

`apps/admin-web/src/app/phase5-orders.css`

No `phase10.css`, no new token namespace, and no new `!important` declaration were introduced.

The candidate list uses a two-column desktop grid, one-column <=900px, and stacked controls/facts <=620px.

## Regression/audit maintenance

The build provenance is now:

`phase10-direct-matching-ui-20260918-r1`

Historic Phase 08/09/10.1 audits were updated only where required to accept the new build provenance. The Phase 09 audit no longer treats the now-approved direct candidate endpoint as illegal future leakage, but it still forbids Phase 10.4 routing markers (`VIA_RUSSIAN`, `ROUTE_VIA_RUSSIAN`).

A dedicated audit was added:

`npm run audit:phase10-matching-ui`

The existing Phase 05 Orders Playwright fixture was extended with deterministic Phase 10.3 candidate data and a test covering AVAILABLE / UNKNOWN / UNAVAILABLE presentation, duplicate guard and rate autofill.

## Verification actually run

PASS:

- `node scripts/audit-frontend-foundation.mjs`
- `node scripts/audit-css-ownership.mjs`
- `node scripts/audit-phase8-owner-patch.mjs`
- `node scripts/audit-phase9-release-candidate.mjs`
- `node scripts/audit-phase10-availability.mjs`
- `node scripts/audit-phase10-matching-ui.mjs`
- TypeScript parser/transpile syntax pass across `src` + `e2e`: 60 TS/TSX files, 0 syntax diagnostics
- `python -m compileall -q apps/api/app`
- byte comparison against Phase 10.2 baseline confirms `apps/api` backend source is unchanged
- migration file count unchanged: 21 -> 21
- foundation contrast failures below 4.5: 0
- total legacy `!important` debt remains 30

NOT RUN in this container:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Playwright browser execution

Reason: the delivered source archive does not contain `apps/admin-web/node_modules`. The new Playwright scenario is included for local execution after dependencies are installed.

## Explicit non-goals preserved

Not implemented in Phase 10.3:

- routing through Russian;
- route stages;
- automatic executor selection;
- autosave on candidate selection;
- automatic BUSY generation;
- Finance integration changes;
- brand redesign;
- Phase 10.9 mobile stabilization;
- database migration.

## Local update

This patch changes frontend source only. Phase 10.2 backend and migration state remain current.

```powershell
cd "ПУТЬ-К-ПРОЕКТУ"

docker compose build frontend
docker compose up -d frontend
```

No Alembic command is required for this patch.

## Local acceptance path

1. Open `Заказы`.
2. Open an order containing a persisted work with service + language pair.
3. Open `Работы`.
4. Click `Изменить` on that work.
5. In `Исполнители и их объём`, click `Подобрать исполнителя`.
6. Verify candidate facts and availability states.
7. Select an AVAILABLE or UNKNOWN candidate.
8. Verify a normal executor assignment appears with default rate/unit and copied work volume/deadline.
9. Adjust assignment-specific values if needed.
10. Click `Сохранить работу` to persist the selection.
