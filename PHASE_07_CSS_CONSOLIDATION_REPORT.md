# Phase 07 CSS consolidation report

## Why this cleanup was necessary

The active Phase 07 frontend still loaded multiple generations of CSS that define the same semantic selectors. Audit examples before cleanup:

- `.detail-panel` appeared in 8 standalone stylesheets.
- `.application-toolbar` appeared in 7.
- `.order-stage` was controlled by multiple order/theme/reference/motion generations.
- `.finance-strip` was defined across several historical workspace/order/reference layers plus the current Phase 5 owner.

This made source ownership difficult to reason about and increased the risk of a change being technically present but visually overridden elsewhere.

## What changed

Eight historical visual files were consolidated byte-for-byte, in the exact previous import order, into a single frozen `legacy-visual-core.css` compatibility layer. The original standalone files and their imports were removed.

No declaration from those files was intentionally discarded in this pass, so the consolidation itself is designed to preserve the previous cascade result while making file ownership deterministic.

A canonical ownership map was added at `docs/CSS_OWNERSHIP_MAP.md`.

A machine-checkable guard was added:

```text
npm run audit:css-ownership
```

A build provenance marker was also added:

```html
<html data-build-id="phase07-cleanup-20260915-r1">
```

This allows the browser DOM to confirm the exact source build being rendered.

## Important limitation

This pass removes **file-level ambiguity**, not every duplicated legacy selector inside the frozen compatibility layer. The next visual/motion work should migrate a semantic primitive from that frozen layer into its canonical owner, verify the rendered result, and then delete the corresponding legacy fragment. This is safer than deleting thousands of active historical declarations at once.

## Runtime scope

Frontend only. No backend/API/database/Alembic change.
