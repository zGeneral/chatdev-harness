// Baffle — playable PWA shell (flat-screen router).
// Built to DESIGN.md. Consumes the frozen engine (engine.js) and the baked
// curriculum (pack.json). No raw hex here — all colour comes from tokens.css
// via CSS classes / var(--…). Logic that the headless shell.test.js needs is
// exported from helpers.js (pure, DOM-free); this file is the browser glue.

import {
  dailyIndex, endlessIndex, nextLevelIndex, isLastLevel,
  climbUnlocked, climbFrontier, advanceReached,
  levelCap, starsForWalls, sumStars, climbStarPotential,
  dailyUnlocked, hintTokensAvailable, DAILY_UNLOCK_STARS, STARS_PER_TOKEN,
  applyStreak, hintLadder, cellName, edgeEndpoints, formatGoal,
} from './helpers.js';

// engine is loaded lazily (browser only); helpers.js is pure so tests can run
// without a DOM. We import simulate/solveWithStats for live play.
import { simulate, solveWithStats, placeableEdges } from './engine.js';
// the ENDLESS generator: deterministic, solver-verified levels beyond the curated
// pack, so the Climb ladder never tops out; plus the hard date-seeded DAILY level.
import { endlessLevel, dailyLevel } from './endless.js';
// synthesized sound effects (Web Audio; mutable, persisted).
import { sfx, setMuted, isMuted, unlock as unlockAudio } from './sfx.js';

// ───────────────────────── data ─────────────────────────
let PACK = null;
async function loadPack() {
  if (PACK) return PACK;
  const res = await fetch('./pack.json');
  PACK = await res.json();
  return PACK;
}

// ───────────────────────── persistence (local only) ─────────────────────────
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('baffle:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('baffle:' + k, JSON.stringify(v)); } catch {} },
};

// ───────────────────────── geometry helpers ─────────────────────────
function todayUTC(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ───────────────────────── board renderer (SVG) ─────────────────────────
// Renders a tide-pool diorama (ART_DIRECTION.md): two-tone sand tiles, a swirling
// whirlpool drain, the three UNMISTAKABLE wall states (dotted "build here" guide /
// barnacled rock pre-wall / driftwood plank you placed), cute tern-chick movers
// whose BEAK is the heading, the flock's current wake, and one keyboard-roving
// interactive edge per placeable interior edge (role=button, aria, data-state, glyph).
function renderBoard(state) {
  const { level } = state;
  const W = level.width, H = level.height;
  const placeable = new Set(placeableEdges(level));
  const prewallSet = new Set(level.prewalls || []);

  // virtual cell of 100 units; CSS scales the whole board (see styles.css .board).
  const CELL = 100;
  const vw = W * CELL, vh = H * CELL;
  const px = (x) => x * CELL, py = (y) => y * CELL;
  const cx = (x) => x * CELL + CELL / 2, cy = (y) => y * CELL + CELL / 2;

  const parts = [];
  parts.push(`<svg viewBox="0 0 ${vw} ${vh}" role="group" aria-label="Baffle tide-pool, ${W} by ${H}. Tap an interior edge to lay or lift a driftwood groyne.">`);

  // sand tiles (two-tone checker) + water under each drain
  const sinkSet = new Set((level.sinks || []).map(([x, y]) => `${x},${y}`));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const isSink = sinkSet.has(`${x},${y}`);
    const alt = (x + y) % 2 ? ' alt' : '';
    parts.push(`<rect class="cell${alt}${isSink ? ' sink' : ''}" x="${px(x)}" y="${py(y)}" width="${CELL}" height="${CELL}" />`);
  }
  // whirlpool drains (drawn over tiles, under everything else)
  for (const [x, y] of (level.sinks || [])) parts.push(whirlpool(cx(x), cy(y), CELL));

  // two-tone wet-sand gridlines (light outer first, dark inner on top → WCAG 1.4.11)
  for (const cls of ['gridline-hi', 'gridline-lo']) {
    for (let x = 0; x <= W; x++) parts.push(`<line class="${cls}" x1="${px(x)}" y1="0" x2="${px(x)}" y2="${vh}" />`);
    for (let y = 0; y <= H; y++) parts.push(`<line class="${cls}" x1="0" y1="${py(y)}" x2="${vw}" y2="${py(y)}" />`);
  }

  // the flock's CURRENT wakes — one per creature, tinted to its bird, so a wall's
  // effect reads against a visible baseline. Hidden while the run animates (the
  // birds ARE the show then).
  if (!state.animating && state.ghostPaths) {
    for (const g of state.ghostPaths) {
      if (!g.path || g.path.length < 2) continue;
      const d = g.path.map((p, i) => `${i ? 'L' : 'M'}${cx(p.x)} ${cy(p.y)}`).join(' ');
      parts.push(`<path class="ghost c${g.idx % 6}" d="${d}" />`);
    }
  }

  // empty placeable edges → a faint dotted "you can build here" guide (state #1)
  for (const ek of placeable) {
    if (state.walls.has(ek) || prewallSet.has(ek)) continue;
    const seg = edgeSegment(ek, CELL);
    if (seg) parts.push(`<line class="edge-guide" x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" />`);
  }
  // pre-walls → barnacled shore rock (state #2); placed → driftwood plank (state #3)
  for (const ek of prewallSet) parts.push(wallPlank(edgeSegment(ek, CELL), 'rock'));
  for (const ek of state.walls) parts.push(wallPlank(edgeSegment(ek, CELL), 'wood'));

  // interactive edges (one keyboard-roving button per placeable edge)
  const edges = [...placeable].sort();
  state._edges = edges;
  edges.forEach((ek, i) => {
    const placed = state.walls.has(ek);
    const seg = edgeSegment(ek, CELL);
    if (!seg) return;
    const ends = edgeEndpoints(ek);
    const a = cellName(ends.a.x, ends.a.y), b = cellName(ends.b.x, ends.b.y);
    const ds = placed ? 'placed' : 'empty';
    const mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
    parts.push(
      `<g class="edge" data-edge="${ek}" data-idx="${i}">` +
        // fat hit stroke. vector-effect=non-scaling-stroke pins the band to 44 CSS
        // px REGARDLESS of board scale (the prior "44 user units" rendered sub-44px —
        // the UX-audit failure). .board floors the cell pitch at --cell-min so these
        // 44px bands keep an 8px gap and never overlap.
        `<line class="edge-hit" data-edge-hit="${ek}" x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" ` +
          `stroke-width="44" vector-effect="non-scaling-stroke" role="button" tabindex="${i === state.cursor ? 0 : -1}" ` +
          `aria-pressed="${placed}" data-state="${ds}" ` +
          `aria-label="Groyne between ${a} and ${b} — ${placed ? 'placed (tap to lift)' : 'empty (tap to lay)'}" />` +
        // non-colour glyph marker: a peg shown only when placed (colour-independent)
        (placed ? `<circle class="wall-knob" cx="${mx}" cy="${my}" r="6" />` : '') +
      `</g>`,
    );
  });

  // the flock — cute tern chicks, drawn last (on top), in their own layer so the
  // run animation can tween them without re-rendering the board.
  parts.push(`<g class="units-layer">`);
  const units = state.units || level.movers.map((m, i) => ({ ...m, id: `m${i}`, kind: 'mover', delivered: false }));
  units.forEach((u) => { if (!u.delivered) parts.push(renderMover(u, cx, cy, CELL)); });
  parts.push(`</g>`);

  parts.push(`</svg>`);
  return parts.join('');
}

