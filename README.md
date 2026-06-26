# ChatDev Harness — a virtual software company in Claude Code

A [Claude Code](https://claude.com/claude-code) reimplementation of **ChatDev** (Wu et al.,
*Communicative Agents for Software Development*): a company of role-agents that turns a product
prompt into working, **tested** software.

The win over ChatDev is **real execution**. ChatDev's agents emit code as *text* that a regex
layer scrapes into files, and "test" by running a program for ~3 seconds and grepping stderr for
`Traceback`. Here the role-agents have **real tools** — they write real files (`Write`/`Edit`),
run real commands (`Bash`), and pass a **real `pytest` suite** (exit 0 = done).

## Setup & configuration

The harness runs inside [Claude Code](https://claude.com/claude-code) (it uses subagents, the
Workflow tool, and `.claude/` config). Clone it and work *inside* the repo so Claude Code picks up
`.claude/` + `CLAUDE.md`.

**1. Python toolchain** (for the build/test gates — required):
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```
This installs `pytest` (the success signal), `pyyaml` (the graph YAML→JSON bridge), `matplotlib`
(data-viz graph), and `pygame-ce` (game factory). The workflows call `.venv/bin/python`; override with
`args.pybin` if your interpreter lives elsewhere.

**2. Optional features** — copy `.env.example` → `.env` (gitignored) and fill in only what you want:

| Feature | Needs | How |
|---|---|---|
| **Retrieval memory** (`memory` graph nodes) | a Cloudflare account | Deploy the Worker in [`cloudflare/memory-worker/`](cloudflare/memory-worker/README.md) (Workers AI + Vectorize + D1, no extra keys), then set `MEMORY_URL` / `MEMORY_TOKEN` in `.env`. |
| **Art** (`graphs/art.yaml`) | a Gemini API key | Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), set `GEMINI_API_KEY` in `.env`. Image gen runs via the repo-local [`tools/genimage.py`](tools/genimage.py). |
| **Personal corpus grounding** (optional, private) | your own RAG MCP | A `memory` node with `backend: personal-rag` retrieves from your knowledge base; it **gracefully degrades to a no-op** for anyone who doesn't have it, so it never breaks a clone. |

Everything in step 2 is optional — the core company/gamedev/data-viz pipelines and all the test
gates work with just step 1.

## How it works

Four tool-scoped role subagents (`.claude/agents/`), orchestrated by a deterministic
[Workflow](.claude/workflows/chatdev-company.js) that reimplements ChatDev's chat-chain as an
explicit pipeline:

```
Spec ─▶ Build (TDD) ─▶ Review → Fix (≤2) ─▶ Test → Debug (≤3) ─▶ green (pytest exit 0)
```

| Role | Tools | Responsibility |
|---|---|---|
| `spec-architect` | `Read, Glob, Grep` | Product prompt → precise spec (features, file plan, interface contract, data model, test plan). |
| `programmer` | `Read, Write, Edit, Bash, Glob, Grep` | The only writer/runner. TDD: tests first → implement → `pytest` → iterate to green. |
| `reviewer` | `Read, Glob, Grep` | **Genuinely read-only.** Reviews vs. spec; returns findings; never edits. |
| `tester` | `Read, Bash` | Independently runs `pytest`; reports authoritative pass/fail. Cannot edit → cannot fake green. |

Separation of duties is **enforced by tool scoping**, not just prompts: the reviewer literally
has no Write/Edit/Bash. The **filesystem is the shared state** (ChatDev's `ChatEnv` blackboard →
real files on disk); stages hand off **schema-validated results**.

## Run it

```jsonc
// In Claude Code:
Workflow({
  scriptPath: ".claude/workflows/chatdev-company.js",
  args: { prompt: "<your product spec>", target: "./demo" }
})
```

Or use the `/build-company` command. With **no args** it builds the demo target: a Python todo
CLI in [`demo/`](demo/) (`add` / `list` / `done`, JSON-persisted) with a `pytest` suite — proven
green (10/10, exit 0).

**Prerequisite (pytest):** `python3 -m venv .venv && .venv/bin/pip install pytest` (override the
interpreter with `args.pybin`).

## Presets / modes

ChatDev's pipeline presets (`CompanyConfig/`) are implemented here as **modes of one engine**:

| Preset | What it does | Run |
|---|---|---|
| **Default** | Autonomous spec → build → review → test. | `/build-company "<idea>"` |
| **Incremental** | Extend an **existing** tested codebase (new + existing tests stay green). | `/extend-company "<change>"` |
| **Human** | A **human** reviews and gives feedback (≤5 rounds) before the test gate; interactive. | `/build-company-human "<idea>"` |
| **GameDev** | A real **Pygame** game (port of ChatDev 2.0's `GameDev_with_manager.yaml`): GDD → core → polish → QA → run. Success = pure-logic `pytest` green **and** a headless launch runs clean. | `/build-game "<idea>"` |
| **Art** | _Not yet ported_ — would wire image generation (e.g. nanobanana) for GUI assets. | — |

> ChatDev 1.0's presets are general; its 2.0 branch adds a `yaml_instance/` library of ~40 YAML-graph
> workflows — including the GameDev one ported here. Others (Blender 3D, Manim video, data-viz,
> deep-research) need capabilities beyond Python+pytest. Games here keep *logic* in a pygame-free,
> pytest-tested module; `game.py` is the renderer with a headless smoke mode.

## Declarative graph engine (ChatDev 2.0)

ChatDev 2.0 is a **declarative graph runtime** — author a YAML `graph: {nodes, edges}` and an executor
runs it. [`.claude/workflows/chatdev-graph.js`](.claude/workflows/chatdev-graph.js) reimplements that
Claude-Code-native: nodes (`agent`/`literal`/`passthrough`/`loop_counter`/`python`/`subgraph`) and edges
that route on a node's output (`contains:` / `!contains:` / `regex:` / `equals:` / `default`), executed by
**real subagents with real tools**.

```bash
/run-graph graphs/demo_build.yaml          # spec → builder(TDD, real files+pytest) → reviewer → reporter
```

See [`graphs/demo_build.yaml`](graphs/demo_build.yaml) for the shape and `CLAUDE.md` → "Declarative graph
engine" for the node/edge reference. (Deliberately not ported: the Vue visual editor, multi-provider models,
and retrieval-memory modules — replaced by Claude Code's UI, the subscription, and the filesystem.)

## Repo layout

| Path | What |
|---|---|
| [`.claude/agents/`](.claude/agents/) | The four company roles (tool-scoped subagents). |
| [`.claude/workflows/chatdev-company.js`](.claude/workflows/chatdev-company.js) | The orchestration pipeline. |
| [`.claude/commands/build-company.md`](.claude/commands/build-company.md) | `/build-company` driver. |
| [`CLAUDE.md`](CLAUDE.md) | Company charter (auto-loaded project instructions). |
| [`CHATDEV_UNDERSTANDING.md`](CHATDEV_UNDERSTANDING.md) | Full ChatDev → harness concept mapping. |
| [`BUILD_PLAN.md`](BUILD_PLAN.md) · [`SUMMARY.md`](SUMMARY.md) | Design rationale · summary. |
| [`demo/`](demo/) | The built todo CLI + pytest suite (proof artifact). |

## Credits

Reimplements the idea of [ChatDev](https://github.com/OpenBMB/ChatDev) (OpenBMB). Built with
Claude Code. The `demo/` app was authored end-to-end by the harness's own role-agents.
