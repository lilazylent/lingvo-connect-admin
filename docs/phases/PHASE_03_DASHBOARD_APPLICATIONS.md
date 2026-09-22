# Phase 03 — Dashboard + Applications

Date: 2026-09-15  
Baseline: Phase 02 Shared UI Kit  
Scope: frontend composition and page-level interaction only; no backend/database/auth contract changes

## Source of truth

Read before editing:

1. `apps/admin-web/AGENTS.md`
2. `docs/CRM_MVP_MASTER_SPEC.md`
3. `docs/CRM_MVP_MASTER_SPEC_OWNER_ORIGINAL_26.txt`
4. `docs/MASTER_FRONTEND_REFERENCE.jpeg`
5. current Dashboard / Applications React and CSS
6. `docs/references/LINGVO_PUBLIC_SITE_MOTION_REFERENCE_2026-09-15.mp4` for brand/motion character only

Phase 0 foundation, Phase 1 shell and Phase 2 shared primitives remain regression-frozen. Shared selectors may only change when a visible regression is proven and previously approved surfaces are rechecked.

## Phase ownership

Phase 03 owns:

- Dashboard / Обзор composition and visual polish;
- Dashboard metrics, finance strip, recent records, quick actions and system card;
- Applications list page header, KPI strip, search/filter command area, table, selection state and selected-application preview;
- selected-application preview tabs and real data-backed content;
- page-specific Light/Dark semantic color usage for Dashboard and Applications;
- readability/density of Dashboard and Applications at desktop/tablet/mobile widths;
- targeted regression fixes exposed by Phase 02 when they are clearly shared geometry defects and can be fixed without changing business contracts.

Phase 03 does **not** redesign:

- Clients / Executors composition (Phase 04);
- Orders / Kanban / order detail command layout (Phase 05);
- Files / Users / Settings composition (Phase 06);
- whole-product Dark audit (Phase 07);
- final motion/EFX pass (Phase 08).

## Owner feedback incorporated on 2026-09-15

### Fix now in Phase 03

- Login form: the submit button visually touches/overlaps the password control. This is a baseline geometry regression, not a future design feature. Restore deliberate vertical form rhythm.
- Dark Dashboard: secondary quick-action buttons must not become glaring white islands. Use semantic raised/hover surfaces.
- Dark Dashboard: compact table text, labels and secondary copy must stay readable and not fall back to dark navy literals.
- Dark Applications: selected preview labels/values/message must use semantic text roles. No dark-blue-on-graphite copy.
- Applications selected preview tabs must be real interactive tabs. `Информация`, `Контакты`, `Файлы` may not be decorative labels.
- Application Files tab must show only real files from the existing application-detail API and real download links.
- Small operational copy in the touched pages must be readable; sub-11px text is reserved for genuinely tertiary metadata.

### Explicitly deferred but recorded

- Clients: split workspace and remaining page-specific color/readability problems -> Phase 04.
- Orders: `Архив` and `Таблица / Kanban` must be placed as one deliberate command group without large dead zones -> Phase 05.
- Complete system-wide Dark palette audit -> Phase 07.
- Public-site-inspired premium EFX/motion -> Phase 08.

## Dark-theme rule for this phase

There are three layers of Dark work:

1. Phase 0 established semantic Dark tokens.
2. Phase 2 established shared primitive Dark behavior.
3. Phase 03 must make **Dashboard and Applications** correct now.

Phase 07 remains the exhaustive audit across every route and surface. A visible contrast defect on a Phase 03-owned page is not allowed to wait until Phase 07.

## Public-site reference notes

The supplied public-site video is a brand/EFX reference, not a CRM layout reference. Reusable character:

- warm ivory + deep navy/graphite + restrained wine/burgundy;
- thin rules and calm editorial grouping;
- typography-led hierarchy;
- controlled alternation of light and dark sections;
- restrained word/section transitions and scroll-driven reveal;
- no gaming glow, floating decoration or motion overload.

Phase 03 uses the brand palette/hierarchy only. Motion implementation remains Phase 08 except for existing shared interaction feedback.

## Acceptance criteria

1. Dashboard remains data-real and visually close to `MASTER_FRONTEND_REFERENCE.jpeg` without inventing values.
2. Dashboard secondary actions in Dark use semantic dark surfaces, not white buttons.
3. Dashboard compact tables and supporting copy remain readable in Dark.
4. Applications KPIs/search/filters/table/selected preview form one compact grid without dead desktop space.
5. Selected preview tabs are keyboard-focusable buttons and switch real panels.
6. Files panel uses the existing `/api/admin/applications/{id}` detail data and existing download endpoint.
7. Application preview text uses semantic text roles in Light and Dark.
8. Login form controls and submit action have deliberate vertical spacing.
9. No new fake data, backend changes, migration changes or new `!important` declarations.
10. Foundation audit remains green.
11. 320 / 360 / 390 / 430 / 620 / 900 / 1180+ layouts must not gain new horizontal page overflow from Phase 03 changes.
12. Previously frozen shell/shared controls remain compatible.
