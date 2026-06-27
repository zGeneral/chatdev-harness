"""Pure-logic pytest suite. Imports nothing from pygame."""
import sys
from random import Random

import logic
from logic import (
    Config, Fruit, GameState, Phase,
    aabb_overlap, move_basket, new_game, reset, spawn_fruit, step,
)


def test_no_pygame_imported():
    assert "pygame" not in sys.modules


def test_new_game_initial_state():
    cfg = Config()
    s = new_game(cfg, Random(1))
    assert s.phase is Phase.PLAYING
    assert s.score == 0
    assert s.fall_speed == cfg.fall_speed_start
    assert 0 <= s.basket_x <= cfg.width - cfg.basket_w
    # roughly centered
    assert abs(s.basket_x - (cfg.width - cfg.basket_w) / 2) < 1e-6


def test_basket_clamp_left():
    cfg = Config()
    s = new_game(cfg, Random(1))
    move_basket(s, -1, 100.0)  # huge step
    assert s.basket_x == 0


def test_basket_clamp_right():
    cfg = Config()
    s = new_game(cfg, Random(1))
    move_basket(s, 1, 100.0)
    assert s.basket_x == cfg.width - cfg.basket_w


def test_basket_moves_by_speed_times_dt():
    cfg = Config()
    s = new_game(cfg, Random(1))
    start = s.basket_x
    move_basket(s, 1, 0.1)
    assert abs(s.basket_x - (start + cfg.basket_speed * 0.1)) < 1e-9


def test_fruit_falls():
    cfg = Config()
    s = new_game(cfg, Random(1))
    # put basket away so no catch
    s.basket_x = 0
    s.fruit = Fruit(x=cfg.width - cfg.fruit_w, y=0.0)
    y0 = s.fruit.y
    fs = s.fall_speed
    step(s, 0, 0.1, Random(2))
    assert abs(s.fruit.y - (y0 + fs * 0.1)) < 1e-9


def test_catch_increments_score():
    cfg = Config()
    s = new_game(cfg, Random(1))
    s.basket_x = 100
    s.fruit = Fruit(x=110.0, y=float(cfg.basket_y - 10))
    r = step(s, 0, 0.0, Random(3))
    assert r.event == "catch"
    assert s.score == 1
    assert s.fruit.y == -cfg.fruit_h  # respawned above top


def test_catch_increases_fall_speed():
    cfg = Config()
    s = new_game(cfg, Random(1))
    s.basket_x = 100
    s.fruit = Fruit(x=110.0, y=float(cfg.basket_y - 10))
    before = s.fall_speed
    step(s, 0, 0.0, Random(3))
    assert abs(s.fall_speed - (before + cfg.fall_speed_step)) < 1e-9


def test_miss_ends_game():
    cfg = Config()
    s = new_game(cfg, Random(1))
    s.basket_x = 0
    s.fruit = Fruit(x=cfg.width - cfg.fruit_w, y=float(cfg.basket_y + cfg.basket_h + 1))
    r = step(s, 0, 0.0, Random(4))
    assert r.event == "miss"
    assert s.phase is Phase.GAME_OVER


def test_step_noop_after_game_over():
    cfg = Config()
    s = new_game(cfg, Random(1))
    s.phase = Phase.GAME_OVER
    bx, fy, sc = s.basket_x, s.fruit.y, s.score
    r = step(s, 1, 0.5, Random(5))
    assert r.event == "none"
    assert s.basket_x == bx and s.fruit.y == fy and s.score == sc


def test_reset_restores_playing():
    cfg = Config()
    s = new_game(cfg, Random(1))
    s.phase = Phase.GAME_OVER
    s.score = 9
    s.fall_speed = 500.0
    reset(s, Random(6))
    assert s.phase is Phase.PLAYING
    assert s.score == 0
    assert s.fall_speed == cfg.fall_speed_start


def test_spawn_within_bounds():
    cfg = Config()
    for seed in range(200):
        f = spawn_fruit(cfg, Random(seed))
        assert cfg.spawn_margin <= f.x <= cfg.width - cfg.fruit_w - cfg.spawn_margin
        assert f.y == -cfg.fruit_h


def test_determinism():
    cfg = Config()
    a = [spawn_fruit(cfg, Random(42)).x for _ in range(1)]
    # same seed -> identical sequence
    r1, r2 = Random(42), Random(42)
    seq1 = [spawn_fruit(cfg, r1).x for _ in range(10)]
    seq2 = [spawn_fruit(cfg, r2).x for _ in range(10)]
    assert seq1 == seq2


def test_aabb_overlap_edges():
    # touching edges -> overlap
    assert aabb_overlap(0, 0, 10, 10, 10, 0, 5, 5)
    # contained
    assert aabb_overlap(0, 0, 10, 10, 2, 2, 3, 3)
    # disjoint
    assert not aabb_overlap(0, 0, 10, 10, 100, 100, 5, 5)


def test_fall_speed_cap():
    cfg = Config()
    s = new_game(cfg, Random(1))
    for _ in range(1000):
        s.basket_x = 100
        s.fruit = Fruit(x=110.0, y=float(cfg.basket_y - 10))
        s.phase = Phase.PLAYING
        step(s, 0, 0.0, Random(7))
    assert s.fall_speed <= cfg.fall_speed_max
    assert s.fall_speed == cfg.fall_speed_max
