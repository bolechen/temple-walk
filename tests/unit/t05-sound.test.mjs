// T05's sound field, first version (docs/t05/SOUND.md §1, PRD.md §8): two layers, the court (Z1) and the great hall (Z3),
// and the reverb that follows them. There is no melody. The great hall is not a room under the court, a shell on its
// platform, so which layer he stands in is asked of where he stands (score.js `layerOf`), from the bounds the level gives.
// The prologue's own zones, reverbs and air must stay as they were: its zoneOf is checked against a copy of the function
// as it stood, point for point.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const SC = await import("../../app/src/score.js"), { zoneOf, layerOf, zoneBounds } = SC;
const { reverb } = await import("../../app/src/instruments.js");
const AU = await import("../../app/src/audio.js"), { HALL_VERB, COURT_VERB, TIMBER_VERB, AIR, BED, bedGain } = AU;
const T05 = (await import("../../app/levels/t05/level.js")).default, T00 = (await import("../../app/levels/t00/level.js")).default;
const { STATION } = await import("../../app/levels/t05/site.js");

test("T05 gives its own layers: a court and the great hall's box, and no music zones", () => {
  assert.ok(T05.zones && T05.zones.layers && T05.zones.layers.hall, "T05 names the great hall's box");
  const h = T05.zones.layers.hall; assert.ok(h.x0 < h.x1 && h.z0 < h.z1);
  for (const z of [-30, -10, 0, 20, 100, 215]) assert.equal(zoneOf(0, z, false, T05.zones), "none", "no melody at z " + z);
});
test("Z1 in the court and on the way, Z3 under the great hall's roof", () => {
  const at = ([x, z]) => layerOf(x, z, false, T05.zones);
  assert.equal(at(STATION.A), "yard"); assert.equal(at([0, 215]), "yard"); assert.equal(at(STATION.C), "yard", "the doorstep is still out of doors");
  for (const k of ["E", "F", "B"]) { const want = k === "B" ? "yard" : "hall"; assert.equal(at(STATION[k]), want, k); }
  assert.equal(at([20, -12]), "hall"); assert.equal(at([0, -40]), "yard", "behind the hall is out of doors");
});
test("the hall's box lies inside its walls: every wall's thickness from the platform's edge", () => {
  const h = T05.zones.layers.hall;
  assert.ok(h.x1 <= 27.9 - 1 && h.z0 >= -26.21 + 0.5 - 0.2 && h.z1 <= 0, JSON.stringify(h));
});
// The reverb's own impulse, as the page generates it (a stub context holds the buffer), and how long it takes to fall: to -60 dB of the
// backward-integrated energy (Schroeder) and the T20 extrapolation (-5 to -25 dB, times three). The court's impulse falls in a curve,
// so the two differ for it; for the hall's they agree.
const SR = 44100, stub = { sampleRate: SR, createBuffer: (ch, len) => { const d = Array.from({ length: ch }, () => new Float32Array(len)); return { getChannelData: (i) => d[i] }; }, createConvolver: () => ({}) };
function decay(V) {
  const d = reverb(stub, V.seconds, V.power, V.dark).buffer.getChannelData(0); let tot = 0; for (const x of d) tot += x * x;
  let acc = tot, a = null, b = null, z = null;
  for (let i = 0; i < d.length; i++) { acc -= d[i] * d[i]; const db = 10 * Math.log10(Math.max(acc, 1e-30) / tot), t = i / SR; if (a === null && db <= -5) a = t; if (b === null && db <= -25) b = t; if (z === null && db <= -60) z = t; }
  return { t60: z, t20: 3 * (b - a) };
}
test("the hall's reverb is the longest of three: RT60 4 to 6 s on its own impulse (SOUND.md §1.1), the court's and the timber hall's shorter", () => {
  const h = decay(HALL_VERB), c = decay(COURT_VERB), w = decay(TIMBER_VERB);
  assert.ok(h.t60 >= 4 && h.t60 <= 6 && h.t20 >= 4 && h.t20 <= 6, "hall " + JSON.stringify(h));
  assert.ok(h.t60 > c.t60 + 1.5 && h.t20 > c.t20 + 0.5, `longer than the court's: ${JSON.stringify({ h, c })}`);
  assert.ok(h.t60 > w.t60 + 3 && h.t20 > w.t20 + 3, `longer than the timber hall's: ${JSON.stringify({ h, w })}`);
  assert.ok(HALL_VERB.dark > 0, "dark, as a hall is");
});
test("the prologue's reverbs and air are as they were", () => {
  assert.deepEqual([COURT_VERB.seconds, COURT_VERB.power, COURT_VERB.dark ?? 0], [3.2, 2.6, 0]);
  assert.deepEqual([TIMBER_VERB.seconds, TIMBER_VERB.power, TIMBER_VERB.dark], [2.0, 3.2, 0.9]);
  assert.deepEqual({ ...AIR, out: { ...AIR.out }, in: { ...AIR.in }, tc: { ...AIR.tc } }, { out: { gain: 1, cutoff: 20000 }, in: { gain: 0.16, cutoff: 650 }, q: Math.SQRT1_2, tc: { in: 0.3, out: 0.45 } });
});
// zoneOf as it stood before T05 had layers
function was(x, z, inside, B) {
  if (!B) return "none"; if (inside) return "hall";
  if (z > B.grove) return "grove"; if (z > B.stair) return "stair"; if (z > B.gate) return "gate"; if (z > B.court) return "court"; if (z > B.summit) return "upper"; return "summit";
}
test("the prologue: no layers, and zoneOf answers every point as before", async () => {
  assert.equal(T00.zones.layers, undefined);
  const B = T00.zones; for (const inside of [false, true]) for (let z = -400; z < 600; z += 3.7) for (const x of [-30, 0, 45]) {
    assert.equal(zoneOf(x, z, inside, B), was(x, z, inside, B)); assert.equal(layerOf(x, z, inside, B), null);
  }
  assert.equal(zoneOf(0, 0, false, null), "none"); assert.equal(layerOf(0, 0, false, null), null);
  assert.equal(layerOf(0, 0, true, T05.zones), "hall", "a room under the courts, if T05 ever has one, is the hall");
});

test("Z1's floor is light, slow, deterministic, 150-300 Hz, and a far-off floor once the hall's air stage is in front of it", () => {
  assert.ok(BED.cutoff >= 150 && BED.cutoff <= 300, "SOUND.md §3: 150-300 Hz");
  let lo = Infinity, hi = 0; for (let t = 0; t < 120; t += 0.25) { const g = bedGain(t); assert.equal(g, bedGain(t), "a function of the clock only"); lo = Math.min(lo, g); hi = Math.max(hi, g); }
  assert.ok(lo > 0 && hi <= 0.05 && hi / lo < 2, `swells slowly and lightly: ${lo}..${hi}`);
  assert.ok(20 * Math.log10(AIR.in.gain) <= -12, "in the hall it is at least 12 dB down, below 650 Hz untouched in colour");
  assert.ok(BED.cutoff < AIR.in.cutoff, "the hall's low-pass leaves it its colour and only takes its level");
});
