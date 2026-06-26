---
description: Build an app with a human in the loop (ChatDev "Human-Agent-Interaction") — you review the code and give feedback before the final test gate
argument-hint: [product prompt] — what to build (optional; defaults to the demo todo CLI)
---

Run the virtual software company with a **Human-Agent-Interaction** review loop (ChatDev's Human
preset: a `CodeReviewHuman` loop, ≤5 rounds, inserted after the automated review and before the
test phase). Unlike the autonomous `/build-company`, this **pauses for the human's review** and
applies their feedback before declaring the slice done.

Product prompt (may be empty → demo todo CLI): $ARGUMENTS

**Drive this pipeline yourself — do NOT use the background Workflow** (it can't pause for human
turns). Dispatch the project role subagents via the **Agent tool** by their type names
(`spec-architect`, `programmer`, `reviewer`, `tester`) so their tool scoping is enforced — the
reviewer is genuinely read-only, the tester cannot edit.

Steps:
1. **Target & env.** Pick the target dir (default `./demo`, or a fresh dir for a new product) and
   ensure pytest is available (`python3 -m venv .venv && .venv/bin/pip install pytest`).
2. **Spec.** Dispatch `spec-architect` with the product prompt → the build spec.
3. **Build (TDD).** Dispatch `programmer` with the spec → it writes tests first, implements, and
   iterates `pytest` to green in the target dir.
4. **Automated review → fix (≤2).** Dispatch `reviewer` (read-only); if it returns high/medium
   findings, dispatch `programmer` to apply them and keep tests green. Repeat ≤2×.
5. **HUMAN review loop (≤5 rounds) — the point of this mode.** Each round:
   a. Summarize for the human what exists: the files, how to run it, the current `pytest` result;
      run the app once to show real behavior if useful.
   b. Use **AskUserQuestion** (header e.g. "Review") with options like *Approve as-is* /
      *Request changes* / *Stop here*. Capture any natural-language change requests.
   c. Approve or Stop → exit the loop. Request changes → dispatch `programmer` to apply EXACTLY the
      human's feedback, re-run `pytest` to stay green, then start the next round.
6. **Test (authoritative green).** Dispatch `tester` to run `pytest` and report the real exit code,
   then independently run `pytest` yourself to confirm exit 0.
7. **Report.** Green/red, tests passing/total, files, where the app lives, and a one-line summary of
   the human-requested changes applied.

Honor the human's feedback literally; don't gold-plate beyond it. In this mode the **human is the
reviewer** — their approval, plus a green `pytest`, is the definition of done.
