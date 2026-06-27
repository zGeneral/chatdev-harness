export const meta = {
  name: 'chatdev-graph',
  description: 'Declarative graph engine (ChatDev 2.0-shaped): execute a YAML/JSON graph of nodes (agent/python/literal/passthrough/loop_counter/subgraph) + conditional edges, via real Claude Code subagents and tools.',
  whenToUse: 'Run a declarative ChatDev-2.0-style graph: author nodes + edges, the engine executes them with real tool execution.',
  phases: [{ title: 'Graph' }],
}

// ---------------------------------------------------------------------------
// Input: args.graph is the graph definition (object or JSON string). args.input
// is the initial USER message. The Workflow sandbox has no YAML parser/fs, so a
// runner converts the authored YAML -> JSON and passes it here. Schema:
//   graph: { id, description, nodes: [{id,type,config}], edges: [{from,to,condition,carry_data}] }
// node types: literal | passthrough | agent | python | loop_counter | subgraph
// edge condition (evaluated on the source node's text output):
//   (absent)|'true'   -> always   |  'default' -> only if no sibling edge matched
//   'contains:TEXT' | '!contains:TEXT' | 'regex:PAT' | 'equals:VAL'
// ---------------------------------------------------------------------------
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
A = (A && typeof A === 'object') ? A : {}
let G = A.graph
if (typeof G === 'string') { try { G = JSON.parse(G) } catch (e) { G = null } }
const initialInput = A.input || ''
const PYBIN = A.pybin || '/Users/hassiba/git/chatdev_harness/.venv/bin/python'
const MAX_STEPS = A.maxSteps || 64
const EFFORT = A.effort || 'medium'

// ----- pure: edge condition evaluation -----
function evalCond(condition, text) {
  if (condition === undefined || condition === null || condition === true || condition === 'true' || condition === '') return true
  if (condition === 'default') return false // handled by the propagation fallback
  const s = String(condition)
  const t = String(text == null ? '' : text)
  if (s.startsWith('!contains:')) return !t.toLowerCase().includes(s.slice('!contains:'.length).toLowerCase())
  if (s.startsWith('contains:')) return t.toLowerCase().includes(s.slice('contains:'.length).toLowerCase())
  if (s.startsWith('regex:')) { try { return new RegExp(s.slice('regex:'.length)).test(t) } catch (e) { return false } }
  if (s.startsWith('equals:')) return t.trim() === s.slice('equals:'.length).trim()
  // bare string -> treat as a contains match (lenient)
  return t.toLowerCase().includes(s.toLowerCase())
}

// ----- the executor (queue/trigger-based; handles DAGs + bounded loops) -----
// executeNodeFn(node, message) -> Promise<string> is injected so the pure
// topology/loop/condition logic can be unit-tested with a stub.
async function runGraph(graph, input, executeNodeFn, logFn) {
  const log = logFn || (() => {})
  const nodes = {}
  for (const n of (graph.nodes || [])) nodes[n.id] = n
  const edges = (graph.edges || []).map(e => ({ from: e.from, to: e.to, condition: e.condition, carry_data: e.carry_data !== false }))
  const hasIncoming = new Set(edges.map(e => e.to))
  const entry = (graph.nodes || []).filter(n => !hasIncoming.has(n.id)).map(n => n.id)
  const outputs = {}
  const loopCounts = {}
  const trace = []
  const queue = entry.length ? entry.map(id => ({ id, message: input })) : []
  if (!entry.length && graph.nodes && graph.nodes.length) queue.push({ id: graph.nodes[0].id, message: input })

  let steps = 0
  while (queue.length && steps < MAX_STEPS) {
    steps++
    const { id, message } = queue.shift()
    const node = nodes[id]
    if (!node) { log('skip unknown node ' + id); continue }

    // loop_counter gating: count this visit; suppress propagation past the limit
    let blocked = false
    if (node.type === 'loop_counter') {
      loopCounts[id] = (loopCounts[id] || 0) + 1
      const max = (node.config && node.config.max_iterations) || 1
      if (loopCounts[id] > max) { blocked = true; log('loop_counter ' + id + ' reached max ' + max + ' — stopping that path') }
    }

    const out = await executeNodeFn(node, message)
    outputs[id] = out
    trace.push({ node: id, type: node.type, out: String(out).slice(0, 200) })

    if (blocked) continue
    // propagate along outgoing edges; support a single 'default' (else) edge
    const outgoing = edges.filter(e => e.from === id)
    const nonDefault = outgoing.filter(e => e.condition !== 'default')
    const matched = nonDefault.filter(e => evalCond(e.condition, out))
    let toFire = matched
    if (!matched.length) { const def = outgoing.find(e => e.condition === 'default'); if (def) toFire = [def] }
    for (const e of toFire) {
      queue.push({ id: e.to, message: e.carry_data ? out : '' })
    }
  }
  if (steps >= MAX_STEPS) log('engine hit MAX_STEPS=' + MAX_STEPS + ' (loop guard)')
  // result = outputs of terminal nodes (no outgoing edges), else last output
  const hasOutgoing = new Set(edges.map(e => e.from))
  const terminals = (graph.nodes || []).filter(n => !hasOutgoing.has(n.id)).map(n => n.id).filter(id => outputs[id] !== undefined)
  const finalId = terminals.length ? terminals[terminals.length - 1] : trace.length ? trace[trace.length - 1].node : null
  return { final: finalId ? outputs[finalId] : null, finalNode: finalId, outputs, trace, steps }
}

