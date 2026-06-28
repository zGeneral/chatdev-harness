# UX audit — render the PWA and MEASURE it (oracle factory, after shell)

`shell` *authors* the UI (tokens, ARIA, reduced-motion, DESIGN.md) but nothing ever *renders* it. This
gate does: it serves the built `out/factory/` PWA and drives a real browser (Playwright MCP) at a viewport
matrix, then **DOM/CSS-measures** computable checks — no subjective scoring. Findings route back to `shell`.

> Distilled from `fagemx/gstack-game` (`game-ux-review`, `game-visual-qa`, `plan-design-review`) — extracted,
> not installed. Every check emits a measured value (px / ratio / count), not a vibe.

## How to run (agent has Bash + the Playwright MCP tools)
1. Serve the build detached, capture the PID, wait for the port (bounded curl-retry, never a foreground sleep):
   `ROOT="$PWD"; (cd out/factory && "$ROOT/.venv/bin/python" -m http.server 8137 >/dev/null 2>&1 &) ; for i in $(seq 1 20); do curl -sf localhost:8137 >/dev/null && break; done`
2. Use the Playwright tools (find via ToolSearch "playwright browser"): `browser_navigate` to `http://localhost:8137`,
   then `browser_resize` to each viewport and `browser_snapshot` / `browser_evaluate` to read the DOM/CSS.
3. Kill the server when done: `pkill -f "http.server 8137"` (best-effort).

## Viewport matrix
320×568 (mobile) · 768×1024 (tablet) · 1280×800 (desktop). Every CRITICAL check must hold at all three.

## CRITICAL checks (any fail ⇒ UX: FAIL → back to shell)
- **First frame:** on first paint (no scroll), the goal/objective AND at least one legal-move affordance are
  visible (query the DOM for the board + an interactive control in the initial viewport box).
- **Color-independence:** puzzle state must carry a redundant non-color encoding — assert cells expose a
  non-color signal (`data-state`/`aria-pressed`/glyph/text), not color alone.
- **Text contrast:** computed text-vs-background contrast ≥ 4.5:1 (compute from `getComputedStyle` colors).
- **Non-text contrast (WCAG 1.4.11):** computed ≥ 3:1 against the adjacent background for every UI element
  a player must perceive that ISN'T text — the `:focus-visible` ring, tile/piece outlines & gridlines,
  selected/active borders, and any glyph/shape state-marker (the non-color encoding from the color-
  independence check must itself clear 3:1, not merely exist). A board whose pieces or focus ring are
  technically-distinct-but-too-faint fails here even if all text passes.
- **Touch targets:** every interactive element's `getBoundingClientRect()` ≥ 44×44px, with ≥8px gaps.
- **No horizontal scroll:** `document.scrollingElement.scrollWidth ≤ clientWidth` at every viewport.
- **Interaction-state matrix:** the DOM demonstrably handles each of: invalid move · undo/redo · solved ·
  unsolvable/stuck · share-link-loaded · reduced-motion (drive each via `browser_evaluate`/clicks and assert
  the resulting DOM state).
- **AI-SLOP genre-swap:** with all text labels hidden, the puzzle is still identifiable as *this* game (the
  board/pieces render distinctly), not anonymous default UI.

## HIGH (flag; fix expected)
- Tutorial-bloat: first-screen + first-level non-skippable text ≤ 100 words (fail if > 100 or > 60% of text).
- Dead-input: after ~N seconds idle, a hint/affordance appears.

## Output
End with EXACTLY `UX: PASS` if all CRITICAL checks hold at all viewports, else `UX: FAIL` + each failed check
with its measured value and the viewport. Edit nothing — you are a verifier; `shell` applies fixes.

CREDITS: distilled from `fagemx/gstack-game` (MIT); our words; nothing installed.
