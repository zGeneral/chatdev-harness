# Objective UI/UX review gate — for the `reviewer` role

Objective, **code-readable** criteria for failing a visually poor UI **even when the build is functional
and tests are green**. The reviewer can't see pixels, so it checks these against the render/layout/style
code (CSS/SCSS, JSX/TSX, pygame draw calls, color/font constants, animation durations, input-prompt
strings). Each unmet item is a finding; any **BLOCKER** = the UI fails review → loop back to the programmer.

> Extracted (distilled, not installed) from the `game-ui-design` skill in `omer-metin/skills-for-antigravity`
> — its `validations.md` (lint rules), `sharp_edges.md` (numeric thresholds), `patterns.md` (anti-patterns).
> Philosophy: "If players notice the UI, something is wrong"; "every element must earn its screen space."

## BLOCKERS (any one = FAIL)
1. **Color-only meaning.** Any state/category/rarity/team/danger conveyed by color with NO second channel
   (icon, shape, text, pattern). ~8% of men are red-green colorblind. PASS = every color-coded element
   also differs by shape/icon/text.
2. **Unreadable text size.** Body/UI text < 16px (hard floor 14px); critical HUD/status text < 24px (1080p
   baseline). FAIL on any sub-14px text.
3. **Low contrast.** Text/background contrast < 4.5:1. FAIL.
4. **Text on busy background with no legibility aid.** HUD/overlay/world-space text lacking ALL of: a
   1–2px contrasting outline, a drop shadow (2–4px @~50%), or a 20–40% dark backing panel. "It's fine on
   the current background" is not acceptable. FAIL.
5. **Targets too small / cramped.** Interactive elements < 44–48px, or focus targets with < 8px spacing. FAIL.
6. **Keyboard/controller unreachable or invisible focus.** Any interactive control not reachable by
   keyboard/gamepad, OR a focus indicator that is color-only (no ring/scale/highlight larger than the element). FAIL.
7. **Hardcoded input prompts.** Literal "Press A"/"Press Space"/"Press Enter"/fixed key labels instead of
   the actually-bound key. FAIL.
8. **Center-screen / gameplay obstruction.** Persistent HUD or panels covering the center (crosshair) zone
   or the player/threat/interaction area, with no dim/hide path. FAIL.

## HIGH (flag; fix expected)
9. **Clutter / overload.** Too many always-on elements; non-critical layers not dimmed (minimap ~60–80%,
   secondary trackers ~70%); >5–6 simultaneous damage numbers, or >2–3 stacked notifications without
   consolidation. Every element must earn its screen space.
10. **Harmful motion.** UI animations >200ms, or slide/bounce/rotation/parallax/zoom/screen-shake on UI,
    or no `prefers-reduced-motion` respect. Allowed: fade, 95%→100% scale, color, progress fill, ease-out, ≤200ms.
11. **Resolution-fragile layout.** Hardcoded pixel sizes/positions or one hardcoded resolution; fixed 0,0 /
    zero-margin at screen edges (TV overscan); no UI-scale option. Target 1080p baseline; survive 720p/1440p/4K/ultrawide.
12. **Inconsistent affordances.** The same control doing different things across screens, or confirm/back/
    primary actions moving position between views.

## Output
Per finding: `{severity, location (file:line / component), problem (which rule), concrete fix}`. Do not
pass the UI on "it works" alone — a functional UI that trips any BLOCKER is a review failure.

*(Web vs. game scope: items 1–6, 10–11 apply to any UI; the HUD/crosshair/controller/damage-number items
apply to the game graphs — `game_factory*.yaml`, `tandem.yaml`.)*

CREDITS: distilled from `omer-metin/skills-for-antigravity` game-ui-design (Vibeship-derived); our words; nothing installed.
