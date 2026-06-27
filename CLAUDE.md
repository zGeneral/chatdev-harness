# ChatDev Harness — a virtual software company in Claude Code

This repo is a **Claude Code reimplementation of ChatDev** (Wu et al., *Communicative
Agents for Software Development*). ChatDev runs a company of role-agents that turn a product
prompt into software via multi-agent dialogue — but its agents only *emit code as text*,
which a regex layer scrapes into files, and its "testing" is a 3-second `python main.py`
smoke-run grepping for `Traceback`.

**This harness keeps the good idea and fixes the gap: the role-agents have real tools.**
They write real files (`Write`/`Edit`), run real commands (`Bash`), and pass a real
`pytest` suite. The success signal is `pytest` exit 0 — behavioral verification, not a
crash check. See `CHATDEV_UNDERSTANDING.md` for the full concept→harness mapping.

## The company (roles → `.claude/agents/`)
Four tool-scoped subagents. For **interactive** Agent-tool use, the `tools:` frontmatter below
is **enforced by the runtime** — the reviewer literally has no Write/Edit/Bash; the tester no
Write/Edit. In the **workflow** path the runtime can't load project `.claude/agents`, so the
workflow enforces the critical case by dispatching the review stage as the built-in read-only
reviewer agent type (`feature-dev:code-reviewer`, also no Write/Edit/Bash); the other roles run
prose-disciplined, with the orchestrator's **independent `pytest` run** as the green's compensating
control. Either way the Programmer is the only role that mutates files.

| Role | Agent | Tools | Charter |
|---|---|---|---|
| Spec & Architecture | `spec-architect` | `Read, Glob, Grep` (read-only) | Product prompt → precise spec: features, file plan, interface/CLI contract, data model, test plan. |
| Programmer | `programmer` | `Read, Write, Edit, Bash, Glob, Grep` | The only writer/runner. TDD: tests first → implement → run `pytest` → iterate to green. Also applies fixes and debugs. |
| Code Reviewer | `reviewer` | `Read, Glob, Grep` (read-only) | Reviews against the spec; returns prioritized findings. **Cannot edit or run code** — the Programmer applies fixes. |
| Test Engineer | `tester` | `Read, Bash` | Independently runs `pytest`; reports the authoritative pass/fail. **Cannot edit** — so it cannot fake a green. |

## Phase order (the standard build graph)
A build graph (e.g. `graphs/software_company.yaml`) is ChatDev's chat-chain expressed as explicit
graph nodes/edges, with its `ComposedPhase`/`break_cycle` loops made explicit:

1. **Spec** — `spec-architect` turns the product prompt into the build spec.
2. **Build (TDD)** — `programmer` writes the failing tests, then the implementation, and
   iterates with `pytest` until green.
3. **Review → Fix** loop (≤2 cycles) — `reviewer` returns findings; `programmer` applies the
   real high/medium ones; re-run. Break when no high-severity findings remain.
4. **Test → Debug** loop (≤3 cycles) — `tester` runs `pytest`; on red, `programmer` debugs the
   root cause and re-runs. Break when `pytest` exits 0.

## Handoff conventions (what each stage consumes / produces)
- The **filesystem is the shared state** (ChatDev's `ChatEnv` blackboard → real files in the
  target dir). Code lives on disk, not re-serialized into prompts.
- Stages also pass **structured results**: Spec → spec object; Build → {files, tests passing/total,
  exit code}; Review → {findings:[{severity,location,problem,fix}]}; Test → {exitCode, passed, total, failures}.
- The **spec's interface contract is the cross-role API**: the Programmer builds to it, the
  Reviewer checks against it, the Tester verifies it.

## Stop signals
- **Green / done:** `pytest` in the target dir exits 0. That is the company's definition of success.
- **No-thrash:** if the same `pytest` failure recurs 3× without a new approach, stop and report
  the blocker rather than looping. The Build/Test loops have hard cycle caps for the same reason.
