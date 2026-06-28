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
- **State by SHAPE + POSITION + TEXT, never color alone.** A lit vs unlit cell must differ by more than
  hue (fill pattern, glyph, border, or an explicit label/`data-state`) — colorblind-safe by construction.
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
