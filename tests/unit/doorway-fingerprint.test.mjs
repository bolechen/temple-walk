// #760: a hall's baked pictures are named by a fingerprint that must hold the light of the moods they are drawn in
// (BAKE.moods) and of no other: a changed summer day redraws them, a changed autumn dusk does not.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { fingerprints, BAKE } = await import("../../tools/bake-doorways.mjs");
const { moodOf } = await import("../../app/src/mood.js");

/** The real mood table with one number of one season and hour moved. */
const nudged = (season, time) => (s, t, tune) => {
  const m = moodOf(s, t, tune);
  return s === season && t === time ? { ...m, exp: m.exp + 0.01 } : m;
};

test("the baked moods are the ones the fingerprint is made over", () => {
  assert.ok(BAKE.moods.some(([s, t]) => s === "summer" && t === "day"));
  assert.ok(!BAKE.moods.some(([s, t]) => s === "autumn" && t === "dusk"));
});

test("changing a number of summer by day changes every hall's fingerprint", () => {
  const was = fingerprints(undefined, moodOf), now = fingerprints(undefined, nudged("summer", "day"));
  for (const id of Object.keys(was)) assert.notEqual(now[id], was[id], `${id} would be taken from the cache with the old light`);
});

test("changing a number of autumn at dusk changes none", () => {
  assert.deepEqual(fingerprints(undefined, nudged("autumn", "dusk")), fingerprints(undefined, moodOf));
});
