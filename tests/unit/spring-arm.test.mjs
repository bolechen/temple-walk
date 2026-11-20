// The eye from behind him on the floor he walks (#295, the fifth step of #161's migration). Since #265 and #274 he walks
// on the floor baked from what is drawn, and walks where the written plan had solid stone (round the great hall's
// platform, behind the tea house); but the eye still asked the written plan what is in its way (`walker.eyeShut`), and
// there it was pulled into his head: from behind him he was seen from his own eyes (the owner, 2026-11-19: "镜头一直收成
// 第一人称，感觉被卡住了"). Here he walks those places at his pace, the view turning after him as the measured walk turns
// it, on the baked floor, and every frame the eye must stand back from him and hold him in the picture.
import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker } = await import("../../app/src/site.js?real");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { followEye, createFollow, FRAMES, frameArm, aimAt } = await import("../../app/src/eye.js");
const { createEyeSpace, eyeRadius } = await import("../../app/src/eyespace.js");
const { buildDrawn } = await import("../../tools/walk/scene.mjs");
const { gather } = await import("../../tools/walk/bake.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M);
const grids = gridsByPlace(decode(ensure(prepare()).bytes, (b) => inflateRawSync(b)));
const walker = createGridWalker(createWalker(site), grids, { doors: site.halls });
const dt = 1 / 60, FOV = 50, ASPECT = 16 / 9, frame = FRAMES.b, arm = frameArm(frame, FOV, ASPECT);
// what is drawn, gathered as the floor is baked from it, for the eye to ask (#295)
const space = createEyeSpace(gather([buildDrawn().scene], { x0: -60, x1: 60, z0: -140, z1: 100, bottom: -200, top: 200 }).bvh);
space.radius = eyeRadius(FOV, ASPECT, 0.1);

// How near the eye may come, from the point over his head it backs away from (`ty`, 1.3 m over the floor): a wall at his
// back brings it in, but not into him. Two metres is the eye far enough back to see all of him and the floor round his
// feet at the walk's 50°; it may come nearer for a moment (a corner turned, a column passed), never nearer than a metre.
const NEAR = 2.0, NEAREST = 1.0, OFTEN = 0.9;

/** Walk `path` as follow.test walks it, on the baked floor; for every frame, how far the eye stands from him and whether he is in the picture. */
function walk(path, { reach = 6.2, pitch = 0.04 } = {}) {
  const follow = createFollow(), out = [], cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 500);
  let x = path[0][0], z = path[0][1], yaw = Math.atan2(path[1][0] - x, -(path[1][1] - z)), eyeY = walker.eyeAt(x, z);
  for (const [tx, tz] of path.slice(1)) {
    for (let n = 0; n < 20000; n++) {
      const vx = tx - x, vz = tz - z, l = Math.hypot(vx, vz); if (l < 0.02) break;
      const step = Math.min(l, (walker.onStairs(x, z) ? 1.25 : 2.1) * dt); x += (vx / l) * step; z += (vz / l) * step;
      assert.ok(!walker.blocked(x, z), `the route passes through (${x.toFixed(2)}, ${z.toFixed(2)}), where he cannot walk`);
      const want = Math.atan2(vx, -vz); yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-3 * dt));
      const foot = walker.heightAt(x, z);
      eyeY += (walker.eyeAt(x, z) - eyeY) * (1 - Math.exp(-dt / 0.14));
      const eye = followEye(walker, { x, z, foot, eyeY, yaw, pitch, side: 1, reach, arm, space });
      const c = follow.step(dt, eye);
      // him in the picture: his feet and the top of his head, seen from the eye as the page aims it
      const aim = aimAt(c, [x, foot, z], yaw, frame, FOV);
      let seen = false;
      if (aim) {
        cam.position.set(...c); cam.rotation.set(aim[1], -aim[0], 0, "YXZ"); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        seen = [foot, foot + 1.22].every((y) => { const p = new THREE.Vector3(x, y, z).project(cam); return p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1; });
      }
      out.push({ x, z, back: Math.hypot(c[0] - x, c[1] - (eyeY + arm.h), c[2] - z), seen });
    }
  }
  return out;
}

const hall = site.buildings.find((b) => b.name === "大雄宝殿"), tea = site.buildings.find((b) => b.name === "茶寮"), [cx, , cz] = site.censer.toArray();
const routes = {
  // the walk round the great hall's platform, between its walls and its edge, both ways
  "round the great hall's platform": [[hall.x0 + 1.0, hall.z1 - 1.4], [hall.x1 - 1.0, hall.z1 - 1.4], [hall.x1 - 0.95, hall.z0 + 1.4], [hall.x0 + 0.95, hall.z0 + 1.4], [hall.x0 + 1.0, hall.z1 - 1.4]],
  "round the great hall's platform the other way": [[hall.x0 + 1.0, hall.z1 - 1.4], [hall.x0 + 0.95, hall.z0 + 1.4], [hall.x1 - 0.95, hall.z0 + 1.4], [hall.x1 - 1.0, hall.z1 - 1.4], [hall.x0 + 1.0, hall.z1 - 1.4]],
  // the walk along the back of the tea house, on its platform between its wall and the lane's
  "behind the tea house": [[tea.x0 + 0.3, tea.z0 + 0.8], [tea.x0 + 0.3, tea.z1 - 0.8]],
  "behind the tea house the other way": [[tea.x0 + 0.3, tea.z1 - 0.8], [tea.x0 + 0.3, tea.z0 + 0.8]],
  // through the gate's middle passage, in and out
  "in through the gate": [[0, 48], [0, 33]],
  "out through the gate": [[0, 33], [0, 48]],
  // up the first court's axis, close past the censer's east side, so that it stands behind him
  "past the censer, with it behind him": [[cx + 1.3, cz + 8], [cx + 1.3, cz - 0.5], [cx, cz - 3]],
};

for (const [name, path] of Object.entries(routes)) {
  test(`#295: from behind him the eye stands back and sees him: ${name}`, () => {
    const frames = walk(path), n = frames.length;
    const near = frames.filter((f) => f.back < NEAR).length, nearest = frames.reduce((a, f) => (f.back < a.back ? f : a), frames[0]), unseen = frames.filter((f) => !f.seen);
    if (process.env.ARM_REPORT) console.log(name, { frames: n, near: +(near / n).toFixed(3), nearest: +nearest.back.toFixed(2), at: [+nearest.x.toFixed(1), +nearest.z.toFixed(1)], unseen: unseen.length });
    assert.ok(nearest.back >= NEAREST, `the eye came to ${nearest.back.toFixed(2)} m from him at (${nearest.x.toFixed(1)}, ${nearest.z.toFixed(1)})`);
    assert.ok(near <= n * (1 - OFTEN), `the eye stood nearer than ${NEAR} m in ${near} of ${n} frames`);
    assert.ok(!unseen.length, `he was out of the picture in ${unseen.length} of ${n} frames, first at (${unseen[0]?.x.toFixed(1)}, ${unseen[0]?.z.toFixed(1)})`);
  });
}
