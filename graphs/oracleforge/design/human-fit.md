# Human-cognition fit — "is this fun and GRASPABLE for a person, not just solvable by a machine?"

The factory's oracle-fit council (determinism / search-completeness / tractability) certifies that a
**machine** can exactly solve and verify the puzzle. That filter is necessary — but it selects FOR
machine-shaped mechanics and says NOTHING about whether a *human* can hold the mental model or enjoy it.
A puzzle can be deterministic, exactly-solvable, unique-optimal, and deep — and still be a joyless
algorithm-execution chore. This charter is the missing fourth lens: **human-cognition fit.** The
`critic_human` node reviews every idea against it BEFORE any build, and the synthesizer treats a
`human-unfit` verdict as a hard NO-GO (parked, not built).

## The cautionary example (calibrate against this)

**Bleedweave** — `out/factory/bleedweave/`, postmortem in
`graphs/oracleforge/examples/bleedweave-postmortem.md`. It passed every machine gate (100% unique-optimal,
100% greedy-regret, soul load-bearing 100%) and is **not fun**. Its core operation is: per crossing,
look up `r⊕c` vs `c⊕r` in an **arbitrary non-commutative 6×6 table** the player cannot internalize, derive
a precedence edge, then **topo-sort the precedence DAG in your head**. That is a CS algorithm wearing a
color-mixing costume. Two human-cognition failures, in the player's own words:
> "do not expect players to know the color mixing off the top of their head, nor to be able to track all
> the weave/knot orders."

Both are dealbreakers below. When in doubt, ask: *"would this idea fail the same way Bleedweave did?"*

## The four checks (hostile review — cite the specific break)

1. **Intuitive substrate (NO arbitrary-mapping recall).** The core operation must rest on intuition a
   player ALREADY has — physics, gravity, space, adjacency, counting, containment, real subtractive
   colour-mixing, everyday metaphor. It must NOT require memorising or recalling an **arbitrary lookup
   table / non-obvious mapping** (e.g. "red then blue = green but blue then red = yellow, per this table").
   - **AUTO-UNFIT:** the rule that decides a cell/outcome is an arbitrary table the player must learn by
     heart. (Showing the table on-screen mitigates *legibility* but the moment-to-moment is still
     table-lookup busywork, not insight — heavily penalise.) A theme that *implies* an intuition the rule
     then violates (Bleedweave's "colour mixing" that isn't real mixing) is WORSE than no theme.

2. **Bounded working memory (NO "track it all in your head").** Choosing a good move must not require the
   player to mentally simulate or hold a long sequence / ordering / many simultaneous hidden states.
   Everything needed to reason about the next move should be **VISIBLE on the board**, not carried in the
   head. Rough ceiling: a person reasons over ~3–4 chunks at once (Miller). A mechanic whose solution is
   "compute the global order of N interacting things" is machine-fit, human-unfit.
   - **AUTO-UNFIT:** the player must track an ordering/permutation of more than ~4 elements, or simulate
     the full consequence chain mentally, to know whether a move is good.

3. **Legible state & move.** A glance must read (a) the current state, (b) the goal, and (c) what a candidate
   move *does*, without running an algorithm in your head. The consequence of a move should be **previewable
   or obvious**, not "submit the whole plan then find out."

4. **Learnable fast + fun early.** A newcomer should grasp the loop in ~30 seconds and feel a satisfying
   decision by the 2nd or 3rd move — **including at the smallest size**. If the smallest instance is already
   a chore (Bleedweave's 2×2 is), scaling up only makes it worse. There must be a real *choice* with
   legible stakes early, not "there's one computable answer, go find it by executing the procedure."

## Verdict

Begin the review with EXACTLY one line:
- `VERDICT: human-fit` — clears all four; a person can grasp and enjoy it.
- `VERDICT: redesign` — fails one or more but a concrete survivable change fixes it (name it: a more
  intuitive substrate, a memory-relieving always-visible state, a smaller decision unit, an easy on-ramp).
  The synthesizer MUST fold an adopted redesign into the frozen SPEC (substrate, working-memory relief, and
  an explicit easy on-ramp band in the Difficulty seed).
- `VERDICT: human-unfit` — the *core* is machine-shaped (arbitrary-mapping recall and/or unbounded
  mental tracking) and no costume fixes it. Park it (the council returns NO-GO). Killing a machine-fit /
  human-unfit idea BEFORE any build is the factory working correctly.

Then list the specific BREAKS (which check, why) and any SURVIVABLE-WITH redesigns. Be adversarial and
concrete — the goal is to never ship another Bleedweave.

## Honest boundary

This lens raises the floor; it does not *prove* fun (nothing mechanical can). It rejects the mechanics that
are provably hostile to human cognition, and forces an intuitive substrate + bounded memory + an on-ramp.
True fun still wants a human first-look — which the ship report must explicitly recommend, never silently
claim (the factory runs autonomously, so no human playtest happens inside the run).
