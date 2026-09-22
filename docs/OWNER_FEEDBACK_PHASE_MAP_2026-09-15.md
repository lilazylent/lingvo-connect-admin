# Owner feedback phase map — 2026-09-15

This file records visual feedback from the owner's local Dark-theme review so it is not lost between ZIP baselines.

| Feedback | Ownership | Decision |
| --- | --- | --- |
| Login `Продолжить` button visually touches the password field | regression / shared geometry | Fix immediately during Phase 03 pre-flight |
| Dark Dashboard has white quick-action islands | Phase 03 + semantic shared palette | Fix in Phase 03 |
| Dark Dashboard recent records use unreadable dark-blue copy | Phase 03 | Fix in Phase 03 |
| Applications preview metadata/message uses unreadable dark-blue copy | Phase 03 | Fix in Phase 03 |
| Applications `Информация / Контакты / Файлы` are not interactive | Phase 03 | Implement real tabs backed by existing detail API |
| Client preview has the same low-contrast text problem | Phase 04 composition | Resolved in Phase 04 through the new semantic split workspace and interactive detail tabs |
| Orders toolbar has `Архив`, large dead gap, `Таблица / Kanban`, then another dead gap | Phase 05 | Recompose as one compact edge-aligned command group in Phase 05 |
| Overall Dark palette needs a complete product-wide pass | Phase 07 | Full route/surface audit in Phase 07; touched pages must already be correct in their own phase |
| Main Lingvo Connect website video should guide EFX and brand character | Phase 08 for motion; all phases for restrained brand character | Video preserved under `docs/references/` |
| CRM should minimize dead space while remaining clean and grid-aligned | global master rule | Apply in every page phase |
| Clients/Executors need real workload/order context rather than decorative preview data | Phase 04 | Implemented from existing CRM summary/direction/assignment APIs; no fake tags/ratings/default rates |

## Transcript supplement — owner review 2026-09-15 14:03

Full mapping: `docs/OWNER_VIDEO_REVIEW_REQUIREMENTS_2026-09-15.md`.

| Feedback | Ownership | Decision |
| --- | --- | --- |
| All working/micro text is too small; enlarge ~1.5×, large page titles may stay | shared regression before/with Phase 05 + Phase 09 QA | Foundation/shared type scale updated; prior pages require regression |
| Sidebar subtitle must read `АДМИН-ПАНЕЛЬ` and right-align under wordmark | shared shell regression before/with Phase 05 | Apply without redesigning shell geometry |
| Executor direction input remounts after each character | shared regression before/with Phase 05 | Stabilize row key and use real language autocomplete |
| Scroll only works in narrow parts of client/detail cards | shared regression + Phase 09 | Remove scroll trap/containment behavior and verify natural wheel propagation |
| Orders card is too large / hard to navigate | Phase 05 | Convert to compact tabbed order workspace |
| Preliminary calculation is useful but visually dominant / white in Dark | Phase 05 | Make collapsible utility inside Finances, semantic Light/Dark surface |
| Work cards are conceptually good but need easier technical navigation | Phase 05 | Keep concept, expose through dedicated Works tab and compact production rows |
| Files has white buttons/separators and low-contrast blue copy | Phase 06 + exhaustive Phase 07 | Fix composition in 06, cross-route Dark sweep in 07 |
| Hover animation and harsh protruding divider strips | Phase 08 | Premium restrained motion + border/gradient cleanup |
| Settings interaction/polish | Phase 06 | Consolidate and make intended controls functional |


## Phase 05 post-review (15:08)

Fix before Phase 06: public-site-like LC mark + strict `АДМИН-ПАНЕЛЬ` right edge, Applications three-dot outside-click/Escape, semantic application-detail colors, aligned status/relation actions, soft/clipped burgundy page accents, cleaned comment dividers, aligned work index/title and denser Finance tiles.

Defer to Phase 06: Files white download controls/separators/blue text, arrow overflow, Users row-menu viewport overflow, remaining outside-click row menus and Settings consolidation.
