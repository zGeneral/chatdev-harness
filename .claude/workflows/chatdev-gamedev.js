export const meta = {
  name: 'chatdev-gamedev',
  description: 'Game factory (ChatDev 2.0 GameDev_with_manager port): GDD -> core (Phase 1) -> polish (Phase 2) -> QA -> run. Builds a real Pygame game with tested logic + a headless launch that runs clean.',
  whenToUse: 'Turn a game idea into a real, runnable Pygame game via a ChatDev-style game-dev pipeline with real execution (pytest on logic + headless smoke-run).',
  phases: [
    { title: 'Design', detail: 'Game Designer -> Game Design Document' },
    { title: 'Core', detail: 'Core Developer -> Phase 1 mechanics (runnable + tested logic)' },
    { title: 'Polish', detail: 'Polish Developer -> Phase 2 visual juice (stays green)' },
    { title: 'QA', detail: 'QA findings -> developer fixes (<=2)' },
    { title: 'Verify', detail: 'run pytest(logic) + headless smoke -> bug-fix (<=3)' },
  ],
}

// --- args (Workflow delivers args as a JSON string; normalize) ---
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
A = (A && typeof A === 'object') ? A : {}
const target = A.target || './game'
const DEFAULT_GAME = [
  'Build a small but polished arcade game in Python with Pygame: a "falling rocks dodge" game.',
  '- The player is a block/ship at the bottom that moves left/right with the arrow keys (clamped to the screen).',
  '- Rocks fall from the top at increasing rate; colliding with one ends the game.',
  '- Score = survival time (or rocks dodged). Press R to restart from any state (including game-over).',
  '- Show the score on screen and a clear game-over state.',
].join('\n')
const gameIdea = A.prompt || DEFAULT_GAME
const PYBIN = A.pybin || '/Users/hassiba/git/chatdev_harness/.venv/bin/python'
log('args: type=' + typeof args + ' target=' + target)

// Success signals: logic tests + a headless launch that runs N frames and exits clean.
const PYTEST = 'cd ' + target + ' && ' + PYBIN + ' -m pytest -q'
const SMOKE = 'cd ' + target + ' && SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy GAME_SMOKE_FRAMES=180 ' + PYBIN + ' game.py; echo "SMOKE_EXIT=$?"'

// --- testability contract (the key adaptation for a GUI app) ---
const CONTRACT =
  'TESTABILITY CONTRACT (mandatory — this is how we verify a GUI game by real execution):\n' +
  '1. Put ALL pure game logic (movement clamping, spawning cadence, collision, scoring, win/lose state ' +
  'transitions) in `logic.py` that imports NO pygame and touches NO display — plain functions/classes on ' +
  'plain data. Cover it with pytest in `tests/test_logic.py` (deterministic; seed any randomness).\n' +
  '2. `game.py` is the Pygame shell that imports logic.py and renders/handles input. It MUST support a ' +
  'HEADLESS SMOKE MODE: when the env var GAME_SMOKE_FRAMES is set to an integer N, run exactly N frames ' +
  '(no real window needed — SDL_VIDEODRIVER=dummy is set), feeding synthetic/no input, then call ' +
  'pygame.quit() and sys.exit(0). It must run clean (exit 0, no traceback) with no display.\n' +
  '3. MANDATORY game requirements: never a pure-black (0,0,0) background; press R to restart from any ' +
  'state; 60 FPS via pygame.time.Clock(); clean pygame.QUIT handling with sys.exit().'

// --- role briefs (ChatDev 2.0 GameDev roles, adapted) ---
const DESIGNER =
  'You are the CREATIVE GAME DESIGNER (ChatDev game factory). Turn the idea into a focused Game Design ' +
  'Document optimized for rapid prototyping: ONE core mechanic / gameplay loop, exact control mappings, ' +
  'a visual identity (style + HEX palette + simple geometric shapes), win/lose conditions, and key events. ' +
  'Also specify the pure-logic surface (the functions/state the logic.py module should expose) so it is testable. ' +
  'Be decisive and concrete; no TBD. Do not write code.'
