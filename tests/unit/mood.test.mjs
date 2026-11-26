import test from "node:test"; import assert from "node:assert/strict";
import { moodOf, moodNow, SEASONS, TIMES, NAMES } from "../../app/src/mood.js";
import { isIdentity } from "../../app/src/lut.js";

const colour = (c, hi = 1.01) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(v) && v >= 0 && v <= hi);

test("every season at every hour is a complete mood", () => {
  for (const s of SEASONS) for (const t of TIMES) {
    const m = moodOf(s, t), at = `${s}/${t}`;
    for (const k of ["sunCol", "hemiS", "hemiG", "fog", "zen", "hor", "leaf", "hills"]) assert.ok(colour(m[k], 1.2), `${at}.${k}`);
    for (const k of ["sh", "hi"]) assert.ok(colour(m[k], 1.3), `${at}.${k}`);
    for (const k of ["sunI", "hemiI", "fogD", "cloud", "stars", "glow", "exp", "lamp", "sat", "lift", "bloom", "mist", "wet", "snow"]) assert.ok(Number.isFinite(m[k]) && m[k] >= 0, `${at}.${k}`);
    assert.ok(m.sun[1] > 0.1, `${at}: the light is above the horizon`);
    assert.ok(m.cloud > 0 && m.cloud <= 1, `${at}.cloud`);
    assert.ok(m.fogD > 0.004 && m.fogD < 0.03, `${at}.fogD is breathable`);
    assert.ok(["none", "petal", "leaf", "snow", "firefly"].includes(m.drift), `${at}.drift`);
    assert.ok(typeof m.line === "string" && m.line.length >= 4, `${at}.line`);
    assert.equal(m.label, `${NAMES[s]} · ${NAMES[t]}`);
  }
});
test("the seasons differ where they should", () => {
  assert.equal(moodOf("winter", "day").snow, 1); assert.equal(moodOf("summer", "day").snow, 0);
  assert.equal(moodOf("winter", "day").drift, "snow"); assert.equal(moodOf("spring", "day").drift, "petal"); assert.equal(moodOf("autumn", "day").drift, "leaf");
  assert.equal(moodOf("summer", "day").drift, "none"); assert.equal(moodOf("summer", "night").drift, "firefly");
  assert.ok(moodOf("summer", "day").wet > moodOf("autumn", "day").wet);
});
test("the hours differ where they should", () => {
  const lum = (m) => m.hemiI * (m.hemiS[0] + m.hemiS[1] + m.hemiS[2]) + m.sunI;
  for (const s of SEASONS) {
    assert.ok(lum(moodOf(s, "day")) > lum(moodOf(s, "dusk")) && lum(moodOf(s, "dusk")) > lum(moodOf(s, "night")), `${s}: day > dusk > night`);
    assert.ok(moodOf(s, "night").lamp > moodOf(s, "dusk").lamp && moodOf(s, "day").lamp === 0, `${s}: lamps`);
    assert.ok(moodOf(s, "night").stars === 1 && moodOf(s, "day").stars === 0, `${s}: stars`);
    assert.ok(moodOf(s, "dawn").sun[0] > 0 && moodOf(s, "dusk").sun[0] < 0, `${s}: the sun rises in the east and sets in the west`);
  }
});
test("an unknown season or hour falls back instead of throwing", () => { const m = moodOf("monsoon", "noon"); assert.ok(m.sunI > 0); });
test("the present moment is a real season and hour", () => { const n = moodNow(); assert.ok(SEASONS.includes(n.season) && TIMES.includes(n.time)); });