// A whirlpool drain: gold rim, water disc, two swirl arcs (slowly rotating), a calm eye.
function whirlpool(cx, cy, CELL) {
  const r = CELL * 0.36;
  return `<g class="whirl" transform="translate(${cx} ${cy})">` +
    `<circle class="whirl-rim" cx="0" cy="0" r="${r}" />` +
    `<circle class="whirl-pool" cx="0" cy="0" r="${r * 0.84}" />` +
    `<g class="whirl-spin">` +
      `<path class="whirl-arc" d="M 0 ${-r * 0.62} A ${r * 0.62} ${r * 0.62} 0 1 1 ${-r * 0.62} 0" />` +
      `<path class="whirl-arc two" d="M 0 ${r * 0.34} A ${r * 0.34} ${r * 0.34} 0 1 1 ${r * 0.34} 0" />` +
    `</g>` +
    `<circle class="sink-ring" cx="0" cy="0" r="${r * 0.14}" />` +
  `</g>`;
}

// A wall plank for an edge segment. kind 'rock' = immovable barnacled stone (cool,
// chunky, dotted barnacles); kind 'wood' = your fresh driftwood (warm, wood-grain,
// pops on placement). Distinct HUE + SHAPE so the two never read alike.
function wallPlank(seg, kind) {
  if (!seg) return '';
  const vertical = seg.x1 === seg.x2;
  const inset = 8, hw = kind === 'rock' ? 11 : 10;
  let x, y, w, h;
  if (vertical) { x = seg.x1 - hw; y = Math.min(seg.y1, seg.y2) + inset; w = hw * 2; h = Math.abs(seg.y2 - seg.y1) - inset * 2; }
  else { x = Math.min(seg.x1, seg.x2) + inset; y = seg.y1 - hw; w = Math.abs(seg.x2 - seg.x1) - inset * 2; h = hw * 2; }
  const mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
  let extra = '';
  if (kind === 'rock') {
    const ox = vertical ? 0 : w * 0.24, oy = vertical ? h * 0.24 : 0;
    extra = `<circle class="barnacle" cx="${mx - ox}" cy="${my - oy}" r="3.6" />` +
            `<circle class="barnacle" cx="${mx + ox}" cy="${my + oy}" r="2.6" />`;
  } else {
    extra = vertical
      ? `<line class="grain" x1="${seg.x1}" y1="${y + 5}" x2="${seg.x1}" y2="${y + h - 5}" />`
      : `<line class="grain" x1="${x + 5}" y1="${seg.y1}" x2="${x + w - 5}" y2="${seg.y1}" />`;
  }
  const cls = kind === 'rock' ? 'plank rock' : 'plank wood pop';
  return `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" />${extra}</g>`;
}

// A tern CHICK (a creature, not an arrow): plump body, cream belly, folded wing,
// a big eye, and a triangular BEAK that points the heading (beak = facing). Drawn
// facing UP (north) and rotated to its heading; aria states the direction in words.
function renderMover(u, cx, cy, CELL) {
  const rot = [0, 90, 180, 270][u.facing] || 0;
  const x = cx(u.x), y = cy(u.y), s = CELL * 0.40;
  const dir = ['north', 'east', 'south', 'west'][u.facing];
  const idx = Number(String(u.id || 'm0').replace(/\D/g, '')) || 0;
  // each chick gets its OWN colour (c0…c5); odd ones wear a little head crest, so
  // the flock reads as individuals, not clones. (Mechanically identical — pure feel.)
  const kindCls = u.kind === 'hunter' ? ' hunter' : ` c${idx % 6}`;
  const crest = (u.kind !== 'hunter' && idx % 2)
    ? `<path class="bird-crest" d="M ${-s * 0.05} ${-s * 0.56} q ${-s * 0.04} ${-s * 0.20} ${s * 0.05} ${-s * 0.26} q ${s * 0.09} ${s * 0.06} ${s * 0.05} ${s * 0.26} Z" />`
    : '';
  return `<g class="unit${kindCls}" data-uid="${u.id}" transform="translate(${x} ${y}) rotate(${rot})" ` +
    `role="img" aria-label="Tern chick facing ${dir}">` +
    `<g class="bird-bob">` +
      `<ellipse class="bird-shadow" cx="0" cy="${s * 0.64}" rx="${s * 0.50}" ry="${s * 0.13}" />` +
      `<line class="foot" x1="${-s * 0.16}" y1="${s * 0.46}" x2="${-s * 0.16}" y2="${s * 0.64}" />` +
      `<line class="foot" x1="${s * 0.16}" y1="${s * 0.46}" x2="${s * 0.16}" y2="${s * 0.64}" />` +
      `<path class="beak" d="M 0 ${-s * 0.74} L ${-s * 0.14} ${-s * 0.46} L ${s * 0.14} ${-s * 0.46} Z" />` +
      crest +
      `<ellipse class="mover-glyph" cx="0" cy="0" rx="${s * 0.50}" ry="${s * 0.56}" />` +
      `<ellipse class="bird-belly" cx="0" cy="${s * 0.14}" rx="${s * 0.30}" ry="${s * 0.40}" />` +
      `<path class="bird-wing" d="M ${-s * 0.36} ${-s * 0.06} q ${-s * 0.16} ${s * 0.30} ${s * 0.10} ${s * 0.44} q ${s * 0.04} ${-s * 0.30} ${-s * 0.10} ${-s * 0.44} Z" />` +
      `<circle class="eye" cx="${s * 0.17}" cy="${-s * 0.20}" r="${s * 0.10}" />` +
      `<circle class="eye-spark" cx="${s * 0.20}" cy="${-s * 0.23}" r="${s * 0.035}" />` +
    `</g>` +
  `</g>`;
}

