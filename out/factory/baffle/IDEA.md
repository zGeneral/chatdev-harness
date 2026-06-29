---
title: Baffle
slug: baffle
source: novel:drove
oracle_fit: yes            # fit-with-a-ceiling — see Oracle sketch
status: spec-complete
captured: 2026-06-22
---

# IDEA — Baffle

> NOVEL twist of `drove` (ChuChu-like autonomous-stream routing). **One load-bearing change:**
> delete the direction-override arrows entirely; the player's whole budget is now **k WALL segments**
> placed on interior grid edges, and the population is steered SOLELY by the fixed turn-rule it was
> designed to route *around*. The verb flips from "stamp a heading" to "sculpt the maze"; the
> turn-rule is promoted from background nuisance to the only actuator. Distinct from coupler (budgeted
> TRACK tiles that *carry* one ordered train) by a hard firewall: a Baffle wall only **blocks** an
> edge — it never carries or guides a mover along itself.

## One line
Add up to k wall segments to a walled grid, then run: every creature streams forward turning only by
the fixed rule (right, else left, else reverse), and you win when all reach a sink.

## The two invariants — the oracle gate *(oracle-first-design)*
- **Determinism:** plan-then-run, discrete ticks, no randomness, no hidden info, no continuous state.
  Walls are placed **before** Run and are **immutable during** it, so the twist introduces NO new
  play-time state or simultaneity hazard — the run is a pure deterministic function of the wall set.
  The base per-tick resolution (snapshot-simultaneous intents; the fixed FAIL-first collision/catch
  order; follow-into-just-vacated legal) is inherited and made total in Frozen rule 6 — covering
  mover-swap, **≥2-mover convergence**, and **mover↔hunter swap**. The turn-rule is total
  (right→left→reverse→boxed-FAIL, chirality fixed). One **rule-pin** the twist needs: placing a wall on
  an edge that already has a wall is **idempotent** (a no-op, never a double-spend).
- **Solver validity:** finite, SMALL move space — a **budgeted-k undirected edge subset** (keyspace
  `C(interior_edges, k)`, *smaller* than arrow-Drove: no ×4 facing factor). This is a polynomial
  family, categorically **NOT** a self-avoiding path — walls are an unordered set, so no path
  degradation is possible. Lazy pruning fact: **a wall on an edge that no mover ever faces into is
  inert** — it cannot change any run — so the search branches only on edges adjacent to the current
  partial run's visited cells in a faced direction; a soft-locked / cycling prefix prunes its subtree
  (the simulator is the pruner). The move lattice is **monotone-additive** (a wall only ever alters a
  path *at its edge*), so subset pruning is sound.
- **Verdict — `oracle_fit`: yes, WITH A CEILING.** The binding risk is **generator YIELD**, not
  certifier cost (lessons 32/36): a wall is a *blunter* instrument than an arrow (it FORBIDS one
  direction and lets the fixed rule pick the rest), so the uniquely-solvable manifold may be **thin**.
  This is the healthy "rare, not collapsed" regime (the bluntness makes solutions rarer-but-MORE-
  unique, the opposite of a multi-solution blow-up) — but it MUST be probe-confirmed density >0 before
  any bake. Honest boundary, recorded.

## Frozen rules (axioms — keep TINY)
1. **Walled grid + autonomous movers + sinks.** Border fully walled; some interior edges pre-walled;
   ≥1 self-driving "mover" (cell + facing); ≥1 "sink". (Inherited from drove — P1.)
2. **Fixed turn-rule is the ONLY steering.** Each tick a mover advances one cell ahead; if a wall
   blocks the cell ahead it turns by fixed priority — **right, else left, else reverse** (dead-end),
   where **right = 90° clockwise from the mover's current facing** (egocentric chirality fixed once,
   so builds can't diverge). If all four directions are blocked the mover **stays put and is `boxed`
   = FAIL**; because walls are immutable during a run, boxing is only reachable via pre-walls and is
   therefore detectable at bake time. There are NO arrows. Deleting this rule (free movement) makes
   walls meaningless — it is the engine.
