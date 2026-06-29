---
name: Baffle
slug: baffle
source: novel:drove
oracle_fit: yes                # 3/3 oracle critics "fit" (determinism, search-completeness, tractability) + human-fit
council: GO
human_fit: human-fit           # critic_human cleared all four checks (redesigns folded below)
archetype: budgeted-wall-edit-over-a-fixed-turn-rule   # sculpt a maze, the fixed right-hand rule routes the herd; exact IDDFS-on-wall-count
soul: undirected coarse control via the fixed turn-rule — a wall only FORBIDS one edge and the immutable right-else-left-else-reverse rule then PICKS the exit, so a single wall deflects movers from BOTH adjacent cells and can manufacture a dead-end that reverses a mover; the unique solution often needs a wall placed BESIDE or BEHIND the stream, never in front. Replace the turn-rule with a player-stamped heading (revert to drove's arrows) and every "wall beside/behind" line, both-sides deflection, manufactured dead-end, and dual-purpose wall vanishes — the puzzles do not re-solve, they collapse to point-and-aim.
frozen: true
ceiling: 8x8 / k<=6 / movers<=3 / hunters<=2
---

# Baffle — Frozen Build Spec

High concept (≤20 words): sculpt a maze with up to k walls; a herd streams in by
the fixed turn-rule and must all reach a sink.

## THE SOUL (the single load-bearing technique — ablation-tested)

The player has **no way to point a mover.** Their entire budget is **k wall
segments on interior grid edges**, placed before Run. A wall only **FORBIDS** the
edge it sits on; the **fixed turn-rule** — *advance ahead; if blocked turn right
(90° CW), else left, else reverse* — then **chooses** the mover's exit. The
mechanic is **undirected coarse control**: you cannot aim, you can only deny the
wrong exits until the rule selects the right one. From this single inversion fall
four techniques arrows make impossible:
- **both-sides deflection** — one wall deflects movers arriving from *either*
  adjacent cell (an arrow points one way only);
- **manufactured dead-ends** — a wall can carve a pocket whose only rule-exit is
  *reverse*, turning a mover around for free (a placeable resource, not found
  terrain);
- **dual-purpose wall** — one segment can redirect mover A (block its forward
  edge) AND reverse mover B arriving from the opposite cell;
- **THE CATCH** — the obvious move (wall a mover's wrong exits so it "points" at
  its sink) is the *wrong* model. Because a wall only forbids and deflects from
  both sides, the unique solution often needs a wall placed **beside or behind**
  the stream, banking the whole herd around a corner via handedness or a
  manufactured dead-end — **never a wall directly in front of any single mover.**

This is the one technique the game is built around, and it is load-bearing, not
decorative. **Ablation (S-ABLATE, frozen test):** re-introduce drove's
direction-override arrow as the player's move object (stamp a heading instead of
forbid an edge). Now every mover can be pointed directly; both-sides deflection,
manufactured dead-ends, the dual-purpose wall, and every "wall beside/behind the
stream" line **vanish** — the pinned Tier-0 catch board either solves at a
different (lower) par by pointing each mover, or its unique wall-only line is no
longer the optimum. The test asserts par/solvability of a pinned board **differs**
between the wall actuator and an arrow actuator — proof the turn-rule-as-sole-
steering is the spine, not a skin.

## Council outcome — COUNCIL: GO

Four independent verdicts, **zero NO-GO triggers** (no `human-unfit`; 0 of 3
oracle critics "unfit"):

- **mechanics-critic / determinism (`fit`).** The run is a pure deterministic
  function of the wall set; ticks discrete, no floats, finite hashable state,
  cheaply copyable. Three real BREAKS landed and are folded below as frozen fixes:
  the false "boxing detectable at bake time" clause is **struck** (B1 → R2 fix);
  the frontier-recompute is **golden-trace-pinned**, not merely asserted (B2 →
  GT-FRONTIER); par-level solution counting is made **exhaustive, trace-hash
  deduped, no equal-cardinality subset domination** (B3 → R-COUNT).
