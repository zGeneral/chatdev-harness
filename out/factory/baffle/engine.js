// Baffle — deterministic engine + exact solver.
// Pattern: graphs/oracleforge/vendor/templates/{engine/simulation.js,solver/solver.js}.
// Implements the frozen SPEC (out/factory/baffle/SPEC.md): R1..R9, R-FRONTIER,
// R-PRUNE, R-COUNT. No RNG / no float / no wall-clock / no hash-ordered iteration
// in the rule layer (R7).
//
// THE SOUL: the player cannot point a mover. Their whole budget is k wall segments
// on interior grid edges. A wall only FORBIDS the edge it sits on; the fixed
// turn-rule (advance; else right=90°CW; else left; else reverse) then PICKS the
// exit. Undirected coarse control.

// ───────────────────────────── geometry ─────────────────────────────
// Facing integers: 0=N, 1=E, 2=S, 3=W  (clockwise order).
// Screen coords: x = column (E is +x), y = row (S is +y, grows downward).
// Chirality anchor (R2): right = 90° CW = (f+1)%4. This makes N→E→S→W→N a
// clockwise sweep in screen space; fixed once so builds cannot diverge.
export const N = 0, E = 1, S = 2, W = 3;
export const RIGHT = (f) => (f + 1) & 3;
export const LEFT = (f) => (f + 3) & 3;
export const REVERSE = (f) => (f + 2) & 3;
// Turn priority order applied when the cell ahead is blocked (R2):
const TURN_PRIORITY = Object.freeze([RIGHT, LEFT, REVERSE]);

// Frozen direction tables (R7): the rule layer reads these every tick and must
// NEVER be able to mutate them — a frozen module-level table cannot become a
// hidden channel of cross-run state. Indexed by facing 0=N,1=E,2=S,3=W.
const DX = Object.freeze([0, 1, 0, -1]); // N,E,S,W
const DY = Object.freeze([-1, 0, 1, 0]);

const cellKey = (x, y) => `${x},${y}`;
const step = (x, y, dir) => ({ x: x + DX[dir], y: y + DY[dir] });

// Canonical undirected edge key between cell (x,y) and its neighbour in dir.
// Sort the two cell coords so the wall is shared by both adjacent cells (R3).
export function edgeKey(x, y, dir) {
  const nx = x + DX[dir], ny = y + DY[dir];
  // lexicographic order on (x,y) of the two endpoints
  if (x < nx || (x === nx && y < ny)) return `${x},${y}|${nx},${ny}`;
  return `${nx},${ny}|${x},${y}`;
}

// ───────────────────────────── board ─────────────────────────────
// A level (R1):
//   { width, height,
//     open?: [[x,y],...]        // open cells; default = full rectangle interior
//     prewalls?: [edgeKey,...]  // pre-walled interior edges
//     movers:  [{x,y,facing}],  // self-driving; id assigned by index "m<i>"
//     sinks:   [[x,y],...],
//     hunters?:[{x,y,facing}],  // optional; id "h<i>"
//     k?: number }              // wall budget (solver/UI; engine ignores)
//
// The border is fully walled implicitly: any step off the open-cell set is blocked.

function buildBoard(level) {
  const width = level.width, height = level.height;
  let openSet;
  if (level.open && level.open.length) {
    openSet = new Set(level.open.map(([x, y]) => cellKey(x, y)));
  } else {
    openSet = new Set();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) openSet.add(cellKey(x, y));
  }
  const sinks = new Set((level.sinks || []).map(([x, y]) => cellKey(x, y)));
  return { width, height, openSet, sinks };
}

const isOpen = (board, x, y) => board.openSet.has(cellKey(x, y));
const isSink = (board, x, y) => board.sinks.has(cellKey(x, y));

// All PLAYER-placeable interior edges of a board: an edge between two OPEN cells,
// minus any edge already carrying a pre-wall (placing there is an idempotent no-op,
// R3 — so the solver/brute must not branch on it). Border edges and edges touching
// a non-open cell are not placeable — the border is already permanently walled (R1).
export function placeableEdges(level) {
  const board = buildBoard(level);
  const pre = new Set(level.prewalls || []);
  const edges = new Set();
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (!isOpen(board, x, y)) continue;
      // only E and S directions to enumerate each undirected edge once
      for (const dir of [E, S]) {
        const nx = x + DX[dir], ny = y + DY[dir];
        if (!isOpen(board, nx, ny)) continue;
        const ek = edgeKey(x, y, dir);
        if (pre.has(ek)) continue; // already permanently walled
        edges.add(ek);
      }
    }
  }
  return [...edges].sort(); // deterministic order (R7)
}

