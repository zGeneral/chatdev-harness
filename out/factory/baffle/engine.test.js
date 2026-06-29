// Baffle — engine + solver test suite (node --test).
// The canonical green gate (from repo root):  cd out/factory/baffle && node --test
// Covers every contract-mandated test: GT-CATCH, GT-FRONTIER, GT-JOINT, S-ABLATE,
// S-PRUNE, S-COUNT (diff & same trace), S-AUDIT, S-DETERMINISM, a solver↔engine
// equivalence test, the boxed/soft-lock FAIL, the full-state cycle FAIL, the
// win-predicate case, and (kept here as a unit) the D-ONRAMP front-wall-works case.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulate, evaluate, isWin, solveWithStats, countSolutions, bruteForce,
  simulateArrows, solveArrows, placeableEdges, edgeKey, hashTrace, N, E, S, W,
} from './engine.js';
import {
  GT_CATCH, GT_FRONTIER, GT_JOINT, S_ABLATE, S_PRUNE,
  S_COUNT_DIFF, S_COUNT_SAME, BOXED, D_ONRAMP,
} from './fixtures.js';

// ───────────────────────── GT-CATCH (the soul demo) ─────────────────────────
test('GT-CATCH: null run loops the perimeter (cycle FAIL), not a win', () => {
  const r = simulate(GT_CATCH.level);
  assert.equal(r.outcome, 'cycle', 'a fresh board must not already WIN (G1)');
});

test('GT-CATCH: unique par-1 solution is a wall BEHIND/BESIDE the stream', () => {
  const s = solveWithStats(GT_CATCH.level);
  assert.equal(s.par, GT_CATCH.par);
  assert.deepEqual(s.solution, GT_CATCH.solution);
  // the solving wall is NOT on the edge directly ahead of the mover at its start
  const m = GT_CATCH.level.movers[0];
  const frontEdge = edgeKey(m.x, m.y, m.facing);
  assert.ok(!s.solution.includes(frontEdge), 'the wall is beside/behind, never in front');
  // and that wall set actually WINs under the engine
  assert.ok(isWin(GT_CATCH.level, s.solution));
});

test('GT-CATCH: solution is unique (count 1)', () => {
  const c = countSolutions(GT_CATCH.level, { cap: 3 });
  assert.equal(c.unique, true);
  assert.equal(c.rawCount, 1);
});

// ─────────────────── GT-FRONTIER (recompute is load-bearing, B2) ───────────────────
test('GT-FRONTIER: trace-global solver finds the null-run-UNFACED wall', () => {
  const g = solveWithStats(GT_FRONTIER.level);
  assert.equal(g.par, GT_FRONTIER.globalPar);
  assert.deepEqual(g.solution, GT_FRONTIER.globalSolution);
  assert.ok(g.solution.includes(GT_FRONTIER.unfacedEdge),
    'the par solution uses an edge unfaced in the null run');
  // confirm the edge really is unfaced in the null run
  const faced = new Set();
  for (const f of simulate(GT_FRONTIER.level).frames)
    for (const u of f.units) if (!u.delivered)
      for (const d of [0, 1, 2, 3]) faced.add(edgeKey(u.x, u.y, d));
  assert.ok(!faced.has(GT_FRONTIER.unfacedEdge));
});

test('GT-FRONTIER: a null-run-FROZEN frontier goes false-UNSAT (proof the recompute matters)', () => {
  const frozen = solveWithStats(GT_FRONTIER.level, { frozenFrontier: true });
  assert.equal(frozen.par, null, 'frozen frontier cannot find the solution (false-UNSAT)');
});

// ─────────────────── GT-JOINT (≥2-mover shared wall, greedy fails) ───────────────────
test('GT-JOINT: unique par-2 with a wall load-bearing for BOTH movers', () => {
  const s = solveWithStats(GT_JOINT.level);
  assert.equal(s.par, GT_JOINT.par);
  assert.deepEqual(s.solution, GT_JOINT.solution);
  const c = countSolutions(GT_JOINT.level, { cap: 3 });
  assert.equal(c.unique, true);
  // removing EITHER wall breaks delivery (shared, anti-greedy depth)
  for (const w of s.solution) {
    const rest = s.solution.filter((e) => e !== w);
    assert.notEqual(simulate(GT_JOINT.level, rest).outcome, 'win',
      `removing ${w} must break the win — it is load-bearing`);
  }
});