- **search-completeness critic (`fit`).** The faced-edge prune is sound **only**
  under two redefinitions, both frozen: the frontier is **trace-global**
  (every interior edge any mover faces-into OR slides-parallel-past at ANY tick of
  the current partial trace — lateral + behind + ahead, not just the cell directly
  ahead) so the spec's headline "wall beside/behind the stream" line is reachable
  (R-FRONTIER); and prefix-pruning on a **partial** soft-lock is **forbidden** —
  prune only on whole-world dead states (R-PRUNE). Irredundancy moves **strictly to
  certification, never into the search** (R-COUNT). A brute-force completeness audit
  is added to the census (R-AUDIT).
- **tractability critic (`fit` at the ceiling, instrumented).** Move space is a
  small, well-shaped unordered budgeted-k edge set (`C(≤112, ≤6)`, no ×4 facing,
  monotone-additive). Termination is sound and free (full-state cycle hash). The
  real cost is **re-simulation × node-budget** and the **thin-manifold right tail**
  of full-budget aborts — so three instruments are **mandatory before any bake**
  (R-INSTRUMENT): record max ticks-to-halt; assert ZERO `maxNodes` overflows
  (tri-state-honest uniqueness); report the per-board node-count distribution, not
  the mean. If overflows are nonzero, narrow to Regime-A before widening.
- **critic_human / human-cognition fit (`human-fit`).** The substrate is
  maze-build-and-watch-it-flow — universal spatial intuition (ChuChu, marble runs),
  the structural **anti-Bleedweave**: no arbitrary table, no in-head topo-sort,
  working memory externalized onto the board. Three PARTIAL-grade redesigns are
  **folded into the frozen spec** (they touch UI and the generator's on-ramp band
  only — **zero** oracle-invariant changes): a persistent **null-run overlay**
  (U1), an explicit **easy teaching band** that opens with the intuitive move being
  the correct move (D-ONRAMP), and **handedness taught visibly, never recalled**
  (D-ONRAMP + U1).

Every adopted SURVIVABLE-WITH / redesign is folded below as a **frozen rule** or a
**frozen test**. Nothing is left to prose.

---

## Frozen rules (axioms — keep TINY)

- **R1 — Board.** A walled grid: border fully walled; some interior edges
  pre-walled; ≥1 self-driving **mover** (cell + facing); ≥1 **sink**; ≥0 optional
  **hunter** (cell + facing). No floats, no hidden fields, no RNG in the rule layer.
  (Inherited from drove — P1.)
- **R2 — Fixed turn-rule is the ONLY steering (the engine).** Each tick a mover
  advances one cell ahead; if a wall blocks the cell ahead it turns by fixed
  priority **right, else left, else reverse**, where **right = 90° clockwise** from
  the mover's current facing (egocentric chirality fixed once, so builds cannot
  diverge). If all four directions are blocked the mover **stays put and is `boxed`
  = FAIL**. There are NO arrows. Deleting this rule (free movement) makes walls
  meaningless — it is the engine.
  **(FROZEN FIX, B1 — struck false clause.)** Boxing is reachable from **any** wall
  set, **player-placed walls included** (a player-placed wall can carve a dead-end
  that reverses a mover — insight 5 — and the same walls can over-wall a mover into
  a dead pocket — insight 10). The old claim that "boxing is only reachable via
  pre-walls and is therefore detectable at bake time" is **WRONG and struck**:
  boxing is a normal run-time FAIL caught by the all-four-blocked check, NOT bounded
  by the empty-board null run. The census **measures** the boxing/soft-lock rate; it
  never assumes it away.
- **R3 — Budget = k wall segments.** The player adds a multiset of ≤k walls onto
  placeable interior cell edges before Run. A wall blocks movement across that edge
  from **both** adjacent cells. Placing a wall on an edge that already carries a
  wall is **idempotent** (a no-op, never a double-spend). Deleting the budget
  (unlimited walls) collapses every puzzle (cage each mover trivially) — the
  scarcity of deflection IS the difficulty.
