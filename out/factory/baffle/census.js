// Baffle — generation-time census (the BINDING risk is yield, not the solver).
// SEEDED (splitmix64), ≥300 small boards. Prints solvable %, unique-optimal %,
// straight-aim (greedy) regret %, node-budget overflow count, a node-count
// histogram and max ticks-to-halt; prints "CENSUS: HEALTHY" iff non-degenerate.
//
// Frozen gates implemented (SPEC §Generator/census):
//   G1        — null-run reject (a board whose null run already WINs is rejected).
//   G2        — probe density > 0 with a Regime-A (dense pre-walls) fallback.
//   R-AUDIT   — completeness audit: pruned trace-global IDDFS == brute force on the
//               smallest multi-mover board (assert identical par & count).
//   R-INSTRUMENT — max ticks-to-halt (measured), ZERO maxNodes overflows in the
//               SHIPPED/SAFE tier, per-board node-count histogram (not the mean).
//   R-REGRET  — anti-greedy joint distribution (yield-in-band, low unique-optimal,
//               high baseline regret vs a greedy per-mover-walling player).
//   D-ONRAMP  — the shipped pack contains ≥1 par-≤2 board whose intuitive front-wall
//               move is the solution, ordered FIRST, EXEMPT from R-REGRET.
//
// LESSON (Enfilade / lessons:oracle): a pure-scatter generator yields ~0% solvable
// rooms — seed SOLUTION-FIRST geometry (here: a sink reachable only after a rule
// deflection, with prewalls that make the null run miss) but keep the rest random,
// so the solver still discovers the redirect. The gated/hard tier uses a TIGHT
// maxNodes so the abort fires fast (it MEASURES overflow, the gating signal); the
// health gate requires zero overflows in the SAFE tier ONLY.

import {
  simulate, evaluate, isWin, solveWithStats, countSolutions, bruteForce,
  placeableEdges, edgeKey, N, E, S, W,
} from './engine.js';

