# HARNESS DONE ✅

The ChatDev → Claude Code harness is complete and verified. All Definition-of-DONE
conditions are met (see `PROGRESS.md`).

## Evidence
- **Understanding:** `CHATDEV_UNDERSTANDING.md` ends with the concept→harness mapping table.
- **Harness authored:** `.claude/agents/{spec-architect,programmer,reviewer,tester}.md`
  (tool-scoped), `.claude/workflows/chatdev-company.js` (spec → build(TDD) → review→fix →
  test→debug, with break conditions + no-thrash guard), `CLAUDE.md` charter, `/build-company`.
- **Vertical slice GREEN:** the company built `./demo` (Python todo CLI). Independently
  re-verified by the orchestrator: `pytest` → **10 passed, exit 0**; CLI `add`/`list`/`done`
  + missing-id error (exit 1) + JSON persistence all work end-to-end.
- **Read-only reviewer (hard requirement) = PASS:** programmatic frontmatter check confirms
  `reviewer` has only `Read, Glob, Grep` (no Write/Edit/Bash); independent `feature-dev:code-reviewer`
  self-review agreed and flagged a doc overstatement, which was fixed — the workflow now also
  enforces a genuinely read-only reviewer via `feature-dev:code-reviewer` (probe-confirmed to resolve).
- **Committed:** all work on branch `harness-build`; `SUMMARY.md` written.

## The point
ChatDev's agents emit code as text (regex-scraped to files) and "test" by running a program
for 3 seconds and grepping for `Traceback`. This harness's agents have **real tools**: they
write real files, run real commands, and pass a **real `pytest` suite** (exit 0 = done). Same
good idea — role-paired phases, review/test loops, an evolving shared codebase — with real execution.

## Run it
`Workflow({ scriptPath: ".claude/workflows/chatdev-company.js", args: { prompt: "<spec>", target: "./demo" } })`
(or `/build-company`). No args → rebuilds the demo. See `SUMMARY.md` to widen it.

Loop stopped; build halted.
