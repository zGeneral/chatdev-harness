"""Rockfall: Last Drift — Pygame shell (Phase 2: visual juice).

Renders simple geometric shapes only (no sprites/images). ALL real game logic
lives in logic.py (pure, tested). This module owns input, rendering, the 60 FPS
loop, restart, quit, a HEADLESS SMOKE MODE, and — new in Phase 2 — purely
cosmetic polish: a parallax starfield, thruster + impact particles, a subtle
death screen-shake (<=6px, 0.25s decay), a fading danger flash, soft glows, and
centered drop-shadowed UI. None of this touches the simulation in logic.py.

HEADLESS SMOKE MODE:
    Set env GAME_SMOKE_FRAMES=N to run exactly N frames with synthetic input
    (no real window needed; SDL_VIDEODRIVER=dummy), then pygame.quit() and
    sys.exit(0). Used to verify the GUI app runs clean without a display.
"""

import math
import os
import random
import sys

import pygame

import logic

# --- Palette (HEX from the design doc) -------------------------------------
BG_SLATE = (0x0E, 0x13, 0x20)        # deep slate (never pure black)
BG_GRAD = (0x1B, 0x25, 0x40)         # gradient bottom / floor line
SHIP_CYAN = (0x36, 0xE2, 0xC8)
SHIP_OUTLINE = (0x0E, 0x13, 0x20)
SHIP_ACCENT = (0x2B, 0xB6, 0xF6)
ROCK_GREY = (0x8A, 0x93, 0xA6)
ROCK_OUTLINE = (0x5A, 0x61, 0x72)
ROCK_FACET = (0xB7, 0xBE, 0xCD)
HUD_TEXT = (0xF2, 0xF5, 0xFA)
DANGER_RED = (0xFF, 0x5C, 0x6A)
AMBER = (0xFF, 0xC1, 0x4D)

FPS = 60

# Visual-only RNG: kept fully separate from logic's deterministic rng so polish
# can never perturb the simulation / the determinism contract.
_vfx_rng = random.Random(1337)


def _lerp(a, b, f):
    return a + (b - a) * f


def _clampc(c):
    return max(0, min(255, int(c)))


# ---------------------------------------------------------------------------
# Cached background (gradient + parallax starfield)
# ---------------------------------------------------------------------------
def build_background():
    """Pre-render the vertical slate gradient once (720 line draws is wasteful
    per-frame). Returns a fully-opaque Surface the size of the screen."""
    surf = pygame.Surface((logic.SCREEN_W, logic.SCREEN_H))
    h = logic.SCREEN_H
    for i in range(h):
        f = i / h
        col = (
            _clampc(_lerp(BG_SLATE[0], BG_GRAD[0], f)),
            _clampc(_lerp(BG_SLATE[1], BG_GRAD[1], f)),
            _clampc(_lerp(BG_SLATE[2], BG_GRAD[2], f)),
        )
        pygame.draw.line(surf, col, (0, i), (logic.SCREEN_W, i))
    return surf


def make_stars(n=70):
    """A drifting starfield for depth. Each star: [x, y, speed, radius, phase]."""
    stars = []
    for _ in range(n):
        stars.append([
            _vfx_rng.uniform(0, logic.SCREEN_W),
            _vfx_rng.uniform(0, logic.SCREEN_H),
            _vfx_rng.uniform(10, 45),          # downward drift px/s (parallax)
            _vfx_rng.choice([1, 1, 1, 2]),     # mostly small
            _vfx_rng.uniform(0, math.tau),     # twinkle phase
        ])
    return stars


def update_stars(stars, dt, t):
    for s in stars:
        s[1] += s[2] * dt
        if s[1] > logic.SCREEN_H:
            s[1] -= logic.SCREEN_H
            s[0] = _vfx_rng.uniform(0, logic.SCREEN_W)


def draw_stars(surf, stars, t):
    for x, y, _spd, r, phase in stars:
        # gentle twinkle in brightness
        tw = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(t * 2.0 + phase))
        base = 150 if r == 1 else 200
        c = _clampc(base * tw)
        col = (_clampc(c * 0.8), _clampc(c * 0.9), c)
        if r == 1:
            surf.set_at((int(x) % logic.SCREEN_W, int(y) % logic.SCREEN_H), col)
        else:
            pygame.draw.circle(surf, col, (int(x), int(y)), r)


