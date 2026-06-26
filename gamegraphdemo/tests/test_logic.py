import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logic
from logic import (
    GameState,
    clamp,
    clamp_paddle,
    move_paddle,
    new_game,
    restart,
    update,
)


def test_clamp_basic():
    assert clamp(5, 0, 10) == 5
    assert clamp(-3, 0, 10) == 0
    assert clamp(99, 0, 10) == 10


def test_clamp_paddle_bounds():
    assert clamp_paddle(-50) == 0
    assert clamp_paddle(logic.WIDTH) == logic.WIDTH - logic.PADDLE_WIDTH
    mid = (logic.WIDTH - logic.PADDLE_WIDTH) / 2
    assert clamp_paddle(mid) == mid


def test_new_game_defaults():
    s = new_game()
    assert s.score == 0
    assert s.game_over is False
    assert s.ball_x == logic.WIDTH / 2
    assert s.ball_y == logic.HEIGHT / 2


def test_move_paddle_clamps_left():
    s = new_game()
    s.paddle_x = 0
    move_paddle(s, -1)
    assert s.paddle_x == 0


def test_move_paddle_clamps_right():
    s = new_game()
    s.paddle_x = s.width - s.paddle_width
    move_paddle(s, 1)
    assert s.paddle_x == s.width - s.paddle_width


def test_move_paddle_moves():
    s = new_game()
    start = s.paddle_x
    move_paddle(s, 1)
    assert s.paddle_x == start + logic.PADDLE_SPEED


def test_move_paddle_noop_when_over():
    s = new_game()
    s.game_over = True
    start = s.paddle_x
    move_paddle(s, 1)
    assert s.paddle_x == start


def test_update_moves_ball():
    s = new_game()
    x0, y0 = s.ball_x, s.ball_y
    update(s)
    assert s.ball_x == x0 + s.ball_vx
    assert s.ball_y == y0 + s.ball_vy


def test_left_wall_bounce():
    s = new_game()
    s.ball_x = s.ball_radius
    s.ball_vx = -5
    s.ball_vy = 0
    update(s)
    assert s.ball_vx > 0


def test_right_wall_bounce():
    s = new_game()
    s.ball_x = s.width - s.ball_radius
    s.ball_vx = 5
    s.ball_vy = 0
    update(s)
    assert s.ball_vx < 0


def test_top_wall_bounce():
    s = new_game()
    s.ball_x = s.width / 2
    s.ball_y = s.ball_radius
    s.ball_vx = 0
    s.ball_vy = -5
    update(s)
    assert s.ball_vy > 0


def test_paddle_bounce_scores():
    s = new_game()
    s.paddle_x = s.width / 2 - s.paddle_width / 2
    s.ball_x = s.width / 2
    s.ball_y = s.paddle_y - s.ball_radius - 1
    s.ball_vx = 0
    s.ball_vy = 5
    update(s)
    assert s.ball_vy < 0
    assert s.score == 1
    assert s.game_over is False


def test_miss_is_game_over():
    s = new_game()
    s.ball_x = 50  # away from paddle
    s.paddle_x = s.width - s.paddle_width
    s.ball_y = s.height - 1
    s.ball_vx = 0
    s.ball_vy = 5
    for _ in range(10):
        update(s)
    assert s.game_over is True


def test_update_noop_when_over():
    s = new_game()
    s.game_over = True
    x0, y0 = s.ball_x, s.ball_y
    update(s)
    assert (s.ball_x, s.ball_y) == (x0, y0)


def test_restart_when_over():
    s = new_game()
    s.score = 7
    s.game_over = True
    s2 = restart(s)
    assert s2.game_over is False
    assert s2.score == 0


def test_restart_noop_when_playing():
    s = new_game()
    s.score = 3
    s2 = restart(s)
    assert s2 is s
    assert s2.score == 3


def test_no_score_when_paddle_misses():
    s = new_game()
    s.paddle_x = 0
    s.ball_x = s.width - 5  # far from paddle at left
    s.ball_y = s.paddle_y - s.ball_radius - 1
    s.ball_vx = 0
    s.ball_vy = 5
    update(s)
    assert s.score == 0