// blocked: is movement from (x,y) in direction dir forbidden?
// Forbidden if the neighbour is off the open set (border / mask) OR a wall sits
// on that edge. Walls block BOTH adjacent cells (R3); idempotent multiset → Set.
function blocked(board, walls, x, y, dir) {
  const nx = x + DX[dir], ny = y + DY[dir];
  if (!isOpen(board, nx, ny)) return true;
  return walls.has(edgeKey(x, y, dir));
}

// ───────────────────────── the turn-rule (R2) ─────────────────────────
// Given a unit's cell+facing and the wall set, return its INTENT for this tick:
//   { nx, ny, facing }  — the cell it tries to enter and the facing it turns to.
// If all four directions are blocked → { boxed:true } (R2 FAIL).
// NOTE: the rule only ever rotates the facing toward the FIRST unblocked exit by
// the fixed priority [ahead, right, left, reverse]; it always then steps one cell.
function turnRule(board, walls, x, y, facing) {
  // 1) straight ahead
  if (!blocked(board, walls, x, y, facing)) {
    const { x: nx, y: ny } = step(x, y, facing);
    return { nx, ny, facing };
  }
  // 2) right, else left, else reverse — fixed priority
  for (const turn of TURN_PRIORITY) {
    const nf = turn(facing);
    if (!blocked(board, walls, x, y, nf)) {
      const { x: nx, y: ny } = step(x, y, nf);
      return { nx, ny, facing: nf };
    }
  }
  return { boxed: true };
}

// ───────────────────────── state / determinism (R7) ─────────────────────────
// A unit: { id, kind:'mover'|'hunter', x, y, facing, delivered }.
// Canonical state hash for cycle detection + twin-run determinism: SORTED multiset
// of live (id, x, y, facing) over movers+hunters, plus the sorted delivered-mover
// id set. Omitting facing or hunter state would false-positive cycles or miss real
// loops (R7 / Oracle sketch) — so all of it is hashed.
function stateHash(units, deliveredIds) {
  const live = units
    .filter((u) => !u.delivered)
    .map((u) => `${u.id}:${u.x},${u.y}:${u.facing}`)
    .sort()
    .join(';');
  const del = [...deliveredIds].sort().join(',');
  return `L[${live}]D[${del}]`;
}

