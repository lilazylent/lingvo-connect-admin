# Phase 07 — Dark Theme System Audit + Cross-Project Visual Consolidation

Status: implementation candidate, 2026-09-15.

Canonical owner execution prompt: `docs/phases/PHASE_07_MASTER_EXECUTION_PROMPT.txt`.

## Objective

Phase 07 turns Dark Theme into a first-class Lingvo Connect system while consolidating repeated visual semantics across the whole CRM. It is not a page repaint. A repeated pattern fixed in one route must be audited across all routes and moved to a shared token/component/pattern when semantics are the same.

## Binding constraints

- `crm-foundation.css` remains the only owner of semantic token values and the last visual import.
- `phase2-ui-kit.css` remains the shared control/data-surface geometry layer.
- `theme-system.css` remains the Dark-state behavior/coverage owner; Phase 07 consolidates there instead of creating another late override stylesheet.
- No new `!important`.
- No Phase 10 executor matching/calendar/routing.
- Phase 08 owns final motion; Phase 07 may only prepare motion-compatible structure.
- Preserve all real backend/API contracts unless a proven product defect requires an end-to-end change.

## Phase 07 priority regressions

1. **Order Finance** — compact geometry, no dead space, clear hierarchy and canonical Russian labels: `Итоговая стоимость заказа`, `Остаток к оплате`, `Выплаты исполнителям`, `Прибыль`, `Маржинальность`.
2. **Order pipeline 01–09** — smaller/lighter numerals, thin readable ring, semantic current/completed/future states, Dark contrast; markup prepared for the Phase 08 clockwise progress-ring animation.
3. **New Order / Works** — readable `РАБОТА 01`, service/meta/actions, semantic dividers and typography.
4. **New Order / Calculation** — one baseline for `Тариф / Единица тарифа / Ставка вручную / Ручной итог / Авторасчёт`; no broken standalone currency label.
5. **New Order / Review** — unambiguous financial labels, especially no standalone `Клиенту` or `Исполнителям`.
6. **Applications** — compact full-detail status/action composition, hidden scrollbar chrome without broken scrolling, shared clipped/faded burgundy accent line.
7. **Files / Users / Settings** — no white islands, no low-contrast blue metadata, viewport-safe menus and Dark-safe native controls.
8. **Auth / 2FA** — preserve vertical rhythm and Dark/autofill/focus behavior.

## Cross-project consistency algorithm

After every shared visual change:

1. classify the semantic pattern;
2. search all `src` files for equivalent usage;
3. inspect every usage;
4. consolidate token/component/style ownership where appropriate;
5. regression-check approved Phase 0–6 screens in Light and Dark;
6. check responsive/zoom impact;
7. update regression coverage.

A local screenshot fix is not completion if the same semantic pattern remains inconsistent elsewhere.

## Verification target

- foundation audit;
- lint / typecheck / production build where dependencies are available;
- Phase 1–6 Playwright suites plus `phase7-dark-audit.spec.ts`;
- Light/Dark visual QA;
- viewports 320–1920 and browser zoom 100–250%;
- repository scans for literal white/blue Dark-state colors, duplicated semantic token ownership and new `!important`.
