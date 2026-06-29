// Baffle — STAGE-3 CONTENT BAKER.
//
// A curriculum graph (insights + dependencies) and a SOLVER-GATED generate-and-test
// baker. A candidate level is ACCEPTED for a tier iff:
//   (1) the shared engine's solver proves it solvable (solveWithStats → par != null),
//   (2) it is unique-optimal per the SPEC contract (countSolutions / G4),
//   (3) the full STAGE-2 difficulty contract passes for that tier (checkContract.ok —
//       this folds in the REVELATION CERTIFICATE: every gate is an engine FACT, never
//       a self-reported claim), AND
//   (4) it TEACHES its assigned insight (the tier's named technique fires — G5),
//   (5) it is STRUCTURALLY DISTINCT from every already-accepted level: its CANONICAL
//       LEVEL SIGNATURE (puzzle essence — relative entity formation + relevant terrain
//       + the certified solution's structure, INVARIANT under translation AND the 8
//       dihedral rotations/reflections) is new (no isomorphic duplicate).
//
// EVERYTHING is computed through the ONE shared oracle (engine.js + contract.js) — the
// baker never re-implements a rule (lesson: REUSE the audited engine; re-derive facts,
// never trust a self-reported field). On starvation it ships FEWER and reports it in
// rejections.json (honest generator health) — it NEVER pads a tier with duplicates.
//
// Output:
//   pack.json        — { insights:[…], levels:[…] }; every curriculum insight covered.
//   rejections.json  — per-gate rejection census (generator health, honest).

import {
  simulate, evaluate, isWin, solveWithStats, countSolutions,
  placeableEdges, edgeKey, N, E, S, W,
} from './engine.js';
import { checkContract, TIERS } from './contract.js';

const MAX_NODES = 200000;