- **R4 — Wall-as-carrier FORBIDDEN (coupler firewall).** A wall only **blocks** an
  edge. It never carries, attracts, or guides a mover along its length; a mover
  turns ONLY because the cell ahead is blocked. This axiom keeps Baffle from
  sliding into a track-laying game.
- **R5 — Predators (optional content).** ≥0 hunters move by R2; a mover sharing a
  cell with a hunter is caught ⇒ FAIL. A mover and hunter **exchanging cells** in
  one tick is also a catch ⇒ FAIL. Hunters never deliver and never satisfy WIN —
  they only induce catches. Hunters are steered by the same walls — every wall is
  double-edged terrain.
- **R6 — Win predicate + fixed same-tick resolution order (total).** WIN = all
  movers delivered to a sink. The per-tick pipeline is fixed and total:
  (a) compute all intents from **pre-tick** state; (b) **collisions/catches first**
  — mover-swap, **≥2 movers converging into one cell**, mover↔hunter swap, and
  post-move co-occupancy all = FAIL (FAIL wins ties over delivery);
  (c) apply moves and **sink delivery** (a mover entering a sink is removed);
  (d) **cycle / boxed** checks. FAIL on any caught/boxed mover, or a no-progress
  **full-state cycle** (movers + hunters + facings + delivered repeats).
  Follow-into-a-just-vacated cell is legal.
- **R7 — Determinism.** No RNG anywhere in rules / generation / solving; no float,
  no wall-clock, no hash-ordered dict/set iteration in the rule layer. State is a
  **sorted** multiset of `(id, cell, facing)` over movers+hunters plus the
  delivered set; every traversal is indexed/ordered. Same board + same wall set →
  byte-identical trace and verdict on every client.
- **R8 — UI is presentation only.** Animation, wall-placement input, the null-run
  overlay (U1), and timing are UI; the rule layer consumes a discrete, unordered
  wall set. No continuous state can leak into determinism.
- **R-FRONTIER — The faced-edge frontier is TRACE-GLOBAL (FROZEN FIX, search-B1/2).**
  The solver branches on every placeable interior edge that ANY mover **faces into
  OR slides parallel past OR sits behind** at **ANY tick of the current partial
  trace** (lateral + behind + ahead) — **not** only the cell directly ahead at
  first visit. This is the ONLY formulation under which the soul's "wall beside/
  behind the stream" winning line is reachable; a cell-ahead-only frontier
  provably cannot find the game's own headline technique (false-UNSAT). Bound:
  O(trace length × movers) — still polynomial.
- **R-PRUNE — Prune ONLY on whole-world dead states (FROZEN FIX, search-B2).** A
  subtree may be pruned only when the **current wall set** yields a soft-lock/cycle
  that **no additional in-budget wall can resolve** — i.e. remaining budget = 0, OR
  the trapped mover's pocket has **zero placeable bordering edges** the rest of the
  budget could face. Pruning the instant **one** mover boxes is UNSOUND (a second
  wall can free it): a w1 that correctly deflects A but boxes B, with only w1+w2
  freeing B, must keep descending. Conservative cheap rule: prune at k-exhausted
  leaves, or boxed-pocket-with-no-placeable-bordering-edge only.
- **R-COUNT — Exact, exhaustive, irredundancy-AT-CERTIFICATION-ONLY (FROZEN FIX,
  B3 + search-B3).** (i) IDDFS deepens on **wall count**; first depth that wins is
  the minimal **par**. (ii) The irredundancy gate (remove any placed wall and the
  run breaks) and `countSolutions` run **only on completed winning configs, NEVER
  inside the search** — a wall that is redundant *at placement* but load-bearing
  after a later wall reroutes a mover lies on the only path to the win, so
  in-search irredundancy is incomplete. (iii) `countSolutions` **enumerates ALL
  minimal sets at the winning depth** and dedups **strictly on induced-trace hash**;
  **subset-domination pruning is DISABLED at equal cardinality** (two distinct par
  sets inducing *different* traces are genuine non-uniqueness and MUST both count —
  monotone-additivity does NOT license cross-trace subset domination). Uniqueness is
  **tri-state** (unique / not-unique / unknown-aborted); a verdict certified under a
  `maxNodes` abort is **rejected**, never shipped as unique.
