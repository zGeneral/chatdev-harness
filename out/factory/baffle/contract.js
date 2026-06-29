// Baffle — STAGE-2 DIFFICULTY CONTRACT.
//
// A set of computable gates over a candidate room `(level, solution, frames)`. These
// are the quality filter the baker MUST pass before a room ships: they encode the
// SPEC's difficulty seed (default-outcome, structural minimums, ANTI-GREEDY,
// UNIQUENESS, a TECHNIQUE-TIER ladder, sequence shape, failure legibility, an
// ABSOLUTE-DIFFICULTY FLOOR, and VERBS-LOAD-BEARING) as pure, deterministic checks —
// nothing left to prose.
//
// EVERYTHING here is computed through the ONE shared engine (engine.js): the same
// simulate()/evaluate()/solveWithStats()/countSolutions() the solver and certifier
// use, so a gate can never certify under a different model than the game runs (B3 /
// R-COUNT). No second oracle.
//
// USAGE:
//   import { checkContract, GATES, getGate, GATE_COUNT } from './contract.js';
//   const report = checkContract(level, { tier });   // derives solution + frames
//   report.ok        -> boolean (all gates passed)
//   report.gates     -> [{ id, name, ok, detail }]
//   report.failures  -> the subset with ok === false
//
// A gate returns { ok, detail }. `checkContract` runs the engine ONCE (par solve +
// uniqueness count + frame replay) and threads the results to every gate, so the whole
// contract is one deterministic pass.

import {
  simulate,
  evaluate,
  isWin,
  solveWithStats,
  countSolutions,
  placeableEdges,
  edgeKey,
  N, E, S, W,
} from './engine.js';

// Per R-INSTRUMENT a uniqueness verdict reached under a maxNodes abort is REJECTED,
// never shipped as unique. The contract uses a generous budget so the small ceiling
// boards (≤8x8, k≤6) certify without abort; a board that DOES abort is correctly
// flagged by G4/G7 as not-shippable rather than silently passed.
const MAX_NODES_DEFAULT = 200000;

// ───────────────────────── technique tiers (the SPEC ladder) ─────────────────────────
// A room declares a tier; the contract checks the room's COMPUTED structure is
// consistent with it (not weaker, not a lie). The rungs are the SPEC's named
// techniques (§THE SOUL / §Difficulty seed), in ascending order:
//   T0 — D-ONRAMP teaching band: the intuitive FRONT-wall move IS the answer. The
//        protected EASY band; EXEMPT from R-REGRET / the par-≥2 structural minimum.
//   T1 — shared deflection: ≥1 wall load-bearing for ≥2 movers (one segment deflects
//        a herd; removing it breaks delivery for ≥2). Anti-greedy applies from here up.
//   T2 — manufactured dead-end: the solution forces a mover to REVERSE off a
//        player-placed wall (a placeable resource — the rule's `reverse` priority
//        fires), turning a mover around for free.
//   T3 — THE CATCH (hard): the unique line places NO wall directly in front of any
//        mover at its start; the herd is banked around a corner via handedness /
//        beside-or-behind walls. The obvious "point it" move is the WRONG model.
export const TIERS = Object.freeze({ T0: 0, T1: 1, T2: 2, T3: 3 });
const TIER_RANK = TIERS;
function tierRank(tier) {
  if (typeof tier === 'number') return tier;
  const r = TIER_RANK[tier];
  if (r == null) throw new Error(`unknown tier ${tier}`);
  return r;
}
function tierLabel(tier) {
  return typeof tier === 'string' ? tier : `T${tier}`;
}
// "Medium+" = the band where the SPEC FORBIDS the obvious line and the freebie. Per the
// difficulty seed this is T1 and up: T0 (the D-ONRAMP teaching band) is the protected
// EASY band — the on-ramp the SPEC says MUST exist, open with the intuitive front-wall
// move working, and be EXEMPT from anti-greedy / the par-≥2 structural minimum.
const MEDIUM_PLUS = 1;

// ───────────────────────── shared analysis ─────────────────────────
// Run the engine ONCE, hand the result to every gate.
// `analysis` = { sw, par, count, unique, aborted, frames, outcome, faced, level, tier }.
function analyzeRoom(level, { tier, maxNodes = MAX_NODES_DEFAULT } = {}) {
  const sw = solveWithStats(level, { maxNodes });
  const par = sw.par;
  let count = null, unique = null, aborted = sw.aborted;
  if (par != null) {
    const c = countSolutions(level, { cap: Infinity, maxNodes, par });
    count = c.rawCount;
    unique = c.unique;
    aborted = aborted || c.aborted;
  }
  let frames = null, outcome = null;
  if (sw.solution) {
    const sim = simulate(level, sw.solution);
    frames = sim.frames;
    outcome = sim.outcome;
  }
  return { sw, par, count, unique, aborted, frames, outcome, level, tier, maxNodes };
}

