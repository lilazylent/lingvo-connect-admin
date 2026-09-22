# Phase 06 — Files + Users + Settings — Implementation report

Baseline: accepted `Phase 05 E2E Last 1 Fix`.
Status: implementation candidate complete; requires owner runtime/visual acceptance.

## Delivered

### Files
- Rebuilt as a compact list + selected-file workspace instead of a legacy plain table.
- Real search/source/type filters and existing CSV/XLSX export contracts retained.
- Real upload flow selects an existing Order or Application and posts to its existing file endpoint.
- Safe browser preview endpoints added for PDF/image/text formats only; unsupported formats do not receive a fake preview action.
- Real Download and `Перейти к источнику` actions retained.
- Dark-safe semantic surfaces/buttons/text; row download icons remain inside control bounds.

### Users
- Rebuilt into the shared list/detail/editor workspace pattern.
- Search, role and status/2FA filters use existing backend data.
- Shared `ActionMenu` renders through a portal, clamps to the viewport, opens upward when needed, and closes on outside click / Escape.
- Destructive actions retain confirmation; self-deactivation/deletion remains blocked.

### Settings
- One six-module contract from the MVP spec:
  1. Справочники
  2. Тарифы
  3. Скидки и коэффициенты
  4. Оформление
  5. Услуги и единицы
  6. Статусы заказов
- New persisted canonical Languages directory.
- Tariff language fields reuse `LanguageCombobox`.
- Executor capabilities now use the same `ServiceType.code` source as Orders/Tariffs and store default rate + rate unit.
- Stable-key protection added: existing service codes and language names cannot be renamed in place while operational tables still persist those strings. This prevents Phase 10 foundation data from becoming orphaned.
- Restored the existing `ServicePayload.notes` contract after Phase 06 insertion initially displaced it; service comments remain editable/backward compatible.
- `/crm/languages` preserves the legacy derived read fallback when a test/legacy metadata-created DB has not executed migration 0017 yet.

### Phase 10 data foundation only
- `language_catalog` persisted in the DB.
- Executor capability now contains canonical service code + bidirectional language pair + default rate + rate unit.
- Existing legacy executor capability codes may be preserved during edit but new capabilities must choose a canonical service.
- Matching, direct/routed candidate selection, no-candidate workflow and executor availability calendar are **not** implemented in Phase 06.
- Full owner-approved post-MVP rules are stored in `docs/post-mvp/PHASE_10_EXECUTOR_MATCHING_ROUTING.md` and the latest owner review supplement.

### Shared owner-review regressions consumed here
- Compact side-panels remain scrollable while permanent decorative scrollbar chrome is hidden.
- Page/detail burgundy rules are clipped/faded instead of protruding beyond rounded geometry.
- Application full-detail status/actions use a denser shared grid.
- Order file rows now expose real Open/Preview and Download actions.
- Phase 05 typography baseline remains enlarged; density is recovered through grid/spacing rather than shrinking text.

## Database / migration

Required migration: `0017_phase6_catalogs` (down revision `0016_work_pricing_assignments`).

Creates:
- `language_catalog`.

Adds to `executor_directions`:
- `default_rate NUMERIC(14,2)`;
- `rate_unit VARCHAR(32)`.

Seed policy:
- language seed is derived from existing tariffs, order works and executor directions plus Russian;
- no fabricated external language catalogue is inserted.

Alembic graph audit in this environment reports exactly one head:
- `0017_phase6_catalogs`.

## Verification actually performed

Passed in this environment:
- `python -m compileall` for API + Alembic versions.
- 41 targeted API tests passed: CRM, Applications, Operations, CRM preferences, Auth and TOTP concurrency.
  - The container is offline and lacks installed `pyotp` / `xlrd`; test-only compatibility stubs outside the project tree were used only to allow those targeted suites to run. No project runtime code depends on those stubs.
  - Spreadsheet import tests were not run because real `xlrd/xlwt` packages are unavailable in this environment.
- TypeScript transpile/parser diagnostics for all changed TS/TSX/E2E files: 0 errors.
- `npm run audit:foundation`:
  - foundation imported last: true;
  - missing required tokens: 0;
  - contrast failures below 4.5: 0.
- Phase 06 CSS:
  - brace balance: 0;
  - new `!important`: 0;
  - literal hex colors: 0.
- Alembic graph static audit: single head `0017_phase6_catalogs`.

Not claimed as passed here:
- full `npm ci` / ESLint / TypeScript project typecheck / Next production build / Playwright, because the environment cannot reach npm and has no complete `node_modules`;
- full API import/XLS test suite because the real spreadsheet dependencies are unavailable here.

Run the owner-machine gate below after applying migration 0017.

## Owner-machine gate

From project root:

```powershell
# Phase 06 changes backend + migration + frontend.
docker compose build backend frontend
docker compose up -d postgres

docker compose run --rm backend alembic upgrade head

docker compose up -d backend frontend

docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

Frontend gate:

```powershell
cd .\apps\admin-web
npm.cmd ci
npm.cmd run audit:foundation
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npx.cmd playwright test e2e/phase1-shell.spec.ts e2e/phase2-ui-kit.spec.ts e2e/phase3-dashboard-applications.spec.ts e2e/phase4-clients-executors.spec.ts e2e/phase5-orders-order-detail.spec.ts e2e/phase6-files-users-settings.spec.ts
```

Backend gate (if Python deps are installed locally):

```powershell
cd ..\api
python -m pytest
```

Do **not** run `docker compose down -v`.