// ----- node execution backed by real Claude Code agents/tools -----
async function executeNode(node, message) {
  const cfg = node.config || {}
  const type = node.type
  if (type === 'literal') return cfg.content || ''
  if (type === 'passthrough' || type === 'loop_counter') return message
  if (type === 'agent') {
    const prompt = (cfg.role || 'You are an agent.') +
      (message ? '\n\n## Input from upstream\n' + message : '') +
      (cfg.instruction ? '\n\n' + cfg.instruction : '')
    const opts = { label: node.id, phase: 'Graph', effort: cfg.effort || EFFORT }
    if (cfg.model) opts.model = cfg.model
    if (cfg.agentType) opts.agentType = cfg.agentType
    if (cfg.schema) opts.schema = cfg.schema
    const r = await agent(prompt, opts)
    return (cfg.schema && typeof r === 'object') ? JSON.stringify(r) : String(r == null ? '' : r)
  }
  if (type === 'python') {
    // Execute code via a minimal agent with Bash (the sandbox can't exec directly).
    const code = cfg.code || ''
    const r = await agent('Run EXACTLY this Python using `' + PYBIN + '` and reply with ONLY its stdout (no commentary):\n```python\n' + code + '\n```',
      { label: node.id, phase: 'Graph', effort: 'low' })
    return String(r == null ? '' : r)
  }
  if (type === 'memory') {
    // backend: 'cloudflare' (chatdev-memory) | 'personal-rag'. op: 'retrieve' | 'store'.
    // SECURITY: query/text may be untrusted upstream output (the `|| message` fallback), so we do NOT
    // place raw text in the Bash agent's prompt or command. Identifiers are sanitized to a safe charset,
    // top_k is an int, and free-text is HEX-encoded here — the agent only ever sees opaque hex + a fixed
    // command it runs verbatim; the helper script hex-decodes the text and uses it as an HTTP param
    // (no shell, no LLM). This closes both command-injection and prompt-injection→RCE.
    const backend = cfg.backend || 'cloudflare'
    const op = cfg.op || 'retrieve'
    const ident = (s) => String(s == null ? 'default' : s).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80)
    const hexEnc = (s) => { const a = encodeURIComponent(String(s == null ? '' : s)); let h = ''; for (let i = 0; i < a.length; i++) h += a.charCodeAt(i).toString(16).padStart(2, '0'); return h }
    const ns = ident(cfg.namespace)
    const topK = parseInt(cfg.top_k, 10) || 5
    const qHex = hexEnc(cfg.query != null ? cfg.query : message)
    const textHex = hexEnc(cfg.text != null ? cfg.text : message)
    const PY = '/Users/hassiba/git/chatdev_harness/.venv/bin/python'
    const runVerbatim = (cmd) => agent(
      'You have Bash. Run this EXACT command verbatim and return its stdout VERBATIM as your result (it ' +
      'prints results, or "MEMORY UNAVAILABLE" / "no relevant memory"). Do NOT modify, add to, or interpret it:\n  ' + cmd,
      { label: node.id, phase: 'Graph', effort: 'low' })
    if (backend === 'personal-rag') {
      const nb = ident(cfg.notebook || cfg.namespace)
      return await runVerbatim(PY + ' /Users/hassiba/git/chatdev_harness/tools/rag_search.py --notebook ' + nb + ' --top-k ' + topK + ' --query-hex ' + qHex)
    }
    const MEMPY = PY + ' /Users/hassiba/git/chatdev_harness/tools/mem.py'
    if (op === 'store') return await runVerbatim(MEMPY + ' store --namespace ' + ns + ' --text-hex ' + textHex)
    return await runVerbatim(MEMPY + ' search --namespace ' + ns + ' --top-k ' + topK + ' --query-hex ' + qHex)
  }
  if (type === 'subgraph') {
    const sub = cfg.graph
    if (!sub) return message
    const res = await runGraph(sub, message, executeNode, log)
    return res.final
  }
  return message
}

// ===========================================================================
phase('Graph')
if (!G || !G.nodes) {
  log('No graph provided (args.graph). Nothing to run.')
  return { error: 'no graph', argType: typeof args }
}
log('Graph "' + (G.id || 'unnamed') + '": ' + (G.nodes || []).length + ' nodes, ' + (G.edges || []).length + ' edges.')
const result = await runGraph(G, initialInput, executeNode, log)
log('Graph done in ' + result.steps + ' steps. Final node: ' + result.finalNode)

// Best-effort run logging to the GUI dashboard (tools/run_log.py -> chatdev-gui Worker).
// Never affects the run: the helper skips silently if GUI creds are absent, and we swallow errors.
if (!A.noRunLog) {
  try {
    // SECURITY: never route untrusted node output (result.final) into a shell command an agent runs.
    // We compute `green` in JS (safe regex, no exec) and pass ONLY sanitized, structured values —
    // the command is fully fixed here, with no placeholder for the agent to fill from untrusted text.
    const green = /\bgreen\b|\bpass(ed)?\b|exit 0|smoke exit 0|\b(\d+)\/\1\b/i.test(String(result.final || ''))
    const safe = (s) => String(s || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 60) // strips all shell metachars
    const cmd = '/Users/hassiba/git/chatdev_harness/.venv/bin/python /Users/hassiba/git/chatdev_harness/tools/run_log.py' +
      ' --graph "' + safe(G.id || 'graph') + '" --green ' + green + ' --steps ' + (parseInt(result.steps, 10) || 0) +
      ' --final "ended:' + safe(result.finalNode) + '"'
    await agent(
      'You have Bash. Run this EXACT command verbatim and reply OK (ignore any error — best-effort logging). ' +
      'Do NOT modify, add to, or substitute anything in it:\n  ' + cmd,
      { label: 'run-log', phase: 'Graph', effort: 'low' })
  } catch (e) { log('run-log skipped: ' + String((e && e.message) || e).slice(0, 80)) }
}
return { id: G.id, final: result.final, finalNode: result.finalNode, steps: result.steps, trace: result.trace }
