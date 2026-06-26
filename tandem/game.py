"""TANDEM — Pygame shell + headless smoke mode.

Run normally:           python game.py
Headless smoke (CI):    GAME_SMOKE_FRAMES=120 SDL_VIDEODRIVER=dummy python game.py

This module is presentation only. ALL game rules live in logic.py and are
imported, never reimplemented here.
"""
import math
import os
import sys

import logic
from logic import Board, DELTAS, FACINGS, pulse, is_win

# ---------------------------------------------------------------------------
# Palette.  The background is a deep slate-blue — deliberately NOT pure black
# (mandatory requirement) — and everything else is tuned to read clearly on it.
# ---------------------------------------------------------------------------
BG_TOP = (30, 35, 52)         # background gradient (top)
BG_BOTTOM = (20, 24, 38)      # background gradient (bottom)
BOARD_FRAME = (58, 66, 92)    # outer frame around the play field
CELL = (44, 50, 70)           # empty cell fill
CELL_HI = (54, 62, 86)        # subtle top-lit edge of a cell
GRID = (74, 84, 112)          # grid lines

A_COLOR = (245, 184, 64)      # carriage A — warm amber
A_COLOR_HI = (255, 214, 130)  # A highlight
B_COLOR = (72, 206, 206)      # carriage B — cool teal
B_COLOR_HI = (150, 238, 238)  # B highlight
CARRIAGE_INK = (24, 28, 38)   # arrow + letter ink on a carriage

OBSTACLE = (118, 124, 142)    # obstacle body
OBSTACLE_HI = (150, 156, 174) # obstacle bevel
OBSTACLE_DK = (84, 90, 106)   # obstacle shadow

HUD_BG = (16, 19, 28)         # HUD strip background
HUD_LINE = (58, 66, 92)       # hairline above the HUD
TEXT = (232, 236, 247)        # primary HUD text
TEXT_DIM = (158, 166, 188)    # secondary HUD text
PULSE_CHIP = (60, 70, 98)     # rounded chip behind the pulse counter
HILITE = (255, 255, 255)      # "currently editing" selection ring
SHADOW = (12, 14, 22)         # generic drop shadow

STALL_TINT = (210, 78, 78)    # red wash + shake when a pulse does nothing
PULSE_FLASH = (255, 255, 255) # expanding ring on a successful pulse
WIN_BANNER = (104, 214, 138)  # win banner text
WIN_GLOW = (104, 214, 138)    # win banner glow / overlay tint

CELL_SIZE = 96
MARGIN = 18
HUD_H = 108

# Feedback timing (frames @ 60 FPS).
FLASH_FRAMES = 18             # successful-pulse ring lifetime
SHAKE_FRAMES = 16             # stall shake / red-wash lifetime

# Smoke-mode cadence: deterministic facing pairs cycled every 15 frames.
SMOKE_PAIRS = [('R', 'R'), ('L', 'L'), ('D', 'U'), ('U', 'D'), ('R', 'L')]


def initial_board() -> Board:
    # Level 1: the 1x6 golden-trace corridor.
    return Board(rows=1, cols=6, a=(0, 1), b=(0, 2), obstacles=frozenset())


def _facing_from_key(key, scheme):
    import pygame
    if scheme == 'A':
        return {
            pygame.K_UP: 'U', pygame.K_DOWN: 'D',
            pygame.K_LEFT: 'L', pygame.K_RIGHT: 'R',
        }.get(key)
    else:  # B uses I/J/K/L
        return {
            pygame.K_i: 'U', pygame.K_k: 'D',
            pygame.K_j: 'L', pygame.K_l: 'R',
        }.get(key)


# ---------------------------------------------------------------------------
# Small drawing helpers.
# ---------------------------------------------------------------------------
def _vertical_gradient(pygame, surf, top, bottom):
    """Fill `surf` with a smooth top->bottom vertical gradient."""
    h = surf.get_height()
    w = surf.get_width()
    for y in range(h):
        t = y / max(1, h - 1)
        col = (
            int(top[0] + (bottom[0] - top[0]) * t),
            int(top[1] + (bottom[1] - top[1]) * t),
            int(top[2] + (bottom[2] - top[2]) * t),
        )
        pygame.draw.line(surf, col, (0, y), (w, y))


