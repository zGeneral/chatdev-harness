// Baffle — shell verifier (node --test, logic/DOM-string only — no browser).
// Reads the BUILT files and asserts DESIGN.md §6 "testable UI contract" plus the
// determinism / grace-streak / hint-eureka / real-next-level rules. Gated like
// every other stage by the independent `node --test` re-run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  dailyIndex, endlessIndex, nextLevelIndex, isLastLevel,
  climbUnlocked, climbFrontier, advanceReached,
  levelCap, starsForWalls, sumStars, climbStarPotential,
  hintTokensAvailable, dailyUnlocked, DAILY_UNLOCK_STARS, STARS_PER_TOKEN,
  applyStreak, hintLadder, cellName, edgeEndpoints, formatGoal,
} from './helpers.js';
import { simulate, solveWithStats } from './engine.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(DIR, f), 'utf8');
const PACK = JSON.parse(read('pack.json'));

// ───────────────────────── §6 TESTABLE UI CONTRACT (read built files) ─────────────────────────

test('UI: DESIGN.md exists and freezes the per-game constraints', () => {
  assert.ok(existsSync(join(DIR, 'DESIGN.md')), 'DESIGN.md must exist in the game dir');
  const d = read('DESIGN.md');
  assert.match(d, /tokens|palette/i);
  assert.match(d, /prefers-reduced-motion/);
});

test('UI: a tokens stylesheet exists and index.html references it', () => {
  assert.ok(existsSync(join(DIR, 'tokens.css')), 'tokens.css must exist');
  const html = read('index.html');
  assert.match(html, /href=["']tokens\.css["']/, 'index.html must <link> tokens.css');
});

test('UI: tokens.css defines the required token taxonomy (colour/type/space/motion)', () => {
  const css = read('tokens.css');
  for (const tok of ['--bg', '--surface', '--fg', '--muted', '--accent', '--on-accent',
    '--success', '--warn', '--mover', '--wall', '--line-hi', '--line-lo',
    '--fs-1', '--sp-2', '--dur-fast', '--ease-out', '--board-fit', '--tap-min', '--cell-cap']) {
    assert.ok(css.includes(tok), `tokens.css must define ${tok}`);
  }
});

test('UI: no raw hex in app.js (component code uses var(--…) only)', () => {
  const app = read('app.js');
  // strip line comments so a hex in a comment never trips the gate
  const code = app.replace(/\/\/[^\n]*/g, '');
  const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], `app.js must contain no raw hex colours; found ${hex.join(', ')}`);
});

test('UI: interactive edges carry role + aria-label + aria-pressed AND a non-colour data-state', () => {
  const app = read('app.js');
  assert.match(app, /role="button"/, 'edges need role=button');
  assert.match(app, /aria-label=/, 'edges need an aria-label');
  assert.match(app, /aria-pressed=/, 'edges need aria-pressed (placed/empty)');
  assert.match(app, /data-state=/, 'edges need a non-colour data-state');
  // a non-colour glyph differentiator for placed vs empty (knob/notch), not hue alone
  assert.match(app, /wall-knob/, 'placed edges need a non-colour glyph marker');
});

test('UI: the groyne hit target is actually hittable (stroke paint + pointer-events) — core verb reachable by pointer/tap', () => {
  // REGRESSION GUARD (UX:FAIL root cause): an SVG <line> with `stroke:none` has
  // ZERO hit area — `stroke-width` is inert without a stroke paint. The edge-hit
  // MUST carry a (transparent) stroke AND pointer-events so a real tap/click lays
  // a groyne. Without this the core verb is unreachable on every viewport.
  const css = read('styles.css');
  const block = /\.edge-hit\s*(?::focus-visible)?\s*\{[^}]*\}/g;
  const editBlock = (css.match(/\.edge-hit\s*\{[^}]*\}/) || [''])[0];
  assert.ok(editBlock, '.edge-hit rule must exist');
  assert.match(editBlock, /stroke\s*:/, '.edge-hit needs a stroke paint (stroke:none = 0 hit area)');
  assert.doesNotMatch(editBlock, /stroke\s*:\s*none/, '.edge-hit must NOT set stroke:none (kills the hit area)');
  assert.match(editBlock, /pointer-events\s*:\s*(stroke|all|visibleStroke|painted)/,
    '.edge-hit needs pointer-events: stroke|all so the fat invisible line is hittable');
  void block; // (kept for future per-rule checks)
});

