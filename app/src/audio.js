// Sounds made from nothing: a temple bell and a drum, each built from decaying partials, the sound of the place, and
// the music (score.js says what, instruments.js plays it). The audio context starts on the first tap, as browsers
// require. Three buses, each with its own level in the pause menu: music, the place (wind, water, eave bells) and
// effects (bell, drum, chime). Each bus sends to one of two reverbs: the court outdoors, the timber hall indoors.
import { createPlayer, reverb, bell, hillEcho } from "./instruments.js";
import { createZoneKeeper, moodMusic, sealNote, hz, endingPhrase } from "./score.js";
import { stepSound, LEVEL } from "./steps.js";
let ctx = null, master = null, comp = null, outVerb = null, inVerb = null, steps = null;
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
  outVerb = reverb(ctx, 3.2, 2.6); inVerb = reverb(ctx, 2.0, 3.2, 0.9); outVerb.connect(comp); inVerb.connect(comp);
  // Each bus: what goes in, the visitor's level for it, a duck (the music steps back for the bell), then dry and
  // reverb. The level comes before the reverb send, so a muted bus leaves no echo behind.
  for (const [k, dry, wet] of [["music", 0.7, 0.55], ["ambience", 0.8, 0.45], ["effects", 0.8, 0.45]]) {
    const b = (bus[k] = /** @type {any} */ ({})); b.in = ctx.createGain(); b.level = ctx.createGain(); b.level.gain.value = levels[k]; b.duck = ctx.createGain();
    b.dry = ctx.createGain(); b.dry.gain.value = dry; b.sendOut = ctx.createGain(); b.sendOut.gain.value = wet; b.sendIn = ctx.createGain(); b.sendIn.gain.value = 0;
    b.in.connect(b.level); b.level.connect(b.duck); b.duck.connect(b.dry); b.duck.connect(b.sendOut); b.duck.connect(b.sendIn);
    b.dry.connect(comp); b.sendOut.connect(outVerb); b.sendIn.connect(inVerb);
    b.tap = ctx.createAnalyser(); b.tap.fftSize = 8192; b.tap.smoothingTimeConstant = 0; b.dry.connect(b.tap); b.wet = wet;
  }
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
// Indoors or out: the reverb follows, over a couple of seconds.
let roomNow = null;
function room(inside) {
  if (inside === roomNow) return; roomNow = inside;
  const t = ctx.currentTime;
  for (const k of ["music", "ambience", "effects"]) { const b = bus[k]; b.sendOut.gain.setTargetAtTime(inside ? 0 : b.wet, t, 0.7); b.sendIn.gain.setTargetAtTime(inside ? b.wet * 1.1 : 0, t, 0.7); }
  steps.sendOut.gain.setTargetAtTime(inside ? 0 : STEP_WET.out, t, 0.7); steps.sendIn.gain.setTargetAtTime(inside ? STEP_WET.in : 0, t, 0.7);
}
// The music steps back while the bell or the drum speaks, and comes back of itself.
let ducked = { until: 0, depth: 1 }, rest = 1;
function duck(depth, secs) {
  if (!bus.music) return; const t = ctx.currentTime, g = bus.music.duck.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(Math.min(depth, rest), t, 0.15); g.setTargetAtTime(rest, t + secs, 2.2);
  ducked = { until: t + secs, depth };
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

// One drop falling into the dragon well, heard from near by (`level` 0..1, well.js): a short rising plink, darker
// than the eaves' drips, and the stone niche giving it back twice, fainter and duller each time.
let niche = null;
export function wellDrip(level = 1) {
  if (!ctx || ctx.state !== "running" || level <= 0) return;
  if (!niche) {
    const d = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), out = ctx.createGain();
    d.delayTime.value = 0.13; fb.gain.value = 0.32; lp.type = "lowpass"; lp.frequency.value = 1400; out.gain.value = 0.6;
    d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out); out.connect(bus.ambience.in); niche = d;
  }
  const now = ctx.currentTime + 0.01, f = 430 + Math.random() * 120, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 2.1, now + 0.08);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.11 * level, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  o.connect(g); g.connect(bus.ambience.in); g.connect(niche); o.start(now); o.stop(now + 0.25);
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
  if (!ctx || ctx.state !== "running" || level <= 0) return;
  const now = ctx.currentTime + 0.01, f = 300 + Math.random() * 140, twice = Math.random() < 0.6;
  for (const [dt, loud] of twice ? [[0, 1], [0.13 + Math.random() * 0.12, 0.45]] : [[0, 1]]) {
    const t = now + dt;
    partial(f * (dt ? 1.07 : 1), 0.07 * level * loud, 0.09, t, "sine", bus.ambience.in);       // the hollow of the culm
    partial(f * 2.71, 0.025 * level * loud, 0.04, t, "triangle", bus.ambience.in);              // the dry wood of its wall
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
  if (!ctx || ctx.state !== "running" || level <= 0) return;
  const now = ctx.currentTime + 0.02, n = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1400, pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const far = ctx.createBiquadFilter(); far.type = "lowpass"; far.frequency.value = 5200; if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; far.connect(pan); pan.connect(bus.ambience.in); } else far.connect(bus.ambience.in);
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
export const ambienceState = () => ({ knocks, birds, running: !!ambient });

