# Lingvo Connect CRM — Phase 05 Owner Review Fix

Date: 2026-09-15
Baseline: `Lingvo_Connect_Admin_Phase_05_Orders_Order_Detail_v1.zip`
Source review: `2026-09-15 15-08-17` video + transcript.

## Implemented

- Refined sidebar/auth `LC/` mark toward the public-site scale and restrained weight.
- Tightened `АДМИН-ПАНЕЛЬ`, right-aligned to the Lingvo Connect wordmark so the lower line does not overrun it.
- Applications row overflow menu now closes on outside pointer click, Escape and after selecting an action.
- Replaced application-detail legacy blue/light literals with semantic CRM text/surface tokens.
- Rebuilt application detail header controls so current status, status selector and client/order relation actions share one aligned control region.
- Replaced the old hard 260px burgundy content line with a short inner-grid gradient accent.
- Removed the legacy top divider from comment lists and clipped comment cards cleanly to their radius.
- Aligned order work index (`01`) and service identity with a stable 38px lead column and centered typography.
- Reduced finance tile height/padding and moved the Phase 05 finance summary to a denser five-column contract.
- Kept preliminary client estimate collapsed by default.

## Explicitly deferred to Phase 06

Files white download buttons/separators, Files blue copy, download arrow overflow, remaining global row-menu viewport placement (especially Users), and Settings consolidation remain Phase 06 scope.

## Backend / database

No backend, API, database, migration or Docker changes.

## Verification

Actually passed in this environment:

- `npm run audit:foundation` equivalent (`node scripts/audit-frontend-foundation.mjs`): foundation remains the final import, missing required tokens = 0, contrast failures below 4.5 = 0.
- TypeScript/TSX syntax parser (`transpileModule`) on both changed Applications files and the updated Phase 05 E2E spec: 0 parser errors.
- CSS parser (`tinycss2`) across all 15 app stylesheets: 0 parse errors.
- Total existing `!important` declarations remain 35 (unchanged from the Phase 05 baseline); this patch adds none.
- Literal hex-color occurrences across app CSS dropped from 914 to 881 because Application detail literals were replaced with semantic tokens.

Not claimed as passed: full `npm run typecheck`, `npm run lint`, `npm run build`, or Playwright browser execution. The archive has no complete `node_modules`, and this runtime does not provide the project browser/Docker environment needed for an honest end-to-end claim.
