# Phase 13 — Finance Layout Owner Patch

Build ID: `phase13-finance-layout-owner-fix-20260919-r2`

## Baseline
`Lingvo_Connect_Admin_Phase_13_Internal_Works_v1.zip`

## Reproduced defect
On an order with a composite executor route, the Finance tab regressed visually:
- the tall `Структура выплат` block entered the same CSS grid row-sizing context as the main finance metrics;
- this increased the first row height and pushed `Экономика заказа` / `Итоговая стоимость заказа` far down the panel;
- the narrow right-side executor stage card still used a four-column desktop grid with hard minimum widths, clipping `Объём / Ставка / Стоимость` values.

## Root cause
`phase8-visual-motion.css` used `display: contents` for `.order-finance-module`, so newly added Phase 10.6 executor breakdown became an implicit direct grid item of `.phase5-finance-workspace`. Its height affected the row used by the left finance module.

The executor stage used:
`minmax(180px,1.45fr) repeat(3,minmax(120px,1fr))`, which cannot fit the right finance column reliably.

## Implemented patch
1. Finance workspace is now two independent vertical columns:
   - `.phase5-finance-main-column`: Finance heading + metric strip;
   - `.phase5-finance-side-column`: executor payout breakdown + client preliminary quote.
2. Removed the Finance workspace dependency on `display: contents`.
3. The right payout column can grow vertically without changing the vertical position of the left metrics.
4. Executor stage rows now use:
   - executor/stage identity as a full-width first row;
   - `Объём`, `Ставка`, `Стоимость` as three equal metric columns below it.
5. At `<=1024px` the two finance columns stack into one column.
6. At narrow mobile width executor metrics stack to one column.
7. Business logic, Finance API, calculations, assignment persistence, migrations, tariffs and Phase 13 non-billable rules were not changed.

## Verification actually run
- `audit:foundation` — PASS; missing tokens: 0; contrast failures: 0.
- `audit:css-ownership` — PASS.
- `audit:phase8-owner` — PASS.
- `audit:phase9` — PASS.
- `audit:phase10-availability` — PASS.
- `audit:phase10-matching-ui` — PASS.
- `audit:phase10-routing` — PASS.
- `audit:phase10-client-demo` — PASS.
- `audit:phase10-route-stages` — PASS.
- `audit:phase10-finance` — PASS.
- `audit:phase11-data-integrity` — PASS.
- `audit:phase12-order-numbering` — PASS.
- `audit:phase13-internal-works` — PASS.
- new `audit:phase13-finance-layout` — PASS.
- CSS `!important` debt remains at baseline 30.

## Not run / environment limitation
`npm run build` was attempted but the source ZIP contains no installed `node_modules`; runtime result: `next: not found`. Therefore production build is **NOT claimed as PASS** in this environment.

## Database / migrations
No backend or database schema changes. No Alembic command is required for this owner patch when upgrading from Phase 13 v1.
