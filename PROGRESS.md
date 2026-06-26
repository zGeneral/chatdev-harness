# PROGRESS — ChatDev → Claude Code harness

ITERATION: 1
NO_PROGRESS: 0
PHASE: A (Understand)

## Phase checklist
- [ ] **A — Understand.** Explore `/Users/hassiba/git/chatdev`; map roles, phase/chat-chain
      mechanics, iteration/termination, memory model; confirm code-as-text with no real
      execution loop. Reconcile with Wu et al. **Exit:** `CHATDEV_UNDERSTANDING.md` ending
      with concept→harness mapping table.
- [ ] **B — Design.** brainstorming + writing-plans → `BUILD_PLAN.md` (record rationale, no pause).
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
