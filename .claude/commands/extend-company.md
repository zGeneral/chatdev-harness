---
description: Extend an existing app with the ChatDev harness (Incremental mode) — add a feature to existing code, keeping the whole test suite green
argument-hint: <change request> — the feature/fix to add to the existing code in the target dir
---

Run the **chatdev-company** Workflow in **INCREMENTAL** mode (ChatDev's `incremental_develop`):
extend an EXISTING, tested codebase instead of building from scratch. The company reads the
existing code, writes new failing tests for the change (TDD), implements it, and iterates until
the **whole** suite (existing + new) is green — without breaking existing behavior.

Change request: $ARGUMENTS

Do this:
1. Identify the target dir holding the existing app (default `./demo`; infer or ask if ambiguous).
2. Ensure pytest is available (a repo-local `.venv`, or pass `args.pybin`).
3. Invoke the workflow with the incremental flag:
   `Workflow({ scriptPath: ".claude/workflows/chatdev-company.js", args: { incremental: true, change: "$ARGUMENTS", target: <dir> } })`
4. When it finishes, **independently** run `cd <target> && <pybin> -m pytest -q` and confirm the
   whole suite is green (exit 0).
5. Report: green/red, tests passing/total (note new vs. pre-existing), and files changed/added.

See `CLAUDE.md` → "Presets / modes" for how this maps onto ChatDev.