// ───────────────────────── helper predicates (engine FACTS, never claims) ─────────────────────────

// The edge DIRECTLY IN FRONT of each mover at its START facing — the intuitive "point
// it" move (a wall on the cell ahead). THE CATCH (T3) is defined precisely against
// this set: a hard room's unique line places NONE of its walls here.
function frontEdgesAtStart(level) {
  const s = new Set();
  for (const m of level.movers || []) s.add(edgeKey(m.x, m.y, m.facing));
  return s;
}

// Is wall `w` load-bearing for ≥2 movers (SHARED DEFLECTION, T1)? Remove w from the
// solution; if the partial set delivers ≥2 FEWER movers than the full set, that single
// segment was carrying ≥2 movers' fates. Pure engine delta — never a geometric guess.
function wallServesTwoMovers(level, solution, w) {
  const full = evaluate(level, solution);
  const without = evaluate(level, solution.filter((e) => e !== w));
  return full.delivered - without.delivered >= 2;
}
function hasSharedDeflectionWall(level, solution) {
  return solution.some((w) => wallServesTwoMovers(level, solution, w));
}

// Does the certified solution FORCE a mover to REVERSE (a manufactured dead-end, T2)?
// Read off the frames: a mover whose facing flips by 180° between consecutive frames
// turned around — the rule's `reverse` priority fired because all of ahead/right/left
// were blocked. We only count a reverse that the SOLUTION (a player-placed wall)
// induced, by comparing against the null run: a reverse present in the solution trace
// but NOT in the null-run trace was manufactured by the player's walls.
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
  // A reverse in the solved trace that the player's walls caused (more reverses than
  // the null run) is a manufactured dead-end.
  return reverseEvents(level, solution) > reverseEvents(level, []);
}

// THE CATCH (T3): no wall in the solution is directly in front of any mover at start.
function isCatchShaped(level, solution) {
  const fronts = frontEdgesAtStart(level);
  return !solution.some((w) => fronts.has(w));
}