test('GT-JOINT: a greedy per-mover-walling player FAILs at par', () => {
  // greedy union = edges incident to each mover's independent null path
  const L = GT_JOINT.level;
  const place = new Set(placeableEdges(L));
  const union = new Set();
  for (let i = 0; i < L.movers.length; i++) {
    const sub = { ...L, movers: [L.movers[i]] };
    for (const f of simulate(sub).frames) {
      const u = f.units[0];
      if (!u) continue;
      for (const d of [0, 1, 2, 3]) { const ek = edgeKey(u.x, u.y, d); if (place.has(ek)) union.add(ek); }
    }
  }
  const arr = [...union];
  let greedyWins = false;
  const idx = [];
  const rec = (start, depth) => {
    if (greedyWins) return;
    if (depth === GT_JOINT.par) { if (isWin(L, idx.map((i) => arr[i]))) greedyWins = true; return; }
    for (let i = start; i < arr.length && !greedyWins; i++) { idx.push(i); rec(i + 1, depth + 1); idx.pop(); }
  };
  rec(0, 0);
  assert.equal(greedyWins, false, 'greedy per-mover walling must not reach par');
});

// ─────────────────── S-ABLATE (the soul test) ───────────────────
test('S-ABLATE: swapping the wall actuator for an arrow actuator CHANGES par', () => {
  const wall = solveWithStats(S_ABLATE.level);
  const arrow = solveArrows(S_ABLATE.level, { maxArrows: 4 });
  assert.equal(wall.par, S_ABLATE.wallPar);
  assert.equal(arrow.par, S_ABLATE.arrowPar);
  assert.notEqual(wall.par, arrow.par,
    'the turn-rule-as-sole-steering is the spine: arrows collapse the par');
  assert.ok(arrow.par < wall.par, 'an arrow points a mover directly — strictly cheaper');
});

// ─────────────────── S-PRUNE (no partial-soft-lock prune, R-PRUNE) ───────────────────
test('S-PRUNE: a failing singleton does NOT prune — the pair still wins uniquely', () => {
  const L = S_PRUNE.level;
  // the failing singleton genuinely FAILs on its own ...
  assert.equal(simulate(L, [S_PRUNE.failingSingleton]).outcome, 'fail');
  assert.equal(simulate(L, [S_PRUNE.cyclingSingleton]).outcome, 'cycle');
  // ... yet the PAIR wins, and the solver (which must descend past the partial
  // soft-lock) finds exactly that par-2 unique solution.
  const s = solveWithStats(L);
  assert.equal(s.par, S_PRUNE.par);
  assert.deepEqual(s.solution, S_PRUNE.solution);
  assert.ok(isWin(L, S_PRUNE.solution));
  assert.equal(countSolutions(L, { cap: 3 }).unique, true);
});

// ─────────────────── S-COUNT (exhaustive trace-hash count, B3/R-COUNT) ───────────────────
test('S-COUNT (different trace): two distinct par sets → count 2 (no subset domination)', () => {
  const c = countSolutions(S_COUNT_DIFF.level, { cap: 3 });
  assert.equal(c.par, S_COUNT_DIFF.par);
  assert.equal(c.rawCount, S_COUNT_DIFF.count);
  assert.equal(c.unique, false);
  assert.equal(c.traces.length, 2, 'equal-cardinality subset domination did NOT collapse it');
});

test('S-COUNT (same trace): distinct sets inducing the SAME trace dedup to 1', () => {
  const base = S_COUNT_SAME.baseSolution;
  const withInert = [...base, S_COUNT_SAME.inertWall];
  // adding an inert (never-faced) wall yields a BYTE-IDENTICAL induced trace ...
  assert.equal(
    evaluate(S_COUNT_SAME.level, base).traceHash,
    evaluate(S_COUNT_SAME.level, withInert).traceHash,
    'an inert wall does not change the trace — same induced trace',
  );
  // ... so trace-hash dedup MUST collapse them to one distinct solution.
  const traces = new Set([
    evaluate(S_COUNT_SAME.level, base).traceHash,
    evaluate(S_COUNT_SAME.level, withInert).traceHash,
  ]);
  assert.equal(traces.size, 1, 'distinct wall sets, same trace → one distinct solution');
});

// ─────────────────── S-AUDIT (completeness vs brute force, R-AUDIT) ───────────────────
test('S-AUDIT: pruned trace-global IDDFS == brute force on (par, count)', () => {
  for (const fx of [GT_CATCH, GT_JOINT, S_PRUNE, S_COUNT_DIFF]) {
    const c = countSolutions(fx.level, { cap: Infinity });
    const bf = bruteForce(fx.level, { maxK: c.par });
    assert.equal(c.par, bf.par, 'par must match brute force');
    assert.equal(c.rawCount, bf.count, 'solution count must match brute force');
    assert.deepEqual(c.traces, bf.traces, 'the exact induced-trace set must match');
  }
});

// ─────────────────── S-DETERMINISM (twin-run byte-identical, R7) ───────────────────
test('S-DETERMINISM: same board + same wall set → byte-identical trace & verdict', () => {
  const L = GT_JOINT.level, walls = GT_JOINT.solution;
  const a = simulate(L, walls), b = simulate(L, walls);
  assert.equal(a.outcome, b.outcome);
  assert.equal(a.traceHash, b.traceHash);
  assert.equal(a.ticks, b.ticks);
  // and the fast path agrees with the recorded path on the trace hash
  assert.equal(evaluate(L, walls).traceHash, a.traceHash);
  // hashTrace is order-preserving and stable
  assert.equal(hashTrace(['a', 'b', 'c']), hashTrace(['a', 'b', 'c']));
  assert.notEqual(hashTrace(['a', 'b', 'c']), hashTrace(['a', 'c', 'b']));
});

