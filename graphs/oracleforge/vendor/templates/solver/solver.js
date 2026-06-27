// TEMPLATE — the exact-solver oracle (lazy simulation-guided IDDFS).
// Pattern: skills/exact-solver. The pruning fact in `walk` is the
// tractability keystone — restate yours from the Stage-0 spec.

import { evaluate } from '../engine/simulation.js';

/** Single source of placement truth — the UI must derive from this too. */
export function editableCells(level) {
  // TODO: open cells minus spawns/goals/presets, honoring any allow-list
  return [];
}

const key = (x, y) => `${x},${y}`;
const toMoves = (placed) => [...placed.entries()].map(([k, v]) => {
  const [x, y] = k.split(',').map(Number);
  return { x, y, ...v };
});
const signature = (placed) =>
  [...placed.entries()].map(([k, v]) => `${k}:${JSON.stringify(v)}`).sort().join('|');

const MOVE_VARIANTS = [/* TODO: e.g. four directions */];

function searchFirst(level, placed, editable, limit, seen, stats) {
  if (stats.aborted) return null;
  const sig = signature(placed);
  if (seen.has(sig)) return null;
  seen.add(sig);
  if (++stats.nodes > stats.maxNodes) { stats.aborted = true; return null; }

  const result = evaluate(level, toMoves(placed));
  if (result.outcome === 'win') return toMoves(placed);
  if (placed.size >= limit) return null;

  // THE PRUNING FACT: branch only on cells the simulation visited —
  // a move anywhere else provably cannot change the run.
  for (const cell of result.visited) {
    if (!editable.has(cell) || placed.has(cell)) continue;
    for (const variant of MOVE_VARIANTS) {
      placed.set(cell, variant);
      const found = searchFirst(level, placed, editable, limit, seen, stats);
      placed.delete(cell);
      if (found) return found;
    }
  }
  return null;
}

/** Iterative deepening: the first depth that wins IS par. */
export function solveWithStats(level, { maxMoves = 12, maxNodes = Infinity } = {}) {
  const editable = new Set(editableCells(level).map((c) => key(c.x, c.y)));
  const stats = { nodes: 0, maxNodes, aborted: false };
  for (let limit = 0; limit <= Math.min(maxMoves, editable.size); limit++) {
    const solution = searchFirst(level, new Map(), editable, limit, new Set(), stats);
    if (solution) return { solution, par: solution.length, nodes: stats.nodes, aborted: false };
    if (stats.aborted) break;
  }
  return { solution: null, par: null, nodes: stats.nodes, aborted: stats.aborted };
}

// TODO (fill in for your game — see skills/exact-solver):
// countSolutions(cap)            — uniqueness gate
// solutionsAt(size, { accept })  — fixed-size enumeration with in-search filtering
// analyze()                      — one-call report for generators
// …and in your contract module: isIrredundant, routeSignature, tieredSolutions.
