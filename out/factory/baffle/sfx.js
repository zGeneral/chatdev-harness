// Baffle — sound effects, synthesized with the Web Audio API (no asset files; works
// offline; tiny). Playful, cartoony, pitched — an Angry-Birds-ish palette. Every
// sound is short and gain-enveloped. Muting is honoured globally + persisted by app.js.

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
  }
  // browsers start the context suspended until a user gesture — resume on first use.
  if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
  return ctx;
}

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }
// call from the FIRST user gesture so audio is unlocked (autoplay policy).
export function unlock() { ac(); }

function tone(freq, dur, { type = 'sine', vol = 0.2, slideTo = null, delay = 0 } = {}) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) { try { o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur); } catch (e) { /* ignore */ } }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise(dur, { vol = 0.12, delay = 0 } = {}) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); // decaying
  const s = c.createBufferSource(); s.buffer = buf;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g).connect(c.destination);
  s.start(t); s.stop(t + dur);
}

export const sfx = {
  place() { tone(240, 0.09, { type: 'triangle', vol: 0.20, slideTo: 150 }); },       // wooden "tok"
  lift() { tone(440, 0.08, { type: 'sine', vol: 0.14, slideTo: 660 }); },             // soft "pop" up
  run() { tone(300, 0.20, { type: 'sawtooth', vol: 0.12, slideTo: 560 }); noise(0.14, { vol: 0.05 }); }, // takeoff whoosh
  turn() { tone(700, 0.05, { type: 'square', vol: 0.07, slideTo: 920 }); },           // chirp as it banks off a wall
  deliver() { tone(523, 0.09, { type: 'sine', vol: 0.18 }); tone(880, 0.12, { type: 'sine', vol: 0.16, delay: 0.07 }); }, // happy "ploop"
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.20, { type: 'triangle', vol: 0.2, delay: i * 0.10 })); },     // level-clear jingle
  fail() { tone(320, 0.22, { type: 'sawtooth', vol: 0.18, slideTo: 110 }); noise(0.16, { vol: 0.07, delay: 0.04 }); },    // comedic "womp"
};
