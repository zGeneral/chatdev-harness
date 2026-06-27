"""Pure simulation logic for Fruit Catch.

HARD RULE: this module imports nothing from pygame.
All randomness is injected via a random.Random instance for determinism.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from random import Random


@dataclass(frozen=True)
class Config:
    width: int = 480
    height: int = 640
    basket_w: int = 90
    basket_h: int = 24
    basket_y: int = 600           # top of basket; ground band below
    basket_speed: float = 360.0   # px/sec
    fruit_w: int = 36
    fruit_h: int = 36
    fall_speed_start: float = 160.0   # px/sec
    fall_speed_max: float = 520.0
    fall_speed_step: float = 14.0     # added per successful catch
    spawn_margin: int = 8             # keep fruit fully on-screen


class Phase(Enum):
    PLAYING = "playing"
    GAME_OVER = "game_over"


@dataclass
class Fruit:
    x: float  # top-left
    y: float  # top-left


@dataclass
class GameState:
    cfg: Config
    basket_x: float          # top-left x
    fruit: Fruit
    score: int = 0
    fall_speed: float = 0.0
    phase: Phase = Phase.PLAYING


@dataclass
class StepResult:
    event: str               # "catch" | "miss" | "none"
    score: int
    phase: Phase


def aabb_overlap(ax, ay, aw, ah, bx, by, bw, bh) -> bool:
    """Axis-aligned bounding-box overlap (touching edges count as overlap)."""
    return (ax <= bx + bw and bx <= ax + aw and
            ay <= by + bh and by <= ay + ah)


def spawn_fruit(cfg: Config, rng: Random) -> Fruit:
    lo = cfg.spawn_margin
    hi = cfg.width - cfg.fruit_w - cfg.spawn_margin
    x = rng.randint(lo, hi)
    return Fruit(x=float(x), y=float(-cfg.fruit_h))


def new_game(cfg: Config, rng: Random) -> GameState:
    basket_x = (cfg.width - cfg.basket_w) / 2.0
    return GameState(
        cfg=cfg,
        basket_x=basket_x,
        fruit=spawn_fruit(cfg, rng),
        score=0,
        fall_speed=cfg.fall_speed_start,
        phase=Phase.PLAYING,
    )


def _clamp_basket(state: GameState) -> None:
    cfg = state.cfg
    max_x = cfg.width - cfg.basket_w
    if state.basket_x < 0:
        state.basket_x = 0.0
    elif state.basket_x > max_x:
        state.basket_x = float(max_x)


def move_basket(state: GameState, direction: int, dt: float) -> None:
    state.basket_x += direction * state.cfg.basket_speed * dt
    _clamp_basket(state)


def step(state: GameState, direction: int, dt: float, rng: Random) -> StepResult:
    cfg = state.cfg
    if state.phase is Phase.GAME_OVER:
        return StepResult(event="none", score=state.score, phase=state.phase)

    move_basket(state, direction, dt)
    state.fruit.y += state.fall_speed * dt

    caught = aabb_overlap(
        state.fruit.x, state.fruit.y, cfg.fruit_w, cfg.fruit_h,
        state.basket_x, cfg.basket_y, cfg.basket_w, cfg.basket_h,
    )

    if caught:
        state.score += 1
        state.fall_speed = min(cfg.fall_speed_max, state.fall_speed + cfg.fall_speed_step)
        state.fruit = spawn_fruit(cfg, rng)
        return StepResult(event="catch", score=state.score, phase=state.phase)

    if state.fruit.y > cfg.basket_y + cfg.basket_h:
        state.phase = Phase.GAME_OVER
        return StepResult(event="miss", score=state.score, phase=state.phase)

    return StepResult(event="none", score=state.score, phase=state.phase)


def reset(state: GameState, rng: Random) -> None:
    cfg = state.cfg
    state.basket_x = (cfg.width - cfg.basket_w) / 2.0
    state.fruit = spawn_fruit(cfg, rng)
    state.score = 0
    state.fall_speed = cfg.fall_speed_start
    state.phase = Phase.PLAYING
