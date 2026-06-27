# Understanding ChatDev — and what the harness reimplements

Reference (read-only): the original ChatDev source repo. The classic "virtual software
company" engine lives on the **`chatdev1.0`** branch (the current main branch is a
2.0 YAML-graph rewrite). Paper: Wu et al., *Communicative Agents for Software
Development* (ChatDev). This document caches the architecture so we never re-read the repo.

---

## 1. Roles — `CompanyConfig/Default/RoleConfig.json`
A virtual company of 9 role-agents (7 core + 2 optional), each a system prompt
("You are Programmer. We are both working at ChatDev … Here is a new customer's task: {task}."):

| Role | Responsibility |
|---|---|
| Chief Executive Officer (CEO) | Decisions, strategy; initiates most phases |
| Chief Product Officer (CPO) | Product/modality decisions, manual |
| Chief Technology Officer (CTO) | Tech/language decisions; drives coding |
| **Programmer** | Implements code from specs |
| **Code Reviewer** | Finds bugs, suggests improvements |
| **Software Test Engineer** | Runs the program, reports errors |
| CHRO / Counselor / CCO | Optional: HR, advice, UI art |

Roles pair up two-at-a-time per phase (one "user"/instructor, one "assistant"/worker).

## 2. Phases / chat-chain — `ChatChainConfig.json` + `PhaseConfig.json`, driven by `chatdev/chat_chain.py`
8 sequential phases; loops are `ComposedPhase`, single shots are `SimplePhase`:

1. **DemandAnalysis** (CEO↔CPO) — choose modality. *Pure dialogue.*
2. **LanguageChoose** (CEO↔CTO) — choose language. *Pure dialogue.*
3. **Coding** (CTO↔Programmer) — write initial code.
4. **CodeCompleteAll** (CTO↔Programmer, ≤10×) — fill unimplemented methods; break when no `unimplemented_file`.
5. **CodeReview** (Programmer↔Reviewer, ≤3×) — `CodeReviewComment`→`CodeReviewModification`; break on `<INFO> Finished`.
6. **Test** (Tester↔Programmer, ≤3×) — `TestErrorSummary`→`TestModification`; break when no bugs.
7. **EnvironmentDoc** (CPO↔CTO) — write `requirements.txt`.
8. **Manual** (CPO↔CEO) — write `manual.md`.

## 3. Two-agent dialogue loop — `chatdev/phase.py::Phase.chatting()`
Each phase is a `RolePlaying` seminar: instructor and worker role-flip, up to
`chat_turn_limit` (default 10) turns (user→assistant→user…). A phase converges when a
response contains the **`<INFO>`** marker (the conclusion is `split("<INFO>")[-1]`),
else it runs to the turn limit (optionally appending `<INFO>` via self-reflection).

## 4. Iteration & termination
`ComposedPhase.execute()` loops `cycleNum` times, each calling `break_cycle()`:
- CodeCompleteAll → break when `unimplemented_file == ""`.
- CodeReview → break when `"<INFO> Finished"` in the modification conclusion.
- Test → break when `exist_bugs_flag` is false.
The chain itself runs phases strictly in order (`execute_chain()`).

## 5. Memory model — `chatdev/chat_env.py::ChatEnv`
One `ChatEnv` object flows through the whole chain. It carries `codes` (the parsed
codebase), `requirements`/`manuals` (Documents), and `env_dict` with keys like
`task_prompt`, `modality`, `language`, `review_comments`, `error_summary`,
`test_reports`. Each phase reads upstream conclusions from `env_dict` / `get_codes()`
and writes its own results back via `update_chat_env()`. **No per-agent memory** — the
shared blackboard *is* the memory; the evolving code is re-serialized into prompts.

## 6. CRITICAL — how code reaches disk, and how "real" execution is
**Agents have NO tools.** They only emit markdown in dialogue. A separate orchestration
layer turns prose into files:
- **Regex extraction** — `chatdev/codes.py` parses ```code blocks``` out of message text
  with `r"(.+?)\n```.*?\n(.*?)```"`, guesses the filename from the preceding line, and
  accumulates `codebooks[filename] = code`.
