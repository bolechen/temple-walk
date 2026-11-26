// Sounds made from nothing: a temple bell and a drum, each built from decaying partials, the sound of the place, and
// the music (score.js says what, instruments.js plays it). The audio context starts on the first tap, as browsers
// require. Three buses, each with its own level in the pause menu: music, the place (wind, water, eave bells) and
// effects (bell, drum, chime). Each bus sends to one of two reverbs: the court outdoors, the timber hall indoors.
import { createPlayer, createVoices, reverb, bell, hillEcho } from "./instruments.js";
import { joyaZone, createZoneKeeper, moodMusic, sealNote, hz, THEME, endingPhrase, titlePhrase, rng } from "./score.js";
import { stepSound, LEVEL } from "./steps.js";
import { gust as windGust } from "./wind.js";
let ctx = null, master = null, comp = null, outVerb = null, inVerb = null, longVerb = null, steps = null;
// The three rooms' impulses (instruments.js `reverb`: seconds long, an envelope of (1 - t/seconds)^power, `dark` darkening the tail).
// The court and the timber hall are the prologue's and are the numbers they have always been. The great hall's is T05's (a level whose
// `zones.layers` names one), built only there: RT60 about 5 s (7 s of impulse; measured on the generated impulse itself, 5.1 s to fall 60 dB and 5.05 s by T20; the court's own is 2.9 s and 4.2 s, the timber hall's 1.6 s and 1.7 s), inside docs/t05/SOUND.md §1.1's 4-6 s, which that paper gives as a proposal
// to be measured on the spot (our own proposal, no measurement; SOURCES.md), from the hall's 48 x 25 x 16 m of hard floor, timber and thick walls; dark like the timber hall's.
export const COURT_VERB = Object.freeze({ seconds: 3.2, power: 2.6, dark: 0 });
export const TIMBER_VERB = Object.freeze({ seconds: 2.0, power: 3.2, dark: 0.9 });
export const HALL_VERB = Object.freeze({ seconds: 7, power: 3.86, dark: 0.9 });
// T05's Z1 floor of sound (docs/t05/SOUND.md §1, §3: the county town's low murmur, "院外是底，不是事件"): the brown noise already made for the wind,
// low-passed at 220 Hz (SOUND.md's 150-300 Hz) and swelled very slowly by a sine on the clock, so that nothing in it is chosen at random and nothing
// comes by in turn (the traffic sweeps and sparrows of §3 are not made). It goes through the air stage like every sound of the place, so in the
// hall it is the 16 dB-under, far-off floor SOUND.md §1.1 asks for ("外院声变成一层很远的底"). Made only where a level names layers.
// Every number is our own, set by ear against the wind (the owner judges it), not measured anywhere.
export const BED = Object.freeze({ cutoff: 220, gain: 0.04, lfo: 23, depth: 0.3 });
export const bedGain = (t) => BED.gain * (1 - BED.depth + BED.depth * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / BED.lfo)));
// What the mountain's own sounds (wind, drips, eave bells, culms, birds, the well) pass through on their way to the place
// bus: the air between them and the listener. Out of doors it is open. In a hall the walls and the shut leaves stand in
// it (#331: the owner heard no difference between the court and the room): the whole level falls 16 dB and the top is
// shaved, a 650 Hz low-pass at Butterworth's Q, which is a further 19 dB at 2 kHz, so what is left is the wind's low
// breathing through the timber. Going in it settles to within 1 dB in 1.1 s and coming out in 0.9 s (time constants 0.3 and 0.45 s), inside the 0.7-1.5 s
// a door takes to close. The leaf rustle, the culms and the birds are not turned down but not made at all (see `windGains`,
// `knock`, `bird`).
export const AIR = Object.freeze({ out: { gain: 1, cutoff: 20000 }, in: { gain: 0.16, cutoff: 650 }, q: Math.SQRT1_2, tc: { in: 0.3, out: 0.45 } });
// How far the mountain's wind sits under what it was before #331, by where he stands: deep in the bamboo at the start
// (grove 1) not at all, as the owner had it after the cut of 2026-11-16; in the courts and on the stair (grove 0.12, where
// the wind had been left at its first level) WIND_CUT_DB, so that the place bus averages 4-8 dB under the music bus
// there (measured: `node tools/mountain-sound.mjs`, docs/t00/MUSIC.md); in between by a straight line in decibels.
export const WIND_CUT_DB = 10;
export const windCut = (grove) => 10 ** (-WIND_CUT_DB * (1 - Math.min(1, Math.max(0, (grove - 0.12) / 0.88))) / 20);
// The wind's two layers for a gust and the depth of the bamboo; none of the high rustle indoors.
export const windGains = (gust, grove, inside = false) => { const k = windCut(grove); return { low: k * 0.5 * gust * (0.41 + 0.15 * grove), leaves: inside ? 0 : k * 0.16 * gust * gust * (0.21 + 0.353 * grove) }; };
/** The air stage: one gain and a low-pass in front of a bus, for any context (the page's, or an offline one in a test). */
export function createAir(c, to) {
  const g = c.createGain(), f = c.createBiquadFilter(); f.type = "lowpass"; f.Q.value = AIR.q; f.frequency.value = AIR.out.cutoff; g.gain.value = AIR.out.gain;
  g.connect(f); f.connect(to); return { in: g, filter: f };
}
export function setAir(a, inside, t, tc = inside ? AIR.tc.in : AIR.tc.out) { const k = inside ? AIR.in : AIR.out; a.in.gain.setTargetAtTime(k.gain, t, tc); a.filter.frequency.setTargetAtTime(k.cutoff, t, tc); }
let air = null;
const STEP_WET = { out: 0.07, in: 0.4 };   // how much of a step goes to the court's reverb outdoors, the hall's indoors
const bus = {};   // music, ambience, effects: { in, level, duck, tap, dry, sendOut, sendIn }
// How loud the visitor wants it, 0..1 (the pause menu); remembered if nothing has sounded yet.
const levels = { volume: 0.8, music: 0.7, ambience: 0.8, effects: 1 };
export function setVolume(v) { setLevels({ volume: v }); }
export function setLevels(o) {
  for (const k in o) if (k in levels && Number.isFinite(o[k])) levels[k] = Math.min(1, Math.max(0, o[k]));
  if (!ctx) return;
  master.gain.setTargetAtTime(levels.volume, ctx.currentTime, 0.05);
  for (const k of ["music", "ambience", "effects"]) bus[k].level.gain.setTargetAtTime(levels[k], ctx.currentTime, 0.05);
  steps.level.gain.setTargetAtTime(levels.effects, ctx.currentTime, 0.05);
}
// For the tests: is anything sounding, how loud, and at which frequencies; on one bus, or everything together.
export function listen(which) {
  const tap = !which || which === "all" ? bus.all : bus[which] && bus[which].tap;   // a bus that does not exist is off, not the whole mix
  if (!tap) return { state: "off" };
  const t = new Float32Array(tap.fftSize), f = new Float32Array(tap.frequencyBinCount); tap.getFloatTimeDomainData(t); tap.getFloatFrequencyData(f);
  let rms = 0; for (const v of t) rms += v * v;
  const hzBin = ctx.sampleRate / tap.fftSize, peaks = [];
  for (let i = 2; i < f.length - 2; i++) if (f[i] > -62 && f[i] > f[i - 1] && f[i] > f[i + 1] && f[i] > f[i - 2] && f[i] > f[i + 2]) peaks.push([Math.round(i * hzBin), Math.round(f[i])]);
  return { state: ctx.state, rms: +Math.sqrt(rms / t.length).toFixed(4), peaks: peaks.sort((a, b) => b[1] - a[1]).slice(0, 8) };
}

