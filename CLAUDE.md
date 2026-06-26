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

## Phase order (the pipeline)
Reimplements ChatDev's chat-chain as a deterministic **Workflow**
(`.claude/workflows/chatdev-company.js`), with ChatDev's `ComposedPhase`/`break_cycle` loops
made explicit:

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

## How to run the company
Dispatch the Workflow with a product prompt and a target dir. Use the **`scriptPath`** form —
it always works; the `name: "chatdev-company"` form only resolves if your Claude Code version
discovers project `.claude/workflows/` at startup (built-ins always do):

```
Workflow({
  scriptPath: ".claude/workflows/chatdev-company.js",
  args: { prompt: "<your product spec>", target: "./demo" }
})
```

With no args it builds the **demo target**: a Python todo CLI in `./demo`
(`add <text>` / `list` / `done <id>`, JSON-persisted, with a `pytest` suite). The slice is
green when `pytest` in `./demo` exits 0. Widen the company by changing `args.prompt`/`args.target`.

**Prerequisite — pytest:** the workflow runs tests with a repo-local venv python
(`.venv/bin/python`, gitignored). Create it once:
`python3 -m venv .venv && .venv/bin/pip install pytest`. To use a different interpreter that
already has pytest, pass `args.pybin: "/path/to/python"`.

You can also run a single role interactively via the Agent tool (e.g. dispatch `reviewer`
on the current diff) — the `.claude/agents/*.md` definitions are the canonical, tool-scoped
roles. (Note: the Workflow runtime resolves agent types from the built-in/plugin registry
only — it does **not** pick up project `.claude/agents` — so the workflow embeds equivalent
role briefs inline. For the critical read-only role it dispatches the built-in
`feature-dev:code-reviewer` (genuinely no Write/Edit/Bash) so the reviewer is enforced
read-only in the workflow too; the `.claude/agents` files remain the source of truth and
enforce the scoping for interactive use.)

## Presets / modes (ChatDev CompanyConfig)
ChatDev ships pipeline presets in `CompanyConfig/` (Default, Human, Incremental, Art). This harness
implements them as **modes of the one engine**, not separate companies:

| Preset | Here | How to run |
|---|---|---|
| **Default** | The autonomous pipeline (spec → build → review → test). | `/build-company` or the Workflow with no mode flag. |
| **Incremental** (`incremental_develop`) | Extend an EXISTING tested codebase instead of scaffolding from scratch; new + existing tests must stay green. | `/extend-company <change>` or `args: { incremental: true, change: "...", target: <existing dir> }`. |
| **Human** (`HumanAgentInteraction`) | After the automated review, a **human** reviews and gives feedback (≤5 rounds) before the test gate. Runs as an interactive, main-agent-driven flow (a background Workflow can't pause for human turns) using the role agents + `AskUserQuestion`. | `/build-company-human [prompt]`. |
| **GameDev** (2.0 `GameDev_with_manager.yaml`) | Game factory: GDD → core (Phase 1) → polish (Phase 2) → QA → run. Builds a real **Pygame** game; success = pure-logic `pytest` green **and** a headless smoke-run launches clean. Separate workflow `chatdev-gamedev.js`. | `/build-game [idea]`. |
| **Art** | Not yet ported — would wire an image-gen step (the `nanobanana` skill) to produce GUI assets. | — |

Note on ChatDev's two generations: the **1.0** `CompanyConfig/` presets are general (its famous games
like 2048/Gomoku were Default-pipeline *outputs*, not a preset). But **2.0** (the repo's current branch)
has a `yaml_instance/` directory of ~40 YAML-graph workflows, including a dedicated **GameDev** one
(ported here) plus others (data-viz, Blender 3D, deep-research, video) that would need capabilities
beyond Python+pytest. Games here keep *logic* in a pygame-free module so it stays testable.

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
  bound a cycle), `subgraph` (`config.graph` runs nested). Entry = nodes with no incoming edge.
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

Not ported from 2.0 (deliberate): the Vue **visual graph editor** (Claude Code's native UI replaces it),
**multi-provider** models (Claude subscription only), and retrieval **memory** modules (filesystem +
structured hand-offs are the shared state; a memory node is a future addition).

## Working in this repo (isolation rules)
- All writes stay inside this repo. **Never modify `/Users/hassiba/git/chatdev`** (read-only reference).
- The built app goes in `./demo`, kept separate from harness config (`.claude/`, `CLAUDE.md`).
- This harness is interactive-first and runs on the Claude subscription — **no `ANTHROPIC_API_KEY`**.
