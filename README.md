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

The harness is a **declarative graph engine** (a Claude-Code-native port of ChatDev 2.0). A pipeline is a
**graph** — a YAML file in [`graphs/`](graphs/) of **nodes** (steps) + **edges** (how they connect); the
engine [`.claude/workflows/chatdev-graph.js`](.claude/workflows/chatdev-graph.js) runs it by dispatching a
**real Claude Code subagent** at each agent node, so steps write files, run commands, and pass a real
`pytest` suite. A typical build graph:

```
spec ─▶ agent(build, TDD) ─▶ [PASS] review ─▶ test ─▶ green (pytest exit 0)
                   └─[FAIL]─▶ loop_counter ─▶ build
```

Roles are tool-scoped subagents (separation of duties is **enforced**, not just prompted):

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

There is **one way to run a pipeline** — feed a graph to the engine:

```bash
# In Claude Code:
/run-graph graphs/<name>.yaml
```

**Prerequisite (once):** `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
(pytest + pyyaml + matplotlib + pygame-ce). See **Setup & configuration** above for the optional
memory + image features. Node/edge reference: `CLAUDE.md` → "Declarative graph engine".

**Node types:** `literal` (static text), `agent` (a real subagent — full tools, or read-only via
`agentType`, or structured output via `schema`), `python`, `passthrough`, `loop_counter` (bound a loop),
`subgraph`, `memory` (retrieval). **Edges** route on a node's text output: `contains:` / `!contains:` /
`regex:` / `equals:` / `default`. The **filesystem is the shared state**; `pytest` exit 0 is success.

## Graph library (`graphs/`)

| Graph | What it builds |
|---|---|
| `software_company.yaml` | Software: spec → build(TDD) → review → test (the ChatDev "company" as a graph). |
| `game_factory.yaml` | A real **Pygame** game (pygame-free tested logic + headless smoke). |
| `game_factory_learning.yaml` | **Self-improving** game build — recalls books + past lessons, stores new lessons on green. |
| `data_viz.yaml` | A labelled matplotlib chart (real PNG). |
| `art.yaml` | A generated image via Gemini (`tools/genimage.py`). |
| `memory_demo.yaml` | Retrieve from memory and apply it. |
| `consolidate_lessons.yaml` | Maintenance: dedupe/merge the lessons store. |
| `demo_build.yaml` | Minimal example (spec → build → review → report). |
| `tandem.yaml` *(on the `tandem` branch)* | The Tandem puzzle, grounded by the game-design books. |
| [`oracleforge/factory.yaml`](graphs/oracleforge/factory.yaml) | **Autonomous game factory** — your game idea → a shippable, tested web-game PWA through every gated stage (see "Build your own game" below). |
| [`oracleforge/*.yaml`](graphs/oracleforge/) | The factory's individual stages (`ideate`, `foundation`, `difficulty`, `content`, `shell`, `share`, `ship`, …) + `rebalance`, runnable standalone. |

> Most graphs bake their task into the first node (clone + edit it, or use the GUI graph editor). The
> **oracle factory is the exception — you pass it your own idea** (see below). Deliberately not reimplemented
> from ChatDev 2.0: multi-provider models (Claude subscription only) — and its Vue editor is replaced by the
> Cloudflare GUI in [`cloudflare/gui-worker/`](cloudflare/gui-worker/).

## Build your own game — the autonomous oracle factory

Have a game idea in a file (e.g. `idea.md`)? The **oracle game factory** ([`graphs/oracleforge/`](graphs/oracleforge/))
takes it from **idea → a shippable, tested web game, autonomously**, through every stage in one run. Point it
at your file:

```
# In Claude Code, inside the repo:
/run-graph graphs/oracleforge/factory.yaml idea.md
```

`idea.md` is passed as the factory's input and its first node reads the file. (You can pass any path, or a
one-line idea inline: `/run-graph graphs/oracleforge/factory.yaml "A 4×4 Lights-Out: tap toggles a cell + its neighbors; clear the board in fewest taps."`)

**What it does:** a critic **council** first vets the idea for *oracle-fit*, then it builds and **independently
verifies** each stage — exact solver + yield-census → difficulty contract → solver-gated level pack →
design-grounded PWA shell → URL codec → PWA + Cloudflare Worker — even **rendering the UI and re-running the
oracle inside the deployed bundle in a real browser**. It ends `PRODUCTION: READY` with a play/deploy report,
or a clean `FACTORY: BLOCKED` report naming the blocker. The finished game lands in `out/factory/` (gitignored);
play it with `cd out/factory && python3 -m http.server` (and `node --test` to re-verify).

> **It's a deterministic-puzzle factory** (exactly-solvable, plan-then-run — think Lights-Out, Sokoban,
> Hexcells). A real-time / physics / RNG / hidden-information game is **rejected at the oracle-fit gate by
> design** — that's the gate working, not a failure. It's a long, heavy autonomous run. Memory/RAG grounding
> is optional — the factory **degrades gracefully** without it. To run just one stage, use
> `/run-graph graphs/oracleforge/<stage>.yaml`; to validate an idea without building, use `ideate.yaml`.

## Console (GUI)

A small Cloudflare app — [`cloudflare/gui-worker/`](cloudflare/gui-worker/) — to **browse/edit graphs**
(with a rendered node/edge diagram), **inspect & curate the lessons memory**, **browse personal-rag
notebooks**, and watch a **run dashboard**. Self-contained (no external CDNs; YAML parsed server-side),
auth-gated (`GUI_TOKEN`), with upstream tokens held server-side via service bindings. Deploy:
`cd cloudflare/gui-worker && npm install && wrangler deploy` (see its README).

## Repo layout

| Path | What |
|---|---|
| [`.claude/workflows/chatdev-graph.js`](.claude/workflows/chatdev-graph.js) | **The engine** — runs any graph. |
| [`graphs/`](graphs/) | **The pipelines** — one YAML graph each. |
| [`.claude/agents/`](.claude/agents/) | The role subagents (tool-scoped). |
| [`.claude/commands/run-graph.md`](.claude/commands/run-graph.md) | `/run-graph` launcher. |
| [`tools/`](tools/) | `mem.py` (lessons), `rag_search.py` (books), `genimage.py` (art). |
| [`cloudflare/`](cloudflare/) | The memory Worker + the GUI app. |
| [`docs/grounding/`](docs/grounding/) | Distilled design grounding (motion-math, UI-design contract, game-UI review) the roles read. |
| [`CLAUDE.md`](CLAUDE.md) | Project charter (auto-loaded instructions). |
| [`CHATDEV_UNDERSTANDING.md`](docs/CHATDEV_UNDERSTANDING.md) | Full ChatDev → harness concept mapping. |
| [`SUMMARY.md`](docs/SUMMARY.md) · [`docs/build-history/`](docs/build-history/) | Summary · original build log. |
| `out/` | Generated build output (**gitignored**) — where graphs and the factory write their apps (regenerable). |

## Credits

Reimplements the idea of [ChatDev](https://github.com/OpenBMB/ChatDev) (OpenBMB). Built with
Claude Code. The demo apps under `out/` (the todo CLI, the Lumens game, …) were authored
end-to-end by the harness's own agents.