function start() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();   // the defaults, as the bell and drum have always been heard through
  master = ctx.createGain(); master.gain.value = levels.volume; comp.connect(master); master.connect(ctx.destination);   // the visitor's own volume, last in the chain
  bus.all = ctx.createAnalyser(); bus.all.fftSize = 8192; bus.all.smoothingTimeConstant = 0; comp.connect(bus.all);
  outVerb = reverb(ctx, COURT_VERB.seconds, COURT_VERB.power, COURT_VERB.dark); inVerb = reverb(ctx, TIMBER_VERB.seconds, TIMBER_VERB.power, TIMBER_VERB.dark); outVerb.connect(comp); inVerb.connect(comp);
  // Each bus: what goes in, the visitor's level for it, a duck (the music steps back for the bell), then dry and
  // reverb. The level comes before the reverb send, so a muted bus leaves no echo behind.
  for (const [k, dry, wet] of [["music", 0.7, 0.55], ["ambience", 0.8, 0.45], ["effects", 0.8, 0.45]]) {
    const b = (bus[k] = /** @type {any} */ ({})); b.in = ctx.createGain(); b.level = ctx.createGain(); b.level.gain.value = levels[k]; b.duck = ctx.createGain();
    b.dry = ctx.createGain(); b.dry.gain.value = dry; b.sendOut = ctx.createGain(); b.sendOut.gain.value = wet; b.sendIn = ctx.createGain(); b.sendIn.gain.value = 0;
    b.in.connect(b.level); b.level.connect(b.duck); b.duck.connect(b.dry); b.duck.connect(b.sendOut); b.duck.connect(b.sendIn);
    b.dry.connect(comp); b.sendOut.connect(outVerb); b.sendIn.connect(inVerb);
    b.tap = ctx.createAnalyser(); b.tap.fftSize = 8192; b.tap.smoothingTimeConstant = 0; b.dry.connect(b.tap); b.wet = wet;
  }
  air = createAir(ctx, bus.ambience.in);
  // His steps: on the effects slider, but nearly dry outdoors (a step in the bamboo is not a step in a walled court)
  // and in the timber hall's reverb indoors.
  steps = { level: ctx.createGain(), dry: ctx.createGain(), sendOut: ctx.createGain(), sendIn: ctx.createGain() };
  steps.level.gain.value = levels.effects; steps.dry.gain.value = 0.8; steps.sendOut.gain.value = STEP_WET.out; steps.sendIn.gain.value = 0;
  steps.level.connect(steps.dry); steps.level.connect(steps.sendOut); steps.level.connect(steps.sendIn);
  steps.dry.connect(comp); steps.dry.connect(bus.effects.tap); steps.sendOut.connect(outVerb); steps.sendIn.connect(inVerb);
  // A page in the background is silent, and picks up where it was on return (the audio clock stops with it, so the
  // music does not hurry to catch up).
  document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume().catch(() => {}); });
  // A browser may refuse to resume without a touch (iOS after the background, or an interruption): every touch tries again.
  for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, wake, { capture: true, passive: true });
  return ctx;
}
export function wake() { if (ctx && ctx.state !== "running" && !document.hidden) ctx.resume().catch(() => {}); }
// Indoors or out: the reverb follows, over a couple of seconds. `long` (T05's great hall, score.js `layerOf`) sends to the hall's own
// long reverb instead of the timber hall's; it is made the first time it is asked for, so the prologue never builds it.
let roomNow = null, longNow = false;
function longRoom() {
  if (longVerb) return;
  longVerb = reverb(ctx, HALL_VERB.seconds, HALL_VERB.power, HALL_VERB.dark); longVerb.connect(comp);
  for (const k of ["music", "ambience", "effects"]) { const b = bus[k]; b.sendLong = ctx.createGain(); b.sendLong.gain.value = 0; b.duck.connect(b.sendLong); b.sendLong.connect(longVerb); }
  steps.sendLong = ctx.createGain(); steps.sendLong.gain.value = 0; steps.level.connect(steps.sendLong); steps.sendLong.connect(longVerb);
}
function room(inside, long = false) {
  if (inside === roomNow && long === longNow) return; roomNow = inside; longNow = long;
  if (long) longRoom();
  const t = ctx.currentTime, inK = inside && !long;
  for (const k of ["music", "ambience", "effects"]) {
    const b = bus[k]; b.sendOut.gain.setTargetAtTime(inside ? 0 : b.wet, t, 0.7); b.sendIn.gain.setTargetAtTime(inK ? b.wet * 1.1 : 0, t, 0.7);
    if (b.sendLong) b.sendLong.gain.setTargetAtTime(inside && long ? b.wet * 1.1 : 0, t, 0.7);
  }
  steps.sendOut.gain.setTargetAtTime(inside ? 0 : STEP_WET.out, t, 0.7); steps.sendIn.gain.setTargetAtTime(inK ? STEP_WET.in : 0, t, 0.7);
  if (steps.sendLong) steps.sendLong.gain.setTargetAtTime(inside && long ? STEP_WET.in : 0, t, 0.7);
  setAir(air, inside, t);
}
// The music steps back while the bell or the drum speaks, and comes back of itself. A lighter step back that comes inside a
// deeper one (the far bell's 0.3 or the drum's 0.5 while the near bell's 0.18 still holds) leaves the deeper in place and
// the return where the later of the two puts it: it must not lift the music back up in the middle of the bell. `plan` is
// that rule alone, so that Node can test it.
/** @param {{ until: number, depth: number }} prev @param {number} depth @param {number} secs @param {number} t */
export const duckPlan = (prev, depth, secs, t) => (t < prev.until ? { depth: Math.min(depth, prev.depth), until: Math.max(prev.until, t + secs) } : { depth, until: t + secs });
let ducked = { until: 0, depth: 1 }, rest = 1;
function duck(depth, secs) {
  if (!bus.music) return; const t = ctx.currentTime, g = bus.music.duck.gain, p = duckPlan(ducked, depth, secs, t);
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(Math.min(p.depth, rest), t, 0.15); g.setTargetAtTime(rest, p.until, 2.2);
  ducked = p;
}
// While he sits on after his tea the music stays back, so that the place itself is what is heard: the wind in the
// court, the kettle's steam, a bell if someone strikes it. It comes back slowly when he stands.
export function hush(on) {
  rest = on ? 0.35 : 1; if (!bus.music) return;
  const t = ctx.currentTime, g = bus.music.duck.gain;
  // Inside a stroke's stepping back, only where it comes back to changes: the return scheduled by duck() is replaced.
  if (t < ducked.until) { g.cancelScheduledValues(ducked.until); g.setTargetAtTime(rest, ducked.until, 2.2); return; }
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(rest, t, on ? 1.6 : 2.4);
}
function partial(freq, gain, decay, t0, type = "sine", to = bus.effects.in) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  o.connect(g); g.connect(to); o.start(t0); o.stop(t0 + decay + 0.05);
}
function thud(t0, dur, cutoff, gain) {   // a short burst of filtered noise: the mallet, the skin
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = "lowpass"; f.frequency.value = cutoff; g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(bus.effects.in); s.start(t0);
}

