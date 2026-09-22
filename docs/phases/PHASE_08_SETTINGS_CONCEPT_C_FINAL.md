# Phase 08 Final Polish — Graphite Fade Hero + Settings Concept C

Date: 2026-09-16  
Baseline: `Lingvo_Connect_Admin_Phase_08_FINAL_Owner_Patch02_v2.zip`  
Build ID: `phase08-settings-concept-c-20260916-r1`

## Scope
This patch finalizes the remaining Phase 08 visual/UX work requested after owner review. Backend/API/database behavior is unchanged.

### Shared internal page hero
All compact internal page headers use one Graphite Fade Hero treatment instead of a flat lighter-gray rectangle. The fade blends raised graphite back into the page canvas on all four edges, keeps text contrast intact, and preserves the existing CTA grid. It applies to equivalent internal pages through the shared `.page-head.page-head--compact` pattern.

### Settings Concept C — Hybrid Module Dock + one active workspace
Settings keeps six top-level modules but no longer uses a left secondary rail. A compact module dock remains visible above the active workspace:

1. Справочники
2. Тарифы
3. Скидки и коэффициенты
4. Оформление
5. Услуги и единицы
6. Статусы заказов

Only one module workspace is rendered at a time. Each module has a custom inline SVG pictogram and a refined 01–06 numeral chip. The active module receives a restrained wine-tinted glass state.

### Compact internal settings UX
Long real-data catalogs stay compact and scannable:
- default page size: 8 rows;
- optional page sizes: 8 / 12 / 20 via a segmented control rather than a system-looking select popup;
- search/filtering remains next to the page-size control;
- table rows use a denser 40px-class operational rhythm;
- pagination remains visible directly below the active list;
- no fake data is introduced.

The page-size control deliberately avoids the previous generic dropdown checkmark. Shared Select selected indicators are also upgraded to a small SVG check inside a semantic circular badge so the visual system is consistent across the CRM.

## Responsive behavior
- Desktop: six-column module dock.
- Tablet: three-column module dock.
- Small tablet: two-column dock.
- Narrow mobile (≤520px): the dock collapses to one compact `Раздел настроек` selector so the navigation does not create a long vertical stack.
- Settings tables may scroll horizontally on narrow screens rather than forcing unreadable columns or very tall wrapped rows.

## Ownership
- page-hero visual treatment: `phase8-visual-motion.css`
- Settings structure/density: `phase6-admin.css`
- shared Select indicator: `phase2-ui-kit.css` + `components/select.tsx`
- semantic tokens: `crm-foundation.css`

No new override-only stylesheet was added.

## Acceptance
- internal page hero no longer reads as a hard gray rectangle;
- Settings module navigation is compact, visible, and understandable;
- 01–06 are designed UI elements rather than plain system numbering;
- only the active top-level module is shown;
- Languages/Services/Tariffs/Rules do not create an endless page;
- page-size control is compact and obvious;
- equivalent shared Select selected-state styling is updated globally;
- narrow mobile Settings navigation uses a compact selector instead of six vertically stacked module cards;
- Appearance behavior is preserved;
- no backend or migration change.