// ───────────────────────── one tick (R6) ─────────────────────────
// Fixed, total per-tick pipeline (R6):
//   (a) compute all intents from PRE-TICK state;
//   (b) collisions/catches FIRST (FAIL wins ties over delivery):
//         - any unit boxed (R2)            → FAIL
//         - mover/unit pair swap           → FAIL (mover↔hunter swap = catch; R5)
//         - ≥2 movers converging into one cell → FAIL (R6 b)
//         - post-move co-occupancy with a hunter (catch) → FAIL (R5/R6)
//   (c) apply moves + sink delivery (a mover entering a sink is removed);
//   (d) cycle / boxed already handled; full-state cycle handled by caller.
// Follow-into-a-just-vacated cell is legal (R6).
//
// Returns one of:
//   { fail:'boxed'|'swap'|'converge'|'caught' }   terminal FAIL
//   null                                          continue
function stepTick(board, walls, units, arrowMap = null) {
  // (a) intents from pre-tick state. arrowMap (S-ABLATE only) overrides a unit's
  // facing when it sits on a stamped cell BEFORE the turn-rule runs — the arrow
  // actuator. null in the shipped engine (walls are the only steering, R2).
  const intents = units.map((u) => {
    if (u.delivered) return null;
    let f = u.facing;
    if (arrowMap) { const a = arrowMap.get(`${u.x},${u.y}`); if (a !== undefined) { f = a; u.facing = a; } }
    return turnRule(board, walls, u.x, u.y, f);
  });

  // (b1) boxed?
  for (let i = 0; i < units.length; i++) {
    if (units[i].delivered) continue;
    if (intents[i].boxed) return { fail: 'boxed' };
  }

  const live = [];
  for (let i = 0; i < units.length; i++) if (!units[i].delivered) live.push(i);

  // (b2) pairwise swaps (mover↔mover and mover↔hunter both FAIL).
  // A swap: unit a moves into b's pre-tick cell AND b moves into a's pre-tick cell.
  for (let a = 0; a < live.length; a++) {
    for (let b = a + 1; b < live.length; b++) {
      const ia = live[a], ib = live[b];
      const ua = units[ia], ub = units[ib];
      const inta = intents[ia], intb = intents[ib];
      if (inta.nx === ub.x && inta.ny === ub.y &&
          intb.nx === ua.x && intb.ny === ua.y) {
        return { fail: 'swap' };
      }
    }
  }

  // (b3) ≥2 MOVERS converging into one cell → FAIL.
  // (Two hunters sharing a cell is not a fail in itself; only mover-involved
  //  co-occupancy / mover-mover convergence is terminal. A mover landing where a
  //  hunter lands is a catch, handled in b4.)
  {
    const dest = new Map(); // cellKey -> count of movers
    for (const i of live) {
      if (units[i].kind !== 'mover') continue;
      const t = intents[i];
      // a mover entering a sink is delivered (removed) — does not converge-fail
      if (isSink(board, t.nx, t.ny)) continue;
      const kk = cellKey(t.nx, t.ny);
      dest.set(kk, (dest.get(kk) || 0) + 1);
      if (dest.get(kk) >= 2) return { fail: 'converge' };
    }
  }

  // (b4) catch: a mover ends on the same cell as a hunter (post-move co-occupancy).
  // Compute post-move cells; a non-delivered mover sharing a hunter's post-move
  // cell = caught. Mover↔hunter swap already failed in b2.
  {
    const hunterDest = new Set();
    for (const i of live) {
      if (units[i].kind !== 'hunter') continue;
      const t = intents[i];
      hunterDest.add(cellKey(t.nx, t.ny));
    }
    for (const i of live) {
      if (units[i].kind !== 'mover') continue;
      const t = intents[i];
      if (isSink(board, t.nx, t.ny)) continue; // delivered & removed this tick
      if (hunterDest.has(cellKey(t.nx, t.ny))) return { fail: 'caught' };
    }
  }

  // (c) apply moves + sink delivery
  for (const i of live) {
    const u = units[i], t = intents[i];
    u.x = t.nx; u.y = t.ny; u.facing = t.facing;
    if (u.kind === 'mover' && isSink(board, u.x, u.y)) u.delivered = true;
  }
  return null;
}

