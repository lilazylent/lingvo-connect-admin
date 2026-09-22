<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lingvo Connect CRM — mandatory implementation protocol

## Source of truth
- Read the current files before editing. Do not infer components, APIs, tokens, models, or styles from memory.
- For every task use: PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> VERIFY -> REPORT.
- Reuse existing shared components and helpers. Do not create duplicates or stack CSS overrides without checking the original selector.
- Preserve business logic and API contracts during visual work unless a contract change is explicitly required and verified end-to-end.

## UI and responsive quality
- The same semantic control must use the same component/pattern across modules.
- Design for real content, long Russian labels, empty/error/loading/disabled/focus/hover/selected states and keyboard use.
- Check 320, 360, 375, 390, 430, 768, 1024, 1280 and 1440+ widths when the touched UI can respond.
- Guard grid/flex children with min-width:0 and appropriate wrapping/ellipsis only where the information hierarchy permits it.
- Mobile is a separate interaction context: virtual keyboard, focus, scroll, touch targets, fixed/sticky UI and popup bounds must be checked explicitly.

## Theme system
- Theme by semantic roles, not literal component colors: canvas, shell, surface, raised surface, hover surface, borders, primary/secondary/muted text, accent, success, warning, danger and info.
- Dark mode is not an inversion. Use neutral graphite surfaces with restrained Lingvo burgundy/pink accent.
- Do not leave white/light islands in dark mode unless they are intentional content objects with independently valid contrast.
- Normal text must meet WCAG AA contrast (>=4.5:1); large text/non-text UI should meet applicable >=3:1 guidance.
- Color cannot be the only state cue. Focus must remain visible.
- Any new surface/control must be implemented and checked in System, Light and Dark modes.

## Verification
- Never claim a check passed unless it actually ran.
- Prefer: syntax -> typecheck -> targeted tests -> lint -> production build -> visual/regression QA.
- Screenshots and videos are acceptance evidence: map the visible failure to event/state/layout cause before patching.

## Motion and FX
- Motion must explain state, hierarchy, feedback, or navigation. Do not animate merely because an element can move.
- High-frequency interactions should normally complete in roughly 50-150ms. Popovers and local state transitions may use ~150-220ms; larger panels/context transitions should usually stay within ~180-400ms.
- Prefer transform and opacity for motion. Avoid layout-thrashing animation of width/height/top/left when a transform can express the same change.
- Keep one focal motion at a time. Do not stack competing entrance effects, parallax, shimmer, floating or looping decoration across a working CRM surface.
- Persistent decorative animation is off by default. Progress indicators are allowed to loop because they communicate active system work.
- Never make a user wait for animation before they can continue their task. Repeated actions must remain responsive.
- Respect prefers-reduced-motion: non-essential movement and transition effects must collapse to effectively instant feedback without losing information or state cues.
- Hover motion is supplementary only; touch, keyboard, focus-visible and reduced-motion users must receive equivalent state feedback without relying on movement.


## Approved frontend master reference (2026-09-15)
- `../../docs/MASTER_FRONTEND_REFERENCE.jpeg` is the visual source of truth for the CRM shell and the Light theme. Do not improvise a different visual language unless the user explicitly approves a new reference.
- Preserve the reference hierarchy: white 236px desktop sidebar, 72px topbar, pale neutral canvas, fine #e5e8ee borders, 10-12px radii, restrained shadows, dense professional tables, large Onest headings, soft pastel status fills and Lingvo pink (#e41f5b family) used as an accent rather than a background theme.
- The shell, page hero, metric card, command bar, table, side detail panel, form control, button, badge, pagination and modal must come from the current canonical owners recorded in `../../docs/CSS_OWNERSHIP_MAP.md` plus shared components. `master-reference.css` was removed during Phase 07 consolidation and must not be restored. Same meaning = same presentation.
- Screenshots are visual references, not a licence to invent business data. A value/action may be rendered only when it is backed by the existing API/model or is clearly static copy/decoration. Do not add fake notifications, counters, percentages, ratings, balances or actions just to imitate a screenshot.
- At desktop zoom 175-250%, treat the reduced CSS viewport as tablet/mobile: move the sidebar off-canvas and reflow grids/tables/panels instead of compressing the desktop composition past readability.
- Light is the primary approved reference. Dark must be derived from the same semantic hierarchy and component geometry, not designed as a separate product.

