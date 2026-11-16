// The instruments the score is played on, made from nothing, as the bell and drum are. Each works on any audio
// context, the page's live one or an offline one that renders the same music to a file for listening.
//
//   qin   a silk string plucked over a long wooden body: a Karplus-Strong string, then a body resonance. The finger
//         may slide into the note after the pluck ("up") or let it waver slowly ("yin"), as qin players do.
//   harm  a qin harmonic: the finger touches the string lightly, and a clear, almost glassy tone is left.
//   low   an open string at the bottom of the instrument, plucked softly.
//   xiao  the vertical bamboo flute: a soft tone with breath in it, a small scoop up into each note, a slow vibrato.
//   pad   a held open fifth, so thin it is felt more than heard.
import { hz, createConductor, SECTION_LEVEL } from "./score.js";

// Reverbs as decaying noise. Outdoors: a walled court with a hill behind it. Indoors: a timber hall, shorter and darker.
export function reverb(ctx, seconds, power, dark = 0) {
  const len = Math.floor(ctx.sampleRate * seconds), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { const n = Math.random() * 2 - 1; lp += (n - lp) * (1 - dark * Math.min(1, i / len * 3)); d[i] = lp * Math.pow(1 - i / len, power); }
  }
  const c = ctx.createConvolver(); c.buffer = ir; return c;
}

// One plucked string, rendered once per note and kept. The period is a whole number of samples; the true pitch is
// reached by playing the buffer a little faster or slower.
const strings = new WeakMap();
function stringBuffer(ctx, m, kind) {
  let cache = strings.get(ctx); if (!cache) strings.set(ctx, (cache = new Map()));
  const key = kind + m; if (cache.has(key)) return cache.get(key);
  const sr = ctx.sampleRate, f = hz(m), N = Math.max(8, Math.round(sr / f));
  const secs = kind === "low" ? 6.5 : 4.8, len = Math.floor(sr * secs), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  // The pluck: noise, softened (a finger, not a plectrum), and a little of it cancelled to stand for where it is plucked.
  let lp = 0; for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * (kind === "low" ? 0.35 : 0.5); d[i] = lp; }
  for (let i = N - 1; i >= Math.floor(N / 7); i--) d[i] -= 0.6 * d[i - Math.floor(N / 7)];
  // Decay: the loss per pass is set so the note dies over about its length; low strings ring longer and darker.
  const t60 = kind === "low" ? 5.5 : Math.max(2.2, 4.6 - (m - 50) * 0.06), rho = Math.pow(10, -3 / (t60 * f)), S = kind === "low" ? 0.42 : 0.47;
  for (let i = N; i < len; i++) d[i] = rho * ((1 - S) * d[i - N] + S * d[i - N - 1 < 0 ? 0 : i - N - 1]);
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i])); for (let i = 0; i < len; i++) d[i] /= peak || 1;
  const fade = Math.floor(sr * 0.25); for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;   // never ends on a click
  const out = { buffer: b, rate: ((N + S) * f) / sr }; cache.set(key, out); return out;   // the loop filter adds S of a sample to each pass
}
let noiseBuf = new WeakMap();
function noise(ctx) {
  if (noiseBuf.has(ctx)) return noiseBuf.get(ctx);
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf.set(ctx, b); return b;
}
const flute = new WeakMap();
function fluteWave(ctx) {
  if (!flute.has(ctx)) flute.set(ctx, ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.22, 0.1, 0.04, 0.02])));
  return flute.get(ctx);
}

