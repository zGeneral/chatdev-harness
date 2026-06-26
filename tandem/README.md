# Tandem

A deterministic Klotski-variant puzzle, built by the **ChatDev harness** on the `tandem` branch,
its design **grounded** by two game-design books (Adams, *Fundamentals of Puzzle and Casual Game
Design*; Moore, *Basics of Game Design*) retrieved from a personal-rag `game-design` notebook.

Source idea: `oracleforge/ideas/novel/IDEA_Tandemv2.md`.

## The verb
You never pick a block to slide. You press one global **PULSE** that advances **both** facing-locked
carriages one cell along their current facing at once — each shoving the rigid line of blocks ahead
of it, or stalling against a wall. You win by making the two carriages meet **edge-to-edge**.
"Aim both, then pulse" — not "escort one".

## Frozen rules (implemented exactly; see the golden-trace test)
- A bounded grid of rigid 1×1 blocks: two **carriages** (A, B), obstacles, and empty cells.
- A **PULSE(fA, fB)** resolves in fixed order (A then B): each carriage advances one cell along its
  facing, shoving the contiguous line ahead iff the cell beyond is in-bounds **and** empty, else it
  **stalls**. Every block moves ≤ 1 cell per pulse, and `locked` dominates (a block shoved during A's
  resolution — including carriage B — does not then initiate its own advance).
- **Win** = the two carriages are orthogonally **edge-adjacent** (Manhattan distance 1).

## Files
- `logic.py` — pure engine (no pygame): `Board`, `pulse(board, fA, fB)`, `is_win(board)`,
  `solve_bfs(board, max_nodes)` (BFS over the ≤16 facing-pairs → minimum pulse count).
- `game.py` — Pygame shell: renders the grid/carriages/facings, set-facing + pulse, R restart,
  clean quit, 60 FPS. Headless smoke mode via `GAME_SMOKE_FRAMES`.
- `tests/test_logic.py` — 10 tests incl. the **golden trace**, locked-dominance, stall, shove,
  win predicate (orthogonal only), determinism, and BFS minimum-pulse counts.

## Run
```bash
# tests (from the repo venv)
cd tandem && ../.venv/bin/python -m pytest -q          # 10 passed

# play it
cd tandem && ../.venv/bin/python game.py

# headless smoke (no display)
cd tandem && SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy GAME_SMOKE_FRAMES=180 ../.venv/bin/python game.py
```