# ---------------------------------------------------------------------------
# Particles (thruster trail + rock impact bursts) — cosmetic only
# ---------------------------------------------------------------------------
class Particle:
    __slots__ = ("x", "y", "vx", "vy", "life", "maxlife", "color", "size")

    def __init__(self, x, y, vx, vy, life, color, size):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.life = life
        self.maxlife = life
        self.color = color
        self.size = size


def spawn_thruster(particles, ship_x, ship_y):
    """A couple of warm exhaust sparks drifting down from the ship nose/fin."""
    cx = ship_x + logic.SHIP_W / 2
    for _ in range(2):
        particles.append(Particle(
            x=cx + _vfx_rng.uniform(-5, 5),
            y=ship_y + logic.SHIP_H * 0.5,
            vx=_vfx_rng.uniform(-22, 22),
            vy=_vfx_rng.uniform(60, 150),
            life=_vfx_rng.uniform(0.25, 0.5),
            color=SHIP_ACCENT,
            size=_vfx_rng.choice([2, 2, 3]),
        ))


def spawn_burst(particles, x, y, color, count=22, spread=240):
    """Radial impact burst, used on death."""
    for _ in range(count):
        ang = _vfx_rng.uniform(0, math.tau)
        spd = _vfx_rng.uniform(spread * 0.3, spread)
        particles.append(Particle(
            x=x, y=y,
            vx=math.cos(ang) * spd,
            vy=math.sin(ang) * spd,
            life=_vfx_rng.uniform(0.35, 0.8),
            color=color,
            size=_vfx_rng.choice([2, 3, 3, 4]),
        ))


def update_particles(particles, dt):
    alive = []
    for p in particles:
        p.life -= dt
        if p.life <= 0:
            continue
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 220 * dt          # light gravity
        p.vx *= (1 - 1.8 * dt)    # drag
        alive.append(p)
    return alive


def draw_particles(surf, particles):
    for p in particles:
        f = max(0.0, min(1.0, p.life / p.maxlife))
        r = max(1, int(p.size * (0.4 + 0.6 * f)))
        d = r * 2
        glow = pygame.Surface((d + 2, d + 2), pygame.SRCALPHA)
        a = _clampc(220 * f)
        pygame.draw.circle(glow, (p.color[0], p.color[1], p.color[2], a),
                           (r + 1, r + 1), r)
        surf.blit(glow, (int(p.x) - r - 1, int(p.y) - r - 1),
                  special_flags=pygame.BLEND_RGBA_ADD)


# ---------------------------------------------------------------------------
# Entities
# ---------------------------------------------------------------------------
def _glow_rect(surf, color, rect, grow=10, alpha=70):
    """Soft additive halo around a rect for a neon read."""
    x, y, w, h = rect
    g = pygame.Surface((w + grow * 2, h + grow * 2), pygame.SRCALPHA)
    pygame.draw.rect(g, (color[0], color[1], color[2], alpha),
                     (0, 0, w + grow * 2, h + grow * 2), border_radius=grow)
    surf.blit(g, (int(x) - grow, int(y) - grow),
              special_flags=pygame.BLEND_RGBA_ADD)


def _draw_shadow_rect(surf, color, rect, radius=4, offset=3):
    """Subtle drop shadow via a darker offset rect."""
    x, y, w, h = rect
    shadow = (max(color[0] - 60, 0), max(color[1] - 60, 0), max(color[2] - 60, 0))
    pygame.draw.rect(surf, shadow, (x + offset, y + offset, w, h), border_radius=radius)


def draw_ship(surf, x, y, t):
    body = (int(x), int(y), logic.SHIP_W, logic.SHIP_H)
    _glow_rect(surf, SHIP_CYAN, body, grow=9, alpha=60)
    _draw_shadow_rect(surf, BG_GRAD, body, radius=6)
    pygame.draw.rect(surf, SHIP_CYAN, body, border_radius=6)
    pygame.draw.rect(surf, SHIP_OUTLINE, body, width=2, border_radius=6)
    # upward thruster/nose triangle in accent color, with a small flicker glow
    cx = x + logic.SHIP_W / 2
    nose = [(cx, y - 12), (cx - 7, y + 4), (cx + 7, y + 4)]
    pygame.draw.polygon(surf, SHIP_ACCENT, nose)
    pygame.draw.polygon(surf, SHIP_OUTLINE, nose, width=2)
    # cockpit highlight
    pygame.draw.circle(surf, ROCK_FACET, (int(cx), int(y + logic.SHIP_H * 0.5)), 2)


