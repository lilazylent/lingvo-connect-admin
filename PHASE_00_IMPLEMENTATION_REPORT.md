# Lingvo Connect Admin — Phase 0 Implementation Report

Date: 2026-09-15  
Baseline: `Lingvo_Connect_Admin_Master_Reference_Frontend_v3`

## Result

Phase 0 technical foundation is implemented. It is intentionally not marked as regression-frozen until the user runs the real Docker build/runtime locally.

## Changed

- Added canonical semantic token owner: `apps/admin-web/src/app/crm-foundation.css`.
- Imported that foundation last from `src/app/layout.tsx` so legacy token roots cannot silently win by cascade order.
- Added canonical Light/Dark palette, typography, spacing, geometry, elevation, motion and z-index contracts.
- Added compatibility aliases for historical `--ref-*`, `--lc-*` and oldest token names so later phases can migrate safely instead of rewriting 6k+ CSS lines at once.
- Dark/light canonical text and accent contrast is checked by the audit script.
- Added `npm run audit:foundation`.
- Added `docs/CRM_MVP_MASTER_SPEC.md` as the MVP constitution.
- Added Phase 0 specification/internal prompt and frontend-debt audit.
- Extended `AGENTS.md` with phase gating, token ownership and breakpoint rules.
- No React page/component implementation was changed.
- No backend/API/model/migration file was changed.

## Measured legacy CSS debt

The conservative static audit currently reports:

- 9 legacy global CSS files;
- ~6.6k legacy CSS lines;
- 35 `!important` declarations;
- 1,023 literal hex occurrences / 620 unique hex values;
- 547 cross-file duplicate selectors;
- 37 media-query variants.

These are baseline debt counters. Future phases should lower them, not hide them with another global override layer.

## Verification actually performed

### Passed

- `npm run audit:foundation`
  - foundation is final CSS import;
  - required semantic tokens found;
  - Light primary contrast 17.62:1;
  - Light secondary 5.05:1;
  - Light muted 4.51:1;
  - Light accent on surface 4.52:1;
  - Dark primary 16.25:1;
  - Dark secondary 11.02:1;
  - Dark muted 6.36:1;
  - Dark accent on surface 5.49:1.
- CSS parser: 0 stylesheet parse errors.
- TypeScript parser-level check: 44 TS/TSX source files, 0 syntax diagnostics.
- Directory diff confirms no `src/components` implementation changes.

### Not available in this container

Full `npm run typecheck` cannot produce a meaningful project result because the supplied archive has no `node_modules`; TypeScript therefore cannot resolve React, Next, Playwright or Node types. The command was attempted and failed on missing dependencies rather than Phase 0 syntax.

For the same reason, Next production build, ESLint and Playwright were not claimed as passed.

## Local acceptance gate

Before Phase 1 is frozen, run the project with the existing local `.env` and Docker volumes:

```powershell
cd "C:\Users\lilaz\OneDrive\Документы\ChatGPT\lingvo-connect-admin"
docker compose down
docker compose up --build -d
docker compose ps
```

Do **not** use `docker compose down -v`.

Then smoke-check login, Dashboard, one application, one order, theme switching and 175–250% zoom. Phase 0 should not intentionally alter page composition; any visible regression is therefore a foundation bug and must be fixed before Phase 1.
