"""TANDEM — pure rules engine. NO pygame import.

Coordinates are (row, col) integer tuples. Origin top-left; row increases
downward, col increases rightward. Facing is NOT stored on the board.

FROZEN RULES:
  * Pulse resolution order is FIXED: carriage A then carriage B, on the same
    evolving working state.
  * A carriage shoves the contiguous straight line of blocks ahead of it,
    moving every block by exactly one cell, iff the cell just beyond the line
    is in-bounds AND empty.
  * Each logical block moves at most ONCE per pulse (single-move guard).
  * `locked` dominance: a carriage that was already shoved this pulse does not
    initiate its own advance.
  * Win = orthogonal edge adjacency (Manhattan distance exactly 1).
"""
from __future__ import annotations

import itertools
from collections import deque
from dataclasses import dataclass
from typing import Optional

DELTAS = {'U': (-1, 0), 'D': (1, 0), 'L': (0, -1), 'R': (0, 1)}
FACINGS = ('U', 'D', 'L', 'R')


@dataclass(frozen=True)
class Board:
    rows: int                                  # 1..5
    cols: int                                  # 1..6
    a: tuple                                    # carriage A position (row, col)
    b: tuple                                    # carriage B position (row, col)
    obstacles: frozenset = frozenset()          # zero or more obstacle cells

    def __post_init__(self):
        self.validate()

    def validate(self):
        assert 1 <= self.rows <= 5, "rows must be 1..5"
        assert 1 <= self.cols <= 6, "cols must be 1..6"
        for pos in (self.a, self.b, *self.obstacles):
            r, c = pos
            assert 0 <= r < self.rows and 0 <= c < self.cols, \
                f"position {pos} out of bounds"
        assert self.a != self.b, "carriages must occupy distinct cells"
        assert self.a not in self.obstacles, "A overlaps an obstacle"
        assert self.b not in self.obstacles, "B overlaps an obstacle"


def in_bounds(board: Board, pos) -> bool:
    r, c = pos
    return 0 <= r < board.rows and 0 <= c < board.cols


def occupied(board: Board) -> dict:
    """Rebuild occupancy {pos: kind} where kind in {'A','B','O'}."""
    occ = {board.a: 'A', board.b: 'B'}
    for o in board.obstacles:
        occ[o] = 'O'
    return occ


class _State:
    """Mutable working copy for one pulse."""

    def __init__(self, board: Board):
        self.rows = board.rows
        self.cols = board.cols
        self.a = board.a
        self.b = board.b
        self.obstacles = set(board.obstacles)
        # occ maps pos -> kind
        self.occ = occupied(board)

    def in_bounds(self, pos) -> bool:
        r, c = pos
        return 0 <= r < self.rows and 0 <= c < self.cols


def _add(p, d):
    return (p[0] + d[0], p[1] + d[1])


def _advance(state: _State, carriage_id: str, facing: str, moved: set) -> None:
    """Resolve a single carriage on the evolving working state.

    `moved` holds block identities ('A', 'B', or obstacle positions captured
    at the START of this pulse... but obstacle identity follows the block).
    We track identity by a stable token per block.
    """
    start = state.a if carriage_id == 'A' else state.b

    # 1. Locked-initiator guard.
    if carriage_id in moved:
        return

    d = DELTAS[facing]

    # 3. Scan contiguous straight line of blocks directly ahead.
    line = [start]
    while True:
        nxt = _add(line[-1], d)
        if state.in_bounds(nxt) and nxt in state.occ:
            line.append(nxt)
        else:
            break

    # 4. beyond cell.
    beyond = _add(line[-1], d)

    # 5. Move iff beyond in-bounds AND empty.
    if not state.in_bounds(beyond) or beyond in state.occ:
        return  # STALL

    # 6. Single-move guard: if any block in line already moved -> STALL.
    line_ids = [state.occ[p] for p in line]
    if any(bid in moved for bid in line_ids):
        return

    # 7. Apply shove, far end backward.
    for p in reversed(line):
        bid = state.occ[p]
        np = _add(p, d)
        del state.occ[p]
        state.occ[np] = bid
        if bid == 'A':
            state.a = np
        elif bid == 'B':
            state.b = np
        else:  # obstacle block; bid is its identity token
            state.obstacles.discard(p)
            state.obstacles.add(np)
        moved.add(bid)


def pulse(board: Board, fA: str, fB: str) -> Board:
    """Pure. Returns a NEW Board. Deterministic. Never mutates input."""
    if fA not in FACINGS:
        raise ValueError(f"invalid facing fA={fA!r}")
    if fB not in FACINGS:
        raise ValueError(f"invalid facing fB={fB!r}")

    state = _State(board)
    # Give each obstacle a stable identity token in occ so identity follows
    # the block. We use the obstacle's CURRENT position as its kind token only
    # for moved-tracking; but since positions change, we instead use unique
    # per-obstacle ids.
    # Reassign occ with stable obstacle identities.
    occ = {state.a: 'A', state.b: 'B'}
    obs_pos = {}
    for i, o in enumerate(sorted(board.obstacles)):
        token = f'O{i}'
        occ[o] = token
        obs_pos[token] = o
    state.occ = occ
    state.obstacles = set(board.obstacles)

    moved = set()
    _advance(state, 'A', fA, moved)
    _advance(state, 'B', fB, moved)

    return Board(board.rows, board.cols, state.a, state.b,
                 frozenset(state.obstacles))


def is_win(board: Board) -> bool:
    return abs(board.a[0] - board.b[0]) + abs(board.a[1] - board.b[1]) == 1


def _key(board: Board):
    return (board.a, board.b, board.obstacles)


def solve_bfs(board: Board, max_nodes: int) -> Optional[int]:
    """Unweighted BFS over the <=16 facing-pairs. Returns minimum number of
    pulses to a win, or None (unsolvable within budget / node cap exceeded)."""
    if is_win(board):
        return 0

    start_key = _key(board)
    visited = {start_key}
    queue = deque([(board, 0)])
    nodes = 1  # count seeded visited insertion

    while queue:
        cur, depth = queue.popleft()
        for fA, fB in itertools.product(FACINGS, FACINGS):
            succ = pulse(cur, fA, fB)
            if is_win(succ):
                return depth + 1
            k = _key(succ)
            if k not in visited:
                if nodes >= max_nodes:
                    return None
                visited.add(k)
                nodes += 1
                queue.append((succ, depth + 1))
    return None
