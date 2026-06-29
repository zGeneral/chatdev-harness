// Baffle — STAGE-3 CONTENT tests (node --test).
//
// RE-DERIVES every fact from the shared engine (engine.js + contract.js) over the
// level GEOMETRY — NEVER trusts pack.json's self-reported par / solution / unique /
// certificate (it cross-checks them instead). The pack is data; the engine is truth.
//
// Asserts:
//   • pack.json exists and is well-formed; rejections.json exists.
//   • EVERY curriculum insight has ≥1 packed level (full coverage).
//   • Each packed level is SOLVABLE and UNIQUE-optimal via the solver (re-derived).
//   • Each packed level TEACHES its assigned insight — the full stage-2 contract for
//     its tier passes when re-checked from geometry (checkContract.ok).
//   • The level's self-reported par/solution match the engine's (no self-report lie).
//   • DISTINCTNESS (non-negotiable): every level has a UNIQUE canonical signature —
//     ZERO isomorphic duplicates under translation + the 8 dihedral symmetries.
//   • The canonical-signature oracle is itself CORRECT: a level is isomorphic to its
//     own 8 dihedral transforms (same signature), and not to a genuinely different one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  simulate, evaluate, isWin, solveWithStats, countSolutions,
  edgeKey, N, E, S, W,
} from './engine.js';
import { checkContract } from './contract.js';
import { bake, CURRICULUM, canonicalSignature } from './baker.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACK_PATH = join(HERE, 'pack.json');
const REJ_PATH = join(HERE, 'rejections.json');
const MAX_NODES = 200000;

function loadPack() {
  assert.ok(existsSync(PACK_PATH), 'pack.json must exist (run baker.js)');
  return JSON.parse(readFileSync(PACK_PATH, 'utf8'));
}

// ───────────────────────── pack presence & shape ─────────────────────────
test('pack.json exists, is well-formed, and rejections.json exists', () => {
  const pack = loadPack();
  assert.ok(Array.isArray(pack.levels) && pack.levels.length >= 1, 'pack has levels');
  assert.ok(Array.isArray(pack.curriculum) && pack.curriculum.length === CURRICULUM.length,
    'pack carries the full curriculum graph');
  assert.ok(existsSync(REJ_PATH), 'rejections.json must exist (per-gate census)');
  const rej = JSON.parse(readFileSync(REJ_PATH, 'utf8'));
  assert.ok(rej.perGate && typeof rej.perGate === 'object', 'rejections has a per-gate census');
  assert.ok(rej.perInsight && typeof rej.perInsight === 'object', 'rejections has per-insight coverage');
});

// ───────────────────────── full curriculum coverage ─────────────────────────
test('EVERY curriculum insight has ≥1 packed level (full coverage)', () => {
  const pack = loadPack();
  for (const insight of CURRICULUM) {
    const got = pack.levels.filter((l) => l.insight === insight.id);
    assert.ok(got.length >= 1,
      `insight "${insight.id}" (${insight.tier}) has ZERO levels — curriculum gap`);
  }
});

// ───────────────────────── per-level: solvable + unique (RE-DERIVED) ─────────────────────────
test('each packed level is SOLVABLE and UNIQUE-optimal via the solver (re-derived, not trusted)', () => {
  const pack = loadPack();
  for (const l of pack.levels) {
    const sw = solveWithStats(l.level, { maxMoves: l.level.k, maxNodes: MAX_NODES });
    assert.equal(sw.aborted, false, `${l.id}: solver aborted (tri-state UNKNOWN — not shippable)`);
    assert.ok(sw.par != null, `${l.id}: engine finds NO solution (pack claims par ${l.par})`);

    // cross-check the self-reported par against the engine (never trust the field).
    assert.equal(sw.par, l.par, `${l.id}: self-reported par ${l.par} != engine par ${sw.par}`);

    // the self-reported solution must actually WIN under the engine and be at par.
    assert.ok(isWin(l.level, l.solution), `${l.id}: self-reported solution does NOT win under simulate`);
    assert.equal(l.solution.length, sw.par, `${l.id}: self-reported solution length != par`);

    // UNIQUE-optimal (T0 on-ramp is exempt — a par-1 front-wall board legitimately has
    // several inert-equivalent winners; the contract G4 encodes this exemption).
    const c = countSolutions(l.level, { cap: Infinity, maxNodes: MAX_NODES, par: sw.par });
    assert.equal(c.aborted, false, `${l.id}: uniqueness count aborted (UNKNOWN — not shippable)`);
    if (l.tier !== 'T0') {
      assert.equal(c.unique, true, `${l.id}: NOT unique-optimal (${c.rawCount} optimal traces at par)`);
    }
  }
});