test('UI: decoration does NOT swallow the edge tap (gridlines/units/ghost are pointer-transparent)', () => {
  // The gridlines are drawn over the cells and the units/knob are drawn over the
  // edges; any of them with default pointer-events steals the click from the
  // interactive edge-hit. Each decorative layer must opt out of hit-testing.
  const css = read('styles.css');
  for (const sel of ['.gridline-hi', '.gridline-lo']) {
    const rule = new RegExp(sel.replace('.', '\\.') + '\\s*\\{[^}]*\\}');
    const m = (css.match(rule) || [''])[0];
    assert.match(m, /pointer-events\s*:\s*none/, `${sel} must be pointer-events:none so it never swallows the groyne tap`);
  }
  // the placed-knob glyph and the unit/mover layer (drawn on top) must also opt out
  assert.match(css, /\.wall-knob\s*\{[^}]*pointer-events\s*:\s*none/, '.wall-knob must not block lifting a placed groyne');
  assert.match(css, /\.unit[^{]*\{[^}]*pointer-events\s*:\s*none/, 'units drawn on top must not block edge taps');
});

test('UI: keyboard focus ring is rendered ON the focused edge (not via an unmatchable sibling combinator)', () => {
  // BLOCKER 6: the focus indicator must be a ring/stroke larger than the hairline.
  // The previous `.edge-hit:focus-visible + .edge-vis` combinator could never match
  // (.edge-vis is rendered BEFORE .edge-hit in source order). The ring must be a
  // direct property of .edge-hit:focus-visible.
  const css = read('styles.css');
  const fv = (css.match(/\.edge-hit:focus-visible\s*\{[^}]*\}/) || [''])[0];
  assert.ok(fv, '.edge-hit:focus-visible rule must exist');
  assert.match(fv, /stroke\s*:|outline\s*:\s*(?!none)/, 'the focused edge needs a visible direct focus ring (stroke/outline), not a sibling combinator');
});

