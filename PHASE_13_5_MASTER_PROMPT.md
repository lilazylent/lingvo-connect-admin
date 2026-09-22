Work on the latest Lingvo Connect CRM baseline only. Follow PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> VERIFY -> REPORT.

Implement a narrow tariff-automation and lookup integration patch without rewriting the order wizard.

Requirements:
- Reuse the current server-side CRM lookup and language combobox patterns.
- Keep all canonical pricing in backend/domain code and the tariff database.
- Add a safe additive deployed-DB migration that synchronizes the confirmed 2026 written-translation tariff grid without overwriting unrelated manual tariffs.
- Preserve tariff directionality (TO_RUSSIAN/FROM_RUSSIAN/NATIVE_SPEAKER).
- Support foreign -> foreign via Russian and expose the two component tariffs in the API/UI.
- If native-speaker pricing is requested but unavailable, return an explicit native-tariff-unavailable state; do not fall back silently.
- Apply urgency and volume-discount pricing through backend rules.
- Invalidate stale wizard quote/tariff state when tariff-forming inputs change.
- Persist tariff IDs and validate them on create/edit.
- Preserve manager manual overrides.
- Do not implement the full service-driven dynamic Work form in this patch.
- Do not implement deposit accounting.

Verification:
- backend pricing/search/order persistence tests;
- Python compile;
- Alembic single head and isolated migration smoke;
- frontend syntax parse and all project audits;
- attempt production build and report honestly if the environment cannot install/run Next dependencies.
