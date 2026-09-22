# Phase 09 Owner Patch 04 — Preliminary Calculation Action Alignment

Build ID: `phase09-mvp-release-candidate-20260916-r3`

## Owner feedback

The `Скопировать текст` control inside `Финансы → Для клиента → Предварительный расчёт` was horizontally correct but sat too close to the upper divider of the expanded utility. The visual result left noticeably more empty space below the button than above it.

## Diagnosis

`phase5-client-quote__body` used a normal two-row grid with `gap: var(--ui-space-3)` and no explicit action lane. Because the button was the first grid item, it started immediately at the top edge of the body while all spacing accumulated after it.

## Patch

The Phase 05 owner stylesheet now gives the expanded preliminary-calculation body an explicit `54px` minimum action lane followed by the calculation text row. The button is vertically centered inside that lane:

- `grid-template-rows: minmax(54px, auto) auto`;
- `gap: 0`;
- button `align-self: center`;
- horizontal placement remains `justify-self: end`.

This keeps the existing card height/rhythm effectively stable while balancing the button vertically between the section divider and the calculation text surface.

No business logic, calculation data, copy behavior, API contract, backend schema, migration or Phase 10 functionality was changed.

## Verification

Run from `apps/admin-web`:

- `node scripts/audit-frontend-foundation.mjs`
- `node scripts/audit-css-ownership.mjs`
- `node scripts/audit-phase8-owner-patch.mjs`
- `node scripts/audit-phase9-release-candidate.mjs`

Runtime acceptance remains a local visual check in the real browser at desktop plus narrow responsive widths.
