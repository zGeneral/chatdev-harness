# Baffle — Art Direction (the whole-game feel, decided BEFORE the pixels)

The factory shipped Baffle mechanically perfect and visually dead: three near-identical grey/brown
bars for the three wall states, bare arrow-chevrons for the birds, and — worst — **Run didn't even
animate** (it jumped to the final frame). This document is the one mind holding the feel; everything
downstream serves it.

## The fantasy (one sentence)
**You're tending a flock of tiny, slightly-panicked seabird chicks waddling across a sunny tide-pool,
and you nudge them home by fencing off the wrong turns with little driftwood planks.**
The payoff is *watching the herd bank around a corner you carved* and plop into the whirlpool. That
watch-the-flock-flow moment is the product. If Run doesn't play the flock tick-by-tick, there is no game.

## Genre & references
A cute, sunny puzzle-toy. Touchstones: **ChuChu Rocket!** (the herd-routing joy), **Pikmin** (adorable
followers), a children's-book tide-pool. Warm, tactile, friendly — never a flat dev-grid, never noir.

## The three wall states MUST read instantly (the #1 reported failure)
They differ by **hue + shape + behaviour**, not three shades of the same bar:
| State | Reads as | Form | Colour |
|---|---|---|---|
| **empty placeable** | "you can build here" | a faint **dotted guide** along the edge | recessed teal, low-opacity |
| **pre-wall (fixed)** | immovable shore rock | a **barnacled stone bar**, chunky, rounded, with light barnacle dots | cool slate-blue |
| **placed (yours)** | your fresh driftwood | a **honey-timber plank** with wood-grain lines + a placement *pop* | warm amber/orange |
A player must tell all three apart in a glance with colour-blindness simulated — that's why shape
carries the difference too.

## The birds are CREATURES, not arrows
A round chick: plump body, cream belly, a folded wing, a big dark eye, and a **triangular beak that
points the heading** (the beak IS the facing — you read direction from the face, not an abstract arrow),
two little feet. A gentle idle bob. Warm coral body. Adorable and unmistakably directional.

## The drain is a WHIRLPOOL
Not a flat ring: concentric swirl arcs in aqua→teal with a gold rim, slowly rotating — an inviting
"bring them here" vortex. Delivery = a chick spins down into it with a splash.

## The board is a tide-pool, not a spreadsheet
Two-tone warm **sand** tiles (a soft checker), faint wet-sand gridlines, a gentle pool vignette. It
should look like somewhere small creatures live, not a grid of cells.

## Motion / juice (eased, never linear; respects reduced-motion) — THE HERO
- **Run = play the recorded frames tick-by-tick.** Each chick eases cell→cell, **banks** into its turns
  (a little rotational overshoot), and **waddles** (a tiny vertical bob) as it moves. This is non-negotiable.
- **Deliver:** the chick spins down into the whirlpool + a splash ring; a happy bounce on the count.
- **Fail:** the boxed/collided chick does a small shake + a worried wobble, then the result banner.
- **Place a plank:** a satisfying spring-pop. **Lift:** it fades out.
- Reduced-motion: snap to the final frame, opacity cross-fades only.

## Copy & identity
In-character and warm: "Bank the flock home." "Fence off the wrong turns." Keep the spec nouns
(tern / flock / groyne / drain / tide). No dev-speak, no "cell N".

## Anti-goals (the exact failures we're fixing)
- ✗ three near-identical bars for empty/pre/placed  ✗ a bare arrow standing in for a creature
- ✗ Run that snaps to the end without playing the flock  ✗ flat white cells  ✗ static, dull, lifeless.

## Definition of done (judged on RENDERED pixels + the played run, not the DOM)
A stranger, watching one Run: (1) instantly tells the three wall states apart, (2) goes "aww" at the
chicks, (3) *sees* the flock flow and bank around the planks, (4) says "that's a real little game."
If a screenshot or a played run doesn't clear that bar, iterate.