def draw_rock(surf, r):
    rect = (int(r.x), int(r.y), int(r.w), int(r.h))
    _draw_shadow_rect(surf, BG_GRAD, rect, radius=3, offset=3)
    pygame.draw.rect(surf, ROCK_GREY, rect, border_radius=3)
    pygame.draw.rect(surf, ROCK_OUTLINE, rect, width=2, border_radius=3)
    # lighter inset facet
    inset = max(4, int(r.w * 0.22))
    facet = (int(r.x) + inset, int(r.y) + inset,
             max(2, int(r.w) - 2 * inset), max(2, int(r.h) - 2 * inset))
    pygame.draw.rect(surf, ROCK_FACET, facet, border_radius=2)


def draw_floor(surf):
    y = logic.FLOOR_Y + logic.SHIP_H + 10
    pygame.draw.line(surf, BG_GRAD, (0, y), (logic.SCREEN_W, y), 2)
    pygame.draw.line(surf, SHIP_ACCENT, (0, y), (logic.SCREEN_W, y), 1)


# ---------------------------------------------------------------------------
# UI text helpers (centered, drop-shadowed)
# ---------------------------------------------------------------------------
def _blit_shadowed(surf, font, text, color, center=None, topleft=None,
                   shadow=(0, 0, 0), soff=2):
    sh = font.render(text, True, shadow)
    fg = font.render(text, True, color)
    if center is not None:
        rect = fg.get_rect(center=center)
    else:
        rect = fg.get_rect(topleft=topleft)
    surf.blit(sh, (rect.x + soff, rect.y + soff))
    surf.blit(fg, rect)
    return rect


def draw_hud(surf, font, small_font, state):
    _blit_shadowed(surf, font, f"SCORE: {state.score}", HUD_TEXT, topleft=(12, 10))
    _blit_shadowed(surf, small_font, f"DODGED: {state.rocks_dodged}", ROCK_FACET,
                   topleft=(12, 40))
    best = small_font.render(f"BEST: {state.high_score}", True, AMBER)
    bsh = small_font.render(f"BEST: {state.high_score}", True, (0, 0, 0))
    bx = logic.SCREEN_W - best.get_width() - 12
    surf.blit(bsh, (bx + 2, 14))
    surf.blit(best, (bx, 12))


