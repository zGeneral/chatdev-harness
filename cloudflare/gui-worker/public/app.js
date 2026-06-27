'use strict';
const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
let TOKEN = localStorage.getItem('gui_token') || '';

async function api(path, body) {
  const r = await fetch('/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { gate(true); throw new Error('unauthorized'); }
  return r.json();
}

// ---------- token gate ----------
function gate(show) { $('#gate').style.display = show ? 'flex' : 'none'; }
$('#token-go').onclick = async () => {
  TOKEN = $('#token-input').value.trim();
  try {
    const r = await fetch('/api/lessons/list', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ namespace: 'lessons:gamedev' }) });
    if (r.status === 401) { $('#gate-err').textContent = 'Wrong token.'; return; }
    localStorage.setItem('gui_token', TOKEN); gate(false); loadLessons();
  } catch (e) { $('#gate-err').textContent = String(e.message || e); }
};
$('#logout').onclick = () => { localStorage.removeItem('gui_token'); TOKEN = ''; gate(true); };

// ---------- tabs ----------
document.querySelectorAll('header nav button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('header nav button').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('main .tab').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); $('#' + b.dataset.tab).classList.add('active');
    if (b.dataset.tab === 'notebooks') loadNotebooks();
    if (b.dataset.tab === 'graphs') loadGraphList();
    if (b.dataset.tab === 'runs') loadRuns();
  };
});

// ---------- LESSONS ----------
function lessonCard(item, ns) {
  const card = el('div', 'card');
  const ta = el('textarea'); ta.value = item.text || ''; ta.rows = 3;
  const meta = el('div', 'meta', (item.id || '').slice(0, 8) + (item.created ? ' · ' + item.created.slice(0, 10) : ''));
  const bar = el('div', 'cardbar');
  const save = el('button', 'primary', 'Save'); save.onclick = async () => {
    save.disabled = true; await api('/lessons/save', { namespace: ns, id: item.id, text: ta.value.trim() }); save.disabled = false; save.textContent = 'Saved ✓'; setTimeout(() => (save.textContent = 'Save'), 1200);
  };
  const del = el('button', 'danger', 'Delete'); del.onclick = async () => {
    if (!confirm('Delete this lesson?')) return; await api('/lessons/delete', { namespace: ns, ids: [item.id] }); card.remove();
  };
  bar.append(save, del); card.append(ta, meta, bar); return card;
}
async function loadLessons() {
  const ns = $('#ns').value.trim(); const out = $('#lessons-list'); out.innerHTML = 'loading…';
  const d = await api('/lessons/list', { namespace: ns }); out.innerHTML = '';
  const items = (d.items || []);
  if (!items.length) { out.append(el('p', 'hint', 'No entries in ' + ns + '.')); return; }
  items.forEach((i) => out.append(lessonCard(i, ns)));
}
$('#ns-refresh').onclick = loadLessons;
$('#ns-search').onclick = async () => {
  const ns = $('#ns').value.trim(); const q = $('#ns-q').value.trim(); if (!q) return loadLessons();
  const out = $('#lessons-list'); out.innerHTML = 'searching…';
  const d = await api('/lessons/search', { namespace: ns, query: q, top_k: 10 }); out.innerHTML = '';
  (d.matches || []).forEach((m) => out.append(lessonCard({ id: m.id, text: m.text }, ns)));
  if (!(d.matches || []).length) out.append(el('p', 'hint', 'No matches.'));
};
$('#lesson-add').onclick = async () => {
  const ns = $('#ns').value.trim(); const text = prompt('New lesson (one atomic, reusable sentence):'); if (!text) return;
  await api('/lessons/save', { namespace: ns, text: text.trim(), metadata: { source: 'console' } }); loadLessons();
};

