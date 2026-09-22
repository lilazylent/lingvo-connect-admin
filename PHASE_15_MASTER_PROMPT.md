Implement Phase 15 Client Deposit Ledger on top of the current Phase 14 v3 baseline.

Constraints:
1. Re-read the current client directory, order wizard, finance calculations, SQLAlchemy models and Alembic head before editing.
2. Add only the minimum coherent deposit subsystem; do not add customer portal or payment gateway code.
3. Use a transaction ledger plus a denormalized current balance. Do not store unexplained balance-only mutations.
4. Manual CRM actions: top up and set balance.
5. Order creation must atomically apply available deposit to the unpaid billable client amount and record one ORDER_DEBIT ledger row.
6. Deposit-applied money must increase the order's amount_paid so client debt is correct.
7. Never allow balance below zero; any uncovered order amount remains debt.
8. Show deposit context in Clients and Order Wizard without cluttering the existing UI.
9. Keep all existing Phase 8–14 audits green and add a Phase 15 audit.
10. Verify backend tests, Python compile and Alembic single head. Do not claim a Next production build if dependencies are absent.
