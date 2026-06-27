# oracleforge pipeline → ChatDev-harness graphs

This directory maps **oracleforge**'s 8-stage *idea → beta* pipeline for building provably-solvable
puzzle games onto the harness's declarative graph engine, adding the harness's features: **real
execution** (solvers/censuses/tests actually run and gate), **retrievable + self-growing memory**, and
the **GUI**. See [`PLAN.md`](PLAN.md) for the full stage→graph mapping and rationale.

## Autonomous factory (idea → production in ONE run)
**`factory.yaml`** is the assembly line: give it a game idea and it runs **Stage 0→6 autonomously** on a
shared `./out/factory/` directory, producing a shippable JS/web game (PWA + Cloudflare Worker). Each stage
**build → independent verify → bounded retry**; a stage that can't pass stops cleanly at `blocked_build`,
an oracle-unfit idea stops at `blocked_idea`, and success ends `PRODUCTION: READY`. Every gate is
re-checked by a separate verifier that re-runs the real `node --test` (a stage can't self-certify a fake
green). Hardened by an adversarial review (anchored gate markers; canonical layout; on-exhaust routing).
```
/run-graph graphs/oracleforge/factory.yaml   with args.input = "<your game idea>"
```

## The stage graphs (run one at a time with `/run-graph graphs/oracleforge/<name>.yaml`)
| graph | oracleforge stage | real gate |
|---|---|---|
| `ideate.yaml` | Ideation + **Oracle-fit (Stage 0)** | council (independent critics, fan-in) **+ an oracle/yield-census that actually executes** |
| `foundation.yaml` | Stage 1 — deterministic engine + exact solver | golden-trace / solver↔engine-equivalence `pytest` green |
| `difficulty.yaml` | Stage 2 — difficulty contract | contract tests FAIL on soft fixtures, PASS on the starter band |
| `content.yaml` | Stage 3 — content engine | solver-gated generate-and-test until the curriculum is covered |
| `shell.yaml` | Stage 4 — shell & retention | mode-determinism tests + dark-pattern audit *(human playtest noted)* |
| `share.yaml` | Stage 5 — creation & sharing | codec roundtrip/fuzz + migration-fixture tests |
| `ship.yaml` | Stage 6 — ship | local smoke tests (200/204/400/429) + version-sync |
| `rebalance.yaml` | Stage 7 — beta loop | playtest-analyst + level-curator over comments × metrics |

Every graph: **recall** (grounds in the `oforge-lessons` + `game-design` notebooks) → work → **real
gate** → **reflect** (stores a new lesson in `chatdev-memory` `lessons:<stage>`). Each run makes the
factory a little smarter.

## Self-contained
`vendor/` holds copies of oracleforge's role prompts (`agents/*.md`) and its `solver`/`engine`/`ops`
templates, so these graphs run **without** the external `oracleforge` repo present. They are vendored
(snapshot) copies — the canonical source is the oracleforge project; refresh them if it evolves.

## Memory provisioning (one-time, owner only)
- personal-rag notebook `oforge-lessons` ← `oracleforge` `docs/LESSONS.md` + `PIPELINE.md` + `docs/CANON.md`.
- personal-rag notebook `game-design` ← the puzzle/casual design books.
- `chatdev-memory` namespaces `lessons:<stage>` grow automatically from each graph's `reflect`.
Graphs degrade gracefully (print "MEMORY UNAVAILABLE") for anyone without a personal-rag backend.