- The Reviewer returning zero high-or-medium-severity findings ends the Review loop early (ChatDev's `<INFO> Finished`).

## How to run (one model)
There is a single way to run a pipeline: feed a graph to the engine.
```
/run-graph graphs/<name>.yaml
```
(The `/run-graph` command converts the YAML → JSON and invokes the engine
`.claude/workflows/chatdev-graph.js` with it.) **Prerequisite (once):**
`python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`. Graphs run tests with
`.venv/bin/python` (override per-graph via the `PYBIN`/`pybin` references in the graph).

You can also run a single role interactively via the Agent tool (e.g. dispatch `reviewer` on the
current diff). The read-only reviewer is the built-in `feature-dev:code-reviewer` (genuinely no
Write/Edit/Bash); the `.claude/agents/*.md` files are the canonical tool-scoped role definitions.

## Graph library (`graphs/*.yaml`)
Every pipeline is a graph. ChatDev's old presets are now just graphs:

| Graph | What it is |
|---|---|
| `software_company.yaml` | The ChatDev "company": spec → build(TDD) → review → test. |
| `game_factory.yaml` | A real Pygame game (pygame-free tested logic + headless smoke). |
| `game_factory_learning.yaml` | **Self-improving** game build (recall books + lessons → … → reflect stores verified lessons). |
| `data_viz.yaml` · `art.yaml` | A matplotlib chart (real PNG) · a Gemini image via `tools/genimage.py`. |
| `memory_demo.yaml` · `consolidate_lessons.yaml` | Retrieve-and-apply demo · lessons maintenance (dedupe/merge). |
| `demo_build.yaml` | Minimal example (spec → build → review → report). |
| `tandem.yaml` *(tandem branch)* | The Tandem puzzle, grounded by the game-design books. |

To build a new idea: clone a graph and edit its first (brief/spec) node, or author one with the GUI
graph editor. Each graph's task is currently baked into that first node.

## Declarative graph engine (ChatDev 2.0 port)
ChatDev 2.0 is a **declarative graph runtime** — you author a YAML `graph: {nodes, edges}` and an
executor runs it. `.claude/workflows/chatdev-graph.js` reimplements that, Claude-Code-native: it
executes a graph with **real subagents + tools** instead of just emitting text.

**Schema** (author in `graphs/*.yaml`):
```yaml
graph:
  id: my_graph
  nodes:
    - { id: a, type: literal,    config: { content: "..." } }
    - { id: b, type: agent,      config: { role: "...", instruction: "...", agentType?, model?, effort?, schema? } }
    - { id: g, type: loop_counter, config: { max_iterations: 2 } }
  edges:
    - { from: a, to: b }
    - { from: b, to: c, condition: "contains:PASS" }   # else-branch: condition: "default"
```
- **Node types:** `literal` (static text), `passthrough` (forward input), `agent` (a real Claude
  subagent — full tools by default; set `agentType` e.g. `feature-dev:code-reviewer` for read-only,
  `schema` for structured output), `python` (run code via Bash), `loop_counter` (gate a back-edge to
  bound a cycle), `subgraph` (`config.graph` runs nested), `memory` (retrieval memory; see below).
  Entry = nodes with no incoming edge.
- **Edge conditions** (evaluated on the source node's text output): absent/`true`, `contains:X`,
  `!contains:X`, `regex:PAT`, `equals:V`, and `default` (taken only if no sibling edge matched).
  A global `MAX_STEPS` guard plus `loop_counter` prevent runaway loops.

**Run it** (the Workflow sandbox has no YAML parser, so a runner converts YAML→JSON first):
```bash
.venv/bin/python -c "import yaml,json,sys;print(json.dumps(yaml.safe_load(open(sys.argv[1]))['graph']))" graphs/demo_build.yaml
```
then `Workflow({ scriptPath: ".claude/workflows/chatdev-graph.js", args: { graph: <that JSON>, input: "..." } })`.
Or use **`/run-graph graphs/demo_build.yaml`**. The engine returns the final node's output + an execution
trace. `graphs/demo_build.yaml` is a working example (spec → builder(TDD, real files+pytest) → reviewer → reporter).

**Retrieval memory** (`memory` node — ChatDev 2.0's file/FAISS/mem0 stores, reimagined on Cloudflare):
```yaml
- { id: recall, type: memory, config: { backend: cloudflare, op: retrieve, namespace: gamedesign, query: "...", top_k: 4 } }
- { id: save,   type: memory, config: { backend: cloudflare, op: store,    namespace: "proj:x", text: "..." } }
```
- **`backend: cloudflare`** (default) → the `cloudflare/memory-worker/` Worker (Workers AI `bge-m3`
  embeddings + Vectorize + D1; no external keys). Needs `MEMORY_URL`/`MEMORY_TOKEN` in `.env` — see
  `.env.example` and the worker's README to deploy your own.
- **`backend: personal-rag`** (optional, private) → retrieves from a personal-rag **notebook** (e.g. a
  corpus of **game-design books** to ground the design phase) via `tools/rag_search.py` (the Worker's
  `/api/search`; creds from `RAG_API_URL`/`RAG_API_TOKEN` or the bridge config). Config takes `notebook`
  (e.g. `game-design`). **Gracefully degrades** to "MEMORY UNAVAILABLE" if no creds, so it never breaks a clone.
- `op: retrieve` returns the matched snippets as context for downstream nodes; `op: store` saves text.
  `graphs/memory_demo.yaml` is a working example (recall game-design principles → apply them).
- Helpers: the cloudflare backend uses `tools/mem.py` (search/store/list/delete, with retry); the
  personal-rag backend uses `tools/rag_search.py`. Both read creds from `.env` / the bridge config and
  print `MEMORY UNAVAILABLE` when absent (graceful degrade).

### Self-improving game factory (two memory roles)
The two backends play distinct roles by design:
- **personal-rag `game-design` notebook = external knowledge** (the books — semantic memory).
- **chatdev-memory `lessons:gamedev` namespace = the factory's own experience** (procedural memory that
  grows every green build).

`graphs/game_factory_learning.yaml` closes the loop: **recall** (books + past lessons) → design → core →
polish → qa → **verify** → **reflect**. The `reflect` step distills 1–3 atomic, generalizable lessons and
**stores them only when the build went green** (verified-only — the test signal is the quality filter), so
future builds get better. `graphs/consolidate_lessons.yaml` is the maintenance pass (list → dedupe/merge →
replace the namespace) that keeps the lessons store high-signal as it accumulates. Keep curated reference
material (books) in personal-rag; let the factory's self-generated lessons live in chatdev-memory.

Not ported from 2.0 (deliberate): the Vue **visual graph editor** (Claude Code's native UI replaces it)
and **multi-provider** models (Claude subscription only).

## Console (GUI)
`cloudflare/gui-worker/` is a Cloudflare app (Worker + static SPA) to browse/edit graphs (rendered
diagram), inspect & **curate the lessons memory** (`lessons:*`), browse personal-rag notebooks, and
view a run dashboard. Auth-gated by `GUI_TOKEN`; reaches `chatdev-memory` + `personal-rag-mcp` via
**service bindings** (Worker→Worker, tokens server-side). Runs are logged by `tools/run_log.py` (the
engine calls it best-effort at the end of every graph). Deploy/secrets: `cloudflare/gui-worker/README.md`.

## Working in this repo (isolation rules)
- All writes stay inside this repo. **Never modify the original ChatDev reference repo** (read-only reference).
- The built app goes in `./demo`, kept separate from harness config (`.claude/`, `CLAUDE.md`).
- This harness is interactive-first and runs on the Claude subscription — **no `ANTHROPIC_API_KEY`**.
