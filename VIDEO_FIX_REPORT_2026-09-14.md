# Lingvo Connect Admin — video fixes / pre-redesign pass

Source of truth: `Lingvo_Connect_Admin_Order_Motion_Files_v2.zip`.
Basis: the client walkthrough recording from 2026-09-14 and the supplied 500% browser-zoom screenshot.

## Implemented now

1. **Role badge highlight artefact removed**
   - The shell role badge (`ADMIN`, `MANAGER`, etc.) inherited a generic inset white highlight.
   - At high browser zoom it rendered as a clearly visible white line/layer on the top edge.
   - The shell role badge now has a flat theme-aware surface, one uniform border and no pseudo-element/inset shadow.
   - Applies to both light and dark themes.

2. **Browser zoom / narrow effective viewport resilience**
   - The fixed sidebar now collapses earlier (<=1180 CSS px), so a typical 1920px desktop at ~175–250% zoom does not squeeze the working canvas.
   - The top bar switches to a compact shell and progressively hides non-essential identity/role metadata.
   - At very narrow effective widths the header keeps only menu, current section and logout action.
   - Content, toolbar and settings grids are allowed to shrink/stack without page-level horizontal overflow.
   - Tables keep their own horizontal scrolling instead of forcing the entire document to overflow.
   - Wizard steps remain horizontally scrollable on narrow widths.
   - Dialogs and action groups receive narrow-viewport constraints.

3. **Regression coverage added**
   - Added Playwright checks for effective widths 1097 / 960 / 768 / 390 px (representative of high browser zoom / narrow windows).
   - Checks document overflow, responsive menu availability, role badge visibility rules and absence of the white/inset shadow in both themes.

## Deliberately not done yet

This pass does **not** rebuild the global frontend visual language. The user requested a design reference to be approved first. After approval, the new visual system can replace the accumulated legacy visual layers cleanly instead of adding another uncontrolled override layer.

## Validation performed in this environment

- New CSS parsed with `tinycss2`: no parse errors.
- Modified TS/TSX passed TypeScript parser stage; only expected unresolved-module errors were reported because `node_modules` is not included in the source archive.
- Full Next.js build and Playwright execution were not possible without project dependencies.

