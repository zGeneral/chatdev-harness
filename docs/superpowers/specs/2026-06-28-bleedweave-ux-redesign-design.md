# Bleedweave UX redesign + factory UX-gate hardening — design

Date: 2026-06-28
Status: approved (brainstorm), implementing

## Context

`out/factory/` holds a Bleedweave build (deterministic engine + exact topo-sort
solver + solver-gated level pack — all independently verified, 103 `node --test`
green). Its **view layer** shipped opaque: abstract gray cells printing raw
palette **indices** (`/0`, `/4`), no visible color targets, no explanation of the
order-matters blend rule, no visual identity. A user could not tell how to play.

Root cause (see also Part B): the factory's UX gates measure only *computable*
a11y/feel properties (contrast, tap-size, ARIA, focus rings, motion easing). None
measures **comprehension or visual identity**, and the "no color-alone" rule
perversely rewarded printing index numbers. The shell stage was thrashing
(32 `UX: FAIL` vs 4 `PASS`) inside a fundamentally wrong frame when the run was
stopped. The agent had no concept reference and no taste signal.

## Part A — Bleedweave view-layer redesign

Direction (approved): **warm woven-loom**, concept-faithful. Keep the proven
brains; rebuild only the view.

### Hard boundary
Do **not** touch engine/solver/contract/pack/codec-less share logic, daily seed,
hint ladder, or ethics logic. Only: `index.html`, `app.js` *render/markup +
boot wiring*, `tokens.css`, `styles.css`, `DESIGN.md`, and `shell.test.js` (update
the §6 UI-contract assertions to the new DOM — keep them as real assertions, never
weaken). `node --test` stays green (103+).

### Layout (3-panel loom)
- **Top bar**: brand, status (mode · Woven n/N · Mismatches), Undo / Restart / Hint.
- **Left**: ribbon tray — one chip per ribbon in its color, name (Row 1 / Col 2),
  and an **order badge** (①..) when woven; dimmed when not.
- **Center**: the **wooden loom** — ribbons rendered as **colored bands** that
  span their row/column and **interlace (basketweave, over/under alternating by
  (r+c) parity)** over the cells. Each **cell shows its target as a color swatch +
  a verdict glyph** (✓ match / ✗ mismatch / · pending). Order badges at band ends.
  Below: a **weave-order track** (`1 Row 1 → 2 Col 1 → …`).
- **Right**: **Bleed Principles** panel — 3 steps; step 2 shows the game's *real*
  blend both ways (`green⊕yellow = X` vs `yellow⊕green = Y`, `≠`) to teach the soul.

### Palette re-tune
Engine palette indices unchanged; only the **hues** change (CSS tokens). Index 0
moves off near-white (was `#e0e4ea`) to a vivid warm color; all 6 mutually
distinct AND readable on wood AND passing WCAG (text ≥4.5:1, non-text ≥3:1).
Keep a dark variant under `prefers-color-scheme: dark`.

### A11y / contract (must keep green)
State by **shape + glyph + ARIA**, never hue alone. Interactive cells/ribbons:
`role` + `aria-label` + `aria-pressed`/`data-state` + a non-color glyph. A
`prefers-reduced-motion` block; a `:focus-visible` style; tokens stylesheet
referenced; **no raw hex in app.js** (all color via tokens). `DESIGN.md` exists
and freezes these constraints.

### Juice (the FEEL gate) — all disabled under reduced-motion
Ribbon eases into place on weave; cell blooms to its blend color and stamps the
verdict; restrained win pulse. Volume-preserving easing per
`docs/grounding/motion-math.md` (never linear).

### Verification
`cd out/factory && node --test` green; Playwright screenshots at 320 / 768 / 1280
confirm: first frame shows goal + how-to; targets are color swatches not indices;
weave visibly interlaces; order legible; no horizontal scroll.

## Part B — Factory UX-gate hardening (graphs/oracleforge/*)

Make the factory's shell/ux/feel stages refuse opaque or characterless UIs.

1. **`ux_audit` (node + `design/ux-audit.md`)** — add CRITICAL **comprehension**
   checks, measured on the rendered DOM by a first-time-player heuristic:
   - Goal + primary action identifiable on the first frame **without prior
     knowledge** (a stated goal/objective element exists; a how-to/legend exists).
   - **No raw-internal encodings as the player-facing signal** — targets/states
     must be shown as their *meaningful* form (color swatch / icon / word), never
     bare engine indices or enum numbers. Explicitly reject "draws the data
     structure."
   - A **teaching surface** exists (legend / principles / first-run tutorial) that
     explains the core mechanic.
   - **Genre/identity legible** (the existing AI-slop genre-swap, strengthened):
     with labels hidden the game still reads as *a specific game*, not a generic grid.
2. **`feel_review` / `playability.md`** — add a **visual-identity / "not a
   wireframe"** criterion: the build must commit to an aesthetic (theme, palette
   with intent, typography), not ship the default engineer's-data-structure look.
3. **North-star input (optional, additive)** — let the shell stage consume an
   optional concept reference (`out/factory/DESIGN_REF.*` or an idea-spec
   `art:`/`look:` field) and treat it as the visual target. Absent → unchanged.
4. **Anti-thrash note** — when `ux_audit` fails the *same* comprehension check
   twice, the shell instruction must "step back and reconsider the frame"
   (re-theme), not re-juice the same wrong layout.

These are prompt/doc edits to the graph + grounding docs; no engine code.

## Out of scope
Reproducing the painterly illustration pixel-for-pixel; multiplayer; new game
modes; the deleted standalone share-code module.
