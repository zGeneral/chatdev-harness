"""Paddle Bounce - Pygame shell.

All game rules live in logic.py (no pygame there). This module only handles
windowing, input, drawing, and the frame loop. Everything added here is pure
presentation polish (color, particles, HUD feedback) and never touches the
game rules.

Headless smoke mode: set GAME_SMOKE_FRAMES=N (with SDL_VIDEODRIVER=dummy) to
run N frames with no real window, then quit cleanly with exit code 0.
"""

import math
import os
import random
import sys

import pygame

import logic

FPS = 60

# Colors (never pure black background).
BG_TOP = (18, 20, 32)
BG_BOTTOM = (32, 30, 54)
PADDLE_COLOR = (90, 200, 250)
PADDLE_GLOW = (150, 230, 255)
BALL_COLOR = (250, 220, 90)
BALL_CORE = (255, 248, 210)
TEXT_COLOR = (235, 235, 245)
MUTED_COLOR = (150, 155, 180)
OVER_COLOR = (250, 120, 120)
TRAIL_COLOR = (250, 220, 90)
WALL_COLOR = (60, 64, 92)

PARTICLE_COLORS = [
    (250, 220, 90),
    (250, 170, 80),
    (150, 230, 255),
    (255, 248, 210),
]


class Particle:
    """A tiny presentation-only spark. No effect on game logic."""

    __slots__ = ("x", "y", "vx", "vy", "life", "max_life", "color", "size")

    def __init__(self, x, y, vx, vy, life, color, size):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.life = life
        self.max_life = life
        self.color = color
        self.size = size

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.vy += 0.15  # gentle gravity
        self.vx *= 0.97
        self.life -= 1

    @property
    def alive(self):
        return self.life > 0


def _spawn_burst(particles, x, y, count=14, speed=4.0):
    for _ in range(count):
        ang = random.uniform(0, math.tau)
        spd = random.uniform(0.4, speed)
        particles.append(
            Particle(
                x,
                y,
                math.cos(ang) * spd,
                math.sin(ang) * spd - 1.0,
                random.randint(18, 34),
                random.choice(PARTICLE_COLORS),
                random.randint(2, 4),
            )
        )


def _make_background(width, height):
    """Pre-render a vertical gradient backdrop once."""
    bg = pygame.Surface((width, height))
    for y in range(height):
        t = y / max(1, height - 1)
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        pygame.draw.line(bg, (r, g, b), (0, y), (width, y))
    return bg


def _draw_centered(screen, font, text, color, cx, cy, alpha=255):
    surf = font.render(text, True, color)
    if alpha < 255:
        surf.set_alpha(alpha)
    rect = surf.get_rect(center=(cx, cy))
    screen.blit(surf, rect)
    return rect


