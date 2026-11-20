// The mountain's sound in a hall (#331): the wind, drips, eave bells, culms and birds reach the listener through the air
// stage of audio.js (`AIR`). This renders the wind offline in Node, two layers through RBJ biquads as the Web Audio
// biquads are (the cookbook formulas), once out of doors and once in a hall, and holds the fall in decibels. The page's
// real nodes are measured by `node tools/mountain-sound.mjs` and the `mountain` scenario of the end-to-end tests.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const AIRMOD = await import("../../app/src/audio.js"), { AIR, windGains } = AIRMOD;
const SR = 44100, db = (v) => 20 * Math.log10(Math.max(v, 1e-12));
// Audio EQ cookbook, as Chromium's BiquadFilterNode computes them (Q in the linear sense for the band-pass, as the page sets 0.5).
function biquad(type, f0, q) {
  const w = 2 * Math.PI * f0 / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q); let b0, b1, b2;
  if (type === "lowpass") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === "highpass") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * c / a0, a2 = (1 - al) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const mag = (type, f0, q, f) => { const run = biquad(type, f0, q), n = 20000; let s = 0, c = 0; for (let i = 0; i < n; i++) { const y = run(Math.sin(2 * Math.PI * f * i / SR)); if (i > n / 2) { s += y * y; c++; } } return Math.sqrt(2 * s / c); };
// the page's brown noise (audio.js: leaky integral of white, x3.5), a fixed seed
function noise(n) { let s = 7, last = 0; const d = new Float32Array(n); for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; last = (last + 0.02 * (s / 4294967296 * 2 - 1)) / 1.02; d[i] = last * 3.5; } return d; }
function render(inside, g = 0.5, grove = 0.12, secs = 6) {
  const n = SR * secs, x = noise(n), band = biquad("bandpass", 420, 0.5), hp = biquad("highpass", 2600, 0.3), k = inside ? AIR.in : AIR.out, lp = biquad("lowpass", k.cutoff, AIR.q), w = windGains(g, grove, inside), y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = k.gain * lp(band(x[i]) * w.low + hp(x[i]) * w.leaves);
  return y;
}
// energy in total and above 2 kHz: a straight DFT would be slow, so a radix-2 FFT of Hann blocks
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), x = i + k + len / 2, tr = re[x] * c - im[x] * s, ti = re[x] * s + im[x] * c; re[x] = re[i + k] - tr; im[x] = im[i + k] - ti; re[i + k] += tr; im[i + k] += ti; } } }
function energy(d) { const N = 8192; let all = 0, hi = 0; for (let o = SR; o + N <= d.length; o += N) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = d[o + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im); for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k]; all += p; if (k * SR / N >= 2000) hi += p; } } return { all: 10 * Math.log10(all), hi: 10 * Math.log10(hi) }; }

test("a hall takes the wind down by at least 12 dB in all, and at least 20 dB above 2 kHz", () => {
  for (const g of [0.2, 0.5, 1]) for (const grove of [0.12, 0.55]) {
    const out = energy(render(false, g, grove)), inn = energy(render(true, g, grove));
    assert.ok(out.all - inn.all >= 12, `gust ${g}, grove ${grove}: only ${(out.all - inn.all).toFixed(1)} dB under out of doors`);
    assert.ok(out.hi - inn.hi >= 20, `gust ${g}, grove ${grove}: only ${(out.hi - inn.hi).toFixed(1)} dB under above 2 kHz`);
  }
});
test("the low-pass is where the owner's brief puts it: 500 to 900 Hz, and flat below", () => {
  assert.ok(AIR.in.cutoff >= 500 && AIR.in.cutoff <= 900, "cutoff " + AIR.in.cutoff);
  assert.ok(Math.abs(db(mag("lowpass", AIR.in.cutoff, AIR.q, 100))) < 0.5, "not flat at 100 Hz");
  assert.ok(db(mag("lowpass", AIR.in.cutoff, AIR.q, 2000)) < -15, "2 kHz not shaved");
});
test("out of doors the air is open: no gain change, nothing taken from the top", () => {
  assert.equal(AIR.out.gain, 1); assert.ok(AIR.out.cutoff >= 20000);
});
test("the leaf rustle is not made at all in a hall, and the rest of the wind is the same as out of doors", () => {
  for (const g of [0.2, 0.7, 1]) { const i = windGains(g, 0.12, true), o = windGains(g, 0.12, false); assert.equal(i.leaves, 0); assert.ok(o.leaves > 0); assert.equal(i.low, o.low); }
});
test("a change of room settles within 1 dB in 0.7 to 1.5 s, going in and coming out", () => {
  // setTargetAtTime: v(t) = target + (start - target) e^(-t/tc); in dB, the time until the gap is under 1 dB and stays there
  const settle = (from, to, tc) => { for (let t = 0; t < 10; t += 0.005) { const v = to + (from - to) * Math.exp(-t / tc); if (Math.abs(db(v) - db(to)) < 1) return t; } return Infinity; };
  const goIn = settle(AIR.out.gain, AIR.in.gain, AIR.tc.in), comeOut = settle(AIR.in.gain, AIR.out.gain, AIR.tc.out);
  for (const [name, s] of [["going in", goIn], ["coming out", comeOut]]) assert.ok(s >= 0.7 && s <= 1.5, `${name}: ${s.toFixed(2)} s`);
});

test("the courts and the stair sit WIND_CUT_DB under the old wind, the bamboo at the start as it was, the terraces between", () => {
  const { WIND_CUT_DB, windCut } = AIRMOD, old = (g, k) => ({ low: 0.5 * g * (0.41 + 0.15 * k), leaves: 0.16 * g * g * (0.21 + 0.353 * k) });
  assert.ok(WIND_CUT_DB >= 4);
  for (const g of [0.3, 0.8]) {
    const c = windGains(g, 0.12), o = old(g, 0.12), one = windGains(g, 1), oo = old(g, 1), mid = windGains(g, 0.55), om = old(g, 0.55);
    assert.ok(Math.abs(db(c.low / o.low) + WIND_CUT_DB) < 0.01 && Math.abs(db(c.leaves / o.leaves) + WIND_CUT_DB) < 0.01, "the court's wind is not cut by WIND_CUT_DB");
    assert.ok(Math.abs(one.low - oo.low) < 1e-12 && Math.abs(one.leaves - oo.leaves) < 1e-12, "the bamboo at the start was changed");
    assert.ok(db(mid.low / om.low) < -1 && db(mid.low / om.low) > -WIND_CUT_DB + 1, "the terraces are not between");
  }
  assert.ok(windCut(0) <= windCut(0.12) + 1e-12 && windCut(1.5) === 1, "outside the range of the bamboo's depth");
});
