# Lingvo Connect — Phase 13: Internal / Non-Billable Works

Build target: `phase13-internal-works-20260919-r1`
Baseline: Phase 12 v4 Migration Hotfix + assignment/calculator owner patch.

## Goal
Allow any order to contain additional internal works that remain operationally real (executor, volume, rate, cost, deadlines, history) but are excluded from all client-facing pricing and quote text.

## Domain rule
Each `OrderWork` has `client_billable: bool`, default `true`.

When `client_billable = false`:
- keep the work in CRM;
- keep executor assignments and executor payout/cost;
- include its executor cost in total executor payouts;
- include its executor cost in profit/margin economics;
- exclude its work price from client revenue / amount due;
- exclude it from preliminary client calculation text;
- show a clear internal-work marker in manager UI.

## Step 05 owner correction
For a two-stage routed assignment, after `Назначить предложенных исполнителей`:
- treat the route as confirmed;
- collapse the expanded stage editors into a compact success state;
- show `Исполнители успешно назначены`;
- provide `Редактировать` to reopen matching/details;
- keep wizard `Продолжить` as the normal navigation action.

## Persistence
Add one additive column to `order_works`: `client_billable BOOLEAN NOT NULL DEFAULT TRUE`.
No separate internal-task entity.

## Acceptance
1. Existing works remain billable after migration.
2. New work can be marked `Не учитывать в расчёте для клиента`.
3. Client totals ignore non-billable work.
4. Executor payouts still include non-billable work.
5. Profit = billable revenue - all executor costs.
6. Preliminary client text excludes non-billable work.
7. Work survives save/reload with flag intact.
8. Existing Add Work flow works both in wizard and order editor.
9. Phase 14 service-driven dynamic fields are not implemented here.
