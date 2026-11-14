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