// Compute the SVG segment for an edge key "x0,y0|x1,y1" in a CELL grid.
function edgeSegment(ek, CELL) {
  const ends = edgeEndpoints(ek);
  if (!ends) return null;
  const { a, b } = ends;
  // the wall sits on the shared border between the two cells.
  if (a.y === b.y) {
    // horizontal neighbours → vertical wall between them
    const xx = Math.max(a.x, b.x) * CELL;
    return { x1: xx, y1: a.y * CELL, x2: xx, y2: a.y * CELL + CELL };
  }
  // vertical neighbours → horizontal wall
  const yy = Math.max(a.y, b.y) * CELL;
  return { x1: a.x * CELL, y1: yy, x2: a.x * CELL + CELL, y2: yy };
}

// ───────────────────────── play controller ─────────────────────────
// PER-CREATURE wakes under the CURRENT wall set, each tinted to its own bird so the
// player can read which trail belongs to whom. Pure presentation.
function computeGhosts(level, walls) {
  const r = simulate(level, [...walls]);
  const paths = (level.movers || []).map((m, i) => ({ id: `m${i}`, idx: i, path: [] }));
  const byId = new Map(paths.map((p) => [p.id, p]));
  if (r.frames) for (const f of r.frames) for (const u of f.units) {
    if (u.kind !== 'mover' || u.delivered) continue;
    const p = byId.get(u.id); if (p) p.path.push({ x: u.x, y: u.y });
  }
  return paths.filter((p) => p.path.length > 1);
}

// The creatures at their START positions (movers + any hunters). Used to stage a
// fresh attempt and to RESET back to the initial position after a run.
function startUnits(level) {
  const movers = (level.movers || []).map((m, i) => ({ ...m, id: `m${i}`, kind: 'mover', delivered: false }));
  const hunters = (level.hunters || []).map((m, i) => ({ ...m, id: `h${i}`, kind: 'hunter', delivered: false }));
  return [...movers, ...hunters];
}

function makePlayState(entry, ctx) {
  const level = entry.level;
  // par = the solver-proven MINIMUM groynes. The placement budget = par + 2 (so the
  // 1★/2★ tiers are reachable); par itself is the ★★★ target.
  const par = entry.par != null ? entry.par : (solveWithStats(level, { maxMoves: level.k }).par || 1);
  return {
    entry, ctx, level, par,
    cap: levelCap(par),
    walls: new Set(),
    cursor: 0,
    units: startUnits(level),
    ghostPaths: computeGhosts(level, new Set()),
    result: null,
    hintRung: 0,
    revealed: false,
    _edges: [],
  };
}

// the budget chip: groynes used / cap, plus a live ★ FORECAST — the best stars still
// achievable at this wall count (★★★ while you're at or under par, dropping as you
// over-spend). It tells the player to solve in par to keep all three stars.
function chipHTML(state) {
  const used = state.walls.size;
  const fc = starsForWalls(state.par, used);   // 3 while used<=par, then 2, then 1
  return `<span class="par-tag" aria-label="Three stars at par ${state.par} groynes">★★★ at ${state.par}</span>` +
    `<span class="wood">🪵 ${used}/${state.cap}</span>${starPips(fc, 'forecast')}`;
}

function PlayScreen(state) {
  const { level, ctx } = state;
  const goal = formatGoal(level);
  const tokens = ctx.mode === 'climb' ? economy().tokens : 0;
  const el = document.createElement('section');
  el.innerHTML = `
    <div class="statusbar">
      <div class="goal"><span class="glyph" aria-hidden="true">⟁→◎</span>
        <span>${goal} — <strong>${ctx.title}</strong></span></div>
      <span class="chip" id="budget" aria-label="Groynes used ${state.walls.size} of ${state.cap}; three stars at par ${state.par}">${chipHTML(state)}</span>
    </div>
    <div class="toolbar">
      <button class="btn" data-act="run">Run the flock ▶</button>
      <button class="btn secondary" data-act="reset" aria-label="Reset the flock to their starting positions">Reset</button>
      <button class="btn secondary" data-act="lift" ${state.walls.size ? '' : 'disabled'} aria-label="Lift all placed groynes">Lift all walls</button>
      <button class="btn ghost" data-act="hint">Hint</button>
      ${tokens > 0 ? `<button class="btn ghost" data-act="reveal" aria-label="Spend a hint token to reveal the solution">Reveal 🎟️${tokens}</button>` : ''}
      <button class="btn ghost" data-act="back">${ctx.mode === 'climb' ? 'Levels' : 'Menu'}</button>
    </div>
    <div class="board-wrap"><div class="board" id="board" style="--cols:${level.width}">${renderBoard(state)}</div></div>
    <div id="resultslot"></div>
    <div id="hintslot"></div>
    <p class="sr-only">Use arrow keys to move the groyne cursor, Enter or Space to lay or lift it. Press Enter on “Run the flock” to simulate.</p>
  `;

  // edge interaction (pointer + keyboard roving)
  const board = el.querySelector('#board');
  board.addEventListener('click', (e) => {
    const hit = e.target.closest('[data-edge-hit]');
    if (!hit) return;
    toggleEdge(state, hit.getAttribute('data-edge-hit'));
    rerenderBoard(state, el);
  });
  board.addEventListener('keydown', (e) => onBoardKey(e, state, el));

  el.querySelector('[data-act="run"]').onclick = () => runFlock(state, el);
  el.querySelector('[data-act="reset"]').onclick = () => resetRun(state, el);
  el.querySelector('[data-act="lift"]').onclick = () => liftAll(state, el);
  el.querySelector('[data-act="hint"]').onclick = () => { state.hintRung = Math.min(4, state.hintRung + 1); showHint(state, el); };
  el.querySelector('[data-act="back"]').onclick = () => go(ctx.mode === 'climb' ? '#/climb' : '#/select');
  const reveal = el.querySelector('[data-act="reveal"]');
  if (reveal) reveal.onclick = () => revealSolution(state, el);
  return el;
}

// Spend a hint token to REVEAL the full solution (endless climb only). Clears the
// board, lays the certified solution, marks the attempt revealed (caps it at ★ so
// it's for getting unstuck, not star-farming), then the player presses Run.
function revealSolution(state, root) {
  if (state.animating) return;
  if (economy().tokens <= 0) return;
  spendToken();
  state.revealed = true;
  state.walls = new Set(state.entry.solution || []);
  state.result = null;
  state.units = startUnits(state.level);
  state.ghostPaths = computeGhosts(state.level, state.walls);
  rerenderBoard(state, root);
  root.querySelector('#hintslot').innerHTML =
    `<div class="hint" role="note"><span class="rung"><strong>Revealed (🎟️ spent):</strong> the solution is laid out — press “Run the flock”. (Revealed solves earn ★ only — replay later for ★★★.)</span></div>`;
  // the Reveal button's token count is now stale; refresh the toolbar token label
  const rv = root.querySelector('[data-act="reveal"]');
  const left = economy().tokens;
  if (rv) { if (left > 0) rv.textContent = `Reveal 🎟️${left}`; else rv.remove(); }
}