- **R9 — Ceiling (record, do not over-claim past it).** Grid **≤ 8×8** (≤ ~40
  active cells); wall budget / par **k ≤ 6**; **movers ≤ 3, hunters ≤ 2**. The
  blow-up term is the `(movers+hunters)` exponent in the state-space bound — it
  multiplies the **world response**, not the player move-space. Tier-2 (multi-hunter
  / one-way pre-walls) **re-runs the node-budget census and the completeness audit
  before admission** — one-ways re-add a facing factor and break monotonicity, so
  they are parked.

---

## Generator / census rules (FROZEN — yield is the BINDING risk, not the solver)

A wall is a **blunter** instrument than an arrow (forbids one edge, lets the rule
pick the rest), so the uniquely-solvable manifold may be **thin** — "rare-but-
unique," the *opposite* of a multi-solution blow-up. The solver is exact; the bind
is generator yield (lessons 32/36). Generation is **probe-confirmed, never
self-certified**:

- **G1 — Null run first.** The turn-rule fixes every arrow-free trajectory; a fresh
  board's null run leaves some movers missing / looping / colliding ⇒ defaults to
  FAIL. Walls are added only where the null run misses, collides, or loops. Reject
  any board whose null run already WINs (par 0, no choice).
- **G2 — Probe density > 0 BEFORE any bake (FROZEN, the recorded ceiling).** Run
  ERA over (par, mover-count) × (near-miss deliveries, handedness-forced walls) on
  a concrete hand-traced multi-mover board (the lessons:ideation UNWINNABLE-board
  trap). Expect a **band below the ~70% norm** — rare-but-unique is *expected* and
  accepted. If a probe comes back empty, fall to **Regime-A** (dense pre-walls +
  few load-bearing gaps → shorter traces → smaller faced frontier → fewer nodes)
  before widening.
- **R-AUDIT — Completeness audit vs ground truth (FROZEN, search-completeness
  condition).** On the smallest multi-mover board, run the pruned trace-global
  IDDFS against a **brute-force all-`C(E,k)`-subsets** enumerator and **assert
  identical (par, solution-count)**. Divergence = the frontier/prune is incomplete
  → fail the census. The census measures yield/uniqueness/regret AND **solver
  completeness against ground truth** — the latter is the gate for the false-UNSAT
  risk.
- **R-INSTRUMENT — Mandatory tractability instrumentation (FROZEN, tractability
  condition).** Across 100% of census boards: (1) record **max ticks-to-halt** and
  assert it stays well under the cycle-hash state-space bound (the "runs are short"
  claim is **measured**, never assumed); (2) assert **ZERO `maxNodes` overflows** so
  every uniqueness verdict is tri-state-honest; (3) report the **per-board node-count
  distribution** (histogram, not mean) — the thin-manifold regime has a heavy
  right tail of full-budget aborts and throughput is set by that tail. Nonzero
  overflows ⇒ narrow to Regime-A before widening.
- **R-REGRET — Anti-greedy, MEASURED.** Reject boards solvable by walling each
  mover independently. Require ≥1 wall **load-bearing for ≥2 movers** (shared
  deflection) OR a handedness / manufactured-dead-end trick (a load-bearing wall NOT
  directly in front of any mover). The census emits the **joint distribution**
  (yield-in-band fraction, a low unique-optimal fraction, a high baseline-regret vs
  a greedy "wall each mover's near exits" player), not a single summary number.
  **EXCEPTION:** D-ONRAMP teaching-band boards are exempt from R-REGRET (see below).

---

## Oracle sketch (deterministic engine + exact solver)

