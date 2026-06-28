# Bleedweave — PARKED: a known "machine-fit, human-unfit" example

Status: **parked** (built, will not be promoted). Kept as the canonical anti-example the
human-cognition-fit gate (`graphs/oracleforge/design/human-fit.md`) calibrates against. Build lives at
`out/factory/bleedweave/` (playable, fully tested) — preserved as evidence, not a product.

## What it is

A precedence-DAG over a non-commutative blend fold. Each active row and column is a colored ribbon; where
two cross, the cell shows `r⊕c` or `c⊕r` depending on which ribbon was woven first, under an **arbitrary
non-commutative 6×6 blend table** `⊕`. Goal: pick a weave ORDER so every crossing matches its target. The
exact solver derives one precedence edge per cell and topo-sorts the DAG.

## Why it passed every machine gate

- Oracle-fit council: 3/3 `fit` (determinism, search-completeness, tractability) — it hosts an exact,
  poly-time solver. **That is exactly the problem: the entry filter rewards machine-solvability.**
- Playability gate: PASS on every structural threshold — `out/factory/bleedweave/playability.json` shows
  unique-optimal **100%**, greedy-regret **100%**, soul-necessity **100%**, par span 6, 2 technique tiers.
- It is correct, deterministic, deep, unique, and the signature technique is load-bearing.

## Why it is not fun (the human verdict)

From the first real human play-through:
> "mentally very difficult for humans… meant for machines and AI… the mental model is hard to grasp… not
> fun… even at 2×2 it is not fun… do not expect players to know the color mixing off the top of their
> head, nor to be able to track all the weave/knot orders."

Root causes (see `design/human-fit.md` for the general checks):

1. **Arbitrary-mapping recall.** `⊕` is a finite lookup table *deliberately* chosen to be non-commutative
   and non-intuitive (SPEC G2/G3). Real colour intuition (blue + yellow = green) is unavailable by design,
   so every crossing is a table lookup the player can't internalise. The "colour mixing" theme *promises*
   an intuition the rule then *violates* — worse than no theme.
2. **Unbounded mental tracking.** Solving is "compute the global weave ORDER of all the ribbons" — a
   topological sort the player must run in their head. That exceeds human working memory; it's an algorithm,
   not an insight.
3. **No on-ramp.** The shipped pack is `medium:7 / hard:14`, **zero easy**; par starts at 4. The 2×2 is
   already a chore, so scaling up only worsens it.

## What the factory learned (fixes shipped)

The investigation ("what went wrong") found the factory had **no signal for fun** and an entry filter that
*selects against* it. Fixes:

- **`critic_human` (Stage 0)** — a fourth oracle-fit-council critic reviews HUMAN-cognition fit
  (intuitive substrate / bounded working memory / legible state / fun-early) against `design/human-fit.md`;
  a `human-unfit` verdict is a hard NO-GO. This would have parked Bleedweave **before any build**.
- **Playability gate on-ramp floor** — `design/playability.md` now requires a genuine easy/teaching band
  (absolute difficulty floor), not merely a par *spread*.
- **Honest ship caveat** — the ship report explicitly recommends a human first-look; fun is never silently
  claimed (autonomous runs do no human playtest).

## The one-line lesson

Exactly-solvable-by-a-machine and fun-for-a-human are different axes; an entry filter that optimises the
first will, left alone, select against the second. Gate human-cognition fit at the door.
