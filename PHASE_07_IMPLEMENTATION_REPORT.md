# Phase 07 Implementation Report — Dark Theme System Audit + Cross-Project Visual Consolidation

Date: 2026-09-15
Baseline: `Lingvo_Connect_Admin_Phase_06_Files_Users_Settings_v1.zip`
Canonical execution prompt: `docs/phases/PHASE_07_MASTER_EXECUTION_PROMPT.txt`

## Result

Phase 07 is implemented as a frontend-only candidate. The work deliberately avoids adding another late visual override stylesheet: Dark-state coverage was consolidated into the existing `theme-system.css`, semantic token values remain exclusively in `crm-foundation.css`, and page geometry fixes were moved into their owning Phase/page styles.

## Pre-flight findings

The Phase 06 baseline still contained several sources of visual fragmentation:

- duplicate semantic `--crm-*` token values in legacy theme/rhythm layers;
- legacy Dark literal colors and low-contrast state overrides;
- selected-row implementations using multiple local backgrounds;
- Order Finance geometry still too tall/wide and semantically ambiguous;
- Order pipeline numbers/ring too heavy, with weak future-state readability;
- New Order calculation grid still grouped `Ставка вручную, ₽` in a way that could break baseline alignment;
- New Order review used ambiguous `Клиенту / Исполнителям / Маржа` terminology;
- owner-review Application header/accent/scroll behaviors remained distributed across layers;
- Phase 06 page controls needed to remain semantic under the global Dark audit.

## Architecture / consolidation decisions

### One token owner

Removed semantic `--crm-*` value definitions from legacy `theme-system.css` and `workspace-rhythm.css`. `crm-foundation.css` is now the only semantic token-value owner.

Added canonical semantic roles used by the audit:

- `--crm-surface-selected`
- `--crm-divider`
- `--crm-text-disabled`

for Light and Dark.

### No new Phase 07 override layer

An intermediate Phase 07 stylesheet was intentionally folded back into the existing owners before delivery. Final ownership is:

- semantic token values -> `crm-foundation.css`;
- Dark cross-route states -> `theme-system.css`;
- Order pipeline/finance/work geometry -> `phase5-orders.css`;
- wizard/calculation/review/shared accent geometry -> `workspace-polish.css`;
- Application readability/header composition -> `owner-readability.css`;
- Files/Users/Settings page composition -> `phase6-admin.css`.

This follows the owner rule: fix the system, not a screenshot.

## Order Finance

The existing Finance block was not accepted by the owner and was treated as Phase 05 debt.

Implemented:

- compact 6-column desktop grid capped at 1040px instead of full-width giant tiles;
- primary row: total / debt / profit;
- secondary row: executor payouts / margin;
- reduced metric minimum height to 68px;
- responsive 2-column and 1-column collapse;
- semantic states for total/debt/paid;
- tabular numeric presentation.

Canonical Russian labels:

- `Итоговая стоимость заказа`
- `Остаток к оплате`
- `Выплаты исполнителям`
- `Прибыль`
- `Маржинальность`

The underlying backend financial formulas were not changed.

## Order pipeline 01–09

Static Phase 07 redesign:

- stage width reduced;
- number ring reduced to 27px (25px on narrow mobile);
- 12px lighter tabular number typography;
- thinner 1.5px ring;
- semantic future/current/completed states;
- `data-stage-state` added;
- dedicated `.order-stage__ring` wrapper added for Phase 08 clockwise progress-ring animation without reworking markup.

No final motion animation was implemented in Phase 07.

## New Order wizard

### Step 02 — Works

The work-card index/overline, headers, helper text, manual switches and dividers now consume semantic tokens. `Работа 01` no longer relies on a harsh white badge treatment in Dark.

### Step 04 — Calculation

The calculation row now has five aligned semantic columns:

1. `Тариф`
2. `Единица тарифа`
3. `Ставка по тарифу` or `Ставка вручную`
4. `Ручной итог`
5. `Авторасчёт / Итог вручную`

