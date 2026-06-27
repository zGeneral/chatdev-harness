// TEMPLATE — server-side validation contract for the one-Worker ship's
// comment API (validateComment in worker.js, this file's sibling). Run with
// `node --test`. Pattern: skills/ship-web-game.
//
// Why a test and not a code review: validation is the trust boundary — every
// write the server accepts must be proven safe. Four row types every shipped
// validator needs: minimal-happy, full-happy, old-client-compat, and
// precise-reason rejects. (Against the worker.js TEMPLATE's TODO stub these
// fail RED until you implement validateComment — that is the point.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateComment } from './worker.js';

test('accepts ratings (ints 1-5 per dimension) and capped text', () => {
  const r = validateComment({
    user: 'Tester', lv: 'L1',
    ratings: { fun: 4, difficulty: 5, fair: 3 },
    text: 'tough!', v: '1.0.0',
  });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.comment.ratings, { fun: 4, difficulty: 5, fair: 3 });
  // minimal-happy: a single rating alone is a valid submission
  assert.equal(validateComment({ user: 'a', lv: 'L1', ratings: { fun: 5 } }).ok, true);
});

test('clamps over-long text rather than rejecting', () => {
  const long = validateComment({ user: 'a', lv: 'L1', text: 'y'.repeat(900) });
  assert.equal(long.ok, true);
  assert.equal(long.comment.text.length, 500, 'text clamped to the cap');
});

test('rejects junk with a precise reason and never throws', () => {
  assert.equal(validateComment(null).ok, false);
  assert.equal(validateComment([]).ok, false);
  assert.equal(validateComment({ user: '', lv: 'L1', text: 'x' }).ok, false, 'empty user');
  assert.equal(validateComment({ user: 'a', lv: '', text: 'x' }).ok, false, 'empty level');
  assert.equal(validateComment({ user: 'a', lv: 'L1' }).ok, false, 'no rating AND no text');
  assert.equal(validateComment({ user: 'a', lv: 'L1', ratings: { fun: 9 } }).ok, false, 'out of range');
  assert.equal(validateComment({ user: 'a', lv: 'L1', ratings: { fun: 2.5 } }).ok, false, 'non-integer');
  assert.equal(validateComment({ user: 'a', lv: 'L1', ratings: { bogus: 3 } }).ok, false, 'unknown dimension');
});

test('old clients (no later-added fields) validate exactly as before', () => {
  // Schema evolution is additive (skills/ship-web-game + replay-harness): any
  // field added later — a regret probe, an attached replay, behavior telemetry
  // — is OPTIONAL, validated by this same precise-reason pattern, and its
  // ABSENCE never changes the verdict for a prior-shape body. Nothing invented.
  const v = validateComment({ user: 'a', lv: 'L1', ratings: { fair: 2 }, text: 'hm' });
  assert.equal(v.ok, true);
});
