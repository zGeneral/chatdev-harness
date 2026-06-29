# Baffle — Dark-Pattern Audit (Stage 4 shell)

**GATE RESULT: PASS — zero unmitigated FAILs.**

Audited against `graphs/oracleforge/vendor/agents/ethics-auditor.md`: the four
dark-pattern categories (Zagal/Björk/Lewis 2013; darkpattern.games), Eyal's
facilitator/dealer screening, the Hook-Model verdict, and SDT need-mapping.
The auditor read the actual built shell surfaces (`index.html`, `app.js`,
`helpers.js`, `styles.css`, `tokens.css`) — every verdict cites a surface.

Mandate: *addictive via mastery and ritual, never exploitation.* Baffle has **no
accounts, no network calls, no ads, no payments, no notifications** (stated to the
player in `index.html:24` — "No accounts, no ads, no payments. Your progress stays
on this device.") — most exploitation vectors are structurally absent, not merely
unused.

---

## 1. Surface × four-category table

| Surface (file) | Temporal | Monetary | Social | Psychological |
|---|---|---|---|---|
| **Select screen** (`app.js` `SelectScreen`) | **pass** — three modes, all player-initiated; no appointment/wait gate | **N-A** — no store, no currency | **pass** — no friends/leaderboard/share | **pass** — streak shown as plain `current · best`, no loss framing |
| **Legend / how-to-play** (`app.js` `SelectScreen` legend) | pass — teaches the rule, no gate | N-A | pass | pass — pure instruction |
| **Daily drift** (`app.js` route `daily` + `dailyIndex`) | **pass** — a daily *puzzle* (fresh content keyed to the UTC date), NOT a daily login *reward/payout* | N-A — nothing to buy | pass — same grid for everyone, spoiler-free | **pass** — solved-today shows a tasteful "come back tomorrow", never a fake-urgency timer or FOMO countdown |
| **Streak counter** (`helpers.js` `applyStreak`) | **pass** — grace by **rule** (one missed day forgiven, `helpers.js:60`), never by purchase | **pass** — no streak-repair-for-money path exists | pass | **pass** — `best` retained alongside `current` (`helpers.js:64`); a break resets `current` but never erases history, never shows a bare-zero where repair is sold (Silverman & Barasch 2023) — no such repair exists |
| **Curriculum** (`app.js` route `play`) | pass — self-paced, replayable; no energy/lives | N-A | pass | pass — honest par chip (`🪵 used/k`), fair failure |
| **Endless** (`app.js` route `endless`) | pass — stop anytime; each win advances by a deterministic seed, no grind-wall | N-A | pass | pass — no escalating-cost trap; difficulty is content, not a paywall |
| **Hint ladder** (`helpers.js` `hintLadder`) | pass — free, unlimited, player-initiated | **pass** — hints are NOT sold (no pay-to-skip difficulty); the relief is free (autonomy) | pass | pass — orient→eliminate→move→step narrows before it tells; relieves frustration, never manufactures it |
| **Run / result banner** (`app.js` `showResult`) | pass | N-A | pass — no "share your win" guilt prompt | **pass** — win = a single celebratory pulse + a forward path; loss = "Try again" (instant retry), no loss-framed shaming |
| **Win → Next affordance** (`app.js` `nextAffordanceHTML`) | pass — forward path, no manufactured wait | N-A | pass | pass — no endowed-value trap; progress is never held hostage |
| **End-of-pack / Tomorrow states** (`app.js` `EndcapScreen`/`TomorrowScreen`) | pass — tasteful terminal states with onward options | N-A | pass | pass — no "don't lose your streak!" coercion |
| **Monetization** | **N-A** — absent by construction | **N-A** | **N-A** | **N-A** |
| **Push notifications** | **N-A** — none requested/sent (no `Notification`/push code anywhere) | N-A | N-A | N-A — the forbidden Hook trigger value is structurally absent |

**No FAIL cells.**

---

## 2. Two screening questions (Eyal facilitator/dealer), per retention surface

- **Daily puzzle.** (a) Benefits the *player* — a fresh, shared, exactly-solvable
  puzzle is content, not a payout to juice DAU. (b) A fully-informed player consents:
  it's a calendar ritual, not a trap. → **facilitator.**
- **Streak.** (a) Player benefit — a light competence signal for showing up; grace
  rule keeps it kind. (b) Informed consent holds because there is **no** loss-sold
  repair and `best` is never erased. → **facilitator.**
- **Hints.** (a) Player benefit — autonomy-preserving difficulty relief, free. (b)
  Consent: nobody is upsold the answer. → **facilitator.**
- **Endless.** (a) Player benefit — mastery practice; stop anytime. (b) Consent: no
  hidden escalating cost. → **facilitator.**

No surface answers "no" on either question.

---

## 3. Hook-Model facilitator verdict (per mode)

| Mode | Trigger | Action | Variable reward | Investment | Verdict |
|---|---|---|---|---|---|
| **Daily** | **internal** (calendar ritual / curiosity) — push & loss-fear are absent | place groynes, run | the *puzzle itself* (certified content), never a randomized metagame payout | streak — **survives a missed day by rule** | **facilitator** (decided by the grace rule, `helpers.js:60`) |
| **Curriculum** | internal (mastery curiosity) | place groynes, run | next certified level (real content) | `solved` set — survives any absence (local, no decay) | **facilitator** |
| **Endless** | internal (flow) | place groynes, run | next deterministic level (content) | none coercive; quit costs nothing | **facilitator** |

No mode renders a dealer verdict. The two forbidden trigger values (push
notifications; loss-fear) are **absent in code**, not merely unused.

---

## 4. SDT need-map (Rigby & Ryan)

| Retention feature | Need served |
|---|---|
| Free, unlimited, player-initiated **hint ladder**; three self-chosen **modes** | **Autonomy** — player-initiated difficulty relief and mode choice |
| Honest **par chip** (`🪵 used/k`), visible mastery via `solved` count, **fair failure** (instant "Try again", deterministic engine) | **Competence** |
| **Shared daily** (same grid for everyone that UTC day), **spoiler-free** grids, **best** retained | **Relatedness** (lightweight, non-coercive) |

No feature operates purely on loss aversion; none is rejected.

---

## Operational rule checks (verified in code, not intent)

- Streak grace is by **rule**: `applyStreak` forgives exactly one missed day
  (`helpers.js:60`, `gap === 2 → cur.current += 1`); **no** purchase path exists.
- **"best" renders alongside "current"** so a break never erases history
  (`helpers.js:64`, `SelectScreen` shows `Streak ${current} · best ${best}`).
- A freshly-broken streak resets `current` to 1 but **never** shows a bare zero
  with a repair offer — there is no repair offer (`helpers.js:62`).
- **Regret probe** ("was this worth your time today?"): **N-A at the shell** — the
  ethics-auditor scopes the regret probe to the *tester funnel*, not the shipped
  build; the shell ships no analytics/telemetry at all (privacy-positive). Flagged
  N-A with reason, not a silent pass.

**Conclusion: PASS — zero unmitigated FAILs. The shell is addictive-by-mastery
(ritual daily, honest pars, free relief) with the exploitation vectors structurally
absent.**
