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
- **Every control must actually RECEIVE the click — verify hit-testing, not just size.** A button can be the
  right size, visible, and styled, yet be completely dead because something sits on top of it or it has
  `pointer-events:none`. For each interactive control, assert `document.elementFromPoint(center)` returns that
  control (or a descendant) — i.e. it is the topmost hit target. A classic cause: a decorative SVG class name
  collides with a UI class (Baffle styled its flock wake `.ghost { pointer-events:none }`, which also matched
  the `.btn.ghost` Hint/Menu buttons and made them unclickable — sized correctly, but dead). Size + contrast
  checks will NOT catch this; the elementFromPoint check is the one that does.
- **Touch targets:** every interactive element renders ≥ 44×44px on screen, with ≥8px gaps. **Measure the
  real HIT area, not the box.** `getBoundingClientRect()` returns a **zero-thickness** box for an SVG
  `<line>`/stroke (it ignores the stroke), and `getScreenCTM()` does **not** account for a scrolled board
  container — both silently mis-report. For SVG hit strokes, probe the actual hittable band with
  `document.elementFromPoint()` stepping perpendicular from the element's midpoint, and derive that midpoint
  from `svg.getBoundingClientRect()` (which reflects scroll) — or `scrollIntoView({block:'center',
  inline:'center'})` each element first. A hit band whose `stroke-width` is in **viewBox units** shrinks with
  board scale (sub-44px); the fix is `vector-effect:non-scaling-stroke` + a floored cell pitch (see
  `game-ui.md`). Baffle's audit caught this; the naive `getBoundingClientRect` check would have missed it.
- **No horizontal scroll:** `document.scrollingElement.scrollWidth ≤ clientWidth` at every viewport. This is a
  **PAGE-level** gate — an internal `overflow-x:auto` board container that pans a dense board is allowed and
  expected (it is how a board too wide for the viewport keeps ≥44px tap targets without scrolling the page).
- **Interaction-state matrix:** the DOM demonstrably handles each of: invalid move · undo/redo · solved ·
  unsolvable/stuck · share-link-loaded · reduced-motion (drive each via `browser_evaluate`/clicks and assert
  the resulting DOM state).
- **AI-SLOP genre-swap:** with all text labels hidden, the puzzle is still identifiable as *this* game (the
  board/pieces render distinctly), not anonymous default UI.

## CRITICAL — comprehension (the "can a first-time player understand & play this?" checks)
The contrast/tap-size/ARIA checks above prove a build is *accessible*; they do not prove it is
*understandable*. A build can clear every a11y check and still ship opaque — abstract cells printing raw
internal numbers, no stated goal, no explanation of the mechanic. These checks close that gap. Measure each
on the rendered DOM **as a first-time player with NO prior knowledge** — read only what the page actually
shows. Any fail ⇒ UX: FAIL → back to shell.
- **Goal + action on first frame:** on first paint (no scroll) a stated OBJECTIVE element (what am I trying
  to do?) AND a how-to/legend surface (how do I act?) are BOTH present. Query the DOM for both; if a newcomer
  can't name the goal and the primary action from frame one, FAIL.
- **Meaningful representation — no raw engine indices (AUTOMATIC FAIL):** targets and states must render in
  their *meaningful* player-facing form — a **color swatch / icon / word** — never a bare engine index or
  enum number. If any cell/target shows a raw internal value as the player-facing signal — a palette INDEX
  (`/0`, `/4`), an enum ordinal, a state id — this is an **automatic FAIL**: the build "draws the data
  structure / prints the variables" instead of rendering the game. (Printing index numbers is NOT a valid
  color-independence encoding — it is technically-compliant, humanly-unreadable slop.) Signal to compute:
  assert no player-facing cell/target text is a bare integer or `name/index` form that maps to an internal id.
- **Teaching surface:** a legend / principles panel / first-run tutorial exists in the DOM that explains the
  CORE MECHANIC (not merely the controls). Assert such a surface is present and discoverable; absent ⇒ FAIL.
- **Genre / identity legible** (the AI-SLOP genre-swap, strengthened): with all text labels hidden, the
  rendered board/pieces must still read as **a specific game with its own visual identity**, not a generic
  gray grid that could be any app. A characterless default grid ⇒ FAIL.
- **Progression flow — no dead-end:** actually DRIVE a level to a WIN (use the hint ladder / certified
  solution), and confirm the win state renders a working **Next-level** affordance that opens a *different*
  next level — in the curriculum AND in endless. A win screen offering only "back to menu" ⇒ FAIL. Do not
  trust a passing unit test of a same-level "advance-turn" helper — verify the real next-LEVEL transition in
  the rendered DOM (Enfilade shipped this exact dead-end).

## HIGH (flag; fix expected)
- Tutorial-bloat: first-screen + first-level non-skippable text ≤ 100 words (fail if > 100 or > 60% of text).
- Dead-input: after ~N seconds idle, a hint/affordance appears.

## Output
End with EXACTLY `UX: PASS` if all CRITICAL checks hold at all viewports — both the a11y/feel checks AND the
comprehension checks (goal+action on first frame, meaningful-not-raw representation, teaching surface,
genre/identity legible) — else `UX: FAIL` + each failed check with its measured value and the viewport. A raw
engine index shown to the player is an automatic `UX: FAIL`. Edit nothing — you are a verifier; `shell`
applies fixes.

CREDITS: distilled from `fagemx/gstack-game` (MIT); our words; nothing installed.