// The strokes still ringing. A great bell struck again and again does not pile up without end: no more than three
// are heard, the oldest fading over a second and a half as a fourth comes.
let echo = null; const ringing = []; let struck = 0;
export const bellsRinging = () => { const now = ctx ? ctx.currentTime : 0; while (ringing.length && ringing[0].end < now) ringing.shift(); return { ringing: ringing.length, struck }; };
export function strike(kind, loud = 1) {
  if (!start()) return;
  wake();
  const t = ctx.currentTime + 0.01;
  duck(kind === "bell" ? 0.18 : 0.5, kind === "bell" ? 14 : 2.5);
  if (kind === "bell") {
    // The great bell (instruments.js), answered by the hillside.
    if (!echo) echo = hillEcho(ctx, bus.effects.in);
    bellsRinging(); while (ringing.length >= 3) ringing.shift().fade(t);
    ringing.push(bell(ctx, bus.effects.in, t, loud, echo)); struck++;
  } else {
    // A big barrel drum: a pitch that drops as the skin relaxes, under a thump.
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * loud, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(bus.effects.in); o.start(t); o.stop(t + 1.7);
    partial(148, 0.25 * loud, 0.5, t); thud(t, 0.16, 420, 0.9 * loud);
  }
}

// A hand chime, struck once: what marks a seal. The n-th seal rings the n-th note of the theme (score.js), so the
// seven seals spell it out over the visit. And one drop falling into deep water.
export function chime(loud = 1, n = 1) {
  if (!start()) return; wake();
  const t = ctx.currentTime + 0.01, f = hz(sealNote(n) ?? sealNote(1));
  duck(0.55, 2.5);
  for (const [r, a, d] of [[1, 0.16, 3.4], [1.0055, 0.09, 3.0], [2.353, 0.05, 1.6], [3.842, 0.02, 0.8]]) partial(f * r, a * loud, d, t);
}
// Whatever must happen when a drop falls in the well during the rite (the rings on the water), told by yard.js.
let dropped = () => {};
export function onDrop(fn) { dropped = fn; }
export function drop() {
  dropped();
  if (!start()) return; wake();
  const now = ctx.currentTime + 0.01, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(520, now); o.frequency.exponentialRampToValueAtTime(1150, now + 0.09);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.22, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  o.connect(g); g.connect(bus.effects.in); o.start(now); o.stop(now + 0.35);
}

