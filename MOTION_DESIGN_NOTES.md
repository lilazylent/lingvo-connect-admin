# Lingvo Connect CRM — Motion design notes

These notes are the project-level rationale behind `motion-system.css`.

## Product principle
This is an operational CRM, not a marketing landing page. Motion must make state, hierarchy and interaction clearer while keeping repeated work fast.

## Timing ranges used
- frequent hover/press/focus feedback: ~50–150 ms
- dropdown / small popup context: ~150–200 ms
- modal / panel / local context change: ~180–300 ms
- large context changes: stay below ~400 ms unless there is a demonstrated usability reason

## Behavior rules
- Prefer opacity and transforms for animated movement.
- Favor color/border/shadow feedback for high-frequency controls.
- Do not loop decorative motion on the normal workspace.
- Do not make users wait for an animation before the next action.
- Avoid competing simultaneous focal animations.
- Preserve static depth, surface hierarchy and restrained branded accents so dark mode remains pleasant without becoming noisy.
- Reduce or remove non-essential transforms when `prefers-reduced-motion: reduce` is active.

## Sources used
- Atlassian Design System — Motion overview / applying motion
- Apple Human Interface Guidelines — Motion and Reduced Motion
- Nielsen Norman Group — The Role of Animation and Motion in UX; Executing UX Animations
- W3C / WCAG — Animation from Interactions and reduced-motion accessibility guidance