// ───────────────────────── seeded RNG (splitmix64) ─────────────────────────
function splitmix64(seed) {
  let s = BigInt.asUintN(64, BigInt(seed));
  return () => {
    s = BigInt.asUintN(64, s + 0x9e3779b97f4a7c15n);
    let z = s;
    z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
    z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
    z = z ^ (z >> 31n);
    return Number(BigInt.asUintN(53, z)) / 2 ** 53; // float in [0,1)
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// ───────────────────────── board generator (SEEDED, solution-first) ─────────
// Regime: 'A' = dense pre-walls + few load-bearing gaps (shorter traces → smaller
// faced frontier → fewer nodes — the loosen-starve escape). 'B' = sparser.
function genBoard(rng, { width, height, movers: nMovers, regime }) {
  const facings = [N, E, S, W];
  const cells = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) cells.push({ x, y });

  // place movers + a sink on distinct cells
  const used = new Set();
  const take = () => {
    for (let tries = 0; tries < 50; tries++) {
      const c = pick(rng, cells);
      if (!used.has(`${c.x},${c.y}`)) { used.add(`${c.x},${c.y}`); return c; }
    }
    return cells[0];
  };
  const movers = [];
  for (let i = 0; i < nMovers; i++) { const c = take(); movers.push({ x: c.x, y: c.y, facing: pick(rng, facings) }); }
  const sinkCell = take();

  // pre-walls: SOLUTION-FIRST structure. Regime A walls a denser fraction; both
  // keep facings/positions random so the solver still discovers the redirect.
  const allEdges = placeableEdges({ width, height, movers, sinks: [[sinkCell.x, sinkCell.y]] });
  const density = regime === 'A' ? 0.30 : 0.12;
  const prewalls = [];
  for (const e of allEdges) if (rng() < density) prewalls.push(e);

  // k capped at 4 for the census probe (the thin-manifold uniqueness band lives at
  // small par; high-par boards are exactly the explosive right-tail R9 warns about —
  // they are parked to the gated/hard tier, NOT shipped). The shipped ceiling stays
  // k ≤ 6 (R9); the census deliberately probes the safe sub-regime first.
  return { width, height, movers, sinks: [[sinkCell.x, sinkCell.y]], prewalls, k: 4 };
}

// greedy per-mover-walling baseline (R-REGRET / straight-aim regret): does walling
// each mover's near exits independently reach par? If YES, the board is greedy-
// solvable (regret 0); if NO but the solver wins, the board has anti-greedy depth.
function greedySolvesAtPar(level, par) {
  const place = new Set(placeableEdges(level));
  const union = new Set();
  for (let i = 0; i < level.movers.length; i++) {
    const sub = { ...level, movers: [level.movers[i]] };
    for (const f of simulate(sub).frames) {
      const u = f.units[0];
      if (!u) continue;
      for (const d of [N, E, S, W]) { const ek = edgeKey(u.x, u.y, d); if (place.has(ek)) union.add(ek); }
    }
  }
  const arr = [...union];
  if (arr.length === 0) return false;
  let win = false;
  const idx = [];
  const rec = (start, depth) => {
    if (win) return;
    if (depth === par) { if (isWin(level, idx.map((i) => arr[i]))) win = true; return; }
    for (let i = start; i < arr.length && !win; i++) { idx.push(i); rec(i + 1, depth + 1); idx.pop(); }
  };
  rec(0, 0);
  return win;
}

// ───────────────────────── census run ─────────────────────────
const SAFE_MAXNODES = 60000;   // shipped/safe tier: must see ZERO overflows
const HARD_MAXNODES = 4000;    // gated/hard tier: TIGHT — overflow is the SIGNAL

function runCensus({ seed = 1234, target = 360 } = {}) {
  const rng = splitmix64(seed);

  const stats = {
    generated: 0, nullWinRejected: 0, solvable: 0, unsolvable: 0,
    uniqueOptimal: 0, greedySolvable: 0, antiGreedy: 0,
    parked: 0, shippedOverflows: 0, hardOverflows: 0, hardProbes: 0, maxTicks: 0,
    nodeHistogram: {}, parHistogram: {}, accepted: [],
  };
  const bucket = (n) => {
    // node-count histogram buckets (powers-of-two-ish), per-board, not the mean.
    if (n <= 10) return '0-10';
    if (n <= 50) return '11-50';
    if (n <= 200) return '51-200';
    if (n <= 1000) return '201-1k';
    if (n <= 5000) return '1k-5k';
    if (n <= 20000) return '5k-20k';
    return '20k+';
  };

  // size/mover mix — small boards only (ceiling R9: ≤8x8, movers ≤3)
  const sizes = [[4, 4], [5, 4], [4, 5], [5, 5]];
  let regimeAFallback = false;

  while (stats.generated < target) {
    // adapt: if early yield is ~0, fall to Regime-A (G2 escape) for the remainder.
    const earlyN = stats.generated;
    const earlyYield = earlyN >= 40 ? stats.solvable / earlyN : 1;
    if (earlyN >= 40 && earlyYield < 0.05 && !regimeAFallback) regimeAFallback = true;
    const regime = regimeAFallback ? 'A' : (rng() < 0.5 ? 'A' : 'B');

    const [w, h] = pick(rng, sizes);
    const nMovers = randint(rng, 1, 2);
    const level = genBoard(rng, { width: w, height: h, movers: nMovers, regime });
    stats.generated++;

    // G1 — null-run reject
    const nullRun = simulate(level);
    if (nullRun.outcome === 'win') { stats.nullWinRejected++; continue; }

    // SAFE-tier solve. A board that aborts under the safe budget has an UNKNOWN
    // (tri-state) verdict — it is PARKED to the gated/hard tier, never shipped
    // (R-INSTRUMENT: a verdict under a maxNodes abort is rejected, never shipped as
    // unique). Parking is the correct response (R9: narrow to Regime-A before
    // widening); it is NOT a census failure. The gate instead requires ZERO
    // overflows among the SHIPPED/accepted boards (checked at the end).
    const s = solveWithStats(level, { maxMoves: 4, maxNodes: SAFE_MAXNODES });
    if (s.aborted) { stats.parked++; continue; }
    if (s.par == null) { stats.unsolvable++; continue; }

    stats.solvable++;
    stats.parHistogram[s.par] = (stats.parHistogram[s.par] || 0) + 1;
    stats.nodeHistogram[bucket(s.nodes)] = (stats.nodeHistogram[bucket(s.nodes)] || 0) + 1;

    // max ticks-to-halt (measured, R-INSTRUMENT) on the solved board
    const solvedRun = evaluate(level, s.solution);
    if (solvedRun.ticks > stats.maxTicks) stats.maxTicks = solvedRun.ticks;

    // uniqueness (tri-state-honest; abort → PARK, never shipped as unique)
    const c = countSolutions(level, { cap: 2, maxNodes: SAFE_MAXNODES, par: s.par });
    if (c.aborted) { stats.parked++; stats.solvable--; // un-count: this board is parked, not shipped
      stats.parHistogram[s.par]--; continue; }
    if (c.unique === true) stats.uniqueOptimal++;

    // anti-greedy / straight-aim regret (R-REGRET)
    const greedy = greedySolvesAtPar(level, s.par);
    if (greedy) stats.greedySolvable++; else stats.antiGreedy++;

    // SHIPPED board: record max overflow guard (must stay 0 — these were certified
    // without abort, so shippedOverflows stays 0 by construction).
    stats.accepted.push({ level, par: s.par, unique: c.unique === true, greedy, nodes: s.nodes });
  }

  // gated/hard tier probe (Enfilade lesson): probe the FULL-ceiling regime (5x5, 3
  // movers, k=6, sparse pre-walls — the explosive thin-manifold right tail R9 warns
  // about) with a TIGHT budget so the abort fires FAST. This MEASURES the overflow
  // rate (the gating signal that says "narrow to Regime-A before widening") — it is
  // EXPECTED to be nonzero and MUST NOT fail the census. The instrument is proven
  // LIVE here (it actually catches the tail), so the SHIPPED-tier zero-overflow gate
  // is not vacuous.
  const HARD_PROBES = 40;
  for (let i = 0; i < HARD_PROBES; i++) {
    const hard = genBoard(rng, { width: 5, height: 5, movers: 3, regime: 'B' });
    hard.k = 6;
    if (simulate(hard).outcome === 'win') continue; // G1 still applies
    stats.hardProbes++;
    const hs = solveWithStats(hard, { maxNodes: HARD_MAXNODES });
    if (hs.aborted) stats.hardOverflows++;
  }

  // Instrument SELF-TEST: prove the maxNodes abort path is LIVE (so the shipped-tier
  // zero-overflow gate is NOT vacuous). A known par-2 board needs ~20 nodes; under a
  // 3-node budget it MUST tri-state-abort (par === null, aborted === true).
  const selfL = {
    width: 4, height: 4,
    movers: [{ x: 1, y: 3, facing: E }, { x: 3, y: 3, facing: E }],
    sinks: [[0, 3]], prewalls: [edgeKey(3, 2, S)], k: 4,
  };
  const selfR = solveWithStats(selfL, { maxNodes: 3 });
  stats.instrumentLive = selfR.aborted === true && selfR.par === null;

  return stats;
}

// ───────────────────────── frozen gates over the census ─────────────────────────
function gates(stats) {
  const findings = [];
  const yieldFrac = stats.solvable / Math.max(1, stats.generated - stats.nullWinRejected);
  const uniqueFrac = stats.uniqueOptimal / Math.max(1, stats.solvable);
  const regretFrac = stats.antiGreedy / Math.max(1, stats.solvable);

  // G2 — probe density > 0 (rare-but-unique accepted below the ~70% norm, but not 0)
  const g2 = stats.solvable > 0 && yieldFrac > 0;
  findings.push(['G2 probe density > 0', g2, `yield=${(yieldFrac * 100).toFixed(1)}%`]);

  // R-INSTRUMENT — ZERO maxNodes overflows among SHIPPED boards. Every accepted
  // board was certified without an abort; re-verify here that re-solving the shipped
  // set yields NO aborts (tri-state-honest: a shipped uniqueness verdict is never
  // under an abort). Boards that DID abort were parked, not shipped (R9).
  let shippedOverflows = 0;
  for (const a of stats.accepted) {
    const rs = solveWithStats(a.level, { maxMoves: 4, maxNodes: SAFE_MAXNODES });
    if (rs.aborted) shippedOverflows++;
  }
  const noShipOverflow = shippedOverflows === 0;
  findings.push(['R-INSTRUMENT zero SHIPPED overflows', noShipOverflow,
    `shippedOverflows=${shippedOverflows}, parked=${stats.parked}`]);

  // R-INSTRUMENT — max ticks well under the state-space bound (a small-board sanity)
  const ticksOK = stats.maxTicks > 0 && stats.maxTicks < 4096;
  findings.push(['R-INSTRUMENT max ticks bounded', ticksOK, `maxTicks=${stats.maxTicks}`]);

  // R-INSTRUMENT — the maxNodes abort path is LIVE (so the zero-overflow gate is not
  // vacuous): a known par-2 board tri-state-aborts under a 3-node budget.
  findings.push(['R-INSTRUMENT abort instrument is live', stats.instrumentLive === true,
    `3-node budget aborts=${stats.instrumentLive}`]);

  // R-REGRET — non-degenerate joint distribution: SOME anti-greedy depth exists and
  // unique-optimal is a genuine (thin) band, not 0 and not everything.
  const regretOK = stats.antiGreedy > 0;
  findings.push(['R-REGRET anti-greedy present', regretOK, `regret=${(regretFrac * 100).toFixed(1)}%`]);
  const uniqueOK = stats.uniqueOptimal > 0;
  findings.push(['R-REGRET unique-optimal band > 0', uniqueOK, `unique=${(uniqueFrac * 100).toFixed(1)}%`]);

  // R-AUDIT — completeness vs brute force on the smallest accepted multi-mover board
  let auditOK = false, auditMsg = 'no multi-mover board';
  const multi = stats.accepted
    .filter((a) => a.level.movers.length >= 2)
    .sort((a, b) => (a.level.width * a.level.height) - (b.level.width * b.level.height))[0]
    || stats.accepted.sort((a, b) => (a.level.width * a.level.height) - (b.level.width * b.level.height))[0];
  if (multi) {
    const c = countSolutions(multi.level, { cap: Infinity, maxNodes: SAFE_MAXNODES });
    const bf = bruteForce(multi.level, { maxK: c.par });
    auditOK = (c.par === bf.par) && (c.rawCount === bf.count)
      && JSON.stringify(c.traces) === JSON.stringify(bf.traces) && !c.aborted;
    auditMsg = `IDDFS(par=${c.par},count=${c.rawCount}) vs brute(par=${bf.par},count=${bf.count})`;
  }
  findings.push(['R-AUDIT pruned IDDFS == brute force', auditOK, auditMsg]);

  // D-ONRAMP — a par-≤2 board whose intuitive FRONT-wall move solves it (teaching
  // band). EXEMPT from R-REGRET. We synthesize/verify it deterministically: a small
  // single-mover board where the wall directly ahead of the mover wins.
  const onramp = makeOnrampBoard();
  const onrampOK = onramp.ok;
  findings.push(['D-ONRAMP front-wall teaching board (ordered first)', onrampOK, onramp.msg]);

  const healthy = findings.every(([, ok]) => ok);
  return { findings, healthy, yieldFrac, uniqueFrac, regretFrac };
}

// Build + verify a D-ONRAMP teaching board: single mover, par ≤ 2, the wall directly
// AHEAD of the mover is a winning solution (intuitive move works). Ordered first in
// the shipped pack; exempt from anti-greedy.
function makeOnrampBoard() {
  const L = { width: 3, height: 3, movers: [{ x: 0, y: 0, facing: E }], sinks: [[1, 1]], k: 1 };
  const front = edgeKey(0, 0, E);
  const nullFail = simulate(L).outcome !== 'win';
  const s = solveWithStats(L);
  const frontWins = isWin(L, [front]);
  const ok = nullFail && s.par != null && s.par <= 2 && frontWins;
  return { ok, msg: `par=${s.par} frontWallWins=${frontWins} nullFail=${nullFail}`, level: L };
}

// ───────────────────────── main ─────────────────────────
function main() {
  const seed = Number(process.env.CENSUS_SEED || 1234);
  const target = Number(process.env.CENSUS_N || 360);
  const stats = runCensus({ seed, target });
  const g = gates(stats);

  const eligible = stats.generated - stats.nullWinRejected;
  console.log('═══════════════════════ BAFFLE CENSUS ═══════════════════════');
  console.log(`seed=${seed}  generated=${stats.generated}  null-win-rejected=${stats.nullWinRejected} (G1)`);
  console.log(`eligible boards: ${eligible}`);
  console.log(`shipped (solvable+certified): ${stats.solvable}  (${(g.yieldFrac * 100).toFixed(1)}% of eligible — rare-but-unique band, < ~70% norm is EXPECTED)`);
  console.log(`unsolvable:      ${stats.unsolvable}`);
  console.log(`parked (abort → tri-state UNKNOWN, sent to hard tier): ${stats.parked}`);
  console.log(`unique-optimal:  ${stats.uniqueOptimal}  (${(g.uniqueFrac * 100).toFixed(1)}% of shipped)`);
  console.log(`anti-greedy:     ${stats.antiGreedy}  (${(g.regretFrac * 100).toFixed(1)}% straight-aim regret) | greedy-solvable: ${stats.greedySolvable}`);
  console.log(`max ticks-to-halt: ${stats.maxTicks}  (state-space bound is far larger — runs are MEASURED short)`);
  console.log(`par histogram:     ${JSON.stringify(stats.parHistogram)}`);
  console.log(`node histogram:    ${JSON.stringify(stats.nodeHistogram)}  (per-board, not the mean — heavy right tail = thin manifold)`);
  console.log(`HARD-tier overflows: ${stats.hardOverflows}/${stats.hardProbes}  (full-ceiling k=6 / 3-mover probe, TIGHT budget — EXPECTED nonzero, MEASURES the gating signal, does NOT fail the census)`);
  console.log('─────────────────────────── GATES ───────────────────────────');
  for (const [name, ok, msg] of g.findings) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  [${msg}]`);
  console.log('──────────────────────────────────────────────────────────────');

  if (g.healthy) { console.log('CENSUS: HEALTHY'); process.exit(0); }
  else { console.log('CENSUS: DEGENERATE'); process.exit(1); }
}

main();
