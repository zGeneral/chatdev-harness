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

## Not gated here (honest boundary)
Subjective "fun" and visual/audio *feel* are not mechanically provable — gstack scores them by judgment;
we don't claim them. This gate certifies the **structural** playability the oracle CAN measure. The shell
stage's design grounding (`game-ui.md`) and the human first-look protocol cover the rest.

## CREDITS / provenance
Concept distilled from `fagemx/gstack-game` (MIT) — its `/build-playability-review` and `/feel-pass`
diagnostic dimensions — and re-expressed as measured oracle metrics. **Nothing installed, cloned, or
mirrored** (per the machine's plugin/agent-platform policy); this is our own authored gate.
