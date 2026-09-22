# Phase 13.5 — Tariff Automation & CRM Lookup Integration

## Baseline
`phase13-finance-layout-owner-fix-20260919-r2`

## Result
The existing order wizard already contained the shared server-side lookup controls, language catalog combobox, automatic tariff option endpoint, manual total path, and tariff-ID persistence. The patch therefore extends the existing architecture rather than replacing it.

### Backend
- Added explicit unresolved pricing messages:
  - native tariff unavailable;
  - tariff by request / automatic tariff not found.
- Pricing options/quotes now expose component tariffs, including each leg of foreign -> foreign pricing through Russian.
- Added `0023_sync_tariffs_2026`, a safe deployed-database synchronization migration for the authoritative 2026 written-translation grid.
- The migration creates dated authoritative seed rows (`active_from=2026-01-01`), retires only known legacy seed rows, preserves unrelated user/manual tariffs, and synchronizes the 5/10/15% volume discount rules.
- Revision ID length is kept below the historical Alembic `version_num VARCHAR(32)` limit.

### Frontend
- The tariff explanation now shows component rates for `A -> RU -> B` pricing.
- No-tariff state uses the backend's explicit `tariff by request` / native-unavailable message.
- Tariff dropdown labels identify `через русский` and `носитель` resolutions.
- Existing debounced `CrmLookup` remains the single client/contact/executor autocomplete pattern.
- Existing `LanguageCombobox` remains the canonical language source.

### Important client-rule reconciliation
The pasted draft mentions hundredths for conditional pages, but the later client clarification in the same project explicitly says round upward to one decimal place, minimum billable one page. The implementation preserves that later confirmed rule and does not regress Phase 11.

## Verification actually run
- `python -m compileall`: PASS.
- `alembic heads`: one head, `0023_sync_tariffs_2026`.
- isolated `0023` migration smoke against minimal tariff/pricing-rule tables: PASS; legacy seed retired, manual tariff preserved, authoritative rows/rules inserted.
- `pytest tests/test_crm.py -k 'pricing or search or tariff'`: PASS.
- `pytest tests/test_crm.py tests/test_operations.py`: 25 PASS.
- frontend TS/TSX parser: 44 files, 0 syntax errors.
- Foundation, CSS ownership, Phase 8–13, and new Phase 13.5 audits: PASS.
- Production Next build could not be executed in this source archive because `node_modules` is absent; do not treat build as passed until Docker/local rebuild runs.

## Remaining scope
- Full service-driven dynamic work fields remain Phase 14.
- Deposit balance/status automation remains a separate optional estimate.
- Pricing for ambiguous ranges such as layout complexity remains manual until the client supplies a deterministic rule.
