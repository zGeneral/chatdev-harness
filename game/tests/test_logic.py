import math
import os
import random
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logic


# ---------------------------------------------------------------------------
# Constants sanity
# ---------------------------------------------------------------------------
def test_constants_present():
    assert logic.SCREEN_W == 480
    assert logic.SCREEN_H == 720
    assert logic.SHIP_W == 40
    assert logic.SHIP_H == 26
    assert logic.SHIP_SPEED == 360
    assert logic.BASE_FALL == 180
    assert logic.FALL_RAMP == 14
    assert logic.MAX_FALL == 620
    assert logic.BASE_INTERVAL == 0.85
    assert logic.INTERVAL_RAMP == 0.018
    assert logic.MIN_INTERVAL == 0.22
    assert logic.SCORE_RATE == 10


# ---------------------------------------------------------------------------
# aabb_overlap
# ---------------------------------------------------------------------------
def test_aabb_overlap_true():
    assert logic.aabb_overlap(0, 0, 10, 10, 5, 5, 10, 10) is True


def test_aabb_overlap_false_separated():
    assert logic.aabb_overlap(0, 0, 10, 10, 20, 20, 10, 10) is False


def test_aabb_overlap_edge_touch_is_false():
    # touching exactly at an edge does not overlap
    assert logic.aabb_overlap(0, 0, 10, 10, 10, 0, 10, 10) is False


# ---------------------------------------------------------------------------
# new_game
# ---------------------------------------------------------------------------
def test_new_game_defaults():
    s = logic.new_game()
    assert s.state == "PLAYING"
    assert s.t == 0
    assert s.score == 0
    assert s.rocks_dodged == 0
    assert s.rocks == []
    assert s.spawn_timer == 0
    assert s.ship_x == (logic.SCREEN_W - logic.SHIP_W) / 2
    assert s.high_score == 0


def test_new_game_preserves_high_score():
    s = logic.new_game(high_score=42)
    assert s.high_score == 42


# ---------------------------------------------------------------------------
# rock_speed
# ---------------------------------------------------------------------------
def test_rock_speed_base():
    assert logic.rock_speed(0) == 180


def test_rock_speed_ramp():
    assert logic.rock_speed(10) == 180 + 14 * 10


def test_rock_speed_cap():
    assert logic.rock_speed(10_000) == logic.MAX_FALL


# ---------------------------------------------------------------------------
# spawn_interval
# ---------------------------------------------------------------------------
def test_spawn_interval_base():
    assert logic.spawn_interval(0) == pytest.approx(0.85)


def test_spawn_interval_ramp():
    assert logic.spawn_interval(10) == pytest.approx(0.85 - 0.018 * 10)


def test_spawn_interval_floor():
    assert logic.spawn_interval(10_000) == logic.MIN_INTERVAL


# ---------------------------------------------------------------------------
# compute_score
# ---------------------------------------------------------------------------
def test_compute_score():
    assert logic.compute_score(0) == 0
    assert logic.compute_score(1.5) == 15
    assert logic.compute_score(3.99) == 39


# ---------------------------------------------------------------------------
# move_ship + clamping
# ---------------------------------------------------------------------------
def test_move_ship_right():
    s = logic.new_game()
    x0 = s.ship_x
    logic.move_ship(s, 1, 0.5)
    assert s.ship_x == pytest.approx(x0 + logic.SHIP_SPEED * 0.5)


def test_move_ship_left():
    s = logic.new_game()
    x0 = s.ship_x
    logic.move_ship(s, -1, 0.5)
    assert s.ship_x == pytest.approx(x0 - logic.SHIP_SPEED * 0.5)


def test_move_ship_clamp_left_edge():
    s = logic.new_game()
    logic.move_ship(s, -1, 100)  # huge dt
    assert s.ship_x == 0


def test_move_ship_clamp_right_edge():
    s = logic.new_game()
    logic.move_ship(s, 1, 100)  # huge dt
    assert s.ship_x == logic.SCREEN_W - logic.SHIP_W


def test_move_ship_zero_direction():
    s = logic.new_game()
    x0 = s.ship_x
    logic.move_ship(s, 0, 0.5)
    assert s.ship_x == x0


# ---------------------------------------------------------------------------
# spawn_rock
# ---------------------------------------------------------------------------
def test_spawn_rock_adds_in_bounds():
    rng = random.Random(123)
    s = logic.new_game(rng=rng)
    logic.spawn_rock(s)
    assert len(s.rocks) == 1
    r = s.rocks[0]
    assert 0 <= r.x <= logic.SCREEN_W - r.w
    assert r.y == -r.h
    assert r.speed == logic.rock_speed(s.t)


def test_spawn_rock_deterministic_with_seed():
    s1 = logic.new_game(rng=random.Random(7))
    s2 = logic.new_game(rng=random.Random(7))
    logic.spawn_rock(s1)
    logic.spawn_rock(s2)
    assert s1.rocks[0].x == s2.rocks[0].x
    assert s1.rocks[0].w == s2.rocks[0].w


