// The sound of his steps, made from nothing, and what each one comes down on.
//
// He is a child in cloth shoes: on stone a step is not a click of heels but a soft pat as the heel lands and a
// softer brush as the weight rolls onto the ball of the foot. After rain the same pat is wetter, the sole lifting
// off a film of water; where water stands in a hollow of the paving the shoe goes in with a small splash, a scatter of
// bubbles that ring as they close. And snow does not thud: it gives way in a run of tiny collapses as the crystals
// under the sole break, many at once where the weight is, each a click a millisecond or two long, now and then a
// louder one. Every kind follows the same push of the foot (`press`), heel and then ball, and everything is worked out
// here sample by sample, so the page and an offline render (tools/steps.mjs) hear the same step.

// A small seeded generator, so that a step can be heard again (tests, renders) and every step differs.
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
// A two-pole filter section (the RBJ cookbook's band-pass, low-pass and high-pass), run over a buffer in place.
function biquad(x, sr, type, f, q) {
  const w = (2 * Math.PI * f) / sr, a = Math.sin(w) / (2 * q), c = Math.cos(w);
  let b0, b1, b2;
  if (type === "band") { b0 = a; b1 = 0; b2 = -a; }
  else if (type === "high") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}

// How hard the foot presses at time u (0..1 of the step): the heel lands, the weight rolls forward onto the ball.
export function press(u) {
  const heel = Math.exp(-(((u - 0.16) / 0.075) ** 2)), ball = 0.85 * Math.exp(-(((u - 0.52) / 0.16) ** 2));
  return Math.max(heel, ball) * (u < 0 || u > 1 ? 0 : 1);
}

// How long a step takes to sound at a speed (metres a second): a hurried step is shorter and harder.
const hurryOf = (speed) => Math.min(1.6, Math.max(0.6, speed / 2.1));
// Scaled to a peak of 0.9, with a few samples' fade at the end so that it never stops with a click.
function finish(out) {
  const n = out.length; let peak = 1e-9;
  for (let i = 0; i < n; i++) { if (i > n - 64) out[i] *= (n - i) / 64; peak = Math.max(peak, Math.abs(out[i])); }
  for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
  return out;
}
// A soft burst of noise shaped like a contact: a quick rise and a decay of `tau` seconds, starting at sample `at`.
function burst(buf, r, sr, at, amp, tau) {
  const len = Math.min(buf.length - at, Math.floor(sr * tau * 6));
  for (let k = 0; k < len; k++) { const t = k / sr; buf[at + k] += (r() * 2 - 1) * amp * (1 - Math.exp(-t / 0.0015)) * Math.exp(-t / tau); }
}
// A bubble closing in water: a short tone that rises as it shrinks, the way rain on a pond rings.
function bubble(buf, sr, at, f0, amp, dur) {
  const len = Math.min(buf.length - at, Math.floor(sr * dur)); let ph = 0;
  for (let k = 0; k < len; k++) { const u = k / len; ph += (2 * Math.PI * f0 * (1 + 0.45 * u)) / sr; buf[at + k] += Math.sin(ph) * amp * Math.sin(Math.PI * Math.min(1, u * 6)) * (1 - u) ** 2; }
}

// Snow: a shower of grains whose rate follows the push of the foot, filtered to the dry upper middle where crunching
// lives, over a soft low press of the snow packing down.
export function crunch(sampleRate, { seed = 1, speed = 2.1 } = {}) {
  const r = rng(seed), hurry = hurryOf(speed);
  const dur = 0.24 / (0.65 + 0.35 * hurry), tail = 0.05, n = Math.ceil(sampleRate * (dur + tail));
  const grains = new Float32Array(n), body = new Float32Array(n);
  // In each sample one grain may break, the likelier the harder the foot presses; how loud is drawn from a long tail,
  // so most are faint and a few crack.
  const rate = 2600 * (0.8 + 0.2 * hurry) / sampleRate;
  for (let i = 0; i < n; i++) {
    const u = i / (sampleRate * dur), p = press(u);
    body[i] = (r() * 2 - 1) * p;
    if (r() > rate * p) continue;
    const amp = Math.min(1, 0.12 * Math.pow(r() + 1e-3, -0.55)) * (0.5 + 0.5 * p), len = Math.floor(sampleRate * (0.0004 + 0.0022 * r()));
    for (let k = 0; k < len && i + k < n; k++) grains[i + k] += (r() * 2 - 1) * amp * Math.exp((-4 * k) / len);
  }
  const hi = biquad(Float32Array.from(grains), sampleRate, "band", 3400 + 600 * r(), 0.9);
  const mid = biquad(grains, sampleRate, "band", 1150 + 250 * r(), 0.8);
  biquad(biquad(body, sampleRate, "low", 220, 0.7), sampleRate, "low", 220, 0.7);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.65 * hi[i] + 0.45 * mid[i] + 0.55 * body[i];
  return finish(out);
}

