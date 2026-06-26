---
description: Build a real Pygame game with the ChatDev game factory (ChatDev 2.0 GameDev port) — tested logic + a headless launch that runs clean
argument-hint: [game idea] — optional; defaults to a falling-rocks dodge game
---

Launch the **chatdev-gamedev** Workflow to turn a game idea into a real, runnable **Pygame** game
via the game-factory pipeline: **GDD → core (Phase 1) → polish (Phase 2) → QA → run** (a port of
ChatDev 2.0's `GameDev_with_manager.yaml`).

Game idea (may be empty → falling-rocks dodge game): $ARGUMENTS

Do this:
1. Ensure pygame is available: `.venv/bin/pip install pygame-ce` (or pass `args.pybin` to a python that has it).
2. Pick a target dir (default `./game`, or a fresh dir for a new game). Pass as `args.target`.
3. Invoke:
   `Workflow({ scriptPath: ".claude/workflows/chatdev-gamedev.js", args: { prompt: "$ARGUMENTS", target: <dir> } })`
4. When done, **independently verify** both gates:
   - logic: `cd <target> && <pybin> -m pytest -q` → exit 0
   - headless launch: `cd <target> && SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy GAME_SMOKE_FRAMES=180 <pybin> game.py; echo $?` → 0
5. To actually **play** it (with a window): `cd <target> && <pybin> game.py`.
6. Report: green/red, logic tests passing/total, the headless smoke result, files, and how to play.

Green = logic `pytest` exit 0 **AND** the headless launch runs clean (exit 0). The game's pure logic
lives in `logic.py` (pygame-free, pytest-tested); `game.py` is the Pygame shell with a headless smoke mode.