// A coin let fall into the 功德箱: a bright bronze ring that dies quickly (a copper cash is small and dull, so its
// partials are low and inharmonic), the wooden chest answering underneath it, and one small bounce a moment later. Made
// from oscillators like every sound here; it goes to the effects bus, so it takes the hall's reverb indoors.
let coined = 0, coinAt = null;
export const coinsHeard = () => ({ n: coined, at: coinAt });   // `at`: when it was asked for, on performance.now()'s clock (a test asks it against when the coin went in)
export function coin() {
  coinAt = performance.now();
  if (!start()) return; wake(); coined++;
  const t0 = ctx.currentTime + 0.01;
  const ring = (at, level) => { for (const [f, k, d] of [[2310, 1, 0.34], [3480, 0.55, 0.22], [5130, 0.3, 0.14]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.01);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.07 * k * level, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    o.connect(g); g.connect(bus.effects.in); o.start(at); o.stop(at + d + 0.05); } };
  ring(t0, 1); ring(t0 + 0.13, 0.35);
  const o = ctx.createOscillator(), g = ctx.createGain();   // the hollow of the chest
  o.frequency.setValueAtTime(190, t0 + 0.02); o.frequency.exponentialRampToValueAtTime(120, t0 + 0.2);
  g.gain.setValueAtTime(0.0001, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  o.connect(g); g.connect(bus.effects.in); o.start(t0 + 0.02); o.stop(t0 + 0.32);
}

// One drop falling into the dragon well, heard from near by (`level` 0..1, well.js): a short rising plink, darker
// than the eaves' drips, and the stone niche giving it back twice, fainter and duller each time.
let niche = null;
export function wellDrip(level = 1) {
  if (!ctx || ctx.state !== "running" || level <= 0) return;
  if (!niche) {
    const d = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), out = ctx.createGain();
    d.delayTime.value = 0.13; fb.gain.value = 0.32; lp.type = "lowpass"; lp.frequency.value = 1400; out.gain.value = 0.6;
    d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out); out.connect(air.in); niche = d;
  }
  const now = ctx.currentTime + 0.01, f = 430 + Math.random() * 120, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 2.1, now + 0.08);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.11 * level, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  o.connect(g); g.connect(air.in); g.connect(niche); o.start(now); o.stop(now + 0.25);
}
// A shoe coming down (steps.js makes the sound of each kind: "stone", "wet", "puddle", "snow"). It never wakes the
// audio by itself: until the visitor's first touch has let the place be heard, his steps are silent like everything
// else. Each step a little to the side of the foot that made it, a little louder on a stair, and never twice the same.
// Outdoors a step is almost dry; in a hall it sounds in the room.
const heard = { stone: 0, wet: 0, puddle: 0, snow: 0 };
let stepSeed = 1;
// `late`: how long ago in the last frame the shoe came down. Every step is played a fixed moment after it happened
// (STEP_LAG), so they keep an even time even when frames are slow and uneven.
const STEP_LAG = 0.06;
export function footstep(kind = "snow", { speed = 2.1, side = 0, loud = 1, wet = 1, late = 0 } = {}) {
  if (!ctx || ctx.state !== "running" || !(kind in LEVEL)) return false;
  const x = stepSound(kind, ctx.sampleRate, { seed: (stepSeed = (stepSeed * 1103515245 + 12345) >>> 0), speed, wet });
  const b = ctx.createBuffer(1, x.length, ctx.sampleRate); b.getChannelData(0).set(x);
  const s = ctx.createBufferSource(), g = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  s.buffer = b; s.playbackRate.value = 0.94 + 0.12 * ((stepSeed >>> 8) % 1000) / 1000;
  g.gain.value = LEVEL[kind] * loud * (0.8 + 0.2 * Math.min(1, speed / 2.4));
  s.connect(g); if (pan) { pan.pan.value = side * 0.12; g.connect(pan); pan.connect(steps.level); } else g.connect(steps.level);
  s.start(ctx.currentTime + Math.max(0.005, STEP_LAG - Math.min(STEP_LAG, late))); heard[kind]++;
  return true;
}
export const stepState = () => ({ crunches: heard.snow, heard: { ...heard }, state: ctx ? ctx.state : "off" });