// Stone, and stone after rain (`wet` 0..1): the heel's soft pat, the ball's brush and the weight behind them; wet, a
// sticky lift of the sole off the water and a bubble or two where it was standing.
export function pat(sampleRate, { seed = 1, speed = 2.1, wet = 0 } = {}) {
  const r = rng(seed), hurry = hurryOf(speed), sr = sampleRate;
  const dur = 0.22 / (0.65 + 0.35 * hurry), n = Math.ceil(sr * (dur + 0.08));
  const heel = new Float32Array(n), brush = new Float32Array(n), weight = new Float32Array(n), film = new Float32Array(n);
  const tHeel = Math.floor(sr * dur * (0.1 + 0.03 * r())), tBall = Math.floor(sr * dur * (0.42 + 0.06 * r()));
  burst(heel, r, sr, tHeel, 1, 0.006 + 0.003 * r());
  burst(brush, r, sr, tBall, 0.55 + 0.15 * r(), 0.018 + 0.01 * r());
  for (let i = 0; i < n; i++) weight[i] = (r() * 2 - 1) * press(i / (sr * dur));
  biquad(heel, sr, "low", 1700 + 400 * r(), 0.7);
  biquad(brush, sr, "band", 1300 + 500 * r(), 0.6);
  biquad(biquad(weight, sr, "low", 180, 0.7), sr, "low", 180, 0.7);
  if (wet > 0) {
    // The sole comes away from the wet stone a moment after each contact: a hiss of water, high and quick.
    for (const [t0, a] of [[tHeel + Math.floor(sr * 0.012), 0.3], [tBall + Math.floor(sr * 0.03), 0.45]]) burst(film, r, sr, Math.min(n - 1, t0), a * wet, 0.008 + 0.006 * r());
    biquad(biquad(film, sr, "high", 2200, 0.7), sr, "low", 6000, 0.7);
    for (let k = 0; k < Math.round(1 + 2 * wet * r()); k++) bubble(film, sr, Math.min(n - 1, tBall + Math.floor(sr * (0.01 + 0.06 * r()))), 1400 + 1600 * r(), 0.2 * wet, 0.012 + 0.012 * r());
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = heel[i] + 0.8 * brush[i] + 0.6 * weight[i] + film[i];
  return finish(out);
}

// Standing water: the shoe goes in with a splash of spray over the heel and ball, and a scatter of bubbles ringing as
// they close, the same rising drops the eaves let fall (audio.js).
export function splash(sampleRate, { seed = 1, speed = 2.1 } = {}) {
  const r = rng(seed), hurry = hurryOf(speed), sr = sampleRate;
  const dur = 0.24 / (0.65 + 0.35 * hurry), n = Math.ceil(sr * (dur + 0.12));
  const spray = new Float32Array(n), drops = new Float32Array(n), weight = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = press(i / (sr * dur)); spray[i] = (r() * 2 - 1) * p * p; weight[i] = (r() * 2 - 1) * p; }
  biquad(biquad(spray, sr, "band", 2600 + 900 * r(), 0.6), sr, "high", 900, 0.7);
  biquad(weight, sr, "low", 260, 0.7);
  const count = 8 + Math.floor(8 * r() * hurry);
  for (let k = 0; k < count; k++) bubble(drops, sr, Math.floor(sr * dur * (0.1 + 0.8 * r() ** 1.4)), 900 + 2600 * r(), 0.2 + 0.5 * r(), 0.012 + 0.03 * r());
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.8 * spray[i] + drops[i] + 0.6 * weight[i];
  return finish(out);
}

// One step of a kind: "snow", "stone", "wet" or "puddle".
export function stepSound(kind, sampleRate, { seed = 1, speed = 2.1, wet = 1 } = {}) {
  if (kind === "snow") return crunch(sampleRate, { seed, speed });
  if (kind === "puddle") return splash(sampleRate, { seed, speed });
  return pat(sampleRate, { seed, speed, wet: kind === "wet" ? wet : 0 });
}
// How loud each kind is played, so that they sit together: a step on dry stone is the quietest thing in the temple
// (about half a step in snow), wet stone a little more, a splash nearly as much as snow. Set against each kind's own
// loudness over its loudest 60 ms; `steps.test.mjs` holds the order.
export const LEVEL = { stone: 0.08, wet: 0.085, puddle: 0.12, snow: 0.26 };

// Where water stands on the paving after rain: the same pattern the paving shader draws (`low` and `puddle` in
// ground.js), worked out here so that a splash is heard where a puddle is seen. 0..1.
function h21(x, y) {
  const f = Math.fround, fr = (v) => f(v - Math.floor(v));
  let px = fr(f(x * 234.34)), py = fr(f(y * 435.345));
  const d = f(px * f(px + 34.23) + py * f(py + 34.23)); px = f(px + d); py = f(py + d);
  return fr(f(px * py));
}
function n2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a + (d - c - (b - a)) * fx) * fy;
}
function fbm2(x, y) {
  let a = 0.5, s = 0;
  for (let i = 0; i < 5; i++) { s += a * n2(x, y); const nx = 1.62 * x - 1.22 * y + 17, ny = 1.22 * x + 1.62 * y + 17; x = nx; y = ny; a *= 0.5; }
  return s;
}
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function puddleAt(x, z, wet) {
  return smooth(0.57, 0.61, fbm2(x * 0.17 + 3, z * 0.17 + 3) + (wet - 1) * 0.34);
}

// What a shoe coming down at (x, z) sounds like: "snow", "stone", "wet" or "puddle". `floor` is the walker's
// (`floorAt`): a hall's floor is dry stone; snow lies everywhere outdoors except on the court's swept axis path and its
// kerbs (the paving shader keeps that path clear: `path` and `kerb` in ground.js); a roofed platform stays dry in rain;
// the open stone of the courts, the approach and the terraces is as wet as the mood says, and the courts hold puddles.
export function underfoot({ x, z, y, floor, snow = 0, wet = 0 }) {
  if (floor === "room") return "stone";
  const swept = floor === "paving" && Math.abs(y) < 0.05 && z > -0.95 && z < 53.9 && Math.abs(x) < 2.02;
  if (snow > 0.01) return swept ? "stone" : "snow";
  if (floor === "stone" || floor === "wood") return "stone";
  if (floor === "paving" && puddleAt(x, z, wet) > 0.5) return "puddle";
  return wet > 0.4 ? "wet" : "stone";   // spring and summer rain; autumn's stone has dried
}
