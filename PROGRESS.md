# PROGRESS — ChatDev → Claude Code harness

ITERATION: 3
NO_PROGRESS: 0
PHASE: C (Build)

## Phase checklist
- [x] **A — Understand.** Explored ChatDev (`chatdev1.0` branch). Mapped roles, 8-phase chat
      chain, two-agent `<INFO>` dialogue, `ChatEnv` blackboard memory, regex code extraction,
      and the crude 3-sec `python3 main.py` "test". `CHATDEV_UNDERSTANDING.md` written with the
      concept→harness mapping table. Key gap: agents have no tools; "testing" greps for Traceback.
- [x] **B — Design.** Verified Claude Code 2.1.193 agent frontmatter/tool-scoping. Wrote
      `BUILD_PLAN.md`: 4 tool-scoped agents + Workflow pipeline + CLAUDE.md, demo contract,
      task order, risks. Rationale recorded; self-reviewed; no pause.
- [ ] **C — Build.** Author `.claude/agents/*.md` (spec-architect, programmer, reviewer, tester),
      the Workflow orchestration, `CLAUDE.md`, optional driver command.
- [ ] **D — Run until green.** Drive the company on the demo target → `./demo` todo CLI →
      `pytest` exits 0. Self-review tool scoping (read-only reviewer). Finalize.

## Definition of DONE (all true)
- [ ] `CHATDEV_UNDERSTANDING.md` ends with concept→harness mapping table.
- [ ] Harness authored: 4 role agents + Workflow orchestration + `CLAUDE.md`.
- [ ] Vertical slice green: company built `./demo`, `pytest` exits 0.
- [ ] Self-review confirms reviewer agent is genuinely read-only (no Write/Edit/Bash).
- [ ] Everything committed; `SUMMARY.md` written.
- [ ] `HARNESS_DONE.md` written; loop cancelled.

## Log
- iter 1: git init + branch `harness-build`; wrote PROGRESS.md. Next: Phase A exploration.
- iter 2: Phase A complete — CHATDEV_UNDERSTANDING.md (concept→harness map). Next: Phase B design plan.
- iter 3: Phase B complete — BUILD_PLAN.md + mechanics verified. Next: Phase C author agents/workflow/CLAUDE.md.
