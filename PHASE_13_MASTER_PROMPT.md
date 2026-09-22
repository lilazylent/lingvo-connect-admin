# Phase 13 Master Prompt

Continue Lingvo Connect from the latest Phase 12 v4 baseline. Follow the project protocol: re-read current models/API/migrations/frontend, diagnose before patching, make the smallest coherent change, keep backend as source of truth, verify regressions, and package a new ZIP.

Implement Internal / Non-Billable Works and the Step 05 confirmation owner patch.

Hard requirements:
- Do not create a parallel task system.
- Extend existing OrderWork with a persisted `client_billable` flag, default true.
- A non-billable work remains fully operational and can have executor assignments, rates, actual volumes, deadlines, and costs.
- Non-billable work must be excluded from client revenue, client amount due, client preliminary calculation text, and client-facing work totals.
- Its executor cost must still be included in executor payouts, profit, and margin.
- Support the flag in new-order wizard and existing order work editor.
- Existing orders must migrate safely with all current works billable.
- After confirming a routed executor proposal in Step 05, collapse detailed route cards to a success summary and expose an Edit action.
- Do not implement Phase 14 dynamic service-specific work fields.
- Do not redesign unrelated CRM areas.

Verification:
- backend tests for billable + internal work in one order;
- executor cost survives while client revenue excludes internal work;
- one Alembic head;
- existing phase audits pass;
- no new CSS ownership violation or !important debt;
- attempt production build and report environment limitations truthfully.