// ───────────────────────── seeded RNG (splitmix64, matches census.js) ─────────────────────────
function splitmix64(seed) {
  let s = BigInt.asUintN(64, BigInt(seed));
  return () => {
    s = BigInt.asUintN(64, s + 0x9e3779b97f4a7c15n);
    let z = s;
    z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
    z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
    z = z ^ (z >> 31n);
    return Number(BigInt.asUintN(53, z)) / 2 ** 53;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// ───────────────────────── THE CURRICULUM GRAPH (insights + dependencies) ─────────────────────────
// Each insight is a NODE; `deps` are the prerequisite insights (the dependency edges).
// `tier` is the contract tier the insight is certified at. `targetCount` is how many
// STRUCTURALLY DISTINCT levels we WANT for that insight; we ship that many or FEWER
// (never pad). The ladder mirrors the SPEC's §THE SOUL / §Difficulty seed exactly:
//   handedness  (T0) — the D-ONRAMP teaching band: the intuitive FRONT-wall move IS the
//                       answer; the player SEES the right-hand rule fire. No prereqs.
//   shared      (T1) — shared deflection: one wall load-bearing for ≥2 movers.
//   deadend     (T2) — manufactured dead-end: the solution forces a mover to REVERSE
//                       off a player-placed wall (the rule's `reverse` priority fires).
//   thecatch    (T3) — THE CATCH: the unique line places NO wall in front of any mover;
//                       the herd is banked beside/behind via handedness (the soul).
//   depth       (T2) — DEPTH (the par-ramp peak): a genuinely DEEPER line — the unique
//                       optimum needs par ≥ 3 walls (a multi-deflection / dual-purpose
//                       chain over a denser 3-mover field). This is what makes the pack
//                       RAMP its par past 2 (playability par-ramp): difficulty escalates,
//                       not just validity. `minPar` is the hard floor — a candidate whose
//                       minimum line is shorter is rejected (`below-min-par`), so the
//                       insight only ships levels that genuinely sit deeper on the ramp.
export const CURRICULUM = Object.freeze([
  { id: 'handedness', tier: 'T0', deps: [],                       targetCount: 2,
    teaches: 'the fixed right-hand turn-rule banks a mover — the intuitive front-wall move works (on-ramp)' },
  { id: 'shared',     tier: 'T1', deps: ['handedness'],           targetCount: 3,
    teaches: 'shared deflection — one wall is load-bearing for ≥2 movers (the obvious per-mover line fails)' },
  { id: 'deadend',    tier: 'T2', deps: ['shared'],               targetCount: 3,
    teaches: 'a manufactured dead-end — a player-placed wall reverses a mover for free' },
  { id: 'thecatch',   tier: 'T3', deps: ['shared', 'deadend'],    targetCount: 3,
    teaches: 'THE CATCH — the unique line places NO wall in front of any mover; bank beside/behind' },
  { id: 'depth',      tier: 'T2', deps: ['shared', 'deadend'],    targetCount: 3, minPar: 3,
    teaches: 'DEPTH — the par-ramp peak: the unique optimum needs ≥3 walls (a deeper multi-deflection chain over a denser 3-mover field); difficulty escalates past par-2' },
]);

// ───────────────────────── CANONICAL LEVEL SIGNATURE (the distinctness oracle) ─────────────────────────
// The puzzle ESSENCE: the relative formation of entities (movers w/ facings, sinks,
// hunters), the relevant terrain (pre-walls), AND the certified solution's structure
// (the par wall set). We compute a representation INVARIANT under translation AND the 8
// dihedral symmetries (4 rotations × reflection) by enumerating all 8 transforms,
// translating each to the min corner, serializing canonically, and taking the
// lexicographically MINIMAL string. Two levels with the same signature are isomorphic —
// the SAME puzzle reskinned (the Enfilade focus-fire 1/2/3 bug) — and the second is
// rejected as a `duplicate-structure`.
//
// Facings transform under each dihedral op too (a rotation rotates a mover's heading);
// that is essential — a board rotated 90° has its movers' facings rotated 90°, and the
// signature must see them as identical.

// The 8 dihedral transforms of an integer grid point, parameterized by (rot, flip).
// rot ∈ {0,1,2,3} = 90°·rot CW; flip ∈ {0,1} reflects x. Facings (0=N,1=E,2=S,3=W,
// clockwise) transform consistently: a CW rotation maps facing f → (f+rot)&3; a flip
// (mirror across the vertical axis, x→-x) swaps E↔W i.e. maps N→N,E→W,S→S,W→E which is
// f → (4 - f) & 3.
function transformPoint(x, y, rot, flip) {
  let px = x, py = y;
  if (flip) px = -px;               // mirror across vertical axis first
  // rotate (px,py) by rot·90° CW about origin: (x,y) → (-y, x) per 90° CW in
  // screen coords (y grows downward, so CW is (x,y)→(-y,x)).
  for (let r = 0; r < rot; r++) { const nx = -py, ny = px; px = nx; py = ny; }
  return [px, py];
}
function transformFacing(f, rot, flip) {
  let g = f;
  if (flip) g = (4 - g) & 3;        // mirror swaps E↔W
  return (g + rot) & 3;             // CW rotation adds rot quarter-turns
}
// An edge is two endpoints; transform both and re-key canonically (sorted endpoints).
function transformEdgeKey(ek, rot, flip) {
  const [a, b] = ek.split('|');
  const [ax, ay] = a.split(',').map(Number);
  const [bx, by] = b.split(',').map(Number);
  const [tax, tay] = transformPoint(ax, ay, rot, flip);
  const [tbx, tby] = transformPoint(bx, by, rot, flip);
  // canonical undirected order (lexicographic on (x,y))
  if (tax < tbx || (tax === tbx && tay < tby)) return `${tax},${tay}|${tbx},${tby}`;
  return `${tbx},${tby}|${tax},${tay}`;
}

// Serialize ONE transform of a (level, solution) into a translation-normalized string.
// Collect every coordinate, shift so the min (x,y) of the WHOLE figure is (0,0), then
// emit sorted, typed tokens. Pre-walls + the SOLUTION walls are both terrain structure
// (the solution IS part of the puzzle essence — two levels with the same formation but
// different solution shapes are genuinely different puzzles).
function serializeTransform(level, solution, rot, flip) {
  const movers = (level.movers || []).map((m) => {
    const [tx, ty] = transformPoint(m.x, m.y, rot, flip);
    return { x: tx, y: ty, f: transformFacing(m.facing, rot, flip) };
  });
  const sinks = (level.sinks || []).map(([x, y]) => transformPoint(x, y, rot, flip));
  const hunters = (level.hunters || []).map((h) => {
    const [tx, ty] = transformPoint(h.x, h.y, rot, flip);
    return { x: tx, y: ty, f: transformFacing(h.facing, rot, flip) };
  });
  const prewalls = (level.prewalls || []).map((e) => transformEdgeKey(e, rot, flip));
  const solWalls = (solution || []).map((e) => transformEdgeKey(e, rot, flip));

  // translate so the whole figure's min corner is (0,0). Include edge endpoints so the
  // bounding box covers terrain too (an isolated prewall must shift consistently).
  let minX = Infinity, minY = Infinity;
  const note = (x, y) => { if (x < minX) minX = x; if (y < minY) minY = y; };
  for (const m of movers) note(m.x, m.y);
  for (const [x, y] of sinks) note(x, y);
  for (const h of hunters) note(h.x, h.y);
  for (const ek of [...prewalls, ...solWalls]) {
    for (const pt of ek.split('|')) { const [x, y] = pt.split(',').map(Number); note(x, y); }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; }
  const shiftPt = (x, y) => `${x - minX},${y - minY}`;
  const shiftEdge = (ek) => ek.split('|').map((p) => { const [x, y] = p.split(',').map(Number); return shiftPt(x, y); })
    .sort().join('|'); // re-sort endpoints after shift (translation preserves order, but be safe)

  const mTok = movers.map((m) => `M${shiftPt(m.x, m.y)}@${m.f}`).sort();
  const sTok = sinks.map(([x, y]) => `S${shiftPt(x, y)}`).sort();
  const hTok = hunters.map((h) => `H${shiftPt(h.x, h.y)}@${h.f}`).sort();
  const pTok = prewalls.map(shiftEdge).sort().map((e) => `P${e}`);
  const wTok = solWalls.map(shiftEdge).sort().map((e) => `W${e}`);
  return [...mTok, ...sTok, ...hTok, ...pTok, ...wTok].join(';');
}

// CANONICAL SIGNATURE = the lexicographically-minimal serialization over all 8
// dihedral transforms (translation already normalized inside each). Invariant under
// translation + rotation + reflection (the full symmetry group of the square grid).
export function canonicalSignature(level, solution) {
  let best = null;
  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      const s = serializeTransform(level, solution, rot, flip);
      if (best === null || s < best) best = s;
    }
  }
  return best;
}

