# Phase 09 Owner Patch 03 — Archive Routing + Order Layout Stabilization

## Role
Act as the senior full-stack engineer responsible for the Lingvo Connect CRM release candidate.
Work from the current Phase 09 source tree only. Re-read the implementation before every edit.
Use the repository protocol:

`PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> RE-READ -> VERIFY -> REPORT`

Russian text below is intentional product copy and must remain Russian in the UI.

## Baseline
Input build: `phase09-mvp-release-candidate-20260916-r1`.
This is an owner-requested release-candidate correction after real local review.
Do not redesign unrelated modules and do not create `phase9.css`.

## Immediate owner defects to solve

### 1. Cancelled orders must never become undiscoverable
Current defect:
- an order can have status `CANCELLED / Отменён`;
- active Kanban intentionally has no cancelled column;
- the existing `Архив` toggle filters by `Order.archived`;
- therefore a cancelled but non-archived order can disappear from Kanban while also being absent from Archive.

Required behavior:
- Statuses belong to one of two status boards: `MAIN` or `ARCHIVE`.
- Existing `CANCELLED / Отменён` is the default archive status.
- Existing orders already in `CANCELLED` must migrate to `archived=true`.
- Main Table/Kanban/status controls show only `MAIN` statuses.
- Archive Table/Kanban/status controls show only `ARCHIVE` statuses.
- Moving an order to a status must synchronize `Order.archived` from the status board.
- The order card must expose a compact three-dot action menu:
  - `Добавить в архив` for active orders;
  - `Вернуть в основную воронку` for archived orders.
- `Добавить в архив` sends the order to the default archive status, normally `Отменён`.
- Archived orders remain discoverable through the existing `Архив` toggle and can move between archive reasons/stages.

### 2. Archive reasons/stages must be configurable without flooding the main status selector
Extend the existing Settings module `Статусы заказов` instead of inventing a separate admin screen.

Admin must be able to create a new order stage with:
- Russian display name;
- semantic color;
- board: `Основная` or `Архив`;
- sort order;
- active/inactive state.

Examples of future archive stages include `Перенесён`, `Отложен`, or owner-defined reasons. Do not hard-code those examples as business data.

Existing status edit must also expose the board. If a status is moved between MAIN and ARCHIVE, orders already using that status must be synchronized so they do not become orphaned between views.

Do not require the operator to type an internal status code. Generate a stable custom code server-side.

### 3. Finance layout alignment
Owner screenshot shows `Для клиента / Предварительный расчёт` visually starting above the first finance metric row.
At desktop width, the client quote card must start on the same horizontal line as `Итоговая стоимость заказа`.

Implement this as real grid structure, not a magic pixel margin tied to one screenshot.
At compact/tablet/mobile widths the finance workspace may stack naturally.

### 4. Order file row geometry
Owner screenshot shows file action buttons wrapping below the metadata because the row has more grid children than declared grid columns.

Required desktop behavior:
- file mark;
- filename/analysis note;
- page metric;
- character metric;
- analysis badge;
- `Открыть` / `Скачать` actions

must remain in one horizontal row when width permits.
Long filenames may truncate horizontally. Do not increase the desktop row height merely to place action buttons on a second line.
At narrow mobile widths, prefer a bounded local horizontal scroll for this dense record over document-level horizontal overflow.

## Architecture constraints
- `phase5-orders.css` remains the canonical owner for Orders geometry.
- Existing Phase 08 finance-workspace selectors in `phase8-visual-motion.css` may be corrected in place because they currently own the two-zone finance layout.
- `phase6-admin.css` owns Settings layout additions.
- No new `!important` declarations.
- No new late override stylesheet.
- Preserve Light/Dark semantic tokens.
- Preserve keyboard/focus behavior.
- Preserve existing manual multi-executor assignment functionality.
- Phase 10 executor matching/calendar/routing remains out of scope.

## Explicitly deferred roadmap — document only, do not implement in this patch
- General named multi-pipeline management analogous to Bitrix24 (`МКО`, `МПП`, etc.) with a pipeline switcher and independently configurable stage sets.
- LC/ brand mark redesign against the public Lingvo Connect site; schedule for Phase 10 owner polish.
- Public-site customer accounts, registration, profile, order history and website-created orders.
- Direct website -> CRM Orders integration and eventual reconsideration of whether `Заявки` is still necessary.

The MAIN/ARCHIVE status-board foundation in this patch must not make those later features harder to implement.

## Backend acceptance criteria
1. Alembic has a single head.
2. Add a non-destructive migration after `0017_phase6_catalogs`.
3. `order_status_options` records expose board membership.
4. Existing `CANCELLED` status becomes `ARCHIVE`.
5. Existing cancelled orders are backfilled into the archive.
6. Admin can create custom status stages.
7. Order status changes synchronize `archived` correctly.
8. A dedicated CRM archive action moves/restores an order deterministically.
9. Existing main statuses continue to work.
10. No Phase 10 matching entities/endpoints appear.

## Frontend acceptance criteria
1. Normal Kanban never renders archive columns.
2. Archive Kanban renders only archive columns.
3. `Отменён` is visible in Archive after `Добавить в архив`.
4. Archive reasons can be edited in the order card while archived.
5. Status filter options follow the current MAIN/ARCHIVE view.
6. Order creation offers MAIN statuses only.
7. Settings can create/edit MAIN or ARCHIVE stages with colors.
8. The client quote aligns with the first finance metric row on desktop.
9. File actions remain aligned with file metadata on desktop.
10. No document-level horizontal overflow is introduced.

## Verification
Run everything actually available and report unavailable checks honestly:
- Python compile;
- targeted backend CRM/status tests;
- Alembic heads;
- frontend foundation/CSS ownership/Phase 08/Phase 09 audits;
- TypeScript syntactic parse;
- targeted Playwright owner-patch tests when dependencies/runtime are available;
- responsive review at 1440, 1024, 768, 390 where runtime is available;
- Light/Dark review;
- count `!important` and ensure debt does not grow.

## Delivery
Create a new Phase 09 RC build ID, update Phase 09 documentation/change log, package a clean ZIP without caches/build artifacts, and provide PowerShell commands that include the new Alembic migration because this patch changes backend schema and frontend code.