- **State.** Per tick, the **sorted** multiset of every mover AND hunter
  `(id, cell, facing)` + the delivered set; a canonical hash for cycle detection +
  twin-run determinism (omitting facing or hunter state would false-positive cycles
  or miss real loops, so all of it is hashed). Finite ⇒ a full-state repeat is
  **guaranteed to fire** — the cycle hash is the run's terminator (every run halts
  in ≤ |state space| ticks), which makes each solver node's simulation provably
  finite. No arrow/charge state — simpler than drove. Cheaply O(1)-copyable;
  snapshot-undo trivial.
- **Move set.** A bounded assignment of ≤k walls to placeable interior edges — an
  **unordered** budgeted-k set (no ×4 facing factor, monotone-additive). The solver
  iterative-deepens on wall **count**.
- **Win predicate.** R6.
- **Solver (`solveWithStats`).** Lazy simulation-guided **IDDFS on wall count**:
  (a) simulate the current partial wall set to a full trace (R2/R6); (b) build the
  **trace-global** faced-edge frontier (R-FRONTIER) from that trace — recomputed
  after EVERY placement, **NEVER frozen from the null run**; (c) branch on each
  frontier edge; (d) prune a subtree ONLY on a whole-world dead state (R-PRUNE);
  (e) memoize on **wall-subset signatures** for revisited identical sets; finite
  `maxNodes`. First depth that delivers all movers is the minimal **par**. Returns
  `{ solution, par, traceHash, nodes, aborted }`. Irredundancy is **not** applied
  in-search (R-COUNT ii).
- **`countSolutions(cap=2)`.** Enumerates ALL minimal wall sets at the winning
  depth, dedups **strictly on induced-trace hash**, with **equal-cardinality
  subset-domination DISABLED** (R-COUNT iii). Early-exits at the second distinct
  induced trace → tri-state uniqueness. The wall-subset memo (search) and the
  trace-hash dedup (counting) are **different keys** — the count is a second pass,
  acceptably so at the ceiling.
- **Pruning argument (SOUND under the frozen fixes).** A wall's **direct** effect is
  local to its edge, but its **induced** downstream effect is global (it reroutes a
  mover and can change other movers' fates via timing). Therefore subset pruning
  rests on the direct-local claim **plus mandatory re-simulation** (R-FRONTIER),
  never on global locality; and dead-state pruning fires only when no remaining-
  budget wall can rescue the trapped pocket (R-PRUNE). The trace-global frontier
  reaches the "wall beside/behind the stream" line; R-AUDIT proves completeness
  against brute force at the smallest scale.
- **Deleted / forbidden accelerators (recorded strikes).**
  1. **No frozen null-run frontier** — the obvious "wall on an edge no mover faces
     is inert" optimization (insight 1) is UNSOUND if cached from the null run (a
     wall reroutes a mover onto a previously-unfaced edge). The frontier is
     recomputed per placement (R-FRONTIER).
  2. **No prefix-pruning on partial soft-locks** — pruning the instant one mover
     boxes is false-UNSAT; only whole-world dead states prune (R-PRUNE).
  3. **No in-search irredundancy gate** — it rejects intermediates on the only path
     to the win; irredundancy is certification-only (R-COUNT ii).
  4. **No equal-cardinality subset-domination** in `countSolutions` — it under-
     counts genuine non-uniqueness to 1 (R-COUNT iii).

---

## Golden trace (concrete, reproducible)

The smallest demos that prove the soul AND the frozen solver fixes matter.

1. **GT-CATCH (the soul demo — wall behind the stream).** A single-mover board
   whose unique par solution places a wall **beside or behind** the stream (never
   in front of the mover): the null run sails the mover past its sink; the par-1
   line walls the edge that would carry it *past* the sink, and the right-hand rule
   banks it in. `solveWithStats` returns this par; `simulate(board, thatWallSet)`
   delivers the mover → WIN.
2. **GT-FRONTIER (frontier-recompute is golden-trace-pinned, B2).** A board whose
   **unique par solution places a wall on an edge UNFACED in the null run** — the
   second wall only matters after the first reroutes a mover to face that edge.
   Remove the re-simulation (freeze the null-run frontier) and this board goes
   **false-UNSAT** or its par changes. The test asserts the trace-global solver
   finds it AND a null-run-frozen frontier does **not** — proof the recompute is
   load-bearing, not asserted.