// Two culms knocked together by the wind: a hollow, wooden note that dies at once, and often a second, softer, as they
// swing back. Only deep in the grove and only in a strong gust (`knockReady`). The Chan books tell of Xiangyan Zhixian,
// who woke when a shard he had thrown aside struck a bamboo (Jingde Chuandeng Lu, ch. 11): so it is rare, and never loud.
export const knockReady = (gust, grove) => gust > 0.66 && grove > 0.6;   // the bamboo at the start (grove 1), not the thinner stands higher up (0.55)
let knocks = 0;
export function knock(level = 1) {
  if (!ctx || ctx.state !== "running" || level <= 0 || roomNow) return;   // not heard from within a hall
  const now = ctx.currentTime + 0.01, f = 300 + Math.random() * 140, twice = Math.random() < 0.6;
  for (const [dt, loud] of twice ? [[0, 1], [0.13 + Math.random() * 0.12, 0.45]] : [[0, 1]]) {
    const t = now + dt;
    partial(f * (dt ? 1.07 : 1), 0.07 * level * loud, 0.09, t, "sine", air.in);       // the hollow of the culm
    partial(f * 2.71, 0.025 * level * loud, 0.04, t, "triangle", air.in);              // the dry wood of its wall
  }
  knocks++;
}
// Birds, after Chang Jian's poem on the Chan cloister behind Poshan Temple (Quan Tang Shi; the text and its variant
// readings are in docs/t00/SOURCES.md): the light on the mountain pleases the birds; within the walls every other sound is still and only bell and chime are heard. So
// they sing in the bamboo and on the path up (`grove`, `stair`), most at first light, now and then by day, a last few
// at dusk, none at night, few in winter; never in the courts, the halls or the summit's court. `birdGap` is the mean
// time between two calls, in seconds, or 0 for silence.
export function birdGap(zone, time, season) {
  if (zone !== "grove" && zone !== "stair") return 0;
  const t = { dawn: 7, day: 16, dusk: 26, night: 0 }[time] ?? 16;
  if (!t) return 0;
  return (zone === "stair" ? t * 1.6 : t) * (season === "winter" ? 3 : 1);
}
let birds = 0;
// One small bird some way off: two to five quick whistled notes, each a sweep up or down in the high register, softened
// by distance.
export function bird(level = 1) {
  if (!ctx || ctx.state !== "running" || level <= 0 || roomNow) return;   // not heard from within a hall
  const now = ctx.currentTime + 0.02, n = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1400, pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const far = ctx.createBiquadFilter(); far.type = "lowpass"; far.frequency.value = 5200; if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; far.connect(pan); pan.connect(air.in); } else far.connect(air.in);
  let t = now;
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain(), len = 0.05 + Math.random() * 0.09, f = base * (0.85 + Math.random() * 0.4), up = Math.random() < 0.6;
    o.frequency.setValueAtTime(up ? f * 0.8 : f * 1.2, t); o.frequency.exponentialRampToValueAtTime(up ? f * 1.25 : f * 0.75, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022 * level, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(far); o.start(t); o.stop(t + len + 0.02);
    t += len + 0.03 + Math.random() * 0.08;
  }
  birds++;
}
// The gust heard at a moment of the walk. `place().t` is the picture's own clock (yard.js: the frame's time in seconds,
// on performance.now()'s timeline), so the wind heard rises and falls with the leaves seen coming down; the ambience's
// own count of quarter seconds is only for a page that gives no clock. There is no clock of the sound's own: when the
// page comes back from the background both pick up where performance.now() has got to, together.
export const gustHeard = (p, own) => windGust(Number.isFinite(p.t) ? p.t : own);
export const ambienceState = () => ({ knocks, birds, bed: ambient && ambient.bedAsk ? +ambient.bedAsk.toFixed(4) : 0,   /* the floor of T05's court as last asked of its gain */ running: !!ambient, gust: ambient && ambient.gust != null ? +ambient.gust.toFixed(4) : null, gustT: ambient && ambient.gustT != null ? +ambient.gustT.toFixed(3) : null });

