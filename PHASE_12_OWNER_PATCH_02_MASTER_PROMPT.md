You are continuing Lingvo Connect from Phase 12 Order Numbering v2. Treat the current repository as source of truth.

Goal: repair the owner-reported end-to-end executor assignment persistence/calculator defect without redesigning unrelated CRM areas.

Protocol: preflight -> diagnosis -> minimal coherent patch -> reread -> backend tests -> frontend/static audits -> migration-head check -> report -> clean ZIP.

Implement:
1. Routed candidate selection must write directly into the work draft executor_assignments, not only routeSelections UI state.
2. Manual candidate/stage rate edits must update the selected draft assignment immediately.
3. Existing persisted routed assignments must restore selection and effective manual rate in matching UI.
4. Wizard Step 06 must calculate executor payouts from those draft assignments before order creation.
5. Backend routed validation must permit explicitly selected UNKNOWN-availability candidates and reject only truly UNAVAILABLE candidates. Do not treat UNKNOWN as FREE.
6. Persist rate, volume/page count, route metadata, auto cost and total cost using existing ExecutorAssignment model and finance pipeline.
7. Add regression coverage for JA -> RU -> EN with UNKNOWN availability, default rate 0, manual rates 500/250, 14,534 chars -> 8.1 pages -> 6,075 ₽ executor payout, surviving reload.
8. Light owner UI polish only: left-align `По умолчанию`; stabilize availability badge placement.

Do not add migrations, new route models, a second calculator, fake availability, or Phase 13/14 functionality.
