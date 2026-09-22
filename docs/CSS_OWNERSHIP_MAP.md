# CSS ownership map

This document is the canonical answer to **where a visual change belongs** after the Phase 07 consolidation and the Phase 08 owner-review cleanup.

## Import order

1. `globals.css` — minimum global reset/base/auth/application-shell compatibility.
2. `legacy-visual-core.css` — **compatibility layer only**. It contains the surviving old declarations that have not yet been migrated. Do not add new feature styles here.
3. `phase1-shell.css` — shell / sidebar / topbar / branding / responsive shell.
4. `phase2-ui-kit.css` — shared controls and primitives: buttons, inputs, selects, tables, badges, pagination, states.
5. `phase4-directories.css` — Clients / Executors list-detail workspace composition.
6. `owner-readability.css` — owner-mandated global readability floor and cross-phase readability regressions.
7. `phase5-orders.css` — Orders list, order creation wizard, order card, **pipeline geometry**, finance/work/file order surfaces.
8. `phase6-admin.css` — Files / Users / Settings workspaces and admin controls.
9. `phase8-visual-motion.css` — premium summary-card treatment, pictogram presentation and Phase 08 motion/EFX only.
10. `crm-foundation.css` — canonical semantic tokens. Must remain last.

## Strict rules

- Do not add new feature CSS to `legacy-visual-core.css`.
- Before editing a repeated pattern, search all usages across `src`.
- Shared controls belong to `phase2-ui-kit.css` unless promoted to a more specific current owner.
- Shell geometry belongs to `phase1-shell.css`.
- Clients / Executors composition belongs to `phase4-directories.css`.
- Phase 10 executor availability UI remains part of the Executor detail workspace and therefore also belongs to `phase4-directories.css`; do not create a competing Phase 10 page-style owner for it.
- Orders / pipeline / finance belong to `phase5-orders.css`.
- Files / Users / Settings belong to `phase6-admin.css`.
- Phase 08 motion / premium glass / visual responses belong to `phase8-visual-motion.css`.
- Semantic token values belong only to `crm-foundation.css`.
- `crm-foundation.css` stays last.
- No new `!important` may be introduced to win the cascade.

## Phase 08 compatibility cleanup

The owner-review patch proved that several high-specificity Dark Theme rules inside the compatibility layer were still winning over the canonical owners. They were not retained merely because the file was called “frozen”. The following **obsolete blockers were removed from `legacy-visual-core.css`** after their current behavior was fully owned elsewhere:

- the old Dark `.order-stage` / current / completed surface overrides that prevented the Phase 05/08 thin pipeline dial from rendering as designed;
- the old Dark `.order-stage-flow` compatibility surface override;
- the old Dark `.lc-metric-card` surface entry that suppressed Dashboard smoked-glass treatment;
- the old Dark `.lc-module-metric` surface entry that suppressed the current shared summary-card owner.

This is not permission to edit compatibility CSS casually. A legacy declaration may be removed only when:

1. the semantic component has one verified current owner;
2. repository search confirms the legacy selector is competing with that owner;
3. the required declarations already exist in the current owner;
4. regression/static checks are updated accordingly.

## Deleted standalone compatibility files

The Phase 07 cleanup removed these independent cascade layers and merged their still-needed declarations into the compatibility layer:

- `workspace-polish.css`
- `workspace-rhythm.css`
- `theme-system.css`
- `order-deal-redesign.css`
- `files-workspace.css`
- `motion-system.css`
- `frontend-resilience.css`
- `master-reference.css`

Do not restore any of them.
## Phase 09 release-QA rule

Phase 09 does not introduce a new stylesheet owner. A release defect is fixed in the existing canonical owner listed above. In particular, Dashboard premium KPI-card geometry/navigation remains Phase 08-owned in `phase8-visual-motion.css`; release QA must not create `phase9.css` or add new feature declarations to `legacy-visual-core.css`.

