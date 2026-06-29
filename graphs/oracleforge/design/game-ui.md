# Game UI / feel grounding — for the factory's shell stage (Stage 4)

Operational design grounding for the **shell** of an oracleforge game: a minimalist, deterministic,
exactly-solvable **puzzle PWA** (e.g. Lumens, Tandem). Read this before building `index.html`/`app.js`,
freeze a per-game `DESIGN.md` from it, then build to that contract.

**Priority order for THESE games:** clarity & readability → accessibility → a restrained, consistent
token system → tasteful game-feel/juice. Juice is the *last* 10%, never at the cost of legibility, and
always gated behind `prefers-reduced-motion`.

> Extraction note (no third-party code/skills are installed or vendored — this is our own distilled
> grounding). Distilled from the public design canon these repos restate: Disney's *12 Principles of
> Animation*, Steve Swink's *Game Feel*, WCAG 2.2 / ARIA, and the token/UX methodology in
> `mustafakendiguzel/claude-code-ui-agents` (MIT), `dylantarre/animation-principles` (MIT), and
> `omer-metin/skills-for-antigravity`'s game-ui-design (Apache-2.0). See CREDITS at the bottom.

## 1. Readability & clarity (Nintendo-clarity / esports-readability)
- **One focal action.** The board is the hero; chrome (score, mode, hint) is quiet and peripheral.
- **Distinct concepts get distinct controls — don't conflate "reset" with "clear".** If a game has two
  different undo-shaped actions (restore the actors to their starting position vs. remove the pieces the
  player placed), ship BOTH as separate, clearly-labelled buttons. Folding them into one (or omitting the
  "back to the start state" one) leaves the player unable to express a common intent. Baffle shipped only a
  "Lift all walls" (clear placed) and was missing a "Reset" (restage the flock) — two different needs.
- **State by SHAPE + POSITION + TEXT, never color alone.** A lit vs unlit cell must differ by more than
  hue (fill pattern, glyph, border, or an explicit label/`data-state`) — colorblind-safe by construction.
- **The N states of one element must differ by HUE *and* SHAPE — not three shades of the same bar.** When a
  thing has several states (empty / fixed / player-placed; locked / armed / done), give each a distinct hue
  AND a distinct form, so they read apart at a glance and under colour-blindness. Baffle first shipped its
  three wall states as near-identical grey/brown bars — indistinguishable; the fix made them a dotted guide /
  a barnacled rock / a wood-grain plank (different hue *and* silhouette). "Technically distinct tokens" is not
  enough; they must look like different things.
- **Characters are DESIGNED FORMS, not primitives.** An actor the player roots for (a mover, an enemy, the
  avatar) must be a deliberate little glyph with identity — a creature with a body/eye/heading, not a bare
  circle, square, or arrow chevron. A raw arrow standing in for a bird, or a plain dot for a unit, is the
  "engineer drew the data structure" look the FEEL gate rejects. Direction should read from the *form* (a
  beak, a nose, a barrel), not only an abstract arrow.
- **Meaningful representation, never raw internals.** Show targets/state in their MEANINGFUL player-facing
  form — a color swatch, an icon, a word — NEVER a bare engine index or enum number. Printing an internal
  value (a palette index like `/0`, a state id) "draws the data structure" instead of the game: it reads as
  technically-compliant slop and fails comprehension even though it's text. The encoding must mean something
  to a human, not just to the engine.
- **Teach the mechanic visually.** A first-time player must learn the CORE mechanic from the screen — ship a
  legend / principles panel / first-run tutorial that explains *how it works*, not just the controls. The
  goal and the primary action are identifiable on the first frame.
- **High contrast.** Foreground/background ≥ WCAG AA (4.5:1 text, 3:1 UI). Threats/targets read instantly.
- **Telegraph every state change.** A tap's effect is shown, not just applied (a brief highlight on the
  toggled cells); the win is unmistakable.
