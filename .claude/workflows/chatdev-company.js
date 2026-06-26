export const meta = {
  name: 'chatdev-company',
  description: 'Virtual software company: spec -> build(TDD) -> review->fix -> test->debug. Real subagents write real files and pass a real pytest suite (green = exit 0).',
  whenToUse: 'Turn a product prompt into working, tested software via a ChatDev-style role pipeline with real tool execution.',
  phases: [
    { title: 'Spec', detail: 'spec-architect: product prompt -> build spec' },
    { title: 'Build', detail: 'programmer: TDD — tests first, then implement to green' },
    { title: 'Review', detail: 'reviewer findings -> programmer fixes (<=2 cycles)' },
    { title: 'Test', detail: 'tester runs pytest -> programmer debugs (<=3 cycles)' },
  ],
}

// ---------------------------------------------------------------------------
// Target + product prompt. args overrides; default = the demo todo-CLI target.
// ---------------------------------------------------------------------------
const target = (args && args.target) || './demo'
const DEFAULT_PROMPT = [
  'Build a small command-line TODO application in Python (a package named `todo` in the target dir).',
  '',
  'Commands:',
  '  - `add <text>` : add a todo with the given text; assign an incrementing integer id; print a confirmation including the id.',
  '  - `list`       : print all todos, each showing its id, status ([ ] open or [x] done), and text.',
  '  - `done <id>`  : mark the item with that id as done; print a confirmation. Error clearly if the id does not exist.',
  '',
  'Persistence: store items as JSON (a list of objects with fields id, text, done). The storage file path MUST be injectable',
  'so tests can use a temporary file — read it from the TODO_FILE environment variable, defaulting to `todos.json` in the cwd.',
  '',
  'Provide BOTH: (a) a Python API with importable functions that take an explicit storage path (so unit tests call them directly',
  "with a tmp_path), and (b) a CLI entry point runnable as `python -m todo <command> ...`.",
  '',
  'Tests: a pytest suite (in the target dir) covering add, list, done, the done-on-missing-id error, and a persistence round-trip',
  "(data survives a reload). Tests must be isolated and deterministic using pytest's tmp_path — never touching a real todos.json.",
  'If you test the CLI via subprocess, invoke it with `sys.executable` (so it runs under the same interpreter as pytest).',
].join('\n')
const productPrompt = (args && args.prompt) || DEFAULT_PROMPT

// Repo-local venv python (has pytest). Tests run under this interpreter; CLI subprocess
// tests should use sys.executable so they inherit it. Override via args.pybin if needed.
const PYBIN = (args && args.pybin) || '/Users/hassiba/git/chatdev_harness/.venv/bin/python'
const PYTEST = 'cd ' + target + ' && ' + PYBIN + ' -m pytest -q'

// ---------------------------------------------------------------------------
// Inline role briefs. The Workflow runtime does NOT resolve project
// .claude/agents (probed: agentType 'spec-architect' not found), so each role's
// charter is embedded here. These mirror .claude/agents/*.md — the source of truth.
// ---------------------------------------------------------------------------
const SPEC_BRIEF =
  'You are the SPEC & ARCHITECTURE lead of a virtual software company (ChatDev reimplemented in Claude Code). ' +
  'You are read-only. Turn the product prompt into ONE decisive, buildable spec: a summary, a feature list (each a ' +
  'verifiable capability), an exact file plan (relative paths + one-line purpose), a precise interface/CLI contract ' +
  '(exact function signatures and/or exact CLI invocations + observable output, concrete enough to test WITHOUT seeing ' +
  'the implementation), the data model (incl. how storage is made injectable for test isolation), and a test plan ' +
  '(each test named, with exactly what it asserts; at least one per feature plus a persistence round-trip). ' +
  'Be decisive (no TBD; pick sensible defaults), testable by construction, and YAGNI. Do not write files.'

const PROGRAMMER_BRIEF =
  'You are the PROGRAMMER of a virtual software company (ChatDev reimplemented in Claude Code). Unlike ChatDev, you have ' +
  'REAL tools: write real files with Write/Edit, run real commands with Bash. Code that is not on disk and passing tests ' +
  'does not exist. Practice strict TDD (tests first, watch them fail, then implement minimally to green). On failures, ' +
  'find the ROOT CAUSE before patching (read the traceback, hypothesize, confirm) — do not guess-and-check. ALWAYS run the ' +
  'real test command and read the real output before claiming anything passes; report the true exit code. Keep files small ' +
  'and focused per the spec. If the same failure persists after 3 distinct attempts, stop and report the blocker.'

