// Baffle — FOUNDATION hardening suite (node --test).
//
// This file pins the three properties that make engine.js a trustworthy permanent
// core, beyond the per-board golden traces in engine.test.js:
//
//   (1) SOLVER<->ENGINE EQUIVALENCE — the solver never lies. Across a board zoo,
//       solveWithStats's returned wall set actually WINS under BOTH the recorded
//       engine (simulate) AND the fast path (evaluate); par == solution length; and
//       the solver's (par, distinct-trace-count) verdict matches an INDEPENDENT
//       brute-force C(E,k) oracle (bruteForce) — no winning line lost, no false
//       UNSAT, no over/under-count.
//
//   (2) PURITY — a tick is a pure function of (level, walls). The level object is
//       byte-identical before/after a run (no in-place mutation); repeated and
//       INTERLEAVED runs over deep-cloned inputs are identical (no carried state);
//       and every run is INVARIANT under a HOSTILE monkey-patch of Date.now /
//       Math.random / process.hrtime(+.bigint) / performance.now — proving no
//       wall-clock and no RNG leak into the rule layer (R7). Patches restored in a
//       finally so a failure here cannot corrupt the rest of the suite.
//
//   (3) TWIN-RUN determinism — same input -> identical frames. Byte-identical
//       recorded frames + trace hash across two deep-cloned level instances AND a
//       cache-busted DYNAMIC RE-IMPORT of engine.js (import('./engine.js?twin=N')),
//       proving there is no module-level mutable state hiding between runs.
//
// Does NOT rename engine.js and does NOT move any test (contract: later stages ADD
// *.test.js only).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulate, evaluate, solveWithStats, countSolutions, bruteForce,
  placeableEdges, edgeKey, N, E, S, W,
} from './engine.js';
import {
  GT_CATCH, GT_FRONTIER, GT_JOINT, S_PRUNE, S_COUNT_DIFF, D_ONRAMP,
} from './fixtures.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

// A small board ZOO spanning the engine's regimes: single-mover catch, frontier
// recompute, ≥2-mover shared deflection, partial-soft-lock descent, multi-solution
// (non-unique), an easy on-ramp, plus two UNSOLVABLE boards (par must be null and
// both oracles must agree on UNSAT — the "no false SAT" direction).
const ZOO = [
  { name: 'GT-CATCH',     level: GT_CATCH.level,     solvable: true  },
  { name: 'GT-FRONTIER',  level: GT_FRONTIER.level,  solvable: true  },
  { name: 'GT-JOINT',     level: GT_JOINT.level,     solvable: true  },
  { name: 'S-PRUNE',      level: S_PRUNE.level,      solvable: true  },
  { name: 'S-COUNT-DIFF', level: S_COUNT_DIFF.level, solvable: true  },
  { name: 'D-ONRAMP',     level: D_ONRAMP.level,     solvable: true  },
  // UNSOLVABLE A — a 1-wide corridor with the sink walled OFF behind a pre-wall the
  // budget cannot remove (walls only ADD edges; you can never reach the sink).
  {
    name: 'UNSOLVABLE-corridor',
    level: {
      width: 4, height: 1,
      movers: [{ x: 0, y: 0, facing: E }],
      sinks: [[3, 0]],
      prewalls: [edgeKey(1, 0, E)], // wall between the mover and the sink, immovable
      k: 3,
    },
    solvable: false,
  },
  // UNSOLVABLE B — a head-on hunter on a corridor catches the mover before it can
  // ever reach the sink; no wall placement (within budget) saves it.
  {
    name: 'UNSOLVABLE-hunter',
    level: {
      width: 3, height: 1,
      movers: [{ x: 0, y: 0, facing: E }],
      sinks: [[2, 0]],
      hunters: [{ x: 2, y: 0, facing: W }],
      k: 2,
    },
    solvable: false,
  },
];

// ───────────────────────── (1) SOLVER ↔ ENGINE EQUIVALENCE ─────────────────────────