- **Legible small.** Works at phone size: large tap targets (≥44px), no tiny text, generous spacing.
- **SVG tap targets are measured in RENDERED px, not authoring units.** If the board is an `<svg>` whose
  `viewBox` is CSS-scaled to fit, a hit `stroke-width="44"` is **44 user-units** that shrink to `44 × board
  scale` on screen — a sub-44px tap target on every board (Baffle shipped exactly this and the UX audit
  caught it). Fix with BOTH levers: (a) `vector-effect: non-scaling-stroke` on the hit/focus stroke so its
  width is constant CSS px at any board scale; (b) floor the rendered **cell pitch** at `44px + 8px gap`
  (`--cell-min: 52px`) so adjacent constant-width bands never overlap. Dense boards that exceed the viewport
  must then **scroll the BOARD CONTAINER** (`.board-wrap { overflow-x:auto }`, and the board itself
  `flex:0 0 auto` so a flex parent can't shrink it back below the floor) — never the page.
- **Diegetic where natural.** Prefer in-board feedback (the grid reacts) over modal popups for routine
  events; reserve modals for win/lose/menu.

## 2. Design tokens (the baseline system — emit as CSS custom properties)
Define once in `:root` and reference everywhere (no magic numbers, no ad-hoc hex):
- **color:** `--bg --surface --fg --muted --accent --on-accent --success --warn` (verify AA contrast).
- **type:** a small scale `--fs-1 … --fs-4`, one font stack (system or a single pinned face), `--lh`.
- **space:** a 4/8px scale `--sp-1 … --sp-6`; **radius:** `--r-1 --r-2`; **elevation:** `--shadow-1`
  (use sparingly — flat reads cleaner for puzzles; avoid generic blurry drop-shadows).
- **motion:** `--dur-fast(80ms) --dur-base(160ms) --dur-slow(280ms)`, `--ease-out(cubic-bezier(.2,.8,.2,1))`,
  `--ease-spring` for delight moments. ALL motion respects `prefers-reduced-motion`.

## 3. Game feel / juice (Disney's 12 → puzzle web, restrained)
Apply the principles that suit a calm puzzle; skip the loud ones. Concrete mappings:
- **ANIMATE THE SIMULATION — never snap to the final frame (non-negotiable for plan-then-run games).**
  In a plan-then-run puzzle (place → Run → watch), *watching the result resolve IS the game*. The engine
  already records the per-tick frames (`simulate().frames`) — PLAY them: tween each entity cell→cell with
  easing, rotate/bank into turns, land with a small settle. A "Run" handler that jumps `state = lastFrame`
  and shows the verdict has deleted the core feedback loop — it reads as dead and broken even though the
  outcome is correct (Baffle shipped exactly this snap-to-final bug). Drive the animation from the recorded
  frames; reduced-motion is the ONLY case that snaps to the final state (opacity cross-fade only).
- **Interpolate CONTINUOUSLY across ticks — no per-cell stop, no inter-tick pause.** A tick is a *gameplay*
  unit, not an *animation* unit. Animating each tick as an independent ease-in-out (velocity → 0 at every
  cell) plus a `setTimeout` gap between ticks produces a hop-hop-hop stutter that reads as "jumping box to
  box" (Baffle's first animation pass did exactly this). Instead build each actor's whole trajectory and
  traverse it as ONE continuous motion: constant flow through straight runs (sub-tick interpolation between
  frames, NOT a stop at each), with the easing applied once over the *whole journey* (gentle start, gentle
  stop) and a brief bank/slow only at genuine turns. Smooth = continuous velocity, not eased-per-cell.
- **Give ACTORS the Disney principles, not just the transitions.** Squash & stretch (stretch along travel,
  squash on landing/turn — volume-preserving), anticipation (a tiny crouch before a leap/score), follow-
  through & secondary action (a bob, a lag, a tail), arcs (bank into turns), a bouncy idle. A character that
  only translates is a sprite on a conveyor belt; the life is in the deformation. Apply these to the movers/
  enemies/avatar, all behind `prefers-reduced-motion`.
- **Individuate identical actors in the FREE cosmetic space.** Where a difference doesn't touch the
  mechanics (the solver doesn't care), it's room to add life: give N identical movers distinct colours / small
  form variations / their own coloured trails so they read as individuals, not clones. Cosmetic variety is a
  cheap, high-impact win the "engineer" instinct leaves on the table.
- **Drive animation clocks by ACCUMULATED CLAMPED deltas, not `(now - startTime)` (the "frozen animation" trap).**
  If the loop computes progress as `(now - t0) / total`, a main-thread BLOCK (e.g. generating the next level
  synchronously) or a throttled/backgrounded tab makes `now` jump forward by seconds → `progress` leaps to 1
  → the whole animation SNAPS to its end state with nothing ever moving (the simulation "ran in the
  background while the animation froze"). Instead accumulate `elapsed += min(now - prev, ~64ms)` each frame:
  a stall merely PAUSES the animation and it resumes smoothly. Also wrap the per-frame body in try/catch (a
  throwing frame must not kill the loop) and run heavy background work via `requestIdleCallback`, never on the
  path of a running animation. (Polish, same area: synthesize SFX with the Web Audio API — no asset files,
  offline — for the core events, behind a persistent, persisted MUTE toggle.)
- **Never gate the UI-unlock solely on the animation loop completing (the "frozen buttons" trap).**
  `requestAnimationFrame` is PAUSED while the tab is backgrounded/occluded (and can stall). A
  "lock the controls → animate → re-enable in the rAF callback" pattern therefore freezes the toolbar
  FOREVER if the player switches away mid-run, because the only `finish()` (unlock) lives inside the loop that
  stopped (Baffle's run buttons froze exactly this way). Guarantee the unlock with all of: an **idempotent
  `finish()`**, a **`setTimeout` watchdog** (setTimeout still fires when backgrounded) that force-finishes, a
  **`try/catch`** around the animation setup that finishes on any throw, and a **hard cap on total animation
  duration** so even a long run can't lock the controls for more than a couple of seconds.
- **Squash & stretch + Exaggeration:** a tap scales the cell ~1.0→1.08→1.0 (`--dur-fast`, `--ease-out`);
  the win does a single celebratory pulse — don't overdo it.
- **Anticipation:** the hint ladder *telegraphs* before acting (orient → eliminate → move → step-through).
- **Staging & Appeal:** draw the eye to the one cell that matters; keep everything else still.
- **Slow in / slow out + Arcs:** transitions ease (never linear); moving elements travel slight arcs.
- **Follow-through / Overlap & Secondary action:** stagger multi-cell reactions a few ms; a subtle
  particle/ripple is secondary, never required to read the state.
- **Timing:** 80–200ms for micro-interactions; weight = duration. Snappy, not sluggish.
- **The trust↔delight dial:** default to *trust* (subtle, professional, no bounce); add *delight*
  (overshoot/spring) only on success and only if it never delays input. Instant retry (<2s), no input lag.

## 4. Accessibility (WCAG 2.2 / ARIA — non-negotiable)
- Roles/labels on every interactive element (`role`, `aria-label`, `aria-pressed`/`aria-disabled` for
  cells); the grid is keyboard-navigable (arrows + Enter/Space) with a visible `:focus-visible` ring.
- **No state by color alone** (see §1). **Respect `prefers-reduced-motion`** (disable non-essential
  animation). Honor `prefers-color-scheme`. Persisted mute for any audio.
- Time-to-first-solve ≤ 90s for a new player (the human first-look protocol still applies).

## 5. SPEC-first UI — write a per-game DESIGN.md
Before building the shell, write `DESIGN.md` into the game dir freezing THIS game's UI constraints:
palette (the chosen token values), font, the readability rules, the juice budget (trust vs delight),
and explicit do/don'ts (e.g. "high-contrast borders; state via glyph+label not color; no generic CSS
drop-shadows; all motion behind reduced-motion"). Then build to it — same discipline as the frozen SPEC.
**Visual identity — not a wireframe.** DESIGN.md must commit to an *aesthetic*: a theme, a palette chosen
with intent, and real typography — not the default engineer's-data-structure look (bare gray cells,
unstyled defaults). With labels hidden the build should still read as *a specific game*. A
characterless-but-functional UI is a feel/identity failure, not a pass. Optional north-star: if a concept
reference exists (`out/factory/DESIGN_REF.*`, or an idea-spec `art:`/`look:` field), honor it as the visual
target; absent → choose a deliberate direction anyway.

**Complete progression flow — no dead-ends.** Every mode must have a forward path. On a WIN, render an
explicit **Next-level** affordance — curriculum opens the next level, endless advances to the next, with a
tasteful end-of-pack state on the last. A win screen that only offers "back to menu" strands the player and
is a BUG. Watch the false-green trap: a passing test of a same-level "advance-turn" helper is NOT a passing
next-LEVEL flow (Enfilade shipped exactly this gap). The shell test must assert the real next-level transition.

## 6. Testable UI contract (what the shell gate checks — keep the harness honest)
A separate verifier asserts the *mechanical* parts (visual juice stays prompt-guided, not claimed as
verified). The shell's `*.test.js` MUST assert, by reading the built files:
- a tokens stylesheet exists and `index.html`/`app.js` reference the CSS custom properties (no raw hex in
  component code);
- interactive cells carry ARIA (`role` + `aria-label` + `aria-pressed`/equivalent) and a non-color
  `data-state`/glyph for on/off;
- the CSS contains a `prefers-reduced-motion` block;
- a `:focus-visible` (or focus) style exists;
- `DESIGN.md` exists in the game dir.
These are gated like every other stage (independent `node --test` re-run). They don't prove it's
*beautiful* — they prove it's *legible, accessible, tokenized, and reduced-motion-safe*.

## CREDITS / provenance (distilled, not copied; nothing installed)
Public canon: Disney *12 Principles of Animation*; Steve Swink, *Game Feel* (2008); WCAG 2.2 / WAI-ARIA;
Adams *Fundamentals of Puzzle & Casual Game Design* (already in the `game-design` notebook). Repos that
motivated this grounding (read, distilled, attributed — **not** installed as skills/plugins per the
machine's plugin/agent-platform policy): `mustafakendiguzel/claude-code-ui-agents` (MIT),
`dylantarre/animation-principles` (MIT), `omer-metin/skills-for-antigravity` game-ui-design (Apache-2.0).