// ─────────────────── solver ↔ engine equivalence ───────────────────
test('solver↔engine: every solver-returned wall set actually WINs under simulate', () => {
  for (const fx of [GT_CATCH, GT_JOINT, S_PRUNE]) {
    const s = solveWithStats(fx.level);
    assert.ok(s.solution, 'solver found a solution');
    assert.equal(simulate(fx.level, s.solution).outcome, 'win',
      'the solver wall set must WIN under the deterministic engine');
    assert.equal(s.solution.length, s.par);
  }
});

// ─────────────────── boxed / soft-lock FAIL (R2) ───────────────────
test('BOXED: a wall that blocks all four directions boxes the mover → FAIL', () => {
  const r = simulate(BOXED.level, [BOXED.boxingWall]);
  assert.equal(r.outcome, 'fail');
  // the boxed mover never moved (a single recorded frame before the FAIL)
  assert.equal(r.frames.length, 1);
  assert.deepEqual(
    { x: r.frames[0].units[0].x, y: r.frames[0].units[0].y },
    { x: BOXED.level.movers[0].x, y: BOXED.level.movers[0].y },
  );
});

// ─────────────────── full-state cycle FAIL (R6 d) ───────────────────
test('CYCLE: an arrow-free perimeter loop is a no-progress full-state cycle FAIL', () => {
  const r = simulate(GT_CATCH.level); // null run loops the perimeter
  assert.equal(r.outcome, 'cycle');
  // the loop revisits a prior full state (movers never delivered)
  assert.ok(r.frames.length > 4);
  assert.ok(r.frames.every((f) => !f.units[0].delivered));
});

// ─────────────────── win predicate (R6) ───────────────────
test('WIN: isWin is true exactly when all movers are delivered', () => {
  assert.equal(isWin(GT_CATCH.level, GT_CATCH.solution), true);
  assert.equal(isWin(GT_CATCH.level, []), false); // null run cycles, no delivery
  assert.equal(isWin(GT_JOINT.level, GT_JOINT.solution), true);
  assert.equal(isWin(GT_JOINT.level, [GT_JOINT.solution[0]]), false); // one wall short
});

// ─────────────────── D-ONRAMP (teaching board: front-wall works) ───────────────────
test('D-ONRAMP: the intuitive front-wall move IS a par-1 solution (exempt from anti-greedy)', () => {
  // null run must FAIL (the board needs a wall) ...
  assert.notEqual(simulate(D_ONRAMP.level).outcome, 'win');
  // ... and the wall DIRECTLY AHEAD of the mover wins in one move (par ≤ 2).
  const s = solveWithStats(D_ONRAMP.level);
  assert.ok(s.par <= 2);
  assert.equal(isWin(D_ONRAMP.level, [D_ONRAMP.frontWall]), true,
    'the intuitive front-wall move banks the mover into the sink');
});

// ─────────────────── hunters / catches (R5) ───────────────────
test('R5: a mover meeting a hunter is caught → FAIL (catch resolves before delivery)', () => {
  // head-on on a 1-row corridor: mover (0,0)E and hunter (2,0)W converge → catch.
  const L = { width: 5, height: 1, movers: [{ x: 0, y: 0, facing: E }], sinks: [[4, 0]], hunters: [{ x: 2, y: 0, facing: W }] };
  const r = simulate(L);
  assert.equal(r.outcome, 'fail');
  assert.ok(['caught', 'swap', 'converge'].includes(r.reason), `catch-family reason, got ${r.reason}`);
});

// ─────────────────── converge / swap among movers (R6 b) ───────────────────
test('R6: two movers converging into one (non-sink) cell → FAIL (collision beats delivery)', () => {
  // movers (0,1)E and (2,1)W both head to (1,1) on tick 1 → converge FAIL.
  const L = { width: 3, height: 3, movers: [{ x: 0, y: 1, facing: E }, { x: 2, y: 1, facing: W }], sinks: [[1, 2]] };
  const r = simulate(L);
  assert.equal(r.outcome, 'fail');
  assert.equal(r.reason, 'converge');
});

// ─────────────────── determinism hygiene (R7) — no float / sorted order ───────────────────
test('R7: placeableEdges is deterministically sorted and excludes pre-walls', () => {
  const edges = placeableEdges(GT_CATCH.level);
  assert.deepEqual(edges, [...edges].sort(), 'edges returned in sorted order');
  for (const pw of GT_CATCH.level.prewalls)
    assert.ok(!edges.includes(pw), 'pre-walled edges are not player-placeable');
});
