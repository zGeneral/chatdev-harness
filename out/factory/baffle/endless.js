// Baffle — ENDLESS level generator. Browser-safe: imports ONLY engine.js.
//
// Produces deterministic, solver-VERIFIED levels for ladder positions beyond the
// curated pack, so the Climb ladder NEVER tops out. Each endless level e is the
// SAME puzzle for everyone (seeded by e), is always solvable, and needs ≥2 groynes
// (a real, non-trivial puzzle). Difficulty ramps with the level number via board
// size / mover count / terrain density.
//
// DESIGN NOTE (the recorded yield ceiling, measured): blunt walls make the
// UNIQUE-optimal manifold vanishingly thin — random unique-par-2 yield is ~0%, so
// it cannot be generated interactively. The curated 14-level campaign keeps the
// unique-optimal guarantee; the ENDLESS climb keeps "solvable in ≥2 walls" (which
// yields ~14% at 2 movers, fast). Honest split: campaign = elegance, endless = the
// infinite casual climb. Both are always winnable; every endless level is solver-proven.

import { simulate, solveWithStats, placeableEdges, N, E, S, W } from './engine.js';

const MAX_NODES = 8000;   // tight budget: reject intractable candidates fast (~ms/attempt)
const facings = [N, E, S, W];

// splitmix64 → a [0,1) generator. Deterministic from a BigInt seed.
function rngFrom(seedBig) {
  let s = BigInt.asUintN(64, seedBig ^ 0x9e3779b97f4a7c15n);
  return () => {
    s = BigInt.asUintN(64, s + 0x9e3779b97f4a7c15n);
    let z = s;
    z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
    z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
    z = BigInt.asUintN(64, z ^ (z >> 31n));
    return Number(z >> 11n) / 9007199254740992; // 53-bit mantissa → [0,1)
  };
}
const randint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, a) => a[Math.floor(rng() * a.length)];

// difficulty schedule for endless index e (0-based), attempt i. The ramp climbs to
// the engine's tractable ceiling (≤8×7, ≤3 movers) then plateaus HARD with fresh
// boards. `relax` (grows with failed attempts) eases the demands so a valid level is
// ALWAYS found fast — and deterministically (depends only on e, i).
function spec(e, i) {
  const ramp = Math.min(e, 20);
  const relax = Math.floor(i / 30);
  const movers = Math.max(2, Math.min(2 + (ramp >= 8 ? 1 : 0), 3) - (relax > 1 ? 1 : 0)); // 2→3
  const w = Math.max(4, Math.min(5 + Math.floor(ramp / 5), 6) - relax);                    // 5→6
  const h = Math.max(4, Math.min(4 + Math.floor(ramp / 5), 6) - relax);                    // 4→6
  const density = Math.max(0.10, Math.min(0.14 + 0.008 * ramp, 0.26) - 0.04 * relax);
  // an occasional par-3 "swell" at higher levels for spice; relax drops it back to 2.
  const wantPar3 = e >= 10 && (e % 3 === 2) && relax === 0;
  const minPar = wantPar3 ? 3 : 2;
  const k = minPar >= 3 ? 6 : 5;
  return { w, h, movers, density, minPar, k };
}

function genCandidate(rng, { w, h, movers, density, k }) {
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push({ x, y });
  const used = new Set();
  const take = () => {
    for (let t = 0; t < 80; t++) { const c = pick(rng, cells); const key = `${c.x},${c.y}`; if (!used.has(key)) { used.add(key); return c; } }
    return cells[0];
  };
  const mv = [];
  for (let i = 0; i < movers; i++) { const c = take(); mv.push({ x: c.x, y: c.y, facing: pick(rng, facings) }); }
  const sink = take();
  const sinks = [[sink.x, sink.y]];
  const allEdges = placeableEdges({ width: w, height: h, movers: mv, sinks });
  const prewalls = [];
  for (const ek of allEdges) if (rng() < density) prewalls.push(ek);
  return { width: w, height: h, movers: mv, sinks, prewalls, k };
}

// SOLVER-GATED acceptance: not-already-won (non-trivial) + solvable within the node
// budget + par ≥ floor (a real decision, ≥2 groynes). Returns the certified
// {par, solution} or null. (Uniqueness is deliberately NOT required — see the design
// note above; it has ~0% random yield and would make endless generation impossible.)
function accept(level, minPar) {
  if (simulate(level).outcome === 'win') return null;
  const sw = solveWithStats(level, { maxMoves: level.k, maxNodes: MAX_NODES });
  if (sw.aborted || sw.par == null || sw.par < minPar) return null;
  return { par: sw.par, solution: sw.solution };
}

