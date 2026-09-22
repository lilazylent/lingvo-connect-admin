# Phase 12 Owner Correction — Order Numbering & Draft Preview

Build target: `phase13-internal-works-20260919-r1`

## Owner-approved contract

1. Public order format is `YY-0-NNNN`.
   - `26-0-0001`
   - `26-0-0002`
   - `26-0-0003`
   - next execution year starts independently, e.g. `27-0-0001`.
2. `YY` is the order execution year. The overall order deadline year is used when known; otherwise the server current year is the draft/create fallback.
3. Opening the new-order wizard must show the next visible number, e.g. `Новый заказ · 26-0-0004`.
4. A draft preview is read-only. Opening, closing, or abandoning the wizard must not reserve or increment the counter.
5. The number becomes immutable only after successful order creation. The next wizard then previews the following number.
6. Existing legacy/test public order numbers must be migrated deterministically into the owner-approved format. Within each execution year, historical orders are sequenced by `created_at`, then `id`.
7. Creation date is shown only for persisted orders because an abandoned draft has no creation event.

## Technical requirements

- Keep one backend numbering source of truth in `app/order_numbering.py`.
- `peek_next_order_number()` must be read-only.
- `next_order_number()` remains the only counter-consuming operation and executes during real order creation/import.
- Add a read-only CRM preview endpoint used by the wizard.
- Preserve year-scoped concurrency-safe counter allocation.
- Add an additive data migration that renumbers existing orders and rebuilds yearly counter rows from migrated data.
- Do not create a persisted draft order only to reserve a number.

## Acceptance criteria

- Repeated preview calls return the same number until an order is actually created.
- Closing/reopening the wizard displays the same preview.
- Creating the previewed order fixes that number and advances the next preview by one.
- A 2027 execution-year work produces/previews a `27-0-NNNN` number.
- Existing `LC-O-*` / previous Phase 12 numbers are converted by migration.
- Exactly one Alembic head remains.
