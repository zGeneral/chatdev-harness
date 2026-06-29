// Baffle — PLAYABILITY GATE measurement (graphs/oracleforge/design/playability.md).
//
// "Is this worth playing?", MEASURED — from the SAME solver/engine the pipeline
// built (engine.js), over the baked pack (pack.json). No new judgment, no second
// oracle: every number below is computed through solveWithStats / countSolutions /
// simulate / evaluate / placeableEdges — the exact functions the baker certified
// with. Emits playability.json (the measured report). The PASS thresholds from
// playability.md §gate are asserted in playability.test.js.
//
// Dimensions measured (playability.md §Measurable signals + §gate):
//   - par-ramp distribution (distinct par values, histogram)
//   - unique-optimal % (countSolutions tri-state)
//   - greedy / straight-aim regret % on the non-trivial (par≥2) levels
//   - technique-tier spread (front / shared / deadEnd / catch — the SPEC ladder)
//   - pack size vs curriculum insight count
//   - ABSOLUTE on-ramp FLOOR (easiest par + count of genuinely easy/teaching levels)
//   - HARD-CEILING FLOOR (top-tier decision-space proxy: explored-node count +
//     board/entity/turn magnitude — the pack must RAMP to genuinely hard)
//   - VERBS-LOAD-BEARING (every core SPEC verb matters: WALL-DENY + TURN-RULE
//     deflection + MOVEMENT — none vestigial)
//   - CURRICULUM DISTINCTNESS (every level a UNIQUE canonical signature, invariant
//     under translation AND the 8 dihedral symmetries; per-tier structural variety)
//   - SOUL-NECESSITY (ablate the soul inference rule, re-census, measure load-bearing)

import {
  simulate, evaluate, isWin, solveWithStats, countSolutions,
  placeableEdges, edgeKey, solveArrows, N, E, S, W,
} from './engine.js';

import pack from './pack.json' with { type: 'json' };

// ───────────────────────── solver budget ─────────────────────────
// The ceiling boards (≤8x8, k≤6) certify without abort under a generous budget
// (matches contract.js MAX_NODES_DEFAULT). A verdict under an abort is rejected.
const MAX_NODES = 200000;

// ───────────────────────── canonical dihedral+translation signature ─────────────────────────
// CURRICULUM DISTINCTNESS (playability.md §gate). Two levels are the SAME puzzle if
// one is a translation and/or one of the 8 dihedral symmetries (4 rotations × 2
// reflections) of the other — same relative entity formation + relevant terrain +
// the certified solution's structure. We build a canonical key that is INVARIANT
// under that group, so isomorphic reskins collapse to one signature.
//
// The signature is computed over the level's ESSENCE: mover cells+facings, sink
// cells, hunter cells+facings, the placeable interior walls that the CERTIFIED
// SOLUTION actually uses (the solution's structure), and the pre-walls. Each of the
// 8 transforms remaps every cell (x,y) and every facing; we then translate so the
// min corner is at the origin (translation invariance) and take the
// lexicographically smallest string over all 8 transforms (dihedral invariance).

// A facing under the dihedral group. Facings: 0=N,1=E,2=S,3=W (CW). The 8 elements
// of D4 act on (x,y) within a W×H box and on facings consistently.
// We parameterize each transform by (rot in 0..3, flip in {false,true}).
function transformPoint(x, y, w, h, rot, flip) {
  // optional horizontal flip first (x -> w-1-x), then rotate by rot*90° CW.
  let px = flip ? (w - 1 - x) : x;
  let py = y;
  let W = w, H = h;
  for (let r = 0; r < rot; r++) {
    // 90° CW rotation in a W×H grid: (x,y) -> (H-1-y, x), dims swap.
    const nx = H - 1 - py;
    const ny = px;
    px = nx; py = ny;
    const t = W; W = H; H = t;
  }
  return { x: px, y: py };
}
function transformFacing(f, rot, flip) {
  // flip horizontally: N<->N, S<->S, E<->W (0->0,2->2,1->3,3->1).
  let nf = f;
  if (flip) nf = (nf === E) ? W : (nf === W) ? E : nf;
  // rotate CW by rot quarter-turns: N->E->S->W (add rot mod 4).
  nf = (nf + rot) & 3;
  return nf;
}

