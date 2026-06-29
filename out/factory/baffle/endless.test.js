// Baffle — ENDLESS generator verifier (node --test). Proves the infinite ladder
// always serves winnable, non-trivial, deterministic puzzles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endlessLevel } from './endless.js';
import { simulate } from './engine.js';

test('ENDLESS: generated levels are solvable, non-trivial (≥2 groynes), and within the engine ceiling', () => {
  for (const e of [0, 1, 5, 8, 13]) {
    const a = endlessLevel(e);
    assert.ok(a.level && a.level.width >= 4 && a.level.width <= 8, `endless ${e} has a sane board`);
    assert.ok(a.level.movers.length >= 1 && a.level.movers.length <= 3, `endless ${e} mover count in range`);
    assert.ok(a.par >= 2, `endless ${e} needs ≥2 groynes (par ${a.par})`);
    assert.notEqual(simulate(a.level, []).outcome, 'win', `endless ${e} null run does NOT already win`);
    assert.equal(simulate(a.level, a.solution).outcome, 'win', `endless ${e} certified solution wins under the engine`);
    assert.ok(a.solution.length <= a.level.k, `endless ${e} solution within the groyne budget k`);
  }
});

test('ENDLESS: deterministic — the same index yields the same puzzle for everyone (fresh state)', async () => {
  // distinct query strings → separate module instances → separate caches → a genuine
  // determinism check (not just the in-module cache returning the same object).
  const m1 = await import('./endless.js?fresh=a');
  const m2 = await import('./endless.js?fresh=b');
  assert.deepEqual(m1.endlessLevel(6).level, m2.endlessLevel(6).level, 'same index → identical level');
  assert.deepEqual(m1.endlessLevel(11).level, m2.endlessLevel(11).level, 'same index → identical level (deeper)');
});
