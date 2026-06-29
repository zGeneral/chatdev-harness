// Baffle — PLAYABILITY GATE assertions (node --test).
// Thresholds from graphs/oracleforge/design/playability.md §gate + §soul-necessity.
// MEASURED from the SAME solver/engine the pipeline built (engine.js), over the
// baked pack (pack.json), via playability.js. A failing test here = the gate FIRING:
// the pack is WEAK on the named dimension and content must re-bake targeting it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measure } from './playability.js';

const R = measure();

// ───────────────────────── par-ramp (a ramp exists) ─────────────────────────
test('par spans ≥ 3 distinct values (a difficulty ramp exists)', () => {
  assert.ok(
    R.parRamp.span >= 3,
    `par-ramp WEAK: only ${R.parRamp.span} distinct par values ${JSON.stringify(R.parRamp.distinctPars)} ` +
    `(hist ${JSON.stringify(R.parRamp.histogram)}); gate requires ≥3. ` +
    `RE-BAKE DIMENSION: par-ramp — the pack never ramps par past 2; add genuinely ` +
    `deeper (par ≥ 3) levels so difficulty escalates, not just validity.`,
  );
});

// ───────────────────────── unique-optimal % ─────────────────────────
test('≥ 50% of levels are unique-optimal (a satisfying single best answer)', () => {
  assert.ok(
    R.uniqueOptimal.fraction >= 0.5,
    `unique-optimal WEAK: ${(R.uniqueOptimal.fraction * 100).toFixed(1)}% < 50% ` +
    `(${R.uniqueOptimal.count}/${R.packSize}). RE-BAKE DIMENSION: definiteness.`,
  );
});

// ───────────────────────── greedy / straight-aim regret ─────────────────────────
test('straight-aim/greedy regret on ≥ 25% of par≥2 levels (real decisions exist)', () => {
  assert.ok(
    R.greedyRegret.nonTrivialLevels > 0,
    'no par≥2 levels to measure regret on — pack has no non-trivial decisions',
  );
  assert.ok(
    R.greedyRegret.fraction >= 0.25,
    `greedy-regret WEAK: ${(R.greedyRegret.fraction * 100).toFixed(1)}% < 25% ` +
    `(${R.greedyRegret.regretLevels}/${R.greedyRegret.nonTrivialLevels}); the obvious ` +
    `line wins too often. RE-BAKE DIMENSION: decision-depth.`,
  );
});

// ───────────────────────── technique tiers (escalating aha) ─────────────────────────
test('≥ 2 distinct technique tiers represented (escalation, not repetition)', () => {
  assert.ok(
    R.techniqueTiers.count >= 2,
    `technique-spread WEAK: only ${R.techniqueTiers.count} technique tier(s) present ` +
    `${JSON.stringify(R.techniqueTiers.present)}; gate requires ≥2. RE-BAKE DIMENSION: aha-density.`,
  );
});

// ───────────────────────── pack size vs curriculum ─────────────────────────
test('pack size ≥ curriculum insight count (every insight has a home, with room to ramp)', () => {
  assert.ok(
    R.packSize >= R.insightCount,
    `session-viability WEAK: pack size ${R.packSize} < insight count ${R.insightCount}. ` +
    `RE-BAKE DIMENSION: coverage.`,
  );
});

// ───────────────────────── ON-RAMP FLOOR (absolute, not just spread) ─────────────────────────
test('on-ramp FLOOR: easiest level is genuinely gentle AND ≥2 easy/teaching levels precede the hard ones', () => {
  assert.ok(
    R.onRamp.onRampGentle,
    `on-ramp WEAK: easiest level (par ${R.onRamp.easiestPar}, id ${R.onRamp.easiestLevelId}) is not a ` +
    `gentle T0 teaching board; a par-spread alone does NOT satisfy the floor (the Bleedweave wall). ` +
    `RE-BAKE DIMENSION: on-ramp floor.`,
  );
  assert.ok(
    R.onRamp.easyCount >= 2,
    `on-ramp WEAK: only ${R.onRamp.easyCount} easy/teaching (T0) level(s); gate requires ≥2. ` +
    `RE-BAKE DIMENSION: on-ramp floor.`,
  );
  assert.ok(
    R.onRamp.easyBeforeHard >= 2,
    `on-ramp WEAK: only ${R.onRamp.easyBeforeHard} easy level(s) precede the first hard (T3) level; ` +
    `gate requires ≥2 (teaching before testing). RE-BAKE DIMENSION: on-ramp ordering.`,
  );
});