def draw(screen, fonts, state, background, trail, particles, frame, flash):
    font, big_font, small_font = fonts

    # Backdrop gradient.
    screen.blit(background, (0, 0))

    # Side wall accents.
    pygame.draw.rect(screen, WALL_COLOR, pygame.Rect(0, 0, 3, state.height))
    pygame.draw.rect(
        screen, WALL_COLOR, pygame.Rect(state.width - 3, 0, 3, state.height)
    )
    pygame.draw.rect(screen, WALL_COLOR, pygame.Rect(0, 0, state.width, 3))

    # Ball trail (oldest -> newest, fading).
    n = len(trail)
    for i, (tx, ty) in enumerate(trail):
        frac = (i + 1) / max(1, n)
        radius = max(1, int(state.ball_radius * frac))
        glow = pygame.Surface((radius * 2 + 2, radius * 2 + 2), pygame.SRCALPHA)
        a = int(120 * frac)
        pygame.draw.circle(
            glow, (*TRAIL_COLOR, a), (radius + 1, radius + 1), radius
        )
        screen.blit(glow, (int(tx) - radius - 1, int(ty) - radius - 1))

    # Particles.
    for p in particles:
        frac = p.life / p.max_life
        a = max(0, min(255, int(255 * frac)))
        size = max(1, int(p.size * frac) + 1)
        surf = pygame.Surface((size * 2, size * 2), pygame.SRCALPHA)
        pygame.draw.circle(surf, (*p.color, a), (size, size), size)
        screen.blit(surf, (int(p.x) - size, int(p.y) - size))

    # Paddle with a soft glow and a subtle bob highlight.
    paddle_rect = pygame.Rect(
        int(state.paddle_x),
        int(state.paddle_y),
        state.paddle_width,
        state.paddle_height,
    )
    glow_rect = paddle_rect.inflate(10, 10)
    glow_surf = pygame.Surface(glow_rect.size, pygame.SRCALPHA)
    pygame.draw.rect(
        glow_surf,
        (*PADDLE_GLOW, 60),
        glow_surf.get_rect(),
        border_radius=10,
    )
    screen.blit(glow_surf, glow_rect.topleft)
    pygame.draw.rect(screen, PADDLE_COLOR, paddle_rect, border_radius=6)
    pygame.draw.rect(
        screen,
        PADDLE_GLOW,
        pygame.Rect(paddle_rect.x, paddle_rect.y, paddle_rect.width, 4),
        border_radius=4,
    )

    # Ball with a pulsing glow halo and bright core.
    pulse = 2 + int(2 * math.sin(frame * 0.2))
    halo_r = state.ball_radius + 6 + pulse
    halo = pygame.Surface((halo_r * 2, halo_r * 2), pygame.SRCALPHA)
    pygame.draw.circle(halo, (*BALL_COLOR, 70), (halo_r, halo_r), halo_r)
    screen.blit(
        halo, (int(state.ball_x) - halo_r, int(state.ball_y) - halo_r)
    )
    pygame.draw.circle(
        screen,
        BALL_COLOR,
        (int(state.ball_x), int(state.ball_y)),
        state.ball_radius,
    )
    pygame.draw.circle(
        screen,
        BALL_CORE,
        (int(state.ball_x - 2), int(state.ball_y - 2)),
        max(2, state.ball_radius // 2),
    )

    # Score flash on a recent point.
    if flash > 0:
        boost = int(flash * 4)
        score_color = (
            min(255, TEXT_COLOR[0] + boost),
            min(255, TEXT_COLOR[1] + boost),
            min(255, BALL_COLOR[2]),
        )
    else:
        score_color = TEXT_COLOR
    score_surf = big_font.render(f"{state.score}", True, score_color)
    screen.blit(score_surf, (16, 10))
    label = small_font.render("SCORE", True, MUTED_COLOR)
    screen.blit(label, (18, 10 + score_surf.get_height() - 4))

    if state.game_over:
        # Dim the field, then center the message stack.
        veil = pygame.Surface((state.width, state.height), pygame.SRCALPHA)
        veil.fill((10, 10, 18, 150))
        screen.blit(veil, (0, 0))
        cx, cy = state.width // 2, state.height // 2
        _draw_centered(screen, big_font, "GAME OVER", OVER_COLOR, cx, cy - 34)
        _draw_centered(
            screen,
            font,
            f"Final Score: {state.score}",
            TEXT_COLOR,
            cx,
            cy + 6,
        )
        # Gently pulsing prompt.
        prompt_alpha = int(160 + 80 * math.sin(frame * 0.12))
        _draw_centered(
            screen,
            small_font,
            "Press R to restart   -   Esc to quit",
            MUTED_COLOR,
            cx,
            cy + 40,
            alpha=prompt_alpha,
        )


def main():
    smoke_frames = os.environ.get("GAME_SMOKE_FRAMES")
    smoke = smoke_frames is not None
    if smoke:
        os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
        os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
        try:
            max_frames = int(smoke_frames)
        except ValueError:
            max_frames = 0

    pygame.init()
    screen = pygame.display.set_mode((logic.WIDTH, logic.HEIGHT))
    pygame.display.set_caption("Paddle Bounce")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 36)
    big_font = pygame.font.SysFont(None, 54)
    small_font = pygame.font.SysFont(None, 24)
    fonts = (font, big_font, small_font)

    background = _make_background(logic.WIDTH, logic.HEIGHT)

    state = logic.new_game()
    trail = []
    particles = []
    flash = 0
    prev_score = state.score
    was_over = state.game_over

    running = True
    frame = 0
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r and state.game_over:
                    state = logic.restart(state)
                    trail.clear()
                    particles.clear()
                    flash = 0
                    prev_score = state.score
                    was_over = state.game_over
                elif event.key == pygame.K_ESCAPE:
                    running = False

        # Continuous key state for paddle movement.
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT]:
            logic.move_paddle(state, -1)
        if keys[pygame.K_RIGHT]:
            logic.move_paddle(state, 1)

        logic.update(state)

        # --- Presentation-only reactions to logic changes ---
        if state.score > prev_score:
            _spawn_burst(particles, state.ball_x, state.ball_y, count=16)
            flash = 30
        if state.game_over and not was_over:
            _spawn_burst(
                particles, state.ball_x, state.ball_y, count=26, speed=6.0
            )
        prev_score = state.score
        was_over = state.game_over

        # Ball trail history.
        if not state.game_over:
            trail.append((state.ball_x, state.ball_y))
            if len(trail) > 12:
                trail.pop(0)

        for p in particles:
            p.update()
        particles[:] = [p for p in particles if p.alive]
        if flash > 0:
            flash -= 1

        draw(screen, fonts, state, background, trail, particles, frame, flash)
        pygame.display.flip()
        clock.tick(FPS)

        frame += 1
        if smoke and frame >= max_frames:
            running = False

    pygame.quit()
    if smoke:
        sys.exit(0)


if __name__ == "__main__":
    main()
