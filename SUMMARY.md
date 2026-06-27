# ChatDev Harness — Summary

A **Claude Code reimplementation of ChatDev** (Wu et al., *Communicative Agents for Software
Development*): a virtual software company of role-agents that turns a product prompt into
working, tested software. The win over ChatDev is **real execution** — the role-agents have
real tools and write real files, run real code, and pass a **real `pytest` suite**, instead of
emitting code as text that a regex layer scrapes into files.

## What was built

**Roles → 4 tool-scoped subagents** (`.claude/agents/`):
| Agent | Tools | Role |
|---|---|---|
| `spec-architect` | `Read, Glob, Grep` | Product prompt → precise spec (features, file plan, interface/CLI contract, data model, test plan). |
| `programmer` | `Read, Write, Edit, Bash, Glob, Grep` | The only writer/runner. TDD: tests first → implement → `pytest` → iterate to green. Applies fixes; debugs. |
| `reviewer` | `Read, Glob, Grep` | **Genuinely read-only.** Reviews vs. spec; returns prioritized findings; never edits. |
| `tester` | `Read, Bash` | Independently runs `pytest`; reports authoritative pass/fail. Cannot edit → cannot fake green. |

> Note: this summary records the original build. The harness has since consolidated onto a single
> **declarative graph engine** — see `README.md` / `CLAUDE.md` for the current model. The original
> company pipeline now lives as `graphs/software_company.yaml`.

**Orchestration → a declarative graph engine** (`.claude/workflows/chatdev-graph.js`) that runs
`graphs/*.yaml`. The standard build graph reimplements ChatDev's chat-chain, with its
`ComposedPhase`/`break_cycle` loops as explicit nodes/edges:
1. **Spec** — spec-architect → structured build spec.
2. **Build (TDD)** — programmer writes failing tests, implements, iterates `pytest` to green.
3. **Review → Fix** (≤2 cycles) — reviewer findings → programmer applies high/medium ones → re-test. Breaks when no actionable findings.
4. **Test → Debug** (≤3 cycles) — tester runs `pytest`; programmer debugs to root cause on red. Breaks on exit 0. No-thrash guard stops repeated identical failures.

Each stage is a real subagent dispatch returning a **schema-validated result**; the **filesystem
is the shared state** (ChatDev's `ChatEnv` blackboard → real files on disk).

**Charter → `CLAUDE.md`**: roles + tool scoping, phase order, handoff conventions, stop signals,
how to run. **Launcher → `/run-graph graphs/<name>.yaml`**. **Mapping → `CHATDEV_UNDERSTANDING.md`**
(full concept→harness table). **Design rationale → `docs/build-history/BUILD_PLAN.md`**.

## Proof (independently verified)
- The company built the demo target — a Python todo CLI in **`./demo`** (`todo` package:
  `storage.py` / `core.py` / `__main__.py` + `tests/test_todo.py`).
- **`pytest` → 10 passed, exit 0** (re-run by the orchestrator, not just self-reported).
- CLI smoke test passed end-to-end: `add` / `list` / `done`, missing-id error (exit 1), JSON persistence.
- Tool scoping verified programmatically: reviewer & spec-architect read-only; tester no Write/Edit;
  programmer is the only writer. **Reviewer read-only = PASS (hard requirement).**
- Workflow enforces read-only reviewer in-workflow via the built-in `feature-dev:code-reviewer`
  (probe-confirmed it resolves); the runtime does **not** resolve project agent types or workflow
  names mid-session (both probed) — hence inline briefs + `scriptPath` invocation.

## How to run
```
/run-graph graphs/software_company.yaml     # or any graph in graphs/
```
**Prerequisite (once):** `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`.

## How to widen it
- **New pipeline / idea:** clone a graph in `graphs/` and edit its first (brief/spec) node, or author
  a new graph (node/edge reference in `CLAUDE.md` → "Declarative graph engine"); run it with `/run-graph`.
- **Self-improving builds:** use `graphs/game_factory_learning.yaml` — it recalls past lessons and stores
  new verified ones; `graphs/consolidate_lessons.yaml` keeps that memory sharp.
- **Stronger verification:** the independent test run (the green `pytest` signal) is the real success gate.

## Repo layout
```
.claude/workflows/chatdev-graph.js                             # the engine (runs any graph)
graphs/*.yaml                                                   # the pipelines (one graph each)
.claude/agents/{spec-architect,programmer,reviewer,tester}.md   # the role subagents
.claude/commands/run-graph.md                                   # /run-graph launcher
CLAUDE.md                          # project charter (auto-loaded instructions)
CHATDEV_UNDERSTANDING.md           # ChatDev → harness mapping
tools/                             # mem.py, rag_search.py, genimage.py
cloudflare/                        # memory Worker + GUI app
docs/build-history/                # PROGRESS, BUILD_PLAN, HARNESS_DONE (original build log)
demo/, game/, …                    # built artifacts (proof; green)
.venv/                             # repo-local pytest+deps (gitignored)
```
