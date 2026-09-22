# Phase 08 — Visual Identity, Motion & Final Frontend Consolidation

## Mission
Phase 08 turns the consolidated Phase 07 baseline into a coherent Lingvo Connect frontend with controlled motion and premium visual identity. It does not add new business workflows. Owner-rendered review is authoritative: a source-code change is not considered complete if the owner-visible state remains broken.

Current final patch: `docs/phases/PHASE_08_OWNER_REVIEW_PATCH_02.md`  
Current build ID: `phase08-settings-concept-c-20260916-r1`

## Final Phase 08 scope
- Shared pictogram family across overview/module metrics.
- Optically redrawn Settings gear.
- Restrained wine/burgundy accent instead of bright pink.
- Geometry-safe gloss/sheened hover instead of layout lift for summary cards.
- Dashboard finance bars animate internally without moving geometry.
- Dashboard KPI cards use restrained smoked-glass treatment with semantic wine/slate/amber/red/teal/gold reflections.
- Dashboard metric cards contain only useful pictogram/value/title hierarchy; filler copy is removed.
- One shared PageHeader → KPI spacing contract across equivalent list pages.
- Owner-readable helper/form meta typography across CRM working forms.
- Client/Executor desktop detail preview uses natural document scrolling and no redundant internal vertical rail.
- Order pipeline 01–09 uses a thin custom SVG dial and clockwise 12-o'clock current-state animation.
- Order Finance uses a two-zone layout: economic metrics + compact `Предварительный расчёт` utility.
- Sidebar promo removes misleading fake action and uses translation artwork.
- Dashboard hero uses language/connection artwork.
- Global Search owns one radius-correct outer focus ring.
- Files `Заказ` / `Заявка` badges use one fixed geometry.
- Settings uses navigation-first modules and compact real-data catalogs with search/pagination; selected content cannot overlap navigation.

## Scope boundaries
- No executor matching, availability calendar, JP→RU→EN routing or candidate ranking. Those remain Phase 10 post-MVP.
- No backend/API/database changes are introduced by this Phase 08 final patch.
- Business calculations and CRUD behavior remain unchanged.

## Canonical ownership
- `phase8-visual-motion.css`: Phase 08 premium glass, pictogram presentation and motion.
- `phase5-orders.css`: Orders geometry, pipeline dial geometry, finance/work/file order surfaces.
- `phase6-admin.css`: Files/Users/Settings operational geometry.
- `phase4-directories.css`: Clients/Executors list-detail geometry.
- `owner-readability.css`: owner-mandated readability floor.
- `crm-foundation.css`: semantic token values, imported last.

`legacy-visual-core.css` remains compatibility-only. In the final Phase 08 owner patch, only proven high-specificity Dark blockers for the current metric/pipeline owners were removed; no new feature style was added there.

## Final acceptance
1. BUILD_ID is `phase08-settings-concept-c-20260916-r1`.
2. Foundation contrast audit has no ratios below 4.5 for the canonical tested text/accent roles.
3. Dashboard KPI cards show clean premium glass without filler-copy overlap.
4. Metric cards do not move vertically on hover/focus.
5. Shared page intro → summary spacing uses one token.
6. Application helper/instruction/save-state text is readable and uses shared semantic typography.
7. Client desktop detail has no nested vertical up/down rail; tabs remain the navigation.
8. Current order stage has no fat inner number bubble and uses a thin clockwise SVG ring from 12 o'clock.
9. 01–09 remain readable in Dark and status state does not cause layout shift.
10. Finance uses the economics + preliminary-client-calculation composition.
11. Settings navigation/content/action layers do not overlap and long real catalogs are paged compactly.
12. `Заказ` / `Заявка` source badges have identical geometry.
13. Search focus is radius-correct and uses no child-input ring.
14. Reduced-motion disables decorative animation without removing state clarity.
15. Cross-project equivalent usages were searched after each shared change.