- **File write** — `Codes._rewrite_codes()` writes each `codebook` entry to `WareHouse/`.
- **Execution IS real but crude** — `ChatEnv.exist_bugs()` runs
  `cd <dir>; ls -l; python3 main.py;` via `subprocess`, **sleeps 3 seconds**, SIGTERMs if
  still running, and returns "bug" only if stderr contains `Traceback`. That's the entire
  "test": *did it crash within 3 seconds?* There is **no test suite, no assertions, no
  pytest** — and the "Test Engineer" never writes a test, it just reads the crash output.

**Fair net characterization:** ChatDev is *dialogue-first*. Its win was showing role-play
multi-agent collaboration produces software; it does close a real run→error→fix loop. But
(a) agents can't touch the filesystem — code is regex-scraped from prose, so a mislabeled
fence or chatty preamble silently corrupts a file; (b) "verification" is a 3-second
smoke-run grepping for `Traceback`, not behavioral testing; (c) two of eight phases are
pure chit-chat; (d) there is no TDD and no notion of a passing test as the success signal.

## 7. Output — `WareHouse/<Project>_<Org>_<Timestamp>/`
`main.py` + other `.py` files (regex-extracted), `requirements.txt` (EnvironmentDoc),
`manual.md` (Manual), optional per-phase `.git` snapshots.

---

## Concept → harness mapping (Phase A exit criterion)

| ChatDev concept | How the harness reimplements it | Why it's better |
|---|---|---|
| 9 chatty roles (CEO/CPO/CTO + 3 workers + 3 optional) | **4 working subagents** in `.claude/agents/`: `spec-architect`, `programmer`, `reviewer`, `tester`. Drop the executive chit-chat. | Keeps the roles that *do work*; cuts dialogue theater (DemandAnalysis/LanguageChoose were pure talk). |
| 8-phase chat chain (`ChatChainConfig.json`) | A **Workflow** pipeline: spec → build (TDD) → review→fix loop → test→debug loop, with deterministic JS control flow. | Control flow is real code (loops/conditionals), not LLM-narrated phase transitions. |
| Two-agent `RolePlaying` seminar, `<INFO>` marker | Each phase = a real **subagent dispatch** returning a **structured result** (schema-validated), consumed by the next stage. | No role-flip prompt theater; convergence is a typed signal, not a string match on `<INFO>`. |
| `ChatEnv` shared blackboard + `env_dict` | The **filesystem itself** (`./demo`) is the shared state; structured stage results carry spec/findings/verdicts between agents. | The codebase is *real files on disk*, not a re-serialized prompt string. |
| Regex code extraction from prose (`codes.py`) | Programmer subagent uses **real `Write`/`Edit`** tools — files are authored directly. | Eliminates the brittle prose→regex→file failure mode entirely. |
| `exist_bugs()` = 3-sec `python3 main.py`, grep `Traceback` | Tester subagent runs a **real `pytest` suite** via `Bash`; success = exit 0. TDD writes tests first. | Behavioral verification, not a smoke-test for crashes. |
| CodeReview/Test ComposedPhase loops (`break_cycle`) | Workflow **review→fix** and **test→debug** loops with explicit exit conditions + `superpowers:systematic-debugging` discipline. | Same loop idea, but driven by real findings and real test failures. |
| Code Reviewer role (suggests fixes in text) | `reviewer` subagent is **frontmatter-scoped read-only** (Read/Glob/Grep — no Write/Edit/Bash). | Separation of duties is *enforced by the harness*, not just by prompt. |
| Engine = LLM dialogue, no execution by agents | Engine = **Claude Code with real tool execution** on the Claude subscription. UI = Claude Code's native hierarchical subagent view. | The agents actually build, run, and test the software. |

**Essence — what to reimplement:** role-paired phases, a spec→build→review→test pipeline,
loop-until-converged review/debug cycles, and a shared evolving codebase — but with
**real tool-using agents writing real files and running real tests (pytest)**, a
**read-only reviewer enforced by tool scoping**, and **TDD** as the success signal.
