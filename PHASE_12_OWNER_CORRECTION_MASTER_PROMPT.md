# Phase 12 Owner Correction — Master Execution Prompt

Work only from the latest Phase 12 source tree. Do not redesign unrelated CRM areas.

Goal: implement the exact owner-approved order-number lifecycle.

- Format every persisted public order as `YY-0-NNNN`.
- `YY` is the execution year; sequence is four digits and resets by year.
- Show `Новый заказ · <next number>` in the create wizard before persistence.
- Previewing a number must never reserve it, mutate counters, or create a draft DB row.
- Only a successful create transaction may consume the next sequence.
- Renumber existing orders deterministically and rebuild yearly counters via one minimal data migration.
- Keep order `created_at` metadata for persisted orders.
- Preserve all Phase 0–11 behavior.

Verification: backend numbering tests, preview no-consumption test, migration head, migration smoke test, frontend static audits, TS/TSX parse, and production build attempt. Report environment limitations rather than claiming unavailable checks passed.
