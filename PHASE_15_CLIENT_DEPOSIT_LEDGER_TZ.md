# Phase 15 — Client Deposit Ledger

## Goal
Add a simple CRM-side client deposit without personal accounts or payment-gateway integration.

## Scope
- Persist current deposit balance on each client/company.
- Manual `Пополнить` and `Установить баланс` actions from the client card.
- Immutable deposit operation history with signed amount, resulting balance, actor, optional order, note and timestamp.
- At order calculation/review, show current deposit, expected debit, balance after order and uncovered amount.
- On successful order creation, atomically apply available deposit against the unpaid client total.
- Deposit debit counts as client payment for the order so CRM debt is not duplicated.
- If deposit is smaller than the unpaid order amount, consume available deposit, leave deposit at zero and keep the uncovered remainder as client debt.

## Out of scope
- Personal client accounts / customer authentication.
- Landing-page registration and account linking.
- YooKassa or any other online payment gateway.
- Automatic online top-ups, payment webhooks, recurring payments.
- Deposit runway forecasting / replenishment recommendation.

## Safety / integrity
- Order creation and deposit debit use one DB transaction.
- Deposit debit is linked to the order and unique per order.
- Failed order creation must not change deposit.
- Existing client/order behavior remains backward compatible.
