// The instruments the score is played on, made from nothing, as the bell and drum are. Each works on any audio
// context, the page's live one or an offline one that renders the same music to a file for listening.
//
//   qin   a silk string plucked over a long wooden body: a Karplus-Strong string, then a body resonance. The finger
//         may slide into the note after the pluck ("up") or let it waver slowly ("yin"), as qin players do.
//   harm  a qin harmonic: the finger touches the string lightly, and a clear, almost glassy tone is left.
//   low   an open string at the bottom of the instrument, plucked softly.
//   xiao  the vertical bamboo flute: a soft tone with breath in it, a small scoop up into each note, a slow vibrato.
//   pad   a held open fifth, so thin it is felt more than heard.
import { hz } from "./score.js";

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
  const out = { buffer: b, rate: (N * f) / sr }; cache.set(key, out); return out;
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

// `out`: where the voices go (a gain node). Returns play(event, when): `event` as score.js writes it, `when` in the
// context's seconds. Voices that are still sounding are counted, for the tests.
export function createVoices(ctx, out) {
  // The qin's body: a wooden resonance low down, and the top rolled off.
  const body = ctx.createBiquadFilter(); body.type = "peaking"; body.frequency.value = 180; body.Q.value = 1.1; body.gain.value = 5;
  const top = ctx.createBiquadFilter(); top.type = "lowpass"; top.frequency.value = 3200; top.Q.value = 0.4;
  body.connect(top); top.connect(out);
  let sounding = 0;
  const hold = (secs) => { sounding++; setTimeout(() => sounding--, secs * 1000); };
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0.0001, t + a, d); };

  const voices = {
    qin(e, t, kind = "qin") {
      const s = stringBuffer(ctx, e.m, kind), src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = s.buffer; const r = s.rate;
      const p = src.playbackRate; p.setValueAtTime(r, t);
      if (e.slide === "up") { p.setValueAtTime(r * Math.pow(2, -1 / 12), t); p.setValueAtTime(r * Math.pow(2, -1 / 12), t + 0.12); p.linearRampToValueAtTime(r, t + 0.34); }
      if (e.slide === "yin") { const c = new Float32Array(48); for (let i = 0; i < 48; i++) c[i] = r * Math.pow(2, (Math.sin(i / 47 * Math.PI * 2 * 3.5) * 9 * (i / 47)) / 1200); p.setValueCurveAtTime(c, t + 0.45, Math.max(0.6, Math.min(e.dur, 4) - 0.45)); }
      const len = s.buffer.duration / r, vel = (kind === "low" ? 0.42 : 0.34) * e.vel;
      g.gain.setValueAtTime(vel, t); g.gain.setValueAtTime(vel, t + Math.max(0.3, e.dur)); g.gain.setTargetAtTime(0.0001, t + Math.max(0.3, e.dur), 0.5);
      src.connect(g); g.connect(body); src.start(t); src.stop(t + Math.min(len, e.dur + 2.5)); hold(t - ctx.currentTime + Math.min(len, e.dur + 2.5));
    },
    low(e, t) { voices.qin(e, t, "low"); },
    harm(e, t) {
      const f = hz(e.m), g = ctx.createGain(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), lenS = Math.min(6, e.dur + 2.5);
      o1.frequency.value = f; o2.frequency.value = f * 2.003; g2.gain.value = 0.12;
      env(g, t, 0.006, 0.17 * e.vel, 0.9 + 600 / f);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(out); o1.start(t); o2.start(t); o1.stop(t + lenS); o2.stop(t + lenS); hold(t - ctx.currentTime + lenS);
      // The touch on the string: the faintest pluck of the same note underneath.
      voices.qin({ ...e, vel: e.vel * 0.12, slide: null, dur: 0.5 }, t);
    },
    xiao(e, t) {
      const f = hz(e.m), o = ctx.createOscillator(), g = ctx.createGain(), dur = Math.max(0.6, e.dur), lenS = dur + 0.9;
      o.setPeriodicWave(fluteWave(ctx)); o.frequency.value = f;
      o.detune.setValueAtTime(-35, t); o.detune.linearRampToValueAtTime(0, t + 0.14);       // the scoop up into the note
      const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = 4.6; depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(0, t + 0.5); depth.gain.linearRampToValueAtTime(9, t + Math.min(dur, 2.2));
      lfo.connect(depth); depth.connect(o.detune);
      const vel = 0.13 * e.vel; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.2); g.gain.setValueAtTime(vel, t + dur); g.gain.setTargetAtTime(0.0001, t + dur, 0.22);
      // Breath: noise around the note, and a puff at the start.
      const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noise(ctx); n.loop = true;
      bp.type = "bandpass"; bp.frequency.value = f * 1.02; bp.Q.value = 5; ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vel * 1.6, t + 0.05); ng.gain.linearRampToValueAtTime(vel * 0.45, t + 0.3); ng.gain.setValueAtTime(vel * 0.45, t + dur); ng.gain.setTargetAtTime(0.0001, t + dur, 0.2);
      const soft = ctx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = Math.min(9000, f * 6);
      o.connect(soft); soft.connect(g); n.connect(bp); bp.connect(ng); g.connect(out); ng.connect(out);
      for (const x of [o, lfo, n]) { x.start(t); x.stop(t + lenS); } hold(t - ctx.currentTime + lenS);
    },
    pad(e, t) {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(), dur = Math.max(4, e.dur), lenS = dur + 6;
      lp.type = "lowpass"; lp.frequency.value = 700; lp.connect(g); g.connect(out);
      const vel = 0.035 * e.vel; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 3.5); g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 5);
      const os = [[e.m, 0], [e.m, 4], [e.m + 7, -3], [e.m + 12, 2]].map(([m, c], i) => { const o = ctx.createOscillator(); o.type = i === 3 ? "triangle" : "sine"; o.frequency.value = hz(m); o.detune.value = c; o.connect(lp); o.start(t); o.stop(t + lenS); return o; });
      hold(t - ctx.currentTime + lenS); return os;
    },
  };
  return {
    play(e, when) { (voices[e.voice] || voices.qin)(e, Math.max(when, ctx.currentTime + 0.005)); },
    get sounding() { return sounding; },
  };
}
