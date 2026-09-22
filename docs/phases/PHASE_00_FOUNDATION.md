# Phase 0 — Technical Audit & Frontend Foundation

Status: **implemented / awaiting local runtime verification**  
Date: 2026-09-15

## Goal

Create a stable technical contract before further page redesign. Phase 0 deliberately avoids page-specific redesign. It centralizes ownership of design tokens, records legacy CSS debt, freezes the master specification and gives every later phase measurable rules.

## Pre-flight baseline

Source inspected: `Lingvo_Connect_Admin_Master_Reference_Frontend_v3`.

Frontend routes found:

- `/admin`
- `/admin/applications`
- `/admin/applications/new`
- `/admin/applications/[id]`
- `/admin/clients`
- `/admin/orders`
- `/admin/translators`
- `/admin/files`
- `/admin/imports`
- `/admin/users`
- `/admin/settings`
- auth / 2FA / recovery / password-change routes

Backend is a separate FastAPI application under `apps/api`; Phase 0 changes no API/model/migration code.

## Audit findings

The v3 visual result is constrained by CSS architecture more than by React architecture.

Before Phase 0 the frontend had:

- 9 global CSS files;
- ~6.5k CSS lines;
- 35 `!important` declarations;
- >1,000 literal hex-color occurrences;
- >500 selectors defined in more than one CSS file by conservative static scan;
- dozens of overlapping breakpoint spellings/values;
- several generations of token names: legacy `--navy/--paper`, `--lc-*`, `--crm-*`, and `--ref-*`;
- multiple files independently declaring theme/motion tokens.

This explains why a visually correct local patch can be overridden later by import order, dark-mode selectors or a legacy responsive rule.

## Phase 0 implementation

### Canonical token owner

Added:

`apps/admin-web/src/app/crm-foundation.css`

It now owns:

- typography scale;
- spacing rhythm;
- shell/control geometry;
- Light semantic palette;
- Dark semantic palette;
- elevation;
- motion timing/easing;
- z-index contract;
- compatibility aliases for `--ref-*`, `--lc-*` and oldest variable names.

It is imported after all existing visual layers. This is intentional during migration: legacy roots can remain temporarily without being allowed to silently redefine the canonical values.

### Frozen master specification

Added:

`docs/CRM_MVP_MASTER_SPEC.md`

This is the project-level acceptance contract for Phases 0–9.

### Static foundation audit

Added:

`apps/admin-web/scripts/audit-frontend-foundation.mjs`

Run with:

`npm run audit:foundation`

It verifies that the canonical foundation remains the final CSS import and contains required semantic tokens. It also reports legacy CSS debt without failing the build merely because historical debt still exists.

## Canonical responsive contract for new phases

New page/layout work uses only these target breakpoints unless a demonstrated component-specific exception is documented:

- desktop: `>1180px`
- compact/tablet shell: `<=1180px`
- tablet stack: `<=900px`
- mobile: `<=620px`
- narrow mobile: `<=430px`

Legacy breakpoints remain until their owning module is migrated in its phase.

## What Phase 0 intentionally does NOT do

- no Dashboard redesign;
- no shell redesign;
- no order-card redesign;
- no removal of all legacy CSS in one risky patch;
- no API/database changes;
- no business-rule changes;
- no new fake visual data.

Those changes belong to later isolated phases.

## Exit criteria

Phase 0 is complete when:

- master specification exists;
- canonical token file is the last style import;
- Light/Dark semantic values are centralized;
- motion values are centralized;
- CSS debt baseline is measurable;
- the project still parses;
- `audit:foundation` passes;
- local Docker build/runtime produces no regression.

The final item must be checked on the user's real local Docker environment before Phase 1 is declared frozen.
