---
description: Run the virtual software company (ChatDev harness) to build & test an app from a product prompt
argument-hint: [product prompt] — optional; defaults to the demo todo CLI in ./demo
---

Launch the **`chatdev-company`** Workflow to turn a product prompt into working, tested
software via the role pipeline: **spec → build (TDD) → review→fix → test→debug**, with real
subagents writing real files and passing a real `pytest` suite.

Product prompt (may be empty): $ARGUMENTS

Do this:
1. If a product prompt was provided above, pass it as `args.prompt`. If it is empty, omit
   `args` entirely to build the **default demo target** (a Python todo CLI in `./demo`).
2. Pick the target dir: `./demo` for the demo, or a fresh subdir (e.g. `./<appname>`) for a
   new product. Pass it as `args.target`.
3. Invoke the workflow:
   `Workflow({ name: "chatdev-company", args: { prompt: <prompt or omit>, target: <dir> } })`
4. When it finishes, **independently verify** the authoritative green: run
   `cd <target> && python -m pytest -q` yourself and read the real exit code.
5. Report: green/red, tests passing/total, files written, and where the app lives.

The slice is "done" when `pytest` in the target dir exits 0. See `CLAUDE.md` for the full
company charter and `CHATDEV_UNDERSTANDING.md` for how this maps onto ChatDev.
