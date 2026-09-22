# Phase 09 Owner Patch 03 — Implementation Report

Build ID: `phase09-mvp-release-candidate-20260916-r2`

## Scope completed
This owner patch closes the cancelled-order discoverability defect and the two screenshot-based layout regressions without introducing Phase 10 executor matching.

### Orders archive contract
- Added persisted status-board membership: `MAIN | ARCHIVE`.
- `CANCELLED / Отменён` is the default archive status.
- Added migration `0018_archive_status_scopes` after `0017_phase6_catalogs`.
- Migration backfills existing `CANCELLED` orders to `archived=true`.
- Order status updates now synchronize `Order.archived` from the selected status board.
- Added canonical CRM archive/restore action.
- Active order menu exposes `Добавить в архив`.
- Archived order menu exposes `Вернуть в основную воронку`.
- Main status filters/Kanban render MAIN stages only; Archive renders ARCHIVE stages only.
- Archived orders can move between archive stages.

### Settings: configurable archive stages
- `Настройки → Статусы заказов` now supports creating custom stages.
- Admin can choose `Основная` or `Архив`, color, sort order and active state.
- Custom status codes are generated server-side; the operator does not type internal codes.
- Status directory is grouped into `Основная воронка` and `Архивная воронка`.
- Built-in statuses cannot accidentally be moved to the opposite board; custom stages remain configurable.

### Finance geometry
- Rebuilt the Phase 08 two-zone finance grid so `Для клиента / Предварительный расчёт` starts on the same desktop row as `Итоговая стоимость заказа`.
- The solution uses explicit grid rows instead of screenshot-specific margins.
- Compact widths fall back to a stacked layout.

### Order file-row geometry
- Corrected the desktop grid from five declared tracks to the six actual content groups.
- `Открыть` / `Скачать` stay horizontal with the file metadata when width permits.
- At narrow mobile widths, the dense file record uses local horizontal scrolling rather than document-level overflow.

## Deliberately deferred
This patch does **not** claim to implement the full Bitrix-style arbitrary named pipeline system. `MAIN/ARCHIVE` is the immediate stable foundation. A later pipeline feature can introduce named pipelines such as owner-defined `МКО`, `МПП`, etc., each with independent stages and a pipeline selector.

Also deferred:
- Phase 10 LC/ brand-mark polish;
- Phase 10 executor matching/calendar/routing;
- public-site accounts and registration;
- website-created orders flowing directly into CRM Orders;
- final decision on whether Applications remains necessary after website integration.

## Backend changes
- `apps/api/app/crm_models.py`
- `apps/api/app/routers/crm.py`
- `apps/api/alembic/versions/0018_archive_status_scopes.py`
- CRM/status tests updated and expanded.

## Frontend changes
- `crm-orders.tsx`: board-aware filters/Kanban/order flow and archive/restore action.
- `crm-settings.tsx`: create/edit MAIN/ARCHIVE stages with semantic color and sort order.
- `phase5-orders.css`: file-row geometry.
- `phase6-admin.css`: grouped status-directory layout.
- `phase8-visual-motion.css`: finance alignment.
- Added targeted Phase 09 owner-patch E2E coverage.

## Verification actually run
### Passed
- Python compile: PASS.
- Targeted backend CRM tests: **15 passed**.
  - The execution environment lacks unrelated optional `pyotp`/`xlrd` packages; temporary external import stubs were used only to allow test collection. None of the targeted archive/status tests exercise TOTP or XLS parsing.
- Alembic graph: one head, `0018_archive_status_scopes`.
- `npm run audit:foundation`: PASS.
  - missing required tokens: 0
  - contrast failures below 4.5: 0
  - `!important`: 30, unchanged baseline
- `npm run audit:css-ownership`: PASS.
- `npm run audit:phase8-owner`: PASS.
- `npm run audit:phase9`: PASS.
- TypeScript/TSX syntax parse: **59 files, 0 parse diagnostics**.

### Not claimed as passed in this environment
- full Next production build/typecheck/lint (project `node_modules` are not installed here);
- Playwright runtime/browser screenshots for the new owner patch;
- applying the Alembic migration against a live PostgreSQL container in this environment.

These must be run on the owner's normal Docker/local environment before the final MVP freeze.

## Data migration behavior
`0018_archive_status_scopes` is non-destructive:
- adds `order_status_options.board` with default `MAIN`;
- marks persisted `CANCELLED` status as `ARCHIVE`;
- marks existing orders with `status='CANCELLED'` as `archived=true`;
- does not delete orders, works, payments, files or history.

## Result
The release-candidate model now has a coherent distinction between a working status board and an archive status board. Cancelled orders stay discoverable, archive reasons are user-configurable without polluting the main workflow, and both owner-reported layout regressions have canonical-owner fixes.
