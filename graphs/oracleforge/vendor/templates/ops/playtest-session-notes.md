# TEMPLATE — playtest session notes (Cabal-style fill-in sheet)

Instantiate per observed session into `docs/playtests/<date>-<tester>.md`.
The Stage 1 and Stage 3 gates check that these files exist; the
observed-playtest skill defines the protocol that fills them.

```
## Session
date:        YYYY-MM-DD
build:       <git hash> / pack <version>
tester:      <name>  circle: self | confidant | stranger
levels:      <keys played, in order>
observer:    <name> (silent during play)

## Per-level notes
### <level key>
| t | event | frame/move ref | note / verbatim quote |
|---|-------|----------------|------------------------|
|   | stuck-point / misread rule / surprise / quit |  |  |

(retro-interview at marked stuck-points: "what were you thinking here?")

## Action items
| # | tag U/D/P | item | evidence (session ts) | fix state | verified by k fresh |
|---|-----------|------|------------------------|-----------|---------------------|
| 1 | U |  |  | observed → diagnosed → fixed → verified | 0/3 |
```

Tags: **U** usability (fix on clear diagnosis — single observation
suffices) · **D** difficulty calibration (wait for the week's matrix) ·
**P** preference (needs stranger-circle data; discount confidants).

Canon: Birdwell's Cabal process notes (1999); RITE (Medlock et al. 2002);
Ericsson & Simon (1993) on retrospective probes. Dossier:
`docs/research/playtest-methods.md`.