// ---- Two cues of the story ----
// Wings: a dozen small birds going up at once from a tree, a rattle of quick wingbeats that thins as they climb away,
// and two or three alarm calls among them.
const cues = { flutter: 0, farBell: 0, farAnswer: 0, mountainBell: 0, prologue: 0, titled: 0, ending: 0, passed: 0 };
export function flutter(level = 1) {
  if (!ctx || ctx.state !== "running" || level <= 0) return;
  const now = ctx.currentTime + 0.02;
  for (let i = 0; i < 46; i++) {
    const t = now + Math.pow(i / 46, 1.6) * 2.2 + Math.random() * 0.05, far = 1 - i / 46;
    crack(t, 900 + Math.random() * 1400, 0.7, 0.05 * level * far, 0.03, air.in);
  }
  setTimeout(() => { for (let k = 0; k < 3; k++) setTimeout(() => bird(0.7 * level), k * 260); }, 120);
  cues.flutter++;
}
// The close of the chapter: a bell in the far hills answering, another temple's, a tone lower than ours, dark and
// small with the distance, and given back once more by the valley.
let farEcho = null;
// `answer`: the year-end bell's answer to a round of 108 (#341), counted apart from the close's (`cues.farAnswer`).
export function farBell({ answer = false } = {}) {
  if (!start()) return; wake();
  const t = ctx.currentTime + 0.05, lp = ctx.createBiquadFilter(), g = ctx.createGain();
  lp.type = "lowpass"; lp.frequency.value = 650; g.gain.value = 0.32; lp.connect(g); g.connect(bus.effects.in);
  if (!farEcho) { farEcho = hillEcho(ctx, bus.effects.in); }
  if (!closing()) duck(0.3, 12);   // the close's own music has already made room for it
  bell(ctx, lp, t, 0.9, farEcho, hz(41));   // F2: in the music's mode, below the near bell's G
  if (answer) cues.farAnswer++; else cues.farBell++;
}
// The opening (opening.js): the same bell up on the mountain, struck once as the first visitor steps in. Far and light,
// the top rolled off by the distance, the hillside giving it back; our own bell's G, not the far temple's F of the close
// (farBell): the two are a pair, the first heard going up, the other answering at the end.
let hillBellEcho = null;
export function mountainBell() {
  if (!start()) return; wake();
  const t = ctx.currentTime + 0.25, lp = ctx.createBiquadFilter(), g = ctx.createGain();
  lp.type = "lowpass"; lp.frequency.value = 900; g.gain.value = 0.42; lp.connect(g); g.connect(bus.effects.in);
  if (!hillBellEcho) hillBellEcho = hillEcho(ctx, bus.effects.in);
  bell(ctx, lp, t, 0.8, hillBellEcho);
  cues.mountainBell++;
}
// The prologue's title (game.js): as the gate first stands whole before him, the gate's first phrase begins with the
// title, its first D the title's note (score.js's titlePhrase). If the music is not playing yet, or the gate's first
// phrase has already been heard, the title has its one note on the qin, the theme's first, as before.
let titleVoices = null, titleAwaited = false;
// Until the title has risen, the gate's place keeps the stair's music, so that its first phrase is saved for the title.
export function awaitTitle(on) { titleAwaited = !!on; }
export function prologueNote() {
  titleAwaited = false;
  if (!start()) return; wake();
  if (music && !musicHeld && ctx.state === "running" && !music.player.conductor.heard("gate")) {
    const p = music.place(), now = ctx.currentTime;
    music.keeper.settle("gate", now);
    music.player.begin(now, titlePhrase(rng((Date.now() / 1000) | 0), moodMusic(p.season, p.time)), "gate");
    cues.prologue++; cues.titled++;
    return;
  }
  if (!titleVoices) titleVoices = createVoices(ctx, bus.effects.in);
  duck(0.6, 3);
  titleVoices.play({ voice: "qin", m: THEME[0].m, dur: 3.2, vel: 0.9, slide: null }, ctx.currentTime + 0.05);
  cues.prologue++;
}
// While the opening plays, the music waits: the bell is the only voice, and the grove's music begins when the walk is
// handed back (startAmbience still starts the wind at once).
let musicHeld = false, heldPlace = null;
export function holdMusic(on) {
  musicHeld = !!on;
  if (!musicHeld && heldPlace && ctx && !music) { startMusic(heldPlace); heldPlace = null; }
}
export const cueState = () => ({ ...cues, musicHeld });