// Canonicalize the SOLUTION walls into the same relative space: a wall is an
// undirected edge between two cells. We transform both endpoints, re-derive the
// canonical edge key, then translate the whole token-set so the bounding box min is
// at origin. Returns a sorted, translation-normalized token string for one transform.
function edgeEndpoints(ek) {
  const [a, b] = ek.split('|');
  const [ax, ay] = a.split(',').map(Number);
  const [bx, by] = b.split(',').map(Number);
  return [{ x: ax, y: ay }, { x: bx, y: by }];
}
function canonEdge(p, q) {
  // canonical undirected edge string (lexicographic endpoint order)
  if (p.x < q.x || (p.x === q.x && p.y < q.y)) return `${p.x},${p.y}|${q.x},${q.y}`;
  return `${q.x},${q.y}|${p.x},${p.y}`;
}

function signatureForTransform(level, solution, w, h, rot, flip) {
  const tokens = [];
  const allX = [], allY = [];
  const tp = (x, y) => transformPoint(x, y, w, h, rot, flip);

  for (const m of level.movers || []) {
    const p = tp(m.x, m.y);
    tokens.push(`M:${p.x},${p.y}:${transformFacing(m.facing | 0, rot, flip)}`);
    allX.push(p.x); allY.push(p.y);
  }
  for (const s of level.sinks || []) {
    const p = tp(s[0], s[1]);
    tokens.push(`S:${p.x},${p.y}`);
    allX.push(p.x); allY.push(p.y);
  }
  for (const hh of level.hunters || []) {
    const p = tp(hh.x, hh.y);
    tokens.push(`H:${p.x},${p.y}:${transformFacing(hh.facing | 0, rot, flip)}`);
    allX.push(p.x); allY.push(p.y);
  }
  for (const ek of level.prewalls || []) {
    const [p0, p1] = edgeEndpoints(ek);
    const a = tp(p0.x, p0.y), b = tp(p1.x, p1.y);
    tokens.push(`P:${canonEdge(a, b)}`);
    allX.push(a.x, b.x); allY.push(a.y, b.y);
  }
  for (const ek of solution || []) {
    const [p0, p1] = edgeEndpoints(ek);
    const a = tp(p0.x, p0.y), b = tp(p1.x, p1.y);
    tokens.push(`W:${canonEdge(a, b)}`);
    allX.push(a.x, b.x); allY.push(a.y, b.y);
  }

  // translation-normalize: shift so the bounding box min is at (0,0)
  const minX = Math.min(...allX), minY = Math.min(...allY);
  const shifted = tokens.map((t) => t.replace(/(-?\d+),(-?\d+)/g,
    (_, xs, ys) => `${Number(xs) - minX},${Number(ys) - minY}`));
  return shifted.sort().join(';');
}

// The canonical signature = lexicographically smallest over all 8 dihedral transforms
// (translation-normalized within each). Two levels that are reskins of the same
// puzzle (rotation/reflection/translation) yield the SAME canonical signature.
export function canonicalSignature(level, solution) {
  const w = level.width, h = level.height;
  let best = null;
  for (let rot = 0; rot < 4; rot++) {
    for (const flip of [false, true]) {
      const sig = signatureForTransform(level, solution, w, h, rot, flip);
      if (best === null || sig < best) best = sig;
    }
  }
  return best;
}