## MVP phase gate (2026-09-15)
- `../../docs/CRM_MVP_MASTER_SPEC.md` is the canonical product/frontend acceptance contract for the current MVP program.
- `src/app/crm-foundation.css` is the only canonical owner of semantic design-token values for new work. Existing `--ref-*`, `--lc-*`, `--crm-*` and oldest aliases are compatibility surfaces during migration; do not create another token namespace.
- New responsive work uses the 1180 / 900 / 620 / 430 breakpoint contract unless a component-specific exception is demonstrated and documented.
- Do not add new `!important` declarations. If specificity blocks a change, fix selector ownership/cascade in the phase that owns that component.
- A completed phase is regression-frozen. Shared changes in later phases must verify already approved pages before delivery.
- Run `npm run audit:foundation` as part of frontend verification; it must not report a missing foundation token or incorrect import order.

## Phase 02 shared UI kit (2026-09-15)
- `src/app/phase2-ui-kit.css` is the canonical owner of shared control/data-surface geometry after the shell freeze. Use it for buttons, fields, selects, badges, cards, command bars, tables, pagination, shared feedback states, file picker, row menus and the existing generic dialog shell.
- Do not re-style those semantics page-by-page in later phases. Extend the shared component/pattern only when the semantic behavior is truly shared.
- `crm-foundation.css` remains the only token-value owner and must remain the last CSS import. Phase 02 may consume tokens but must not create a new token namespace.
- Phase 01 shell and Phase 02 shared primitives are regression-frozen after local acceptance. Later page phases must verify them when shared selectors/components change.

## Phase 03 Dashboard + Applications (2026-09-15)
- `../../docs/phases/PHASE_03_DASHBOARD_APPLICATIONS.md` is the current page-phase contract.
- Dashboard and Applications must use the Phase 0 semantic palette and Phase 02 shared primitives. Do not reintroduce hard-coded Light-only text/surface colours on these pages.
- Visible Dark contrast defects on Dashboard/Applications are Phase 03 defects; do not defer them to the global Phase 07 audit.
- The Applications selected preview uses real interactive tabs and may fetch only existing application-detail data. Do not add fake contact/file values or visual-only actions.
- `../../docs/OWNER_FEEDBACK_PHASE_MAP_2026-09-15.md` records deferred owner feedback. In particular: Clients/Executors -> Phase 04, Orders command layout -> Phase 05, full Dark audit -> Phase 07, public-site motion/EFX -> Phase 08.
- `../../docs/references/LINGVO_PUBLIC_SITE_MOTION_REFERENCE_2026-09-15.mp4` is a brand/motion-character reference only. CRM density and geometry continue to follow `MASTER_FRONTEND_REFERENCE.jpeg` and the MVP master specification.

## Phase 04 Clients + Executors (2026-09-15)
- `../../docs/phases/PHASE_04_CLIENTS_EXECUTORS.md` is the current directory-workspace contract.
- Clients and Executors are owned by `src/components/crm-directory.tsx` plus `src/app/phase4-directories.css`; keep Phase 02 controls/buttons/fields shared rather than re-implementing them locally.
- Client list/detail values for orders, revenue and debt must come from the existing CRM summary API. Client language pairs may be derived only from real order works. Do not invent tags.
- Executor workload, accrued/paid/owed values and per-assignment rates/costs must come from existing executor summary/assignment data. Do not invent ratings, experience, capacity percentages or default rates.
- Selected detail tabs are real accessible tab buttons. Client representative CRUD must remain reachable in the selected workspace.
- Visible Dark contrast defects on Clients/Executors are Phase 04 defects. Phase 07 remains the exhaustive cross-route Dark audit, not a reason to defer page-owned defects.
- Phase 01 shell, Phase 02 shared primitives and Phase 03 Dashboard/Applications are regression-frozen.