// ---- The photograph ----
// The shutter: a small leaf shutter in a wooden body, two soft clicks thirty milliseconds apart (the blades closing and
// opening) over a faint knock of the case; nothing electronic. And when the print comes, the seal pressed on it: a dull
// pad of a stamp on paper, and the paper giving a little under it. Both on the effects bus; the music steps aside briefly.
const shots = { shutter: 0, stamp: 0, brush: 0 };
function crack(t, centre, q, gain, secs, to = null) {
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = "bandpass"; f.frequency.value = centre; f.Q.value = q; g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(to || bus.effects.in); s.start(t);
}
export function shutterSound() {
  if (!start()) return; wake();
  const t = ctx.currentTime + 0.01;
  duck(0.6, 1);
  crack(t, 2600, 1.4, 0.5, 0.025); crack(t, 900, 0.9, 0.35, 0.04);              // the blades close
  crack(t + 0.032, 3100, 1.6, 0.32, 0.02); crack(t + 0.032, 1100, 0.9, 0.22, 0.035);   // and open
  thud(t, 0.05, 240, 0.25);                                                        // the case
  shots.shutter++;
}
export function stampSound() {
  if (!start()) return; wake();
  const t = ctx.currentTime + 0.01;
  duck(0.7, 1.2);
  thud(t, 0.09, 190, 0.7);                       // the seal comes down on the paper
  crack(t + 0.01, 3600, 0.5, 0.06, 0.22);        // the paper gives a little under it
  shots.stamp++;
}
// A brush on paper (T05's own page: the observation's stroke and the copied line, src/writing.js): the hairs drawn over the
// fibres, a soft dry hiss that swells as the brush is pressed and thins as it lifts, high and narrow, under the effects bus
// and quieter than the stamp; and the faint tap of the tip as it first comes down. Our own, made by common sense (no
// recording of a brush was measured): docs/t00/SOURCES.md.
export function brushSound(secs = 0.4) {
  if (!start()) return; wake();
  const t = ctx.currentTime + 0.01, d = Math.max(0.12, Math.min(1.6, secs)), n = Math.floor(ctx.sampleRate * d), b = ctx.createBuffer(1, n, ctx.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < n; i++) { const u = i / n, env = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.75 + 0.25 * Math.sin(u * 31)); x[i] = (Math.random() * 2 - 1) * env; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 0.9; hp.type = "highpass"; hp.frequency.value = 900; g.gain.value = 0.05;
  s.connect(f); f.connect(hp); hp.connect(g); g.connect(bus.effects.in); s.start(t);
  crack(t, 1600, 1.1, 0.04, 0.03);              // the tip comes down
  shots.brush++;
}
// The place's whole sound, taken after the visitor's own volume (a film is heard as it was heard), for a recording
// (clip.js, #342). Null where nothing has sounded yet or the browser has no stream destination: the film is silent then.
export function recordTap() {
  if (!ctx || !master || !ctx.createMediaStreamDestination) return null;
  wake(); const d = ctx.createMediaStreamDestination(); master.connect(d);
  return { stream: d.stream, release() { try { master.disconnect(d); } catch {} } };
}
export const photoSounds = () => ({ ...shots, state: ctx ? ctx.state : "off" });

// ---- The sound of the place when nothing is happening ----
// Wind moving through bamboo (filtered noise that swells and falls), now and then two culms knocking together in a
// gust, birds out on the mountain (never within the walls), water dripping from the eaves after rain, and now and then
// a small bell under an eave. `place()` returns { grove: 0..1, zone, season, time, wet, snow }: how deep
// in the bamboo the listener stands, which part of the mountain (score.js), and the mood. The music starts with it.
let ambient = null;
export function startAmbience(place) {
  starts++; if (!start()) return;
  wake();
  if (ambient) return;
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }   // brown noise
  for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] = d[i] * k + d[len - 2000 + i] * (1 - k); }                   // no click at the loop
  const layer = (type, freq, q, rate = 0.8 + Math.random() * 0.5) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; s.loop = true; s.playbackRate.value = rate; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(air.in); s.start();
    return g;
  };
  const low = layer("bandpass", 420, 0.5), leaves = layer("highpass", 2600, 0.3);
  ambient = { low, leaves, t: 0, nextDrip: 1.5, nextChime: 14, nextKnock: 4, nextBird: 3 };
  if (musicHeld) heldPlace = place; else startMusic(place);
  const tick = () => {
    if (ctx.state !== "running") return;   // suspended (in the background): nothing piles up to sound all at once on return
    const p = place(), now = ctx.currentTime, g = p.grove, a = ambient; a.t += 0.25;
    const inHall = (p.layer ?? p.zone) === "hall";   // `layer`: T05's (score.js layerOf), absent in the prologue, which goes by its zone as ever
    room(inHall, p.layer === "hall");
    // Gusts: the same two slow waves, on the same clock, as the leaves the trees let go and the censer's smoke (wind.js).
    const gust = gustHeard(p, a.t); a.gust = gust; a.gustT = Number.isFinite(p.t) ? p.t : a.t;
    // Deep in the bamboo the wind is the floor of the sound, not its loudest part: about 5 dB under what it was, so
    // that the music and his steps are heard over it there (2026-11-16); in the first court (g 0.12) it is unchanged.
    const w = windGains(gust, g, inHall);
    if (p.layer) { a.bed ||= layer("lowpass", BED.cutoff, 0.5, 0.6); a.bedAsk = bedGain(Number.isFinite(p.t) ? p.t : a.t); a.bed.gain.setTargetAtTime(a.bedAsk, now, 1.2); }   // T05's floor (BED); the prologue gives no layer
    low.gain.setTargetAtTime(w.low, now, 0.8);
    leaves.gain.setTargetAtTime(w.leaves, now, 0.6);
    // Water dripping from the eaves after rain: often in summer, less in spring; none once the stone has dried
    // (autumn) or the water has frozen (snow).
    const rain = p.snow > 0.01 ? 0 : p.wet ?? 1;
    if ((a.nextDrip -= 0.25) <= 0 && rain < 0.4) a.nextDrip = 2;
    else if (a.nextDrip <= 0) {   // a drop falling into standing water
      a.nextDrip = (0.6 + Math.random() * 4.5) / rain;
      const f = 700 + Math.random() * 900, o = ctx.createOscillator(), gg = ctx.createGain();
      o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 1.7, now + 0.06);
      gg.gain.setValueAtTime(0.0001, now); gg.gain.exponentialRampToValueAtTime(0.05 * (1 - 0.6 * g), now + 0.005); gg.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      o.connect(gg); gg.connect(air.in); o.start(now); o.stop(now + 0.15);
    }
    const gap = birdGap(p.zone, p.time, p.season);
    if ((a.nextBird -= 0.25) <= 0) { a.nextBird = gap ? gap * (0.5 + Math.random()) : 4; if (gap) bird(0.6 + 0.4 * g); }
    if ((a.nextKnock -= 0.25) <= 0 && !inHall && knockReady(gust, g)) { a.nextKnock = 6 + Math.random() * 16; knock(0.5 + 0.5 * g); }
    if ((a.nextChime -= 0.25) <= 0 && gust > 0.62) {   // an eave bell, only when the wind is up
      a.nextChime = 18 + Math.random() * 30;
      const f0 = [hz(86), hz(89), hz(91), hz(94)][Math.floor(Math.random() * 4)];   // D F G Bb: tuned to the music's mode
      for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) { partial(f0, 0.035, 2.6, now + k * 0.45, "sine", air.in); partial(f0 * 2.76, 0.012, 1.2, now + k * 0.45, "sine", air.in); }
    }
  };
  setInterval(tick, 250);
}

