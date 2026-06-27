# ChatDev → Claude Code Harness — Implementation Plan

> Built autonomously per the mission. Decisions are pre-committed; this records the
> design + rationale and the task order. Execution is inline/self-paced (no human gate).

**Goal:** A Claude Code harness that reimplements ChatDev's "virtual software company" —
role-agents that turn a product prompt into working, tested software — but with **real
tool execution**: subagents write files, run code, and run `pytest`, instead of emitting
code as text.

**Architecture:** Four tool-scoped `.claude/agents` role subagents (spec-architect,
programmer, reviewer, tester) orchestrated by a deterministic **Workflow** pipeline
(spec → build(TDD) → review→fix loop → test→debug loop). The **filesystem** (`./demo`)
is the shared state; **`pytest` exit 0** is the success signal. A `CLAUDE.md` encodes the
company charter (roles, phase order, handoffs, stop signals).

**Tech stack:** Claude Code 2.1.193 subagents + Workflow tool; superpowers skills
(TDD, systematic-debugging, verification-before-completion) for discipline; Python +
pytest for the demo target. Runs on the Claude subscription (no API key).

## Global Constraints
- All writes inside `/Users/hassiba/git/chatdev_harness`; **never** touch `/Users/hassiba/git/chatdev`.
- Demo app lives in `./demo`, separate from harness config.
- Reviewer agent is **genuinely read-only** (frontmatter `tools: Read, Glob, Grep` — no Write/Edit/Bash). HARD requirement.
- No `ANTHROPIC_API_KEY`; interactive-first; subscription auth.
- Commit every increment; never `git reset --hard` / force-push / `rm -rf` outside `./demo`.

---

## Design decisions & rationale

**Roles → 4 subagents (drop the chit-chat).** ChatDev's 9 roles include CEO/CPO/CTO whose
DemandAnalysis/LanguageChoose phases are pure dialogue. We keep the roles that *do work*:
spec-architect (folds demand+architecture into one decisive spec), programmer, reviewer,
tester. Tool scoping (verified against Claude Code 2.1.193 agent frontmatter):

| Agent | `tools:` | Why |
|---|---|---|
| `spec-architect` | `Read, Glob, Grep` | Read-only; produces a spec as returned text. |
| `programmer` | `Read, Write, Edit, Bash, Glob, Grep` | The only writer/runner; does TDD. |
| `reviewer` | `Read, Glob, Grep` | **HARD: read-only.** Reports findings; never edits. |
| `tester` | `Read, Bash` | Runs `pytest`; **cannot edit → cannot fake a green.** |

Separation of duties is *enforced by the harness*, not just prompts — the reviewer
literally lacks Write/Edit/Bash; the tester literally cannot modify code.

**Orchestration → Workflow (not a trivial command).** The chain has real loops
(review→fix, test→debug with break conditions) — exactly ChatDev's `ComposedPhase` /
`break_cycle`. Deterministic JS control flow expresses this far better than LLM-narrated
phase transitions. A thin `/build-company` convenience command is optional.

**Memory → the filesystem + structured stage results.** ChatDev re-serializes code into
prompts (a blackboard `ChatEnv`). We let the real files in `./demo` be the shared state,
and pass schema-validated stage results (spec, findings, verdicts) between agents.

**Code to disk → real `Write`/`Edit`.** Eliminates ChatDev's brittle regex-from-prose
extraction. **Verification → real `pytest`** (TDD), not a 3-second `Traceback` grep.

**Workflow ↔ agents wiring.** Probe once whether the Workflow runtime resolves project
`agentType`. If yes → workflow dispatches the canonical `.claude/agents` (frontmatter
scoping enforced even in-workflow). If no → workflow embeds equivalent role briefs inline
(self-contained, robust). Either way the `.claude/agents` files are canonical + interactive-usable.

---

## File structure (what gets created)
- `.claude/agents/spec-architect.md` — spec/architecture role.
- `.claude/agents/programmer.md` — implementer (TDD).
- `.claude/agents/reviewer.md` — read-only reviewer.
- `.claude/agents/tester.md` — test runner.
- `.claude/workflows/chatdev-company.js` — the orchestration pipeline (the "company").
- `.claude/commands/build-company.md` — optional convenience driver.
- `CLAUDE.md` — company charter (roles, phase order, handoffs, stop signals, how to run).
- `demo/` — the built todo CLI + pytest suite (produced BY the company in Phase D).

---

## Tasks

### Task 1 — Author the 4 role subagents
Create the four `.claude/agents/*.md` with frontmatter tool scoping per the table above and
concise role briefs (responsibility, inputs, outputs, discipline: TDD for programmer,
read-only for reviewer, systematic-debugging for tester/programmer fix loop).
**Verify:** files parse (valid frontmatter); reviewer has no Write/Edit/Bash; tester has no Write/Edit.

### Task 2 — Author the Workflow orchestration
Create `.claude/workflows/chatdev-company.js` with `meta` + phases Spec / Build / Review / Test.
Stage schemas (SPEC, BUILD, REVIEW, TEST). Review→fix loop (break when no high-severity
finding, max 2). Test→debug loop (break when pytest exit 0, max 3). Default args = demo target.
**Verify:** script parses; a cheap probe confirms the agentType-vs-inline wiring decision.

### Task 3 — Author CLAUDE.md (company charter)
Roles + tool scoping, phase order, handoff conventions (what each stage consumes/produces),
stop signals (green = pytest exit 0; no-progress guards), how to run the company.
**Verify:** content matches the authored agents/workflow.

### Task 4 — Run the company on the demo target → green (Phase D)
Invoke the Workflow with the todo-CLI product prompt. The company writes `./demo` (todo
package: storage/core/CLI + pytest suite using tmp_path for isolation) and iterates to green.
**Verify (authoritative):** run `pytest` in `./demo` myself → exit 0.

### Task 5 — Self-review + finalize
`security-review` / `code-review` on the harness config to confirm reviewer is read-only.
Write `SUMMARY.md`, `HARNESS_DONE.md`; final commit; stop the loop.

---

## Demo target contract (fixes the green signal)
Python todo CLI in `./demo`:
- API (testable, injectable storage path): `add(text, path) -> id`, `list_todos(path) -> [items]`,
  `complete(id, path) -> bool`; items persisted as JSON `[{"id","text","done"}]`.
- CLI: `python -m todo add "<text>"`, `python -m todo list`, `python -m todo done <id>`
  (storage path via `TODO_FILE` env, default `todos.json`).
- `pytest` suite covers add/list/done + persistence + isolation via `tmp_path`.
- **Slice is green when `pytest` in `./demo` exits 0.**

## Verification & risks
- **Mechanics verified:** agent frontmatter/tool-scoping confirmed against 2.1.193. agentType-in-workflow probed in Task 2.
- **Reliability risk:** programmer writing both tests+code could write loose tests. Mitigation: spec-architect fixes the exact CLI/API contract + assertions, and tests use `tmp_path` for determinism.
- **No-thrash:** if pytest fails the same way 3× or NO_PROGRESS hits 3 → write `BLOCKED.md`, halt.
