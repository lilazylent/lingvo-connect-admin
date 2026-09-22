# Frontend Foundation Audit — 2026-09-15

## Executive finding

The largest frontend risk in v3 is the cascade, not missing visual ideas. The React/API layer already supports the existing MVP workflows, while nine global stylesheets contain several generations of design rules that compete for the same selectors.

## Baseline debt snapshot

Measured before introducing the canonical foundation token file:

| Metric | Baseline |
| --- | ---: |
| Global CSS files | 9 |
| CSS lines | ~6,595 |
| `!important` declarations | 35 |
| Literal hex occurrences | 1,023 |
| Unique literal hex values | 620 |
| Cross-file duplicate selectors (conservative scan) | 547 |
| Distinct media-query spellings/variants | 37 |

These figures are migration metrics, not quality scores. Some repeated selectors are legitimate dark/responsive states, but the total confirms that later work must consolidate rather than add another page-wide override layer.

## Current visual layers

Import order before the Phase 0 canonical token owner:

1. `globals.css`
2. `workspace-polish.css`
3. `workspace-rhythm.css`
4. `theme-system.css`
5. `order-deal-redesign.css`
6. `files-workspace.css`
7. `motion-system.css`
8. `frontend-resilience.css`
9. `master-reference.css`
10. `crm-foundation.css` — canonical tokens only, added in Phase 0

## Migration rule

Do **not** delete legacy styles wholesale. Each feature phase owns consolidation of the selectors it replaces. Once a shared primitive or page has been migrated and visually verified, its superseded legacy selectors can be removed in the same phase.

The debt counters should trend downward after Phase 1. New work must not increase `!important` usage or introduce a new global token namespace.

## Known architectural priorities

1. Shell selectors exist in several generations and should be consolidated in Phase 1.
2. Shared controls/tables/cards repeat across many files and belong to Phase 2.
3. Order-specific rules span generic, rhythm, theme and order redesign layers; consolidate in Phase 5 only after shared primitives are stable.
4. Dark-mode coverage is distributed across theme and reference layers; Phase 7 will remove remaining literal-light leaks after all main pages are migrated.
5. Breakpoints currently include many near-duplicates (`800/820`, `900/920`, `980/999/1024`, etc.). New work follows the canonical 1180/900/620/430 contract.