// The great bell, struck with a hanging log, as a temple bell is: not a hammer's clang but a soft, deep blow, then
// the bronze. A low hum that swells a moment after the stroke and is the last thing heard, about three quarters of a
// minute later; the fundamental (98 Hz, the key the music is built on) half a minute; the minor third and the upper
// partials dying first, so the sound darkens as it fades. Each partial is two a fraction of a hertz apart, which gives
// the slow waver of a cast bell. `echo`, if given, is where the hillside's answer goes.
export const BELL = { f0: 98, partials: [[0.5, 0.3, 45, 0.45], [1, 0.5, 34, 0.012], [1.19, 0.24, 22, 0.008], [1.5, 0.13, 14, 0.006], [2, 0.21, 11, 0.005], [2.52, 0.1, 6, 0.004], [3.01, 0.065, 4, 0.004], [4.1, 0.04, 2.2, 0.003], [5.4, 0.022, 1.2, 0.003]] };
export function bell(ctx, out, t, loud = 1, echo = null) {
  const g = ctx.createGain(); g.gain.value = 0.45 * loud; g.connect(out); if (echo) g.connect(echo);
  let end = t;
  BELL.partials.forEach(([r, a, t60, att], k) => {
    for (const [mul, beat, amp] of [[1, 0, 1], [1.0035, 0.25 + 0.12 * k, 0.7]]) {
      const o = ctx.createOscillator(), e = ctx.createGain(), stop = t + t60 + 1.5;
      o.frequency.value = BELL.f0 * r * mul + beat;
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(a * amp, t + att); e.gain.setTargetAtTime(0, t + att, t60 / 6.9);
      o.connect(e); e.connect(g); o.start(t); o.stop(stop); end = Math.max(end, stop);
    }
  });
  // The log: a dull, low thump of wood on bronze, and the faint knock of its iron-shod end.
  const n = Math.floor(ctx.sampleRate * 0.5), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 5);
  for (const [cut, amp] of [[260, 1.1], [1300, 0.12]]) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain(); s.buffer = b; f.type = "lowpass"; f.frequency.value = cut; v.gain.value = amp; s.connect(f); f.connect(v); v.connect(g); s.start(t); }
  return end;
}
// The hillside answering the bell: one late, dark repeat that dies away, as from the slope across the valley.
export function hillEcho(ctx, out) {
  const d = ctx.createDelay(2), lp = ctx.createBiquadFilter(), fb = ctx.createGain(), wet = ctx.createGain();
  d.delayTime.value = 1.15; lp.type = "lowpass"; lp.frequency.value = 650; fb.gain.value = 0.28; wet.gain.value = 0.32;
  d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(out);
  return d;
}