// RESET — restage the flock to their starting positions (undo a run). Keeps your
// placed walls so you can re-run or tweak. Distinct from "Lift all walls".
function resetRun(state, root) {
  if (state.animating) return;
  state.units = startUnits(state.level);
  state.result = null;
  rerenderBoard(state, root);
  root.querySelector('#resultslot').innerHTML = '';
  root.querySelector('#hintslot').innerHTML = '';
}

// LIFT ALL WALLS — clear every placed groyne (and restage the flock). Distinct
// from "Reset", which keeps the walls.
function liftAll(state, root) {
  if (state.animating) return;
  state.walls.clear();
  state.units = startUnits(state.level);
  state.result = null;
  state.ghostPaths = computeGhosts(state.level, state.walls);
  rerenderBoard(state, root);
  root.querySelector('#resultslot').innerHTML = '';
}

function toggleEdge(state, ek) {
  unlockAudio();
  if (state.walls.has(ek)) { state.walls.delete(ek); sfx.lift(); }
  else {
    if (state.walls.size >= state.cap) return; // budget enforced (= par + 2)
    state.walls.add(ek); sfx.place();
  }
  state.result = null;
  state.ghostPaths = computeGhosts(state.level, state.walls);
}

function onBoardKey(e, state, root) {
  const edges = state._edges;
  if (!edges.length) return;
  let handled = true;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') state.cursor = (state.cursor + 1) % edges.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') state.cursor = (state.cursor - 1 + edges.length) % edges.length;
  else if (e.key === 'Enter' || e.key === ' ') toggleEdge(state, edges[state.cursor]);
  else handled = false;
  if (handled) {
    e.preventDefault();
    rerenderBoard(state, root);
    const node = root.querySelector(`[data-idx="${state.cursor}"] .edge-hit`);
    if (node) node.focus();
  }
}

function rerenderBoard(state, root) {
  root.querySelector('#board').innerHTML = renderBoard(state);
  // budget chip (used/cap + live star forecast) + lift-button refresh
  const chip = root.querySelector('#budget');
  if (chip) chip.innerHTML = chipHTML(state);
  const lift = root.querySelector('[data-act="lift"]');
  if (lift) lift.disabled = state.walls.size === 0;
}

function rerender(state, root) {
  rerenderBoard(state, root);
  root.querySelector('#resultslot').innerHTML = '';
}

// ───────────────────────── run + result + NEXT affordance ─────────────────────────
const CELL = 100;
const cellCx = (x) => x * CELL + CELL / 2, cellCy = (y) => y * CELL + CELL / 2;
const facingDeg = (f) => [0, 90, 180, 270][f] || 0;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function runFlock(state, root) {
  if (state.animating) return;
  unlockAudio();
  sfx.run();
  const r = simulate(state.level, [...state.walls]);
  state.result = r.outcome;
  animateRun(state, root, r);
}