## Owner video-review supplement + Phase 05 Orders (2026-09-15)
- `../../docs/OWNER_VIDEO_REVIEW_REQUIREMENTS_2026-09-15.md` is binding owner feedback derived from the uploaded 10:21 transcript. It supplements, but does not replace, the canonical master specification.
- Working/micro UI text is now intentionally enlarged by roughly 1.5x versus the former 9-13px implementation. Large bold page/display headings remain approximately on the existing title scale. Do not reintroduce tiny local text to recover density; fix spacing/grid instead.
- Sidebar subtitle is `АДМИН-ПАНЕЛЬ` and must right-align under the Lingvo Connect wordmark. Executor language direction editing must keep stable input identity and use the real language dictionary autocomplete.
- `../../docs/phases/PHASE_05_ORDERS_ORDER_DETAIL.md` is the Phase 05 contract.
- Orders list filters, Archive and Table/Kanban controls must form one compact, intentionally aligned command surface with no dead middle gaps.
- Order detail is a compact tabbed workspace (`Основное / Работы / Финансы / Файлы / История`), not a long all-sections-at-once document.
- Preliminary client estimate is a collapsible utility inside Finances and must not expose internal executor/profit data.
- Existing backend contracts, pricing/tariff logic, urgency, discounts, multi-executor assignments, payment, file and history endpoints are preserved.
- Phase 01 shell, Phase 02 primitives, Phase 03 Dashboard/Applications and Phase 04 Clients/Executors remain regression-frozen except for explicitly approved shared readability/scroll/interaction fixes from the owner transcript.


## Phase 05 owner review fix (2026-09-15 15:08)
- `../../docs/OWNER_PHASE05_REVIEW_FIX_2026-09-15.md` is binding before Phase 06.
- `LC/` branding and `АДМИН-ПАНЕЛЬ` alignment are owner-approved shared regressions; the subtitle must not extend wider than the wordmark and its right edge is the alignment anchor.
- Applications three-dot menus must close on outside click/Escape and after action selection.
- Application-detail copy/surfaces use semantic theme tokens; do not reintroduce dark-blue literal copy on graphite surfaces.
- The global decorative burgundy accent line is restrained and gradient-clipped; later pages must not bring back hard protruding line fragments.
- Order work identity rows and finance tiles are Phase 05 baseline after this review fix.
- Phase 06 owns Files/Users/Settings menu/download/overflow defects called out in the same review; Phase 07 still owns the exhaustive product-wide Dark pass.

## E2E regression contract after Phase 05 (2026-09-15)
- Playwright checks must synchronize with the real state boundary they assert. If a panel/summary/file count is populated by a second API request, wait for that resolved state rather than asserting against the initial loading placeholder.
- Dark-theme tests must wait for the persisted `/api/admin/users/me/preferences` bootstrap before forcing a test theme; otherwise the asynchronous preference loader can overwrite the test attribute and create a false regression.
- Scope detail/tab assertions to the owning workspace (`.lc-application-preview`, `.directory-detail-panel`, `.phase5-order-card`) so later shared tabs elsewhere on the page cannot make locators ambiguous.
- Accessibility selectors must follow the current backend/form contract. Do not add `*` to optional field labels merely to satisfy an old test.
- Responsive acceptance is document-bounded, not "all dense tables fit without internal scrolling". A table may scroll inside its owned wrapper; the page itself must stay bounded. Allow at most 1 CSS pixel for browser fractional-layout rounding.
- Geometry regression tests compare stable size/position within normal sub-pixel tolerance; do not require exact serialized `boundingBox()` object equality across hover/compositor frames.

## Phase 06 preparation + post-MVP Phase 10 (2026-09-15)
- `../../docs/phases/PHASE_06_FILES_USERS_SETTINGS.md` is the prepared Phase 06 contract. It owns Files, Users and Settings consolidation plus canonical service/language/rate foundations required by later executor matching.
- Phase 06 must not implement automatic executor matching or translation routing. Those remain post-MVP after Phase 09.
- `../../docs/post-mvp/PHASE_10_EXECUTOR_MATCHING_ROUTING.md` is the deferred owner-approved workflow contract: direct candidates first, candidate list when several fit, bidirectional language-pair matching, fallback routing through Russian when needed, one executor per production stage, persisted availability/calendar, default executor rate with per-assignment override, explicit no-candidate state and integration of assignment costs into Order economics.


