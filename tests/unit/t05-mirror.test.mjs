// The paving's mirror is a level's to refuse in a mood (app/src/level.js `mirror`): T05 draws it only where the stone is wet, since on J01's dry stone it
// shows nothing and its pass costs a millisecond and more on a T4 (#722); the prologue says nothing and is drawn as it always was.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { moodOf } = await import("../../app/src/mood.js");
const t05 = (await import("../../app/levels/t05/level.js")).default;
const t00 = (await import("../../app/levels/t00/level.js")).default;

test("T05 draws no mirror on J01's dry stone and one where the paving is wet; the prologue keeps its mirror everywhere it had it", async () => {
  assert.equal(typeof t05.mirror, "function");
  assert.equal(t05.mirror(moodOf("winter", "day", t05.moodFor)), false, "J01: dry");
  assert.equal(t05.mirror({ ...moodOf("winter", "day", t05.moodFor), wet: 0.6 }), true, "wet paving");
  assert.equal(t00.mirror, undefined, "the prologue says nothing");
  const yard = (await import("node:fs")).readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
  assert.match(yard, /mirrorOn = mirrorAt\(footY\) && \(!L\.mirror \|\| L\.mirror\(mood\)\)/, "the frame asks the level");
});
