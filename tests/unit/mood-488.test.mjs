// The prologue's autumn dusk keeps part of the first court in the low sun (#488). Everything else the hours say stays as
// it was: the table `moodOf` gives for every season and hour on main before this change is kept in
// fixtures/mood-main-488.json, and a level that gives no `moodFor` (T05, or the engine's own probe level) gets it back
// exactly. The prologue replaces the sun's direction for autumn dusk and nothing else.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { readFileSync } from "node:fs";
const { moodOf, SEASONS, TIMES } = await import("../../app/src/mood.js");
const t00 = (await import("../../app/levels/t00/level.js")).default, t05 = (await import("../../app/levels/t05/level.js")).default;
const before = JSON.parse(readFileSync(new URL("./fixtures/mood-main-488.json", import.meta.url), "utf8"));
const plain = (m) => JSON.parse(JSON.stringify(m));   // the fixture went through JSON

test("a level that says nothing gets the table main had, for all sixteen seasons and hours", () => {
  for (const s of SEASONS) for (const t of TIMES) { assert.deepEqual(plain(moodOf(s, t)), before[`${s}-${t}`], `${s} ${t}`); assert.deepEqual(plain(moodOf(s, t, undefined)), before[`${s}-${t}`]); }
});
test("T05 has no say: its autumn dusk, and every other mood, is main's, to the last number", () => {
  assert.equal(t05.moodFor, undefined, "T05 must not change the hours");
  for (const s of SEASONS) for (const t of TIMES) assert.deepEqual(plain(moodOf(s, t, t05.moodFor)), before[`${s}-${t}`], `${s} ${t}`);
});
test("the prologue changes autumn dusk's sun and nothing else, and no other season or hour at all", () => {
  assert.equal(typeof t00.moodFor, "function");
  for (const s of SEASONS) for (const t of TIMES) {
    const now = plain(moodOf(s, t, t00.moodFor)), was = before[`${s}-${t}`];
    if (s === "autumn" && t === "dusk") {
      const changed = Object.keys(now).filter((k) => JSON.stringify(now[k]) !== JSON.stringify(was[k]));
      assert.deepEqual(changed, ["sun"], "only the sun's direction differs");
    } else assert.deepEqual(now, was, `${s} ${t} must not move (J01 is summer by day; the other dusks are prototype 05's and the rest)`);
  }
});
test("the new autumn sun stands low in the north-west of the plan: shadows come toward the camera, the evening stays against the light", () => {
  const [x, y, z] = moodOf("autumn", "dusk", t00.moodFor).sun, len = Math.hypot(x, y, z), elev = (Math.asin(y / len) * 180) / Math.PI;
  const az = (Math.atan2(-x, -z) * 180) / Math.PI;   // degrees west of north, in the plan's own frame (north is -z)
  assert.ok(elev >= 8 && elev <= 20, `elevation ${elev.toFixed(1)}° is low, not noon`);
  assert.ok(az > 0 && az <= 45, `${az.toFixed(1)}° west of north: the novice's shadow falls within 45° of the camera's way (the art director's rule, #488)`);
  assert.ok(z < 0 && x < 0, "in front of the walker, to the west of the axis");
});