def _lerp(c1, c2, t):
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def _draw_arrow(pygame, surf, center, facing, color):
    """A clean equilateral chevron pointing in `facing`."""
    cx, cy = center
    s = CELL_SIZE // 4
    dr, dc = DELTAS[facing]
    tip = (cx + dc * s, cy + dr * s)
    if dr == 0:  # horizontal
        base1 = (cx - dc * (s // 2), cy - s // 2)
        base2 = (cx - dc * (s // 2), cy + s // 2)
    else:        # vertical
        base1 = (cx - s // 2, cy - dr * (s // 2))
        base2 = (cx + s // 2, cy - dr * (s // 2))
    pygame.draw.polygon(surf, color, [tip, base1, base2])


def _draw_carriage(pygame, surf, rect, base, hi, letter, facing, bigfont,
                   selected, t_pulse):
    """A glossy rounded carriage: drop shadow, body, top highlight, facing
    chevron, big letter, and (optionally) a selection ring."""
    # Drop shadow.
    shadow = rect.move(0, 4)
    pygame.draw.rect(surf, SHADOW, shadow, border_radius=12)

    # Body.
    pygame.draw.rect(surf, base, rect, border_radius=12)

    # Top-half highlight band for a subtle 3D sheen.
    hi_rect = pygame.Rect(rect.x, rect.y, rect.w, rect.h // 2)
    hi_surf = pygame.Surface((hi_rect.w, hi_rect.h), pygame.SRCALPHA)
    pygame.draw.rect(hi_surf, (*hi, 90), hi_surf.get_rect(),
                     border_top_left_radius=12, border_top_right_radius=12)
    surf.blit(hi_surf, hi_rect.topleft)

    center = rect.center

    # Facing chevron (slightly offset toward facing so the letter stays clear).
    dr, dc = DELTAS[facing]
    arr_center = (center[0] + dc * (CELL_SIZE // 10),
                  center[1] + dr * (CELL_SIZE // 10))
    _draw_arrow(pygame, surf, arr_center, facing, CARRIAGE_INK)

    # Big letter, nudged opposite the chevron for balance.
    label = bigfont.render(letter, True, CARRIAGE_INK)
    lbl_center = (center[0] - dc * (CELL_SIZE // 12),
                  center[1] - dr * (CELL_SIZE // 12))
    surf.blit(label, label.get_rect(center=lbl_center))

    # Selection ring for the carriage currently being edited.
    if selected:
        pygame.draw.rect(surf, HILITE, rect, width=3, border_radius=12)

    # Expanding pulse ring (fades out over FLASH_FRAMES).
    if t_pulse > 0:
        prog = 1.0 - (t_pulse / FLASH_FRAMES)
        radius = int(CELL_SIZE * (0.35 + 0.45 * prog))
        alpha = int(180 * (1.0 - prog))
        ring = pygame.Surface((radius * 2 + 4, radius * 2 + 4), pygame.SRCALPHA)
        pygame.draw.circle(ring, (*PULSE_FLASH, alpha),
                           (radius + 2, radius + 2), radius, width=3)
        surf.blit(ring, (center[0] - radius - 2, center[1] - radius - 2))


def _draw_obstacle(pygame, surf, rect):
    """A beveled steel block, clearly distinct from a carriage."""
    pygame.draw.rect(surf, SHADOW, rect.move(0, 3), border_radius=8)
    pygame.draw.rect(surf, OBSTACLE, rect, border_radius=8)
    # Bevel: light top-left, dark bottom-right.
    pygame.draw.line(surf, OBSTACLE_HI, (rect.left + 4, rect.top + 4),
                     (rect.right - 6, rect.top + 4), 3)
    pygame.draw.line(surf, OBSTACLE_HI, (rect.left + 4, rect.top + 4),
                     (rect.left + 4, rect.bottom - 6), 3)
    pygame.draw.line(surf, OBSTACLE_DK, (rect.left + 6, rect.bottom - 4),
                     (rect.right - 4, rect.bottom - 4), 3)
    pygame.draw.line(surf, OBSTACLE_DK, (rect.right - 4, rect.top + 6),
                     (rect.right - 4, rect.bottom - 4), 3)


# ---------------------------------------------------------------------------
# Frame render.
# ---------------------------------------------------------------------------
def _render(pygame, screen, font, smallfont, bigfont, bgcache, board,
            fA, fB, editing, pulses, won, t_pulse, t_shake, t):
    # Background gradient (cached — gradient fill is the one slow op).
    screen.blit(bgcache, (0, 0))

    board_w = board.cols * CELL_SIZE
    board_h = board.rows * CELL_SIZE

    # Stall shake: jitter the whole board horizontally, decaying over time.
    shake_x = 0
    if t_shake > 0:
        amp = 6 * (t_shake / SHAKE_FRAMES)
        shake_x = int(round(amp * math.sin(t_shake * 1.7)))

    ox, oy = MARGIN + shake_x, MARGIN

    # Outer board frame.
    frame = pygame.Rect(ox - 6, oy - 6, board_w + 12, board_h + 12)
    pygame.draw.rect(screen, BOARD_FRAME, frame, border_radius=14)

    # Cells with grid lines and a faint top sheen.
    for r in range(board.rows):
        for c in range(board.cols):
            rect = pygame.Rect(ox + c * CELL_SIZE + 2, oy + r * CELL_SIZE + 2,
                               CELL_SIZE - 4, CELL_SIZE - 4)
            pygame.draw.rect(screen, CELL, rect, border_radius=8)
            sheen = pygame.Rect(rect.x, rect.y, rect.w, max(3, rect.h // 6))
            pygame.draw.rect(screen, CELL_HI, sheen,
                             border_top_left_radius=8, border_top_right_radius=8)
            pygame.draw.rect(screen, GRID, rect, width=1, border_radius=8)

    # Red wash on a stalled pulse.
    if t_shake > 0:
        wash = pygame.Surface((board_w, board_h), pygame.SRCALPHA)
        wash.fill((*STALL_TINT, int(70 * (t_shake / SHAKE_FRAMES))))
        screen.blit(wash, (ox, oy))

    def cell_rect(pos, inset=10):
        r, c = pos
        return pygame.Rect(ox + c * CELL_SIZE + inset, oy + r * CELL_SIZE + inset,
                           CELL_SIZE - 2 * inset, CELL_SIZE - 2 * inset)

    for o in board.obstacles:
        _draw_obstacle(pygame, screen, cell_rect(o, inset=12))

    _draw_carriage(pygame, screen, cell_rect(board.a), A_COLOR, A_COLOR_HI,
                   'A', fA, bigfont, editing == 'A', t_pulse)
    _draw_carriage(pygame, screen, cell_rect(board.b), B_COLOR, B_COLOR_HI,
                   'B', fB, bigfont, editing == 'B', t_pulse)

    # When the carriages are adjacent, draw a soft coupling link between them.
    if is_win(board):
        ca = cell_rect(board.a).center
        cb = cell_rect(board.b).center
        link = pygame.Surface((screen.get_width(), screen.get_height()),
                              pygame.SRCALPHA)
        glow = 120 + int(80 * (0.5 + 0.5 * math.sin(t * 0.18)))
        pygame.draw.line(link, (*WIN_GLOW, glow), ca, cb, 8)
        screen.blit(link, (0, 0))

    # ------------------------------------------------------------------ HUD.
    hud_y = oy + board_h + MARGIN
    sw = screen.get_width()
    pygame.draw.rect(screen, HUD_BG,
                     pygame.Rect(0, hud_y, sw, screen.get_height() - hud_y))
    pygame.draw.line(screen, HUD_LINE, (0, hud_y), (sw, hud_y), 2)

    # Pulse counter chip (top-right of the HUD).
    pulse_label = smallfont.render("PULSES", True, TEXT_DIM)
    pulse_num = bigfont.render(str(pulses), True, TEXT)
    chip_w = max(pulse_label.get_width(), pulse_num.get_width()) + 28
    chip = pygame.Rect(sw - chip_w - MARGIN, hud_y + 12, chip_w, 64)
    pygame.draw.rect(screen, PULSE_CHIP, chip, border_radius=10)
    screen.blit(pulse_label, pulse_label.get_rect(
        midtop=(chip.centerx, chip.top + 8)))
    screen.blit(pulse_num, pulse_num.get_rect(
        midbottom=(chip.centerx, chip.bottom - 4)))

    # Status + controls (left side of the HUD).
    title = font.render("TANDEM", True, TEXT)
    screen.blit(title, (MARGIN, hud_y + 10))

    status = f"A facing {fA}   B facing {fB}   editing {editing}"
    screen.blit(smallfont.render(status, True, TEXT_DIM),
                (MARGIN, hud_y + 40))

    controls = ("Arrows: A facing   I/J/K/L: B facing   Tab: switch   "
                "Space: PULSE   R: restart   Q: quit")
    screen.blit(smallfont.render(controls, True, TEXT_DIM),
                (MARGIN, hud_y + 66))

    # ----------------------------------------------------------- Win banner.
    if won:
        # Pulsing translucent overlay tint across the play field.
        pulse_a = 26 + int(22 * (0.5 + 0.5 * math.sin(t * 0.18)))
        overlay = pygame.Surface((board_w + 12, board_h + 12), pygame.SRCALPHA)
        overlay.fill((*WIN_GLOW, pulse_a))
        screen.blit(overlay, (ox - 6, oy - 6))

        text = bigfont.render("COUPLED!  Press R to play again.", True,
                              WIN_BANNER)
        pad = 16
        banner = pygame.Rect(0, 0, text.get_width() + pad * 2,
                             text.get_height() + pad)
        banner.center = (MARGIN + board_w // 2, oy + board_h // 2)
        bsurf = pygame.Surface(banner.size, pygame.SRCALPHA)
        pygame.draw.rect(bsurf, (12, 16, 22, 215), bsurf.get_rect(),
                         border_radius=12)
        pygame.draw.rect(bsurf, (*WIN_GLOW, 220), bsurf.get_rect(), width=3,
                         border_radius=12)
        screen.blit(bsurf, banner.topleft)
        screen.blit(text, text.get_rect(center=banner.center))


def main():
    frames = os.environ.get("GAME_SMOKE_FRAMES")
    if frames:
        os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
        os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

    import pygame
    pygame.init()

    board = initial_board()
    pristine = board
    fA, fB = 'R', 'R'
    editing = 'A'
    pulses = 0
    won = is_win(board)
    t_pulse = 0   # successful-pulse flash countdown
    t_shake = 0   # stall shake countdown

    width = board.cols * CELL_SIZE + 2 * MARGIN
    height = board.rows * CELL_SIZE + 2 * MARGIN + HUD_H
    screen = pygame.display.set_mode((width, height))
    pygame.display.set_caption("TANDEM")
    clock = pygame.time.Clock()

    # Pre-render the background gradient once.
    bgcache = pygame.Surface((width, height))
    _vertical_gradient(pygame, bgcache, BG_TOP, BG_BOTTOM)

    try:
        font = pygame.font.SysFont("Arial", 22, bold=True)
        smallfont = pygame.font.SysFont("Arial", 16)
        bigfont = pygame.font.SysFont("Arial", 34, bold=True)
    except Exception:
        font = pygame.font.Font(None, 26)
        smallfont = pygame.font.Font(None, 20)
        bigfont = pygame.font.Font(None, 38)

    def do_pulse(fa, fb):
        nonlocal board, pulses, won, t_pulse, t_shake
        new = pulse(board, fa, fb)
        stalled = (new.a == board.a and new.b == board.b
                   and new.obstacles == board.obstacles)
        board = new
        pulses += 1
        won = is_win(board)
        if stalled:
            t_shake = SHAKE_FRAMES
        else:
            t_pulse = FLASH_FRAMES

    def reset():
        nonlocal board, fA, fB, pulses, won, t_pulse, t_shake, editing
        board = pristine
        fA, fB = 'R', 'R'
        pulses = 0
        won = is_win(board)
        t_pulse = 0
        t_shake = 0
        editing = 'A'

    smoke = bool(frames)
    n_frames = int(frames) if smoke else None
    frame = 0
    running = True

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and not smoke:
                if event.key in (pygame.K_ESCAPE, pygame.K_q):
                    running = False
                elif event.key == pygame.K_r:
                    reset()
                elif won:
                    pass  # board frozen except R / QUIT
                elif event.key == pygame.K_TAB:
                    editing = 'B' if editing == 'A' else 'A'
                elif event.key in (pygame.K_SPACE, pygame.K_RETURN):
                    do_pulse(fA, fB)
                else:
                    fa = _facing_from_key(event.key, 'A')
                    if fa:
                        fA = fa
                    fb = _facing_from_key(event.key, 'B')
                    if fb:
                        fB = fb

        if smoke:
            # Auto-pulse on a cadence to exercise the engine + every visual.
            if frame > 0 and frame % 15 == 0:
                pair = SMOKE_PAIRS[(frame // 15) % len(SMOKE_PAIRS)]
                if won:
                    reset()
                do_pulse(*pair)

        _render(pygame, screen, font, smallfont, bigfont, bgcache, board,
                fA, fB, editing, pulses, won, t_pulse, t_shake, frame)
        pygame.display.flip()
        clock.tick(60)

        if t_pulse > 0:
            t_pulse -= 1
        if t_shake > 0:
            t_shake -= 1

        frame += 1
        if smoke and frame >= n_frames:
            running = False

    pygame.quit()
    sys.exit(0)


if __name__ == "__main__":
    main()
