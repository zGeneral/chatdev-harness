// Baffle — golden-trace fixtures (hand-searched, census-confirmed).
// Each board is pinned in the frozen SPEC's Golden Trace section. Edge keys use the
// canonical edgeKey(x,y,dir). Do NOT renumber — engine.test.js asserts exact pars,
// counts, traces against these. Boards were found by exhaustive small-board search
// (scratchpad) and cross-checked against the brute-force enumerator (R-AUDIT).
import { edgeKey, N, E, S, W } from './engine.js';

// 1) GT-CATCH — the soul demo. Single mover; null run LOOPS the perimeter (cycle
//    FAIL); the UNIQUE par-1 wall sits on the LEFT edge BEHIND/BESIDE the stream
//    (never in front of the mover), and the right-hand turn-rule banks the whole
//    path around into the sink. solver == brute (par 1, count 1, unique).
export const GT_CATCH = {
  level: {
    width: 4, height: 4,
    movers: [{ x: 0, y: 0, facing: E }],
    sinks: [[2, 0]],
    prewalls: [edgeKey(1, 0, E), edgeKey(3, 1, S)],
    k: 2,
  },
  par: 1,
  solution: [edgeKey(0, 0, S)],           // 0,0|0,1 — behind/beside, not in front
  unique: true,
};

// 2) GT-FRONTIER — frontier-recompute is load-bearing (B2). Global (trace-global)
//    solver finds par 2 using an edge (2,0|3,0) UNFACED in the null run; the
//    null-run-FROZEN frontier goes false-UNSAT (par === null). solver == brute.
export const GT_FRONTIER = {
  level: {
    width: 5, height: 5,
    movers: [{ x: 0, y: 0, facing: E }],
    sinks: [[3, 1]],
    prewalls: [edgeKey(1, 0, E), edgeKey(1, 1, E)],
    k: 3,
  },
  globalPar: 2,
  globalSolution: [edgeKey(0, 0, E), edgeKey(2, 0, E)], // 0,0|1,0 , 2,0|3,0
  unfacedEdge: edgeKey(2, 0, E),          // 2,0|3,0 — never faced in the null run
};

// 3) GT-JOINT — ≥2-mover shared wall, greedy fails (R-REGRET). Two movers, one
//    sink; the UNIQUE par-2 set is load-bearing for BOTH movers (removing either
//    wall fails delivery for both). solver == brute (par 2, count 1, unique).
export const GT_JOINT = {
  level: {
    width: 4, height: 4,
    movers: [{ x: 1, y: 3, facing: E }, { x: 3, y: 3, facing: E }],
    sinks: [[0, 3]],
    prewalls: [edgeKey(3, 2, S)],
    k: 4,
  },
  par: 2,
  solution: [edgeKey(1, 3, E), edgeKey(1, 0, E)], // 1,3|2,3 , 1,0|2,0
  unique: true,
};

// 4) S-ABLATE — the soul test. On GT_JOINT, swap the wall actuator for drove's
//    arrow actuator (stamp a heading) over the SAME fixed terrain and SAME R6 tick
//    pipeline. The wall actuator needs par 2 (shared deflection); the arrow actuator
//    solves in par 1 (one stamped heading points a mover straight at the sink). The
//    pars DIFFER — the wall-only "shared deflection" line is no longer the optimum,
//    proving the fixed turn-rule as the SOLE steering is the spine, not a skin.
//    (Uses GT_JOINT.level — wallPar 2 vs arrowPar 1.)
export const S_ABLATE = { level: GT_JOINT.level, wallPar: 2, arrowPar: 1 };

// 5) S-PRUNE — no partial-soft-lock prune (R-PRUNE). Two movers; the UNIQUE par-2
//    solution's wall 0,0|0,1 ALONE FAILs (boxes a mover) and 1,0|2,0 alone cycles,
//    yet the PAIR wins. The solver must NOT prune the failing-singleton subtree.
//    solver == brute (par 2, count 1, unique).
export const S_PRUNE = {
  level: {
    width: 4, height: 4,
    movers: [{ x: 1, y: 0, facing: E }, { x: 3, y: 0, facing: E }],
    sinks: [[3, 1]],
    prewalls: [edgeKey(3, 0, S)],
    k: 3,
  },
  par: 2,
  solution: [edgeKey(1, 0, E), edgeKey(0, 0, S)], // 1,0|2,0 , 0,0|0,1
  failingSingleton: edgeKey(0, 0, S),     // 0,0|0,1 — FAILs (boxed) on its own
  cyclingSingleton: edgeKey(1, 0, E),     // 1,0|2,0 — cycles on its own
  unique: true,
};

// 6) S-COUNT — exhaustive trace-hash count (B3/R-COUNT).
//    (a) DIFFERENT-trace: two distinct par-2 sets inducing DIFFERENT traces →
//        countSolutions returns 2 (equal-cardinality subset domination did NOT
//        collapse it). solver == brute (par 2, count 2).
export const S_COUNT_DIFF = {
  level: {
    width: 4, height: 4,
    movers: [{ x: 1, y: 3, facing: E }, { x: 2, y: 3, facing: S }],
    sinks: [[0, 2]],
    k: 3,
  },
  par: 2,
  count: 2,
};
//    (b) SAME-trace: adding an INERT wall (an edge no mover faces) to a winning set
//        yields a BYTE-IDENTICAL induced trace → such sets MUST dedup to 1. We pin
//        this on GT_CATCH: {0,0|0,1} and {0,0|0,1, 2,2|2,3} induce the same trace.
export const S_COUNT_SAME = {
  level: GT_CATCH.level,
  baseSolution: [edgeKey(0, 0, S)],       // 0,0|0,1
  inertWall: edgeKey(2, 2, S),            // 2,2|2,3 — never faced; trace-invariant
};

// 7) BOXED — a single wall boxes a mover (all four directions blocked) → FAIL (R2).
export const BOXED = {
  level: {
    width: 3, height: 3,
    movers: [{ x: 0, y: 0, facing: E }],
    sinks: [[2, 2]],
    prewalls: [edgeKey(0, 0, E)],
    k: 3,
  },
  boxingWall: edgeKey(0, 0, S),           // 0,0|0,1 — N,W border + E pre + S walled
};

// 8) CYCLE — the null run of GT_CATCH loops the perimeter forever → cycle FAIL.
//    (Uses GT_CATCH.level with the empty wall set.)

// D-ONRAMP — an EASY teaching board where the INTUITIVE front-wall move IS the
//    answer (par-1), exempt from R-REGRET, ordered first in the shipped pack.
//    Mover (0,0) facing E in a small grid; null run sails past; a wall on the edge
//    DIRECTLY AHEAD of the mover banks it into the sink in one move.
export const D_ONRAMP = {
  level: {
    width: 3, height: 3,
    movers: [{ x: 0, y: 0, facing: E }],
    sinks: [[1, 1]],
    k: 1,
  },
  // solution discovered/verified by the census; the front-wall edge (0,0|1,0) is
  // the intuitive move and must be among the par-1 winners.
  frontWall: edgeKey(0, 0, E),            // 0,0|1,0 — directly ahead of the mover
};