// Play the recorded run TICK-BY-TICK — the hero moment. Each chick eases cell→cell,
// banks into its turns, waddles as it goes, and plops into the whirlpool on delivery.
// Reduced-motion → snap to the final frame. (ART_DIRECTION.md: "if Run doesn't play
// the flock tick-by-tick, there is no game".)
function animateRun(state, root, r) {
  const frames = r.frames || [];
  const board = root.querySelector('#board');
  const node = (id) => board.querySelector(`.unit[data-uid="${id}"]`);
  const setLocked = (on) => ['run', 'reset', 'lift', 'hint'].forEach((a) => {
    const b = root.querySelector(`[data-act="${a}"]`); if (b) b.disabled = on;
  });
  // finish() is the ONLY thing that unlocks the toolbar. It must be reachable even
  // if rAF never fires (a BACKGROUNDED/occluded tab pauses rAF) or a frame throws —
  // otherwise the UI locks forever (the "buttons froze" bug). So it is idempotent and
  // also driven by a watchdog timer + a try/catch below.
  let done = false;
  let watchdog = 0;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(watchdog);
    const last = frames[frames.length - 1];
    if (last) state.units = last.units;
    state.animating = false;
    setLocked(false);
    try { (r.outcome === 'win' ? sfx.win : sfx.fail)(); } catch (e) { /* ignore */ }
    try {
      rerenderBoard(state, root); showResult(state, root, r);
      if (r.outcome === 'fail') showCollision(state, root, r);   // the artist's BONK
    } catch (e) { /* never leave it locked */ }
  };

  // seed the board at the START frame (includes any hunters), birds in their layer
  state.animating = true;
  state.units = (frames[0]?.units || []).map((u) => ({ ...u }));
  rerenderBoard(state, root);
  setLocked(true);

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || frames.length < 2) { finish(); return; }

  try {
  // Build each creature's FULL trajectory (one cell waypoint + facing per tick). We
  // then traverse the whole polyline as ONE continuous motion — the fix for the
  // box-to-box stutter: no easing stop at each cell and no pause between ticks.
  const ids = frames[0].units.map((u) => u.id);
  const traj = {};
  for (const id of ids) traj[id] = [];
  for (const f of frames) {
    const m = new Map(f.units.map((u) => [u.id, u]));
    for (const id of ids) {
      const u = m.get(id);
      if (u) traj[id].push({ x: u.x, y: u.y, facing: u.facing, delivered: u.delivered });
      else { const last = traj[id][traj[id].length - 1]; if (last) traj[id].push({ ...last }); }
    }
  }
  const N = Math.max(1, frames.length - 1);   // ticks
  const PER = 330;                            // ms per cell (was 230 — ~30% lower top speed)
  const total = Math.min(N * PER, 3700);      // CAP so even a long cycle finishes in a few s
  // smootherstep over the WHOLE journey: gentle accelerate at the start, gentle
  // decelerate at the end, CONSTANT flow through the middle (no stop-start at cells).
  const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  // WATCHDOG: setTimeout fires even when rAF is paused (backgrounded tab) — guarantees
  // the toolbar unlocks no matter what. (Generous so it never pre-empts a real animation.)
  watchdog = setTimeout(finish, total + 2500);

  for (const id of ids) { const el = node(id); if (el) el.classList.add('flying'); }
  const ang = {};
  for (const id of ids) ang[id] = facingDeg(traj[id][0].facing);
  const delivered = {};
  // Drive the clock by ACCUMULATING clamped frame deltas — NOT (now - t0). A main-
  // thread block (e.g. generating the next level) or a throttled/backgrounded tab can
  // make `now` jump forward by seconds; with the old `now - t0`, raw would leap to 1
  // and the whole run would SNAP to the result with the birds never moving (the
  // intermittent "frozen animation" bug). Clamping each delta to ~1 frame makes a
  // stall merely PAUSE the animation; it resumes smoothly when the main thread frees.
  let prev = performance.now();
  let elapsed = 0;
  let lastTick = 0;

  const frame = (now) => {
    try {
      const dt = Math.min(Math.max(0, now - prev), 64);   // clamp: a stall can't skip the run
      prev = now;
      elapsed += dt;
      const raw = Math.min(1, elapsed / total);
      const p = smoother(raw) * N;              // continuous position along the path, in tick units
      const seg = Math.min(N - 1, Math.floor(p));
      const fr = p - seg;                        // 0..1 within the current cell-segment
      const cruise = Math.sin(Math.min(1, raw) * Math.PI);  // 0 at ends → 1 mid (overall speed)
      // SOUND: a chirp when the flock banks off a wall (a tick where a bird's heading changed)
      const tick = Math.floor(p);
      if (tick > lastTick) {
        let turned = false;
        for (const id of ids) { const wp = traj[id]; if (wp[tick] && wp[tick - 1] && !wp[tick - 1].delivered && wp[tick].facing !== wp[tick - 1].facing) { turned = true; break; } }
        if (turned) sfx.turn();
        lastTick = tick;
      }
      for (const id of ids) {
        const wp = traj[id]; const el = node(id); if (!el) continue;
        const a = wp[seg], b = wp[seg + 1] || a;
        const moving = (a.x !== b.x || a.y !== b.y) ? 1 : 0;
        const X = cellCx(a.x) + (cellCx(b.x) - cellCx(a.x)) * fr;
        const Y = cellCy(a.y) + (cellCy(b.y) - cellCy(a.y)) * fr;
        // bank: integrate the angle smoothly toward the segment heading (no snapping)
        const tgt = facingDeg(moving ? b.facing : a.facing);
        const d = ((tgt - ang[id] + 540) % 360) - 180;
        ang[id] += d * 0.22;
        const turning = Math.min(1, Math.abs(d) / 55);
        const bank = -Math.sign(d) * turning * 12;
        // SQUASH & STRETCH (Disney): stretch along travel while cruising, squash on turns.
        const sy = 1 + 0.13 * cruise * moving - 0.22 * turning;
        const sx = 1 / sy;                                   // volume-preserving
        const bob = Math.sin(now / 130) * 2.2 * cruise * moving;  // secondary waddle
        el.setAttribute('transform', `translate(${X} ${Y + bob}) rotate(${ang[id] + bank})`);
        const inner = el.querySelector('.bird-bob');
        if (inner) inner.style.transform = `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
        if (b.delivered && fr > 0.5 && !delivered[id]) { delivered[id] = 1; plop(el); sfx.deliver(); }
      }
      if (raw < 1) requestAnimationFrame(frame); else finish();
    } catch (e) { finish(); }   // a frame must NEVER kill the loop and freeze the birds
  };
  prev = performance.now();
  requestAnimationFrame(frame);
  } catch (e) {
    finish();   // any setup/throw still unlocks the toolbar
  }
}

// ───────────────────────── collision: an ARTIST's bonk, not an engineer's flag ─────────────────────────
// Where the crash happened: the two undelivered chicks closest together (they collided/
// swapped), else the lone boxed-in chick. Returns cell coords (fractional midpoint).
function collisionPoint(frames) {
  const last = frames[frames.length - 1];
  const live = (last && last.units || []).filter((u) => !u.delivered);
  if (!live.length) return null;
  if (live.length >= 2) {
    let best = null;
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const d = Math.abs(live[i].x - live[j].x) + Math.abs(live[i].y - live[j].y);
      if (!best || d < best.d) best = { d, a: live[i], b: live[j] };
    }
    if (best && best.d <= 2) return { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2, ids: [best.a.id, best.b.id] };
  }
  return { x: live[0].x, y: live[0].y, ids: [live[0].id] };
}

// A cartoon impact: a comic POW starburst (stays as the collision SIGN), a splash ring,
// feathers puffing out, and dizzy stars orbiting. All CSS-animated; the star persists so
// it reads even under reduced-motion.
function collisionBurst(cx, cy, CELL) {
  const r = CELL * 0.52;          // overall burst size (splash / feathers / dizzy)
  const sr = r * 0.7;             // the POW star is 30% smaller than before (it grows to THIS max)
  const pts = 11; let star = '';
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = (i % 2 ? 0.40 : 0.92) * sr;
    star += (i ? 'L' : 'M') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (cy + Math.sin(a) * rad).toFixed(1) + ' ';
  }
  star += 'Z';
  let feathers = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const fx = (cx + Math.cos(a) * r * 0.5).toFixed(1), fy = (cy + Math.sin(a) * r * 0.5).toFixed(1);
    feathers += `<g transform="translate(${fx} ${fy}) rotate(${(a * 180 / Math.PI).toFixed(0)})">` +
      `<g class="impact-feather" style="animation-delay:${i * 25}ms"><path class="feather-shape" d="M0 -7 Q6 0 0 7 Q-6 0 0 -7 Z"/></g></g>`;
  }
  const dzStar = 'M0 -5 L1.5 -1.5 L5 -1.5 L2 1 L3 5 L0 2.5 L-3 5 L-2 1 L-5 -1.5 L-1.5 -1.5 Z';
  const dizzy = `<g class="impact-dizzy" transform="translate(${cx.toFixed(1)} ${(cy - r * 0.78).toFixed(1)})">` +
    `<g class="dz-orbit"><path class="dz" d="${dzStar}" transform="translate(13 0)"/></g>` +
    `<g class="dz-orbit d1"><path class="dz" d="${dzStar}" transform="translate(13 0) scale(.8)"/></g>` +
  `</g>`;
  return `<g class="impact" aria-hidden="true">` +
    `<circle class="impact-splash" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 0.7).toFixed(1)}" />` +
    `<path class="impact-star" d="${star}" />` + feathers + dizzy +
  `</g>`;
}

function showCollision(state, root, r) {
  const svg = root.querySelector('#board svg'); if (!svg) return;
  const pt = collisionPoint(r.frames || []); if (!pt) return;
  const cx = pt.x * CELL + CELL / 2, cy = pt.y * CELL + CELL / 2;
  svg.insertAdjacentHTML('beforeend', collisionBurst(cx, cy, CELL));
  const board = root.querySelector('.board');
  if (board) { board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake'); } // re-trigger
  for (const id of pt.ids) { const el = svg.querySelector(`.unit[data-uid="${id}"]`); if (el) el.classList.add('stunned'); }
}

// Delivery: an anticipation crouch → stretch → spin down into the whirlpool (bouncy,
// Disney). Clears the run's inline squash + the `flying` lock so the CSS plop wins.
function plop(el) {
  if (!el) return;
  el.classList.remove('flying');
  const inner = el.querySelector('.bird-bob');
  if (inner) { inner.style.transform = ''; inner.classList.add('plopping'); }
  el.style.transition = 'opacity var(--dur-slow) var(--ease-out)';
  requestAnimationFrame(() => { el.style.opacity = '0'; });
}

function showResult(state, root, r) {
  const slot = root.querySelector('#resultslot');
  const win = r.outcome === 'win';
  const reasons = { win: 'The whole flock reached the drain.', fail: 'A tern was boxed in or collided.', cycle: 'The flock looped without finishing.', stuck: 'The flock never resolved.' };
  // record FIRST so the banner can show the stars earned.
  if (win) recordWin(state);
  const stars = state.earnedStars || 0;
  const used = state.walls.size, par = state.par;
  const tease = stars === 3 ? 'Perfect — solved in par!'
    : `Solved in ${used} (par ${par}). ${state.revealed ? 'Revealed solves earn ★ — replay for more.' : `Use ${par} groyne${par === 1 ? '' : 's'} for ★★★.`}`;
  const next = nextAffordanceHTML(state);
  slot.innerHTML = `
    <div class="result ${win ? 'win' : 'fail'} next-in" role="status">
      <div class="verdict"><span class="badge" aria-hidden="true">${win ? '✓' : '↻'}</span>
        <span>${win ? 'Delivered!' : 'Not yet'} — ${win ? tease : (reasons[r.outcome] || '')}</span></div>
      ${win ? `<div class="star-award">${starPips(stars, 'big')}</div>` : ''}
      <div class="actions">
        ${win ? next : `<button class="btn secondary" data-act="retry">Try again</button>`}
      </div>
    </div>`;
  if (win) {
    wireNext(state, slot);
  } else {
    slot.querySelector('[data-act="retry"]').onclick = () => {
      state.result = null; state.units = startUnits(state.level);
      rerenderBoard(state, root); slot.innerHTML = '';
    };
  }
}

// Build the forward-path affordance for THIS mode (no dead-ends).
function nextAffordanceHTML(state) {
  const { ctx } = state;
  if (ctx.mode === 'daily') {
    return `<button class="btn" data-act="climb">Keep climbing →</button>
            <button class="btn secondary" data-act="back">Done for today</button>`;
  }
  // climb: clearing EXACTLY the last CURATED level opens the endless climb (a one-time
  // milestone, not a dead-end); otherwise just advance to the next rung.
  if (ctx.mode === 'climb' && ctx.index === ctx.pack.levels.length - 1) {
    return `<button class="btn" data-act="next">Enter the endless climb →</button>
            <button class="btn secondary" data-act="endcap">See progress</button>`;
  }
  return `<button class="btn" data-act="next">Next level →</button>
          <button class="btn secondary" data-act="back">Levels</button>`;
}

function wireNext(state, slot) {
  const { ctx } = state;
  const q = (a) => slot.querySelector(`[data-act="${a}"]`);
  if (q('back')) q('back').onclick = () => go(ctx.mode === 'climb' ? '#/climb' : '#/select');
  if (q('climb')) q('climb').onclick = () => go('#/climb');
  if (q('endcap')) q('endcap').onclick = () => go('#/endcap');
  if (q('next')) q('next').onclick = () => go(`#/climb/${ctx.index + 1}`);   // next rung (unbounded — endless)
}

// ───────────────────────── hint ladder (solver-driven, eureka-safe) ─────────────────────────
function showHint(state, root) {
  const slot = root.querySelector('#hintslot');
  const rung = hintLadder(state.level, [...state.walls], state.hintRung, { simulate, solveWithStats });
  slot.innerHTML = `<div class="hint" role="note"><span class="rung"><strong>Hint ${state.hintRung}/4 — ${rung.title}:</strong> ${rung.text}</span></div>`;
}

// ───────────────────────── progress: ladder + STARS + tokens ─────────────────────────
// climb = { reached: highest UNLOCKED ladder index (UNBOUNDED), stars: {idx: 1-3} }.
// A level is "solved" iff it has a star entry. High score = reached+1.
function getClimb() {
  const c = LS.get('climb', { reached: 0, stars: {} });
  return { reached: Math.max(0, c.reached | 0), stars: c.stars || {} };
}
function setClimb(c) { LS.set('climb', { reached: c.reached, stars: c.stars }); }
function climbSolvedSet(c) { return new Set(Object.keys(c.stars || {}).map(Number)); }

// daily = { stars: {dateKey: 1-3} } — its OWN star currency (not counted toward endless).
function getDaily() { const d = LS.get('daily', { stars: {} }); return { stars: d.stars || {} }; }
function setDaily(d) { LS.set('daily', { stars: d.stars }); }

function getTokensSpent() { return LS.get('tokensSpent', 0) | 0; }
function spendToken() { LS.set('tokensSpent', getTokensSpent() + 1); }

// a snapshot of the whole star economy (used by every menu/screen).
function economy() {
  const c = getClimb(), d = getDaily();
  const climbStars = sumStars(c.stars);
  const dailyStars = sumStars(d.stars);
  return {
    reached: c.reached,
    climbStars, climbPotential: climbStarPotential(c.reached),
    dailyStars, dailyOpen: dailyUnlocked(climbStars),
    tokens: hintTokensAvailable(dailyStars, getTokensSpent()),
  };
}

// 3 star pips, n filled — the colour-independent star display (glyph, not hue alone).
function starPips(n, cls = '') {
  let s = '';
  for (let i = 1; i <= 3; i++) s += `<span class="pip ${i <= n ? 'on' : ''}" aria-hidden="true">★</span>`;
  return `<span class="stars ${cls}" role="img" aria-label="${n} of 3 stars">${s}</span>`;
}

// Resolve a ladder index → a level entry: the curated pack first, then the ENDLESS
// generator (deterministic, solver-verified, cached). The ladder is infinite.
function getEntry(pack, idx) {
  const n = pack.levels.length;
  return idx < n ? pack.levels[idx] : endlessLevel(idx - n);
}
function isEndlessIdx(pack, idx) { return idx >= pack.levels.length; }
// Warm the cache for an endless level in the background so advancing feels instant.
// Use requestIdleCallback so the (CPU-sync) generation runs when the main thread is
// IDLE — it must not compete with a running animation (which would stall it).
function precompute(pack, idx) {
  if (!isEndlessIdx(pack, idx)) return;
  const gen = () => { try { getEntry(pack, idx); } catch (e) { /* ignore */ } };
  if (window.requestIdleCallback) window.requestIdleCallback(gen, { timeout: 2000 });
  else setTimeout(gen, 400);
}

// ───────────────────────── win record (STARS + streak) ─────────────────────────
// Stars reward efficiency: par walls → ★★★, par+1 → ★★, par+2 → ★. A token-revealed
// solve is capped at ★ (progress, not star-farming). Stores the BEST stars per level.
function recordWin(state) {
  const { ctx } = state;
  let stars = starsForWalls(state.par, state.walls.size);
  if (state.revealed) stars = Math.min(stars, 1);
  state.earnedStars = stars;
  if (ctx.mode === 'climb') {
    const c = getClimb();
    c.stars[ctx.index] = Math.max(c.stars[ctx.index] | 0, stars);
    c.reached = advanceReached(c.reached, ctx.index);   // clearing the frontier unlocks the next (unbounded)
    setClimb(c);
  } else if (ctx.mode === 'daily') {
    const d = getDaily();
    d.stars[ctx.dateKey] = Math.max(d.stars[ctx.dateKey] | 0, stars);
    setDaily(d);
    const rec = LS.get('streak', { current: 0, best: 0, lastDay: null });
    LS.set('streak', applyStreak(rec, ctx.dateKey));
  }
}

// ───────────────────────── select / daily / endless / endcap screens ─────────────────────────
function SelectScreen(pack) {
  const el = document.createElement('section');
  const n = pack.levels.length;
  const eco = economy();
  const best = eco.reached + 1;                     // furthest level number reached (UNBOUNDED)
  const beyond = eco.reached >= n;
  const climbLine = `Best: <strong>Level ${best}</strong>${beyond ? ' 🏔️' : `/${n}`} · Stars <strong>${eco.climbStars}/${eco.climbPotential}</strong> ${starPips(3, 'mini')}`;
  const dailyCard = eco.dailyOpen
    ? `<button class="card wide" data-go="#/daily">
        <span class="ico" aria-hidden="true">📅</span>
        <h3>Daily challenge</h3>
        <p>A brutally hard puzzle, fresh each day. Daily stars <strong>${eco.dailyStars}</strong> · 🎟️ <strong>${eco.tokens}</strong> hint token${eco.tokens === 1 ? '' : 's'}. Every ${STARS_PER_TOKEN} daily stars → 1 token.</p>
      </button>`
    : `<div class="card wide locked-card" aria-disabled="true">
        <span class="ico" aria-hidden="true">🔒</span>
        <h3>Daily challenge — locked</h3>
        <p>Collect <strong>${DAILY_UNLOCK_STARS} climb stars</strong> to unlock the daily challenge. You have <strong>${eco.climbStars}</strong>.</p>
      </div>`;
  el.innerHTML = `
    <h2>Choose your tide</h2>
    <div class="cards">
      <button class="card wide" data-go="#/climb">
        <span class="ico" aria-hidden="true">${beyond ? '🏔️' : '🧗'}</span>
        <h3>Climb</h3>
        <p>${climbLine}</p>
      </button>
      ${dailyCard}
    </div>
    <div class="legend">
      <h3>How Baffle works</h3>
      <ul>
        <li>You can’t steer a <span class="key">tern</span> (⟁). You only lay <span class="key">driftwood groynes</span> (🪵) on the grid edges — up to your budget.</li>
        <li>Each tick a tern flies ahead; if a groyne blocks it, it turns <span class="key">right first, then left, then back</span>. That fixed rule picks the exit — you only deny the wrong ones.</li>
        <li>Goal: bank <span class="key">every tern</span> into the <span class="key">drain</span> (◎). The faint trail shows where they go now, before you place.</li>
      </ul>
    </div>`;
  el.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.getAttribute('data-go')));
  return el;
}