def draw_game_over(surf, big_font, font, small_font, state, fade):
    """Centered game-over panel. `fade` in [0,1] eases the overlay in."""
    cx = logic.SCREEN_W // 2
    overlay = pygame.Surface((logic.SCREEN_W, logic.SCREEN_H), pygame.SRCALPHA)
    overlay.fill((BG_SLATE[0], BG_SLATE[1], BG_SLATE[2], int(180 * fade)))
    surf.blit(overlay, (0, 0))

    # subtle pulsing on the headline for life
    pulse = 1.0 + 0.04 * math.sin(pygame.time.get_ticks() * 0.006)
    go = big_font.render("GAME OVER", True, DANGER_RED)
    go = pygame.transform.rotozoom(go, 0, pulse)
    gosh = big_font.render("GAME OVER", True, (40, 8, 12))
    gosh = pygame.transform.rotozoom(gosh, 0, pulse)
    gr = go.get_rect(center=(cx, 268))
    surf.blit(gosh, (gr.x + 3, gr.y + 3))
    surf.blit(go, gr)

    _blit_shadowed(surf, font, f"FINAL SCORE: {state.score}", HUD_TEXT,
                   center=(cx, 326))
    _blit_shadowed(surf, small_font,
                   f"DODGED: {state.rocks_dodged}    BEST: {state.high_score}",
                   ROCK_FACET, center=(cx, 358))

    # blinking restart hint
    if (pygame.time.get_ticks() // 450) % 2 == 0:
        _blit_shadowed(surf, font, "Press R to Restart", AMBER, center=(cx, 408))


def read_direction(keys):
    """Polled, held-key movement. Both pressed cancels to 0."""
    left = keys[pygame.K_LEFT]
    right = keys[pygame.K_RIGHT]
    return (1 if right else 0) - (1 if left else 0)


def main():
    smoke_frames = os.environ.get("GAME_SMOKE_FRAMES")
    smoke = smoke_frames is not None
    if smoke:
        # ensure dummy drivers in case caller forgot
        os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
        os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
        smoke_frames = int(smoke_frames)

    pygame.init()
    try:
        pygame.font.init()
    except Exception:
        pass

    screen = pygame.display.set_mode((logic.SCREEN_W, logic.SCREEN_H))
    pygame.display.set_caption("Rockfall: Last Drift")
    clock = pygame.time.Clock()

    big_font = pygame.font.SysFont("Arial", 44, bold=True)
    font = pygame.font.SysFont("Arial", 24, bold=True)
    small_font = pygame.font.SysFont("Arial", 16)

    bg_surf = build_background()
    world = pygame.Surface((logic.SCREEN_W, logic.SCREEN_H))
    stars = make_stars()
    particles = []

    state = logic.new_game()

    # cosmetic-only feedback state (lives entirely in the renderer)
    shake_t = 0.0          # seconds of screen-shake remaining
    flash_t = 0.0          # seconds of red death-flash remaining
    over_fade = 0.0        # eased game-over overlay alpha [0,1]
    SHAKE_DUR = 0.25
    FLASH_DUR = 0.30

    frame = 0
    running = True
    while running:
        # fixed 60 FPS; dt in seconds (clamped for stability)
        dt = clock.tick(FPS) / 1000.0
        if smoke:
            dt = 1.0 / FPS  # deterministic in headless mode
        dt = min(dt, 0.05)

        # ----- events -----
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                elif event.key == pygame.K_r:
                    state = logic.restart(state)
                    particles = []
                    shake_t = flash_t = over_fade = 0.0

        # ----- synthetic input in smoke mode -----
        if smoke:
            # gently oscillate the ship so movement/clamp paths are exercised
            direction = 1 if (frame // 30) % 2 == 0 else -1
            # restart once mid-run to exercise that path
            if frame == smoke_frames // 2:
                state = logic.restart(state)
                particles = []
                shake_t = flash_t = over_fade = 0.0
        else:
            keys = pygame.key.get_pressed()
            direction = read_direction(keys)

        # ----- update (capture pre-state to detect the death transition) -----
        was_playing = state.state == "PLAYING"
        logic.update(state, direction, dt)
        just_died = was_playing and state.state == "GAME_OVER"
        if just_died:
            shake_t = SHAKE_DUR
            flash_t = FLASH_DUR
            spawn_burst(particles, state.ship_x + logic.SHIP_W / 2,
                        state.ship_y + logic.SHIP_H / 2, DANGER_RED, count=26)
            spawn_burst(particles, state.ship_x + logic.SHIP_W / 2,
                        state.ship_y + logic.SHIP_H / 2, SHIP_CYAN, count=14,
                        spread=160)

        # ----- cosmetic feedback timers / emitters -----
        update_stars(stars, dt, state.t)
        if state.state == "PLAYING":
            spawn_thruster(particles, state.ship_x, state.ship_y)
            over_fade = max(0.0, over_fade - dt * 4)
        else:
            over_fade = min(1.0, over_fade + dt * 4)
        particles = update_particles(particles, dt)
        if shake_t > 0:
            shake_t = max(0.0, shake_t - dt)
        if flash_t > 0:
            flash_t = max(0.0, flash_t - dt)

        # ----- render the WORLD (shaken) onto an offscreen surface -----
        world.blit(bg_surf, (0, 0))
        draw_stars(world, stars, state.t)
        draw_floor(world)
        draw_particles(world, particles)
        for r in state.rocks:
            draw_rock(world, r)
        if state.state == "PLAYING":
            draw_ship(world, state.ship_x, state.ship_y, state.t)

        # ----- compose to screen with subtle shake (<=6px, decays) -----
        screen.fill(BG_SLATE)
        if shake_t > 0:
            mag = 6.0 * (shake_t / SHAKE_DUR)
            ox = int(_vfx_rng.uniform(-mag, mag))
            oy = int(_vfx_rng.uniform(-mag, mag))
        else:
            ox = oy = 0
        screen.blit(world, (ox, oy))

        # red danger flash on death (fades), drawn steady over the shake
        if flash_t > 0:
            a = int(110 * (flash_t / FLASH_DUR))
            flash = pygame.Surface((logic.SCREEN_W, logic.SCREEN_H), pygame.SRCALPHA)
            flash.fill((DANGER_RED[0], DANGER_RED[1], DANGER_RED[2], a))
            screen.blit(flash, (0, 0))

        # HUD + game-over panel drawn steady (not shaken) for readability
        draw_hud(screen, font, small_font, state)
        if state.state == "GAME_OVER":
            draw_game_over(screen, big_font, font, small_font, state, over_fade)

        pygame.display.flip()

        frame += 1
        if smoke and frame >= smoke_frames:
            running = False

    pygame.quit()
    sys.exit(0)


if __name__ == "__main__":
    main()