## Phase 06 Files + Users + Settings implementation (2026-09-15)
- `src/app/phase6-admin.css` owns Phase 06 page-level composition and must stay before `crm-foundation.css`. Do not put semantic token values in it.
- Files uses the real unified registry plus source-specific upload/download/preview endpoints. Preview exists only for safe browser formats (PDF/image/text); unsupported formats must not show a fake preview action.
- `ActionMenu` in `src/components/ui.tsx` is the shared viewport-aware menu for table/admin actions. Do not restore `<details>` menus inside clipped tables.
- Settings modules are fixed to the MVP contract: Справочники, Тарифы, Скидки и коэффициенты, Оформление, Услуги и единицы, Статусы заказов. Users remains its own protected route.
- `/api/admin/crm/languages` is the canonical language source after migration `0017_phase6_catalogs`. New language selectors should reuse `LanguageCombobox` rather than separate free-text lists.
- Executor capabilities use canonical `ServiceType.code` for new rows and persist `default_rate` + `rate_unit`. Historical legacy work-type codes may be preserved until explicitly remapped; never silently guess a service mapping.
- Phase 10 matching/routing/calendar is still deferred until after Phase 09. Phase 06 may prepare persisted inputs only; it must not auto-select executors.

## Owner review 17:37 + Phase 10 boundary (2026-09-15)
- `../../docs/OWNER_REVIEW_2026-09-15_17-37_REQUIREMENTS.md` is binding and is backed by the stored transcript/contact sheets in `../../docs/references/`.
- Remaining Application/Order frontend debt listed there must be closed before Phase 09 acceptance; do not misclassify it as post-MVP work.
- Phase 06 prepares stable service/language/rate inputs only. Executor candidate matching, direct-vs-routed translation, no-candidate handling and availability calendar remain post-MVP Phase 10.
- Existing `ServiceType.code` and language names act as persisted business keys in current tables. Do not silently rename them until references are migrated to stable IDs end-to-end.

## Phase 07 Dark Theme + cross-project consolidation (2026-09-15)
- `../../docs/phases/PHASE_07_DARK_THEME_AUDIT.md` and `../../docs/phases/PHASE_07_MASTER_EXECUTION_PROMPT.txt` are binding for the Phase 07 baseline.
- Every repeated visual fix triggers a repository-wide semantic audit. Same meaning must converge on the same token/component/pattern; a local page-only correction is not considered complete when equivalent usage exists elsewhere.
- Phase 07 Dark-state coverage was consolidated back into the canonical semantic owners recorded in `../../docs/CSS_OWNERSHIP_MAP.md`; the old standalone `theme-system.css` was removed and must not be restored. Semantic token VALUES remain exclusively in `crm-foundation.css`, which stays last. Shared control geometry remains Phase 02-owned.
- Order Finance terminology is canonical: `Итоговая стоимость заказа`, `Остаток к оплате`, `Выплаты исполнителям`, `Прибыль`, `Маржинальность`. Do not restore ambiguous standalone `Клиенту`, `Исполнителям`, `Итого заказа` or `Маржа` labels in these summaries.
- Order pipeline static geometry is Phase 07-owned; Phase 08 may animate the prepared `.order-stage__ring` clockwise but must not redesign the Phase 07 state hierarchy.
- Dark white-island, legacy-blue, border/divider, scrollbar and interaction-state audits are cross-project requirements, including Auth, Dashboard, Applications, Clients, Orders, Executors, Files, Users and Settings.
- Phase 10 executor matching/calendar/routing remains post-MVP. Phase 07 must not implement it.

## Phase 08 final visual baseline (2026-09-16)
- `../../docs/phases/PHASE_08_OWNER_REVIEW_PATCH_02.md` and `../../docs/phases/PHASE_08_SETTINGS_CONCEPT_C_FINAL.md` define the accepted visual baseline entering release QA.
- Dashboard KPI cards keep only pictogram, value, canonical title and a navigation affordance when the whole card genuinely links somewhere; helper/filler copy removed in Phase 08 must not return.
- Settings uses Concept C compact module navigation and real catalog pagination/search only; no fake rows.
- Order pipeline uses the thin SVG 01-09 dial with semantic current/completed/future states and reduced-motion support.
- `phase8-visual-motion.css` owns premium metric treatment and motion only; it is not a general late override layer.