// ---- The music ----
// One player for the whole visit, however many times the first tap or the title asks for sound. Every quarter second
// it asks score.js where he is settled and whether a phrase should begin, on the audio clock (not the frame loop:
// software rendering may draw one frame a second); instruments.js's player hands the notes to the voices.
let music = null, seals = 0, starts = 0, players = 0;
export function setSeals(n) { seals = Math.max(0, Math.min(7, n | 0)); }
function startMusic(place) {
  if (music) return;
  players++;
  const keeper = createZoneKeeper(2), player = createPlayer(ctx, bus.music.in, (Date.now() / 1000) | 0);
  music = { keeper, player, place };
  const tick = () => {
    if (ctx.state !== "running") return;
    const p = place(); if (p.zone === "none") return;   // a level with no music of its own yet hears none (score.js zoneOf)
    const now = ctx.currentTime, zone = keeper.update(titleAwaited && p.zone === "gate" ? "stair" : p.joya ? joyaZone(p.zone || "court") : p.zone || "court", now);
    player.tick(now, zone, seals, moodMusic(p.season, p.time));
  };
  tick(); setInterval(tick, 250);
}
// The close of the chapter: its own music, written to the close's timeline (score.js's endingPhrase), begun at once.
// `bell` and `title`: seconds from now to the far bell and to the title. Passed over, it fades as on a change of place.
const closing = () => !!music && music.player.conductor.section === "ending" && ctx.currentTime < music.player.conductor.notesEnd;
export function closeMusic(at = {}) {
  if (!music || ctx.state !== "running") return false;
  const p = music.place(), now = ctx.currentTime;
  music.player.close(now, endingPhrase(moodMusic(p.season, p.time), at), music.keeper.stable || p.zone || "summit"); cues.ending++;
  return true;
}
export function passClose() { if (music && music.player.leave(ctx.currentTime)) cues.passed++; }
// For the tests and tools: what the music is doing.
export function musicState() {
  if (!music) return { state: ctx ? ctx.state : "off", started: false, starts, players };
  const now = ctx.currentTime, c = music.player.conductor;
  return { state: ctx.state, clock: now, started: true, starts, players, zone: music.keeper.stable, candidate: music.keeper.candidate, section: c.section,
    place: c.place, phrases: music.player.phrases, cuts: c.cuts, playing: now < c.notesEnd, resting: now >= c.notesEnd && now < c.restEnd, pending: music.player.pending,
    sounding: music.player.voices.sounding, seals, hushed: rest < 1, duck: +bus.music.duck.gain.value.toFixed(3), ducked: now < ducked.until, level: +bus.music.level.gain.value.toFixed(3),
    placeLevel: +music.player.level.gain.value.toFixed(3), room: roomNow ? "hall" : "court", long: longNow, verb: roomNow ? (longNow ? "hall" : "timber") : "court", levels: { ...levels }, sig: music.player.last && music.player.last.sig };
}
