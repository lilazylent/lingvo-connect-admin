# Phase 12 — Order Numbering & Metadata

Target build: `phase13-internal-works-20260919-r1`
Baseline: `Lingvo_Connect_Admin_Phase_11_Data_Integrity_v1`

## Goal
Use the owner-approved public format `YY-0-NNNN`, surface creation metadata, migrate existing legacy order numbers, and show the next number in the new-order wizard without reserving it.

## Business rule
- `YY` = last two digits of the order execution year.
- Execution year = overall order deadline year when a deadline is known.
- If no deadline is known yet, use the current server calendar year.
- `NNNN` = sequential number inside that execution year.
- Examples: `26-0-0001`, `26-0-0002`, then `27-0-0001` for the next execution year.
- A draft preview is not a reservation. Only successful order creation consumes the next sequence.
- Once persisted, the public order number is immutable.

## Architecture
Reuse `order_counters` as the year-scoped counter store (`id = 2026`, `2027`, ...). One backend module owns both operations:
- `peek_next_order_number()` — read-only draft preview;
- `next_order_number()` — atomic allocation during actual create/import.

A Phase 12 owner-correction data migration renumbers existing historical orders deterministically by execution year and creation order, then rebuilds yearly counters from the migrated rows.

## UI
- Wizard header: `Новый заказ · YY-0-NNNN`.
- Closing an uncreated wizard does not consume the previewed number.
- Persisted detail header: `Заказ YY-0-NNNN · Создан DD.MM.YYYY`.
- Orders table and Kanban show creation date beside/below the public number.
- Existing `created_at` remains the metadata source.

## Acceptance criteria
1. 2026 sequence: `26-0-0001`, `26-0-0002`, ...
2. 2027 sequence starts independently at `27-0-0001`.
3. Two draft preview requests return the same number until a real order is created.
4. Closing/reopening the wizard does not consume the number.
5. A 2027 overall execution year previews/creates a `27-0-NNNN` number.
6. Backend owns numbering; frontend only displays preview/result.
7. Existing `LC-O-*` / previous-format orders are migrated.
8. `created_at` is shown only after persistence.
9. No Phase 13/14 functionality is introduced.
