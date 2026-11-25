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
  for (const s of SEASONS) for (const t of TIMES) { if (s === "summer" && t === "day") continue;   // J01 is lifted on purpose (#524, mood-b1.test.mjs)
    assert.deepEqual(plain(moodOf(s, t)), before[`${s}-${t}`], `${s} ${t}`); assert.deepEqual(plain(moodOf(s, t, undefined)), before[`${s}-${t}`]); }
});
test("T05 says only its winter day (J01): every other season and hour is main's, to the last number", () => {
  assert.equal(typeof t05.moodFor, "function");
  for (const s of SEASONS) for (const t of TIMES) {
    const now = plain(moodOf(s, t, t05.moodFor));
    if (s === "winter" && t === "day") {
      assert.equal(now.snow, 0, "J01 has no snow"); assert.equal(now.wet, 0); assert.equal(now.drift, "none", "nothing falls in the air");
      const [x, y, z] = now.sun, len = Math.hypot(x, y, z);
      assert.ok(y / len >= 0.25 && y / len <= 0.35, `the sun's y ${(y / len).toFixed(3)} stands low, 0.25 to 0.35`);
      assert.ok(z > 0 && x > 0, "from the south-south-east, toward the walker coming north");
      assert.ok(now.cloud <= 0.2, "clear");
    } else if (s === "summer" && t === "day") continue; else assert.deepEqual(now, before[`${s}-${t}`], `${s} ${t}`);
  }
});
test("the prologue changes autumn dusk's sun (direction, strength) and the glow round it, and nothing else, and no other season or hour at all", () => {
  assert.equal(typeof t00.moodFor, "function");
  for (const s of SEASONS) for (const t of TIMES) {
    const now = plain(moodOf(s, t, t00.moodFor)), was = before[`${s}-${t}`];
    if (s === "autumn" && t === "dusk") {
      const changed = Object.keys(now).filter((k) => JSON.stringify(now[k]) !== JSON.stringify(was[k]));
      assert.deepEqual(changed.sort(), ["bloom", "disk", "glow", "sun", "sunI"], "only the sun and the sky's own glow differ");
      assert.ok(Math.abs(now.sunI / was.sunI - 0.8) < 1e-9, "a fifth dimmer, so that no sunlit wall is brighter than the sky (#564), to part sun and shade by 1.4 to 2");
    } else if (s === "summer" && t === "day") continue; else assert.deepEqual(now, was, `${s} ${t} must not move (J01 is summer by day; the other dusks are prototype 05's and the rest)`);
  }
});
test("the new autumn sun stands low in the north-west of the plan: shadows come toward the camera, the evening stays against the light", () => {
  const [x, y, z] = moodOf("autumn", "dusk", t00.moodFor).sun, len = Math.hypot(x, y, z), elev = (Math.asin(y / len) * 180) / Math.PI;
  const az = (Math.atan2(-x, -z) * 180) / Math.PI;   // degrees west of north, in the plan's own frame (north is -z)
  assert.ok(elev >= 8 && elev <= 20, `elevation ${elev.toFixed(1)}° is low, not noon`);
  assert.ok(az > 0 && az <= 70, `${az.toFixed(1)}° west of north: low in the west, so the novice's shadow falls toward the camera and the lane (art review 2 widened the scan to 70°, #546)`);
  assert.ok(z < 0 && x < 0, "in front of the walker, to the west of the axis");
});

test("the prologue's autumn dusk keeps the faint shafts of light standing in the mist (#564)", async () => {
  const { SHAFT_SUN_Y } = await import("../../app/src/props.js");
  const sun = moodOf("autumn", "dusk", t00.moodFor).sun;
  assert.ok(sun[1] < SHAFT_SUN_Y, `the sun at y ${sun[1].toFixed(3)} must stand under ${SHAFT_SUN_Y}, or the shafts go out and the mist before the hall with them`);
});
