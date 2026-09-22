# Phase 12 Implementation Report — Order Numbering & Metadata

Build ID: `phase13-internal-works-20260919-r1`
Baseline: Phase 11 Data Integrity v1

## Implemented

### Exact public format
Unified format is now:
- `26-0-0001`
- `26-0-0002`
- `27-0-0001`

`YY` is the execution year and `NNNN` is the yearly sequence.

### Draft preview without reservation
Added read-only `peek_next_order_number()` and `GET /api/admin/crm/orders/number-preview`.

The create wizard displays `Новый заказ · <next number>`. Opening/closing the wizard does not modify `order_counters`. Only successful creation/import calls the atomic allocator and consumes the sequence.

### Historical renumbering
Added Alembic migration `0021_order_number_v2`.

It:
1. temporarily moves existing public numbers out of the final namespace to avoid unique-key collisions;
2. groups historical orders by execution year (`deadline.year`, else `created_at.year`);
3. orders them by `created_at`, then `id`;
4. writes `YY-0-NNNN` numbers;
5. rebuilds yearly `order_counters` from the migrated rows.

### Metadata UI
- wizard header: `Новый заказ · YY-0-NNNN`;
- persisted detail: `Заказ YY-0-NNNN · Создан DD.MM.YYYY`;
- table/Kanban: creation date displayed with the public number.

## Tests actually run
- Python compile: PASS.
- `tests/test_operations.py + tests/test_crm.py`: **23 passed** using temporary external dependency shims only; no shim files are in the project.
- Preview coverage: repeated previews do not advance the sequence; the preview advances only after creation.
- Execution-year coverage: 2027 wizard order creates `27-0-0001`.
- Migration-only smoke test from 0020 -> 0021: PASS; historical 2026/2027 rows were renumbered correctly and yearly counters rebuilt.
- Alembic: one head, `0021_order_number_v2`.
- Foundation / CSS ownership / Phase 08–12 audits: PASS.
- TS/TSX syntax parse: 44 files, 0 syntax errors.

## Production build
The source ZIP does not include `node_modules`; full Next build remains a local Docker acceptance check. Static audits/parse are not reported as a replacement for production build.

## Deliberately not implemented
- Phase 13 internal/non-billable works.
- Phase 14 service-driven dynamic work forms.
