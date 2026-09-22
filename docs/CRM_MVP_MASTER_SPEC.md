# Lingvo Connect CRM — MVP Master Specification

Status: **canonical**  
Owner original 26-point specification: `docs/CRM_MVP_MASTER_SPEC_OWNER_ORIGINAL_26.txt`  
Public-site motion reference: `docs/references/LINGVO_PUBLIC_SITE_MOTION_REFERENCE_2026-09-15.mp4`  
Owner video-review transcript: `docs/references/OWNER_VIDEO_REVIEW_TRANSCRIPT_2026-09-15.pdf`  
Baseline: `Lingvo_Connect_Admin_Master_Reference_Frontend_v3`  
Visual master: `docs/MASTER_FRONTEND_REFERENCE.jpeg`  
Created: 2026-09-15

## 1. Purpose

Deliver a client-ready MVP of Lingvo Connect CRM whose frontend feels like one deliberate product, not a sequence of CSS patches. The approved Minimal / Professional CRM reference defines geometry and information hierarchy. The public Lingvo Connect website informs brand character. The existing API/database remains the source of truth for real functionality and data.

## 2. Non-negotiable implementation protocol

Every phase uses:

`LATEST CODE -> PRE-FLIGHT -> DIAGNOSIS -> PLAN -> IMPLEMENT -> RE-READ -> VERIFY -> VISUAL QA -> REPORT -> NEW BASELINE`

Rules:

- Never code from memory when current files are available.
- Prove the cause of a bug before adding a workaround.
- Same semantic UI means the same shared component/pattern.
- No duplicate helper/component/API when an existing one can be extended safely.
- No business-logic/API/database change for visual convenience.
- No fake counters, ratings, percentages, notification dots or actions.
- No mutation of React state/props.
- Effects touching body, scroll, focus, viewport or global listeners require a demonstrated need and cleanup.
- Long Russian copy, filenames, money, email, empty values and errors are first-class states.
- A phase is frozen after approval. Later shared changes must regression-check every previously approved phase.
- Never claim a test passed unless it ran.

## 3. Approved visual direction

### CRM master reference

`docs/MASTER_FRONTEND_REFERENCE.jpeg` is the primary reference for:

- shell geometry;
- sidebar/topbar proportions;
- layout density;
- cards and tables;
- split workspaces;
- radii and borders;
- Light-theme hierarchy;
- status-chip treatment;
- page rhythm.

### Lingvo Connect public-site influence

Use the website only for brand character, not landing-page composition:

- warm clean background;
- restrained wine/pink accent;
- deep navy/graphite text;
- thin rules;
- editorial whitespace;
- calm premium tone.

## 4. Semantic design system

New visual code must consume the canonical tokens in `apps/admin-web/src/app/crm-foundation.css`.

Required roles:

- canvas;
- shell;
- surface;
- raised surface;
- hover surface;
- default/strong border;
- primary/secondary/muted text;
- accent;
- success/warning/danger/info;
- focus;
- elevation;
- spacing;
- radii;
- control heights;
- motion;
- z-index layers.

No new page should invent an independent palette or spacing scale.

## 5. Typography and density

- Onest is the product font.
- Owner review supersedes the earlier micro-type scale: all working/micro UI copy across the CRM must be enlarged by roughly **1.5×** from the previous implementation.
- This includes subtitles, body copy, table text, labels, helper text, tabs, status text, numbers, buttons, filters, forms and detail panels.
- Large bold page/display headings may remain approximately at the approved Phase 1–4 size; the readability pass must not inflate those titles proportionally.
- The canonical shared working scale is owned by `crm-foundation.css`; page phases must not reintroduce 9–12 px operational text through local overrides.
- Compactness must come from grid, spacing and information hierarchy rather than unreadably small type.
- Avoid stretched full-width content that creates dead space on 1440–1920 px screens.

## 6. Shell and brand

Unify:

- 236 px desktop sidebar;
- 72 px topbar;
- global search;
- profile menu;
- role badge;
- responsive/off-canvas navigation;
- real HTML copy over decorative brand images;
- consistent page container and header system.

Notification indicators render only from real application state.

## 7. Core pages

The MVP includes and visually consolidates:

1. Dashboard / Обзор
2. Заявки
3. Клиенты
4. Заказы
5. Исполнители
6. Файлы
7. Пользователи
8. Настройки
9. application detail/create flows
10. client detail workspace
11. order detail/edit flows
12. executor detail workspace
13. file detail/preview
14. auth / 2FA / recovery / password-change flows
15. all modals, drawers, popovers, forms and system states

## 8. Order workspace

The order experience must prioritize:

- order header and status;
- compact pipeline;
- Overview / Works / Finances / Files / History navigation;
- client/contact/manager/deadline/language/volume context;
- financial hierarchy: total, paid, debt, cost, profit, margin;
- translation works as production units;
- multi-executor assignments;
- urgency coefficient;
- manual/automatic discounts;
- preliminary client estimate without internal costs;
- payments/files;
- one readable chronological timeline.

## 9. Dark theme

