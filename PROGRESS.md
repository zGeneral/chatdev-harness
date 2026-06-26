# PROGRESS — ChatDev → Claude Code harness

ITERATION: 7
NO_PROGRESS: 0
PHASE: DONE ✅

## Phase checklist
- [x] **A — Understand.** Explored ChatDev (`chatdev1.0` branch). Mapped roles, 8-phase chat
      chain, two-agent `<INFO>` dialogue, `ChatEnv` blackboard memory, regex code extraction,
      and the crude 3-sec `python3 main.py` "test". `CHATDEV_UNDERSTANDING.md` written with the
      concept→harness mapping table. Key gap: agents have no tools; "testing" greps for Traceback.
- [x] **B — Design.** Verified Claude Code 2.1.193 agent frontmatter/tool-scoping. Wrote
      `BUILD_PLAN.md`: 4 tool-scoped agents + Workflow pipeline + CLAUDE.md, demo contract,
      task order, risks. Rationale recorded; self-reviewed; no pause.
- [x] **C — Build.** Authored 4 tool-scoped agents (`.claude/agents/`), the Workflow
      (`.claude/workflows/chatdev-company.js`, syntax-checked, review→fix + test→debug loops +
      no-thrash guard), `CLAUDE.md` (company charter), and `/build-company` driver command.
      Probed: Workflow runtime does NOT resolve project agentType → workflow embeds role briefs inline.
- [x] **D — Run until green.** Company workflow `wf_b06fdf3d-000` built `./demo` todo CLI;
      independently verified `pytest` 10/10 exit 0 + CLI smoke test. Self-review (programmatic
      tool-scoping + code-reviewer agent) confirmed reviewer read-only; fixed doc overstatement
      and enforced read-only reviewer in-workflow via `feature-dev:code-reviewer` (probe-confirmed).

## Definition of DONE (all true)
- [x] `CHATDEV_UNDERSTANDING.md` ends with concept→harness mapping table.
- [x] Harness authored: 4 role agents + Workflow orchestration + `CLAUDE.md` (+ driver command).
- [x] Vertical slice green: company built `./demo`, `pytest` exits 0 (independently re-verified: 10/10).
- [x] Self-review confirms reviewer agent is genuinely read-only (no Write/Edit/Bash) — PASS.
- [x] Everything committed; `SUMMARY.md` written.
- [x] `HARNESS_DONE.md` written; loop cancelled.

## Log
- iter 1: git init + branch `harness-build`; wrote PROGRESS.md. Next: Phase A exploration.
- iter 2: Phase A complete — CHATDEV_UNDERSTANDING.md (concept→harness map). Next: Phase B design plan.
- iter 3: Phase B complete — BUILD_PLAN.md + mechanics verified. Next: Phase C author agents/workflow/CLAUDE.md.
- iter 4: Phase C complete — agents + workflow + CLAUDE.md + driver command. Next: Phase D run company → pytest green.
- iter5: env (venv+pytest) + doc fixes. Phase D company run wf_b06fdf3d-000 launched (builds ./demo).
- iter6: Phase D — company built ./demo; INDEPENDENTLY verified pytest 10/10 exit 0 + CLI smoke test. Demo committed.
- iter7: self-review — tool scoping verified (reviewer read-only PASS); enforced read-only reviewer in-workflow
        (feature-dev:code-reviewer, probe-confirmed); honest doc fixes. SUMMARY.md + finalize. **HARNESS DONE.**