// CLIMB — the persistent ladder. A high-score header + a level-select grid: solved
// (✓) and current levels are tappable (jump anywhere you've reached); levels past
// your furthest are locked (🔒). "Continue" jumps to the stage you got stuck on.
function ClimbScreen(pack) {
  const el = document.createElement('section');
  const n = pack.levels.length;
  const c = getClimb();
  const solvedSet = climbSolvedSet(c);
  const eco = economy();
  const best = c.reached + 1;
  const frontier = climbFrontier(c.reached, [...solvedSet]);
  const tierName = (t) => ({ T0: 'Learn the rule', T1: 'Shared groyne', T2: 'Dead-end', T3: 'The catch', endless: 'Endless' }[t] || t || 'Endless');
  const labelFor = (i) => (i < n ? tierName(pack.levels[i].tier) : 'Endless');

  // The ladder is INFINITE — show a window: the first reached levels up to a cap, and
  // (if the player has climbed far) the recent stretch around the frontier. Bounded DOM.
  const WIN = 24;
  const top = c.reached;                                  // highest unlocked index
  const start = top > WIN ? top - (WIN - 1) : 0;          // window start
  const idxs = [];
  for (let i = 0; i <= top; i++) if (i < 6 || i >= start) idxs.push(i);  // first 6 + recent window

  let lastShown = -1;
  const chips = idxs.map((i) => {
    const gap = i > lastShown + 1; lastShown = i;
    const solved = solvedSet.has(i);
    const stars = c.stars[i] | 0;
    const isFrontier = i === frontier && !solved;
    const stateCls = solved ? 'solved' : isFrontier ? 'current' : 'open';
    const mark = solved ? (i + 1) : isFrontier ? '▶' : (i + 1);
    const lbl = `Level ${i + 1} — ${labelFor(i)}${solved ? ` (solved, ${stars} of 3 stars)` : isFrontier ? ' (continue here)' : ''}`;
    return (gap ? '<div class="climb-gap" aria-hidden="true">⋯</div>' : '') +
      `<button class="climb-chip ${stateCls}" data-climb="${i}" aria-label="${lbl}">` +
      `<span class="ix" aria-hidden="true">${mark}</span><span class="ct">${labelFor(i)}</span>` +
      `${solved ? starPips(stars, 'chip') : '<span class="ct dim">' + (isFrontier ? 'play ▶' : 'reached') + '</span>'}</button>`;
  }).join('');

  el.innerHTML = `
    <div class="climb-head">
      <button class="btn ghost" data-go="#/select" aria-label="Home">‹ Home</button>
      <div class="hiscore" role="status">Level <strong>${best}</strong>${c.reached >= n ? ' 🏔️' : `/${n}`} · ⭐ ${eco.climbStars}/${eco.climbPotential}</div>
    </div>
    <h2>Climb the ladder</h2>
    <p class="climb-sub">Clear the highlighted level to unlock the next — the climb is <strong>endless</strong>. Solve in <strong>par</strong> for ★★★. Tap any reached level to replay for more stars.</p>
    <button class="btn climb-continue" data-climb="${frontier}">Continue → Level ${frontier + 1}</button>
    <div class="climb-grid" role="list">${chips}</div>`;
  el.querySelector('[data-go]')?.addEventListener('click', () => go('#/select'));
  el.querySelectorAll('[data-climb]').forEach((b) => b.onclick = () => go(`#/climb/${b.getAttribute('data-climb')}`));
  // warm the next endless level while the player browses
  precompute(pack, frontier + 1);
  return el;
}

