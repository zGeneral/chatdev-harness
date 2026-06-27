# Fruit Catch

A tiny, forgiving casual game: move the basket (←/→) to catch falling fruit.
Each catch scores a point and speeds the fall slightly; one miss ends the game
(press **R** to restart). Close the window to quit.

## Layout
- `logic.py` — pure simulation, **zero** pygame import. Deterministic via injected `random.Random`.
- `game.py` — pygame shell + headless smoke mode.
- `test_logic.py` — pure pytest suite (no pygame, no display).

## Install
```
pip install -r requirements.txt
```

## Run
```
python game.py
```

## Test
```
python -m pytest -q
```

## Headless smoke (CI / no display)
Runs exactly N frames then exits cleanly with code 0:
```
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy GAME_SMOKE_FRAMES=120 python game.py
```
`game.py` forces the dummy video driver itself when `GAME_SMOKE_FRAMES` is set.

## Design notes
- One fruit in play at a time; catch detection is generous AABB overlap
  (basket 90px wide vs. fruit 36px) so near-misses feel fair (Adams: forgiveness).
- All feel/pacing values live in `Config` in `logic.py` for one-line tuning.
- Background is never pure black; a visible ground band anchors the play space
  and the HUD sits top-left (Moore: readability).
