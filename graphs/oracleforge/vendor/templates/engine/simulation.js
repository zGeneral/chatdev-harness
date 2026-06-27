// TEMPLATE — deterministic plan-then-run engine (frame-stream architecture).
// Pattern: skills/deterministic-engine (+ board.js, spawner.js).
// Fill the TODOs; keep the shape — every line of structure here is load-bearing.

// import { boardFor } from './board.js';     // static geometry: bounds, walls, masks
// import { createSpawner } from './spawner.js'; // who is born when (emission patterns)

function createWorld(level, playerMoves) {
  return {
    // board: boardFor(level),
    // spawner: createSpawner(level.spawns),
    units: [],
    // TODO: mutable overlays (pellets, consumable modifiers, …) as Maps keyed by cell
  };
}

/** The COMPLETE drawable state at one tick — one field per mechanic. */
function snapshotFrame(world) {
  return {
    units: world.units.map((u) => ({ ...u })),
    // TODO: one array per overlay (pellets, modifiers, …)
  };
}

// One tick. Returns null to continue, or a terminal event { outcome, ... }.
// TICK ORDER IS LAW — document and never reorder ambiguously:
// 1 intents → 2 unit-vs-unit failures (same cell + swap) → 3 world failures
// (bounds/walls/wrong-sink) → 4 apply moves + deliveries + pickups →
// 5 modifier adoption (consume single-use AFTER adoption) → 6 births
// (AFTER movement, so queues form instead of self-collisions).
function stepTick(world, t) {
  // TODO
  return null;
}

function run(level, playerMoves, record) {
  const world = createWorld(level, playerMoves);
  // world.spawner.emitDue(world.units, 0);
  const frames = record ? [] : null;
  const visited = record ? null : new Set();
  const track = () => {
    if (record) frames.push(snapshotFrame(world));
    else for (const u of world.units) visited.add(`${u.x},${u.y}`);
  };
  track();

  // Termination must scale with population AND check pending births:
  // "all delivered AND none pending" — a delayed spawn pattern must not insta-win.
  const maxTicks = (level.width * level.height /* + totalUnits */) * 4 + 8;
  const done = (extra) => (record
    ? { ...extra, frames }
    : { ...extra, visited, anyDelivered: world.units.some((u) => u.delivered) });

  for (let t = 0; t < maxTicks; t++) {
    // if (allDelivered && nonePending) return done(winOrStranded);
    const event = stepTick(world, t);
    if (event) return done(event);
    track();
  }
  return done({ outcome: 'stuck' });
}

/** Full playback for the UI/CLI. */
export const simulate = (level, moves) => run(level, moves, true);
/** Frame-free fast path for the solver/generator (≈2× search speed). */
export const evaluate = (level, moves) => run(level, moves, false);
