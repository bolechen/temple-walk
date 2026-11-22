// The strip behind the start of the walk has no culm in it (#454): the eye stands six metres back there at the first picture after
// 入山, the title's picture and the opening's last frame, and a culm in that line stands a metre or two from the lens and splits the
// stair across the middle of the picture (the independent review's ART-11). Taking one out must move no other: the rest of the grove
// is the grove as it was.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { createBamboo } = await import("../../app/src/bamboo.js");
const { GROVE, APPROACH, START_SIGHT, terrain } = await import("../../app/src/site.js");
const level = (await import("../../app/levels/t00/level.js")).default;

/** The vertices of every mesh the grove put in a scene, as a set of rounded positions, and the lowest ones of the culms by themselves. */
function grown(opts) {
  const scene = new THREE.Scene(); createBamboo(scene, GROVE.areas, terrain, GROVE.keep, { fine: false, ...opts });
  const all = new Set(), feet = [];
  scene.children.forEach((o, k) => {   // (the culms are the first mesh, the sprays and the undergrowth the second)
    const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); all.add(`${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`); if (k === 0 && y < terrain(x, z) + 0.05) feet.push([x, z]); }
  });
  return { all, feet };
}
const inStrip = ([x, z]) => Math.abs(x - APPROACH.xC) < START_SIGHT.hw && z > APPROACH.zC1 && z < APPROACH.zC1 + START_SIGHT.back;

test("#454: the prologue's grove asks for the strip behind the start to be cleared of culms", () => {
  assert.equal(typeof level.grove.clearCulm, "function");
  assert.ok(level.grove.clearCulm(APPROACH.xC, APPROACH.zC1 + 3), "the middle of the strip is cleared");
  assert.ok(!level.grove.clearCulm(APPROACH.xC + START_SIGHT.hw + 0.3, APPROACH.zC1 + 3), "beside it the grove stands");
  assert.ok(!level.grove.clearCulm(APPROACH.xC, APPROACH.zC1 - 0.5) && !level.grove.clearCulm(APPROACH.xC, APPROACH.zC1 + START_SIGHT.back + 0.5), "before and beyond it the grove stands");
});

test("#454: grown as the page grows it, no culm stands in the strip; grown without, some did", () => {
  const without = grown({}), cleared = grown({ clearCulm: level.grove.clearCulm });
  assert.ok(without.feet.some(inStrip), "the grove as it was has a culm in the strip (else there is nothing to clear)");
  assert.equal(cleared.feet.filter(inStrip).length, 0, "no culm stands in the strip");
});

test("#454: clearing the strip moves no other culm or spray: every point that is left lay where it lay", () => {
  const without = grown({}), cleared = grown({ clearCulm: level.grove.clearCulm });
  let moved = 0; for (const p of cleared.all) if (!without.all.has(p)) moved++;
  assert.equal(moved, 0, `${moved} points of the cleared grove are not where the grove had them`);
  assert.ok(cleared.all.size < without.all.size, "something was taken out");
  assert.ok(cleared.all.size > without.all.size * 0.99, "and no more than the strip's few culms");
});
