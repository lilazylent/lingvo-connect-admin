# Lingvo Connect — Phase 13.5 Tariff Automation & CRM Lookup Integration

## Goal
Finish the connected order-registration flow without rewriting the wizard:

Client -> Work -> Language Pair -> Tariff -> Calculation -> Executor -> Review -> Persisted Order.

## Scope
1. Keep server-side autocomplete for clients, representatives and executors through the shared `CrmLookup`.
2. Keep language selection through the shared catalog-backed `LanguageCombobox`.
3. Use one backend tariff/pricing engine for automatic pricing.
4. Synchronize the confirmed Lingvo Connect 2026 written-translation tariff grid into already deployed databases with a new safe migration.
5. Preserve manual/custom tariffs not owned by the seed migration.
6. Keep tariff direction asymmetric: TO_RUSSIAN / FROM_RUSSIAN / NATIVE_SPEAKER.
7. Foreign -> foreign uses the confirmed route through Russian when native-speaker mode is not selected.
8. Native-speaker mode never silently falls back to a regular tariff when the native row is absent.
9. Apply urgency and volume discounts in backend pricing rules.
10. Persist applied tariff IDs in `OrderWork` and reject stale tariff IDs that do not match changed work parameters.
11. Explain via-Russian component tariffs in the UI.
12. Keep manual rate/total override paths.

## Confirmed conditional-page rule
Latest client clarification in this project takes precedence over older draft wording:
- 1800 characters with spaces = 1 conditional page;
- physical page quantity is rounded upward to one decimal place;
- minimum billable quantity for the confirmed written-translation tariffs is 1 page.

## Out of scope
- Full service-driven Work form redesign (reserved for Phase 14 after the final service matrix is formalized).
- Deposit-balance automation.
- Rewriting the tariff data model.
- New pricing logic for services whose rules remain ranges/ambiguous.

## Acceptance
- EN -> RU = 540 ₽ for 1 page.
- RU -> EN = 590 ₽ for 1 page.
- <1800 chars bills at minimum 1 page.
- urgent RU -> EN at x1.5 = 885 ₽.
- native RU -> EN = 2200 ₽.
- missing native tariff returns an explicit unavailable/manual state.
- EN -> DE through Russian = 540 + 790 = 1330 ₽/page.
- 20 pages RU -> EN receives 5% discount -> 11210 ₽.
- stale tariff ID is rejected when the language pair changes.
- persisted tariff IDs and resolved client rate survive reopening the order.
