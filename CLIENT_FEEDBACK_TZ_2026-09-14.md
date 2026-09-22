# Lingvo Connect Admin — consolidated technical specification

Source of truth: `Lingvo_Connect_Admin_Video_Fixes_Zoom_RoleBadge_v2_1.zip`.
Basis: user walkthrough/video feedback + client voice-message transcript supplied on 2026-09-14.

## 0. Operating rules

- PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> VERIFY -> REPORT.
- Preserve existing data and existing API/business behavior unless a change is explicitly required below.
- Do not hard-code business thresholds that the client has not confirmed.
- No new visual redesign/reference implementation in this pass. Keep the current UI language and only improve the confirmed functional/theme/responsive defects.
- No destructive migrations, volume deletion, or database reset.

## 1. Confirmed user-side fixes

### 1.1 Browser zoom / narrow effective viewport
- The CRM must remain usable at 175%, 200% and 250% browser zoom on a typical desktop viewport.
- Collapse the fixed sidebar early enough that the working canvas is not squeezed.
- Avoid document-level horizontal overflow. Large tables may scroll inside their own container.
- Header/toolbars/settings grids/dialogs/wizard steps must reflow predictably.

### 1.2 Role badge artifact
- The role chip (`ADMIN`, `MANAGER`, future roles) must not show the white top line/inset highlight in light or dark mode.
- Use one uniform role-chip border/surface without pseudo-element or inset-white artifacts.

## 2. Dark theme correction requested by client

- Keep dark mode but move the base palette from near-black toward calm neutral dark graphite/gray.
- The result should be less gloomy while remaining comfortable for prolonged work.
- Preserve semantic contrast, readable controls, tables, dialogs, dropdowns and status states.
- Do not implement the future visual redesign in this pass.

## 3. Pricing: urgency coefficient

### Business need
Urgent written translation does not have one universal coefficient. The manager must be able to choose the coefficient per work/order calculation.

### Required behavior
- Keep the explicit `urgent` state.
- Add a per-work urgency multiplier.
- Presets should support at least `1.2`, `1.5`, `2`, `3`, `4`; custom numeric value must remain possible.
- When urgency is off, effective multiplier is `1`.
- Existing behavior must remain backward compatible: old urgent works without a stored multiplier behave as 1.5.
- Auto tariff calculation and manual tariff selection must use the selected multiplier consistently.
- Persist the applied multiplier on the work so future tariff changes do not rewrite history.

## 4. Pricing: volume discount and manual override

### Business need
The client expects automatic volume discounts, but exact thresholds are not final. Examples mentioned verbally (20/100/500 pages and 5/10/15%) are NOT approved business rules yet.

### Required behavior
- Do not hard-code those example thresholds.
- Continue to use configurable `PricingRule` records for automatic volume discounts.
- Add a per-work manual discount override in percent.
- `auto` mode: use the active pricing rule for service + quantity.
- `manual` mode: manager enters the final discount percent for that work.
- Persist the actually applied discount and whether it was manually overridden.
- UI must clearly show whether the discount came from CRM rules or from the manager.
- Future client-level permanent discounts are explicitly out of scope until the client confirms the rule model.

## 5. Work volume: characters -> conditional pages

- For `CONDITIONAL_PAGE`, 1 conditional page = 1800 characters including spaces.
- When the manager manually enters character count (including when a source document is only an image/photo), calculate conditional pages automatically.
- Minimum billable quantity remains 1 conditional page where the current pricing rules require it.
- Store calculation with current precision, but show client-facing page quantity rounded to one decimal place.
- A manager may still manually edit page quantity when the billing unit/service requires it.

## 6. Executor volume and multiple executors

### Business need
Client volume and executor volume are different concepts. A client can be billed for the full work while one executor performs only part of it. Rarely, 2-3 executors can split the same client work.

### Required data model
- Keep client work volume and client price on `OrderWork`.
- Introduce executor assignments as a separate entity under a work.
- A work can have 0..N executor assignments.
- Each assignment stores its own:
  - executor;
  - character/page/quantity volume;
  - billing unit;
  - rate;
  - auto cost;
  - final cost/manual override;
  - executor deadline/time;
  - status/notes where practical.
- Order finance must sum executor assignment costs, not assume client volume == executor volume.
- Search/filter and executor summary/statistics must account for executor assignments.
- Preserve legacy single-executor fields/data for backward compatibility and migrate/backfill old rows safely.

## 7. Client-ready preliminary calculation text

Add a copyable client-facing summary generated from persisted order/work data.

For each work include only appropriate customer information:
- service;
- source -> target language;
- conditional pages/quantity (one decimal where relevant);
- tariff/rate;
- applied urgency coefficient if >1;
- applied discount if >0;
- preliminary work cost;
- preliminary deadline.

At order level include preliminary total and clearly label the result as preliminary.

Do NOT expose executor names, executor rates/costs, internal comments, profit/margin, or other internal information.

Provide a one-click `Copy` action suitable for pasting into an email/message.

## 8. Explicitly deferred

- Customer self-service portal / separate client workspace, permissions and visibility model.
- Permanent client-specific discount profile until business rules are confirmed.
- New global frontend redesign/reference direction. This will be approved separately.

## 9. Acceptance checks

- Existing order creation/edit flow still works with old records.
- Urgency coefficient affects auto price predictably.
- Auto discount is configurable; examples from voice messages are not hard-coded.
- Manual discount override works and is visible.
- Character count produces conditional pages.
- One work can hold at least two executor assignments with different volumes/costs.
- Client total remains independent from executor split.
- Order finance sums executor assignment costs correctly.
- Client summary copies without internal/executor data.
- Dark theme is graphite rather than near-black and retains AA-level legibility for normal text.
- Role badge has no white inset line.
- 175-250% zoom remains usable without page-level horizontal overflow.
