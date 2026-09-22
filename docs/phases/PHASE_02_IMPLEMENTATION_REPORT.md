# Phase 02 Implementation Report — Shared UI Kit

Date: 2026-09-15  
Baseline: Phase 01 Shell / Branding / Grid / Zoom  
Status: implemented; verification results recorded below

## What changed

### Canonical shared UI layer
- Added `src/app/phase2-ui-kit.css` and imported it immediately before the canonical token owner `crm-foundation.css`.
- Standardized shared buttons, form controls, Select popup, badges, card/surface geometry, command/filter surfaces, table shell, pagination, file picker, feedback states, toasts, row menus and the existing dialog shell.
- New Phase 02 rules consume only semantic `--crm-*` / `--ui-*` tokens; no new visual token namespace was created.
- Added 900 / 620 / 430 responsive rules for shared-kit composition without changing the Phase 01 1180px shell threshold.
- Added reduced-motion handling for shared-kit transitions and loading decoration.

### Semantic foundation
- Added `--crm-on-accent` so primary controls can maintain explicit foreground contrast in both Light and Dark without hardcoding a component-specific foreground color.

### Shared React primitives
- Kept the existing `Button`, `Input`, `Textarea`, `FilePicker`, `Badge`, `Card`, loading/error/empty APIs compatible.
- Added `danger` and `info` badge tones for future modules without inventing new business state.
- Fixed Textarea label wiring to match Input accessibility behavior.
- Added status semantics to loading/skeleton output and explicit decorative `aria-hidden` markers.
- Toast messages now have explicit status/alert semantics and a stable message element while preserving the existing notify API.

### Regression specification
- Added `e2e/phase2-ui-kit.spec.ts` covering:
  - 44px shared control geometry;
  - visible keyboard focus;
  - select popup viewport bounds;
  - table/badge surface geometry and stable row hover;
  - shared Dark-theme surfaces;
  - no page overflow at 900 / 620 / 430 / 390 / 360 / 320 widths.

## Deliberately not changed

Phase 02 does not redesign module composition. Dashboard, Applications, Clients, Executors, Orders, Files, Users, Settings and auth pages keep their current structure. No backend, API, SQLAlchemy, Alembic, PostgreSQL, pricing, tariff, payment, RBAC or auth code was changed.

## Files changed / added

- `apps/admin-web/src/app/crm-foundation.css`
- `apps/admin-web/src/app/globals.css`
- `apps/admin-web/src/app/layout.tsx`
- `apps/admin-web/src/app/master-reference.css`
- `apps/admin-web/src/app/phase2-ui-kit.css` (new)
- `apps/admin-web/src/app/workspace-polish.css`
- `apps/admin-web/src/components/ui.tsx`
- `apps/admin-web/src/components/toast.tsx`
- `apps/admin-web/e2e/phase2-ui-kit.spec.ts` (new)
- `apps/admin-web/AGENTS.md`
- `docs/CRM_MVP_MASTER_SPEC.md`
- `docs/phases/PHASE_02_SHARED_UI_KIT.md` (new)
- `docs/phases/PHASE_02_IMPLEMENTATION_REPORT.md` (new)
- `CHANGED_FILES_PHASE_02.txt` (new)

## CSS-debt consolidation

Phase 02 deliberately moved generic shared primitive ownership out of older broad/page-polish layers and into `phase2-ui-kit.css`. Compared with the Phase 01 baseline:

- cross-file duplicate selectors: **548 → 534**;
- literal color occurrences: **1024 → 933**;
- unique literal colors: **621 → 578**;
- existing `!important` declarations: **35 → 35** (no new declarations);
- `phase2-ui-kit.css` itself contains **0** `!important` declarations.

The CSS file count increases by one because Phase 02 adds a canonical shared-kit owner, while legacy duplication decreases.

## Verification

Passed in this environment:

- `node scripts/audit-frontend-foundation.mjs` — passed; foundation remains the final CSS import, required tokens are present, and all reported Light/Dark contrast checks pass.
- CSS syntax parse with `tinycss2` for all application CSS files — 0 parser errors.
- TypeScript parser diagnostics for `src/components/ui.tsx`, `src/components/toast.tsx`, `src/app/layout.tsx` and `e2e/phase2-ui-kit.spec.ts` using TypeScript 5.8.3 — 0 parser diagnostics.
- Phase 02 new-`!important` audit — 0 declarations in `phase2-ui-kit.css`.

Not claimed as passed in this container:

- `npm run typecheck`;
- `npm run build`;
- Playwright runtime execution.

`npm ci` could not complete because the container dependency-install step timed out, leaving no usable local Next/TypeScript/Playwright installation. Docker CLI is also unavailable in this execution environment, so a container build could not be run here. The partial `node_modules` directory was removed before packaging. These checks should be run locally using the commands below.

## Local acceptance commands

From the extracted project root in PowerShell:

```powershell
docker compose build frontend
docker compose up -d frontend
docker compose ps
docker compose logs --tail=100 frontend
```

For the frontend verification gate outside Docker:

```powershell
cd .\apps\admin-web
npm ci
npm run audit:foundation
npm run typecheck
npm run build
npx playwright test e2e/phase1-shell.spec.ts e2e/phase2-ui-kit.spec.ts
```

Do not use `docker compose down -v` for this visual phase; no database or migration reset is required.
