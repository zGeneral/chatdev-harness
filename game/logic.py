"""Pure game logic for 'Rockfall: Last Drift'.

NO pygame, NO rendering, NO real-time clock. All time enters as `dt` seconds.
Deterministic given a seeded random.Random and a fixed (direction, dt) input
sequence. Fully unit-testable.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import List, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCREEN_W = 480
SCREEN_H = 720

SHIP_W = 40
SHIP_H = 26
SHIP_SPEED = 360  # px/s
# Ship resting top-y: sit near the bottom with a small margin for a HUD/floor band.
FLOOR_Y = SCREEN_H - SHIP_H - 48  # 646

BASE_FALL = 180  # px/s
FALL_RAMP = 14   # px/s per second
MAX_FALL = 620   # px/s cap

BASE_INTERVAL = 0.85   # s
INTERVAL_RAMP = 0.018  # s per second
MIN_INTERVAL = 0.22    # s floor

SCORE_RATE = 10  # points per second

# Rock sizing bounds (square-ish)
ROCK_MIN = 22
ROCK_MAX = 46


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
@dataclass
class Rock:
    x: float
    y: float
    w: float
    h: float
    speed: float


@dataclass
class GameState:
    ship_x: float
    ship_y: float
    t: float = 0.0
    score: int = 0
    rocks_dodged: int = 0
    rocks: List[Rock] = field(default_factory=list)
    spawn_timer: float = 0.0
    state: str = "PLAYING"  # 'PLAYING' | 'GAME_OVER'
    high_score: int = 0
    rng: random.Random = field(default_factory=random.Random)


# ---------------------------------------------------------------------------
# Geometry helper
# ---------------------------------------------------------------------------
def aabb_overlap(ax, ay, aw, ah, bx, by, bw, bh) -> bool:
    """Strict axis-aligned bounding-box overlap (edge-touch is NOT overlap)."""
    return (ax < bx + bw and ax + aw > bx and
            ay < by + bh and ay + ah > by)


# ---------------------------------------------------------------------------
# Difficulty curves
# ---------------------------------------------------------------------------
def rock_speed(t: float) -> float:
    return min(MAX_FALL, BASE_FALL + FALL_RAMP * t)


def spawn_interval(t: float) -> float:
    return max(MIN_INTERVAL, BASE_INTERVAL - INTERVAL_RAMP * t)


def compute_score(t: float) -> int:
    return int(math.floor(t * SCORE_RATE))


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
def new_game(high_score: int = 0, rng: Optional[random.Random] = None) -> GameState:
    if rng is None:
        rng = random.Random()
    return GameState(
        ship_x=(SCREEN_W - SHIP_W) / 2,
        ship_y=FLOOR_Y,
        t=0.0,
        score=0,
        rocks_dodged=0,
        rocks=[],
        spawn_timer=0.0,
        state="PLAYING",
        high_score=high_score,
        rng=rng,
    )


def restart(state: GameState) -> GameState:
    """Return a fresh PLAYING game, preserving high_score and reusing the rng."""
    return new_game(high_score=state.high_score, rng=state.rng)


# ---------------------------------------------------------------------------
# Mutators
# ---------------------------------------------------------------------------
def move_ship(state: GameState, direction: int, dt: float) -> GameState:
    """direction in {-1, 0, 1}; dt-scaled; clamped to [0, SCREEN_W - SHIP_W]."""
    if direction:
        state.ship_x += SHIP_SPEED * dt * direction
    if state.ship_x < 0:
        state.ship_x = 0
    max_x = SCREEN_W - SHIP_W
    if state.ship_x > max_x:
        state.ship_x = max_x
    return state


def spawn_rock(state: GameState) -> GameState:
    size = state.rng.randint(ROCK_MIN, ROCK_MAX)
    x = state.rng.uniform(0, SCREEN_W - size)
    state.rocks.append(Rock(x=x, y=-size, w=size, h=size, speed=rock_speed(state.t)))
    return state


def check_collision(state: GameState) -> bool:
    for r in state.rocks:
        if aabb_overlap(state.ship_x, state.ship_y, SHIP_W, SHIP_H,
                        r.x, r.y, r.w, r.h):
            return True
    return False


def update(state: GameState, direction: int, dt: float) -> GameState:
    """Master tick. No-op (frozen) once GAME_OVER."""
    if state.state == "GAME_OVER":
        return state

    # advance time + score
    state.t += dt
    state.score = compute_score(state.t)

    # input
    move_ship(state, direction, dt)

    # spawning: accumulate and emit due rocks, carrying remainder
    state.spawn_timer += dt
    interval = spawn_interval(state.t)
    # guard against pathological tiny intervals with huge dt
    guard = 0
    while state.spawn_timer >= interval and guard < 1000:
        spawn_rock(state)
        state.spawn_timer -= interval
        interval = spawn_interval(state.t)
        guard += 1

    # move rocks + cull off-screen (top past bottom)
    survivors: List[Rock] = []
    for r in state.rocks:
        r.y += r.speed * dt
        if r.y > SCREEN_H:
            state.rocks_dodged += 1
        else:
            survivors.append(r)
    state.rocks = survivors

    # collision -> death
    if check_collision(state):
        state.state = "GAME_OVER"
        state.high_score = max(state.high_score, state.score)

    return state
