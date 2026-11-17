import test from "node:test"; import assert from "node:assert/strict";
import { moodOf, moodNow, SEASONS, TIMES, NAMES } from "../../app/src/mood.js";

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
