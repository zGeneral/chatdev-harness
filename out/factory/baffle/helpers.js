// Baffle — pure, DOM-free shell logic. Imported by app.js (browser glue) AND by
// shell.test.js (node --test, no browser). Determinism, streak, hint ladder, and
// label formatting live here so they are testable without a DOM. No raw hex.

// ───────────────────────── deterministic indexing ─────────────────────────
// A small, dependency-free integer hash over a string (FNV-1a-ish). Deterministic
// across clients: same input → same number, no RNG, no wall-clock.
export function strHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// DAILY: a UTC date string ("YYYY-MM-DD") → a fixed pack index. Same date → same
// level for everyone, no backend. (DESIGN.md §5.)
export function dailyIndex(dateKey, packLen) {
  if (!packLen) return 0;
  return strHash('baffle-daily:' + dateKey) % packLen;
}

// ENDLESS: a running seed counter → a pack index, deterministically. Each win
// advances the seed (app passes seed+1), so the stream is reproducible.
export function endlessIndex(seed, packLen) {
  if (!packLen) return 0;
  return strHash('baffle-endless:' + seed) % packLen;
}

// ───────────────────────── forward-path (no dead-ends) ─────────────────────────
// The REAL next-LEVEL transition (not a same-level helper). For curriculum the
// next index is i+1 clamped; endless advances the seed (handled by the caller),
// here we return the index it would map to is irrelevant — we expose the helpers
// the win path actually uses so the test asserts the genuine transition.
export function nextLevelIndex(pack, index, mode) {
  const n = pack.levels.length;
  if (mode === 'curriculum') return Math.min(index + 1, n - 1);
  // endless: the caller bumps the seed; the resulting index is endlessIndex(seed+1)
  return index; // unused for endless (seed-driven) — see app.wireNext
}

export function isLastLevel(pack, index) {
  return index >= pack.levels.length - 1;
}

// ───────────────────────── CLIMB ladder (ENDLESS progression + high score) ─────────────────────────
// Levels are played in order: the curated pack first, then INFINITELY many solver-
// generated levels (see endless.js) — the ladder NEVER tops out. `reached` = the
// highest UNLOCKED ladder index (0-based, UNBOUNDED); a level is playable iff its
// index <= reached. The high score the player chases is `reached + 1` (the furthest
// level reached). Clearing the FRONTIER (index === reached) unlocks the next one.
// `solved` is a set/array of solved ladder INDICES.
export function climbUnlocked(reached, idx) { return idx <= reached; }

// Where "Continue" jumps: the first UNLOCKED level not yet solved (the stage you got
// stuck on), else the frontier itself.
export function climbFrontier(reached, solvedIdx) {
  const solved = new Set(solvedIdx);
  for (let i = 0; i <= reached; i++) if (!solved.has(i)) return i;
  return reached;
}

// Clearing the frontier unlocks the next level (the high score climbs, unbounded);
// clearing an already-unlocked earlier level changes nothing. Pure.
export function advanceReached(reached, idx) {
  return idx === reached ? reached + 1 : reached;
}

// ───────────────────────── STARS (efficiency rating) + the star economy ─────────────────────────
// Each level has a solver-proven MINIMUM groyne count (par). Stars reward elegance:
//   par walls → ★★★ (perfect),  par+1 → ★★,  par+2 → ★.  The placement BUDGET is
// par+2 (the 1★ floor) so all three tiers are reachable — see app.js. A win always
// uses ≥ par walls (par is the minimum to win), so a win earns 1–3 stars.
export const STAR_BUDGET_OVER_PAR = 2;                 // budget = par + 2 (room for the 1★ tier)
export function levelCap(par) { return par + STAR_BUDGET_OVER_PAR; }
export function starsForWalls(par, used) {
  if (used <= par) return 3;
  if (used === par + 1) return 2;
  if (used <= par + STAR_BUDGET_OVER_PAR) return 1;
  return 0;                                            // over the cap (shouldn't happen)
}

// ── endless star totals (daily is NOT counted) ──
export function sumStars(map) { return Object.values(map || {}).reduce((a, b) => a + (b | 0), 0); }
// the all-3★ potential across every level the player has REACHED (unlocked).
export function climbStarPotential(reached) { return 3 * ((reached | 0) + 1); }

// ── daily gating + hint-token economy ──
export const DAILY_UNLOCK_STARS = 30;                  // daily opens after 30 endless stars
export const STARS_PER_TOKEN = 5;                      // 5 DAILY stars → 1 hint token
export function dailyUnlocked(climbStarsCollected) { return (climbStarsCollected | 0) >= DAILY_UNLOCK_STARS; }
export function hintTokensAvailable(totalDailyStars, tokensSpent) {
  return Math.max(0, Math.floor((totalDailyStars | 0) / STARS_PER_TOKEN) - (tokensSpent | 0));
}