// `out`: where the voices go (a gain node). Returns play(event, when): `event` as score.js writes it, `when` in the
// context's seconds. Every voice ends through a short fade to nothing, so no note is ever stopped while it sounds.
export function createVoices(ctx, out) {
  // The qin's body: a wooden resonance low down, and the top rolled off.
  const body = ctx.createBiquadFilter(); body.type = "peaking"; body.frequency.value = 180; body.Q.value = 1.1; body.gain.value = 5;
  const top = ctx.createBiquadFilter(); top.type = "lowpass"; top.frequency.value = 3200; top.Q.value = 0.4;
  body.connect(top); top.connect(out);
  let sounding = 0;
  // The last thing in every voice: open, then closed over 60 ms just before its sources stop. Counted while it sounds.
  const gate = (dest, stopAt, first) => { const g = ctx.createGain(); g.gain.setValueAtTime(1, Math.max(0, stopAt - 0.07)); g.gain.linearRampToValueAtTime(0, stopAt - 0.01); g.connect(dest); sounding++; first.onended = () => { sounding--; try { g.disconnect(); } catch {} }; return g; };
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0.0001, t + a, d); };

  const voices = {
    qin(e, t, kind = "qin") {
      const s = stringBuffer(ctx, e.m, kind), src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = s.buffer; const r = s.rate;
      const p = src.playbackRate; p.setValueAtTime(r, t);
      if (e.slide === "up") { p.setValueAtTime(r * Math.pow(2, -1 / 12), t); p.setValueAtTime(r * Math.pow(2, -1 / 12), t + 0.12); p.linearRampToValueAtTime(r, t + 0.34); }
      if (e.slide === "yin") { const c = new Float32Array(48); for (let i = 0; i < 48; i++) c[i] = r * Math.pow(2, (Math.sin(i / 47 * Math.PI * 2 * 3.5) * 9 * (i / 47)) / 1200); p.setValueCurveAtTime(c, t + 0.45, Math.max(0.6, Math.min(e.dur, 4) - 0.45)); }
      const len = s.buffer.duration / r, vel = (kind === "low" ? 0.42 : 0.34) * e.vel, stop = t + Math.min(len, Math.max(0.3, e.dur) + 2.5);
      g.gain.setValueAtTime(vel, t); g.gain.setValueAtTime(vel, t + Math.max(0.3, e.dur)); g.gain.setTargetAtTime(0.0001, t + Math.max(0.3, e.dur), 0.5);
      src.connect(g); g.connect(gate(body, stop, src)); src.start(t); src.stop(stop);
    },
    low(e, t) { voices.qin(e, t, "low"); },
    harm(e, t) {
      const f = hz(e.m), g = ctx.createGain(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), stop = t + Math.min(6, e.dur + 2.5);
      o1.frequency.value = f; o2.frequency.value = f * 2.003; g2.gain.value = 0.12;
      env(g, t, 0.006, 0.17 * e.vel, Math.min(1.6, 0.9 + 600 / f));
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(gate(out, stop, o1)); o1.start(t); o2.start(t); o1.stop(stop); o2.stop(stop);
      // The touch on the string: the faintest pluck of the same note underneath.
      voices.qin({ ...e, vel: e.vel * 0.12, slide: null, dur: 0.5 }, t);
    },
    xiao(e, t) {
      const f = hz(e.m), o = ctx.createOscillator(), g = ctx.createGain(), dur = Math.max(0.3, e.dur), stop = t + dur + 0.9;
      o.setPeriodicWave(fluteWave(ctx)); o.frequency.value = f;
      o.detune.setValueAtTime(-35, t); o.detune.linearRampToValueAtTime(0, t + 0.14);       // the scoop up into the note
      const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = 4.6; depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(0, t + 0.5); depth.gain.linearRampToValueAtTime(9, t + Math.max(0.6, Math.min(dur, 2.2)));
      lfo.connect(depth); depth.connect(o.detune);
      const vel = 0.13 * e.vel, a = Math.min(0.2, dur * 0.4); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.setValueAtTime(vel, t + dur); g.gain.setTargetAtTime(0.0001, t + dur, 0.18);
      // Breath: noise around the note, and a puff at the start.
      const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noise(ctx); n.loop = true;
      bp.type = "bandpass"; bp.frequency.value = f * 1.02; bp.Q.value = 5; ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vel * 1.6, t + 0.05); ng.gain.linearRampToValueAtTime(vel * 0.45, t + Math.max(0.1, a + 0.1)); ng.gain.setValueAtTime(vel * 0.45, t + dur); ng.gain.setTargetAtTime(0.0001, t + dur, 0.16);
      const soft = ctx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = Math.min(9000, f * 6);
      const end = gate(out, stop, o); o.connect(soft); soft.connect(g); n.connect(bp); bp.connect(ng); g.connect(end); ng.connect(end);
      for (const x of [o, lfo, n]) { x.start(t); x.stop(stop); }
    },
    pad(e, t) {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(), dur = Math.max(4, e.dur), stop = t + dur + 5.2;
      lp.type = "lowpass"; lp.frequency.value = 700; lp.connect(g);
      const vel = 0.035 * e.vel; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 3.5); g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 5);
      const os = [[e.m, 0], [e.m, 4], [e.m + 7, -3], [e.m + 12, 2]].map(([m, c], i) => { const o = ctx.createOscillator(); o.type = i === 3 ? "triangle" : "sine"; o.frequency.value = hz(m); o.detune.value = c; o.connect(lp); return o; });
      g.connect(gate(out, stop, os[0])); for (const o of os) { o.start(t); o.stop(stop); }
    },
  };
  return {
    play(e, when) { (voices[e.voice] || voices.qin)(e, Math.max(when, ctx.currentTime + 0.005)); },
    get sounding() { return sounding; },
  };
}

// The music of a visit, on one context: the conductor (score.js) chooses, a place level fades the music in and out,
// and notes are handed to the voices a little ahead of time, so that a change of place can drop the ones not yet begun.
// tick() is called a few times a second with the audio clock; the page does it on a timer, tools/music.mjs in a loop.
export function createPlayer(ctx, out, seed = 1) {
  const level = ctx.createGain(); level.gain.value = 0; level.connect(out);
  const voices = createVoices(ctx, level), conductor = createConductor(seed);
  let queue = [], last = null, phrases = 0, faded = false;
  return {
    conductor, voices, level,
    tick(now, zone, seals, mood, ahead = 0.6) {
      const p = conductor.tick(now, zone, seals, mood);
      if (p && p.cut) { queue = []; faded = true; level.gain.setTargetAtTime(0, now, p.fade / 4); }       // leaving: fade what sounds
      else if (p) {
        // Arriving: the level is back within half a second, and after a fade the first notes wait for it.
        last = p; phrases++; level.gain.setTargetAtTime(SECTION_LEVEL[p.section] ?? 0.8, now, 0.15);
        const wait = faded ? 0.5 : 0; faded = false;
        queue = p.events.map((e) => ({ ...e, when: p.start + e.at + wait })).sort((a, b) => a.when - b.when);
      }
      while (queue.length && queue[0].when < now + ahead) { const e = queue.shift(); voices.play(e, e.when); }   // voices.play may be replaced (the render tool's stems)
      return p;
    },
    get last() { return last; },
    get phrases() { return phrases; },
    get pending() { return queue.length; },
  };
}