// ───────────────────────── run loop ─────────────────────────
// record=true → collect frames for UI/CLI playback (simulate).
// record=false → fast path for solver/generator: collects the TRACE-GLOBAL set of
//   (cell, facing) faced-edge frontier data + the per-tick visited cells (evaluate).
//
// Outcome:
//   'win'     — all movers delivered
//   'fail'    — a terminal FAIL fired (boxed/swap/converge/caught)
//   'cycle'   — a full-state repeat with movers still undelivered (no progress)
//   'stuck'   — hit the tick ceiling without resolving (defensive; cycle should fire first)
function run(level, walls, record) {
  const board = buildBoard(level);
  // Player walls UNION the board's permanent pre-walls (R1). Pre-walls are part of
  // the board, present in every run; idempotent with player walls (R3).
  const wallSet = walls instanceof Set ? new Set(walls) : new Set(walls);
  if (level.prewalls) for (const e of level.prewalls) wallSet.add(e);

  const units = [];
  (level.movers || []).forEach((m, i) =>
    units.push({ id: `m${i}`, kind: 'mover', x: m.x, y: m.y, facing: m.facing | 0, delivered: false }));
  (level.hunters || []).forEach((h, i) =>
    units.push({ id: `h${i}`, kind: 'hunter', x: h.x, y: h.y, facing: h.facing | 0, delivered: false }));

  const moverCount = units.filter((u) => u.kind === 'mover').length;
  const deliveredIds = new Set();

  const frames = record ? [] : null;
  // faced[] entries are records of every interior edge any mover/hunter faces-into
  // OR slides parallel past OR sits behind, at any tick (R-FRONTIER); we capture
  // the visited cells + facings each tick and expand to edges in the solver.
  const facedSamples = record ? null : []; // [{x,y,facing}, ...] across all ticks
  const trace = []; // sequence of state hashes (for induced-trace hash, R-COUNT)

  const snapshot = () => ({
    units: units.map((u) => ({ id: u.id, kind: u.kind, x: u.x, y: u.y, facing: u.facing, delivered: u.delivered })),
  });

  const captureFaced = () => {
    if (record) return;
    for (const u of units) if (!u.delivered) facedSamples.push({ x: u.x, y: u.y, facing: u.facing });
  };

  // Termination ceiling: a full-state repeat is GUARANTEED to fire (finite state
  // space), so the cycle check is the real terminator. The tick ceiling is a
  // generous defensive bound (R-INSTRUMENT measures the true max).
  const cells = board.openSet.size;
  const maxTicks = (cells * 4) * (units.length + 1) + 16;

  const seenStates = new Set();
  let ticks = 0;

  // initial frame / faced sample / trace
  if (record) frames.push(snapshot());
  captureFaced();
  const h0 = stateHash(units, deliveredIds);
  seenStates.add(h0);
  trace.push(h0);

  const finish = (outcome, reason = null) => {
    const base = { outcome, reason, ticks, traceHash: hashTrace(trace) };
    if (record) return { ...base, frames };
    return { ...base, faced: facedSamples, moverCount,
             delivered: units.filter((u) => u.kind === 'mover' && u.delivered).length };
  };

  for (let t = 0; t < maxTicks; t++) {
    // win check (all movers delivered) BEFORE stepping — a board that wins at the
    // null run (par 0) is detectable here.
    const liveMovers = units.filter((u) => u.kind === 'mover' && !u.delivered).length;
    if (moverCount > 0 && liveMovers === 0) return finish('win');

    const event = stepTick(board, wallSet, units);
    ticks++;

    // record deliveries into deliveredIds for the hash
    for (const u of units) if (u.kind === 'mover' && u.delivered) deliveredIds.add(u.id);

    if (event) return finish('fail', event.fail);

    if (record) frames.push(snapshot());
    captureFaced();

    // (d) full-state cycle: a repeat with undelivered movers = no-progress loop.
    const stillLive = units.filter((u) => u.kind === 'mover' && !u.delivered).length;
    if (stillLive === 0) return finish('win');

    const h = stateHash(units, deliveredIds);
    trace.push(h);
    if (seenStates.has(h)) return finish('cycle');
    seenStates.add(h);
  }
  return finish('stuck');
}

