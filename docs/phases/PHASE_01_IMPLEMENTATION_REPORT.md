# Phase 01 Implementation Report — Shell / Branding / Grid / Zoom

Date: 2026-09-15  
Baseline: Phase 0 Foundation v4  
Status: ready for local Docker visual acceptance

## What changed

### Global shell
- Added a dedicated phase-owned shell layer: `src/app/phase1-shell.css`.
- Desktop sidebar is owned at 236px and topbar at 72px from Phase 0 canonical tokens.
- Workspace offset, page canvas width and gutters are now controlled by one shell contract.
- Sidebar/topbar use semantic surfaces in both Light and Dark instead of relying on legacy hardcoded shell colors.
- Added a keyboard skip link to the main workspace.

### Branding
- Simplified the Lingvo Connect mark into a stable text-rendered `LC/` wordmark plus real HTML brand copy.
- Rebuilt the lower sidebar promo so all wording is real HTML and the decorative plant is an image-only asset.
- Rebuilt the page mountain banner to use an image-only mountain asset while the phrase remains HTML.
- Removed dependence on the old baked-text promotional art for Phase 01-owned shell decoration.

### Navigation / account controls
- Sidebar active state is now a restrained soft accent state instead of a heavy saturated block.
- Hover/focus geometry is stable; nav text does not shift laterally.
- Added a close button to the off-canvas sidebar.
- Escape closes the sidebar/profile overlay state.
- Route changes close transient shell menus.
- Profile avatar no longer uses the old white inset-ring treatment.
- The fake notification pseudo-dot is explicitly disabled; notification state must come from real application data.

### Global search
- Preserved existing multi-entity API search behavior.
- Rebuilt its visual shell, focus ring and result popover using semantic tokens.
- Mobile search input is 16px to avoid browser text-input zoom behavior.

### Responsive / browser zoom
Canonical behavior now follows Phase 0 breakpoints:
- `>1180px`: fixed desktop sidebar.
- `<=1180px`: off-canvas sidebar + menu button. This intentionally catches desktop browser zoom around 175–250% on a 1920px monitor.
- `<=900px`: compact account presentation and tighter gutters.
- `<=620px`: 64px mobile topbar and full-width search result popover.
- `<=430px`: narrow-phone refinements.
- Short viewports hide the decorative sidebar promo so navigation remains primary.
- No `body { position: fixed }` or manual scroll restoration was introduced.

## Deliberately not changed
Phase 01 does not redesign module content. Existing tables, application/order cards, filters, forms, Files, Settings internals and legacy Dark-theme module surfaces are intentionally left for later gated phases.

This is important: after Phase 01 the outer product shell should visibly change, but pages may still contain the visual debt seen before the phase program started.

## Files changed / added
- `apps/admin-web/src/components/admin-shell.tsx`
- `apps/admin-web/src/app/layout.tsx`
- `apps/admin-web/src/app/phase1-shell.css` (new)
- `apps/admin-web/public/reference-assets/sidebar-plant.jpg` (new image-only asset)
- `apps/admin-web/public/reference-assets/mountain-only.jpg` (new image-only asset)
- `apps/admin-web/e2e/phase1-shell.spec.ts` (new targeted regression spec)
- `docs/phases/PHASE_01_SHELL_BRANDING.md` (phase prompt / acceptance contract)
- `docs/phases/PHASE_01_IMPLEMENTATION_REPORT.md`

## Verification actually run

### Passed
- CSS parsing with `tinycss2`: `crm-foundation.css` and `phase1-shell.css` — 0 parser errors.
- TypeScript parser-level validation using TypeScript 5.8.3:
  - `admin-shell.tsx` — 0 parse diagnostics;
  - `layout.tsx` — 0 parse diagnostics;
  - `phase1-shell.spec.ts` — 0 parse diagnostics.
- `npm run audit:foundation` — passed:
  - canonical foundation import remains last;
  - no required tokens missing;
  - canonical Light/Dark contrast checks remain >= 4.5:1;
  - no new `!important` in Phase 01 shell.

### Attempted but unavailable in this container
`npm run typecheck` was attempted. It cannot produce a meaningful semantic result because the supplied archive does not include installed npm dependencies / type packages. Errors begin with missing `@playwright/test`, `next`, React JSX runtime and Node type declarations. This is an environment limitation, not reported as a pass.

Full `next build` / Playwright runtime visual QA is therefore reserved for the user's local Docker environment where project dependencies are installed during the image build.

A direct headless Chromium screenshot attempt against a static file fixture was also abandoned because the container Chromium process did not terminate reliably under the current DBus/headless environment. It is not counted as visual QA.

## Local acceptance checklist before freezing Phase 01
1. Light: Overview at 100% and 125% browser zoom.
2. Dark: Overview and one data-heavy page; shell must contain no white header/sidebar islands.
3. 175%, 200%, 250% zoom: sidebar must be off-canvas and content must not sit behind it.
4. Open/close mobile sidebar; Escape and scrim both close it.
5. Global search still returns real results.
6. Profile menu / Settings / logout still work.
7. Check 390px or phone responsive mode: no shell horizontal overflow.
8. Confirm the sidebar lower plant card has readable HTML text and does not block navigation.

If these pass, Phase 01 becomes the frozen baseline for Phase 02 UI Kit.