// ───────────────────────── technique structure (the SPEC ladder, contract.js parity) ─────────────────────────
function frontEdgesAtStart(level) {
  const s = new Set();
  for (const m of level.movers || []) s.add(edgeKey(m.x, m.y, m.facing));
  return s;
}
function isCatchShaped(level, solution) {
  const fronts = frontEdgesAtStart(level);
  return !solution.some((w) => fronts.has(w));
}
function wallServesTwoMovers(level, solution, w) {
  const full = evaluate(level, solution);
  const without = evaluate(level, solution.filter((e) => e !== w));
  return full.delivered - without.delivered >= 2;
}
function hasSharedDeflectionWall(level, solution) {
  return solution.some((w) => wallServesTwoMovers(level, solution, w));
}
function reverseEvents(level, walls) {
  const sim = simulate(level, walls || []);
  let n = 0;
  for (let i = 1; i < sim.frames.length; i++) {
    const a = sim.frames[i - 1].units, b = sim.frames[i].units;
    for (let j = 0; j < a.length; j++) {
      const ua = a[j], ub = b[j];
      if (!ua || !ub) continue;
      if (ua.kind !== 'mover' || ua.delivered) continue;
      if (((ua.facing + 2) & 3) === ub.facing) n++;
    }
  }
  return n;
}
function manufacturesDeadEnd(level, solution) {
  return reverseEvents(level, solution) > reverseEvents(level, []);
}
function turnEvents(level, walls) {
  const sim = simulate(level, walls || []);
  let n = 0;
  for (let i = 1; i < sim.frames.length; i++) {
    const a = sim.frames[i - 1].units, b = sim.frames[i].units;
    for (let j = 0; j < a.length; j++) {
      const ua = a[j], ub = b[j];
      if (!ua || !ub) continue;
      if (ua.kind !== 'mover' || ua.delivered) continue;
      if (ua.facing !== ub.facing) n++;
    }
  }
  return n;
}
function deflectionLoadBearing(level, solution) {
  const solTurns = turnEvents(level, solution);
  const nullTurns = turnEvents(level, []);
  const nullRun = simulate(level, []);
  return solTurns > nullTurns || (nullRun.outcome !== 'win' && solTurns >= 1);
}

// MOVEMENT verb load-bearing (playability.md verbs-load-bearing — Enfilade's
// vestigial-movement trap): a mover must actually CHANGE CELL along the certified
// winning line (movement is not a no-op). Read off the frames: ≥1 mover occupies ≥2
// distinct cells. Vacuously true for any delivered mover (it must travel to a sink),
// but we measure it explicitly so a future degenerate pack can never hide it.
function moverTravels(level, solution) {
  const sim = simulate(level, solution || []);
  const seen = {};
  for (const f of sim.frames) {
    for (const u of f.units) {
      if (u.kind !== 'mover') continue;
      (seen[u.id] = seen[u.id] || new Set()).add(`${u.x},${u.y}`);
    }
  }
  return Object.values(seen).some((s) => s.size >= 2);
}