// ───────────────────────── candidate generators (SOLUTION-FIRST, seeded) ─────────────────────────
// Lesson (Enfilade/oracle): pure scatter yields ~0% solvable — SEED solution-first
// geometry but keep the rest random so the solver still discovers the redirect. Each
// tier has a generator tuned to where its insight is ABUNDANT (lesson: probe the
// edge-count distribution, set each insight's size knob to where its tier yields).
// We DO NOT hand-author one template with the edges moved (the focus-fire 1/2/3 bug);
// every candidate randomizes formation / count / facings / terrain so the accepted set
// is structurally diverse, and the canonical-signature dedup guarantees it.

function genCandidate(rng, tier, escalation, insightId) {
  const facings = [N, E, S, W];
  // escalation ∈ {0,1,2,…} pushes size / mover-count / terrain density UP within a
  // tier so successive accepted levels are STRUCTURALLY DISTINCT and ESCALATING, not
  // one template reskinned.
  let width, height, nMovers, density;

  // DEPTH insight (the par-ramp peak): a denser, 3-mover field where the minimum line
  // genuinely needs ≥3 walls. Tuned off the edge-count probe — 7×7, 3 movers, density
  // ~0.20 is where unique par-3 lines are ABUNDANT (the lesson: probe the distribution,
  // set the size knob to where the target par lands; small/sparse boards starve par-3).
  // k = 6 (the SPEC budget ceiling) so a 3-wall line fits with headroom. NOT a reskin of
  // the par-2 T2 generator — bigger board, +1 mover, higher density → a different essence
  // band; the canonical-signature dedup still guards inter-level distinctness.
  if (insightId === 'depth') {
    width = randint(rng, 7, 7 + (escalation > 1 ? 1 : 0));   // 7→8 as we escalate
    height = randint(rng, 6, 7);
    nMovers = 3;
    density = Math.min(0.18 + 0.03 * escalation, 0.30);
    const cells = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) cells.push({ x, y });
    const used = new Set();
    const take = () => {
      for (let t = 0; t < 80; t++) { const c = pick(rng, cells); if (!used.has(`${c.x},${c.y}`)) { used.add(`${c.x},${c.y}`); return c; } }
      return cells[0];
    };
    const movers = [];
    for (let i = 0; i < nMovers; i++) { const c = take(); movers.push({ x: c.x, y: c.y, facing: pick(rng, facings) }); }
    const sink = take();
    const sinksArr = [[sink.x, sink.y]];                       // single sink (Tier-0 SPEC)
    const allEdges = placeableEdges({ width, height, movers, sinks: sinksArr });
    const prewalls = [];
    for (const e of allEdges) if (rng() < density) prewalls.push(e);
    return { width, height, movers, sinks: sinksArr, prewalls, k: 6 };
  }

  switch (tier) {
    case 'T0': // on-ramp: smallest, single mover, sparse — front-wall must work
      width = randint(rng, 3, 4); height = randint(rng, 3, 4);
      nMovers = 1; density = 0.10 + 0.05 * escalation; break;
    case 'T1': // shared deflection: 2 movers; the herd shares a banking wall
      width = randint(rng, 4, 5); height = randint(rng, 4, 5);
      nMovers = 2; density = 0.12 + 0.06 * escalation; break;
    case 'T2': // manufactured dead-end: pockets — denser terrain to carve a reverse
      width = randint(rng, 4, 6); height = randint(rng, 4, 6);
      nMovers = randint(rng, 1, 2); density = 0.22 + 0.06 * escalation; break;
    case 'T3': // THE CATCH: ≥2 movers, area ≥20 (HARD floor), bank beside/behind
      width = randint(rng, 5, 6); height = randint(rng, 4, 6);
      nMovers = 2; density = 0.16 + 0.05 * escalation; break;
    default: throw new Error(`unknown tier ${tier}`);
  }
  density = Math.min(density, 0.45);

  const cells = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) cells.push({ x, y });
  const used = new Set();
  const take = () => {
    for (let t = 0; t < 60; t++) { const c = pick(rng, cells); if (!used.has(`${c.x},${c.y}`)) { used.add(`${c.x},${c.y}`); return c; } }
    return cells[0];
  };
  const movers = [];
  for (let i = 0; i < nMovers; i++) { const c = take(); movers.push({ x: c.x, y: c.y, facing: pick(rng, facings) }); }
  const sinkN = tier === 'T1' ? 1 : randint(rng, 1, 1); // single sink (Tier-0 SPEC)
  const sinks = [];
  for (let i = 0; i < sinkN; i++) { const c = take(); sinks.push([c.x, c.y]); }

  const allEdges = placeableEdges({ width, height, movers, sinks });
  const prewalls = [];
  for (const e of allEdges) if (rng() < density) prewalls.push(e);
  const k = tier === 'T0' ? 2 : (tier === 'T3' ? 5 : 4);
  return { width, height, movers, sinks, prewalls, k };
}