// ---- Two cues of the story ----
// Wings: a dozen small birds going up at once from a tree, a rattle of quick wingbeats that thins as they climb away,
// and two or three alarm calls among them.
const cues = { flutter: 0, farBell: 0, ending: 0, passed: 0 };
export function flutter(level = 1) {
  if (!ctx || ctx.state !== "running" || level <= 0) return;
  const now = ctx.currentTime + 0.02;
  for (let i = 0; i < 46; i++) {
    const t = now + Math.pow(i / 46, 1.6) * 2.2 + Math.random() * 0.05, far = 1 - i / 46;
    crack(t, 900 + Math.random() * 1400, 0.7, 0.05 * level * far, 0.03, bus.ambience.in);
  }
  setTimeout(() => { for (let k = 0; k < 3; k++) setTimeout(() => bird(0.7 * level), k * 260); }, 120);
  cues.flutter++;
}
// The close of the chapter: a bell in the far hills answering, another temple's, a tone lower than ours, dark and
// small with the distance, and given back once more by the valley.
let farEcho = null;
export function farBell() {
  if (!start()) return; wake();
  const t = ctx.currentTime + 0.05, lp = ctx.createBiquadFilter(), g = ctx.createGain();
  lp.type = "lowpass"; lp.frequency.value = 650; g.gain.value = 0.32; lp.connect(g); g.connect(bus.effects.in);
  if (!farEcho) { farEcho = hillEcho(ctx, bus.effects.in); }
  if (!closing()) duck(0.3, 12);   // the close's own music has already made room for it
  bell(ctx, lp, t, 0.9, farEcho, hz(41));   // F2: in the music's mode, below the near bell's G
  cues.farBell++;
}
export const cueState = () => ({ ...cues });

// ---- The photograph ----
// The shutter: a small leaf shutter in a wooden body, two soft clicks thirty milliseconds apart (the blades closing and
// opening) over a faint knock of the case; nothing electronic. And when the print comes, the seal pressed on it: a dull
// pad of a stamp on paper, and the paper giving a little under it. Both on the effects bus; the music steps aside briefly.
const shots = { shutter: 0, stamp: 0 };
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
  const layer = (type, freq, q) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.5; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(bus.ambience.in); s.start();
    return g;
  };
  const low = layer("bandpass", 420, 0.5), leaves = layer("highpass", 2600, 0.3);
  ambient = { low, leaves, t: 0, nextDrip: 1.5, nextChime: 14, nextKnock: 4, nextBird: 3 };
  startMusic(place);
  const tick = () => {
    if (ctx.state !== "running") return;   // suspended (in the background): nothing piles up to sound all at once on return
    const p = place(), now = ctx.currentTime, g = p.grove, a = ambient; a.t += 0.25;
    room(p.zone === "hall");
    // Gusts: two slow waves that sometimes meet.
    const gust = 0.5 + 0.3 * Math.sin(a.t * 0.11) + 0.2 * Math.sin(a.t * 0.043 + 1.7);
    // Deep in the bamboo the wind is the floor of the sound, not its loudest part: about 5 dB under what it was, so
    // that the music and his steps are heard over it there (2026-11-16); in the first court (g 0.12) it is unchanged.
    low.gain.setTargetAtTime(0.5 * gust * (0.41 + 0.15 * g), now, 0.8);
    leaves.gain.setTargetAtTime(0.16 * gust * gust * (0.21 + 0.353 * g), now, 0.6);
    // Water dripping from the eaves after rain: often in summer, less in spring; none once the stone has dried
    // (autumn) or the water has frozen (snow).
    const rain = p.snow > 0.01 ? 0 : p.wet ?? 1;
    if ((a.nextDrip -= 0.25) <= 0 && rain < 0.4) a.nextDrip = 2;
    else if (a.nextDrip <= 0) {   // a drop falling into standing water
      a.nextDrip = (0.6 + Math.random() * 4.5) / rain;
      const f = 700 + Math.random() * 900, o = ctx.createOscillator(), gg = ctx.createGain();
      o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 1.7, now + 0.06);
      gg.gain.setValueAtTime(0.0001, now); gg.gain.exponentialRampToValueAtTime(0.05 * (1 - 0.6 * g), now + 0.005); gg.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      o.connect(gg); gg.connect(bus.ambience.in); o.start(now); o.stop(now + 0.15);
    }
    const gap = birdGap(p.zone, p.time, p.season);
    if ((a.nextBird -= 0.25) <= 0) { a.nextBird = gap ? gap * (0.5 + Math.random()) : 4; if (gap) bird(0.6 + 0.4 * g); }
    if ((a.nextKnock -= 0.25) <= 0 && knockReady(gust, g)) { a.nextKnock = 6 + Math.random() * 16; knock(0.5 + 0.5 * g); }
    if ((a.nextChime -= 0.25) <= 0 && gust > 0.62) {   // an eave bell, only when the wind is up
      a.nextChime = 18 + Math.random() * 30;
      const f0 = [hz(86), hz(89), hz(91), hz(94)][Math.floor(Math.random() * 4)];   // D F G Bb: tuned to the music's mode
      for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) { partial(f0, 0.035, 2.6, now + k * 0.45, "sine", bus.ambience.in); partial(f0 * 2.76, 0.012, 1.2, now + k * 0.45, "sine", bus.ambience.in); }
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
    const p = place(), now = ctx.currentTime, zone = keeper.update(p.zone || "court", now);
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
    placeLevel: +music.player.level.gain.value.toFixed(3), room: roomNow ? "hall" : "court", levels: { ...levels }, sig: music.player.last && music.player.last.sig };
}
