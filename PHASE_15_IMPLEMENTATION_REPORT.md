# Phase 15 Implementation Report — Client Deposit Ledger

Build ID: `phase15-pre-release-audit-20260922-r2`

## Implemented
- `companies.deposit_balance` persisted decimal balance.
- `client_deposit_transactions` ledger with manual top-up, manual balance correction and automatic order debit.
- Client card deposit block with current balance, top-up, set-balance and recent history.
- Client list money cell now surfaces deposit alongside debt.
- Order wizard loads selected client's deposit and previews:
  - current deposit;
  - amount that will be debited;
  - balance after order;
  - amount still due after deposit.
- Order review repeats deposit context before final creation.
- Successful order creation atomically consumes only the available deposit against the unpaid billable total.
- Deposit debit is included in `ClientPayment.amount_paid`; uncovered remainder remains client debt.
- Failed order creation cannot leave an orphan deposit debit because the mutation is in the same DB transaction.

## Migration
- New Alembic revision: `0025_client_deposit_ledger`.
- Single head verified: `0025_client_deposit_ledger`.

## Verification
- Python compile: PASS.
- `tests/test_crm.py + tests/test_operations.py`: 28 PASS.
- New deposit tests cover top-up, set-balance, full auto debit and partial debit when deposit is insufficient.
- Existing Phase 8–14 audits: PASS.
- New Phase 15 client-deposit audit: PASS.
- Contrast failures below 4.5: 0.
- CSS `!important`: unchanged at 30.
- TypeScript syntax scan of touched TSX: no TS1xxx parser diagnostics; full typecheck is unavailable without project dependencies.
- Full fresh SQLite Alembic-chain smoke cannot represent this project because an older migration creates a PostgreSQL sequence; the new revision is therefore verified through model-backed tests and single-head inspection. Production Docker/PostgreSQL should run `alembic upgrade head`.

## Explicitly deferred
Customer portal/authentication, landing integration, YooKassa, online top-ups/webhooks and deposit runway forecasting are not part of Phase 15.