## Phase 09 final MVP QA + release candidate (2026-09-16)
- `../../docs/phases/PHASE_09_MASTER_EXECUTION_PROMPT.md` and `../../docs/phases/PHASE_09_FINAL_MVP_QA_RELEASE_CANDIDATE.md` are binding for the current release-candidate pass.
- Phase 09 is stabilization, not redesign: every code change must map to a reproduced release defect, regression, verification hardening, or stale documentation that could direct future implementation incorrectly.
- Owner-added Dashboard defect: KPI navigation arrows under `Новые заявки`, `Активные заказы`, `Сдать сегодня`, `Просрочено`, `Без исполнителя`, `Ждут оплаты` must occupy a deliberate lower card zone (preferred lower-right) with reserved layout space and no collision with value/label content.
- For Phase 09 fixes, patch the current canonical owner. Do not create a new `phase9.css` specificity layer.
- Re-run the owner transcript requirements across Auth, Dashboard, Applications, Clients, Executors, Orders, Files, Users, Settings and Imports; regression-check Light/Dark, responsive/zoom, long content and empty/loading/error/disabled/focus/hover/selected states.
- A check is PASS only if it actually ran. If dependencies/runtime are unavailable, report NOT RUN.
- Executor candidate matching, availability/calendar and translation routing remain Phase 10 and must not enter the Phase 09 MVP source.
- Owner Patch 03 fixes the reproduced Orders archive gap: status options now belong to MAIN or ARCHIVE, `CANCELLED / Отменён` is the default archive stage, the existing `Архив` view must expose archived orders, and custom archive reasons belong only to the archive board.
- Owner Patch 03 also corrects Finance alignment and the order-file row grid in their existing owners. General named multi-pipeline management remains post-MVP and must not be improvised inside this patch.


## Phase 10 executor matching foundation (2026-09-16)
- `../../docs/phases/PHASE_10_0_10_1_ARCHITECTURE_AVAILABILITY.md` is binding for Phase 10.0/10.1.
- Preserve `Order -> OrderWork -> ExecutorAssignment`; do not create a parallel assignment subsystem.
- Executor language capability pairs are bidirectional unless a future explicit directionality field is approved.
- `default_rate`/`rate_unit` on `ExecutorDirection` are defaults only; assignment-specific values remain independent.
- Availability is persisted as explicit date intervals with `FREE | BUSY | UNAVAILABLE | VACATION`. No saved interval means `Доступность не указана`, never implicit `FREE`.
- Phase 10.1 owner correction: availability is operated primarily from the Executors `Календарь` team matrix (executor rows × date columns). Executor detail keeps only a compact availability summary and shortcut; do not restore the cramped inline editor.
- Do not implement candidate ranking, direct matching, routing through Russian, route-stage UI, automatic busy generation or Finance changes during Phase 10.0/10.1.
- The Phase 04 directory workspace remains the canonical owner for Executor detail UI/geometry; extend it coherently instead of introducing a competing page/CSS owner.

## Phase 10.2 direct matching + Phase 10.3 manager selection (2026-09-18)
- `../../PHASE_10_2_DIRECT_MATCHING_TZ.md` and `../../PHASE_10_3_MATCHING_UI_TZ.md` are binding for direct matching and manager-selection UI.
- Candidate truth comes only from `GET /api/admin/orders/{order_id}/works/{work_id}/executor-candidates`; frontend must not synthesize score, rating, recommendation percentage or hidden ranking.
- Preserve backend ordering and the factual states `AVAILABLE | UNKNOWN | UNAVAILABLE`. `UNKNOWN` is rendered as `Доступность не указана`, never as free.
- Candidate selection only adds a normal draft `ExecutorAssignment`; persistence remains behind the existing `Сохранить работу` action.
- Candidate `default_rate` / `rate_unit` are assignment defaults and remain editable after selection.
- Blocking candidates may remain visible for explanation but cannot be selected for the matched required date in the Phase 10.3 direct-matching UI.
- Manual assignment and legacy multi-executor workflows remain available. Do not replace `ExecutorAssignmentsEditor` with a parallel subsystem.
- If service/language/deadline fields have unsaved changes, direct matching must be treated as stale and require saving the work before refreshing candidates.
- Phase 10.4 routing through Russian, route stages, automatic assignment, automatic BUSY generation and Finance changes remain out of scope until their own phase.

