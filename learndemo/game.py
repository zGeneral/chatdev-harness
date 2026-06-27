"""Pygame shell for Fruit Catch, with a headless GAME_SMOKE_FRAMES smoke mode.

logic.py holds all simulation; this file only handles I/O and rendering.
Anything in here is presentation-only: visuals, HUD, and feedback timers.
No game rules live in this file.
"""
import os
import sys
from random import Random

import logic
from logic import Config, Phase


class Colors:
    BG_TOP = (28, 33, 54)      # sky, top of vertical gradient (never pure black)
    BG_BOTTOM = (44, 52, 82)   # sky, near the horizon
    GROUND = (58, 70, 48)      # ground band
    GROUND_EDGE = (86, 104, 70)  # lit top edge of the ground
    BASKET = (180, 120, 60)    # warm
    BASKET_RIM = (124, 80, 36)  # darker rim for depth
    BASKET_HI = (224, 168, 104)  # top inner highlight
    FRUIT = (220, 60, 70)      # saturated red
    FRUIT_HI = (255, 180, 185)  # highlight
    FRUIT_STEM = (96, 150, 70)  # leaf/stem green
    SHADOW = (18, 22, 36)      # soft drop shadow
    HUD = (235, 238, 245)
    HUD_DIM = (150, 158, 178)  # secondary HUD text
    GAUGE_BG = (60, 68, 96)    # speed gauge track
    GAUGE_FILL = (255, 196, 84)  # speed gauge fill
    AIM = (255, 240, 200)      # faint aiming guide
    FLASH = (255, 244, 210)    # catch pulse
    OVERLAY = (10, 12, 20)
    PANEL = (24, 28, 46)
    PANEL_EDGE = (90, 100, 140)


class UIState:
    """Presentation-only feedback state (not part of the simulation)."""

    def __init__(self):
        self.best = 0
        self.catch_flash = 0.0   # seconds remaining on the catch pulse
        self.shake = 0.0         # seconds remaining on the game-over shake


# Tunables for purely cosmetic feedback.
CATCH_FLASH_TIME = 0.18
SHAKE_TIME = 0.35


def _draw_vertical_gradient(screen, pygame, top, bottom, height, width):
    """Fill the screen with a smooth top->bottom gradient (cheap, per-row)."""
    tr, tg, tb = top
    br, bg, bb = bottom
    for y in range(height):
        t = y / max(1, height - 1)
        col = (int(tr + (br - tr) * t),
               int(tg + (bg - tg) * t),
               int(tb + (bb - tb) * t))
        pygame.draw.line(screen, col, (0, y), (width, y))


def _draw_basket(screen, pygame, cfg, x):
    bx = int(x)
    body = (bx, cfg.basket_y, cfg.basket_w, cfg.basket_h)
    # drop shadow on the ground for a sense of depth
    shadow = (bx + 4, cfg.basket_y + cfg.basket_h - 2, cfg.basket_w, 8)
    sh = pygame.Surface((cfg.basket_w, 8), pygame.SRCALPHA)
    sh.fill((*Colors.SHADOW, 90))
    screen.blit(sh, (shadow[0], shadow[1]))
    pygame.draw.rect(screen, Colors.BASKET_RIM, body, border_radius=9)
    inner = (bx + 3, cfg.basket_y + 3, cfg.basket_w - 6, cfg.basket_h - 6)
    pygame.draw.rect(screen, Colors.BASKET, inner, border_radius=7)
    # top highlight lip
    lip = (bx + 5, cfg.basket_y + 4, cfg.basket_w - 10, 4)
    pygame.draw.rect(screen, Colors.BASKET_HI, lip, border_radius=3)