// ───────────────────────── HARD-CEILING FLOOR (ramps to genuinely hard) ─────────────────────────
test('hard-CEILING FLOOR: ≥2 levels clear an absolute decision-space/magnitude floor (not eyeball-trivial)', () => {
  assert.ok(
    R.hardCeiling.clearedCount >= 2,
    `hard-ceiling WEAK: only ${R.hardCeiling.clearedCount} level(s) clear the absolute floor ` +
    `(search-nodes ≥ ${R.hardCeiling.searchFloor} AND area ≥ ${R.hardCeiling.hardAreaMin} AND ` +
    `≥2 entities AND par ≥ 2); maxNodes=${R.hardCeiling.maxNodes}, maxArea=${R.hardCeiling.maxArea}. ` +
    `gate requires ≥2 — the pack must RAMP to genuinely hard (the Enfilade flat-field wall). ` +
    `RE-BAKE DIMENSION: hard-ceiling floor.`,
  );
});

// ───────────────────────── VERBS-LOAD-BEARING (no vestigial mechanic) ─────────────────────────
test('VERBS-LOAD-BEARING: no core SPEC verb is vestigial (wall-deny + turn-deflection + movement all matter)', () => {
  assert.ok(
    R.verbs.loadBearing.wallDeny,
    'verb WEAK: WALL-DENY is vestigial on some mid+ level (par 0 — a freebie). RE-BAKE DIMENSION: verbs.',
  );
  assert.ok(
    R.verbs.loadBearing.turnDeflection,
    'verb WEAK: the TURN-RULE deflection is vestigial on some mid+ level (the wall bent no path — ' +
    'the geometry already did the work, Enfilade-style). RE-BAKE DIMENSION: verbs.',
  );
  assert.ok(
    R.verbs.loadBearing.movement,
    'verb WEAK: MOVEMENT is vestigial — a mover does not travel on some mid+ winning line. ' +
    'RE-BAKE DIMENSION: verbs.',
  );
  assert.ok(R.verbs.allLoadBearing, 'a core SPEC verb is vestigial — see per-verb detail above.');
});

// ───────────────────────── CURRICULUM DISTINCTNESS ─────────────────────────
test('CURRICULUM DISTINCTNESS: distinct canonical-signature count == pack size (zero isomorphic duplicates)', () => {
  assert.equal(
    R.distinctness.distinctSignatureCount, R.distinctness.packSize,
    `distinctness WEAK: ${R.distinctness.distinctSignatureCount} distinct signatures for ` +
    `${R.distinctness.packSize} levels — isomorphic duplicate(s): ${JSON.stringify(R.distinctness.duplicates)} ` +
    `(same puzzle reskinned under translation/rotation/reflection, the Enfilade focus-fire wall). ` +
    `RE-BAKE DIMENSION: distinctness.`,
  );
});

test('CURRICULUM DISTINCTNESS: each multi-level tier varies in solution structure (never one puzzle reskinned)', () => {
  for (const [tier, v] of Object.entries(R.distinctness.perTier)) {
    assert.ok(
      v.allDistinct,
      `tier ${tier} WEAK: ${v.distinctSignatures} distinct sigs for ${v.levels} levels (a reskin). ` +
      `RE-BAKE DIMENSION: per-tier distinctness.`,
    );
    assert.ok(
      v.varies,
      `tier ${tier} WEAK: its ${v.levels} levels do not vary in solution structure ` +
      `(only ${v.distinctStructuralShapes} structural shape(s)) — one puzzle reskinned. ` +
      `RE-BAKE DIMENSION: per-tier escalation.`,
    );
  }
});

// ───────────────────────── SOUL-NECESSITY (the signature technique is load-bearing) ─────────────────────────
test('SOUL-NECESSITY: ≥80% of soul-bearing instances become unsolvable OR lose unique-optimal without the soul', () => {
  // Ablate the soul (swap the wall actuator → drove arrows; the turn-rule-as-sole-
  // steering is disabled, the player can point movers) and re-run the census. The
  // soul census runs over the unique-optimal (soul-claiming) levels; the T0 on-ramp
  // band is non-unique + soul-free by SPEC design and is reported but not gated.
  assert.ok(
    R.soul.total > 0,
    'no unique-optimal (soul-bearing) levels to ablate — the pack carries no signature technique.',
  );
  assert.ok(
    R.soul.fraction >= R.soul.threshold,
    `SOUL DECORATIVE: only ${(R.soul.fraction * 100).toFixed(1)}% of the ${R.soul.total} soul-bearing ` +
    `levels break when the soul (the fixed turn-rule, ablated to drove arrows) is removed ` +
    `(${R.soul.brokenWithoutSoul}/${R.soul.total}); gate requires ≥80%. The headline technique is ` +
    `decorative, not load-bearing — REDESIGN/RE-BAKE so the wall-only beside/behind line is forced.`,
  );
});