## Phase 10.4 routed matching through Russian (2026-09-18)
- `../../PHASE_10_4_ROUTING_THROUGH_RUSSIAN_TZ.md` is binding for routed fallback matching.
- Direct foreign-to-foreign candidates remain first-class and must never be hidden or replaced by a Russian route.
- Routing is only `source -> Русский -> target` for foreign-to-foreign works, using active canonical `Русский` from the language catalog and the same factual capability/availability contract as Phase 10.2.
- Phase 10.4 route selection is local UI state only. Do not persist routed choices as ordinary flat assignments because route-stage persistence, stage volume and cost belong to Phase 10.5.
- `UNKNOWN` availability stays selectable but must remain labelled `Доступность не указана`; blocked candidates remain visible and disabled.
- No scoring, automatic selection, automatic BUSY generation, Finance mutation or alternative intermediary languages are allowed in Phase 10.4.

## Phase 10.5 persisted route stages + assignment rate override (2026-09-18)
- `../../PHASE_10_5_ROUTE_STAGES_RATE_OVERRIDE_TZ.md` is binding for persisted production-stage semantics.
- Phase 10.5 supersedes the Phase 10.4 temporary non-persistence boundary: routed selections now persist through the existing `ExecutorAssignment` fields `route_stage_index`, `route_source_language`, and `route_target_language`; do not create a parallel RouteStage subsystem while these fields remain sufficient.
- Each routed assignment owns its own actual executor volume, billing unit, assignment rate, calculated cost, deadline and status. Stage 01 values must not mutate Stage 02 values.
- `ExecutorDirection.default_rate` and `rate_unit` remain defaults only. Step 05 may override the rate for a specific direct or routed assignment; that override must never write back to the executor directory default.
- Manual total-cost override remains independent from manual rate. Backend `assignment_auto_amount` remains the cost source of truth when total cost is not manually overridden.
- Phase 10.6 Finance redesign, automatic calendar workload updates, arbitrary multi-hop routing and hidden ranking remain out of scope.

## Phase 10.6 finance integration (2026-09-18)
- `../../PHASE_10_6_FINANCE_INTEGRATION_TZ.md` is binding for executor-cost integration into order economics.
- Existing backend `finance()` remains the single source of truth for order economics. React may render the returned breakdown but must not recalculate canonical profit/margin independently.
- Client revenue remains independent from executor rates/costs. `OrderWork.price` is client-side revenue; active persisted `ExecutorAssignment.cost` rows are executor-side cost.
- Routed stages contribute their persisted cost exactly once. Stage-specific volume/rate/cost must remain visible and attributable in Finance.
- Manual assignment rate changes `auto_cost`; a manual total-cost override remains authoritative for that assignment and must be visible as such.
- Legacy works without active assignment rows retain the existing `OrderWork.executor_cost` compatibility fallback.
- Phase 10.6 adds no migration and must not alter tariffs, client pricing, availability, matching/routing priority or automatic calendar state.

## Phase 13.5 tariff automation + CRM lookup contract (2026-09-20)
- The authoritative 2026 written-translation tariff grid lives in the backend tariff system/DB. The wizard must never hard-code tariff amounts in React.
- `0023_sync_tariffs_2026` is the deployed-database synchronization migration. It may update/replace known seeded rows but must preserve unrelated user/manual tariffs.
- Written-translation direction is asymmetric: `TO_RUSSIAN`, `FROM_RUSSIAN`, and `NATIVE_SPEAKER` are distinct tariff directions. Foreign-to-foreign pricing may use `A -> RU + RU -> B` and must explain both components in the UI.
- A requested native-speaker tariff with no confirmed native row must resolve explicitly as unavailable; never silently substitute the normal tariff.
- Volume discounts (5/10/15%) and urgency are backend pricing rules. React renders the returned rate/quantity/multiplier/discount; it does not reproduce canonical pricing math.
- The latest client clarification for conditional pages remains: 1800 characters with spaces = 1 conditional page; calculate physical pages by rounding upward to one decimal place, while the tariff enforces a minimum billable quantity of 1 page.
- Client/contact/executor search uses the shared debounced `CrmLookup` against backend search endpoints. Typing must never mutate the selected record until a result is explicitly chosen.
- Language selection uses the shared `LanguageCombobox` backed by the canonical language catalog.
- Changing tariff-forming work inputs must invalidate old tariff IDs/quote state before recalculation. Persisted `OrderWork.tariff_ids` must always match the current work parameters.