test('FOUNDATION/equivalence: the solver never lies — its solution WINS under both engine paths, par is honest, and it agrees with the brute-force oracle', () => {
  for (const { name, level, solvable } of ZOO) {
    const s = solveWithStats(level);
    assert.equal(s.aborted, false, `${name}: solver must not abort at the ceiling`);

    if (solvable) {
      assert.ok(s.solution, `${name}: solvable board must yield a solution`);
      assert.equal(s.par, s.solution.length, `${name}: par == |solution|`);
      // the solution must WIN under BOTH the recorded and the fast engine path,
      // and the two paths must agree on the induced trace hash (one engine).
      const rec = simulate(level, s.solution);
      const fast = evaluate(level, s.solution);
      assert.equal(rec.outcome, 'win', `${name}: solver wall set WINS under simulate`);
      assert.equal(fast.outcome, 'win', `${name}: solver wall set WINS under evaluate`);
      assert.equal(rec.traceHash, fast.traceHash, `${name}: simulate/evaluate agree on the trace`);
    } else {
      assert.equal(s.solution, null, `${name}: unsolvable board yields no solution`);
      assert.equal(s.par, null, `${name}: unsolvable board has par null (no false SAT)`);
    }

    // INDEPENDENT ground truth: the brute-force C(E,k) enumerator. The pruned
    // trace-global IDDFS must match it on par AND the exact distinct-trace set —
    // no winning line lost (false UNSAT) and no lie certified (false SAT/par).
    const c = countSolutions(level, { cap: Infinity });
    const bf = bruteForce(level, { maxK: solvable ? c.par : (level.k != null ? level.k : 6) });
    assert.equal(c.par, bf.par, `${name}: par matches brute force`);
    assert.equal(c.rawCount, bf.count, `${name}: distinct-trace count matches brute force`);
    assert.deepEqual(c.traces, bf.traces, `${name}: the exact induced-trace set matches brute force`);
    if (solvable) {
      assert.equal(c.par, s.par, `${name}: countSolutions par agrees with solveWithStats par`);
    }
  }
});

// ───────────────────────── (2) PURITY ─────────────────────────

test('FOUNDATION/purity: a run does not mutate its level input (byte-identical JSON before/after)', () => {
  for (const { name, level } of ZOO) {
    const before = JSON.stringify(level);
    simulate(level, GT_CATCH.solution.filter((e) => placeableEdges(level).includes(e)));
    evaluate(level);
    solveWithStats(level);
    countSolutions(level, { cap: Infinity });
    const after = JSON.stringify(level);
    assert.equal(after, before, `${name}: the level object must be byte-identical after a run`);
  }
});

test('FOUNDATION/purity: repeated and INTERLEAVED runs over deep-cloned inputs are identical (no carried state)', () => {
  // Run the whole zoo once, recording trace hashes; then run it again but with a
  // FOREIGN run from a different board interleaved between every step — if any
  // hidden state carried across calls, the interleaving would perturb the result.
  const golden = ZOO.map(({ level }) => evaluate(clone(level)).traceHash);

  for (let i = 0; i < ZOO.length; i++) {
    // foreign noise between every call
    evaluate(clone(ZOO[(i + 1) % ZOO.length].level));
    simulate(clone(GT_JOINT.level), GT_JOINT.solution);
    solveWithStats(clone(GT_CATCH.level));
    const again = evaluate(clone(ZOO[i].level)).traceHash;
    assert.equal(again, golden[i], `${ZOO[i].name}: trace hash must be invariant under interleaved foreign runs`);
  }
});

