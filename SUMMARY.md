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

**Orchestration → a Workflow** (`.claude/workflows/chatdev-company.js`): a deterministic
pipeline reimplementing ChatDev's chat-chain, with its `ComposedPhase`/`break_cycle` loops made
explicit:
1. **Spec** — spec-architect → structured build spec.
2. **Build (TDD)** — programmer writes failing tests, implements, iterates `pytest` to green.
3. **Review → Fix** (≤2 cycles) — reviewer findings → programmer applies high/medium ones → re-test. Breaks when no actionable findings.
4. **Test → Debug** (≤3 cycles) — tester runs `pytest`; programmer debugs to root cause on red. Breaks on exit 0. No-thrash guard stops repeated identical failures.

Each stage is a real subagent dispatch returning a **schema-validated result**; the **filesystem
is the shared state** (ChatDev's `ChatEnv` blackboard → real files on disk).

**Charter → `CLAUDE.md`**: roles + tool scoping, phase order, handoff conventions, stop signals,
how to run. **Driver → `/build-company`** convenience command. **Mapping → `CHATDEV_UNDERSTANDING.md`**
(full concept→harness table). **Design rationale → `BUILD_PLAN.md`**.

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

## How to run the company
```
Workflow({
  scriptPath: ".claude/workflows/chatdev-company.js",
  args: { prompt: "<your product spec>", target: "./demo" }
})
```
Or `/build-company <product prompt>`. With **no args** it rebuilds the demo todo CLI in `./demo`.

**Prerequisite (pytest):** the workflow runs tests with a repo-local venv:
`python3 -m venv .venv && .venv/bin/pip install pytest` (gitignored). Override with `args.pybin`.

## How to widen it
- **New product:** pass `args.prompt` (the product spec) and `args.target` (a fresh dir). The same
  spec→build→review→test pipeline applies to any small Python+pytest project.
- **Bigger scope:** raise the Review/Test cycle caps in the workflow; add roles (e.g. a docs/manual
  stage) as new `.claude/agents/*.md` + a pipeline stage; swap the test command (`PYTEST`) for other
  stacks (e.g. `npm test`) by editing the workflow's `PYTEST`/briefs.
- **Stronger verification:** the orchestrator's independent test run is the real green signal — keep it.

## Repo layout
```
.claude/agents/{spec-architect,programmer,reviewer,tester}.md   # the company roles
.claude/workflows/chatdev-company.js                            # the orchestration pipeline
.claude/commands/build-company.md                               # /build-company driver
CLAUDE.md                          # company charter (auto-loaded project instructions)
CHATDEV_UNDERSTANDING.md           # ChatDev → harness mapping (Phase A)
BUILD_PLAN.md                      # design + rationale (Phase B)
PROGRESS.md  SUMMARY.md  HARNESS_DONE.md
demo/                              # the built todo CLI + pytest suite (proof; green)
.venv/                             # repo-local pytest (gitignored)
```
