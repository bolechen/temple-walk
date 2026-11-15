// Sounds made from nothing: a temple bell and a drum, each built from decaying partials, the sound of the place, and
// the music (score.js says what, instruments.js plays it). The audio context starts on the first tap, as browsers
// require. Three buses, each with its own level in the pause menu: music, the place (wind, water, eave bells) and
// effects (bell, drum, chime). Each bus sends to one of two reverbs: the court outdoors, the timber hall indoors.
import { createVoices, reverb } from "./instruments.js";
import { createConductor, createZoneKeeper, moodMusic, sealNote, SECTION_LEVEL, hz } from "./score.js";
let ctx = null, master = null, comp = null, outVerb = null, inVerb = null;
const bus = {};   // music, ambience, effects: { in, level, duck, tap, dry, sendOut, sendIn }
// How loud the visitor wants it, 0..1 (the pause menu); remembered if nothing has sounded yet.
const levels = { volume: 0.8, music: 0.7, ambience: 0.8, effects: 1 };
export function setVolume(v) { setLevels({ volume: v }); }
export function setLevels(o) {
  for (const k in o) if (k in levels && Number.isFinite(o[k])) levels[k] = Math.min(1, Math.max(0, o[k]));
  if (!ctx) return;
  master.gain.setTargetAtTime(levels.volume, ctx.currentTime, 0.05);
  for (const k of ["music", "ambience", "effects"]) bus[k].level.gain.setTargetAtTime(levels[k], ctx.currentTime, 0.05);
}
// For the tests: is anything sounding, how loud, and at which frequencies; on one bus, or everything together.
export function listen(which) {
  const tap = which && bus[which] ? bus[which].tap : bus.all;
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
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master = ctx.createGain(); master.gain.value = levels.volume; comp.connect(master); master.connect(ctx.destination);   // the visitor's own volume, last in the chain
  bus.all = ctx.createAnalyser(); bus.all.fftSize = 8192; bus.all.smoothingTimeConstant = 0; comp.connect(bus.all);
  outVerb = reverb(ctx, 3.2, 2.6); inVerb = reverb(ctx, 2.0, 3.2, 0.9); outVerb.connect(comp); inVerb.connect(comp);
  // Each bus: what goes in, the visitor's level for it, a duck (the music steps back for the bell), then dry and
  // reverb. The level comes before the reverb send, so a muted bus leaves no echo behind.
  for (const [k, dry, wet] of [["music", 0.7, 0.55], ["ambience", 0.8, 0.45], ["effects", 0.8, 0.45]]) {
    const b = (bus[k] = {}); b.in = ctx.createGain(); b.level = ctx.createGain(); b.level.gain.value = levels[k]; b.duck = ctx.createGain();
    b.dry = ctx.createGain(); b.dry.gain.value = dry; b.sendOut = ctx.createGain(); b.sendOut.gain.value = wet; b.sendIn = ctx.createGain(); b.sendIn.gain.value = 0;
    b.in.connect(b.level); b.level.connect(b.duck); b.duck.connect(b.dry); b.duck.connect(b.sendOut); b.duck.connect(b.sendIn);
    b.dry.connect(comp); b.sendOut.connect(outVerb); b.sendIn.connect(inVerb);
    b.tap = ctx.createAnalyser(); b.tap.fftSize = 8192; b.tap.smoothingTimeConstant = 0; b.dry.connect(b.tap); b.wet = wet;
  }
  // A page in the background is silent, and picks up where it was on return (the audio clock stops with it, so the
  // music does not hurry to catch up).
  document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
  return ctx;
}
// Indoors or out: the reverb follows, over a couple of seconds.
function room(inside) {
  const t = ctx.currentTime;
  for (const k of ["music", "ambience", "effects"]) { const b = bus[k]; b.sendOut.gain.setTargetAtTime(inside ? 0 : b.wet, t, 0.7); b.sendIn.gain.setTargetAtTime(inside ? b.wet * 1.1 : 0, t, 0.7); }
}
// The music steps back while the bell or the drum speaks, and comes back of itself.
let ducked = { until: 0, depth: 1 };
function duck(depth, secs) {
  if (!bus.music) return; const t = ctx.currentTime, g = bus.music.duck.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(depth, t, 0.15); g.setTargetAtTime(1, t + secs, 2.2);
  ducked = { until: t + secs, depth };
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

export function strike(kind, loud = 1) {
  if (!start()) return;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime + 0.01;
  duck(kind === "bell" ? 0.18 : 0.5, kind === "bell" ? 9 : 2.5);
  if (kind === "bell") {
    // A large bronze bell: a low hum, a strong fundamental, inharmonic upper partials that die first.
    // Each partial is doubled a fraction of a hertz apart, which gives the slow beat of a cast bell.
    const f0 = 98;
    for (const [r, a, d] of [[0.5, 0.22, 11], [1, 0.5, 9], [1.19, 0.22, 6.5], [1.5, 0.16, 5], [2, 0.2, 4], [2.52, 0.1, 2.8], [3.01, 0.07, 2], [4.1, 0.04, 1.2]]) {
      partial(f0 * r, a * loud * 0.5, d, t); partial(f0 * r * 1.004 + 0.3, a * loud * 0.35, d * 0.93, t);
    }
    thud(t, 0.09, 900, 0.5 * loud);
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
  if (!start()) return; if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime + 0.01, f = hz(sealNote(n) ?? sealNote(1));
  duck(0.55, 2.5);
  for (const [r, a, d] of [[1, 0.16, 3.4], [1.0055, 0.09, 3.0], [2.353, 0.05, 1.6], [3.842, 0.02, 0.8]]) partial(f * r, a * loud, d, t);
}
export function drop() {
  if (!start()) return; if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime + 0.01, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(520, now); o.frequency.exponentialRampToValueAtTime(1150, now + 0.09);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.22, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  o.connect(g); g.connect(bus.effects.in); o.start(now); o.stop(now + 0.35);
}

// ---- The sound of the place when nothing is happening ----
// Wind moving through bamboo (filtered noise that swells and falls), water dripping from the eaves after
// rain, and now and then a small bell under an eave. `place()` returns { grove: 0..1, zone, season, time }: how deep
// in the bamboo the listener stands, which part of the mountain (score.js), and the mood. The music starts with it.
let ambient = null;
export function startAmbience(place) {
  starts++; if (ambient || !start()) return;
  if (ctx.state === "suspended") ctx.resume();
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
  ambient = { low, leaves, t: 0, nextDrip: 1.5, nextChime: 14 };
  startMusic(place);
  const tick = () => {
    const now = ctx.currentTime, g = place().grove, a = ambient; a.t += 0.25;
    // Gusts: two slow waves that sometimes meet.
    const gust = 0.5 + 0.3 * Math.sin(a.t * 0.11) + 0.2 * Math.sin(a.t * 0.043 + 1.7);
    low.gain.setTargetAtTime(0.5 * gust * (0.35 + 0.65 * g), now, 0.8);
    leaves.gain.setTargetAtTime(0.16 * gust * gust * (0.15 + 0.85 * g), now, 0.6);
    if ((a.nextDrip -= 0.25) <= 0) {   // a drop falling into standing water
      a.nextDrip = 0.6 + Math.random() * 4.5;
      const f = 700 + Math.random() * 900, o = ctx.createOscillator(), gg = ctx.createGain();
      o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 1.7, now + 0.06);
      gg.gain.setValueAtTime(0.0001, now); gg.gain.exponentialRampToValueAtTime(0.05 * (1 - 0.6 * g), now + 0.005); gg.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      o.connect(gg); gg.connect(bus.ambience.in); o.start(now); o.stop(now + 0.15);
    }
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
// software rendering may draw one frame a second), and schedules that phrase's notes a moment ahead.
let music = null, seals = 0, starts = 0;
export function setSeals(n) { seals = Math.max(0, Math.min(7, n | 0)); }
function startMusic(place) {
  if (music) return;
  const keeper = createZoneKeeper(2), conductor = createConductor((Date.now() / 1000) | 0);
  const section = ctx.createGain(); section.gain.value = 0; section.connect(bus.music.in);
  const v2 = createVoices(ctx, section);   // the voices play through a per-place level that fades over a few seconds
  music = { keeper, conductor, voices: v2, section, last: null, phrases: 0, mood: null, inside: null };
  const tick = () => {
    if (ctx.state !== "running") return;
    const p = place(), now = ctx.currentTime, zone = keeper.update(p.zone || "court", now), mood = moodMusic(p.season, p.time);
    const inside = zone === "hall"; if (inside !== music.inside) { music.inside = inside; room(inside); }
    music.mood = mood;
    const phrase = conductor.tick(now, zone, seals, mood);
    if (phrase) {
      music.last = phrase; music.phrases++;
      section.gain.setTargetAtTime(SECTION_LEVEL[phrase.section] ?? 0.8, now, 2);   // about six seconds to settle
      for (const e of phrase.events) v2.play(e, phrase.start + e.at);
    }
  };
  tick(); setInterval(tick, 250);
}
// For the tests and tools: what the music is doing.
export function musicState() {
  if (!music) return { state: ctx ? ctx.state : "off", started: false, starts };
  const now = ctx.currentTime;
  return { state: ctx.state, clock: now, started: true, starts, players: 1, zone: music.keeper.stable, candidate: music.keeper.candidate, section: music.conductor.section,
    place: music.conductor.place, phrases: music.phrases, playing: now < music.conductor.notesEnd, resting: now >= music.conductor.notesEnd && now < music.conductor.restEnd,
    sounding: music.voices.sounding, seals, duck: +bus.music.duck.gain.value.toFixed(3), ducked: now < ducked.until, level: +bus.music.level.gain.value.toFixed(3),
    sectionLevel: +music.section.gain.value.toFixed(3), room: music.inside ? "hall" : "court", levels: { ...levels }, sig: music.last && music.last.sig };
}