// ---------- NOTEBOOKS ----------
async function loadNotebooks() {
  const sel = $('#nb-select'); const d = await api('/rag/notebooks');
  sel.innerHTML = ''; (d.notebooks || []).forEach((n) => { const o = el('option'); o.value = n.slug; o.textContent = `${n.slug} (${n.doc_count ?? '?'} docs)`; sel.append(o); });
  if (!(d.notebooks || []).length) sel.append(el('option', null, 'no notebooks / unavailable'));
}
$('#nb-refresh').onclick = loadNotebooks;
$('#nb-search').onclick = async () => {
  const notebook = $('#nb-select').value; const q = $('#nb-q').value.trim(); const out = $('#nb-out');
  if (!q) return; out.innerHTML = 'searching…';
  const d = await api('/rag/search', { notebook, query: q, top_k: 10 }); out.innerHTML = '';
  const ms = d.matches || [];
  if (!ms.length) { out.append(el('p', 'hint', 'No matches.')); return; }
  ms.forEach((m) => {
    const c = el('div', 'card');
    c.append(el('div', 'meta', 'score ' + (m.score ? m.score.toFixed(3) : '?')));
    c.append(el('div', null, (m.text_preview || m.text || '').slice(0, 600)));
    out.append(c);
  });
};

// ---------- GRAPHS ----------
async function loadGraphList() {
  const sel = $('#g-select'); const d = await api('/graphs/list');
  sel.innerHTML = ''; (d.files || []).forEach((f) => { const o = el('option'); o.value = f; o.textContent = f; sel.append(o); });
  if ((d.files || []).length) loadGraph();
}
$('#g-refresh').onclick = loadGraphList;
$('#g-select').onchange = loadGraph;
async function loadGraph() {
  const name = $('#g-select').value; if (!name) return;
  const d = await api('/graphs/get', { name });
  $('#g-yaml').value = d.yaml || ''; $('#g-err').textContent = d.parse_error || '';
  if (d.graph) renderGraph(d.graph);
}
$('#g-render').onclick = async () => {
  const d = await api('/graphs/parse', { yaml: $('#g-yaml').value });
  $('#g-err').textContent = d.error || ''; if (d.graph) renderGraph(d.graph); else $('#g-diagram').innerHTML = '';
};
$('#g-copy').onclick = () => navigator.clipboard.writeText($('#g-yaml').value);
$('#g-download').onclick = () => {
  const a = el('a'); a.href = URL.createObjectURL(new Blob([$('#g-yaml').value], { type: 'text/yaml' }));
  a.download = ($('#g-select').value || 'graph.yaml'); a.click();
};