const CORE_DEV =
  'You are the CORE DEVELOPER (ChatDev game factory). You have REAL tools — write real files, run real ' +
  'commands. Implement PHASE 1: the functional prototype (game loop, player movement + collision, spawning, ' +
  'win/lose) with SIMPLE geometric rendering and NO visual effects yet. Follow strict TDD on the logic: write ' +
  '`tests/test_logic.py` first (red), implement `logic.py`, then build `game.py` (the Pygame shell with the ' +
  'headless smoke mode). ' + CONTRACT + '\n' +
  'Verify by running BOTH `' + PYTEST + '` (logic green, exit 0) AND `' + SMOKE + '` (SMOKE_EXIT=0). Iterate ' +
  'until both pass. Report files, logic tests passing/total, the pytest exit code, and the smoke exit code.'
const POLISH_DEV =
  'You are the POLISH DEVELOPER (ChatDev game factory), a pro indie game artist. Implement PHASE 2: visual ' +
  'juice — particles, screen shake (subtle), color/contrast, centered UI with shadows, smooth feedback — ' +
  'WITHOUT breaking anything. Keep the headless smoke mode and the mandatory requirements intact, and keep the ' +
  'logic in logic.py (rendering changes only). Re-run `' + PYTEST + '` and `' + SMOKE + '`; both must stay green. ' +
  'Report files changed, logic tests passing/total, pytest exit, smoke exit, notes.'
const QA =
  'You are the GAME QA SPECIALIST (ChatDev game factory). Review the game against the GDD and the mandatory ' +
  'requirements. Checklist: (A) functional completeness vs GDD, (B) the headless smoke mode + mandatory reqs ' +
  '(no pure-black bg, R restart, 60 FPS clock, clean QUIT), (C) is the logic genuinely in logic.py and tested, ' +
  '(D) UX/visual sanity. Return prioritized severity-tagged findings with a file:line and concrete fix. ' +
  'High signal only; zero findings if genuinely clean. Do not edit or run code.'
const BUGFIX =
  'You are the CORE DEVELOPER fixing the game. Find the ROOT CAUSE (read the traceback / failing assertion), ' +
  'fix it, and re-run BOTH `' + PYTEST + '` and `' + SMOKE + '` until both are green (pytest exit 0 AND ' +
  'SMOKE_EXIT=0). Never break the logic tests or the headless smoke mode. Report files, pytest exit, smoke exit, notes.'

const GDD_SCHEMA = {
  type: 'object', required: ['title', 'coreMechanic', 'controls', 'visualIdentity', 'winLose', 'logicSurface'],
  properties: {
    title: { type: 'string' }, coreMechanic: { type: 'string' }, controls: { type: 'string' },
    visualIdentity: { type: 'string' }, winLose: { type: 'string' },
    logicSurface: { type: 'string', description: 'The pure functions/state logic.py should expose (testable).' },
    events: { type: 'string' },
  },
}
const GBUILD_SCHEMA = {
  type: 'object', required: ['filesWritten', 'logicTestsPassing', 'logicTestsTotal', 'pytestExit', 'smokeExit', 'notes'],
  properties: {
    filesWritten: { type: 'array', items: { type: 'string' } },
    logicTestsPassing: { type: 'integer' }, logicTestsTotal: { type: 'integer' },
    pytestExit: { type: 'integer' }, smokeExit: { type: 'integer', description: 'Exit code of the headless game launch (0 = ran clean).' },
    notes: { type: 'string' },
  },
}
const QA_SCHEMA = {
  type: 'object', required: ['findings', 'summary'],
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', required: ['severity', 'location', 'problem', 'fix'], properties: {
      severity: { type: 'string', enum: ['high', 'medium', 'low'] }, location: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' },
    } } },
  },
}
const EFFORT = 'medium'
const green = (b) => b && b.pytestExit === 0 && b.smokeExit === 0

// === Design ===
phase('Design')
const gdd = await agent(DESIGNER + '\n\n## Game idea\n' + gameIdea + '\n\n## Target dir\n' + target + '\n\nProduce the Game Design Document.',
  { label: 'game-designer', phase: 'Design', schema: GDD_SCHEMA, effort: EFFORT })
const gddText = JSON.stringify(gdd, null, 2)
log('GDD: ' + gdd.title)

// === Core (Phase 1) ===
phase('Core')
let build = await agent(CORE_DEV + '\n\n## Game Design Document\n' + gddText + '\n\n## Target dir: ' + target +
  '\n\nBuild Phase 1 now (create the dir if needed). End with both pytest and the headless smoke run green.',
  { label: 'core-developer', phase: 'Core', schema: GBUILD_SCHEMA, effort: EFFORT })