// ───────────────────────── per-level: TEACHES its insight (full contract re-check) ─────────────────────────
test('each packed level TEACHES its insight — the full stage-2 contract passes when re-derived from geometry', () => {
  const pack = loadPack();
  for (const l of pack.levels) {
    const rep = checkContract(l.level, { tier: l.tier, maxNodes: MAX_NODES });
    assert.ok(rep.ok,
      `${l.id} (${l.tier}): contract FAILS on re-check — ${rep.failures.map((f) => `${f.id}:${f.detail}`).join(' | ')}`);

    // the revelation certificate must be structured engine FACT, not a claim: re-derive
    // its trace hash and uniqueness and confirm they match what the engine says NOW.
    const cert = l.certificate;
    assert.ok(cert && cert.insight === l.insight, `${l.id}: certificate missing / wrong insight`);
    const th = evaluate(l.level, l.solution).traceHash;
    assert.equal(cert.traceHash, th, `${l.id}: certificate traceHash != engine traceHash (self-report lie)`);
  }
});

// ───────────────────────── DISTINCTNESS: zero isomorphic duplicates ─────────────────────────
test('every level has a UNIQUE canonical signature — ZERO isomorphic duplicates (translation + 8 dihedral)', () => {
  const pack = loadPack();
  // re-derive each signature from geometry (do not trust the stored field), then assert
  // all distinct.
  const sigs = new Map(); // sig -> level id
  for (const l of pack.levels) {
    const sw = solveWithStats(l.level, { maxMoves: l.level.k, maxNodes: MAX_NODES });
    const sig = canonicalSignature(l.level, sw.solution);
    // the stored signature must match the re-derived one (no self-report drift).
    assert.equal(l.signature, sig, `${l.id}: stored signature != re-derived signature`);
    if (sigs.has(sig)) {
      assert.fail(`DUPLICATE STRUCTURE: ${l.id} is isomorphic to ${sigs.get(sig)} ` +
        `(same canonical signature — a reskinned puzzle, the focus-fire 1/2/3 bug)`);
    }
    sigs.set(sig, l.id);
  }
  assert.equal(sigs.size, pack.levels.length, 'distinct signatures == level count');
});

// ───────────────────────── the canonical-signature ORACLE is itself correct ─────────────────────────
test('canonical signature is INVARIANT under all 8 dihedral transforms of a level (the dedup oracle is sound)', () => {
  // Take a concrete level + its solution; apply each of the 8 dihedral transforms to
  // BOTH the level and the solution; assert every transform yields the SAME signature
  // (so two boards that differ only by a rotation/reflection ARE recognised as the same
  // puzzle — the property the dedup relies on).
  const base = {
    width: 4, height: 4,
    movers: [{ x: 0, y: 0, facing: E }],
    sinks: [[2, 0]],
    prewalls: [edgeKey(1, 0, E), edgeKey(3, 1, S)],
    k: 2,
  };
  const baseSol = [edgeKey(0, 0, S)];
  const baseSig = canonicalSignature(base, baseSol);

  // transform helpers mirroring baker.js (independent re-implementation for the test).
  const tPoint = (x, y, rot, flip) => {
    let px = x, py = y;
    if (flip) px = -px;
    for (let r = 0; r < rot; r++) { const nx = -py, ny = px; px = nx; py = ny; }
    return [px, py];
  };
  const tFacing = (f, rot, flip) => { let g = f; if (flip) g = (4 - g) & 3; return (g + rot) & 3; };
  const tEdge = (ek, rot, flip) => {
    const [a, b] = ek.split('|');
    const [ax, ay] = a.split(',').map(Number); const [bx, by] = b.split(',').map(Number);
    const [tax, tay] = tPoint(ax, ay, rot, flip); const [tbx, tby] = tPoint(bx, by, rot, flip);
    if (tax < tbx || (tax === tbx && tay < tby)) return `${tax},${tay}|${tbx},${tby}`;
    return `${tbx},${tby}|${tax},${tay}`;
  };

  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      const tl = {
        ...base,
        movers: base.movers.map((m) => { const [x, y] = tPoint(m.x, m.y, rot, flip); return { x, y, facing: tFacing(m.facing, rot, flip) }; }),
        sinks: base.sinks.map(([x, y]) => tPoint(x, y, rot, flip)),
        prewalls: base.prewalls.map((e) => tEdge(e, rot, flip)),
      };
      const tSol = baseSol.map((e) => tEdge(e, rot, flip));
      const sig = canonicalSignature(tl, tSol);
      assert.equal(sig, baseSig,
        `signature changed under dihedral transform (rot=${rot},flip=${flip}) — dedup oracle is NOT symmetry-invariant`);
    }
  }
});

