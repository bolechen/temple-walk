// The eye from behind him does not back into the bamboo (#515, a tester on the canary at the ink-stone pool: the eye
// behind and above him in the grove, a sheet of leaves across him and the pool, shaking). Since #295 the eye asks what is
// drawn, and the bamboo is not in what it gathers (eyegather.js's parts; its sprays are cut out of cards, which the
// gathering passes over as it does mist): the written plan had the grove as a solid the eye kept out of, and asking the
// drawn meshes nothing kept it out. The grove is a place the eye does not go, as a wall is.
import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import "./dom-stub.mjs";
import * as THREE from "three";
const { levelPlan, need, isPrologue } = await import("./level-plan.mjs");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { followEye, createFollow, FRAMES, frameArm } = await import("../../app/src/eye.js");
const { createEyeSpace, eyeRadius } = await import("../../app/src/eyespace.js");
const { buildDrawn } = await import("../../tools/walk/scene.mjs");
const { gather } = await import("../../tools/walk/bake.mjs");
const { GROVE } = await import("../../app/src/site.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const { L, site, walker: written } = await levelPlan(M, { real: true }), springs = need("springArm");
const grids = gridsByPlace(decode(ensure(prepare(L)).bytes, (b) => inflateRawSync(b)));
const walker = createGridWalker(written, grids, { doors: site.halls });
const dt = 1 / 60, FOV = 50, drawn = gather([buildDrawn(L).scene], springs.gather).bvh;

/** The eye come to rest behind him at (x, z) looking `yaw`, `pitch`, on a screen of `aspect`, as the page has it. */
function rest(x, z, yaw, pitch, aspect) {
  const space = createEyeSpace(drawn, L.eyeKeepOut); space.radius = eyeRadius(FOV, aspect, 0.1);
  const arm = frameArm(FRAMES.b, FOV, aspect), follow = createFollow(), foot = walker.heightAt(x, z), eyeY = walker.eyeAt(x, z);
  let c = null;
  for (let n = 0; n < 240; n++) c = follow.step(dt, followEye(walker, { x, z, foot, eyeY, yaw, pitch, side: 1, reach: 6.2, arm, space }));
  return c;
}

test("by the ink-stone pool, looking into the grove, the eye stays out of it (#515)", { skip: !isPrologue && "the grove is the prologue's" }, () => {
  const bad = [];
  for (const [name, aspect] of [["16:9", 16 / 9], ["9:19.5", 9 / 19.5]]) {
    const c = rest(23.636, 75.6, 2.422, 0.084, aspect);
    if (GROVE.grows(c[0], c[2])) bad.push(`${name}: the eye stands in the grove at (${c.map((v) => v.toFixed(2)).join(", ")}), ${Math.hypot(c[0] - 23.636, c[2] - 75.6).toFixed(2)} m from him`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

// Along the old path, each route walked there and back at his pace, the view turning after him as spring-arm.test turns
// it: in no frame may the eye stand in the grove, and in no more than 2% of them within 0.3 m of its edge. The routes are
// the level's own (app/levels/t00/checks.js, `grove`).
const near = (x, z, m) => [[m, 0], [-m, 0], [0, m], [0, -m]].some(([dx, dz]) => GROVE.grows(x + dx, z + dz));
function walk(path, aspect) {
  const space = createEyeSpace(drawn, L.eyeKeepOut); space.radius = eyeRadius(FOV, aspect, 0.1);
  const arm = frameArm(FRAMES.b, FOV, aspect), follow = createFollow(), out = [];
  let x = path[0][0], z = path[0][1], yaw = Math.atan2(path[1][0] - x, -(path[1][1] - z)), eyeY = walker.eyeAt(x, z);
  for (const [tx, tz] of path.slice(1)) {
    for (let n = 0; n < 20000; n++) {
      const vx = tx - x, vz = tz - z, l = Math.hypot(vx, vz); if (l < 0.02) break;
      const step = Math.min(l, (walker.onStairs(x, z) ? 1.25 : 2.1) * dt); x += (vx / l) * step; z += (vz / l) * step;
      assert.ok(!walker.blocked(x, z), `the route passes through (${x.toFixed(2)}, ${z.toFixed(2)}), where he cannot walk`);
      const want = Math.atan2(vx, -vz); yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-3 * dt));
      const foot = walker.heightAt(x, z); eyeY += (walker.eyeAt(x, z) - eyeY) * (1 - Math.exp(-dt / 0.14));
      const c = follow.step(dt, followEye(walker, { x, z, foot, eyeY, yaw, pitch: 0.04, side: 1, reach: 6.2, arm, space }));
      out.push({ at: [x, z], c, in: GROVE.grows(c[0], c[2]), edge: near(c[0], c[2], 0.3) });
    }
  }
  return out;
}
const groveRoutes = isPrologue ? need("grove").routes(site, walker) : {};
for (const [name, path] of Object.entries(groveRoutes)) {
  test(`${name}, there and back: the eye keeps out of the grove (#515)`, () => {
    for (const [screen, aspect] of [["16:9", 16 / 9], ["9:19.5", 9 / 19.5]]) for (const way of [path, [...path].reverse()]) {
      const f = walk(way, aspect), inside = f.filter((r) => r.in), edge = f.filter((r) => r.edge).length / f.length;
      assert.equal(inside.length, 0, `${screen}: in ${inside.length} of ${f.length} frames the eye stood in the grove, first with him at (${inside[0]?.at.map((v) => v.toFixed(2))}) and it at (${inside[0]?.c.map((v) => v.toFixed(2))})`);
      assert.ok(edge <= 0.02, `${screen}: in ${(edge * 100).toFixed(1)}% of the frames the eye was within 0.3 m of the grove`);
    }
  });
}
