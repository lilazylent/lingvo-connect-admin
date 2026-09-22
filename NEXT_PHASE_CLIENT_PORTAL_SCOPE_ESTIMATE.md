# Next Phase — Client Portal + Landing + Payments (planning estimate)

## Proposed scope
1. Customer authentication and personal accounts: invitation/registration, login, password reset, secure sessions, company-to-account binding and roles.
2. Landing integration: registration/login entry points, authenticated client area, shared API contracts with CRM.
3. Client dashboard: current deposit, ledger, orders, statuses, deadlines, documents and order history.
4. Online deposit top-up: YooKassa payment creation, return flow, webhook verification, idempotent crediting and payment status history.
5. Correct deposit lifecycle: CRM manual operations and online credits in the same ledger, order debits, reconciliation, failed/refunded payment handling.
6. Notifications / account UX required for payment and order state changes.
7. Security, audit trail, migrations, regression tests and responsive client UI.
8. Later/optional: deposit runway forecast from real order history (average daily spend, days remaining, recommended replenishment date).

## Low-market implementation estimate
Engineering estimate for a freelancer/small studio, not a formal market quotation:
- lean MVP without polish-heavy extras: **70,000–90,000 ₽**;
- safer production-ready version with robust payment edge cases, recovery flows and stronger QA: **90,000–120,000 ₽**.

A practical low-end client quote for the full listed MVP would be about **80,000 ₽**, with the runway forecast kept as a small follow-up once enough usage history exists.