3. **GT-JOINT (≥2-mover joint wall, R-REGRET).** A board whose par solution has
   ≥1 wall load-bearing for two movers (shared deflection), and whose greedy
   per-mover-walling player FAILs — proves anti-greedy depth.
4. **S-ABLATE (the soul test).** Swap the player's actuator from "forbid an edge"
   to drove's "stamp a heading" on the pinned GT-CATCH board; assert par/solvability
   **differs** (the arrow points the mover directly; the wall-only beside/behind
   line is no longer the optimum) — proof the turn-rule-as-sole-steering is the
   spine.
5. **S-PRUNE (whole-world-dead only, R-PRUNE).** A board where w1 deflects mover A
   correctly but boxes mover B, and only w1+w2 frees B; assert the solver does NOT
   prune the w1 subtree and finds the w1+w2 win — proof partial-soft-lock pruning is
   forbidden.
6. **S-COUNT (exhaustive trace-hash count, B3/R-COUNT).** A board with two distinct
   par wall sets inducing **different** traces both delivering all movers; assert
   `countSolutions` returns **2** (not-unique), i.e. equal-cardinality subset
   domination did not collapse it; AND a board with two distinct par sets inducing
   the **same** trace returns **1** (correctly deduped).
7. **S-AUDIT (completeness vs brute force, R-AUDIT).** On the smallest multi-mover
   board, assert the pruned trace-global IDDFS and the brute `C(E,k)` enumerator
   agree on **(par, solution-count)**.
8. **S-DETERMINISM (R7).** Twin-run: same board + same wall set → byte-identical
   trace hash and verdict.

---

## Content dimensions (where ALL depth lives)

Board mask + pre-walled edges; mover count and start facings; sink positions (+
optional colour matching); hunter count and starts; the **wall budget k**; the set
of placeable interior edges. Tiered: colour-typed movers/sinks; one-way pre-walls
(fixed, not player-placeable, **deferred**); a single hunter. Difficulty lives in
WHICH edges are load-bearing and how handedness / dead-ends interact — **never in
grid size**.

## UI groundings (FROZEN — folded from critic_human, presentation-only, no
oracle change)