// ───────────────────────── the SOLVER-GATED acceptance funnel ─────────────────────────
// Cheapest-decisive gate first (lesson: idle/solver/unique/contract/certificate order).
// Returns { accepted, level, sig, par, reason } where reason names the bucket the
// candidate fell into (for rejections.json — honest per-gate census).
function evaluateCandidate(level, insight) {
  const tier = insight.tier;

  // FUNNEL-0 — null run must not already win (cheapest: one simulate). G1 also checks
  // this but we short-circuit here so the rejection census is honest about freebies.
  if (simulate(level).outcome === 'win') return { accepted: false, reason: 'G1-null-run-win' };

  // FUNNEL-1 — solvable (solveWithStats). par == null ⇒ unsolvable; aborted ⇒ parked.
  const sw = solveWithStats(level, { maxMoves: level.k, maxNodes: MAX_NODES });
  if (sw.aborted) return { accepted: false, reason: 'aborted-parked' };
  if (sw.par == null) return { accepted: false, reason: 'unsolvable' };

  // FUNNEL-1b — DEPTH floor (par-ramp). An insight may demand a MINIMUM par so the pack
  // genuinely ramps difficulty (the `depth` insight needs par ≥ 3). A shorter minimum
  // line is a shallower puzzle than this insight teaches — reject it (honest census).
  if (insight.minPar != null && sw.par < insight.minPar) {
    return { accepted: false, reason: 'below-min-par' };
  }

  // FUNNEL-2 — the FULL stage-2 contract for this tier (folds in uniqueness G4,
  // tier-technique G5 = TEACHES the insight, anti-greedy G3, irredundancy G6, failure
  // legibility G7, absolute floor G8). checkContract re-derives every fact from the
  // engine over the GEOMETRY — the REVELATION CERTIFICATE is structured engine evidence,
  // never pack.json's self-report.
  const rep = checkContract(level, { tier, maxNodes: MAX_NODES });
  if (!rep.ok) {
    // attribute the rejection to the FIRST failing gate (deterministic, gate order).
    const firstFail = rep.failures[0];
    return { accepted: false, reason: `contract-${firstFail.id}`, detail: firstFail.detail };
  }

  // ACCEPTED by the oracle. Build the revelation certificate (structured engine facts).
  const sig = canonicalSignature(level, sw.solution);
  const certificate = buildCertificate(level, sw, rep, insight);
  return { accepted: true, level, sig, par: sw.par, solution: sw.solution, certificate, reason: 'accepted' };
}

