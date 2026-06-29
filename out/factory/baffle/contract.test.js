// Baffle — STAGE-2 DIFFICULTY CONTRACT tests (node --test).
//
// Two halves, per the difficulty contract:
//   1. STARTER BAND — fully-specified rooms that PASS every gate, one per rung of the
//      SPEC technique ladder (T0 on-ramp, T1 shared deflection, T2 manufactured
//      dead-end, T3 THE CATCH). Proof the contract admits genuine, shippable
//      difficulty — not just an empty filter.
//   2. SOFT FIXTURES — each engineered to break exactly ONE difficulty property; the
//      test asserts the gate that targets that property REJECTS it. A few properties
//      (uniqueness, frame-legibility) cannot be violated by a room the engine itself
//      certifies as a win — so those fixtures exercise the target gate DIRECTLY with a
//      crafted analysis (the gate is a pure function of it), per the lesson.
//
// Everything routes through the ONE shared engine via contract.js — no second model.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkContract, getGate, GATES, GATE_COUNT,
} from './contract.js';
import { GT_JOINT, GT_CATCH, S_PRUNE, D_ONRAMP } from './fixtures.js';

// Assert a checkContract report is fully green.
function assertAllPass(report, label) {
  assert.equal(
    report.ok,
    true,
    `${label} should pass ALL gates; failures: ` +
      report.failures.map((f) => `${f.id}(${f.detail})`).join(', '),
  );
}

// Assert the gate `target` is among the rejections for a room declared at `tier`.
function assertRejectedBy(level, tier, target) {
  const report = checkContract(level, { tier });
  assert.equal(report.ok, false, `room (tier ${tier}) should be rejected, but passed`);
  const failedIds = report.failures.map((f) => f.id);
  assert.ok(
    failedIds.includes(target),
    `expected gate ${target} to reject the room; instead failed: [${failedIds.join(',')}]`,
  );
  return report;
}

