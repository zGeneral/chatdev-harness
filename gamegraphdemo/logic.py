"""Pure game logic for Paddle Bounce. No pygame imports here.

All physics, collision, scoring, and state transitions live here so they
can be unit-tested without a display or event loop.
"""

from dataclasses import dataclass, field

# --- Configuration constants -------------------------------------------------

WIDTH = 800
HEIGHT = 600

PADDLE_WIDTH = 120
PADDLE_HEIGHT = 16
PADDLE_Y = HEIGHT - 40
PADDLE_SPEED = 8

BALL_RADIUS = 10
BALL_START_VX = 4.0
BALL_START_VY = -5.0


def clamp(value, low, high):
    """Clamp value into the inclusive range [low, high]."""
    if value < low:
        return low
    if value > high:
        return high
    return value


def clamp_paddle(x, paddle_width=PADDLE_WIDTH, width=WIDTH):
    """Clamp the paddle's left edge so it stays fully on screen."""
    return clamp(x, 0, width - paddle_width)


@dataclass
class GameState:
    """Mutable game state. Created via new_game()."""

    ball_x: float
    ball_y: float
    ball_vx: float
    ball_vy: float
    paddle_x: float
    score: int = 0
    game_over: bool = False
    # dimensions kept on state so logic is self-contained
    width: int = WIDTH
    height: int = HEIGHT
    paddle_width: int = PADDLE_WIDTH
    paddle_height: int = PADDLE_HEIGHT
    paddle_y: int = PADDLE_Y
    ball_radius: int = BALL_RADIUS


def new_game():
    """Return a fresh GameState ready to play."""
    return GameState(
        ball_x=WIDTH / 2,
        ball_y=HEIGHT / 2,
        ball_vx=BALL_START_VX,
        ball_vy=BALL_START_VY,
        paddle_x=(WIDTH - PADDLE_WIDTH) / 2,
        score=0,
        game_over=False,
    )


def move_paddle(state, direction):
    """Move the paddle by direction (-1 left, +1 right), then clamp.

    Does nothing when the game is over.
    """
    if state.game_over:
        return state
    state.paddle_x = clamp_paddle(
        state.paddle_x + direction * PADDLE_SPEED,
        state.paddle_width,
        state.width,
    )
    return state


def _ball_hits_paddle(state):
    """True if the ball (moving down) overlaps the paddle top this frame."""
    bottom = state.ball_y + state.ball_radius
    # Ball must be at/below the paddle's top surface but not past its bottom.
    if bottom < state.paddle_y:
        return False
    if state.ball_y - state.ball_radius > state.paddle_y + state.paddle_height:
        return False
    left = state.paddle_x
    right = state.paddle_x + state.paddle_width
    return left <= state.ball_x <= right


def update(state):
    """Advance the simulation by one frame. Returns the (mutated) state."""
    if state.game_over:
        return state

    state.ball_x += state.ball_vx
    state.ball_y += state.ball_vy

    r = state.ball_radius

    # Left / right walls: reflect and keep inside bounds.
    if state.ball_x - r <= 0:
        state.ball_x = r
        state.ball_vx = abs(state.ball_vx)
    elif state.ball_x + r >= state.width:
        state.ball_x = state.width - r
        state.ball_vx = -abs(state.ball_vx)

    # Top wall: reflect downward.
    if state.ball_y - r <= 0:
        state.ball_y = r
        state.ball_vy = abs(state.ball_vy)

    # Paddle collision (only when travelling downward).
    if state.ball_vy > 0 and _ball_hits_paddle(state):
        state.ball_y = state.paddle_y - r
        state.ball_vy = -abs(state.ball_vy)
        state.score += 1

    # Miss: ball falls below the bottom of the screen -> game over.
    if state.ball_y - r > state.height:
        state.game_over = True

    return state


def restart(state):
    """Restart only when the game is over; otherwise leave state unchanged."""
    if state.game_over:
        return new_game()
    return state