// REVELATION CERTIFICATE — structured engine FACTS proving the level teaches its
// insight (never a claim). Re-derived facts the content test re-checks independently.
function buildCertificate(level, sw, rep, insight) {
  const g = (id) => rep.gates.find((x) => x.id === id);
  return {
    insight: insight.id,
    tier: insight.tier,
    par: sw.par,
    nodes: sw.nodes,
    unique: rep.unique === true,
    solution: sw.solution,
    // the gate verdicts that PROVE the insight fired (engine facts):
    gateDetail: {
      G3: g('G3').detail, G4: g('G4').detail, G5: g('G5').detail,
      G6: g('G6').detail, G7: g('G7').detail, G8: g('G8').detail,
    },
    traceHash: evaluate(level, sw.solution).traceHash,
  };
}

// ───────────────────────── the baker (generate-and-test per insight) ─────────────────────────
// Per insight: generate candidates, run the funnel, accept iff the oracle passes AND
// the canonical signature is NEW. Stop at targetCount distinct levels OR a generation
// budget; on starvation ship FEWER and record it. NEVER pad with a duplicate.
export function bake({ seed = 7, triesPerInsight = 6000 } = {}) {
  const rng = splitmix64(seed);
  const acceptedLevels = [];
  const acceptedSigs = new Set();                 // global dedup across ALL tiers
  const rejections = {};                          // bucket -> count
  const perInsight = {};                          // insight.id -> { wanted, shipped, starved }
  const bump = (bucket) => { rejections[bucket] = (rejections[bucket] || 0) + 1; };

  for (const insight of CURRICULUM) {
    let shipped = 0;
    let escalation = 0;
    let sinceAccept = 0;
    for (let t = 0; t < triesPerInsight && shipped < insight.targetCount; t++) {
      // ramp escalation as we accept, so successive levels for this insight ESCALATE
      // (vary formation / count / terrain) rather than cluster on one template.
      const cand = genCandidate(rng, insight.tier, escalation, insight.id);
      const res = evaluateCandidate(cand, insight);
      if (!res.accepted) { bump(res.reason); sinceAccept++; continue; }

      // DISTINCTNESS gate (canonical signature, the non-negotiable): reject any
      // candidate isomorphic to an already-accepted level (any tier).
      if (acceptedSigs.has(res.sig)) { bump('duplicate-structure'); sinceAccept++; continue; }

      acceptedSigs.add(res.sig);
      acceptedLevels.push({
        id: `${insight.id}-${shipped + 1}`,
        insight: insight.id,
        tier: insight.tier,
        level: res.level,
        par: res.par,
        solution: res.solution,
        signature: res.sig,
        certificate: res.certificate,
      });
      shipped++;
      escalation++;
      sinceAccept = 0;
    }
    perInsight[insight.id] = {
      wanted: insight.targetCount, shipped,
      starved: shipped < insight.targetCount,
    };
  }

  // ORDER the pack: curriculum order (deps before dependents) then by tier rank; the
  // D-ONRAMP teaching band (handedness, T0) is ORDERED FIRST (SPEC D-ONRAMP).
  const order = CURRICULUM.map((c) => c.id);
  acceptedLevels.sort((a, b) => {
    const ai = order.indexOf(a.insight), bi = order.indexOf(b.insight);
    if (ai !== bi) return ai - bi;
    return a.id < b.id ? -1 : 1;
  });

  const pack = {
    game: 'baffle',
    seed,
    curriculum: CURRICULUM.map((c) => ({ id: c.id, tier: c.tier, deps: c.deps, teaches: c.teaches })),
    coverage: perInsight,
    levels: acceptedLevels,
  };
  const rejectionReport = {
    seed,
    perGate: rejections,
    perInsight,
    note: 'On starvation the baker ships FEWER (never pads with duplicates); a nonzero ' +
      'duplicate-structure bucket means the canonical-signature dedup rejected isomorphic ' +
      'reskins. All facts are re-derived from the engine in content.test.js.',
  };
  return { pack, rejectionReport };
}