- **U1 — Persistent null-run / last-run overlay (legibility relief, human check 3).**
  The engine already computes the null run (and every Run's trace); draw it on the
  board as **faint trajectory arrows** so the player reads a candidate wall's effect
  against a **visible baseline** instead of simulating it mentally. This converts
  "submit then find out" into "see the baseline, place against it, confirm." The
  overlay is pure UI (R8); it changes no rule and no oracle invariant. It also does
  most of the work of teaching handedness **visibly** (human check 1 watch-item):
  early boards let the player *observe* a creature banking right-before-left rather
  than recall it.

---

## Difficulty seed (MUST include a genuine EASY on-ramp / teaching band)

- **Default outcome.** A fresh board's null run leaves some movers missing /
  looping / colliding ⇒ defaults to FAIL; every wall must earn its place.
- **D-ONRAMP — explicit EASY teaching band (FROZEN, human check 4; the Bleedweave
  fix).** The Tier-0 ladder MUST **open** with **1–2 boards that teach handedness
  honestly before testing it**: single mover, **par-1 or par-2**, smallest size,
  where **a wall directly in front of the mover (the intuitive move) DOES work and
  visibly banks it into the sink.** These teaching boards are **EXEMPT from
  R-REGRET** and the par-≥2 / anti-greedy "structural minimum" — the obvious move
  is the correct move, so the player *sees* the right-hand rule fire (with the U1
  overlay) and grasps the loop and chirality in ~30s with a satisfying move-2.
  The anti-greedy / "wall beside-or-behind" / dual-purpose-wall / THE-CATCH boards
  are **deferred to AFTER** this band, so the catch lands as a **delightful
  subversion**, never an unexplained move-2 failure. A census assertion enforces:
  the shipped Tier-0 pack contains ≥1 board with par ≤ 2 whose intuitive
  front-wall move is the solution, ordered first.
- **Structural minimum (post-onramp boards only).** par ≥ 2 walls; ≥1 mover whose
  null run misses its sink; reject if the unique-trace count ≠ 1 (R-COUNT).
- **Anti-greedy (post-onramp, R-REGRET).** ≥1 wall load-bearing for ≥2 movers OR a
  handedness / manufactured-dead-end trick.
- **Near-miss band.** Boards whose 2nd-cheapest distinct trace delivers all-but-one
  mover (or lets one be caught one tick early) — the "so close" re-wall instant.
- **Technique ladder / tiers (each a versioned oracle-contract item):**
  **Tier 0 (ship first, oracle-complete):** OPENS with the D-ONRAMP teaching band
  (front-wall-works), THEN walled grid + autonomous movers + fixed turn-rule + wall
  budget + single sink, no hunters — teaches handedness (visibly, U1), then shared
  walls, manufactured dead-ends, THE CATCH.
  **Tier 1:** colour-typed movers/sinks; one hunter (geometric avoidance +
  double-edged walls).
  **Tier 2 (DEFERRED):** fixed one-way pre-walls; multi-hunter — re-verify the
  yield probe, the completeness audit (R-AUDIT), and the node-budget census (R9)
  before admitting.

---

## IMPLEMENTATION CONTRACT (canonical layout — every later stage MUST follow)

- **Language:** JavaScript **ESM**. `out/factory/baffle/package.json` =
  `{"type":"module"}`.
- **Engine + solver:** `out/factory/baffle/engine.js` — deterministic `simulate` /
  `evaluate` (the fixed turn-rule R2; the total same-tick resolution order R6; the
  chirality anchor right = 90° CW; idempotent walls R3; full-state cycle hash R7),
  plus the exact solver **`solveWithStats`** (lazy IDDFS-on-wall-count over the
  **trace-global** faced-edge frontier R-FRONTIER, dead-state-only pruning R-PRUNE)
  and **`countSolutions`** (exhaustive at par, **induced-trace-hash** dedup,
  equal-cardinality subset domination DISABLED, tri-state — R-COUNT). The names
  `solveWithStats` / `countSolutions` are **fixed**. **No frozen null-run frontier,
  no in-search irredundancy, no prefix-prune on partial soft-locks, no equal-
  cardinality subset domination** (the four recorded strikes). A brute
  `C(E,k)`-subsets enumerator may appear ONLY as a bounded small-board cross-check
  inside a `*.test.js`, never as the oracle.
- **Census:** `out/factory/baffle/census.js` — the generation-time gate: null-run
  reject (G1); probe density > 0 with Regime-A fallback (G2); the **completeness
  audit vs brute force** (R-AUDIT); the **mandatory instrumentation** — max
  ticks-to-halt, ZERO `maxNodes` overflows, per-board node-count histogram
  (R-INSTRUMENT); the anti-greedy joint distribution (R-REGRET); and the
  **D-ONRAMP teaching-band assertion** (≥1 par-≤2 front-wall-works board, ordered
  first, exempt from R-REGRET). Measured, not asserted.
- **Tests:** ALL tests are `node --test` files named
  `out/factory/baffle/*.test.js`. The canonical green gate, **from repo root**, is:
  ```
  ROOT="$PWD"; cd out/factory/baffle && node --test
  ```
  Exit 0 = green. Must include: **GT-CATCH** (wall behind the stream wins);
  **GT-FRONTIER** (trace-global solver finds the null-run-unfaced wall, a frozen
  frontier does NOT — B2); **GT-JOINT** (≥2-mover wall, greedy fails); **S-ABLATE**
  (arrow actuator changes par — the soul test); **S-PRUNE** (no partial-soft-lock
  prune — R-PRUNE); **S-COUNT** (different-trace par sets → 2; same-trace → 1 —
  B3/R-COUNT); **S-AUDIT** (pruned IDDFS == brute force on par & count — R-AUDIT);
  **S-DETERMINISM** (twin-run byte-identical — R7); a solver↔engine equivalence test
  (`solveWithStats`'s wall set actually WINs under `simulate`); the boxed/soft-lock
  FAIL and the full-state cycle FAIL; and the D-ONRAMP ordering assertion.
- **Later stages ADD modules and ADD `*.test.js` — never rename `engine.js`, never
  move tests.** Expected additions: `contract.js`, `baker.js`, `pack.json`,
  `codec.js`, shell (`index.html` / `app.js` / `sw.js` with the U1 null-run
  overlay), `worker.js`.

---

## Council verdict

- **CHOSEN: Baffle (budgeted-wall-edit over a fixed turn-rule)** — oracle_fit yes,
  human_fit human-fit. **4/4 positive verdicts, 0 NO-GO triggers** (no
  `human-unfit`; 0 of 3 oracle critics "unfit") → **COUNCIL: GO.** One load-bearing
  change off `drove`: delete the direction-override arrow; the player's whole object
  is a topological wall edit and the fixed turn-rule is promoted to the SOLE
  steering primitive. Pillar broken: P2 (the defining verb). Residual ≈ 50–55%
  (under the 60% bar). Net-new insights: handedness-as-cost, both-sides deflection,
  manufactured dead-ends, the dual-purpose wall, the monotone-additive lattice.
- **Frozen fixes folded in (every adopted SURVIVABLE-WITH / redesign):** struck the
  false "boxing detectable at bake time" clause — boxing is a run-time FAIL from any
  wall set (B1/R2); trace-global faced-edge frontier so the soul's headline line is
  reachable (search-B1/2 → R-FRONTIER); prune only on whole-world dead states, never
  a partial soft-lock (search-B2 → R-PRUNE); irredundancy strictly at certification,
  `countSolutions` exhaustive at par with induced-trace-hash dedup and
  equal-cardinality subset domination DISABLED (B3/search-B3 → R-COUNT); brute-force
  completeness audit in the census (R-AUDIT); mandatory tractability instrumentation
  — max ticks, zero overflows, node histogram (R-INSTRUMENT); and the human-fit
  redesigns — persistent null-run overlay (U1), explicit EASY teaching band where
  the intuitive front-wall move IS the answer (D-ONRAMP), handedness taught visibly
  not recalled (U1 + D-ONRAMP).
- **Pruning deleted (recorded strikes):** frozen null-run frontier (unsound — a wall
  faces a previously-unfaced edge); prefix-prune on partial soft-locks (false-UNSAT);
  in-search irredundancy gate (rejects the only path to the win); equal-cardinality
  subset domination in `countSolutions` (under-counts genuine non-uniqueness).
- **The genuine BREAKs, deferred & fenced:** ≥3 crossers analog has no Baffle
  equivalent, but **one-way pre-walls / multi-hunter** re-add a facing factor and
  break monotonicity → parked in Tier 2, re-vet the oracle + re-run census before
  admission (R9).
- **Recorded dissent / the recorded boundary:** **generator YIELD** is the binding
  risk, not solver validity — walls are blunt, the uniquely-solvable manifold is
  thin ("rare-but-unique," accepted below the ~70% norm). Probe density > 0 on a
  hand-traced board, accept the band, keep Regime-A as the loosen-starve escape
  (G2). The cold-audit nits (same-tick order, chirality anchor, re-simulation
  requirement, full-state cycle hash) are folded as R6/R2/R-FRONTIER/R7.
- **Open nits:** none.

## Deferred / next-game parking lot

- **Player-placeable one-way gates / removable walls** — break the additive-monotone
  lattice (removal is non-monotone; one-ways re-add a facing factor); defer and
  re-prove the move-space bound.
- **Tollgate** (sibling twist, benched): charged arrows that redirect the c-th
  crosser then decay to a wall — needs 4 rule-pins, ~60–65% residual.
- **Aftermath** (sibling twist, killed): tick-stamped retroactive arrows —
  fatally self-referential.
