# Phase 12 Owner Correction — Implementation Report

Build ID: `phase13-internal-works-20260919-r1`

## Implemented

- Correct public format: `YY-0-NNNN`.
- Added read-only `peek_next_order_number()`.
- Added `GET /api/admin/crm/orders/number-preview`.
- New-order wizard now displays `Новый заказ · <preview>`.
- Preview follows overall execution-year changes without consuming a number.
- Actual creation still allocates atomically through the backend counter.
- Added migration `0021_order_number_v2`:
  - moves existing numbers temporarily out of the final namespace;
  - renumbers all existing orders by execution year and historical creation order;
  - rebuilds year-scoped `order_counters` so the next preview/create continues correctly.

## Verified

- `tests/test_operations.py + tests/test_crm.py`: 23 passed using external temporary shims for missing `pyotp` / `xlrd`; no shims are included in the project.
- Explicit preview test confirms two previews return the same number and the following preview advances only after creation.
- Migration-only smoke test from revision 0020 to 0021 converted:
  - historical 2026 rows -> `26-0-0001`, `26-0-0002`;
  - historical 2027 row -> `27-0-0001`;
  - counters -> `(2026,2)`, `(2027,1)`.
- Alembic heads: `0021_order_number_v2` only.
- Foundation / CSS ownership / Phase 8–12 static audits: PASS.
- TS/TSX syntax parse: 44 files, 0 syntax errors.

## Build limitation

A full Next production build still depends on the local Docker/npm dependency installation; the source ZIP does not contain `node_modules`. Do not interpret the static parse/audits as a replacement for the local Docker build.