function EndcapScreen(pack) {
  const el = document.createElement('section');
  el.innerHTML = `
    <div class="endcap">
      <p class="big">🏆 Mastered</p>
      <p>You banked every flock in all ${pack.levels.length} levels — top of the climb. Replay any level, or come back for the daily drift.</p>
      <div class="toolbar" style="justify-content:center">
        <button class="btn" data-go="#/climb">Replay levels →</button>
        <button class="btn secondary" data-go="#/select">Home</button>
      </div>
    </div>`;
  el.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.getAttribute('data-go')));
  return el;
}

function TomorrowScreen() {
  const el = document.createElement('section');
  el.innerHTML = `
    <div class="endcap">
      <p class="big">✓ Today’s drift solved</p>
      <p>Come back tomorrow for a fresh daily puzzle. In the meantime:</p>
      <div class="toolbar" style="justify-content:center">
        <button class="btn" data-go="#/climb">Keep climbing →</button>
        <button class="btn secondary" data-go="#/select">Home</button>
      </div>
    </div>`;
  el.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.getAttribute('data-go')));
  return el;
}

// A brief loading beat while a level is generated + solver-verified.
function LoadingScreen(label) {
  const el = document.createElement('section');
  el.innerHTML = `
    <div class="endcap">
      <p class="big" aria-hidden="true">🌊</p>
      <p role="status">Charting new waters — building &amp; solving <strong>${label}</strong>…</p>
      <div class="loading-bar" aria-hidden="true"><span></span></div>
    </div>`;
  return el;
}