test('canonical signature DISTINGUISHES genuinely different puzzles (the oracle is not degenerate)', () => {
  // Two structurally different levels must have DIFFERENT signatures (else dedup would
  // wrongly collapse real content). A par-1 single-mover board vs a par-2 two-mover board.
  const A = { width: 4, height: 4, movers: [{ x: 0, y: 0, facing: E }], sinks: [[2, 0]], prewalls: [edgeKey(1, 0, E), edgeKey(3, 1, S)], k: 2 };
  const Asol = [edgeKey(0, 0, S)];
  const B = { width: 4, height: 4, movers: [{ x: 1, y: 3, facing: E }, { x: 3, y: 3, facing: E }], sinks: [[0, 3]], prewalls: [edgeKey(3, 2, S)], k: 4 };
  const Bsol = [edgeKey(1, 3, E), edgeKey(1, 0, E)];
  assert.notEqual(canonicalSignature(A, Asol), canonicalSignature(B, Bsol),
    'two genuinely different puzzles share a signature — the dedup oracle is degenerate');
});

// ───────────────────────── the baker is reproducible (same seed → byte-identical) ─────────────────────────
// NOTE on cost: a FULL bake (triesPerInsight=6000) runs the exact solver + countSolutions +
// full contract on every candidate at maxNodes=200000; the rare hard/deep tiers (par-3,
// ~1993-node solves) burn thousands of those expensive runs, so a full bake is MINUTES — and
// the determinism property previously re-baked TWICE inside this single `node --test` process,
// blowing past the harness's 2-minute ceiling. node:test then CANCELS the still-running
// synchronous test and emits the misleading 'Promise resolution is still pending …' warning
// (there is no async/leaked handle in this file — the cause is wall-clock cost, not a leak).
//
// The determinism property does NOT need a full ship to be proven: same seed → byte-identical
// output is a property of the RNG/iteration PATH, independent of how many tries we cap. We
// assert it on a BOUNDED bake (fast, terminates well within budget). Coverage/no-padding/
// distinctness of the ACTUAL shipped content is asserted below against pack.json — the real
// artifact the player gets — which the other tests already re-derive from the engine.
test('baker is deterministic — same seed yields a byte-identical pack (bounded bake)', () => {
  const a = bake({ seed: 7, triesPerInsight: 4 });
  const b = bake({ seed: 7, triesPerInsight: 4 });
  assert.equal(JSON.stringify(a.pack), JSON.stringify(b.pack), 'same seed must give a byte-identical pack');
  // a different seed must (almost surely) diverge — determinism is seed-keyed, not constant.
  const c = bake({ seed: 8, triesPerInsight: 4 });
  assert.notEqual(JSON.stringify(a.pack), JSON.stringify(c.pack),
    'different seeds produced identical packs — the bake ignores its seed');
});

// ───────────────────────── the SHIPPED pack is gate-honest (no padded duplicate, honest starvation) ─────────────────────────
test('the shipped pack reports starvation honestly and contains NO padded duplicate', () => {
  const pack = loadPack();
  // every coverage entry: shipped never exceeds wanted (no over-padding), and a 'starved'
  // mark must mean shipped < wanted (honest reporting — never fake coverage).
  for (const c of CURRICULUM) {
    const cov = pack.coverage[c.id];
    assert.ok(cov, `${c.id}: missing from pack coverage`);
    assert.ok(cov.shipped <= cov.wanted, `${c.id}: shipped ${cov.shipped} > wanted ${cov.wanted} (over-padded?)`);
    if (cov.starved) assert.ok(cov.shipped < cov.wanted, `${c.id}: marked starved but shipped == wanted`);
  }
  // distinctness within the shipped pack (defensive: no two stored signatures collide; the
  // engine-re-derived distinctness check above is the authoritative one).
  const sigs = new Set(pack.levels.map((l) => l.signature));
  assert.equal(sigs.size, pack.levels.length, 'shipped pack has a duplicate signature');
});