// dependency-free layered SVG renderer
const NODE_COLOR = { agent: '#2b6cb0', literal: '#4a5568', memory: '#2f855a', loop_counter: '#b7791f', passthrough: '#4a5568', python: '#805ad5', subgraph: '#319795' };
function renderGraph(g) {
  const nodes = (g.nodes || []).map((n) => ({ id: n.id, type: n.type }));
  const edges = (g.edges || []).map((e) => ({ from: e.from, to: e.to, cond: e.condition || '' }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const incoming = new Set(edges.map((e) => e.to));
  // depth via longest path, ignoring back-edges (cycles)
  const depth = {}; nodes.forEach((n) => (depth[n.id] = incoming.has(n.id) ? null : 0));
  for (let i = 0; i < nodes.length + 2; i++) {
    edges.forEach((e) => { if (depth[e.from] != null) { const d = depth[e.from] + 1; if (depth[e.to] == null || d > depth[e.to]) depth[e.to] = d; } });
  }
  nodes.forEach((n) => { if (depth[n.id] == null) depth[n.id] = 0; });
  const rows = {}; nodes.forEach((n) => { (rows[depth[n.id]] = rows[depth[n.id]] || []).push(n); });
  const W = 200, H = 54, GAPX = 40, GAPY = 56, PAD = 24;
  const maxRow = Math.max(1, ...Object.values(rows).map((r) => r.length));
  const width = PAD * 2 + maxRow * W + (maxRow - 1) * GAPX;
  const depths = Object.keys(rows).map(Number).sort((a, b) => a - b);
  const height = PAD * 2 + depths.length * H + (depths.length - 1) * GAPY;
  const pos = {};
  depths.forEach((d, di) => {
    const row = rows[d]; const rowW = row.length * W + (row.length - 1) * GAPX; const x0 = (width - rowW) / 2;
    row.forEach((n, i) => { pos[n.id] = { x: x0 + i * (W + GAPX), y: PAD + di * (H + GAPY) }; });
  });
  const svgns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgns, 'svg'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', '100%');
  const defs = document.createElementNS(svgns, 'defs');
  defs.innerHTML = '<marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#8aa"/></marker>';
  svg.append(defs);
  edges.forEach((e) => {
    const a = pos[e.from], b = pos[e.to]; if (!a || !b) return;
    const back = (depth[e.to] <= depth[e.from]);
    const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y;
    const path = document.createElementNS(svgns, 'path');
    if (back) { const my = (y1 + y2) / 2; path.setAttribute('d', `M${x1},${y1 - H} C ${x1 - 120},${a.y - 20} ${x2 - 120},${b.y + H + 20} ${x2},${y2 + H}`); path.setAttribute('stroke-dasharray', '4 3'); }
    else { path.setAttribute('d', `M${x1},${y1} C ${x1},${y1 + GAPY / 2} ${x2},${y2 - GAPY / 2} ${x2},${y2}`); }
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#5a7'); path.setAttribute('marker-end', 'url(#arr)'); svg.append(path);
    if (e.cond) { const t = document.createElementNS(svgns, 'text'); t.setAttribute('x', (x1 + x2) / 2 + 4); t.setAttribute('y', (y1 + y2) / 2); t.setAttribute('class', 'edge-label'); t.textContent = e.cond; svg.append(t); }
  });
  nodes.forEach((n) => {
    const pp = pos[n.id]; const grp = document.createElementNS(svgns, 'g');
    const rect = document.createElementNS(svgns, 'rect'); rect.setAttribute('x', pp.x); rect.setAttribute('y', pp.y); rect.setAttribute('width', W); rect.setAttribute('height', H); rect.setAttribute('rx', 8);
    rect.setAttribute('fill', NODE_COLOR[n.type] || '#444'); rect.setAttribute('stroke', '#0c0f17');
    const id = document.createElementNS(svgns, 'text'); id.setAttribute('x', pp.x + 10); id.setAttribute('y', pp.y + 22); id.setAttribute('class', 'node-id'); id.textContent = n.id;
    const ty = document.createElementNS(svgns, 'text'); ty.setAttribute('x', pp.x + 10); ty.setAttribute('y', pp.y + 40); ty.setAttribute('class', 'node-type'); ty.textContent = n.type;
    grp.append(rect, id, ty); svg.append(grp);
  });
  const out = $('#g-diagram'); out.innerHTML = ''; out.append(svg);
}

// ---------- RUNS ----------
async function loadRuns() {
  const out = $('#runs-out'); out.innerHTML = 'loading…';
  const d = await api('/runs/list'); const runs = d.runs || [];
  if (!runs.length) { out.innerHTML = '<p class="hint">No runs logged yet. Runs appear here once a graph logs via tools/run_log.py.</p>'; return; }
  const tbl = el('table');
  const head = el('tr'); ['', 'graph', 'steps', 'final', 'when'].forEach((h) => head.append(el('th', null, h))); tbl.append(head);
  const td = (txt, cls) => { const c = el('td', cls); c.textContent = txt; return c; }; // textContent => no XSS
  runs.forEach((r) => {
    const tr = el('tr');
    tr.append(td(r.green ? '🟢' : '🔴'), td(r.graph), td(String(r.steps)), td((r.final || '').slice(0, 160), 'final'), td((r.created || '').replace('T', ' ').slice(0, 16)));
    tbl.append(tr);
  });
  out.innerHTML = ''; out.append(tbl);
}

// ---------- boot ----------
if (!TOKEN) gate(true); else { gate(false); loadLessons(); }