test('FOUNDATION/purity: every run is INVARIANT under a hostile monkey-patch of the clock and RNG (no wall-clock, no RNG in a tick — R7)', () => {
  // Capture a clean baseline FIRST (un-patched).
  const baseline = ZOO.map(({ level }) => ({
    sim: simulate(clone(level)).traceHash,
    fast: evaluate(clone(level)).traceHash,
    solve: solveWithStats(clone(level)).par,
    count: countSolutions(clone(level), { cap: Infinity }).rawCount,
  }));

  // Save originals so we can restore them no matter what.
  const realNow = Date.now;
  const realRandom = Math.random;
  const realHrtime = process.hrtime;
  const realPerfNow = (typeof performance !== 'undefined') ? performance.now : null;

  try {
    // HOSTILE patches: every clock jumps wildly and RNG is adversarial. A pure rule
    // layer reads none of these, so every trace hash / par / count must be unchanged.
    let tick = 0;
    Date.now = () => (tick = (tick + 9973) % 1e9);
    Math.random = () => { tick = (tick * 1103515245 + 12345) & 0x7fffffff; return (tick % 1000) / 1000; };
    const hr = (prev) => { const s = (tick += 7); return prev ? [s, s * 1000] : [s, s * 1000]; };
    process.hrtime = Object.assign(hr, { bigint: () => BigInt(tick += 11) });
    if (realPerfNow) performance.now = () => (tick += 3);

    for (let i = 0; i < ZOO.length; i++) {
      const { name, level } = ZOO[i];
      assert.equal(simulate(clone(level)).traceHash, baseline[i].sim,
        `${name}: simulate trace invariant under hostile clock/RNG`);
      assert.equal(evaluate(clone(level)).traceHash, baseline[i].fast,
        `${name}: evaluate trace invariant under hostile clock/RNG`);
      assert.equal(solveWithStats(clone(level)).par, baseline[i].solve,
        `${name}: solver par invariant under hostile clock/RNG`);
      assert.equal(countSolutions(clone(level), { cap: Infinity }).rawCount, baseline[i].count,
        `${name}: solution count invariant under hostile clock/RNG`);
    }
  } finally {
    Date.now = realNow;
    Math.random = realRandom;
    process.hrtime = realHrtime;
    if (realPerfNow) performance.now = realPerfNow;
  }
});

// ───────────────────────── (3) TWIN-RUN DETERMINISM ─────────────────────────

test('FOUNDATION/twin: two deep-cloned instances of the same input produce byte-identical frames', () => {
  for (const { name, level } of ZOO) {
    const walls = solveWithStats(level).solution || [];
    const a = simulate(clone(level), [...walls]);
    const b = simulate(clone(level), [...walls]);
    // byte-identical recorded frames (deep), trace hash, tick count, outcome.
    assert.equal(JSON.stringify(a.frames), JSON.stringify(b.frames),
      `${name}: recorded frames must be byte-identical across instances`);
    assert.equal(a.traceHash, b.traceHash, `${name}: trace hash identical`);
    assert.equal(a.ticks, b.ticks, `${name}: tick count identical`);
    assert.equal(a.outcome, b.outcome, `${name}: outcome identical`);
  }
});

test('FOUNDATION/twin: a cache-busted dynamic re-import of engine.js yields byte-identical frames (no module-level mutable state)', async () => {
  // Importing engine.js a SECOND time with a fresh query string forces a brand-new
  // module instance. If any module-level binding accumulated state across the runs
  // above, the re-imported engine would diverge. It must not.
  const fresh = await import('./engine.js?twin=' + Date.now());
  for (const { name, level } of ZOO) {
    const walls = solveWithStats(level).solution || [];
    const original = simulate(clone(level), [...walls]);
    const reimported = fresh.simulate(clone(level), [...walls]);
    assert.equal(JSON.stringify(reimported.frames), JSON.stringify(original.frames),
      `${name}: re-imported engine produces byte-identical frames`);
    assert.equal(reimported.traceHash, original.traceHash,
      `${name}: re-imported engine produces the same trace hash`);
    // the fresh module's solver must also agree (no per-module solver drift)
    assert.equal(fresh.solveWithStats(clone(level)).par, solveWithStats(clone(level)).par,
      `${name}: re-imported solver agrees on par`);
  }
});