// ───────────────────────── streak (grace by RULE, best retained) ─────────────────────────
// A streak survives EXACTLY ONE missed UTC day (grace by rule, never purchase).
// "best" is always retained alongside "current" so a break never erases history.
// dayKey is "YYYY-MM-DD" (UTC). Returns a NEW record (pure).
export function applyStreak(rec, today) {
  const cur = { current: rec.current | 0, best: rec.best | 0, lastDay: rec.lastDay || null };
  if (cur.lastDay === today) return cur; // already counted today — idempotent
  const gap = cur.lastDay ? daysBetween(cur.lastDay, today) : null;
  if (gap === null) {
    cur.current = 1; // first ever
  } else if (gap === 1) {
    cur.current += 1; // consecutive day
  } else if (gap === 2) {
    cur.current += 1; // ONE missed day is forgiven by the grace rule
  } else {
    cur.current = 1; // >1 missed day — streak resets, but best is kept
  }
  cur.best = Math.max(cur.best, cur.current);
  cur.lastDay = today;
  return cur;
}

export function daysBetween(a, b) {
  const ta = Date.UTC(...a.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)));
  const tb = Date.UTC(...b.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)));
  return Math.round((tb - ta) / 86400000);
}

// ───────────────────────── hint ladder (orient → eliminate → move → step) ─────────────────────────
// Solver-driven, EUREKA-SAFE: the early rungs only narrow/orient; the concrete
// placement (the answer) is revealed ONLY at the final rung. rung index 0 = no
// hint requested yet; 1..4 = orient/eliminate/move/step-through.
export function hintLadder(level, walls, rung, { simulate, solveWithStats }) {
  if (rung <= 0) return { title: 'Ready', text: 'Tap “Hint” for a nudge — it narrows before it tells.' };

  // RUNG 1 — ORIENT: name the goal & the rule, no board specifics.
  if (rung === 1) {
    return {
      title: 'Orient',
      text: 'Watch the faint trail: that is where the flock goes with your current groynes. A groyne only forbids an edge — the right-then-left-then-back rule picks the exit. Find where the trail misses the drain.',
    };
  }

  // Solve the level to know the par/solution (used to NARROW, not to reveal,
  // until the last rung). If unsolved-from-here, fall back to generic guidance.
  let stats = null;
  try { stats = solveWithStats(level, {}); } catch { /* defensive */ }

  // RUNG 2 — ELIMINATE: tell them how many groynes the line needs and where NOT
  // to waste them (a class of edges), without naming the answer edges.
  if (rung === 2) {
    const par = stats && stats.par != null ? stats.par : level.k;
    return {
      title: 'Eliminate',
      text: `The intended line uses about ${par} groyne${par === 1 ? '' : 's'}. Walling the edge directly in front of a tern is often the wrong model — a groyne deflects from BOTH sides, so look beside or behind the stream too.`,
    };
  }

  // RUNG 3 — MOVE: point at the REGION (a mover whose trail misses) without the
  // exact edge — "which tern to work on", still not the placement.
  if (rung === 3) {
    const target = firstMissingMover(level, walls, simulate);
    if (target) {
      return {
        title: 'Move',
        text: `Focus on the tern starting at ${cellName(target.x, target.y)} heading ${dirWord(target.facing)} — its trail is the one that misses. Bank IT, and the others may follow.`,
      };
    }
    return { title: 'Move', text: 'All terns nearly reach — you likely need ONE more groyne to break a loop or a collision. Look for where two trails cross.' };
  }

  // RUNG 4 — STEP-THROUGH: the eureka payoff — reveal one concrete placement from
  // the solver's solution that the player has NOT yet placed.
  const sol = stats && stats.solution ? stats.solution : [];
  const have = new Set(walls);
  const missing = sol.filter((e) => !have.has(e));
  if (missing.length) {
    const e = missing[0];
    const ends = edgeEndpoints(e);
    return {
      title: 'Step through',
      text: `Lay a groyne between ${cellName(ends.a.x, ends.a.y)} and ${cellName(ends.b.x, ends.b.y)}, then run and watch the rule bank the flock.`,
    };
  }
  return { title: 'Step through', text: 'Your groynes already match a winning line — press “Run the flock”.' };
}

function firstMissingMover(level, walls, simulate) {
  try {
    const r = simulate(level, walls);
    const last = r.frames && r.frames[r.frames.length - 1];
    if (!last) return level.movers[0];
    const undelivered = last.units.find((u) => u.kind === 'mover' && !u.delivered);
    if (undelivered) {
      // report its START cell (more orienting than a mid-run cell)
      const idx = +undelivered.id.slice(1);
      return level.movers[idx] || undelivered;
    }
  } catch { /* ignore */ }
  return level.movers[0];
}

// ───────────────────────── label formatting (meaningful, never raw indices) ─────────────────────────
// Cells get spreadsheet-style names (A1, B2…) — a human label, NEVER a raw index.
// col → letter, row → 1-based number.
export function cellName(x, y) {
  return `${String.fromCharCode(65 + x)}${y + 1}`;
}

export function dirWord(f) { return ['north', 'east', 'south', 'west'][f] || '?'; }

// Parse an engine edge key "x0,y0|x1,y1" → its two cell endpoints.
export function edgeEndpoints(ek) {
  const m = /^(\d+),(\d+)\|(\d+),(\d+)$/.exec(ek);
  if (!m) return null;
  return { a: { x: +m[1], y: +m[2] }, b: { x: +m[3], y: +m[4] } };
}

// A player-facing goal string — meaningful words, never enum numbers.
export function formatGoal(level) {
  const n = (level.movers || []).length;
  const s = (level.sinks || []).length;
  return `Bank ${n} tern${n === 1 ? '' : 's'} into the drain${s === 1 ? '' : 's'}`;
}
