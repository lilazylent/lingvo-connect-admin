# Lingvo Connect Admin — client feedback implementation report v2.2

Date: 2026-09-14
Baseline: `Lingvo_Connect_Admin_Video_Fixes_Zoom_RoleBadge_v2_1.zip`
Specification: `CLIENT_FEEDBACK_TZ_2026-09-14.md`

## Implemented

### Existing user-side fixes retained
- The shared role badge remains flat/theme-safe: no inset white upper highlight for ADMIN/MANAGER/future role labels.
- The 1180px shell breakpoint from v2.1 remains in place so browser zoom around 175–250% switches to the off-canvas sidebar before the working area becomes unusably narrow.
- Table and shell overflow protections from v2.1 remain intact.

### Dark theme corrected without doing the deferred redesign
The main semantic dark palette was moved from near-black to graphite:
- canvas `#15181d`
- shell `#191d23`
- surface `#1e232a`
- raised surface `#252b33`
- hover surface `#2d3540`
- border `#39424d`
- strong border `#556170`

Text hierarchy was also adjusted and theme preview/initial dark boot background now match the actual theme. The role badges consume the same theme tokens instead of using a separate almost-black color.

### Urgency per work
- Added persisted `OrderWork.urgency_multiplier`.
- Default/backward-compatible value: `1.50`.
- Quote API can accept a per-request urgency multiplier.
- Work creation/edit passes the multiplier through pricing.
- UI provides 1.2 / 1.5 / 2 / 3 / 4 presets plus a custom numeric coefficient.

### Discounts
- Added persisted applied discount and manual-override flag to each work.
- Automatic mode continues to resolve `VOLUME_DISCOUNT` from configurable `PricingRule` rows (service-specific rule first, then a global blank-service rule).
- Added manual percentage override per work.
- Manual tariff selection now preserves both `before_discount` and automatic-discount metadata so switching to a manual discount does not calculate from an already-discounted amount.
- No new discount thresholds from the latest voice message were hard-coded.

### Characters -> conditional pages
- Frontend updates conditional pages when character count changes.
- Backend now also derives and stores `page_count` for conditional-page works from character count (1800 chars/page, minimum one, current 0.01 precision).
- The same backend protection applies to each executor assignment.
- Client summary renders page volume to one decimal place.

### Multiple executors / independent executor volume
Added `executor_assignments` as a separate work-level entity. Each assignment stores:
- executor;
- own character/page volume;
- billing unit;
- rate;
- automatic/final cost and manual-cost state;
- deadline/time;
- status and notes.

The migration safely backfills existing single-executor work into one assignment. Legacy work-level executor fields and the legacy aggregate payment row remain as compatibility mirrors.

Order finance now sums assignment costs where assignments exist and only falls back to legacy work cost for old/no-assignment rows. Executor search/summary paths were adapted to assignments. A single client work can therefore be billed on the full client volume while two or more executors receive different slices and costs.

### Client-ready preliminary calculation
Added a customer-safe block in the order card with one-click copy. It contains service, language direction, conditional pages, client tariff, urgency coefficient, applied discount, preliminary work cost, deadline, preliminary order total and disclaimer.

It intentionally excludes executor identities/rates/costs, internal comments and profitability information.

## Database migration
New Alembic revision:
`0016_work_pricing_assignments`

It adds the three work pricing fields and creates/backfills `executor_assignments`. No destructive table/data reset is performed.

Alembic check:
`0016_work_pricing_assignments (head)`

## Verification actually performed
- `python -m py_compile` on modified backend model/router/migration: passed.
- Targeted backend suites `tests/test_crm.py` + `tests/test_operations.py`: **12 passed**.
  - The execution environment lacked the external `pyotp` and `xlrd` packages and had no network access. Temporary test-only import shims were provided outside the project so unrelated auth/import module imports could load; production/project source was not altered for this.
  - The new regression test verifies: custom urgency x2, manual 10% work discount, automatic client page count, two executors with independent 1800-character slices, executor cost 30+40, client revenue 360 and profit 290.
- CSS parsed with `tinycss2`: 0 parse errors for the modified theme/order/resilience styles.
- Core dark palette contrast sanity:
  - primary text vs surfaces: >13:1
  - secondary text vs surfaces: >9:1
  - muted text vs raised surface: ~5.9:1
  - accent vs raised surface: ~4.63:1
- TSX was parsed by TypeScript using `--noResolve`: no syntax/parser errors.
- Full Next.js `typecheck`, production `build` and Playwright were **not** run because development `node_modules` are not present in the supplied source and the execution environment cannot download packages.
- Docker runtime verification was not available in this container.

## Deferred deliberately
- New visual reference / global frontend redesign.
- Client portal / client-visible workspace and permission model.
- Permanent client-specific discount rules.
- Any additional corrections Oleg sends after reviewing the walkthrough.
