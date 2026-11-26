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

// #749: `__cost` drew the mirror wherever the tier had one, on T05's dry stone and in its hall (3 m up, out of `mirrorAt`), where the frame
// never draws it, so a T4's milliseconds for those views counted a pass a visitor does not get. Every redraw of the frame asks the frame's own
// question; only the photograph (capture) draws its mirror on purpose, at the print's size.
test("every redraw of the frame draws the mirror exactly when the frame does (#749)", async () => {
  const yard = (await import("node:fs")).readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
  assert.match(yard, /const mirrorDrawn = \(\) => quality\.planar > 0 && mirrorOn && !inside;/);
  const lines = yard.split("\n").filter((l) => l.includes("ground.render(renderer, camera)"));
  const unguarded = lines.filter((l) => !/if \(mirrorDrawn\(\)\) ground\.render\(renderer, camera\)/.test(l) && !/drift\.update\(t, camera\.position, H\); ground\.render/.test(l));
  assert.deepEqual(unguarded, [], "a redraw that ignores whether the frame draws the mirror");
  assert.ok(lines.length >= 5, "the frame, the frozen still, __cost, __probe and __censer");
  assert.match(yard, /window\.__cost = [\s\S]{0,300}if \(mirrorDrawn\(\)\) ground\.render/, "__cost times the frame as drawn");
});