// ───────────────────────── router (flat, hash) ─────────────────────────
function go(hash) { location.hash = hash; }

async function route() {
  const pack = await loadPack();
  const main = document.getElementById('main');
  const hash = location.hash || '#/select';
  const parts = hash.replace(/^#\//, '').split('/');
  main.innerHTML = '';
  let view;

  const n = pack.levels.length;
  if (parts[0] === 'select' || parts[0] === '') {
    view = SelectScreen(pack);
  } else if (parts[0] === 'climb' && parts[1] == null) {
    view = ClimbScreen(pack);
  } else if (parts[0] === 'climb') {
    // play a ladder level — unbounded (endless), only if UNLOCKED (else → the grid)
    const idx = Math.max(0, parseInt(parts[1], 10) || 0);
    const c = getClimb();
    if (!climbUnlocked(c.reached, idx)) { go('#/climb'); return; }
    const tiers = { T0: 'Learn the rule', T1: 'Shared groyne', T2: 'Dead-end', T3: 'The catch' };
    if (isEndlessIdx(pack, idx)) {
      // endless levels are GENERATED (CPU-sync, sometimes ~1s). Paint a loading beat
      // first, then generate + mount on the next tick, so it's never a frozen blank.
      main.appendChild(LoadingScreen('Level ' + (idx + 1)));
      setTimeout(() => {
        if (location.hash !== hash) return;            // user navigated away meanwhile
        const entry = getEntry(pack, idx);
        const ctx = { mode: 'climb', title: `Level ${idx + 1} · Endless`, pack, index: idx, id: entry.id };
        main.innerHTML = '';
        main.appendChild(PlayScreen(makePlayState(entry, ctx)));
        main.focus();
        precompute(pack, idx + 1);
      }, 30);
      return;
    }
    const entry = pack.levels[idx];
    const ctx = { mode: 'climb', title: `Level ${idx + 1}/${n} · ${tiers[entry.tier] || entry.tier}`, pack, index: idx, id: entry.id };
    view = PlayScreen(makePlayState(entry, ctx));
    precompute(pack, idx + 1);
  } else if (parts[0] === 'curriculum' || parts[0] === 'endless') {
    go('#/climb'); return;   // back-compat: the old modes are now the Climb ladder
  } else if (parts[0] === 'daily') {
    if (!economy().dailyOpen) { go('#/select'); return; }   // locked until 30 climb stars
    // a HARD, date-seeded generated puzzle (CPU-sync ~1s) → loading beat, then mount.
    const dateKey = todayUTC();
    main.appendChild(LoadingScreen("today's daily challenge"));
    setTimeout(() => {
      if (location.hash !== hash) return;
      const entry = dailyLevel(dateKey);
      const ctx = { mode: 'daily', title: `Daily · ${dateKey}`, dateKey, pack, index: -1, id: entry.id };
      main.innerHTML = '';
      main.appendChild(PlayScreen(makePlayState(entry, ctx)));
      main.focus();
    }, 30);
    return;
  } else if (parts[0] === 'play') {
    // direct level link (e.g. shared URLs) — play it, but as a climb-tracked level
    const id = parts[1];
    const idx = Math.max(0, pack.levels.findIndex((l) => l.id === id));
    const entry = pack.levels[idx] || pack.levels[0];
    const tierName = { T0: 'Learn the rule', T1: 'Shared groyne', T2: 'Dead-end', T3: 'The catch' }[entry.tier] || entry.tier;
    const ctx = { mode: 'climb', title: `Level ${idx + 1}/${n} · ${tierName}`, pack, index: idx, id: entry.id };
    view = PlayScreen(makePlayState(entry, ctx));
  } else if (parts[0] === 'endcap') {
    view = EndcapScreen(pack);
  } else {
    view = SelectScreen(pack);
  }

  main.appendChild(view);
  main.focus();
}

// ───────────────────────── sound mute toggle (persistent, in the header) ─────────────────────────
let muteWired = false;
function initMute() {
  if (muteWired) return;               // boot runs this from two paths — wire the click ONCE
  const btn = document.getElementById('mute');
  if (!btn) return;
  muteWired = true;
  const apply = (m) => {
    setMuted(m);
    btn.textContent = m ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', String(m));
    btn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
  };
  apply(LS.get('muted', false));
  btn.addEventListener('click', () => {
    const m = !isMuted();
    LS.set('muted', m);
    apply(m);
    if (!m) { unlockAudio(); sfx.lift(); }   // a tiny blip confirms sound is back on
  });
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => { initMute(); route(); });
if (document.readyState !== 'loading') { initMute(); route(); }
