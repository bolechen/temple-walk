// Sounds made from nothing: a temple bell and a drum, each built from decaying partials,
// played through a generated reverb. The audio context starts on the first tap, as browsers require.
let ctx = null, wet = null, dry = null;

function start() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  // Reverb: decaying noise as an impulse response, like a walled court with a hill behind it.
  const len = Math.floor(ctx.sampleRate * 3.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  const conv = ctx.createConvolver(); conv.buffer = ir;
  const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.gain.value = 0.8; dry.connect(comp);
  wet = ctx.createGain(); wet.gain.value = 0.45; wet.connect(conv); conv.connect(comp);
  return ctx;
}
function partial(freq, gain, decay, t0, type = "sine") {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  o.connect(g); g.connect(dry); g.connect(wet); o.start(t0); o.stop(t0 + decay + 0.05);
}
function thud(t0, dur, cutoff, gain) {   // a short burst of filtered noise: the mallet, the skin
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = "lowpass"; f.frequency.value = cutoff; g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(dry); g.connect(wet); s.start(t0);
}

export function strike(kind, loud = 1) {
  if (!start()) return;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime + 0.01;
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
    o.connect(g); g.connect(dry); g.connect(wet); o.start(t); o.stop(t + 1.7);
    partial(148, 0.25 * loud, 0.5, t); thud(t, 0.16, 420, 0.9 * loud);
  }
}
