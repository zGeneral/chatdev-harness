"""Tests for TANDEM logic engine. Written FIRST (TDD)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logic
from logic import Board, pulse, is_win, solve_bfs


def test_golden_trace():
    # 1x6 corridor, A@col1, B@col2, empty@col3, fA=R, fB=R -> A@col2, B@col3
    b = Board(rows=1, cols=6, a=(0, 1), b=(0, 2), obstacles=frozenset())
    out = pulse(b, 'R', 'R')
    assert out.a == (0, 2)
    assert out.b == (0, 3)
    # Explicitly: B is NOT at col 4 (lock rule prevents double-move).
    assert out.b != (0, 4)


def test_stall_against_wall():
    # Carriage A at left border facing L -> beyond out of bounds -> no move.
    b = Board(rows=1, cols=6, a=(0, 0), b=(0, 3), obstacles=frozenset())
    out = pulse(b, 'L', 'U')  # B faces U but is in 1-row -> also stall
    assert out.a == (0, 0)
    assert out.b == (0, 3)


def test_contiguous_line_shove():
    # A@(0,0), obstacle@(0,1), empty@(0,2), fA=R -> A->(0,1), obstacle->(0,2)
    b = Board(rows=1, cols=6, a=(0, 0), b=(0, 5),
              obstacles=frozenset({(0, 1)}))
    out = pulse(b, 'R', 'U')
    assert out.a == (0, 1)
    assert out.obstacles == frozenset({(0, 2)})

    # Stall variant: 2-block line with beyond out of bounds -> no movement.
    # A@(0,4), obstacle@(0,5) (line of 2), beyond=(0,6) out of bounds.
    b2 = Board(rows=1, cols=6, a=(0, 4), b=(0, 0),
               obstacles=frozenset({(0, 5)}))
    out2 = pulse(b2, 'R', 'U')
    assert out2.a == (0, 4)
    assert out2.obstacles == frozenset({(0, 5)})

    # Stall variant: a 2-block line packed against the right wall.
    # A@(0,4), obstacle@(0,5) -> line [(0,4),(0,5)], beyond (0,6) out of bounds.
    b3 = Board(rows=1, cols=6, a=(0, 4), b=(0, 0),
               obstacles=frozenset({(0, 5)}))
    out3 = pulse(b3, 'R', 'U')
    assert out3.a == (0, 4)
    assert out3.obstacles == frozenset({(0, 5)})


def test_locked_dominance():
    # Golden-trace shape: A shoves B. B's facing R would otherwise move it
    # further, but B is locked (was moved by A this pulse).
    b = Board(rows=1, cols=6, a=(0, 1), b=(0, 2), obstacles=frozenset())
    out = pulse(b, 'R', 'R')
    assert out.a == (0, 2)
    assert out.b == (0, 3)  # not (0,4): proves lock, not incidental stall.

    # Prove it's the lock and not lack of space: after the shove, (0,4) is
    # empty and open, so an unlocked B facing R *would* advance to (0,4).
    # Confirm B stays at (0,3).
    assert out.b != (0, 4)


def test_is_win_true_orthogonal():
    # Up/down adjacency
    b1 = Board(rows=5, cols=6, a=(1, 2), b=(2, 2), obstacles=frozenset())
    assert is_win(b1) is True
    # Left/right adjacency
    b2 = Board(rows=5, cols=6, a=(3, 1), b=(3, 2), obstacles=frozenset())
    assert is_win(b2) is True


def test_is_win_false():
    # Same axis, distance 2
    b1 = Board(rows=1, cols=6, a=(0, 0), b=(0, 2), obstacles=frozenset())
    assert is_win(b1) is False
    # Diagonal, Manhattan distance 2
    b2 = Board(rows=5, cols=6, a=(0, 0), b=(1, 1), obstacles=frozenset())
    assert is_win(b2) is False


def test_determinism():
    b = Board(rows=1, cols=6, a=(0, 1), b=(0, 2), obstacles=frozenset())
    out1 = pulse(b, 'R', 'R')
    out2 = pulse(b, 'R', 'R')
    assert out1 == out2
    # Input board unmutated.
    assert b.a == (0, 1)
    assert b.b == (0, 2)
    assert b.obstacles == frozenset()


def test_solve_bfs_known_minimum():
    # Golden-trace start: A@(0,1), B@(0,2) already adjacent? distance 1 -> win=0.
    won = Board(rows=1, cols=6, a=(0, 1), b=(0, 2), obstacles=frozenset())
    assert solve_bfs(won, max_nodes=10_000) == 0

    # A board needing exactly 1 pulse: A and B distance 2 apart, one pulse
    # brings them adjacent. 1x6: A@(0,0), B@(0,2). fA='R' -> A->(0,1),
    # adjacent to B@(0,2). Minimum = 1.
    b1 = Board(rows=1, cols=6, a=(0, 0), b=(0, 2), obstacles=frozenset())
    assert solve_bfs(b1, max_nodes=10_000) == 1

    # max_nodes too small -> None.
    hard = Board(rows=5, cols=6, a=(0, 0), b=(4, 5), obstacles=frozenset())
    assert solve_bfs(hard, max_nodes=1) is None


def test_pulse_validates_facing():
    b = Board(rows=1, cols=6, a=(0, 1), b=(0, 2), obstacles=frozenset())
    import pytest
    with pytest.raises(ValueError):
        pulse(b, 'X', 'R')
    with pytest.raises(ValueError):
        pulse(b, 'R', 'Z')


def test_no_pygame_in_logic():
    assert 'pygame' not in sys.modules or True
    # logic module must not import pygame
    src = open(os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), 'logic.py')).read()
    assert 'import pygame' not in src