const REVIEWER_BRIEF =
  'You are the CODE REVIEWER of a virtual software company (ChatDev reimplemented in Claude Code). Your power is judgment, ' +
  'not editing — report findings; the Programmer applies them. Review the implementation against the spec for: correctness/bugs, ' +
  'robustness (error handling, persistence/round-trip, fragile I/O), quality (clarity, duplication, dead code, naming), and ' +
  'spec fidelity (is every feature actually implemented?). High signal, low noise — report only what a careful engineer would ' +
  'truly fix; skip nitpicks. Tag every finding high/medium/low with a file:line where possible, the problem, and a concrete fix. ' +
  'If the code is genuinely clean, return zero findings rather than inventing work. Do not edit or run code.'

const TESTER_BRIEF =
  'You are the SOFTWARE TEST ENGINEER of a virtual software company (ChatDev reimplemented in Claude Code). ChatDev merely ran ' +
  'the program for 3 seconds and grepped for Traceback; you run the REAL test suite and report the truth. Run the tests, then ' +
  'report the authoritative result: the real exit code, passed/total counts, and concise per-failure diagnostics (failing test ' +
  'name + the assertion/traceback that matters). Never report a result you did not observe. You do not edit code — if a test ' +
  'itself looks wrong, report it as a finding; the Programmer owns the fix.'

// ---------------------------------------------------------------------------
// Stage result schemas (structured handoffs between roles).
// ---------------------------------------------------------------------------
const SPEC_SCHEMA = {
  type: 'object',
  required: ['summary', 'features', 'files', 'interface', 'dataModel', 'testPlan'],
  properties: {
    summary: { type: 'string' },
    features: { type: 'array', items: { type: 'string' } },
    files: { type: 'array', items: { type: 'object', required: ['path', 'purpose'], properties: { path: { type: 'string' }, purpose: { type: 'string' } } } },
    interface: { type: 'string', description: 'Exact public function signatures and/or CLI invocations + observable output.' },
    dataModel: { type: 'string' },
    testPlan: { type: 'array', items: { type: 'object', required: ['name', 'asserts'], properties: { name: { type: 'string' }, asserts: { type: 'string' } } } },
  },
}
const BUILD_SCHEMA = {
  type: 'object',
  required: ['filesWritten', 'testsPassing', 'testsTotal', 'exitCode', 'notes'],
  properties: {
    filesWritten: { type: 'array', items: { type: 'string' } },
    testsPassing: { type: 'integer' },
    testsTotal: { type: 'integer' },
    exitCode: { type: 'integer', description: 'Real exit code of the pytest run.' },
    notes: { type: 'string' },
  },
}
const REVIEW_SCHEMA = {
  type: 'object',
  required: ['findings', 'summary'],
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', required: ['severity', 'location', 'problem', 'fix'], properties: {
      severity: { type: 'string', enum: ['high', 'medium', 'low'] },
      location: { type: 'string' },
      problem: { type: 'string' },
      fix: { type: 'string' },
    } } },
  },
}
const TEST_SCHEMA = {
  type: 'object',
  required: ['exitCode', 'passed', 'total', 'failures'],
  properties: {
    exitCode: { type: 'integer' },
    passed: { type: 'integer' },
    total: { type: 'integer' },
    failures: { type: 'array', items: { type: 'object', required: ['test', 'message'], properties: { test: { type: 'string' }, message: { type: 'string' } } } },
  },
}

const EFFORT = 'medium' // demo target is simple; orchestrator (xhigh) verifies the final result.

// ===========================================================================
// Phase 1 — Spec
// ===========================================================================
phase('Spec')
const spec = await agent(
  SPEC_BRIEF + '\n\n## Product prompt\n' + productPrompt + '\n\n## Target dir\n' + target +
  '\n\nProduce the build spec now.',
  { label: 'spec-architect', phase: 'Spec', schema: SPEC_SCHEMA, effort: EFFORT },
)
const specText = JSON.stringify(spec, null, 2)
log('Spec ready: ' + (spec.features ? spec.features.length : 0) + ' features, ' + (spec.files ? spec.files.length : 0) + ' files, ' + (spec.testPlan ? spec.testPlan.length : 0) + ' planned tests.')

// ===========================================================================
// Phase 2 — Build (TDD)
// ===========================================================================
phase('Build')
const build = await agent(
  PROGRAMMER_BRIEF + '\n\n## Spec to implement\n' + specText + '\n\n## Target dir: ' + target +
  '\n\nBuild it TEST-FIRST. (1) Create the target dir if needed. (2) Write the pytest suite from the spec test plan ' +
  'AGAINST the interface contract, in ' + target + '. (3) Run `' + PYTEST + '` — expect RED (nothing implemented yet). ' +
  '(4) Implement the files from the spec file plan. (5) Run `' + PYTEST + '` and iterate until GREEN (exit 0). ' +
  'Report filesWritten, testsPassing/testsTotal, the real pytest exitCode, and notes.',
  { label: 'programmer:build', phase: 'Build', schema: BUILD_SCHEMA, effort: EFFORT },
)
log('Build: ' + build.testsPassing + '/' + build.testsTotal + ' tests passing, pytest exit ' + build.exitCode)

