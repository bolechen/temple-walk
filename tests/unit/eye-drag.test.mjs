// Dragging the view up and down before the gate must never put the eye, or the corners of its near plane, under the floor
// (#622: a tester dragged the view down before the gate and the eye came to stand below the platform; the ground was cut
// by the near plane and he seemed to hang in the air). From the place the report names, the pitch is thrown from 0.45 to
// the lowest the page allows and back, twenty times, at three frame lengths (a slow machine's included), with the eye
// asking what is drawn and, as under `?off=eyebvh`, the written plan; every frame the eye stands clear of the floor under it.
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

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const { L, site, walker: written } = await levelPlan(M, { real: true }), springs = need("springArm");
const grids = gridsByPlace(decode(ensure(prepare(L)).bytes, (b) => inflateRawSync(b)));
const walker = createGridWalker(written, grids, { doors: site.halls });
const FOV = 50, ASPECT = 16 / 9, arm = frameArm(FRAMES.b, FOV, ASPECT);
const space = createEyeSpace(gather([buildDrawn(L).scene], springs.gather).bvh);
const R = eyeRadius(FOV, ASPECT, 0.1); space.radius = R;
const LOW = -0.75, HIGH = 0.45;   // the page's pitch limits on the ground (yard.js) and the report's pitch

// the floor under a point as the eye's own rule reads it (eye.js, `groundAt`): the drawn floor where the grid has it
const groundAt = (x, z) => (walker.answers?.(x, z) ? Math.max(walker.heightAt(x, z), walker.landAt(x, z)) : walker.landAt(x, z));

/** Throw the pitch down and back `times` times at frame length `dt`; the least clearance of the eye over the floor under it, and where. */
function drag(at0, yaw, { dt, withSpace, times = 20, hold = 12 }) {
  const [x, z] = at0, foot = walker.heightAt(x, z), eyeY = walker.eyeAt(x, z), follow = createFollow();
  const sp = withSpace ? space : null;
  const one = (pitch) => followEye(walker, { x, z, foot, eyeY, yaw, pitch, side: 1, reach: 6.2, arm, space: sp });
  let worst = { clear: Infinity }, c;
  const frame = (pitch, tag) => { c = follow.step(dt, one(pitch)); const clear = c[1] - groundAt(c[0], c[2]) - R; if (clear < worst.clear) worst = { clear, pitch, tag, eye: c.map((v) => +v.toFixed(2)) }; };
  for (let i = 0; i < 90; i++) frame(HIGH, "settle");
  for (let n = 0; n < times; n++) {
    for (let i = 0; i < hold; i++) frame(LOW, "down " + n);
    for (let i = 0; i < hold; i++) frame(HIGH, "up " + n);
  }
  return worst;
}

// where the report was made, before the gate (the preview address of #622)
const report = [[-5.68, 49.8], 1.145];
for (const withSpace of [true, false]) for (const dt of [1 / 60, 1 / 30, 1 / 15]) {
  test(`#622: dragging the view down and back never puts the eye under the floor before the gate, ${withSpace ? "asking what is drawn" : "asking the written plan"}, ${(dt * 1000).toFixed(0)} ms frames`, { skip: !isPrologue && "its places are the prologue's" }, () => {
    const w = drag(report[0], report[1], { dt, withSpace });
    assert.ok(w.clear >= 0, `the eye came ${(-w.clear).toFixed(3)} m under the floor (less its sphere) at pitch ${w.pitch}, ${w.tag}, eye ${w.eye}`);
  });
}

// and the same at every corner and end of the walks the level names: the gate's and the great hall's platforms, the foot and
// head of each flight, facing four ways, with the frames of a slow machine
const points = [...Object.values(springs.routes(site, walker)), ...Object.values(need("follow").routes(site, walker))].flat().filter(([x, z]) => walker.answers?.(x, z) !== false && !walker.blocked(x, z));
for (const withSpace of [true, false]) {
  test(`#622: at every corner and end of the walks, dragging the view down and back keeps the eye over the floor, ${withSpace ? "asking what is drawn" : "asking the written plan"}`, { skip: !isPrologue && "its places are the prologue's" }, () => {
    const bad = [];
    for (const pt of points) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const w = drag(pt, yaw, { dt: 1 / 30, withSpace, times: 4, hold: 8 });
      if (w.clear < 0) bad.push(`(${pt.map((v) => +v.toFixed(1))}) facing ${Math.round((yaw * 180) / Math.PI)}°: ${(-w.clear).toFixed(2)} m under at pitch ${w.pitch}, ${w.tag}`);
    }
    assert.deepEqual(bad.slice(0, 6), [], `${bad.length} places of ${points.length * 4}`);
  });
}