# ---------------------------------------------------------------------------
# update — time / score
# ---------------------------------------------------------------------------
def test_update_advances_time_and_score():
    s = logic.new_game(rng=random.Random(1))
    logic.update(s, 0, 1.0)
    assert s.t == pytest.approx(1.0)
    assert s.score == 10


def test_update_score_monotonic():
    s = logic.new_game(rng=random.Random(1))
    prev = 0
    for _ in range(120):
        logic.update(s, 0, 1 / 60)
        assert s.score >= prev
        prev = s.score


def test_update_spawns_rocks_over_time():
    s = logic.new_game(rng=random.Random(2))
    for _ in range(180):  # 3 seconds at 60fps
        logic.update(s, 0, 1 / 60)
    # at base interval ~0.85s, 3s should have produced several rocks (some culled)
    assert s.rocks_dodged + len(s.rocks) >= 2


def test_update_rocks_move_down():
    s = logic.new_game(rng=random.Random(3))
    logic.spawn_rock(s)
    y0 = s.rocks[0].y
    logic.update(s, 0, 0.1)
    assert s.rocks[0].y > y0


def test_update_culls_offscreen_increments_dodged():
    s = logic.new_game(rng=random.Random(4))
    logic.spawn_rock(s)
    # place rock near bottom, far from ship horizontally
    original = s.rocks[0]
    original.x = 0
    original.y = logic.SCREEN_H - 1
    s.ship_x = logic.SCREEN_W - logic.SHIP_W  # far right, avoid collision
    logic.update(s, 0, 0.1)  # small dt so no new spawn
    assert s.rocks_dodged == 1
    assert original not in s.rocks


# ---------------------------------------------------------------------------
# collision / death
# ---------------------------------------------------------------------------
def test_check_collision_true():
    s = logic.new_game(rng=random.Random(5))
    logic.spawn_rock(s)
    r = s.rocks[0]
    r.x = s.ship_x
    r.y = s.ship_y
    assert logic.check_collision(s) is True


def test_check_collision_false():
    s = logic.new_game(rng=random.Random(5))
    logic.spawn_rock(s)
    r = s.rocks[0]
    r.x = 0
    r.y = -100
    s.ship_x = logic.SCREEN_W - logic.SHIP_W
    assert logic.check_collision(s) is False


def test_update_collision_triggers_game_over():
    s = logic.new_game(rng=random.Random(6))
    logic.spawn_rock(s)
    r = s.rocks[0]
    r.x = s.ship_x
    r.y = s.ship_y - r.h + 1  # overlapping after no movement
    logic.update(s, 0, 0.001)
    assert s.state == "GAME_OVER"


def test_game_over_updates_high_score():
    s = logic.new_game(rng=random.Random(6))
    # accrue some time/score first
    for _ in range(60):
        logic.update(s, 0, 1 / 60)
    score_before = s.score
    # force collision
    logic.spawn_rock(s)
    r = s.rocks[-1]
    r.x = s.ship_x
    r.y = s.ship_y
    logic.update(s, 0, 0.001)
    assert s.state == "GAME_OVER"
    assert s.high_score == score_before or s.high_score >= score_before


# ---------------------------------------------------------------------------
# freeze on game over
# ---------------------------------------------------------------------------
def test_update_frozen_when_game_over():
    s = logic.new_game(rng=random.Random(7))
    s.state = "GAME_OVER"
    s.t = 5.0
    s.score = 50
    rocks_before = list(s.rocks)
    logic.update(s, 1, 1.0)
    assert s.t == 5.0
    assert s.score == 50
    assert len(s.rocks) == len(rocks_before)


# ---------------------------------------------------------------------------
# restart
# ---------------------------------------------------------------------------
def test_restart_preserves_high_score_and_resets():
    s = logic.new_game(rng=random.Random(8))
    for _ in range(120):
        logic.update(s, 0, 1 / 60)
    s.high_score = 99
    s2 = logic.restart(s)
    assert s2.state == "PLAYING"
    assert s2.t == 0
    assert s2.score == 0
    assert s2.rocks == []
    assert s2.high_score == 99
    assert s2.ship_x == (logic.SCREEN_W - logic.SHIP_W) / 2


# ---------------------------------------------------------------------------
# determinism
# ---------------------------------------------------------------------------
def test_determinism_same_seed_same_states():
    def run():
        s = logic.new_game(rng=random.Random(2024))
        seq = []
        for i in range(300):
            d = (-1, 0, 1)[i % 3]
            logic.update(s, d, 1 / 60)
            seq.append((round(s.ship_x, 5), len(s.rocks), s.score, s.state))
        return seq

    assert run() == run()


def test_both_keys_cancel_via_direction_zero():
    # holding both keys => caller passes direction 0
    s = logic.new_game()
    x0 = s.ship_x
    logic.update(s, 0, 0.5)
    assert s.ship_x == x0
