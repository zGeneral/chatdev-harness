# oracleforge → ChatDev-harness graph mapping

Maps oracleforge's 8-stage **idea→beta** pipeline (`oracleforge/PIPELINE.md`) onto our declarative
graph engine (`.claude/workflows/chatdev-graph.js`), adding the harness's features: **real execution**
(solvers/censuses/tests actually run and gate), **retrievable + self-growing memory** (lessons + books),
and the **GUI**. `oracleforge` stays read-only; graphs live here in `graphs/oracleforge/`; build
artifacts land in throwaway dirs under `chatdev_harness/`.

## Two-memory wiring (already provisioned)
- **personal-rag `oforge-lessons`** (LESSONS.md + PIPELINE.md + CANON.md, ingested) + **`game-design`**
  (Adams/Moore books) = *read* grounding for every stage's `recall`.
- **chatdev-memory `lessons:ideation`** (+ future `lessons:foundation`, …) = *write* store; each stage's
  `reflect` appends new verified lessons (the self-improving loop).

## Engine features used
- `join: true` fan-in node → **councils/panels** (independent critics → one synthesizer). *(added for this.)*
- `agent` nodes that `Read` oracleforge `agents/*.md` (canonical roles, DRY) and `templates/*` (patterns).
- `agent` nodes with Bash → **real solvers / censuses / `pytest` / `node --test`** (the upgrade over self-cert).
- conditional edges (`contains:`/`default`) → **gates**; `loop_counter` → generate-and-test / fix loops.
- `memory` nodes (secure file-based) → recall/store.

## Stage → graph map

| oracleforge stage | graph | shape | gate (real) |
|---|---|---|---|
| Pre-0 Ideation + **Stage 0 Oracle-fit** | **`ideate.yaml`** ✅ | recall → council(4 critics, join) → synthesize → **oracle_probe (build+run engine+BFS+census)** → verdict → reflect | golden-trace `pytest` green **and** healthy measured census |
| **Stage 1 Deterministic foundation** | `foundation.yaml` | recall → build(engine+solver TDD) → golden-traces → equivalence-check → review → verify | `node --test`/`pytest` green: goldens + completeness + twin-run + purity + solver↔engine equivalence |
| **Stage 2 Difficulty contract** | `difficulty.yaml` | recall(beliefs) → author-gates → build contract-tests → verify(soft-fail/starter-pass) | contract tests FAIL on soft fixtures, PASS on starter band |
| **Stage 3 Content engine** | `content.yaml` | curriculum-graph → [generate-and-test per insight, loop] → expressive-range census → rejection-census → curator review | pack baked at CI budget; curriculum covered; per-gate rejection census |
| **Stage 4 Shell & retention** | `shell.yaml` | spec shell+modes+hint-ladder → build → ethics-audit(read-only) → verify | mode-determinism tests; dark-pattern audit zero-unmitigated; ≤90s TTFS *(human playtest noted, not auto)* |
| **Stage 5 Creation & sharing** | `share.yaml` | spec codec+migrations → build → verify | codec roundtrip/fuzz + reducer + migration-fixture tests green |
| **Stage 6 Ship** | `ship.yaml` | build PWA + Cloudflare Worker → smoke tests → ethics reaudit | page 200 / comment 204 / junk 400 / hint-scarcity smoke; version-sync green |
| **Stage 7 Beta loop** | `rebalance.yaml` | analyze(playtest-analyst) → worklist(level-curator) → (apply+rebake noted) | maps `nightly-rebalance.workflow.js` |
| (orchestrator) | `pipeline.yaml` | `subgraph` nodes chaining 0→7 with gates | run stage-by-stage in practice (full chain = a whole game build) |

## Honest scope notes
- **Fully auto-gated by real execution:** Stages 0,1,2,3,5,6 + 7 — solvers/tests/censuses/smoke run and
  produce ✓/✗. These are where the harness most improves oracleforge (no self-certified gates).
- **Human-in-the-loop (scaffold + drive, not fully auto):** the *human playtests* in Stages 1/3/4/7 and
  the live-preview checks in Stage 4 — the graphs prepare/drive these but a person still plays. Faithful to
  oracleforge (which also keeps humans there); the graph automates everything around them.
- `pipeline.yaml` is the spine; running it end-to-end builds+ships a whole game (hours) — normally you run
  one stage graph at a time and inspect the gate.

## Status
- [x] engine `join` fan-in + unit-tested (councils); existing graphs unaffected
- [x] memory grounding ingested (personal-rag `oforge-lessons` = LESSONS+PIPELINE+CANON; `game-design` = books)
- [x] self-contained: oracleforge agents + solver/engine/ops templates vendored under `vendor/`
- [x] portable: zero hardcoded absolute paths (relative from repo root; build steps capture `ROOT=$PWD`)
- [x] all 8 stage graphs authored + parse/structure-validated; browsable in the GUI
- [x] `ideate.yaml` **run-verified on Tandem** (real oracle/census executes)
- [x] `memory_demo` run-verified on the refactored (relative-path) engine
- [~] `foundation/difficulty/content/shell/share/ship/rebalance` authored + structurally validated; share
      every run-verified primitive with ideate (recall, vendored-agent reads, build→verify loop, reflect),
      but not each run end-to-end (a full stage run builds/ships a whole game — run them per-game as needed)

## How to run
- One stage: `/run-graph graphs/oracleforge/<stage>.yaml` with `args.input` = that stage's input
  (an idea/spec for ideate; the prior stage's output for later stages), or browse/run via the GUI.
- Full pipeline = the 8 graphs in order, gating between them (the engine doesn't self-invoke sub-workflows
  — by sandbox design — so stages are driven one at a time, as oracleforge itself does).