// The film's finish (docs/t00/art-goal.md, first stage): every season at every hour has its colour table, halation,
// occlusion strength, lamplight colour and layered mist, all in range.
test("every season at every hour has the film's finish", () => {
  const triple = (v, lo, hi) => Array.isArray(v) && v.length === 3 && v.every((x) => Number.isFinite(x) && x >= lo && x <= hi);
  for (const s of SEASONS) for (const t of TIMES) {
    const m = moodOf(s, t), at = `${s}/${t}`, L = m.lut;
    assert.ok(L && triple(L.lift, -0.05, 0.05) && triple(L.gamma, 0.8, 1.25) && triple(L.gain, 0.8, 1.25) && triple(L.shadow, -0.05, 0.05) && triple(L.light, -0.05, 0.05), `${at}.lut`);
    assert.ok(Number.isFinite(L.sat) && L.sat > 0.7 && L.sat < 1.4, `${at}.lut.sat`);
    assert.ok(m.hal >= 0 && m.hal <= 1, `${at}.hal`); assert.ok(m.ao >= 0 && m.ao <= 1, `${at}.ao`); assert.ok(m.haze > 0.3 && m.haze <= 1.2, `${at}.haze`);
    assert.ok(colour(m.win), `${at}.win`);
    const F = m.fogLayer; assert.ok(Array.isArray(F) && F.length === 4 && F[0] >= 0 && F[0] <= 1 && F[2] > 2 && F[3] >= 1 && F[3] <= 4, `${at}.fogLayer`);
  }
});
test("summer by day, the picture the place is judged by (J01), is left as it was by the finish", () => {
  const m = moodOf("summer", "day");
  assert.ok(isIdentity(m.lut), "no colour table"); assert.equal(m.hal, 0, "no halation"); assert.equal(m.fogLayer[0], 0, "plain air"); assert.equal(m.haze, 1, "the far hills as before");
});
test("at dusk the lamps burn brighter under cloud than on a clear evening, and never brighter than at night", () => {
  for (const s of SEASONS) assert.ok(moodOf(s, "dusk").lamp <= moodOf(s, "night").lamp, s);
  assert.ok(moodOf("summer", "dusk").lamp > moodOf("autumn", "dusk").lamp, "a cloudy summer dusk is lit before a clear autumn one");
});
// #135: the hour follows the clock unless the visitor chose one for this visit.
test("moodNow takes a clock, and the hour changes across each boundary", async () => {
  const { moodNow } = await import("../../app/src/mood.js");
  const at = (h, m = 0) => moodNow(new Date(2026, 10, 17, h, m)).time;
  assert.equal(at(4, 59), "night"); assert.equal(at(5, 0), "dawn");
  assert.equal(at(7, 59), "dawn"); assert.equal(at(8, 0), "day");
  assert.equal(at(16, 29), "day"); assert.equal(at(16, 30), "dusk");
  assert.equal(at(18, 59), "dusk"); assert.equal(at(19, 0), "night");
});
test("a visit that follows the clock moves on at the boundary; a chosen hour stays", async () => {
  const { hourFollow } = await import("../../app/src/mood.js");
  const before = new Date(2026, 10, 17, 7, 59), after = new Date(2026, 10, 17, 8, 1);
  assert.equal(hourFollow({ follow: true, time: "dawn" }, before), null, "no change before the boundary");
  assert.equal(hourFollow({ follow: true, time: "dawn" }, after), "day", "crossing 8:00 turns dawn into day");
  assert.equal(hourFollow({ follow: false, time: "dawn" }, after), null, "a hour chosen by hand is not taken back");
});
test("the hour chosen by hand is kept only in memory", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["app/yard.js", "app/src/mood.js"]) assert.ok(!/localStorage[^\n]*(follow|hour)/i.test(readFileSync(f, "utf8")), f + " must not store the hour");
});

test("the hour turns to the visitor's own once the book is shut after the close, unless an address or a hand chose one (#726)", async () => {
  const { takeClock } = await import("../../app/src/mood.js");
  const night = new Date(2026, 6, 15, 22, 30), q = (s) => new URLSearchParams(s);
  const s = { hand: false, follow: false, time: "day" };
  assert.equal(takeClock(s, q(""), night), "night"); assert.equal(s.follow, true, "the hour follows the clock from then on");
  const a = { hand: false, follow: false, time: "day" };
  for (const k of ["time=day", "shot=1", "show=gate", "cam=0,30,0,0"]) { a.follow = false; assert.equal(takeClock(a, q(k), night), null, k); assert.equal(a.follow, false, k); }
  const h = { hand: true, follow: false, time: "dusk" }; assert.equal(takeClock(h, q(""), night), null, "a hand's choice stays"); assert.equal(h.follow, false);
});