test('UI: CSS contains a prefers-reduced-motion block', () => {
  const css = read('tokens.css') + read('styles.css');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('UI: a :focus-visible style exists', () => {
  const css = read('styles.css');
  assert.match(css, /:focus-visible/);
});

test('UI: two-tone gridline tokens both used (WCAG 1.4.11 non-text contrast)', () => {
  const css = read('styles.css');
  assert.match(css, /gridline-hi/);
  assert.match(css, /gridline-lo/);
});

test('UI: the goal line / budget chip render ABOVE the board in source order', () => {
  const app = read('app.js');
  const goalAt = app.indexOf('class="statusbar"');
  const boardAt = app.indexOf('class="board-wrap"');
  assert.ok(goalAt > -1 && boardAt > -1 && goalAt < boardAt,
    'the statusbar/goal must precede the board in the play template');
});

test('UI: motion is eased, never linear, behind reduced-motion (DESIGN.md §3)', () => {
  const css = read('styles.css') + read('tokens.css');
  assert.match(css, /cubic-bezier/, 'easing curves required (no linear translation)');
  assert.doesNotMatch(read('styles.css'), /transition:[^;]*\blinear\b/, 'no linear transitions on UI');
});

// ───────────────────────── COMPREHENSION & IDENTITY ─────────────────────────

test('COMPREHENSION: targets/state render as meaningful glyphs/words, never raw engine indices', () => {
  const app = read('app.js');
  // movers are drawn as a glyph with a heading WORD, sinks as a target ring;
  // labels use cellName (A1…) not a bare index.
  assert.match(app, /mover-glyph/, 'movers drawn as a glyph');
  assert.match(app, /sink-ring/, 'sinks drawn as a target ring');
  assert.match(app, /cellName\(/, 'cells labelled with human names, not raw indices');
  // formatGoal must produce a WORD goal, never an enum number as the label
  const goal = formatGoal(PACK.levels[0].level);
  assert.match(goal, /tern/);
  assert.doesNotMatch(goal, /facing\s*[0-3]\b/);
});

test('IDENTITY: a deliberate theme + teaching surface (legend) is present', () => {
  const app = read('app.js');
  assert.match(app, /How Baffle works/, 'a first-run legend / how-to-play panel teaches the mechanic');
  assert.match(app, /right first, then left, then back/i, 'the legend states the turn-rule');
  // visual identity: terns / groynes / drain — not "cell"/"square"
  assert.match(read('DESIGN.md'), /Drift & Drain|tern|groyne/i);
});

// ───────────────────────── DETERMINISM (daily seed → identical level) ─────────────────────────

test('DETERMINISM: same UTC date → identical daily level index (no backend)', () => {
  const n = PACK.levels.length;
  const a = dailyIndex('2026-06-29', n);
  const b = dailyIndex('2026-06-29', n);
  assert.equal(a, b, 'same date must map to the same level');
  // different dates generally differ; at least the mapping is stable & in range
  assert.ok(a >= 0 && a < n);
  assert.ok(dailyIndex('2026-06-30', n) >= 0);
  // endless is reproducible per seed
  assert.equal(endlessIndex(5, n), endlessIndex(5, n));
});

test('DETERMINISM: the chosen daily level itself replays byte-identically (engine R7)', () => {
  const idx = dailyIndex('2026-06-29', PACK.levels.length);
  const lvl = PACK.levels[idx];
  const r1 = simulate(lvl.level, lvl.solution);
  const r2 = simulate(lvl.level, lvl.solution);
  assert.equal(r1.traceHash, r2.traceHash);
  assert.equal(r1.outcome, 'win', 'the baked solution must win under the engine');
});

// ───────────────────────── GRACE-STREAK RULE ─────────────────────────

test('STREAK: a streak survives exactly one missed day (grace by rule)', () => {
  let s = { current: 0, best: 0, lastDay: null };
  s = applyStreak(s, '2026-06-01'); // first
  assert.deepEqual([s.current, s.best], [1, 1]);
  s = applyStreak(s, '2026-06-02'); // consecutive
  assert.deepEqual([s.current, s.best], [2, 2]);
  s = applyStreak(s, '2026-06-04'); // ONE missed day (the 3rd) — forgiven
  assert.equal(s.current, 3, 'one missed day is forgiven by the grace rule');
  assert.equal(s.best, 3);
});

test('STREAK: two+ missed days reset current but BEST is retained (never a bare-zero erase)', () => {
  let s = { current: 5, best: 5, lastDay: '2026-06-01' };
  s = applyStreak(s, '2026-06-05'); // 3 missed days
  assert.equal(s.current, 1, 'streak resets after >1 missed day');
  assert.equal(s.best, 5, 'best is retained alongside current — history never erased');
});

test('STREAK: same-day re-solve is idempotent (no double count, no purchase repair)', () => {
  let s = { current: 2, best: 2, lastDay: '2026-06-10' };
  s = applyStreak(s, '2026-06-10');
  assert.deepEqual([s.current, s.best], [2, 2]);
});

// ───────────────────────── HINT EUREKA-INTEGRITY ─────────────────────────

test('HINT: early rungs narrow/orient and do NOT reveal a concrete placement', () => {
  const lvl = PACK.levels.find((l) => l.tier !== 'T0') || PACK.levels[0];
  for (const rung of [1, 2, 3]) {
    const h = hintLadder(lvl.level, [], rung, { simulate, solveWithStats });
    // an early rung must not name a concrete "between X and Y" placement (the answer)
    const namesPlacement = /between\s+[A-H]\d+\s+and\s+[A-H]\d+/.test(h.text)
      || /Lay a groyne between/.test(h.text);
    assert.ok(!namesPlacement, `rung ${rung} must not reveal the concrete placement`);
  }
});

test('HINT: only the final rung (4) reveals an actual solver placement', () => {
  const lvl = PACK.levels.find((l) => l.solution && l.solution.length) || PACK.levels[0];
  const h = hintLadder(lvl.level, [], 4, { simulate, solveWithStats });
  assert.match(h.title, /Step through/i);
  // it must name a concrete edge between two real cells (the eureka payoff)
  assert.match(h.text, /between\s+[A-H]\d+\s+and\s+[A-H]\d+/);
});

test('HINT: the revealed placement is a real edge on a winning line (solver-grounded)', () => {
  const lvl = PACK.levels.find((l) => l.solution && l.solution.length) || PACK.levels[0];
  const stats = solveWithStats(lvl.level, {});
  assert.ok(stats.solution && stats.solution.length, 'solver finds a line');
  // the rung-4 edge must be one of the solver's solution edges (not invented)
  const h = hintLadder(lvl.level, [], 4, { simulate, solveWithStats });
  const m = /between\s+([A-H])(\d+)\s+and\s+([A-H])(\d+)/.exec(h.text);
  assert.ok(m, 'rung 4 names a concrete edge');
  // reconstruct the edge endpoints from the human names and confirm it's a solver edge
  const toCell = (col, row) => ({ x: col.charCodeAt(0) - 65, y: +row - 1 });
  const a = toCell(m[1], m[2]), b = toCell(m[3], m[4]);
  const present = stats.solution.some((ek) => {
    const e = edgeEndpoints(ek);
    return e && ((e.a.x === a.x && e.a.y === a.y && e.b.x === b.x && e.b.y === b.y)
      || (e.a.x === b.x && e.a.y === b.y && e.b.x === a.x && e.b.y === a.y));
  });
  assert.ok(present, 'the revealed edge lies on the solver line');
});

// ───────────────────────── REAL NEXT-LEVEL FLOW (no dead-ends, no false green) ─────────────────────────

test('PROGRESSION: curriculum win advances to the NEXT LEVEL index (real transition, not a same-level helper)', () => {
  // assert the genuine next-LEVEL index, distinct from the current one
  for (let i = 0; i < PACK.levels.length - 1; i++) {
    const ni = nextLevelIndex(PACK, i, 'curriculum');
    assert.equal(ni, i + 1, `curriculum at level ${i} must advance to ${i + 1}, got ${ni}`);
    assert.notEqual(ni, i, 'next-level must NOT be the same level (false-green trap)');
    assert.ok(PACK.levels[ni], 'the next level entry exists');
    assert.notEqual(PACK.levels[ni].id, PACK.levels[i].id, 'a distinct level id');
  }
});

test('PROGRESSION: the last level is tagged terminal so the pack shows an end-of-pack state', () => {
  assert.ok(isLastLevel(PACK, PACK.levels.length - 1), 'last index is terminal');
  assert.ok(!isLastLevel(PACK, 0), 'first index is not terminal');
});

test('CLIMB: only levels up to the furthest reached are unlocked (locks past the frontier)', () => {
  assert.ok(climbUnlocked(3, 0) && climbUnlocked(3, 3), 'reached levels are unlocked');
  assert.ok(!climbUnlocked(3, 4) && !climbUnlocked(3, 13), 'levels beyond reached are LOCKED');
});

test('CLIMB: clearing the FRONTIER unlocks the next; the ladder is ENDLESS (no cap)', () => {
  assert.equal(advanceReached(3, 3), 4, 'clearing the frontier (idx===reached) unlocks the next');
  assert.equal(advanceReached(3, 1), 3, 'clearing an already-unlocked earlier level changes nothing');
  assert.equal(advanceReached(99, 99), 100, 'no top — clearing the frontier always unlocks the next');
  assert.equal(advanceReached(13, 13), 14, 'clearing the last CURATED level opens the endless climb');
});

test('STARS: budget = par+2; walls→stars (par=★★★, +1=★★, +2=★)', () => {
  assert.equal(levelCap(2), 4, 'budget is par+2 (room for the 1★ tier)');
  assert.equal(starsForWalls(2, 2), 3, 'par walls → 3 stars');
  assert.equal(starsForWalls(2, 3), 2, 'par+1 → 2 stars');
  assert.equal(starsForWalls(2, 4), 1, 'par+2 → 1 star');
  assert.equal(starsForWalls(2, 1), 3, 'under par stays a 3★ forecast');
  assert.equal(starsForWalls(2, 5), 0, 'over the cap → 0 (cannot happen in play)');
});

test('STARS: endless star total vs potential (3★ × levels reached); daily excluded', () => {
  assert.equal(sumStars({ 0: 3, 1: 2, 5: 1 }), 6);
  assert.equal(climbStarPotential(0), 3, '1 level unlocked → 3 potential');
  assert.equal(climbStarPotential(13), 42, '14 levels → 42 potential');
});

test('STARS: daily unlocks at 30 climb stars; 5 daily stars → 1 hint token', () => {
  assert.equal(DAILY_UNLOCK_STARS, 30);
  assert.equal(dailyUnlocked(29), false);
  assert.equal(dailyUnlocked(30), true);
  assert.equal(STARS_PER_TOKEN, 5);
  assert.equal(hintTokensAvailable(12, 0), 2, '12 daily stars → 2 tokens');
  assert.equal(hintTokensAvailable(12, 1), 1, 'minus 1 spent');
  assert.equal(hintTokensAvailable(4, 0), 0, 'under 5 → 0 tokens');
  assert.equal(hintTokensAvailable(10, 5), 0, 'never negative');
});

test('CLIMB: "Continue" resumes at the stage you got stuck on (first unsolved unlocked level)', () => {
  assert.equal(climbFrontier(3, [0, 1]), 2, 'first unsolved at/under reached is the resume point');
  assert.equal(climbFrontier(3, [0, 1, 2, 3]), 3, 'all-solved up to reached → the frontier itself');
  assert.equal(climbFrontier(0, []), 0, 'fresh player resumes at level 1');
  assert.equal(climbFrontier(20, [0, 1, 2]), 3, 'deep into the endless climb, resume at the first gap');
});

test('PROGRESSION: endless win advances the seed → a (re-derivable) next level, never a dead-end', () => {
  const n = PACK.levels.length;
  // the app advances seed→seed+1; the resulting index is deterministic and valid.
  for (const seed of [1, 2, 7, 13]) {
    const ni = endlessIndex(seed + 1, n);
    assert.ok(ni >= 0 && ni < n, 'endless next index is a valid level');
  }
  // and it is reproducible (determinism), so "next" is a real forward path
  assert.equal(endlessIndex(8, n), endlessIndex(8, n));
});

test('PROGRESSION: every mode renders a forward affordance on win (no menu-only dead-end)', () => {
  const app = read('app.js');
  // daily → curriculum/“done for today”; curriculum/endless → Next level; last → end-of-pack
  assert.match(app, /Next level/, 'a Next-level affordance exists');
  assert.match(app, /Keep climbing|#\/climb/, 'daily win offers a forward path (into the climb)');
  assert.match(app, /Finish the pack|end-of-pack|endcap/i, 'a tasteful end-of-pack state exists');
  // the win path must NOT be only a back-to-menu button
  assert.match(app, /nextAffordanceHTML/, 'win renders a mode-specific forward affordance');
});

// ───────────────────────── budget / engine-grounding sanity ─────────────────────────

test('ENGINE-GROUNDING: every baked level’s solution wins and respects the k budget', () => {
  for (const l of PACK.levels) {
    assert.ok(l.solution.length <= l.level.k, `${l.id}: solution within budget k=${l.level.k}`);
    const r = simulate(l.level, l.solution);
    assert.equal(r.outcome, 'win', `${l.id}: baked solution must win`);
  }
});

test('LABELS: cellName never emits a bare engine index; edgeEndpoints round-trips', () => {
  assert.equal(cellName(0, 0), 'A1');
  assert.equal(cellName(2, 3), 'C4');
  const e = edgeEndpoints('1,2|1,3');
  assert.deepEqual(e, { a: { x: 1, y: 2 }, b: { x: 1, y: 3 } });
});