// ===========================================================================
// Gate inventory — the contract has 6..10 computable gates (here: 8).
// ===========================================================================
test('CONTRACT: gate count is within the 6..10 band', () => {
  assert.ok(GATE_COUNT >= 6 && GATE_COUNT <= 10, `expected 6..10 gates, got ${GATE_COUNT}`);
  const ids = GATES.map((g) => g.id);
  assert.deepEqual(ids, ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']);
});

// ===========================================================================
// STARTER BAND — one room per rung of the technique ladder, each passes ALL gates.
// ===========================================================================

// STARTER T0 — the genuine D-ONRAMP teaching board. Single mover, par 1, the intuitive
// FRONT-wall move banks it into the sink. EXEMPT from anti-greedy / uniqueness. The
// *ten* lands in move 1.  (D_ONRAMP from fixtures.js — pinned in the SPEC.)
test('STARTER (T0 on-ramp): the D-ONRAMP front-wall teaching board passes every gate', () => {
  const r = checkContract(D_ONRAMP.level, { tier: 'T0' });
  assertAllPass(r, 'STARTER_T0');
  assert.equal(r.par, 1);
});

// STARTER T1 — shared deflection. Two movers, one sink; the UNIQUE par-2 set has a wall
// load-bearing for BOTH movers (remove either → both fail). Anti-greedy: walling each
// mover independently does NOT win.  (GT_JOINT — pinned in the SPEC golden trace.)
test('STARTER (T1 shared deflection): GT_JOINT — a ≥2-mover shared wall — passes every gate', () => {
  const r = checkContract(GT_JOINT.level, { tier: 'T1' });
  assertAllPass(r, 'STARTER_T1');
  assert.equal(r.par, 2);
  assert.equal(r.unique, true);
});

// STARTER T2 — manufactured dead-end. The unique par-2 line forces a mover to REVERSE
// off a player-placed wall (the rule's `reverse` priority fires) — a placeable
// resource, not found terrain. Anti-greedy, unique, area 20 / 2 movers.
// (Census-discovered, brute-cross-checked; pinned here as the T2 starter.)
const STARTER_T2 = {
  width: 5, height: 4,
  movers: [{ x: 3, y: 3, facing: 2 /*S*/ }, { x: 2, y: 1, facing: 2 /*S*/ }],
  sinks: [[3, 0]],
  k: 4,
  prewalls: [
    '0,1|1,1', '0,2|0,3', '0,3|1,3', '1,1|1,2', '1,2|1,3', '1,2|2,2',
    '1,3|2,3', '2,0|2,1', '2,0|3,0', '2,1|3,1', '3,1|3,2', '3,3|4,3',
  ],
};
test('STARTER (T2 manufactured dead-end): a reverse-forcing par-2 room passes every gate', () => {
  const r = checkContract(STARTER_T2, { tier: 'T2' });
  assertAllPass(r, 'STARTER_T2');
  assert.equal(r.par, 2);
  assert.equal(r.unique, true);
});

// STARTER T3 — THE CATCH (the hard tier). The unique par-2 line places NO wall directly
// in front of any mover at its start; the herd is banked around via beside/behind
// walls. Area 20, 2 movers, par 2, the solver explores a non-trivial subtree (>= the
// SEARCH_FLOOR) — a genuine hard-tier decision space, never an eyeball-trivial room.
// (Census-discovered, brute-cross-checked; pinned here as the T3 starter.)
const STARTER_T3 = {
  width: 5, height: 4,
  movers: [{ x: 1, y: 2, facing: 0 /*N*/ }, { x: 4, y: 1, facing: 3 /*W*/ }],
  sinks: [[0, 3]],
  k: 4,
  prewalls: [
    '0,0|1,0', '0,1|0,2', '0,3|1,3', '1,1|2,1',
    '2,0|2,1', '3,1|3,2', '3,1|4,1', '4,1|4,2',
  ],
};
test('STARTER (T3 THE CATCH): a hard catch-shaped par-2 room passes every gate (incl. the floor)', () => {
  const r = checkContract(STARTER_T3, { tier: 'T3' });
  assertAllPass(r, 'STARTER_T3');
  assert.equal(r.par, 2);
  assert.equal(r.unique, true);
  const g8 = r.gates.find((x) => x.id === 'G8');
  assert.ok(g8.ok, 'G8 floor admits the genuinely-hard catch room');
  assert.match(g8.detail, /floor cleared/);
});

// ===========================================================================
// SOFT FIXTURES — each rejected by the gate it targets.
// ===========================================================================

// SOFT-G1 — DEFAULT OUTCOME. A board whose NULL run already delivers the mover (the
// sink sits straight ahead, no wall needed): a par-0 freebie. G1 must reject it.
test('SOFT G1 (default-outcome): a null-run win (par 0 freebie) is rejected by G1', () => {
  const freebie = {
    width: 3, height: 1,
    movers: [{ x: 0, y: 0, facing: 1 /*E*/ }],
    sinks: [[2, 0]],
    k: 2,
  };
  const r = assertRejectedBy(freebie, 'T0', 'G1');
  assert.match(r.failures.find((f) => f.id === 'G1').detail, /freebie|already delivers/);
});

// SOFT-G2 — STRUCTURAL MINIMUMS. A board with 4 movers (R9 caps movers at 3). G2 must
// reject the out-of-bounds entity count.
test('SOFT G2 (structural minimums): a >3-mover board is rejected by G2 (R9 ceiling)', () => {
  const tooMany = {
    width: 4, height: 4,
    movers: [
      { x: 0, y: 0, facing: 1 }, { x: 1, y: 0, facing: 1 },
      { x: 2, y: 0, facing: 1 }, { x: 3, y: 0, facing: 2 },
    ],
    sinks: [[0, 3]],
    k: 4,
  };
  const r = assertRejectedBy(tooMany, 'T1', 'G2');
  assert.match(r.failures.find((f) => f.id === 'G2').detail, /movers 4 out of 1\.\.3/);
});

// SOFT-G3 — ANTI-GREEDY (Medium+). GT_CATCH is a single-mover board the greedy
// per-mover line trivially solves; declared as a Medium+ T1 room, the obvious line
// wins, so G3 must reject the over-claim. (At T3 GT_CATCH is THE CATCH structurally,
// but it is single-mover/par-1 so the floor rejects it there — see SOFT-G8.)
test('SOFT G3 (anti-greedy): a greedy-solvable room declared Medium+ (T1) is rejected by G3', () => {
  const r = assertRejectedBy(GT_CATCH.level, 'T1', 'G3');
  assert.match(r.failures.find((f) => f.id === 'G3').detail, /greedy|obvious line/);
});

// SOFT-G4 — UNIQUENESS. A unique-optimal room cannot be conjured cheaply into a
// multi-solution room without also breaking other properties (the engine's
// induced-trace uniqueness is strong — itself a quality signal). So we exercise the G4
// gate DIRECTLY: it is a pure function of {par, count, unique, aborted}. A par with 2
// distinct-trace optimal solutions is rejected; exactly 1 passes (Medium+); and a
// verdict under a maxNodes abort is rejected (tri-state-honest).
test('SOFT G4 (uniqueness): a not-unique par and an aborted verdict are rejected by G4 (direct)', () => {
  const G4 = getGate('G4');
  const reject = G4.run({ par: 2, count: 2, unique: false, aborted: false, tier: 'T1' });
  assert.equal(reject.ok, false);
  assert.match(reject.detail, /not unique/);

  const accept = G4.run({ par: 2, count: 1, unique: true, aborted: false, tier: 'T1' });
  assert.equal(accept.ok, true);

  // tri-state-honest: a verdict reached under an abort is rejected, never shipped.
  const aborted = G4.run({ par: 2, count: 1, unique: null, aborted: true, tier: 'T1' });
  assert.equal(aborted.ok, false);
  assert.match(aborted.detail, /abort|UNKNOWN/);

  // certifier disagreement (par exists but 0 solutions counted) is also caught.
  const disagree = G4.run({ par: 2, count: 0, unique: false, aborted: false, tier: 'T1' });
  assert.equal(disagree.ok, false);
});

// SOFT-G5 — TECHNIQUE-TIER LADDER. (a) A shared-deflection board with NO manufactured
// reverse, DECLARED as T2 (manufactured dead-end) — the structure does not match the
// claim, so G5 rejects. (b) GT_JOINT DECLARED T3 — its solution DOES place a wall
// directly in front of a mover, so it is not THE CATCH; G5 rejects the over-claim.
test('SOFT G5 (technique-tier ladder): a no-dead-end room declared T2 is rejected by G5', () => {
  const noDeadEnd = {
    width: 5, height: 4,
    movers: [{ x: 2, y: 0, facing: 3 /*W*/ }, { x: 4, y: 1, facing: 0 /*N*/ }],
    sinks: [[2, 2]],
    k: 4,
    prewalls: [
      '0,2|1,2', '0,3|1,3', '1,1|1,2', '1,2|1,3', '1,3|2,3',
      '2,0|2,1', '2,1|2,2', '2,2|2,3', '4,0|4,1', '4,2|4,3',
    ],
  };
  const r = assertRejectedBy(noDeadEnd, 'T2', 'G5');
  assert.match(r.failures.find((f) => f.id === 'G5').detail, /T2 declared but.*dead-end/);
});

test('SOFT G5 (technique-tier ladder): a front-wall room declared T3 (THE CATCH) is rejected by G5', () => {
  const r = assertRejectedBy(GT_JOINT.level, 'T3', 'G5');
  assert.match(r.failures.find((f) => f.id === 'G5').detail, /T3 declared but.*directly in front|not THE CATCH/);
});

// SOFT-G6 — SEQUENCE SHAPE + STRUCTURAL MINIMUM. GT_CATCH is a par-1 board (a single
// wall solves it); DECLARED as Medium+ T1, the structural minimum forbids a Medium+
// room falling to a single wall. G6 rejects.
test('SOFT G6 (structural minimum): a par-1 room declared Medium+ (T1) is rejected by G6', () => {
  const r = assertRejectedBy(GT_CATCH.level, 'T1', 'G6');
  assert.match(
    r.failures.find((f) => f.id === 'G6').detail,
    /single wall|par 1 < 2|structural minimum/,
  );
});

// SOFT-G7 — FAILURE LEGIBILITY. The engine never returns a winning line whose frames
// are non-monotone or whose terminal frame still has an undelivered mover, so we
// exercise the G7 gate DIRECTLY with crafted frames: (a) a mover that un-delivers
// (non-monotone), (b) an aborted verdict, and (c) a clean win. Clean passes; the others
// are rejected.
test('SOFT G7 (failure legibility): non-monotone, aborted, and missing frames are rejected by G7 (direct)', () => {
  const G7 = getGate('G7');
  const level = { movers: [{}] };
  const clean = {
    frames: [
      { units: [{ id: 'm0', kind: 'mover', delivered: false }] },
      { units: [{ id: 'm0', kind: 'mover', delivered: true }] },
    ],
    outcome: 'win', aborted: false, level,
  };
  assert.equal(G7.run(clean).ok, true);

  // non-monotone: a delivered mover returns to live.
  const undeliver = {
    frames: [
      { units: [{ id: 'm0', kind: 'mover', delivered: true }] },
      { units: [{ id: 'm0', kind: 'mover', delivered: false }] },
    ],
    outcome: 'win', aborted: false, level,
  };
  const r1 = G7.run(undeliver);
  assert.equal(r1.ok, false);
  assert.match(r1.detail, /un-delivered|non-monotone/);

  // aborted verdict is illegible (UNKNOWN) → rejected.
  const aborted = G7.run({ frames: clean.frames, outcome: 'win', aborted: true, level });
  assert.equal(aborted.ok, false);
  assert.match(aborted.detail, /abort|UNKNOWN/);

  // no frames at all → rejected (a solution with no recorded story is illegible).
  assert.equal(G7.run({ frames: null, outcome: 'win', aborted: false, level }).ok, false);
});

// SOFT-G8 — ABSOLUTE DIFFICULTY FLOOR (the lesson: difficulty is not validity). GT_CATCH
// is THE CATCH structurally (no front wall) but is a TINY single-mover par-1 room — an
// eyeball-trivial board. DECLARED at the HARD tier (T3) it MUST fail the floor: the
// solver explores only a handful of nodes and the board is below the HARD magnitude
// minimum. Exactly the flat-tiny-room shape the floor forbids at the hard tier.
test('SOFT G8 (absolute floor): a tiny eyeball-trivial catch room declared T3 is rejected by G8', () => {
  const r = assertRejectedBy(GT_CATCH.level, 'T3', 'G8');
  assert.match(
    r.failures.find((f) => f.id === 'G8').detail,
    /eyeball-trivial|magnitude floor|board area|movers|par/,
  );
});

// ===========================================================================
// COVERAGE — every gate id is exercised by at least one SOFT rejection above.
// ===========================================================================
test('CONTRACT: every gate has a SOFT fixture that it rejects (no vacuous gate)', () => {
  // Direct-call gates: G4 (uniqueness) and G7 (legibility).
  assert.equal(getGate('G4').run({ par: 2, count: 2, unique: false, aborted: false, tier: 'T1' }).ok, false);
  assert.equal(getGate('G7').run({ frames: null, outcome: 'win', aborted: false, level: { movers: [{}] } }).ok, false);

  // Real-room rejections (target gate present in the failure set).
  const roomReject = [
    { level: { width: 3, height: 1, movers: [{ x: 0, y: 0, facing: 1 }], sinks: [[2, 0]], k: 2 }, tier: 'T0', target: 'G1' },
    { level: GT_CATCH.level, tier: 'T1', target: 'G3' },
    { level: GT_CATCH.level, tier: 'T1', target: 'G6' },
    { level: GT_JOINT.level, tier: 'T3', target: 'G5' },
    { level: GT_CATCH.level, tier: 'T3', target: 'G8' },
  ];
  for (const { level, tier, target } of roomReject) assertRejectedBy(level, tier, target);

  // G2 — an out-of-bounds board.
  assertRejectedBy(
    {
      width: 4, height: 4,
      movers: [{ x: 0, y: 0, facing: 1 }, { x: 1, y: 0, facing: 1 }, { x: 2, y: 0, facing: 1 }, { x: 3, y: 0, facing: 2 }],
      sinks: [[0, 3]], k: 4,
    },
    'T1', 'G2',
  );
});

// ===========================================================================
// VERBS-LOAD-BEARING — a board where the turn-rule deflection is vestigial (a mover
// sails straight to its sink, the wall does nothing the geometry did not already do) is
// rejected by G8 at the mid+ band. Proves the SPEC's movement-via-deflection verb must
// MATTER on the certified line.
// ===========================================================================
test('VERBS-LOAD-BEARING: a vestigial-deflection mid+ room is rejected by G8', () => {
  const G8 = getGate('G8');
  // Craft an analysis where the certified solution induces ZERO turns beyond the null
  // run (the deflection verb never fires) — G8's deflectionLoadBearing must reject it.
  // A straight corridor: mover already heads at the sink; the "solution" wall is on an
  // unrelated edge that changes no facing. We feed the gate a real level + a no-turn
  // solution by constructing a board the solver wins without any deflection.
  const straight = {
    width: 4, height: 1,
    movers: [{ x: 0, y: 0, facing: 1 /*E*/ }],
    sinks: [[3, 0]],
    k: 1,
  };
  // The null run already wins this (par 0) — but to isolate G8's deflection check we
  // call it with a hand-made analysis: a solution that wins with no turn. The contract
  // as a whole rejects `straight` at G1 (freebie); here we assert the *G8 verb check*
  // fires when handed a no-deflection winning line at a mid+ tier.
  const noTurnAnalysis = {
    level: straight,
    sw: { solution: [], nodes: 1 },
    par: 0,
    tier: 'T1',
  };
  const res = G8.run(noTurnAnalysis);
  assert.equal(res.ok, false);
  assert.match(res.detail, /vestigial|never fires|turn-rule|no certified solution/);
});