The manual rate is no longer implemented as a nested two-field block with `Ставка вручную, ₽`; the label is `Ставка вручную`, preventing the currency suffix from creating a second visual baseline.

### Step 06 — Review

Replaced ambiguous labels with:

- `Стоимость для клиента`
- `Выплаты исполнителям`
- `Прибыль`
- `Маржинальность`

Wizard totals now use `Итоговая стоимость заказа / Уже оплачено / Остаток к оплате`.

## Cross-project Dark consolidation

Performed repository-wide semantic normalization for:

- primary/secondary/muted/disabled text;
- native and shared input/select/textarea surfaces;
- popup/combobox/action-menu states;
- secondary/download controls;
- tables, selected rows and dividers;
- shared badges;
- scrollbar chrome;
- autofill/date/time controls;
- Application detail panels;
- shared selected-row backgrounds.

The Dark reference aliases in `master-reference.css` now derive from canonical CRM tokens instead of defining a second literal Dark palette.

Remaining non-foundation literal values inside explicit Dark rules were audited. The only remaining cases are black-alpha shadows/backdrops; there are no remaining non-foundation literal white/blue Dark surface/text values in that scan.

## Shared accent / Application header

The repeated burgundy page/detail accent is now a shared clipped/faded gradient rather than a protruding line fragment.

The Application full-detail header uses a compact identity + status/actions grid with responsive stacking, rather than unrelated floating blocks separated by dead space.

## Scroll behavior

Compact side panes hide scrollbar chrome while preserving actual scrolling. The order pipeline also hides horizontal scrollbar chrome while retaining horizontal access at narrow widths.

## Regression test coverage added

`e2e/phase7-dark-audit.spec.ts` covers:

- compact Finance geometry and canonical terminology;
- 01–09 pipeline visibility/current-state ring geometry/contrast;
- calculation-row alignment and Review terminology;
- Files + Settings Dark controls without white islands;
- Applications + Clients scrollbar behavior.

## Verification actually run in this environment

### Passed

- `node scripts/audit-frontend-foundation.mjs`
  - foundation imported last: `true`
  - missing required tokens: `0`
  - contrast failures below 4.5: `0`
  - Dark primary: `16.25`
  - Dark secondary: `11.02`
  - Dark muted: `6.36`
  - Dark accent on surface: `5.49`
- CSS parse with `tinycss2`: `0` parse errors across all app CSS files.
- TypeScript parser-level check using global `tsc --noResolve`: `0` TS1xxx syntax diagnostics for changed TSX/E2E files. Missing project dependencies prevent this from being a full typecheck.
- Phase 07 adds `0` new `!important` declarations; total repository CSS `!important` count decreased from `35` in the Phase 06 baseline to `30`.
- Foundation legacy metrics:
  - literal color occurrences: `825 -> 676`
  - unique literal colors: `508 -> 413`
  - CSS files remain `15` (no extra delivered Phase 07 override stylesheet).
- Semantic `--crm-*` token value definitions outside `crm-foundation.css`: `0`.
- Non-foundation Dark literal audit: only black-alpha shadows/backdrops remain; no literal white/blue Dark text/surface cases were left by the scan.

### Not run / not claimed

`npm ci` could not complete in the execution environment before the transport timeout. Therefore the following are NOT claimed as passed here:

- ESLint
- full TypeScript `npm run typecheck`
- Next.js production build
- browser Playwright Phase 1–7 regression suite
- live manual browser/zoom screenshot pass

These must be run on the user's local environment before Phase 07 is frozen as the Phase 08 baseline.

## Backend / migrations

No backend code, API schema, database model or Alembic migration was changed in Phase 07.

Frontend rebuild only is required.

## Phase 08 boundary

Phase 08 may now add motion on top of this static baseline, especially the owner-requested clockwise progress-ring fill. It must not undo Phase 07 pipeline geometry, semantic colors, Finance hierarchy or Dark-state contracts.