// GREEDY per-mover-walling baseline (R-REGRET / straight-aim regret), engine-exact,
// the same construction as contract.js greedyWins: solve each mover independently,
// union the walls, try every ≤par subset; if any wins the full board it is
// greedy-solvable (regret 0). Returns true iff the obvious line WINS.
function greedyWins(level, par) {
  if (par == null) return false;
  const place = new Set(placeableEdges(level));
  const union = new Set();
  for (let i = 0; i < level.movers.length; i++) {
    const sub = { ...level, movers: [level.movers[i]] };
    const subSw = solveWithStats(sub, { maxNodes: MAX_NODES });
    if (subSw.solution) for (const e of subSw.solution) if (place.has(e)) union.add(e);
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

// ───────────────────────── SOUL ABLATION ─────────────────────────
// playability.md §soul-necessity. The SPEC's soul: "undirected coarse control via
// the fixed turn-rule — a wall only FORBIDS one edge and the immutable
// right-else-left-else-reverse rule then PICKS the exit ... Replace the turn-rule
// with a player-stamped heading (revert to drove's arrows) and every 'wall
// beside/behind' line ... vanishes — the puzzles collapse to point-and-aim."
//
// The single inference rule the puzzle is built around is "the player CANNOT aim a
// mover; the only steering is the fixed turn-rule deflection". To DISABLE that rule
// in the exact solver is precisely the SPEC's own S-ABLATE: swap the actuator from
// "forbid an edge" (wall) to "stamp a heading" (arrow) — engine.js.solveArrows /
// simulateArrows run the IDENTICAL R6 tick pipeline with the arrow actuator. With
// the soul removed (the player can now point movers directly), a level is "broken"
// if it becomes UNSOLVABLE at the wall-par OR loses its unique-optimal (the
// wall-only beside/behind line is no longer the optimum — par drops, or a different
// line wins). We census every packed level and report the broken fraction.
function soulAblationCensus(levels) {
  const per = [];
  for (const entry of levels) {
    const level = entry.level;
    // Re-derive the WALL-actuator (soul-PRESENT) verdict from the shared solver —
    // never trust the pack's baked numbers (the gate MEASURES).
    const wallSolve = solveWithStats(level, { maxNodes: MAX_NODES });
    const wallPar = wallSolve.par;
    const wallCount = wallPar != null
      ? countSolutions(level, { cap: Infinity, maxNodes: MAX_NODES, par: wallPar })
      : null;
    const wallUnique = wallCount ? wallCount.unique === true : false;

    // ABLATED: swap the actuator from "forbid an edge" (wall) to "stamp a heading"
    // (arrow) — engine.js.solveArrows / simulateArrows run the IDENTICAL R6 tick
    // pipeline with the soul rule REMOVED (the player can now point movers directly,
    // exactly drove's reverted arrows). This is the SPEC's own S-ABLATE operation.
    const arrow = solveArrows(level, { maxArrows: 6 });
    const arrowPar = arrow.par;
    const k = level.k != null ? level.k : 6;

    // The soul is load-bearing for THIS instance iff, with it removed, the instance
    // becomes UNSOLVABLE within budget OR LOSES its unique-optimal (playability.md
    // §soul-necessity):
    //   (a) UNSOLVABLE — no arrow line within the wall budget k, OR
    //   (b) CHEAPER-BY-AIMING — an arrow line strictly cheaper than wall par (the
    //       wall-only line was never even the optimum once you can aim), OR
    //   (c) LOSES-UNIQUE-OPTIMAL — the wall line was the UNIQUE optimum, but with
    //       aiming a DIFFERENT line exists at par ≤ wall par, so the soul's specific
    //       "wall beside/behind" deduction is no longer THE forced answer. The soul
    //       carried the uniqueness; remove it and the unique-optimal is gone.
    const arrowUnsolvableInBudget = (arrowPar == null) || (arrowPar > k);
    const cheaperByAiming = (arrowPar != null) && (arrowPar < wallPar);
    const losesUniqueOptimal = wallUnique && (arrowPar != null) && (arrowPar <= wallPar);

    const isBroken = arrowUnsolvableInBudget || cheaperByAiming || losesUniqueOptimal;
    per.push({
      id: entry.id, tier: entry.tier, wallPar, wallUnique,
      arrowPar, arrowUnsolvableInBudget, cheaperByAiming, losesUniqueOptimal, broken: isBroken,
    });
  }

  // Census population for "≥80% lose unique-optimal OR become unsolvable": the
  // levels that HAVE a unique-optimal to lose. The T0 on-ramp/teaching band is
  // NON-UNIQUE by SPEC design (D-ONRAMP / G4: T0 is uniqueness-EXEMPT — several
  // inert-equivalent winners), and is soul-FREE by design (the intuitive front-wall
  // move IS the answer there — no signature deduction to ablate). So the soul census
  // runs over the unique-optimal (soul-claiming) levels; the all-pack number is also
  // reported transparently. A decorative soul would leave even these untouched.
  const uniquePop = per.filter((p) => p.wallUnique);
  const brokenUnique = uniquePop.filter((p) => p.broken).length;
  const brokenAll = per.filter((p) => p.broken).length;
  return {
    // primary census = over the unique-optimal population (the soul-bearing levels)
    broken: brokenUnique, total: uniquePop.length,
    fraction: brokenUnique / Math.max(1, uniquePop.length),
    // transparency: the whole-pack number too (T0 dilutes it; reported, not gated)
    brokenAll, totalAll: per.length, fractionAll: brokenAll / Math.max(1, per.length),
    per,
  };
}

// ───────────────────────── main measurement ─────────────────────────
export function measure() {
  const levels = pack.levels;
  const insightCount = pack.curriculum.length;

  // Per-level measurement, all re-derived from the SHARED solver (never the pack's
  // baked numbers — the gate MEASURES).
  const per = levels.map((entry) => {
    const level = entry.level;
    const sw = solveWithStats(level, { maxNodes: MAX_NODES });
    const par = sw.par;
    const nodes = sw.nodes || 0;
    let unique = null, count = null, aborted = sw.aborted;
    if (par != null) {
      const c = countSolutions(level, { cap: Infinity, maxNodes: MAX_NODES, par });
      unique = c.unique; count = c.rawCount; aborted = aborted || c.aborted;
    }
    const solution = sw.solution || entry.solution || [];
    const area = level.width * level.height;
    const nMovers = (level.movers || []).length;
    const nHunters = (level.hunters || []).length;
    const sim = simulate(level, solution);
    const turns = sim.frames ? sim.frames.length : 0;

    const front = solution.some((w) => frontEdgesAtStart(level).has(w));
    const shared = hasSharedDeflectionWall(level, solution);
    const deadEnd = manufacturesDeadEnd(level, solution);
    const catchShaped = isCatchShaped(level, solution);

    const greedy = par != null && par >= 2 ? greedyWins(level, par) : null;
    const greedyRegret = greedy === null ? null : !greedy; // regret = obvious line FAILS

    const canon = canonicalSignature(level, solution);

    return {
      id: entry.id, insight: entry.insight, tier: entry.tier,
      par, nodes, unique: unique === true, count, aborted,
      area, movers: nMovers, hunters: nHunters, turns,
      technique: { front, shared, deadEnd, catch: catchShaped },
      greedyRegret, // null for par<2 (trivial), true=obvious-line-fails, false=greedy-solvable
      verbs: {
        wallDeny: par != null && par >= 1,
        turnDeflection: deflectionLoadBearing(level, solution),
        movement: moverTravels(level, solution),
      },
      canonicalSignature: canon,
    };
  });

  // ── par-ramp distribution ──
  const pars = per.map((p) => p.par).filter((p) => p != null);
  const parHistogram = {};
  for (const p of pars) parHistogram[p] = (parHistogram[p] || 0) + 1;
  const distinctPars = [...new Set(pars)].sort((a, b) => a - b);

  // ── unique-optimal % ── (T0 on-ramp is non-unique by design; we report both
  // raw and the share among par≥2 levels so the gate can read the right slice)
  const uniqueCount = per.filter((p) => p.unique).length;
  const uniqueFrac = uniqueCount / per.length;

  // ── greedy / straight-aim regret % (over par≥2 levels) ──
  const nonTrivial = per.filter((p) => p.greedyRegret !== null);
  const regretCount = nonTrivial.filter((p) => p.greedyRegret === true).length;
  const regretFrac = nonTrivial.length ? regretCount / nonTrivial.length : 0;

  // ── technique-tier spread (distinct deduction techniques present across the pack) ──
  // The SPEC ladder's named techniques; a technique tier is "represented" if ≥1
  // level's certified structure exhibits it.
  const techniquePresent = {
    front: per.some((p) => p.technique.front),       // on-ramp: intuitive front-wall
    shared: per.some((p) => p.technique.shared),     // shared deflection
    deadEnd: per.some((p) => p.technique.deadEnd),   // manufactured dead-end
    catch: per.some((p) => p.technique.catch),       // THE CATCH (no front wall)
  };
  const techniqueTierCount = Object.values(techniquePresent).filter(Boolean).length;
  // Curriculum tiers actually present (T0..T3)
  const declaredTiers = [...new Set(per.map((p) => p.tier))].sort();

  // ── ON-RAMP FLOOR (absolute) ──
  const easiestPar = Math.min(...pars);
  // a "genuinely easy / teaching" level: T0 tier OR (par ≤ 2 AND a front-wall move is
  // the intuitive solution AND not anti-greedy-required). We use the SPEC's own T0
  // band + the par≤1 floor. Count levels that precede the hard (T3) ones AND are easy.
  const easyLevels = per.filter((p) => p.tier === 'T0');
  const easyCount = easyLevels.length;
  // easiest level is genuinely gentle: par ≤ 1 and front-wall teaching
  const easiestLevel = per.find((p) => p.par === easiestPar);
  const onRampGentle = easiestPar <= 1 && easiestLevel && easiestLevel.tier === 'T0';
  // the easy band precedes the hard ones in pack order (teaching first)
  const firstHardIdx = per.findIndex((p) => p.tier === 'T3');
  const easyBeforeHard = per
    .slice(0, firstHardIdx === -1 ? per.length : firstHardIdx)
    .filter((p) => p.tier === 'T0').length;

  // ── HARD-CEILING FLOOR (absolute decision-space + magnitude at the top tier) ──
  // The hardest levels' decision-space proxy = solver explored-node count, plus
  // structural magnitude (area, movers+hunters, turn budget). "≥2 levels above the
  // floor" so the pack RAMPS to genuinely hard.
  const SEARCH_FLOOR = 16;      // contract.js parity (separates eyeball-trivial)
  const HARD_AREA_MIN = 20;     // ≥5x4
  // A level "clears the hard floor" if its solver explored a non-trivial subtree AND
  // it has real magnitude (area + multi-entity + multi-wall plan).
  const hardCleared = per.filter((p) =>
    p.nodes >= SEARCH_FLOOR &&
    p.area >= HARD_AREA_MIN &&
    (p.movers + p.hunters) >= 2 &&
    p.par >= 2,
  );
  const maxNodes = Math.max(...per.map((p) => p.nodes));
  const maxArea = Math.max(...per.map((p) => p.area));
  const nodeStats = {
    max: maxNodes,
    min: Math.min(...per.map((p) => p.nodes)),
    perLevel: per.map((p) => ({ id: p.id, nodes: p.nodes, area: p.area, par: p.par })),
  };

  // ── VERBS-LOAD-BEARING (no core SPEC verb vestigial) ──
  // Core verbs: WALL-DENY (the player's only verb), TURN-RULE deflection (the engine's
  // steering verb), MOVEMENT (a mover changes cell — Enfilade's vestigial-movement
  // trap). Each must MATTER on ≥1 mid+ level (T1+); we report the per-verb count of
  // levels where it is load-bearing and whether each is non-vestigial across the pack.
  const midPlus = per.filter((p) => p.tier !== 'T0');
  const verbsLoadBearing = {
    wallDeny: midPlus.every((p) => p.verbs.wallDeny) && midPlus.length > 0,
    turnDeflection: midPlus.every((p) => p.verbs.turnDeflection) && midPlus.length > 0,
    movement: midPlus.every((p) => p.verbs.movement) && midPlus.length > 0,
  };
  const allVerbsLoadBearing = Object.values(verbsLoadBearing).every(Boolean);

  // ── CURRICULUM DISTINCTNESS (canonical signatures + per-tier variety) ──
  const sigs = per.map((p) => p.canonicalSignature);
  const distinctSigCount = new Set(sigs).size;
  const allDistinct = distinctSigCount === per.length;
  // duplicates (isomorphic reskins), if any
  const sigSeen = new Map();
  const duplicates = [];
  per.forEach((p) => {
    if (sigSeen.has(p.canonicalSignature)) {
      duplicates.push([sigSeen.get(p.canonicalSignature), p.id]);
    } else sigSeen.set(p.canonicalSignature, p.id);
  });
  // per-tier distinct-signature counts + structural variety (solution structure
  // escalates / varies; a multi-level tier must not be one puzzle reskinned)
  const tiers = [...new Set(per.map((p) => p.tier))].sort();
  const perTier = {};
  for (const t of tiers) {
    const group = per.filter((p) => p.tier === t);
    const tierSigs = new Set(group.map((p) => p.canonicalSignature));
    // structural-variety key: the technique-shape + par + node-bucket of each level —
    // a tier "varies" if its levels are not all the same structural shape.
    const shapes = new Set(group.map((p) =>
      `${p.technique.front}|${p.technique.shared}|${p.technique.deadEnd}|${p.technique.catch}|par${p.par}`));
    perTier[t] = {
      levels: group.length,
      distinctSignatures: tierSigs.size,
      allDistinct: tierSigs.size === group.length,
      distinctStructuralShapes: shapes.size,
      varies: group.length <= 1 || shapes.size >= 2 || tierSigs.size === group.length,
    };
  }

  // ── soul-necessity census ──
  const soul = soulAblationCensus(levels);

  return {
    game: pack.game,
    packSize: per.length,
    insightCount,
    parRamp: { distinctPars, span: distinctPars.length, histogram: parHistogram, easiestPar },
    uniqueOptimal: { count: uniqueCount, fraction: uniqueFrac },
    greedyRegret: {
      nonTrivialLevels: nonTrivial.length, regretLevels: regretCount, fraction: regretFrac,
    },
    techniqueTiers: { present: techniquePresent, count: techniqueTierCount, declaredTiers },
    onRamp: {
      easiestPar, onRampGentle, easyCount, easyBeforeHard,
      easiestLevelId: easiestLevel ? easiestLevel.id : null,
    },
    hardCeiling: {
      searchFloor: SEARCH_FLOOR, hardAreaMin: HARD_AREA_MIN,
      clearedCount: hardCleared.length, clearedIds: hardCleared.map((p) => p.id),
      maxNodes, maxArea, nodeStats,
    },
    verbs: { loadBearing: verbsLoadBearing, allLoadBearing: allVerbsLoadBearing },
    distinctness: {
      distinctSignatureCount: distinctSigCount, packSize: per.length,
      allDistinct, duplicates, perTier,
    },
    soul: {
      brokenWithoutSoul: soul.broken, total: soul.total, fraction: soul.fraction,
      brokenAll: soul.brokenAll, totalAll: soul.totalAll, fractionAll: soul.fractionAll,
      threshold: 0.8, loadBearing: soul.fraction >= 0.8, per: soul.per,
    },
    perLevel: per,
  };
}

// ESM: run when invoked directly.
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = measure();
  writeFileSync(new URL('./playability.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n');
  // human summary
  const r = report;
  console.log('════════════════════ BAFFLE PLAYABILITY ════════════════════');
  console.log(`pack size: ${r.packSize}  insights: ${r.insightCount}`);
  console.log(`par ramp: distinct=${JSON.stringify(r.parRamp.distinctPars)} span=${r.parRamp.span} hist=${JSON.stringify(r.parRamp.histogram)}`);
  console.log(`unique-optimal: ${r.uniqueOptimal.count}/${r.packSize} (${(r.uniqueOptimal.fraction * 100).toFixed(1)}%)`);
  console.log(`greedy regret: ${r.greedyRegret.regretLevels}/${r.greedyRegret.nonTrivialLevels} par≥2 (${(r.greedyRegret.fraction * 100).toFixed(1)}%)`);
  console.log(`technique tiers: count=${r.techniqueTiers.count} present=${JSON.stringify(r.techniqueTiers.present)}`);
  console.log(`on-ramp: easiestPar=${r.onRamp.easiestPar} gentle=${r.onRamp.onRampGentle} easyCount=${r.onRamp.easyCount} easyBeforeHard=${r.onRamp.easyBeforeHard}`);
  console.log(`hard ceiling: cleared=${r.hardCeiling.clearedCount} ids=${JSON.stringify(r.hardCeiling.clearedIds)} maxNodes=${r.hardCeiling.maxNodes} maxArea=${r.hardCeiling.maxArea}`);
  console.log(`verbs load-bearing: ${JSON.stringify(r.verbs.loadBearing)} all=${r.verbs.allLoadBearing}`);
  console.log(`distinctness: ${r.distinctness.distinctSignatureCount}/${r.distinctness.packSize} distinct, dupes=${JSON.stringify(r.distinctness.duplicates)}`);
  for (const [t, v] of Object.entries(r.distinctness.perTier))
    console.log(`   tier ${t}: ${v.levels} levels, ${v.distinctSignatures} distinct sigs, ${v.distinctStructuralShapes} shapes, varies=${v.varies}`);
  console.log(`soul-necessity: ${r.soul.brokenWithoutSoul}/${r.soul.total} broken without soul (${(r.soul.fraction * 100).toFixed(1)}%) loadBearing=${r.soul.loadBearing}`);
  console.log('═════════════════════════════════════════════════════════════');
}
