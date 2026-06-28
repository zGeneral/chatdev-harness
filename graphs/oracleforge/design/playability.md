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