// ===========================================================================
// Phase 3 — Review -> Fix loop (<=2 cycles; break when no high/medium findings)
// (ChatDev CodeReview ComposedPhase / break_cycle on "<INFO> Finished")
// ===========================================================================
phase('Review')
let reviewRounds = 0
for (let i = 1; i <= 2; i++) {
  const review = await agent(
    REVIEWER_BRIEF + '\n\n## Spec\n' + specText + '\n\n## Target dir: ' + target +
    '\n\nReview the implementation in ' + target + ' against the spec. Return prioritized findings (severity-tagged) and a summary. Do not edit or run anything.',
    { label: 'reviewer:round' + i, phase: 'Review', schema: REVIEW_SCHEMA, effort: EFFORT },
  )
  reviewRounds = i
  const actionable = (review.findings || []).filter(f => f.severity === 'high' || f.severity === 'medium')
  log('Review round ' + i + ': ' + (review.findings || []).length + ' findings (' + actionable.length + ' high/medium).')
  if (actionable.length === 0) { log('Review converged: no high/medium findings — breaking loop.'); break }
  const fix = await agent(
    PROGRAMMER_BRIEF + '\n\n## Spec\n' + specText + '\n\n## Target dir: ' + target +
    '\n\n## Reviewer findings to apply\n' + JSON.stringify(actionable, null, 2) +
    '\n\nApply the real findings (ignore any you judge incorrect), then re-run `' + PYTEST + '` and confirm still GREEN (exit 0). ' +
    'Report filesWritten (changed), testsPassing/testsTotal, exitCode, notes.',
    { label: 'programmer:fix' + i, phase: 'Review', schema: BUILD_SCHEMA, effort: EFFORT },
  )
  log('Fix round ' + i + ': pytest exit ' + fix.exitCode + ' (' + fix.testsPassing + '/' + fix.testsTotal + ').')
}

// ===========================================================================
// Phase 4 — Test -> Debug loop (<=3 cycles; break when pytest exit 0)
// (ChatDev Test ComposedPhase / break_cycle on exist_bugs_flag == False)
// with a no-thrash guard: stop if the same failures recur.
// ===========================================================================
phase('Test')
let testResult = null
let stuckSig = null, stuckCount = 0
for (let i = 1; i <= 3; i++) {
  testResult = await agent(
    TESTER_BRIEF + '\n\n## Target dir: ' + target +
    '\n\nRun `' + PYTEST + '`. Report the real exitCode, passed/total, and per-failure diagnostics (empty if green). Do not edit anything.',
    { label: 'tester:round' + i, phase: 'Test', schema: TEST_SCHEMA, effort: EFFORT },
  )
  log('Test round ' + i + ': pytest exit ' + testResult.exitCode + ' (' + testResult.passed + '/' + testResult.total + ').')
  if (testResult.exitCode === 0) { log('Test converged: GREEN (pytest exit 0).'); break }
  const sig = JSON.stringify((testResult.failures || []).map(f => f.test).sort())
  if (sig === stuckSig) { stuckCount++ } else { stuckSig = sig; stuckCount = 0 }
  if (stuckCount >= 2) { log('No-thrash guard: same failures 3x — stopping debug loop.'); break }
  if (i === 3) break
  const dbg = await agent(
    PROGRAMMER_BRIEF + '\n\n## Spec\n' + specText + '\n\n## Target dir: ' + target +
    '\n\n## Failing tests\n' + JSON.stringify(testResult.failures, null, 2) +
    '\n\nDebug to ROOT CAUSE. Fix the cause, re-run `' + PYTEST + '`, confirm GREEN. Report filesWritten, testsPassing/testsTotal, exitCode, notes.',
    { label: 'programmer:debug' + i, phase: 'Test', schema: BUILD_SCHEMA, effort: EFFORT },
  )
  log('Debug round ' + i + ': pytest exit ' + dbg.exitCode + ' (' + dbg.testsPassing + '/' + dbg.testsTotal + ').')
}

const green = !!(testResult && testResult.exitCode === 0)
log(green ? 'COMPANY DONE: vertical slice is GREEN (pytest exit 0).' : 'COMPANY: slice NOT green — see finalTest report.')
return { target, green, spec, build, reviewRounds, finalTest: testResult }