3. **Budget = k wall segments.** The player adds a multiset of ≤k walls onto interior cell edges
   before Run. A wall blocks movement across that edge from **both** adjacent cells. Deleting the
   budget (unlimited walls) collapses every puzzle — caging each mover to its sink is then trivial;
   the scarcity of deflection IS the difficulty.
4. **Wall-as-carrier FORBIDDEN (coupler firewall).** A wall only blocks an edge. It never carries,
   attracts, or guides a mover along its length; a mover turns ONLY because the cell ahead is blocked.
   This is the axiom that keeps Baffle from sliding into a track-laying game.
5. **Predators (optional content).** ≥0 "hunters" move by rule 2; a mover sharing a cell with a hunter
   is caught ⇒ FAIL. A mover and hunter **exchanging cells** in one tick is also a catch ⇒ FAIL
   (symmetric to the mover-swap rule, since neither co-occupies a cell post-tick). Hunters never
   deliver and never satisfy WIN — they only induce catches. Hunters are steered by the same walls —
   every wall is double-edged terrain.
6. **Win predicate + same-tick resolution order.** All movers delivered to a sink. The per-tick
   pipeline is fixed: (a) compute all intents from pre-tick state; (b) **collisions/catches first**
   — mover-swap, **≥2 movers converging into one cell**, mover↔hunter swap, and post-move co-occupancy
   all = FAIL (FAIL wins ties over delivery); (c) apply moves and **sink delivery** (a mover entering
   a sink is removed); (d) **cycle / boxed** checks. FAIL on any caught/boxed mover, or a no-progress
   world-state cycle (a mover walled into an inescapable loop).

## Content dimensions (where ALL depth lives)
Board mask + pre-walled edges; mover count and start facings; sink positions (+ optional colour
matching); hunter count and starts; the **wall budget k**; the set of placeable interior edges.
Tiered board elements (later oracle-contract items): colour-typed movers/sinks; one-way pre-walls
(fixed, not player-placeable); a single hunter. Difficulty lives in WHICH edges are load-bearing and
how handedness/dead-ends interact — never in grid size.

