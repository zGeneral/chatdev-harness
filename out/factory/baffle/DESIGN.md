# Baffle — Frozen UI / Feel Design (Stage 4 shell)

Frozen per `graphs/oracleforge/design/game-ui.md §5` from the grounding docs
(`docs/grounding/ui-design-contract.md`, `motion-math.md`, `game-ui-review.md`).
The shell (`index.html` + `app.js` + `tokens.css`) is built to THIS contract and the
verifier (`shell.test.js`, §6) reads these files to enforce it.

> Priority order (game-ui.md §0): **clarity & readability → accessibility → a
> restrained token system → tasteful game-feel.** Juice is the last 10%, never at the
> cost of legibility, always behind `prefers-reduced-motion`.

---

## 0. What Baffle IS (so the shell renders the GAME, not the data structure)

The player **cannot point a mover**. Their whole budget is **k wall segments** on
interior grid edges. A wall only **FORBIDS** an edge; the fixed turn-rule —
*advance; else turn **right** (90° CW); else left; else reverse* — then PICKS the
exit. The shell must make three things identifiable **on the first frame**:

1. **The GOAL** — deliver every **mover** (a glyphed creature, facing-arrow) to the
   **sink** (a labelled drain target). Rendered as meaningful icons, never indices.
2. **The primary ACTION** — *tap an interior edge to place / remove a wall* (budget
   `k`). The cursor and the budget chip teach this without words on hover.
3. **The MECHANIC** — taught by a **persistent ghost-trail overlay (U1)**: the faint
   last-run / null-run trajectory is drawn so the player reads a wall's effect against
   a **visible baseline**, and *sees* a creature bank right-before-left rather than
   recall it. A first-run **legend / how-to-play panel** states the turn-rule in one
   sentence.

**Forbidden representation (comprehension gate):** never print a raw facing enum,
palette index, edge-key string, or cell id as the player-facing label of a target or
state. Movers are drawn as a creature glyph with a heading arrow; sinks as a target
ring; walls as thick segments; state via shape + ARIA + glyph, **never colour alone**.

---

## 1. Visual identity (a deliberate theme — not the engineer's default)

**Theme: "Drift & Drain" — a calm tidal-flats top-down.** Movers are little **terns**
(⟁ chevron-bird heading-glyph) drifting on a quiet sand-grey grid; sinks are **tide
drains** (◎ target ring); walls are **driftwood groynes** (thick warm-timber
segments) the player lays to bank the flock. The palette is muted sand + slate + a
single warm teal accent (the water you bank the birds into). Flat, high-contrast,
no skeuomorphic drop-shadows. With labels hidden it still reads as *birds banking
around groynes into a drain* — a specific game, not grey cells.

---

## 2. Design tokens (emit as CSS custom properties in `tokens.css`; §2 + ui-design-contract §1)

