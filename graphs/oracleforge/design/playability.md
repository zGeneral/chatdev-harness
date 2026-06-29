# Playability gate — "is this worth playing?", MEASURED

The factory's other gates prove a game is **correct** (solvable, unique-optimal, deterministic, tested).
None of them ask whether the puzzle is **worth playing** — a correct-but-trivial pack (every level par-1,
no decision, no ramp) passes today. This gate closes that gap.

It is the oracle-ization of gstack-game's pre-ship quality gate (`/build-playability-review` "Is this
worth playing?" + `/feel-pass`): instead of a subjective vibe score, it **measures playability from the
oracle the factory already built**, then gates on thresholds — same philosophy as every other stage
(measure, don't self-certify). Runs after content (the pack exists) and before shell.

## Measurable signals (computed from the engine/solver + pack.json — no new judgment needed)
For the baked level pack, compute with the SAME solver the rest of the pipeline uses:
- **Difficulty ramp (progression / loop closure):** the distribution of `par` across the pack. A real
  game ramps — par should span a range, not collapse to one value.
- **Definiteness (payoff):** % of levels with a UNIQUE optimal solution (`countSolutions(optimal)==1`).
  A satisfying puzzle has one best answer to find.
- **Decision depth (the puzzle is real, not an auto-solve):** straight-aim / greedy regret — the fraction
  of levels where the obvious/greedy line is NOT optimal. If the naive move always wins, there's no puzzle.
- **Aha-density / peak moments:** the spread of the difficulty contract's **technique tiers** across the
  pack (how many distinct deduction techniques are required). ≥2 tiers ⇒ escalation, not repetition.
- **Session viability:** enough levels to cover the curriculum with a ramp (the content stage guarantees
  coverage; this re-checks count + spread so a 3-level pack doesn't sneak through).

## The gate (PLAYABLE: PASS thresholds — tune per game in the spec, these are defaults)
PASS requires ALL of:
- par spans ≥ 3 distinct values (a ramp exists);
- **on-ramp FLOOR (absolute, not just spread):** a genuine easy/teaching band exists — the easiest level is
  gentle AND ≥ 2 easy levels precede the hard ones. A par *spread* alone does NOT satisfy this. Bleedweave
  shipped `easy:0 / medium:7 / hard:14` (par started at 4) and was a cognitive WALL to a newcomer — its
  parSpan-6 still "passed" the old ramp check. Measure the absolute easiest par + the easy-level count.
- **hard-CEILING FLOOR (the pack must RAMP to genuinely hard — absolute challenge, not just validity):** the
  HARDEST levels must clear an ABSOLUTE decision-space / search-depth floor — they must not be eyeball-trivial.
  Par-spread, uniqueness, and technique-*presence* do NOT bound absolute challenge: a flat field of tiny rooms
  passes all of them. Enfilade shipped exactly that — every level at the FLOOR of its caps (3×3–7×6 boards,
  par 1, range-0 units, ~6 options to brute-force by eye) yet "passed" the old gate. Measure a computable
  proxy from the SHARED solver — its explored-node count (the search must be non-trivial) — PLUS structural
  magnitude (board area, entity/enemy count, turn budget) at the top tier, and require ≥ 2 levels above the
  floor. "Worth playing" includes "needs thought," not just "is a valid unique puzzle."
- **verbs must be LOAD-BEARING (no vestigial mechanics):** every core verb the SPEC defines must actually
  MATTER in the shipped content. Enfilade defined MOVEMENT as a load-bearing reach constraint, then the baker
  set unit range = 0 on 8/10 levels — the move verb was dead, the game collapsed to "rotate one enemy, fire."
  At mid+ tiers, require each core verb to be load-bearing (e.g. a unit must move in the certified solution /
  forcing range→0 breaks solvability). A vestigial-verb pack is WEAK however clean its other numbers.
- **curriculum DISTINCTNESS (every level must teach something NEW — never the same puzzle reskinned):** each
  level must be a DISTINCT puzzle. Compute a CANONICAL signature of the puzzle's essence (relative entity
  formation + relevant terrain + the certified solution's structure) that is INVARIANT under translation AND
  the 8 dihedral symmetries (rotations/reflections), and require the pack's distinct-signature count to EQUAL
  its level count (zero isomorphic duplicates). Within each multi-level tier, the levels must additionally vary
  in solution structure / escalate, not repeat. Enfilade shipped `focus-fire 1/2/3` as the IDENTICAL 5-enemy
  formation on 6×7 / 6×6 / 7×6 boards — same solution, zero new teaching — yet each "passed" per-level
  uniqueness (`countSolutions==1`). Per-level uniqueness does NOT imply inter-level distinctness; gate both.
- ≥ 50% of levels are unique-optimal;
- straight-aim/greedy regret on ≥ 25% of the non-trivial (par≥2) levels (real decisions exist);
- ≥ 2 distinct technique tiers represented across the pack (escalating aha);
- pack size ≥ the curriculum's insight count (every insight has a home, with room to ramp).
Otherwise → PLAYABLE: WEAK, naming the failing dimension, and the content stage re-bakes targeting it.

## gstack dimension → our measured metric
| gstack `/build-playability-review` & `/feel-pass` | our measured proxy |
|---|---|
| Loop closure / progression | par-ramp distribution + curriculum coverage |
| Peak moments | high-regret + top-technique-tier levels exist |
| Payoff / definiteness | unique-optimal % |
| Clarity / "is there a puzzle" | greedy-regret % (obvious move is wrong) |
| Session viability / retention signal | pack size vs curriculum + ramp spread |

## Soul-necessity (the signature technique must be load-bearing)
`content`'s revelation certificates prove an insight is PRESENT and teachable, but not NECESSARY — a build
can ship where the headline technique is decorative (instances stay solvable + unique-optimal without ever
using it). That is "fake-depth" slop. So `synthesize` declares **THE SOUL** — the single signature
deduction/technique the puzzle is built around — as a `soul:` contract field in SPEC.md, and this gate
ABLATES it: disable that one inference rule in the exact solver and re-run the census over the pack.
- **PASS:** with the soul rule removed, ≥ 80% of instances become unsolvable OR lose their unique-optimal
  solution (the soul is load-bearing).
- **FAIL (decorative soul):** removing it changes solvability/uniqueness for < 80% — flag and re-bake/redesign.

> Distilled from `fagemx/gstack-game` (`implementation-handoff` "Name the Soul" + `game-codex` necessity framing).

## Teach the mechanic visually + visual identity (carried by shell / ux_audit)
Structural depth is worthless if the player can't SEE the puzzle. Two requirements ride alongside this
gate and are enforced downstream by the shell stage and the `ux_audit` rendered-DOM checks:
- **Teach the mechanic visually:** the shell must surface the core mechanic — a legend / principles panel /
  first-run tutorial — and render targets/state in their MEANINGFUL form (a color swatch / icon / word),
  NEVER as raw engine indices or enum numbers. A build that "prints the data structure" is unplayable to a
  newcomer however clean its census numbers are.
- **Visual identity (not a wireframe):** the build must commit to an aesthetic (a theme, an intentional
  palette, real typography), not ship the default engineer's-data-structure look. With labels hidden it must
  still read as *a specific game*.

## Human-cognition fit is gated UPSTREAM (Stage 0), not here
Structural depth means nothing if the *core mechanic* is hostile to human cognition (an arbitrary-table
recall + an in-head topological sort — see `examples/bleedweave-postmortem.md`). That is caught at the
front door by the **`critic_human`** council critic against `design/human-fit.md` (intuitive substrate /
bounded working memory / legible state / fun-early); a `human-unfit` idea is a hard NO-GO, parked, never
built. This gate then enforces the **on-ramp floor** above so a human-fit mechanic still ships with a
gentle entry.

## Endless / infinite replayability (optional mode — generate, don't cap)
A fixed curated pack tops out; if a game wants an ENDLESS climb (the player's high score = how far
they reach), generate levels on the fly with the SAME in-browser engine+solver. The hard constraint is
YIELD: for a thin-manifold mechanic (blunt verbs — Baffle's walls), random **unique-optimal** levels
have ≈0% yield (measured) and cannot be generated live. The working split:
- **Curated campaign** keeps the unique-optimal guarantee (the elegant, hand-quality on-ramp).
- **Endless mode** relaxes to **solvable + par ≥ 2** (a real, non-trivial puzzle; ≈14% yield at 2 movers
  → fast). Scale difficulty via **board size / entity count / density, NOT higher par** (par-N unique
  manifolds only get thinner).
Every generated level stays **solver-verified** (always winnable) and **deterministic by index** (seeded →
the same level for everyone — shareable, fair high-score). Hide generation latency: **precompute the next
level in the background during play + cache + a loading-screen fallback** (never a frozen blank). This makes
a 14-level pack genuinely endless without sacrificing early-game quality.

## Mastery scoring + a meta-economy (anchor everything to par)
The factory already proves each level's **par** (solver-minimum moves). Reuse it as the spine of a
retention loop — no hand-tuned scores, all solver-grounded:
- **Star rating by efficiency:** par moves → ★★★, par+1 → ★★, par+2 → ★. The placement **budget = par+2**
  (so the 1★/2★ tiers are reachable — a literal "budget = par" leaves only 3★-or-fail and kills the
  ladder). Show par as the gold ★★★ target + a live "best stars still achievable" forecast as the player
  places. Store BEST stars per level; replaying for ★★★ is the long tail.
- **A meta-economy ties the modes together:** collected stars vs the all-3★ potential is the completion
  metric; gate a harder mode behind a star threshold (Baffle: the brutal **daily** unlocks at 30 climb
  stars); give the daily its OWN star currency that converts to a spendable resource (5 daily stars → 1
  **hint token**, a token reveals a stuck level's solution — capped to ★ so it's for progress, not farming).
  One mode feeds the next; nothing is a dead end. Every number is derived from the solver, never invented.

## Not gated here (honest boundary — no silent claims)
Subjective "fun" is not fully machine-provable. We do NOT claim it. What the factory now DOES enforce:
the human-cognition-fit critic (Stage 0) rejects provably human-hostile mechanics; this gate enforces the
on-ramp floor + structural depth; the shell/`ux_audit` enforce visual comprehension. What remains genuinely
unprovable — the last mile of "is it *delightful*" — is **not** silently asserted: the autonomous run does
NO human playtest, so the **ship report explicitly recommends a human first-look** before any release. The
old wording ("a human first-look protocol covers the rest") was dishonest — no such protocol runs inside an
autonomous build; the gap is now named in the output instead of assumed away.

## CREDITS / provenance
Concept distilled from `fagemx/gstack-game` (MIT) — its `/build-playability-review` and `/feel-pass`
diagnostic dimensions — and re-expressed as measured oracle metrics. **Nothing installed, cloned, or
mirrored** (per the machine's plugin/agent-platform policy); this is our own authored gate.