// A deterministic hash of the full state trace (R7): the induced-trace identity
// used by countSolutions to dedup distinct par sets (R-COUNT iii). djb2 over the
// joined trace — order-preserving, no float, no RNG.
export function hashTrace(trace) {
  let h = 5381;
  const s = trace.join('\n');
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

// ───────────────────────── public engine API ─────────────────────────
/** Full playback for the UI/CLI: returns { outcome, frames, ticks, traceHash }. */
export const simulate = (level, walls = []) => run(level, walls, true);

/** Fast frame-free path for solver/generator: returns
 *  { outcome, faced:[{x,y,facing}], moverCount, delivered, ticks, traceHash }. */
export const evaluate = (level, walls = []) => run(level, walls, false);

/** Win predicate convenience (R6): does this wall set deliver all movers? */
export function isWin(level, walls = []) {
  return evaluate(level, walls).outcome === 'win';
}

// ───────────────────────── solver (R-FRONTIER / R-PRUNE / R-COUNT) ─────────────────────────
// State the pruning fact (restated from SPEC, the tractability keystone):
//   A wall's DIRECT effect is local to its edge, but its INDUCED downstream effect
//   is GLOBAL. Therefore (R-FRONTIER) the solver may only branch on edges that some
//   unit actually faces/slides-past/sits-behind in the CURRENT partial trace
//   (recomputed after EVERY placement — never frozen from the null run); and
//   (R-PRUNE) it may prune a subtree ONLY on a whole-world dead state that no
//   remaining-budget wall could rescue. Irredundancy / counting is certification-
//   only (R-COUNT), never inside the search.

// Build the TRACE-GLOBAL faced-edge frontier (R-FRONTIER) from a fast-path trace:
// every placeable interior edge that ANY unit faces into OR slides parallel past
// OR sits behind, at ANY tick. From a sampled (x,y,facing) we add ALL FOUR
// incident edges of that cell (ahead + the two laterals + behind) restricted to
// placeable edges — this is exactly "faces into OR slides parallel past OR sits
// behind" and is the only formulation under which the soul's "wall beside/behind
// the stream" line is reachable.
function facedFrontier(level, placeableSet, faced) {
  const frontier = new Set();
  for (const s of faced) {
    for (const dir of [N, E, S, W]) {
      const ek = edgeKey(s.x, s.y, dir);
      if (placeableSet.has(ek)) frontier.add(ek);
    }
  }
  return frontier;
}

// Whole-world dead-state test (R-PRUNE): may we prune this partial wall set?
// Conservative cheap rule from the SPEC: prune ONLY when
//   (i) the remaining budget is 0 (k exhausted) and it is not a win, OR
//   (ii) a trapped/boxed pocket has ZERO placeable bordering edges the rest of the
//        budget could face — i.e. no in-budget wall can change the outcome.
// We implement (i) exactly (handled by the depth limit) and a sound subset of (ii):
// if the current run FAILs by 'boxed' AND the boxed mover's cell has no placeable
// incident edge still un-walled that the remaining budget could add, prune.
// Otherwise we DESCEND (never prune on a mere partial soft-lock — the recorded
// strike). To stay sound and simple we descend on every non-win, non-budget-
// exhausted node whose frontier is non-empty; the dead-state shortcut only fires
// at the cheap, provably-safe (i) leaf. This is conservative: it never prunes a
// rescuable subtree (the correctness requirement), at the cost of some extra nodes.

const wallsSig = (walls) => [...walls].sort().join('|');

function searchFirst(level, placeableSet, walls, limit, seen, stats, frozenFrontier) {
  if (stats.aborted) return null;
  const sig = wallsSig(walls);
  if (seen.has(sig)) return null;
  seen.add(sig);
  if (++stats.nodes > stats.maxNodes) { stats.aborted = true; return null; }

  const res = evaluate(level, walls);
  if (res.outcome === 'win') return [...walls];
  if (walls.size >= limit) return null; // budget exhausted on this path (R-PRUNE i)

  // Recompute the trace-global faced frontier AFTER this placement (R-FRONTIER:
  // never frozen). Branch on each not-yet-placed frontier edge.
  // frozenFrontier (UNSOUND, test-only): when supplied, the frontier is frozen
  // from the null run and never recomputed — used by GT-FRONTIER to PROVE the
  // recompute is load-bearing (a frozen frontier goes false-UNSAT).
  const frontier = frozenFrontier || facedFrontier(level, placeableSet, res.faced);
  // deterministic order (R7)
  const ordered = [...frontier].sort();
  for (const ek of ordered) {
    if (walls.has(ek)) continue;
    walls.add(ek);
    const found = searchFirst(level, placeableSet, walls, limit, seen, stats, frozenFrontier);
    walls.delete(ek);
    if (found) return found;
    if (stats.aborted) return null;
  }
  return null;
}

/**
 * solveWithStats — lazy simulation-guided IDDFS on WALL COUNT (R-COUNT i).
 * The first depth that delivers all movers is the minimal par.
 * Returns { solution:[edgeKey]|null, par:number|null, traceHash, nodes, aborted }.
 * Irredundancy is NOT applied in-search (R-COUNT ii). maxNodes makes uniqueness
 * tri-state-honest (R-INSTRUMENT): a verdict under an abort is rejected, never
 * shipped as unique.
 *
 * opts.frozenFrontier (test-only, UNSOUND): when true, the faced-edge frontier is
 * computed ONCE from the null run and frozen — never recomputed after a placement.
 * This is the deleted-accelerator strike #1; GT-FRONTIER uses it to demonstrate
 * false-UNSAT. NEVER use in the shipped oracle.
 */
export function solveWithStats(level, { maxMoves, maxNodes = Infinity, frozenFrontier = false } = {}) {
  const placeable = placeableEdges(level);
  const placeableSet = new Set(placeable);
  const kCap = (level.k != null ? level.k : (maxMoves != null ? maxMoves : 6));
  const limitMax = Math.min(maxMoves != null ? maxMoves : kCap, kCap, placeable.length);
  const stats = { nodes: 0, maxNodes, aborted: false };

  // The frozen-frontier variant (test-only): freeze from the null run trace.
  let frozen = null;
  if (frozenFrontier) frozen = facedFrontier(level, placeableSet, evaluate(level, []).faced);

  for (let limit = 0; limit <= limitMax; limit++) {
    const solution = searchFirst(level, placeableSet, new Set(), limit, new Set(), stats, frozen);
    if (solution) {
      const traceHash = evaluate(level, solution).traceHash;
      return { solution, par: solution.length, traceHash, nodes: stats.nodes, aborted: false };
    }
    if (stats.aborted) break;
  }
  return { solution: null, par: null, traceHash: null, nodes: stats.nodes, aborted: stats.aborted };
}

// Enumerate ALL winning wall sets of EXACTLY `size` walls, restricted to the
// trace-global frontier reachable along each partial path (R-FRONTIER), with NO
// in-search irredundancy and NO subset domination (R-COUNT ii/iii). Collects the
// completed winning sets (as sorted edge arrays) — counting/dedup happens after.
function enumerateAt(level, placeableSet, walls, size, seen, out, stats) {
  if (stats.aborted) return;
  if (walls.size === size) {
    const res = evaluate(level, walls);
    if (res.outcome === 'win') out.push({ set: [...walls].sort(), traceHash: res.traceHash });
    return;
  }
  const sig = wallsSig(walls);
  if (seen.has(sig)) return;
  seen.add(sig);
  if (++stats.nodes > stats.maxNodes) { stats.aborted = true; return; }

  const res = evaluate(level, walls);
  // If already a win with FEWER than `size` walls, this path can't yield a NEW
  // minimal-size set by adding more (those are larger). At exactly par-size search
  // we still want sets of cardinality === size, so we only collect at full size.
  // Do NOT early-return on a sub-size win: a redundant-at-placement wall may be
  // load-bearing after a later wall reroutes a mover (R-COUNT ii) — but for the
  // par-level enumeration the winning sets we care about have cardinality `size`,
  // and any path that already won with fewer walls is a STRICT subset of a larger
  // set; those larger sets induce some trace and are enumerated by OTHER paths.
  // We keep descending to be exhaustive over the frontier (completeness > speed).
  const frontier = facedFrontier(level, placeableSet, res.faced);
  for (const ek of [...frontier].sort()) {
    if (walls.has(ek)) continue;
    walls.add(ek);
    enumerateAt(level, placeableSet, walls, size, seen, out, stats);
    walls.delete(ek);
    if (stats.aborted) return;
  }
}

/**
 * countSolutions — exhaustive at par (R-COUNT iii).
 * Enumerates ALL minimal wall sets at the winning depth `par`, dedups STRICTLY on
 * induced-trace hash, with equal-cardinality subset-domination DISABLED (two
 * distinct par sets inducing DIFFERENT traces are genuine non-uniqueness and both
 * count). Early-exits at the `cap`-th distinct induced trace.
 * Returns { count, unique:boolean|null, aborted, par, traces:[hash], nodes }.
 *   unique === true  iff exactly one distinct induced trace and not aborted;
 *   unique === false iff ≥2 distinct traces;
 *   unique === null  iff the verdict was reached under a maxNodes abort
 *                    (tri-state: unknown-aborted — never shipped as unique).
 */
export function countSolutions(level, { cap = 2, maxNodes = Infinity, par = null } = {}) {
  let parVal = par;
  if (parVal == null) {
    const s = solveWithStats(level, { maxNodes });
    if (s.aborted) return { count: 0, rawCount: 0, unique: null, aborted: true, par: null, traces: [], nodes: s.nodes };
    if (s.par == null) return { count: 0, rawCount: 0, unique: false, aborted: false, par: null, traces: [], nodes: s.nodes };
    parVal = s.par;
  }
  const placeable = placeableEdges(level);
  const placeableSet = new Set(placeable);
  const stats = { nodes: 0, maxNodes, aborted: false };
  const out = [];
  enumerateAt(level, placeableSet, new Set(), parVal, new Set(), out, stats);

  // Dedup strictly on induced-trace hash (R-COUNT iii). Distinct wall sets that
  // induce the SAME trace collapse to one; distinct traces all count.
  const traces = new Set();
  for (const w of out) traces.add(w.traceHash);
  const count = traces.size;
  const aborted = stats.aborted;
  let unique = null;
  if (!aborted) unique = count === 1;
  return {
    count: Math.min(count, cap === Infinity ? count : Math.max(count, 0)),
    rawCount: count,
    unique,
    aborted,
    par: parVal,
    traces: [...traces].sort(),
    nodes: stats.nodes,
  };
}

// Brute-force completeness oracle for the census/tests ONLY (R-AUDIT): enumerate
// EVERY C(E,k) subset up to par and report (par, distinct-induced-trace count).
// This is the ground truth the pruned IDDFS is audited against. NEVER the shipped
// oracle (it is exponential) — bounded small-board cross-check.
export function bruteForce(level, { maxK = null } = {}) {
  const edges = placeableEdges(level);
  const E_ = edges.length;
  const kCap = maxK != null ? maxK : (level.k != null ? level.k : 6);

  // find minimal par by increasing subset size
  for (let k = 0; k <= Math.min(kCap, E_); k++) {
    const wins = [];
    const idx = [];
    const rec = (start, depth) => {
      if (depth === k) {
        const walls = idx.map((i) => edges[i]);
        const res = evaluate(level, walls);
        if (res.outcome === 'win') wins.push(res.traceHash);
        return;
      }
      for (let i = start; i < E_; i++) { idx.push(i); rec(i + 1, depth + 1); idx.pop(); }
    };
    rec(0, 0);
    if (wins.length > 0) {
      const traces = new Set(wins);
      return { par: k, count: traces.size, traces: [...traces].sort() };
    }
  }
  return { par: null, count: 0, traces: [] };
}

// Helper for the ablation test (S-ABLATE): an ARROW actuator. Instead of forbidding
// an edge, the player stamps a heading on a cell; a unit entering that cell adopts
// the stamped facing (drove's direction-override). This deliberately re-skins
// Baffle into the point-and-aim game to PROVE the turn-rule is the spine — used
// ONLY by the soul test, never by the shipped game.
export function simulateArrows(level, arrows = []) {
  // arrows: [{x,y,facing}] — a stamped heading on a cell. The board's FIXED terrain
  // (border + pre-walls) is unchanged — ONLY the player's actuator differs (a
  // stamped heading instead of a forbidden edge). Uses the SAME R6 tick pipeline
  // (collisions/catches/cycle), so the comparison is a faithful actuator swap.
  const arrowMap = new Map(arrows.map((a) => [`${a.x},${a.y}`, a.facing | 0]));
  const board = buildBoard(level);
  const fixedWalls = new Set(level.prewalls || []);
  const units = (level.movers || []).map((m, i) =>
    ({ id: `m${i}`, kind: 'mover', x: m.x, y: m.y, facing: m.facing | 0, delivered: false }));
  (level.hunters || []).forEach((h, i) =>
    units.push({ id: `h${i}`, kind: 'hunter', x: h.x, y: h.y, facing: h.facing | 0, delivered: false }));
  const moverCount = units.filter((u) => u.kind === 'mover').length;
  const deliveredIds = new Set();
  const cells = board.openSet.size;
  const maxTicks = cells * 4 * (units.length + 1) + 16;
  const seen = new Set();
  seen.add(stateHash(units, deliveredIds));
  for (let t = 0; t < maxTicks; t++) {
    if (units.filter((u) => u.kind === 'mover' && !u.delivered).length === 0) return { outcome: 'win', ticks: t };
    const event = stepTick(board, fixedWalls, units, arrowMap);
    for (const u of units) if (u.kind === 'mover' && u.delivered) deliveredIds.add(u.id);
    if (event) return { outcome: 'fail', ticks: t, fail: event.fail };
    if (units.filter((u) => u.kind === 'mover' && !u.delivered).length === 0) return { outcome: 'win', ticks: t };
    const h = stateHash(units, deliveredIds);
    if (seen.has(h)) return { outcome: 'cycle', ticks: t };
    seen.add(h);
  }
  return { outcome: 'stuck', ticks: maxTicks };
}

// Solve with the ARROW actuator (IDDFS on number of stamped arrows) — used by
// S-ABLATE to show par/solvability differs from the wall actuator.
export function solveArrows(level, { maxArrows = 6 } = {}) {
  const board = buildBoard(level);
  const cells = [];
  for (let y = 0; y < board.height; y++)
    for (let x = 0; x < board.width; x++)
      if (isOpen(board, x, y) && !isSink(board, x, y)) cells.push({ x, y });
  const facings = [N, E, S, W];

  for (let limit = 0; limit <= maxArrows; limit++) {
    const chosen = [];
    const rec = (start) => {
      if (chosen.length === limit) {
        return simulateArrows(level, chosen).outcome === 'win';
      }
      for (let i = start; i < cells.length; i++) {
        for (const f of facings) {
          chosen.push({ x: cells[i].x, y: cells[i].y, facing: f });
          if (rec(i + 1)) return true;
          chosen.pop();
        }
      }
      return false;
    };
    if (rec(0)) return { par: limit, solution: [...chosen] };
  }
  return { par: null, solution: null };
}
