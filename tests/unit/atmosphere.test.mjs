// Trial B (#592, app/src/atmosphere.js): the sky, mist, sky-light and sun's colour from the sun's height. The trial is off by default; what is
// held here is what it must never do when it is on: leave J01 (summer by day) and the night as they are, and give each hour's
// colours a direction a sun would (a low sun is warm at the horizon and red-orange through the air, a high one is blue overhead).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { skyTable, sunHeight, atmosphereMood, SKY_TRIAL } = await import("../../app/src/atmosphere.js");
const { moodOf, SEASONS, TIMES } = await import("../../app/src/mood.js");

test("the trial is off unless the address asks for it", () => assert.equal(SKY_TRIAL.on, false));

test("the table is the size the dome reads, finite and positive, the same every time", () => {
  const a = skyTable(0.3), b = skyTable(0.3);
  assert.equal(a.data.length, a.W * a.H * 4);
  assert.ok(a.data.every((v) => Number.isFinite(v) && v >= 0));
  assert.deepEqual(Array.from(a.data.slice(0, 64)), Array.from(b.data.slice(0, 64)));
});

test("a low sun is warm at the horizon and through the air, a high one blue overhead", () => {
  const low = skyTable(0.18), high = skyTable(0.8);
  assert.ok(low.hor[0] > low.hor[2], "the low sun's horizon is redder than blue");
  assert.ok(low.sun[0] > low.sun[2] * 2, "the low sun is red through the air");
  assert.ok(high.zen[2] > high.zen[0] * 2, "the overhead sky is blue");
  assert.ok(low.sun[2] < high.sun[2], "the low sun loses more blue than the high");
});

test("J01 and every night are not touched; the other hours change only the fields named", () => {
  for (const s of SEASONS) for (const t of TIMES) {
    const m = moodOf(s, t), x = atmosphereMood(m);
    if (t === "night") { assert.equal(x, null, `${s} ${t}`); continue; }
    if (s === "summer" && t === "day") for (const k of ["zen", "hor", "fog", "hemiS", "sunCol"]) assert.deepEqual(x[k], m[k], `J01 keeps ${k}`);
    for (const k of Object.keys(x)) assert.ok(["zen", "hor", "fog", "hemiS", "sunCol", "sky"].includes(k), `${s} ${t}: ${k}`);
    for (const k of ["zen", "hor", "fog", "hemiS", "sunCol"]) assert.ok(x[k].every((v) => Number.isFinite(v) && v >= 0), `${s} ${t} ${k}`);
    assert.ok(Number.isFinite(x.sky.k) && x.sky.k > 0 && x.sky.over >= 0 && x.sky.over <= 1);
  }
});

test("the table's own lightness is kept: each field's lightness is what the hour table wrote", () => {
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  for (const [s, t] of [["spring", "day"], ["autumn", "dusk"], ["spring", "dawn"]]) {
    const m = moodOf(s, t), x = atmosphereMood(m);
    for (const k of ["zen", "hor"]) assert.ok(Math.abs(lum(x[k]) - lum(m[k])) < 1e-6, `${s} ${t} ${k}`);
  }
});

test("a sun's height from its direction", () => assert.ok(Math.abs(sunHeight([1, 1, 0]) - Math.PI / 4) < 1e-9));