HSL semantic tokens only. Light + dark via `prefers-color-scheme`. No raw hex in
`app.js` (every colour referenced as `var(--…)`; `tokens.css` is the ONLY file with
hex literals, and it states each pair's measured AA/non-text ratio).

### Colour (light values; dark overrides in the `@media (prefers-color-scheme: dark)` block)
| token | value | role | contrast |
|---|---|---|---|
| `--bg` | `hsl(40 30% 96%)` | page / outside-board sand | — |
| `--surface` | `hsl(40 24% 91%)` | board cells, panels | — |
| `--surface-2` | `hsl(40 18% 84%)` | raised chips / statusbar | — |
| `--fg` | `hsl(210 30% 16%)` | primary text | **12.3:1** on `--surface` (AA) |
| `--muted` | `hsl(210 12% 40%)` | secondary text | **4.9:1** on `--surface` (AA) |
| `--accent` | `hsl(188 64% 29%)` | water / sink / primary action | **4.99:1** text on `--surface`, **5.54:1** on `--bg` (AA ✓) |
| `--on-accent` | `hsl(40 40% 97%)` | text on accent fills | **5.64:1** on `--accent` (white-on-accent, AA ✓) |
| `--mover` | `hsl(24 72% 44%)` | tern body (warm) | shape+glyph carries state, not hue |
| `--wall` | `hsl(28 38% 30%)` | driftwood groyne (placed) | **3.6:1** vs `--surface` (non-text ≥3:1) |
| `--prewall` | `hsl(210 16% 32%)` | permanent slate groyne | **3.4:1** vs `--surface` |
| `--ghost` | `hsl(188 50% 40% / .42)` | U1 trail overlay (faint) | decorative, redundant to glyphs |
| `--success` | `hsl(150 56% 32%)` | win accent (redundant inset only) | **4.8:1** |
| `--warn` | `hsl(8 64% 44%)` | fail/caught accent (redundant) | **4.7:1** |
| `--line-hi` | `hsl(40 30% 99%)` | TWO-TONE gridline outer (light) | pairs w/ `--line-lo` so one always wins ≥3:1 |
| `--line-lo` | `hsl(210 24% 22%)` | TWO-TONE gridline inner (dark) | non-text ≥3:1 on light fills |

### Type — one font, ≤3 weights, body ≥16px
`--font: ui-rounded, "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif;`
`--fs-1:16px; --fs-2:18px; --fs-3:22px; --fs-4:30px;` `--lh:1.5;` headings `--lh-h:1.2;`.

### Space (8px grid) / radius / elevation
`--sp-1:4px … --sp-2:8px --sp-3:16px --sp-4:24px --sp-5:32px --sp-6:48px`.
`--r-1:8px --r-2:14px --r-full:999px`. `--shadow-1:0 1px 0 hsl(210 20% 0% / .08)` —
used sparingly; puzzles read flatter. **No generic blurry drop-shadows.**

### Motion (§2; respects reduced-motion)
`--dur-fast:90ms --dur-base:160ms --dur-slow:280ms`.
`--ease-out:cubic-bezier(.2,.8,.2,1)` (DEFAULT), `--ease-spring:cubic-bezier(.34,1.56,.64,1)`
(success only). Animate **transform / opacity only**.

### Layout caps (lesson:shell BLOCKER-8 — board must never push the affordance below the fold)
`--tap-min:44px` (touch floor), `--cell-cap:64px`, `--board-max:min(92vw,420px)`,
`--fold-reserve:240px` (chrome above+below the board), and the EFFECTIVE cap
`--board-fit:min(var(--board-max), calc(100dvh - var(--fold-reserve)))`. The board
sizes to `--board-fit`; the goal line + budget chip render **above** the board in
source order. Cell ceiling is computed in JS as
`max(--tap-min, min(--cell-cap, (--board-fit - gaps)/n))`, never below the 44px floor.

---

## 3. Game-feel / juice budget — trust over delight (§3; game-ui-review #10)

Default to **trust** (subtle, professional, no bounce). Spend the small delight
budget ONLY on the win.
- **Tap a wall:** the edge squash-pops `scale 1→1.06→1` (`--dur-fast`, `--ease-out`),
  volume-preserving (`scaleX*scaleY≈1`). A removal does the inverse, quicker.
- **Run / step playback:** movers translate cell→cell on an **eased arc** (never
  linear; motion-math RULE 0), ≤ `--dur-base` per cell; the ghost trail stays faint
  behind them.
- **Win:** a single celebratory pulse on the delivered movers + sink (`--ease-spring`,
  one shot) and the **Next** affordance slides in. No looping confetti, no screen-shake.
- **All UI animation ≤ 200ms**, fade / ≤8% scale / colour / ease-out only
  (game-ui-review #10). Instant retry (< 2s). A full
  `@media (prefers-reduced-motion: reduce)` block disables every non-essential
  animation (board/units snap to final state; only opacity cross-fades remain).

---

## 4. Accessibility (WCAG 2.2 / ARIA — non-negotiable; §4 + ui-design-contract §"a11y")

- Every interactive **edge** carries `role="button"`, an `aria-label` ("Wall between
  cell B2 and C2 — empty / placed"), `aria-pressed` (placed = true), and a non-colour
  `data-state` (`empty|placed|prewall`) + a glyph/thickness change. State is **shape +
  ARIA + label**, never colour alone (game-ui-review BLOCKER 1).
- The board is **keyboard-navigable**: arrow keys move a roving edge-cursor, Enter /
  Space toggles the wall, with a visible **`:focus-visible`** ring (≥2px, larger than
  the element — game-ui-review BLOCKER 6). Escape closes overlays.
- **Two-tone gridlines** (`--line-hi` outer + `--line-lo` inner) so a state border
  clears non-text **3:1** against BOTH the dark chrome and the light cell fills
  (WCAG 1.4.11; lesson BLOCKER). `--success/--warn` only as a redundant inset accent.
- AA text ≥ 4.5:1 (table above), tap targets ≥ 44px with ≥ 8px gaps, `prefers-color-scheme`
  honoured, **no hardcoded "Press X"** — key prompts read the actual binding.
- Time-to-first-solve target ≤ 90s for a new player (teaching band + legend + U1).

---

## 5. Modes & complete progression flow — NO dead-ends (§5 progression; lesson "every mode needs a forward path")

Flat-screen router (no nested stacks): `#/select`, `#/daily`, `#/endless`, `#/play/:id`.

- **Select** — three cards: **Daily**, **Curriculum** (the 14-level pack, tier-ordered,
  the teaching band first), **Endless**. A legend / how-to-play panel teaches the
  turn-rule on first run.
- **Daily** — UTC date → deterministic seed → one fixed level from the pack (same level
  for everyone that day, **no backend**). Win → "come back tomorrow" tasteful state +
  a "play the curriculum" forward path (never a dead-end menu-only screen).
- **Curriculum** — the baked pack in order. **On WIN, render an explicit NEXT-LEVEL
  affordance** that opens the *next pack level*; on the last level, a tasteful
  end-of-pack state. This is the **real next-level transition**, not a same-level
  "advance turn" helper (false-green trap).
- **Endless** — deterministic stream seeded from a running counter; **on WIN, advance
  to the next level** automatically (forward path). Never strands the player.

A win screen offering only "Back to menu" is a **BUG**. Every win renders **Next**.

---

## 6. Testable UI contract (what `shell.test.js` asserts — keeps the harness honest; §6)

Reading the built files only (no browser), the shell test MUST assert:
- `tokens.css` exists and is referenced by `index.html`; **no raw hex in `app.js`**
  (component code uses `var(--…)` only).
- interactive cells/edges carry `role` + `aria-label` + `aria-pressed` AND a non-colour
  `data-state`/glyph for placed/empty.
- a `@media (prefers-reduced-motion: reduce)` block exists in the CSS.
- a `:focus-visible` style exists.
- `DESIGN.md` exists in the game dir.
- **Determinism:** the same UTC date → identical daily level (seed → same pack index).
- **Grace-streak rule:** a streak survives exactly one missed day (grace by *rule*,
  never purchase), and "best" is retained alongside "current".
- **Hint eureka-integrity:** the hint ladder (orient → eliminate → move → step-through)
  is solver-driven and never *hands the player the answer* before the final rung — the
  early rungs narrow, only the last reveals a concrete placement.
- **Real next-level flow:** the curriculum/endless win path advances to the *next
  level index* (asserted against the actual transition, not a same-level helper).

---

## 7. Explicit DO / DON'T (frozen)

**DO:** render movers as glyphed terns with a heading arrow; sinks as target rings;
walls as thick timber segments; teach the turn-rule with the U1 ghost trail + a legend;
keep the goal line and budget chip ABOVE the board; size the board under `--board-fit`;
state via shape + ARIA + `data-state`; two-tone gridlines; all motion eased + behind
reduced-motion; honour the player's bound keys.

**DON'T:** print a raw facing index / palette index / edge-key as a player label; use
colour as the only channel for state; use generic blurry CSS drop-shadows; animate
> 200ms or with bounce/shake on UI chrome; hardcode "Press Space"; let the board push
the legal-move affordance below the fold; strand the player on a menu-only win screen;
add login-payout daily *rewards*, streak-repair-for-money, FOMO timers, or guilt shares
(see `ETHICS.md`).