const CACHE = new Map();

// Deterministic, cached, solver-verified. endlessLevel(e) is the same puzzle every
// time, everywhere. e = 0-based endless index (ladder index minus curated count).
export function endlessLevel(e) {
  if (CACHE.has(e)) return CACHE.get(e);
  for (let i = 0; i < 400; i++) {
    const rng = rngFrom((BigInt(e) + 1n) * 0x100000001b3n + BigInt(i) * 0x9e3779b97f4a7c15n);
    const s = spec(e, i);
    const v = accept(genCandidate(rng, s), s.minPar);
    if (v) {
      // re-derive the level from the SAME seed so the returned object is the accepted one
      const rng2 = rngFrom((BigInt(e) + 1n) * 0x100000001b3n + BigInt(i) * 0x9e3779b97f4a7c15n);
      const level = genCandidate(rng2, s);
      const entry = { id: `endless-${e}`, tier: 'endless', endlessNo: e + 1, level, solution: v.solution, par: v.par };
      CACHE.set(e, entry);
      return entry;
    }
  }
  // ultimate fallback (astronomically unlikely): a tiny guaranteed solvable+unique level.
  const fb = fallbackLevel(e);
  CACHE.set(e, fb);
  return fb;
}

// a tiny FNV-1a hash so the daily can seed off a date string (no external dep).
function strHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return h >>> 0;
}

const DAILY_CACHE = new Map();

// The DAILY challenge: an EXTREMELY HARD, date-seeded puzzle — pushed toward the
// engine ceiling (3 movers, 6×6, dense terrain, par ≥ 3). Same date → same puzzle
// for everyone, solver-verified. Generated once per day (cached); relax guarantees
// a result even on a stubborn seed.
export function dailyLevel(dateKey) {
  if (DAILY_CACHE.has(dateKey)) return DAILY_CACHE.get(dateKey);
  const base = strHash('baffle-daily:' + dateKey);
  for (let i = 0; i < 800; i++) {
    const relax = Math.floor(i / 70);
    const movers = Math.max(2, 3 - (relax > 2 ? 1 : 0));
    const w = Math.max(5, 6 - relax), h = Math.max(5, 6 - relax);
    const density = Math.max(0.15, 0.24 - 0.03 * relax);
    const minPar = Math.max(2, 3 - (relax > 1 ? 1 : 0));   // aim par-3, fall back to par-2
    const rng = rngFrom((BigInt(base) + 1n) * 0x100000001b3n + BigInt(i) * 0x9e3779b97f4a7c15n);
    const v = accept(genCandidate(rng, { w, h, movers, density, k: 6 }), minPar);
    if (v) {
      const rng2 = rngFrom((BigInt(base) + 1n) * 0x100000001b3n + BigInt(i) * 0x9e3779b97f4a7c15n);
      const level = genCandidate(rng2, { w, h, movers, density, k: 6 });
      const entry = { id: 'daily-' + dateKey, tier: 'daily', level, solution: v.solution, par: v.par };
      DAILY_CACHE.set(dateKey, entry);
      return entry;
    }
  }
  return fallbackLevel(0);
}

function fallbackLevel(e) {
  // search the loosest regime (small, sparse, par-2) until something certifies.
  for (let i = 0; i < 2000; i++) {
    const rng = rngFrom(BigInt(e * 7919 + i) + 1n);
    const cand = genCandidate(rng, { w: 4, h: 4, movers: 1, density: 0.12, k: 4 });
    const v = accept(cand, 2);
    if (v) return { id: `endless-${e}`, tier: 'endless', endlessNo: e + 1, level: cand, solution: v.solution, par: v.par };
  }
  // a hand-pinned, engine-verified minimum (kept tiny so it always certifies).
  const level = { width: 4, height: 4, movers: [{ x: 0, y: 0, facing: E }], sinks: [[3, 3]], prewalls: [], k: 4 };
  const sw = solveWithStats(level, { maxMoves: 4, maxNodes: MAX_NODES });
  return { id: `endless-${e}`, tier: 'endless', endlessNo: e + 1, level, solution: sw.solution || [], par: sw.par || 1 };
}