// ───────────────────────── CLI: write pack.json + rejections.json ─────────────────────────
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function main() {
  const seed = Number(process.env.BAKE_SEED || 7);
  const { pack, rejectionReport } = bake({ seed });
  const here = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(here, 'pack.json'), JSON.stringify(pack, null, 2) + '\n');
  writeFileSync(join(here, 'rejections.json'), JSON.stringify(rejectionReport, null, 2) + '\n');

  console.log('═══════════════════════ BAFFLE BAKE ═══════════════════════');
  console.log(`seed=${seed}`);
  let allCovered = true;
  for (const c of CURRICULUM) {
    const cov = pack.coverage[c.id];
    const tag = cov.shipped >= 1 ? (cov.starved ? 'STARVED' : 'FULL') : 'EMPTY';
    if (cov.shipped < 1) allCovered = false;
    console.log(`  ${c.id.padEnd(11)} [${c.tier}]  shipped ${cov.shipped}/${cov.wanted}  ${tag}`);
  }
  console.log(`  total levels: ${pack.levels.length}`);
  console.log('─────────────────────────── REJECTIONS (per gate) ───────────────────────────');
  for (const [bucket, n] of Object.entries(rejectionReport.perGate).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${bucket}`);
  }
  console.log('──────────────────────────────────────────────────────────────');
  if (allCovered) { console.log('CONTENT: BUILT'); process.exit(0); }
  else { console.log('CONTENT: INCOMPLETE (an insight has ZERO levels)'); process.exit(1); }
}

// run as CLI only (not when imported by the test)
if (process.argv[1] && process.argv[1].endsWith('baker.js')) main();