log('Core: logic ' + build.logicTestsPassing + '/' + build.logicTestsTotal + ', pytest ' + build.pytestExit + ', smoke ' + build.smokeExit)

// === Polish (Phase 2) ===
phase('Polish')
const polish = await agent(POLISH_DEV + '\n\n## Game Design Document\n' + gddText + '\n\n## Target dir: ' + target +
  '\n\nApply Phase 2 visual polish; keep pytest + smoke green.',
  { label: 'polish-developer', phase: 'Polish', schema: GBUILD_SCHEMA, effort: EFFORT })
if (green(polish)) build = polish
log('Polish: pytest ' + polish.pytestExit + ', smoke ' + polish.smokeExit)

// === QA -> fix (<=2) ===
phase('QA')
for (let i = 1; i <= 2; i++) {
  const qa = await agent(QA + '\n\n## GDD\n' + gddText + '\n\n## Target dir: ' + target +
    '\n\nReview the game in ' + target + '. Return findings; do not edit.',
    { label: 'qa:round' + i, phase: 'QA', schema: QA_SCHEMA, effort: EFFORT })
  const actionable = (qa.findings || []).filter(f => f.severity === 'high' || f.severity === 'medium')
  log('QA round ' + i + ': ' + (qa.findings || []).length + ' findings (' + actionable.length + ' high/medium).')
  if (!actionable.length) { log('QA converged: no high/medium findings.'); break }
  const fix = await agent(BUGFIX + '\n\n## GDD\n' + gddText + '\n\n## Target dir: ' + target +
    '\n\n## QA findings to apply\n' + JSON.stringify(actionable, null, 2) +
    '\n\nApply the real ones, then re-run pytest + smoke; both must be green.',
    { label: 'qa-fix' + i, phase: 'QA', schema: GBUILD_SCHEMA, effort: EFFORT })
  if (green(fix)) build = fix
  log('QA-fix ' + i + ': pytest ' + fix.pytestExit + ', smoke ' + fix.smokeExit)
  if (!green(fix)) { log('QA-fix ' + i + ' not green — deferring to Verify phase.'); break }
}

// === Verify -> bug-fix (<=3): run pytest(logic) + headless smoke ===
phase('Verify')
let stuckSig = null, stuckCount = 0
for (let i = 1; i <= 3; i++) {
  const v = await agent('You are the GAME TEST ENGINEER. Run BOTH commands and report the real results, editing nothing:' +
    '\n  pytest (logic): `' + PYTEST + '`\n  headless launch: `' + SMOKE + '`' +
    '\n## Target dir: ' + target + '\nReport pytestExit, smokeExit, logic tests passing/total, and any failure diagnostics in notes.',
    { label: 'verify:round' + i, phase: 'Verify', schema: GBUILD_SCHEMA, effort: EFFORT })
  log('Verify round ' + i + ': pytest ' + v.pytestExit + ', smoke ' + v.smokeExit)
  if (green(v)) { build = v; log('Verify GREEN: pytest exit 0 AND headless smoke exit 0.'); break }
  const sig = 'p' + v.pytestExit + 's' + v.smokeExit
  if (sig === stuckSig) { stuckCount++ } else { stuckSig = sig; stuckCount = 0 }
  if (stuckCount >= 2) { log('No-thrash guard: same failure 3x — stopping.'); build = v; break }
  if (i === 3) { build = v; break }
  const dbg = await agent(BUGFIX + '\n\n## GDD\n' + gddText + '\n\n## Target dir: ' + target +
    '\n\n## Failing verification\n' + JSON.stringify({ pytestExit: v.pytestExit, smokeExit: v.smokeExit, notes: v.notes }, null, 2) +
    '\n\nDebug to root cause; re-run pytest + smoke until both green.',
    { label: 'bugfix' + i, phase: 'Verify', schema: GBUILD_SCHEMA, effort: EFFORT })
  if (green(dbg)) build = dbg
  log('Bugfix ' + i + ': pytest ' + dbg.pytestExit + ', smoke ' + dbg.smokeExit)
}

const isGreen = green(build)
log(isGreen ? 'GAME DONE: logic tests pass AND the game launches headless and runs clean.' : 'GAME: not green — see report.')
return { target, green: isGreen, gdd, build }
