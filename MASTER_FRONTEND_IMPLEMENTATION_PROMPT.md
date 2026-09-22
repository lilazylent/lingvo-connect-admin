# Lingvo Connect Admin — master frontend implementation prompt

## Mission
Rebuild the Lingvo Connect Admin frontend around the user-approved Minimal / Professional master reference while preserving the current backend, API contracts, database, authorization, roles, calculations and operational workflows. The frontend must feel like one coherent product, not a layer of page-specific patches.

## Visual source of truth
`docs/MASTER_FRONTEND_REFERENCE.jpeg` is the master reference for the shell and Light theme. Existing application behavior/data is the source of truth for functionality. When screenshot and data model disagree, keep real functionality and reproduce the screenshot's hierarchy/geometry without inventing data.

## Non-negotiable operating protocol
1. PRE-FLIGHT: read the actual current component, CSS, route, API call, type and neighboring shared patterns before changing it.
2. DIAGNOSIS: state what exists, what is visually/structurally wrong and whether it is local or shared-system debt.
3. PLAN: identify the smallest coherent set of shared primitives and page changes that solves the problem globally.
4. IMPLEMENT: prefer shared shell/tokens/components. Do not stack emergency overrides page by page.
5. VERIFY: re-read output; parse/typecheck/test/build when dependencies permit; explicitly separate checks actually run from checks unavailable.
6. REGRESSION: inspect neighboring routes and states touched by shared selectors/components.

## Reference design system
- Typeface: Onest variable already present in the project.
- Primary Light canvas: nearly white neutral (#fbfbfc family), shell/surfaces white.
- Border: fine neutral gray (#e5e8ee family), never heavy black outlines.
- Text: near-black navy-neutral (#101522 family), secondary slate gray.
- Accent: Lingvo pink/red (#e41f5b family), used sparingly for active nav, primary CTA, focus and selected state.
- Secondary semantic families: blue, green, orange, violet as soft status/metric accents.
- Radius: 10–12px system; compact controls may use 8–10px.
- Shadows: restrained; separation primarily through surface/border/spacing.
- Desktop sidebar: ~236px. Desktop topbar: ~72px.
- Content: spacious page headers, compact operational content, dense readable tables.

## Shared UI hierarchy
Create/maintain one canonical visual pattern for:
- application shell/sidebar/topbar/global search/profile;
- page hero/breadcrumb/title/subtitle/reference banner;
- metric cards;
- finance/summary strip;
- command/filter bars;
- tables and row states;
- side detail panels/drawers;
- tabs;
- buttons (primary/secondary/ghost/destructive);
- form fields/selects/textareas/date controls;
- badges/status chips;
- pagination;
- modal/dialog/popover/dropdown/toast;
- empty/loading/error/disabled states;
- auth/2FA/recovery screens.
Same semantics must produce the same geometry/states across modules.

## Functional integrity
- Never introduce fake counters, unread dots, ratings, percentages, balances, statuses or actions only because they are visible in a mockup.
- Values shown in operational UI must come from existing API/model state or be explicit static copy.
- Do not change calculations, tariff logic, urgency/discount logic, executor assignments, payments, file storage, auth, permissions or migrations as part of a visual redesign unless separately required.
- Existing actions must remain discoverable and functional even if their placement changes.

## Pages in scope
The system must be coherent across:
- Overview/dashboard;
- Applications list, application card, manual application creation;
- Clients directory and detail/edit states;
- Orders list/Kanban, order detail/edit, works, pricing, executors, payments, files, history;
- Executors directory/detail/edit;
- Files workspace and exports;
- Users/roles/access/security;
- Settings modules;
- Login, password recovery/change, 2FA setup/verify;
- access-denied/error/empty/loading states.

## Responsive + zoom acceptance
Treat browser zoom as viewport reduction. Do not force desktop geometry at high zoom.
Required widths: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440+.
Required desktop zoom reasoning: 100, 125, 150, 175, 200, 250%.
At <=1180 CSS px the desktop sidebar must become off-canvas. Grids, toolbar controls and split views reflow. No horizontal page overflow, overlapping actions, clipped Russian labels or unreadably narrow detail panes.
Use `min-width:0` correctly in flex/grid; truncate only where full text remains accessible or nonessential.

## Theme rules
Light is the approved master. Dark is a semantic companion using identical geometry/hierarchy:
canvas -> shell -> surface -> raised -> interactive states.
Use graphite neutrals, not blue/green tinted mud. No accidental white islands, no white-on-white text. Respect WCAG AA: normal text >=4.5:1; meaningful non-text/large text per applicable >=3:1 guidance.
System / Light / Dark switching must be deterministic and avoid theme flash.

## Motion/FX
Use motion as feedback and hierarchy, not decoration. Frequent feedback 50–150ms, local popup/transitions roughly 150–220ms, larger context changes restrained. Prefer transform/opacity. No looping decorative motion in operational CRM. `prefers-reduced-motion` must collapse nonessential motion.

## Acceptance criteria
- The first impression and proportions clearly match `docs/MASTER_FRONTEND_REFERENCE.jpeg`.
- Every major route looks like the same CRM product.
- No fake operational data/actions introduced by the redesign.
- Existing backend/business workflows remain intact.
- Light theme is polished and reference-faithful.
- Dark theme remains readable and semantically equivalent.
- 175–250% zoom no longer produces a compressed desktop shell.
- No role badge white inset stripe or legacy visual artifact returns.
- Keyboard focus, hover, selected, loading, empty, error and disabled states are visible and consistent.
- Any unavailable build/e2e verification is reported, never implied.
