# Phase 01 — Global Shell, Branding, Grid and Zoom

Status: implementation phase  
Baseline: Phase 0 Foundation v4  
Visual source of truth: `docs/MASTER_FRONTEND_REFERENCE.jpeg`  
Product source of truth: current repository + existing API contracts

## Operating prompt

Work as a senior product frontend engineer and UI systems designer on Lingvo Connect CRM.

Before editing code:
1. Read `AGENTS.md`, `docs/CRM_MVP_MASTER_SPEC.md`, `crm-foundation.css`, the current shell component, all competing shell selectors, and the approved master reference.
2. Separate shell responsibilities from page/module responsibilities. Phase 01 may change the global shell, brand presentation, page container, responsive/off-canvas behavior, and shell-owned decorative assets. It must not redesign business modules yet.
3. Preserve auth, routes, API calls, search behavior, profile/logout, permissions, theme preference and all backend contracts.
4. Do not solve downstream page problems with page-specific overrides in this phase.
5. Use canonical semantic tokens. No new token namespace. No new `!important`.
6. Treat 175–250% browser zoom as a reduced CSS viewport. The shell must reflow, not compress.
7. Light geometry must match the Minimal / Professional master reference. Dark must use the same geometry with semantic graphite surfaces.
8. Brand character should feel related to enlingvo.ru: calm, editorial, warm-neutral Light surfaces, dark navy/graphite text and restrained wine/pink accent.
9. Decorative image assets must contain imagery only; copy remains real HTML.
10. Never render fake notification dots, counts or business state.

## Phase scope

### Desktop shell (>1180 CSS px)
- 236px fixed sidebar.
- 72px sticky topbar.
- Workspace offset exactly by sidebar width.
- Comfortable but compact page gutters.
- Global search aligned with reference and capped so it does not consume the full header.
- Profile block aligned at top-right, without decorative white/inset artifacts.
- Sidebar navigation has one stable active pattern and one stable hover pattern.
- Lower brand/promo card uses real HTML copy over a plant image.

### Compact/tablet shell (<=1180 CSS px)
- Sidebar becomes off-canvas.
- Workspace uses full viewport width.
- Menu button appears in topbar.
- Scrim closes navigation.
- Existing route navigation closes the drawer.
- No body-position scroll locking.

### Tablet (<=900 CSS px)
- Search and account controls stay usable.
- Profile copy may collapse while avatar remains accessible.
- Page gutters tighten without destroying content hierarchy.

### Mobile (<=620 / <=430 CSS px)
- 64px topbar.
- Search remains usable and does not overlap menu/profile.
- Sidebar drawer fits narrow phones and remains vertically scrollable.
- Promo card does not block navigation on short screens.
- Touch targets are approximately 44px where practical.

## Visual rules
- Onest throughout product shell.
- Fine semantic borders, no heavy framing.
- Active navigation = soft accent surface + accent icon/text, not a full saturated block.
- Sidebar/topbar surfaces are true semantic shell surfaces in both themes.
- Page canvas is visually separate from shell by border and tone, not shadow-heavy decoration.
- No fake bell/notification state.
- No embedded text inside decorative image assets.

## Acceptance criteria
1. Shell works at 1920, 1440, 1280, 1024, 900, 768, 430, 390, 360 and 320 widths.
2. Desktop browser zoom 100/125/150/175/200/250% has no shell overlap; <=1180 CSS px uses off-canvas sidebar.
3. No horizontal document overflow caused by shell.
4. Light and Dark share identical geometry.
5. Sidebar and topbar contain no accidental Light-only hardcoded surfaces in Dark.
6. Sidebar promo copy is HTML; imagery is decorative only.
7. Search, profile menu, logout and navigation preserve behavior.
8. Keyboard focus is visible for shell controls.
9. Reduced-motion users do not receive required spatial animation.
10. Foundation audit still passes and no new `!important` is introduced.

## Do not redesign in Phase 01
- tables;
- forms;
- order cards;
- client/executor split panels;
- files workspace;
- settings internals;
- module-specific Dark-theme debt.

Those belong to later gated phases.
