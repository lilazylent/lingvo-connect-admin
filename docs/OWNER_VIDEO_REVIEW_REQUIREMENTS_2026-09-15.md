# Owner video review — requirement map (2026-09-15)

Source transcript: `docs/references/OWNER_VIDEO_REVIEW_TRANSCRIPT_2026-09-15.pdf`  
Text extraction for repository search: `docs/references/OWNER_VIDEO_REVIEW_TRANSCRIPT_2026-09-15.txt`

This review is a binding supplement to `CRM_MVP_MASTER_SPEC.md`. It does not create a second design system; it assigns concrete owner feedback to the existing Phase 0–9 delivery plan.

## Shared regression contract — apply before / with Phase 05

1. **Global readability:** enlarge working UI text roughly 1.5× from the previous 9–13 px implementation while keeping large display/page titles approximately unchanged. The shared type scale must be owned by foundation/shared CSS, not page-by-page overrides.
2. **Sidebar brand:** replace `Бюро переводов` with `АДМИН-ПАНЕЛЬ`; align the second line to the right edge of the Lingvo Connect wordmark so the last letter visually terminates under the final `T` of `Connect`. Keep LC mark evolution restrained and compatible with the public-site identity.
3. **Scroll behavior:** remove scroll traps / redundant page-level scrollbars. Long entity details may have a local scroll container, but wheel/trackpad interaction must feel natural across the full working panel.
4. **Executor language entry bug:** editable direction rows must not remount after each character. Source/target language controls should autocomplete from the real `/api/admin/crm/languages` dictionary.
5. **Previously approved pages remain frozen in composition:** shared readability/interaction patches must regression-check Dashboard, Applications, Clients and Executors rather than redesigning them.

## Phase 05 — Orders + Order detail

Owner review ownership:

- Remove the dead gap between `Архив` and `Таблица / Kanban`; make the command surface a compact grid with view controls grouped intentionally.
- Keep search/status/language/executor/deadline/payment filters readable and dense.
- Make Kanban a genuine operational representation, not decorative cards; status changes remain backed by the existing status endpoint.
- The order card must stop reading as one giant vertical document.
- Preserve a compact header and pipeline, then use real `Основное / Работы / Финансы / Файлы / История` tabs.
- Work cards remain real production units: service, language pair, volume, urgency/native-speaker signals, executor(s), deadline, client price and executor cost.
- Preserve multi-executor editing and current pricing/discount/urgency logic.
- Preliminary client calculation is useful but must behave as a utility, not dominate the page. It must not expose internal executor/profit data.
- Fix light-only/white preliminary-calculation surfaces in Dark on this owned page.
- Financial hierarchy: total/revenue, paid/debt, executor cost, profit, margin, plus editable client payment.
- History remains one readable chronological timeline.
- Compactness, intuitive navigation and readability are equally mandatory.

## Phase 06 — Files + Users + Settings

- Files becomes an operational workspace rather than just a table: upload, summary, search/filtering, export, selected-file details/preview/download/source navigation using existing backend data.
- Fix ugly white download buttons / white separators / low-contrast blue copy on Files.
- Users and Settings use the same shared toolbar/table/detail/editor patterns rather than independent mini-apps.
- Settings controls that are intended to be interactive must actually work.
- Reuse the language dictionary/autocomplete pattern wherever language entry appears.
- Continue eliminating protruding/decorative divider strips that break card boundaries; use semantic border/gradient treatment only where it supports hierarchy.

## Phase 07 — Complete Dark-theme audit

- Graphite/navy direction is retained.
- Audit every route and surface for white islands, white buttons, low-contrast dark-blue text, native controls, tables, pagination, forms, drawers/modals, file UI, auth and settings.
- Use semantic primary/secondary/muted hierarchy and restrained burgundy accent.
- Touched page phases must already be acceptable in Dark; Phase 07 is the exhaustive product pass, not a reason to defer obvious page-owned defects.

## Phase 08 — Motion / EFX

- Public Lingvo Connect site defines motion character, not CRM geometry.
- Add restrained hover/press/dropdown/panel/toast/pipeline feedback only where it communicates state or relationship.
- Loading states must not leave giant empty canvases; use compact skeleton/progress patterns.
- Remove/soften harsh decorative lines that visually protrude outside cards; where retained, integrate them as controlled border/gradient accents.
- Respect `prefers-reduced-motion`.

## Phase 09 — Final MVP QA

- Re-run the whole transcript as an acceptance checklist.
- Verify global readability on every route without inflating large titles.
- Verify clickability of three-dot/actions, tabs, cards and intended controls.
- Verify scroll propagation and absence of redundant scrollbars.
- Verify executor language autocomplete / typing stability.
- Verify orders navigation, Kanban, work cards, payments/files/history.
- Verify Light/Dark, 100–250% zoom, 320–1920 px, long text, empty/error/loading states and all CRUD workflows.
- Regression-check approved Dashboard, Applications, Clients and Executors after every shared change.

## Product-level owner criterion

The CRM must feel **compact, intuitive, minimal, informative and pleasant**, but must never achieve compactness by shrinking text below comfortable reading size.