// GREEDY per-mover-walling baseline (R-REGRET / anti-greedy). Solve each mover
// independently (single-mover sublevel), union the walls, and try every ≤par subset of
// that union: if any wins the full board, the room fell to walling each mover's own
// path independently — it is greedy-solvable (no shared deflection / handedness depth).
function greedyWins(level, par) {
  if (par == null) return false;
  const place = new Set(placeableEdges(level));
  const union = new Set();
  for (let i = 0; i < level.movers.length; i++) {
    const sub = { ...level, movers: [level.movers[i]] };
    const subSw = solveWithStats(sub, { maxNodes: MAX_NODES_DEFAULT });
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

// IRREDUNDANCY (R-COUNT, certification-only): every wall in the solution is
// load-bearing — removing any one breaks the win. A redundant wall = a decorative
// move; the par solve should never return one, but the gate proves it.
function isIrredundant(level, solution) {
  if (!solution || solution.length === 0) return false;
  for (const w of solution) {
    if (isWin(level, solution.filter((e) => e !== w))) return false; // drop-one still wins
  }
  return true;
}

// ───────────────────────── ABSOLUTE-DIFFICULTY-FLOOR helpers (G8) ─────────────────────────
// The other gates are RELATIVE — they prove a room is consistent with its declared
// tier — but a room can still sit at the trivial FLOOR of the SPEC space (a flat field
// of tiny par-1 rooms) and pass them all. G8 measures the ABSOLUTE decision space so a
// trivial room can NEVER certify at the hard tier (the lesson: difficulty is not
// validity; the solver-gated baker converges to the SMALLEST yielding rooms).

// SEARCH-FLOOR proxy: the exact solver's explored-node count for the par solve
// (solveWithStats exposes `nodes`). Measured from the fixtures: GT_CATCH (par-1 single
// mover) ~3 nodes; GT_JOINT (par-2 shared deflection) ~20 nodes; the hard
// thin-manifold boards force the trace-global IDDFS to explore a far larger subtree.
// A SEARCH_FLOOR of 16 cleanly separates an eyeball-trivial par-1 room from a room that
// genuinely needs a multi-wall plan, while staying well inside the maxNodes budget.
const SEARCH_FLOOR = 16;
// HARD-tier magnitude minimums (the ABSOLUTE floor): the hardest band must be a
// genuinely large decision space, not a small room dressed up. Board area ≥ 20 (e.g.
// ≥5x4), ≥2 movers, and par ≥ 2 walls — so a flat field of par-1 rooms can NEVER
// certify as the hard tier.
const HARD_AREA_MIN = 20;
const HARD_MOVERS_MIN = 2;
const HARD_PAR_MIN = 2;

// VERBS-LOAD-BEARING (the SPEC verbs that must MATTER in the certified solution):
//   (1) WALL-DENY — the player's whole verb. Every wall in the par solution is
//       irredundant (G6 also checks this); here we assert par ≥ 1 (a board solved by
//       ZERO walls is a freebie, caught by G1, but the floor double-checks the verb is
//       used at the mid+ band).
//   (2) THE TURN-RULE DEFLECTION — the engine's steering verb. A mid+ room must make
//       the rule's TURN actually fire on the winning line: a mover that sails straight
//       to its sink with no turn (the rule degenerate) means the wall did nothing the
//       geometry didn't already do. We assert ≥1 mover TURNS (changes facing) along the
//       certified trace — movement-via-deflection is load-bearing, not vestigial.
function turnEvents(level, walls) {
  const sim = simulate(level, walls || []);
  let n = 0;
  for (let i = 1; i < sim.frames.length; i++) {
    const a = sim.frames[i - 1].units, b = sim.frames[i].units;
    for (let j = 0; j < a.length; j++) {
      const ua = a[j], ub = b[j];
      if (!ua || !ub) continue;
      if (ua.kind !== 'mover' || ua.delivered) continue;
      if (ua.facing !== ub.facing) n++; // any facing change = the turn-rule fired
    }
  }
  return n;
}
// The TURN verb is load-bearing iff the certified solution induces a deflection the
// player's walls caused: more turns under the solution than under the null run (the
// wall bent a path that otherwise ran straight), OR the null run already FAILs and the
// solution turns a mover into its sink (the deflection IS the delivery).
function deflectionLoadBearing(level, solution) {
  const solTurns = turnEvents(level, solution);
  const nullTurns = turnEvents(level, []);
  const nullRun = simulate(level, []);
  return solTurns > nullTurns || (nullRun.outcome !== 'win' && solTurns >= 1);
}

// ───────────────────────── THE GATES ─────────────────────────
// Each: (analysis) -> { ok, detail }.
export const GATES = [
  // G1 — DEFAULT OUTCOME (anti-freebie). The NULL run (no player walls) must NOT win,
  // and must not be a degenerate already-failed board with no recoverable play — every
  // wall must EARN its place (SPEC G1 / Difficulty seed default-outcome).
  {
    id: 'G1',
    name: 'default-outcome: the null run is not a win (every wall must earn its place)',
    run({ level }) {
      const nullRun = simulate(level, []);
      if (nullRun.outcome === 'win') {
        return { ok: false, detail: 'null run already delivers all movers (par 0, no choice — freebie)' };
      }
      return { ok: true, detail: `null run outcome = ${nullRun.outcome} (requires play)` };
    },
  },

  // G2 — STRUCTURAL MINIMUMS. R1/R9 bounds hold AND the room is actually solvable (the
  // certified solution wins when replayed through the SAME engine).
  {
    id: 'G2',
    name: 'structural minimums: ceiling bounds (R1/R9) hold and the room is solvable',
    run({ level, sw, outcome }) {
      const errs = [];
      if (!(level.width >= 1 && level.width <= 8)) errs.push(`width ${level.width} out of 1..8 (R9)`);
      if (!(level.height >= 1 && level.height <= 8)) errs.push(`height ${level.height} out of 1..8 (R9)`);
      const nm = (level.movers || []).length;
      if (!(nm >= 1 && nm <= 3)) errs.push(`movers ${nm} out of 1..3 (R9)`);
      const nh = (level.hunters || []).length;
      if (!(nh >= 0 && nh <= 2)) errs.push(`hunters ${nh} out of 0..2 (R9)`);
      if (!((level.sinks || []).length >= 1)) errs.push('needs >=1 sink (R1)');
      const k = level.k != null ? level.k : null;
      if (k != null && !(k >= 0 && k <= 6)) errs.push(`k ${k} out of 0..6 (R9)`);
      if (!sw || !sw.solution) errs.push('no solution found (unsolvable / aborted)');
      else if (outcome !== 'win') errs.push(`replayed solution outcome = ${outcome}, not win`);
      return errs.length
        ? { ok: false, detail: errs.join('; ') }
        : { ok: true, detail: `${level.width}x${level.height}, ${nm} movers, ${nh} hunters, k=${k}, solvable` };
    },
  },

  // G3 — ANTI-GREEDY (Medium+ = T1 and up). The obvious line — wall each mover's own
  // path independently — must NOT win: the room must demand shared deflection /
  // handedness / a manufactured dead-end (a wall not simply in front of one mover). The
  // EASY band (T0 on-ramp) is EXEMPT by design (D-ONRAMP: the intuitive move IS the
  // answer there).
  {
    id: 'G3',
    name: 'anti-greedy (Medium+): independent per-mover walling does NOT win above the on-ramp',
    run({ level, par, tier }) {
      const rank = tier == null ? null : tierRank(tier);
      if (rank == null || rank < MEDIUM_PLUS) {
        return { ok: true, detail: `on-ramp band (T0) — anti-greedy applies from T1 up` };
      }
      const greedy = greedyWins(level, par);
      return greedy
        ? { ok: false, detail: 'Medium+ room won by the greedy per-mover-walling line (obvious line wins)' }
        : { ok: true, detail: 'greedy per-mover walling loses (the obvious line must not win)' };
    },
  },

  // G4 — UNIQUENESS (R-COUNT). Exactly one optimal solution at par (induced-trace
  // canonical), tri-state-honest: a verdict reached under a maxNodes abort is REJECTED
  // (never shipped as unique). T0 teaching boards are EXEMPT — a par-1 front-wall board
  // legitimately has several inert-wall-equivalent winners; the on-ramp is about the
  // *ten*, not a unique line.
  {
    id: 'G4',
    name: 'uniqueness: exactly one optimal solution at par (tri-state-honest)',
    run({ par, count, unique, aborted, tier }) {
      const rank = tier == null ? null : tierRank(tier);
      if (par == null) return { ok: false, detail: 'no par (unsolvable / aborted)' };
      if (aborted) return { ok: false, detail: 'uniqueness verdict reached under a maxNodes abort (tri-state UNKNOWN — never shipped as unique)' };
      if (rank != null && rank < MEDIUM_PLUS) {
        return { ok: true, detail: `on-ramp band (T0) — uniqueness exempt (count=${count})` };
      }
      if (count === 0) return { ok: false, detail: 'par solve found but countSolutions==0 (certifier disagreement)' };
      if (unique !== true) return { ok: false, detail: `${count} optimal solutions at par (not unique)` };
      return { ok: true, detail: `unique optimal at par=${par}` };
    },
  },

  // G5 — TECHNIQUE-TIER LADDER. The room's COMPUTED structure must match its declared
  // tier — a room cannot over- or under-claim. T0 = front-wall-works; T1 = shared
  // deflection present; T2 = a manufactured dead-end (reverse) on the line; T3 = THE
  // CATCH (no wall directly in front of any mover).
  {
    id: 'G5',
    name: 'technique-tier ladder: computed structure matches the declared tier',
    run({ level, sw, par, tier }) {
      if (tier == null) return { ok: true, detail: 'no tier declared (ladder check skipped)' };
      if (!sw || !sw.solution) return { ok: false, detail: 'no solution — cannot verify tier structure' };
      const rank = tierRank(tier);
      const sol = sw.solution;
      const fronts = frontEdgesAtStart(level);
      const front = sol.some((w) => fronts.has(w));
      const shared = hasSharedDeflectionWall(level, sol);
      const deadEnd = manufacturesDeadEnd(level, sol);
      const catchShaped = isCatchShaped(level, sol);

      if (rank === TIERS.T0) {
        // teaching band: the intuitive FRONT-wall move must be a winner (D-ONRAMP).
        const someFrontWins = [...fronts].some((w) => isWin(level, [w]));
        if (!someFrontWins) {
          return { ok: false, detail: 'T0 declared but no single front-wall move wins (not a teaching board)' };
        }
      }
      if (rank === TIERS.T1) {
        if (!shared) return { ok: false, detail: 'T1 declared but no wall is load-bearing for ≥2 movers (no shared deflection)' };
      }
      if (rank === TIERS.T2) {
        if (!deadEnd) return { ok: false, detail: 'T2 declared but the solution forces no manufactured reverse (no dead-end)' };
      }
      if (rank >= TIERS.T3) {
        if (!catchShaped) return { ok: false, detail: 'T3 declared but the solution places a wall directly in front of a mover (not THE CATCH — the obvious "point it" line)' };
      }
      return {
        ok: true,
        detail: `tier ${tierLabel(tier)}: front=${front} shared=${shared} deadEnd=${deadEnd} catch=${catchShaped}`,
      };
    },
  },

  // G6 — SEQUENCE SHAPE + STRUCTURAL MINIMUM. The certified solution is legal and
  // irredundant; for Medium+ tiers par ≥ 2 walls (the structural minimum — no Medium+
  // room solved by a single wall in front of one mover). T0 is exempt (par ≤ 2, may be 1).
  {
    id: 'G6',
    name: 'sequence shape + structural minimum: legal, irredundant, par ≥ 2 above the on-ramp',
    run({ level, sw, par, tier }) {
      if (!sw || !sw.solution) return { ok: false, detail: 'no solution to shape-check' };
      const sol = sw.solution;
      const k = level.k != null ? level.k : 6;
      if (sol.length > k) return { ok: false, detail: `solution uses ${sol.length} walls > k=${k} (over budget)` };
      if (par != null && sol.length !== par) return { ok: false, detail: 'solution wall count != par (certifier disagreement)' };
      // every wall must be load-bearing (R-COUNT certification: drop-one breaks the win).
      if (!isIrredundant(level, sol)) {
        return { ok: false, detail: 'solution has a redundant wall (drop-one still wins — decorative move)' };
      }
      const rank = tier == null ? null : tierRank(tier);
      if (rank == null || rank < MEDIUM_PLUS) {
        // on-ramp: par ≤ 2 (teaching band stays tiny) and ≥ 1 (G1 already forbids par 0).
        if (par != null && par > 2) return { ok: false, detail: `on-ramp room has par ${par} > 2 (teaching band must stay tiny)` };
        return { ok: true, detail: `on-ramp par=${par} (≤2), ${sol.length} load-bearing wall(s)` };
      }
      // Medium+ structural minimum: par ≥ 2 (no single-wall-in-front trivial solve).
      if (par != null && par < 2) {
        return { ok: false, detail: `Medium+ room solved by a single wall (par ${par} < 2 — structural minimum)` };
      }
      return { ok: true, detail: `par=${sol.length}≤k=${k}, ${sol.length} load-bearing walls` };
    },
  },

  // G7 — FAILURE LEGIBILITY. The frames are present and tell a legible story: delivery
  // is MONOTONE (no mover un-delivers), the terminal frame has every mover delivered
  // and no mover lost to a catch/box along the winning line, and the verdict was not
  // reached under a maxNodes abort (an illegible UNKNOWN).
  {
    id: 'G7',
    name: 'failure legibility: frames present, monotone delivery, terminal-clean',
    run({ frames, outcome, aborted, level }) {
      if (aborted) return { ok: false, detail: 'verdict reached under a maxNodes abort (illegible UNKNOWN — never shipped)' };
      if (!frames || frames.length < 2) return { ok: false, detail: 'no frames recorded for the solution (illegible)' };
      const nm = (level.movers || []).length;
      // monotone delivery: a mover never returns from delivered to live.
      const everDelivered = {};
      for (const f of frames) {
        for (const u of f.units) {
          if (u.kind !== 'mover') continue;
          if (everDelivered[u.id] && !u.delivered) {
            return { ok: false, detail: `mover ${u.id} un-delivered (non-monotone)` };
          }
          if (u.delivered) everDelivered[u.id] = true;
        }
      }
      if (outcome !== 'win') return { ok: false, detail: `terminal outcome = ${outcome}, not win` };
      const last = frames[frames.length - 1];
      const liveMovers = last.units.filter((u) => u.kind === 'mover' && !u.delivered).length;
      if (liveMovers !== 0) return { ok: false, detail: `${liveMovers} mover(s) still undelivered in the terminal frame` };
      return { ok: true, detail: `${frames.length} frames, monotone delivery, all ${nm} movers delivered` };
    },
  },

  // G8 — ABSOLUTE DIFFICULTY FLOOR + VERBS-LOAD-BEARING (the lesson: difficulty is not
  // validity). The other gates are RELATIVE (a room matches its declared tier); this
  // one is ABSOLUTE so a flat field of tiny par-1 rooms can NEVER certify as the HARD
  // tier (T3). The EASY on-ramp band (T0) is EXEMPT from the magnitude floor but must
  // still carry a real choice (par ≥ 1, the wall verb is used). Every metric is engine
  // FACT.
  {
    id: 'G8',
    name: 'absolute difficulty floor + verbs-load-bearing: search/magnitude floor at the hard tier; turn-rule deflection matters',
    run({ level, sw, par, tier }) {
      const rank = tier == null ? null : tierRank(tier);

      // ON-RAMP BAND (T0) — exempt from the magnitude floor, but the WALL verb must be
      // used (par ≥ 1; G1 already forbids par 0) and the turn-rule deflection must
      // matter (the wall bent the path — otherwise the wall did nothing).
      if (rank == null || rank < MEDIUM_PLUS) {
        if (par != null && par < 1) {
          return { ok: false, detail: 'on-ramp room solved by zero walls (the wall verb is dead — freebie)' };
        }
        if (sw && sw.solution && !deflectionLoadBearing(level, sw.solution)) {
          return { ok: false, detail: 'on-ramp room: the turn-rule never fires on the winning line (the wall did nothing the geometry did not already do — deflection vestigial)' };
        }
        return { ok: true, detail: `on-ramp band (${tierLabel(rank ?? 0)}) — magnitude-floor exempt, par=${par}, deflection load-bearing` };
      }

      // MID+ TIERS (T1+): VERBS-LOAD-BEARING — the turn-rule deflection (the engine's
      // steering verb) must MATTER on the certified line, never vestigial.
      if (!sw || !sw.solution) return { ok: false, detail: 'mid+ room has no certified solution to floor-check' };
      if (!deflectionLoadBearing(level, sw.solution)) {
        return { ok: false, detail: 'mid+ room: movement-via-deflection is vestigial (the turn-rule never bends a path on the winning line — a SPEC verb does not matter)' };
      }

      // SEARCH FLOOR (all mid+): the par solve must explore a non-trivial subtree — the
      // room is not eyeball-trivial. (Proxy: solveWithStats node count.)
      const nodes = sw.nodes || 0;
      if (nodes < SEARCH_FLOOR) {
        return { ok: false, detail: `mid+ room is eyeball-trivial: solver explored only ${nodes} nodes (< SEARCH_FLOOR=${SEARCH_FLOOR})` };
      }

      // HARD TIER (T3): the ABSOLUTE magnitude minimum — a genuinely large decision
      // space (board area + mover count + par walls), so a flat field of tiny par-1
      // rooms can NEVER certify as the hard tier (the exact defect the lesson names).
      if (rank >= TIERS.T3) {
        const area = level.width * level.height;
        const nm = (level.movers || []).length;
        const errs = [];
        if (area < HARD_AREA_MIN) errs.push(`board area ${area} < ${HARD_AREA_MIN} (≥5x4)`);
        if (nm < HARD_MOVERS_MIN) errs.push(`movers ${nm} < ${HARD_MOVERS_MIN}`);
        if (par != null && par < HARD_PAR_MIN) errs.push(`par ${par} < ${HARD_PAR_MIN} walls`);
        if (errs.length) {
          return { ok: false, detail: `HARD-tier magnitude floor unmet: ${errs.join('; ')} (a tiny par-1 room cannot be the hard tier; nodes=${nodes})` };
        }
      }

      return {
        ok: true,
        detail: `floor cleared: nodes=${nodes}≥${SEARCH_FLOOR}, deflection load-bearing, area=${level.width * level.height}, movers=${(level.movers || []).length}, par=${par}`,
      };
    },
  },
];

// ───────────────────────── checkContract — one engine pass ─────────────────────────
export function checkContract(level, { tier = null, maxNodes = MAX_NODES_DEFAULT } = {}) {
  const analysis = analyzeRoom(level, { tier, maxNodes });
  const gates = GATES.map((g) => {
    let res;
    try {
      res = g.run(analysis);
    } catch (err) {
      res = { ok: false, detail: `gate threw: ${err.message}` };
    }
    return { id: g.id, name: g.name, ok: !!res.ok, detail: res.detail };
  });
  const failures = gates.filter((g) => !g.ok);
  return {
    ok: failures.length === 0,
    gates,
    failures,
    par: analysis.par,
    count: analysis.count,
    unique: analysis.unique,
  };
}

export const GATE_COUNT = GATES.length;

// Fetch a single gate by id (for targeted gate-level testing). Returns the gate object
// { id, name, run } or throws if unknown.
export function getGate(id) {
  const g = GATES.find((x) => x.id === id);
  if (!g) throw new Error(`unknown gate ${id}`);
  return g;
}