def _draw_fruit(screen, pygame, cfg, fr, ground_top):
    cx = int(fr.x + cfg.fruit_w / 2)
    cy = int(fr.y + cfg.fruit_h / 2)
    r = cfg.fruit_w // 2

    # contact shadow on the ground that grows as the fruit nears it
    fall_span = max(1.0, ground_top + cfg.fruit_h)
    nearness = max(0.0, min(1.0, (fr.y + cfg.fruit_h) / fall_span))
    sw = int(r * (0.8 + 0.7 * nearness))
    sh_surf = pygame.Surface((sw * 2, 10), pygame.SRCALPHA)
    pygame.draw.ellipse(sh_surf, (*Colors.SHADOW, int(60 + 60 * nearness)),
                        (0, 0, sw * 2, 10))
    screen.blit(sh_surf, (cx - sw, ground_top - 6))

    # fruit body + specular highlight
    pygame.draw.circle(screen, Colors.FRUIT, (cx, cy), r)
    pygame.draw.circle(screen, Colors.FRUIT_HI,
                       (cx - r // 3, cy - r // 3), max(2, r // 4))
    # little stem/leaf so it reads as fruit, not a dot
    pygame.draw.line(screen, Colors.FRUIT_STEM, (cx, cy - r),
                     (cx + 2, cy - r - 5), 2)
    pygame.draw.circle(screen, Colors.FRUIT_STEM, (cx + 5, cy - r - 4), 3)


def _draw_aim_guide(screen, pygame, cfg, fr, ground_top):
    """Faint vertical guide under the falling fruit to help line up the basket."""
    cx = int(fr.x + cfg.fruit_w / 2)
    top = int(fr.y + cfg.fruit_h)
    guide = pygame.Surface((2, max(0, ground_top - top)), pygame.SRCALPHA)
    guide.fill((*Colors.AIM, 36))
    screen.blit(guide, (cx - 1, top))


def _draw_speed_gauge(screen, pygame, cfg, state, font):
    """Top-right gauge showing how fast fruit currently falls (feedback on pacing)."""
    span = max(1.0, cfg.fall_speed_max - cfg.fall_speed_start)
    frac = (state.fall_speed - cfg.fall_speed_start) / span
    frac = max(0.0, min(1.0, frac))
    gw, gh = 120, 10
    gx, gy = cfg.width - gw - 12, 16
    pygame.draw.rect(screen, Colors.GAUGE_BG, (gx, gy, gw, gh), border_radius=5)
    if frac > 0:
        pygame.draw.rect(screen, Colors.GAUGE_FILL,
                         (gx, gy, int(gw * frac), gh), border_radius=5)
    if font is not None:
        label = font.render("SPEED", True, Colors.HUD_DIM)
        screen.blit(label, (gx + gw - label.get_width(), gy - 18))


def render(screen, pygame, state, font, ui=None):
    cfg = state.cfg
    _draw_vertical_gradient(screen, pygame, Colors.BG_TOP, Colors.BG_BOTTOM,
                            cfg.height, cfg.width)

    # ground band below the basket, with a lit top edge
    ground_top = cfg.basket_y + cfg.basket_h
    pygame.draw.rect(screen, Colors.GROUND,
                     (0, ground_top, cfg.width, cfg.height - ground_top))
    pygame.draw.line(screen, Colors.GROUND_EDGE,
                     (0, ground_top), (cfg.width, ground_top), 2)

    if state.phase is Phase.PLAYING:
        _draw_aim_guide(screen, pygame, cfg, state.fruit, ground_top)

    _draw_fruit(screen, pygame, cfg, state.fruit, ground_top)
    _draw_basket(screen, pygame, cfg, state.basket_x)

    # catch pulse: a soft full-screen warm flash that fades out
    if ui is not None and ui.catch_flash > 0:
        alpha = int(120 * (ui.catch_flash / CATCH_FLASH_TIME))
        flash = pygame.Surface((cfg.width, cfg.height), pygame.SRCALPHA)
        flash.fill((*Colors.FLASH, max(0, min(120, alpha))))
        screen.blit(flash, (0, 0))

    # HUD
    if font is not None:
        score = font.render(f"Score  {state.score}", True, Colors.HUD)
        screen.blit(score, (12, 12))
        if ui is not None:
            best = font.render(f"Best  {max(ui.best, state.score)}",
                               True, Colors.HUD_DIM)
            screen.blit(best, (12, 40))

        _draw_speed_gauge(screen, pygame, cfg, state, font)

        if state.phase is Phase.GAME_OVER:
            # dim the field, then draw a centered panel
            dim = pygame.Surface((cfg.width, cfg.height), pygame.SRCALPHA)
            dim.fill((*Colors.OVERLAY, 170))
            screen.blit(dim, (0, 0))

            pw, ph = 320, 150
            px = (cfg.width - pw) // 2
            py = (cfg.height - ph) // 2
            pygame.draw.rect(screen, Colors.PANEL, (px, py, pw, ph),
                             border_radius=14)
            pygame.draw.rect(screen, Colors.PANEL_EDGE, (px, py, pw, ph),
                             width=2, border_radius=14)

            title = font.render("GAME OVER", True, Colors.HUD)
            final = font.render(f"Final Score: {state.score}", True, Colors.HUD)
            hint = font.render("Press R to play again", True, Colors.HUD_DIM)
            cxp = cfg.width // 2
            screen.blit(title, title.get_rect(center=(cxp, py + 38)))
            screen.blit(final, final.get_rect(center=(cxp, py + 78)))
            screen.blit(hint, hint.get_rect(center=(cxp, py + 116)))


def main(argv=None):
    smoke_raw = os.environ.get("GAME_SMOKE_FRAMES")
    smoke_frames = 0
    if smoke_raw is not None:
        try:
            smoke_frames = int(smoke_raw)
        except ValueError:
            smoke_frames = 0
    smoke = smoke_frames >= 1

    if smoke:
        os.environ["SDL_VIDEODRIVER"] = "dummy"
        os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

    import pygame

    pygame.init()
    try:
        try:
            pygame.font.init()
            font = pygame.font.SysFont(None, 32)
        except Exception:
            font = None

        cfg = Config()
        rng = Random(1234) if smoke else Random()
        screen = pygame.display.set_mode((cfg.width, cfg.height))
        pygame.display.set_caption("Fruit Catch")
        clock = pygame.time.Clock()

        state = logic.new_game(cfg, rng)
        ui = UIState()

        running = True
        frame = 0
        while running:
            if smoke:
                dt = 1.0 / 60.0
            else:
                dt = clock.tick(60) / 1000.0

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_r and state.phase is Phase.GAME_OVER:
                        logic.reset(state, rng)

            if smoke:
                # scripted wiggle so basket motion is exercised deterministically
                direction = 1 if (frame // 20) % 2 == 0 else -1
                if state.phase is Phase.GAME_OVER:
                    logic.reset(state, rng)
            else:
                keys = pygame.key.get_pressed()
                direction = (-1 if keys[pygame.K_LEFT] else 0) + (1 if keys[pygame.K_RIGHT] else 0)

            result = logic.step(state, direction, dt, rng)

            # presentation-only feedback driven by simulation events
            ui.best = max(ui.best, state.score)
            if result.event == "catch":
                ui.catch_flash = CATCH_FLASH_TIME
            elif result.event == "miss":
                ui.shake = SHAKE_TIME
            if ui.catch_flash > 0:
                ui.catch_flash = max(0.0, ui.catch_flash - dt)
            if ui.shake > 0:
                ui.shake = max(0.0, ui.shake - dt)

            render(screen, pygame, state, font, ui)
            pygame.display.flip()

            frame += 1
            if smoke and frame >= smoke_frames:
                running = False

        return 0
    finally:
        pygame.quit()


if __name__ == "__main__":
    sys.exit(main())
