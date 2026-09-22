# Phase 02 — Shared UI Kit

Date: 2026-09-15  
Baseline: Phase 01 Shell / Branding / Grid / Zoom  
Scope: frontend only; no API, backend, database, tariff, auth or role-contract changes

## Goal

Freeze one shared interaction and visual vocabulary before page modules are redesigned. Phase 02 owns reusable controls and operational surfaces only. Dashboard, Applications, Clients, Executors, Orders, Files, Users and Settings remain page-composition work for later phases.

## Mandatory pre-flight

1. Read `apps/admin-web/AGENTS.md`, `docs/CRM_MVP_MASTER_SPEC.md` and the current source before editing.
2. Keep `docs/MASTER_FRONTEND_REFERENCE.jpeg` as the approved Light-theme visual reference.
3. Preserve Phase 01 shell geometry and responsive behavior.
4. Preserve all existing API calls, business logic, status logic, auth/RBAC and data contracts.
5. Use `crm-foundation.css` semantic tokens. Do not create another token namespace or add new `!important` declarations.

## Phase-owned primitives

Phase 02 establishes the canonical behavior/geometry for:

- primary / secondary / quiet / danger buttons;
- input, textarea, select and combobox states;
- field labels, hints and validation errors;
- badges/status chips;
- cards and generic raised surfaces;
- command/filter bars;
- dense table shell, row states and pagination;
- shared form grids and action rows;
- file picker;
- loading, skeleton, empty and error states;
- toast feedback;
- generic row menus and existing settings dialog shell;
- keyboard focus and reduced-motion behavior.

## Non-goals

Do not redesign in Phase 02:

- dashboard composition/metrics;
- Applications page information hierarchy;
- Clients / Executors page composition;
- Orders or order detail;
- Files page composition;
- Users / Settings internals;
- auth page composition;
- module-specific Dark-theme cleanup beyond shared primitives.

Do not introduce fake data, fake actions, fake notification state or visual-only business values.

## Geometry and behavior contract

- Standard working control height: 44px.
- Compact control target: 38px only where the information hierarchy requires it.
- Shared control radius: 8px; shared card/table radius: 12px.
- Normal working text stays in the 12–14px range.
- Hover must not change layout geometry.
- Disabled controls remain readable and cannot imply an active action.
- Focus-visible is always visible and uses the semantic accent.
- Long Russian labels and filenames may wrap; truncation is allowed only where the full value remains recoverable or is nonessential.
- Dark uses the same component geometry and semantic token roles as Light.

## Responsive contract

New shared-kit responsive work follows only:

- 1180px shell threshold (owned by Phase 01);
- 900px workspace/toolbars;
- 620px mobile stacking;
- 430px narrow-phone refinement.

The shared kit must not introduce another breakpoint family.

## Acceptance criteria

1. Phase 01 shell remains unchanged in geometry and interaction.
2. Buttons, fields, selects, badges, tables, pagination and feedback states render from one Phase 02 semantic layer.
3. Existing modules keep their behavior and real data.
4. Shared controls work in Light and Dark without white/light islands.
5. Keyboard focus is visible.
6. Select popups remain within viewport bounds.
7. Hover does not move table rows or alter document width.
8. 320 / 360 / 390 / 430 / 620 / 900 widths do not gain horizontal page overflow from shared primitives.
9. `prefers-reduced-motion` removes nonessential shared-kit animation.
10. `crm-foundation.css` remains the last CSS import and `npm run audit:foundation` passes.
11. No new `!important` declaration is introduced.

## Gate to Phase 03

After local Docker visual acceptance, Phase 02 becomes regression-frozen. Phase 03 may then redesign Dashboard + Applications using these primitives rather than introducing parallel page-specific control patterns.