Dark is the same product geometry using semantic graphite/navy surfaces.

Acceptance criteria:

- no accidental white islands;
- no white text on light controls;
- inputs/selects/dropdowns/modals/tables/file UI/auth/settings covered;
- readable primary/secondary/muted hierarchy;
- visible focus;
- color is never the sole status cue;
- WCAG AA contrast target for normal text >= 4.5:1, applicable large/non-text UI >= 3:1.

## 10. Motion / EFX

Motion exists to communicate hierarchy, state, feedback or spatial relationship.

- frequent interactions: roughly 70–150 ms;
- popovers/local transitions: roughly 150–220 ms;
- larger panels/context: roughly 180–300 ms;
- prefer transform/opacity;
- no perpetual decorative motion in working surfaces;
- no animation blocks task completion;
- support `prefers-reduced-motion`;
- hover motion is supplemental, never the only cue.

## 11. Responsive and zoom

Required viewport checks:

`320 / 360 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920`

Required desktop browser zoom checks:

`100 / 125 / 150 / 175 / 200 / 250%`

The interface must reflow from desktop -> compact desktop -> tablet -> mobile. It must not compress desktop composition beyond readable density.

Canonical breakpoint targets for new work:

- `>1180`: desktop shell;
- `901–1180`: compact/tablet shell, sidebar off-canvas where required;
- `621–900`: tablet/workspace stacking;
- `<=620`: mobile layout;
- `<=430`: narrow-mobile refinement.

Legacy breakpoints are migration debt, not precedents for new code.

## 12. Accessibility and interaction

- Native semantic HTML first; ARIA only where needed.
- Keyboard access for interactive controls.
- Visible `:focus-visible`.
- Normal browser text editing behavior must remain intact.
- Touch target target size: 44 px where practical.
- Mobile virtual keyboard, focus, popup bounds and scroll behavior require explicit QA.

## 13. Data integrity

Frontend references never authorize invented data. A displayed business value/action must be backed by:

1. existing API/model data; or
2. a clearly static UI label/decoration.

Backend contracts for auth, applications, clients, orders, works, executors, pricing, discounts, urgency, payments, files, history, tariffs and settings are preserved unless a later phase explicitly requires an end-to-end contract change.

## 14. Verification contract

For each phase, run as available:

1. syntax/parsing;
2. TypeScript typecheck;
3. targeted tests;
4. lint;
5. production build;
6. backend tests when contracts are touched;
7. Playwright for critical flows;
8. Light/Dark visual QA;
9. viewport/zoom QA;
10. regression review of previously approved phases.

Unavailable checks must be reported as unavailable, never implied successful.

## 15. Delivery phases

- Phase 0 — audit and foundation
- Phase 1 — global shell and branding
- Phase 2 — shared UI kit
- Phase 3 — Dashboard + Applications
- Phase 4 — Clients + Executors
- Phase 5 — Orders + Order detail
- Phase 6 — Files + Users + Settings
- Phase 7 — complete Dark-theme audit
- Phase 8 — motion/EFX premium polish
- Phase 9 — final MVP QA and release candidate

Each approved phase becomes the immutable baseline for the next one.

## Phase status ledger
- Phase 0 — Foundation: locally accepted by user on 2026-09-15.
- Phase 1 — Shell / Branding / Grid / Zoom: completed and accepted by owner on 2026-09-15.
- Phase 2 — Shared UI Kit: promoted to the Phase 03 baseline by owner instruction on 2026-09-15; owner regression feedback is recorded in `docs/OWNER_FEEDBACK_PHASE_MAP_2026-09-15.md`.
- Phase 3 — Dashboard + Applications: promoted to the Phase 04 baseline by owner instruction on 2026-09-15.
- Phase 4 — promoted by owner instruction to the Phase 05 working baseline on 2026-09-15; owner transcript regressions remain tracked as shared fixes.
- Phase 5 — Orders + Order detail: accepted as the Phase 06 working baseline after owner review and E2E regression fixes on 2026-09-15.

- Phase 6 — Files + Users + Settings: implementation delivered and promoted by owner instruction to the Phase 07 working baseline on 2026-09-15.
- Phase 7 — Dark Theme System Audit + cross-project visual consolidation: completed and consolidated into the current CSS ownership baseline on 2026-09-15.
- Phase 8 — Visual identity / motion / owner-review Patch 02 / Settings Concept C: source baseline completed on 2026-09-16 and promoted by owner instruction into Phase 09 release QA.
- Phase 9 — Final MVP QA + release candidate: accepted by owner on 2026-09-16. Build `phase09-mvp-release-candidate-20260916-r3` is the frozen MVP baseline for Phase 10.
- Phase 9 owner Patch 03: cancelled-order archive discoverability, MAIN/ARCHIVE status separation, configurable archive reasons, Finance/client-quote grid alignment, and order-file row stabilization are accepted RC fixes; general named pipelines remain post-MVP.
- Phase 10.0/10.1 — architecture freeze + persisted executor availability: active from 2026-09-16. Matching/routing itself remains gated to Phase 10.2+.