## Aesthetic trace (MDA)
- **Aesthetic:** *Challenge* (the coarse-control aha — forbidding, not aiming) + *Discovery* (learning
  the turn-rule's handedness as a cost) + *Sensation* (the herd banking around a corner you carved).
- **Dynamics:** walls *compose* the turn-rule — you reason "I can't point this mover, but I can deny
  every wrong exit until the rule picks the right one"; the place→run→watch loop turns each soft-lock
  into a legible counterexample (a self-supplied hint).

## Insight sketch (axioms → theorems) *(insight-curriculum)*
≥12 derivable insights, scored as NET-NEW vs drove's catalog (lesson 33) and distinct from coupler:
1. A wall on an edge no mover ever faces is inert (edge-domain free-variable pruning, player-facing).
2. Solve the **null run first** — the turn-rule fixes every arrow-free trajectory; add walls only where
   the null run misses, collides, or loops.
3. **Turn-rule handedness (NET-NEW):** right-priority makes **clockwise deflections cheap and
   counter-clockwise expensive** — a learnable asymmetry that arrows made irrelevant in drove.
4. **Both-sides deflection (NET-NEW):** unlike a one-way arrow, a single wall deflects movers
   approaching from *either* adjacent cell — one segment, two streams.
5. **Manufactured dead-ends (NET-NEW):** a wall can carve a dead-end that **reverses** a mover for
   free — dead-ends become a *placeable resource*, not found terrain (drove only *found* them).
6. **Dual-purpose wall (NET-NEW):** one segment can redirect mover A (block its forward edge) AND
   reverse mover B arriving from the opposite cell — one placement, two mechanisms.
7. **Monotone-additive lattice (NET-NEW, solver-structural):** adding a wall never undoes a prior
   wall's effect except at its own edge — the move space is purely additive (arrows were non-monotone).
8. A wall is **undirected coarse control** — you cannot force an exact heading, only forbid one and let
   the rule choose; this bluntness is the central design tension (and the yield ceiling).
9. Final-approach funneling: to land a mover in a sink, wall the edges that would carry it *past* the
   sink, not the edge into it.
10. **Over-walling soft-locks:** too many walls cage a mover into a dead pocket or inescapable loop ⇒
    FAIL; walls cut both ways (drove's over-routing, but the failure is now boxing, not collision).
11. Retiming by detour: a wall that lengthens one mover's path changes *which tick* it reaches a shared
    cell — deconflicting two movers or dodging a hunter (drove's phase insight, now via geometry).
12. Hunters obey the maze you build: a wall that saves a mover can reroute a hunter into or out of its
    path — avoidance is authored as terrain, not stamped as a heading.
13. **THE CATCH (ten):** the obvious move is to wall off each mover's wrong exits so it points at its
    sink; the break is that a wall only FORBIDS (the right-hand rule then chooses) and deflects from
    BOTH sides, so the unique solution often needs a wall placed *beside or behind* the stream —
    exploiting handedness or a manufactured dead-end to bank the whole herd around a corner — never a
    wall directly in front of any single mover.

## Oracle sketch *(deterministic-engine, exact-solver)*
- **State:** per tick, the sorted multiset of **every mover AND hunter `(id, cell, facing)`** + the
  delivered set; canonical hash for cycle detection + twin-run determinism. Omitting facing or hunter
  state would false-positive cycles (early FAIL) or miss real loops (silent non-termination), so all
  of it is hashed. The state space is finite, so a full-state repeat is **guaranteed to fire** — the
  cycle hash is the run's terminator (every run halts in ≤ |state space| ticks), which is what makes
  each solver node's simulation provably finite. (No arrow/charge state — simpler than drove.)
- **Move set:** a bounded assignment of ≤k walls to placeable interior edges (the budgeted-k object).
- **Win predicate:** Frozen rule 6.
- **Pruning argument:** lazy simulation-guided IDDFS — iterative-deepen on wall count (first depth that
  wins is the minimal **par**); after EACH placement **re-simulate and recompute the faced-edge
  frontier from the resulting trace** before branching (the frontier is NOT frozen from the empty-board
  run — a wall reroutes movers and newly faces edges, so a frozen frontier would be UNSOUND, yielding
  false-UNSAT / false-uniqueness); branch only on edges the current partial trace's movers face into;
  soft-lock / cycle prefixes prune their subtree; memoize on wall-subset signatures; finite `maxNodes`.
  **Locality claim (precise):** a wall's *direct* effect is local to its own edge, but its *induced*
  downstream effect is global (it reroutes a mover and can change other movers' fates via timing) — so
  subset pruning relies on the direct-local claim **plus** mandatory re-simulation, never on global
  locality.
- **CEILING (record, do not over-claim past it):** grid **≤ 8×8** (≤ ~40 active cells); wall budget /
  par **k ≤ 5–6**; **movers ≤ 3, hunters ≤ 2**. Termination via base **world-state cycle detection**
  (walls only *add* turning, so they cannot create unbounded straight runs; cycles still possible and
  are caught). The blow-up term is the mover/hunter product — capped above.
- **Uniqueness key:** count distinct **induced run traces** (the per-tick configuration sequence),
  *never the raw wall set* (two walls on edges no mover faces must not count as distinct).
  `countSolutions(cap=2)` + an **irredundancy gate** (every placed wall must be faced AND load-bearing
  — remove it and the run breaks). Uniqueness must be **tri-state** (unique / not-unique /
  unknown-aborted); reject any candidate certified under a node-budget abort.
- **YIELD is the BINDING constraint (lesson 32/36):** wall bluntness risks a *thin* uniquely-solvable
  manifold. Before any bake, **probe** density >0 with ERA over (par, mover-count) × (near-miss
  deliveries, handedness-forced walls); expect a "rare-but-unique" regime — acceptable if probe-
  confirmed, and structurally safer than a multi-solution blow-up. If yield probes empty, narrow to
  Regime-A boards (dense pre-walls + few load-bearing gaps) before widening.

## Difficulty seed *(difficulty-contract)*
- **Default outcome:** the null run (no added walls) leaves some movers missing / looping / colliding
  ⇒ a fresh board defaults to FAIL; every wall must earn its place.
- **Structural minimum:** par ≥ 2 walls; ≥1 mover whose null run misses its sink; reject if the
  unique-trace count ≠ 1.
- **Anti-greedy / solo-union analog:** reject boards solvable by walling each mover's path
  independently — require ≥1 wall **load-bearing for ≥2 movers** (shared deflection) OR a
  handedness / manufactured-dead-end trick (a load-bearing wall NOT directly in front of any mover).
- **Near-miss band:** boards whose 2nd-cheapest distinct trace delivers all-but-one mover (or lets one
  be caught one tick early) — the "so close" instant the player re-walls.
- **Technique ladder / tiers (each a versioned oracle-contract item):**
  **Tier 0 (ship first, oracle-complete):** walled grid, autonomous movers, fixed turn-rule, wall
  budget, single sink, no hunters — teaches handedness, shared walls, manufactured dead-ends.
  **Tier 1:** colour-typed movers/sinks; one hunter (geometric avoidance + double-edged walls).
  **Tier 2 (DEFERRED):** fixed one-way pre-walls; multi-hunter — re-verify the yield probe + the
  ceiling before admitting.

## Deferred / Next-game parking lot
- **Player-placeable one-way gates / removable walls** — break the additive-monotone lattice (removal
  is non-monotone; one-ways re-add a facing factor); defer and re-prove the move-space bound.
- **Tollgate (sibling twist, benched by the council):** charged arrows that redirect the c-th crosser
  then decay to a wall — orthogonal and inverts drove's "order-irrelevant" axiom, but needs 4 rule-pins
  (same-tick enterer priority; charge read-at-tick-start / decrement-at-end; C_max ≤ 3; soft-lock yield
  probe) and sits at ~60–65 % residual similarity. A good future twist of `drove`, deliberately NOT
  blended in here (one bold bet, not a hedge).
- **Aftermath (sibling twist, killed):** tick-stamped retroactive arrows — fatally self-referential
  (a fired stamp changes the very trace its later stamps were authored against; the "single recompute"
  needs a non-convergent fixed point) and ~75 % residual. The one salvageable idea (per-cell temporal
  multiplexing) belongs as a mechanic *inside* drove, not as a twist.

## Provenance & fidelity
- **source: novel:drove** (itself researched from ChuChu Rocket!). **The load-bearing assumption
  changed:** drove's move object is a direction-OVERRIDE arrow (pillar P2) over a turn-rule you route
  *around* (P3 as nuisance); Baffle DELETES arrows and makes the player's object a **topological wall
  edit**, promoting the turn-rule (P3) to the SOLE steering primitive. Pillars broken: P2 (the defining
  verb). Residual similarity ≈ 50–55 % (under the 60 % bar). **New insights it opens:** turn-rule
  handedness-as-cost, both-sides deflection, manufactured dead-ends, the dual-purpose wall, and the
  monotone-additive move lattice — none present in drove's catalog.
- **Council verdict (2026-06-22):** proposer emitted 3 candidates (Aftermath / Conductor / Tollgate);
  the invariant adversary BROKE Aftermath (self-referential single-recompute + yield collapse) and
  found Tollgate BROKEN-unless-4-pins, while Conductor was the clean survivor (smallest keyspace,
  monotone lattice, free termination, only an empirical yield-density caveat); the orthogonality/insight
  critic ranked Conductor #1 on divergence (~50–55 %, breaks P2, 3–4 net-new insights) with one
  condition — **forbid wall-as-carrier semantics** or it collapses into coupler (folded in as Frozen
  rule 4). The synthesizer chose **Conductor → "Baffle"** as the single bold bet; benched Tollgate and
  killed Aftermath (recorded above). **Dissent carried forward:** the yield-density ceiling (walls are
  blunt → probe before bake) is the recorded boundary, not a guarantee.
- **Independent cold verifier (2026-06-22):** a fresh agent audited the chosen spec for internal
  consistency + the two invariants → FIT-WITH-CEILING. Its nits were folded in: same-tick resolution
  order (FAIL-first; ≥2-mover convergence; mover↔hunter swap), the fully-boxed terminus (bake-time
  detectable since walls are immutable), the chirality anchor (right = 90° CW), the **re-simulation
  requirement** that makes the faced-edge prune sound (the frontier is never frozen), the precise
  direct-local-vs-induced-global locality wording, and the full-state cycle hash (movers + hunters +
  delivered) as the guaranteed run terminator.
