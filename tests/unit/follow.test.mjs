// The eye that follows him must not jump. A friend who walked the temple felt sick (2026-11-15): from behind him the
// eye leapt to his back in one frame whenever a column or the bell tower came between them, and bobbed up by half a
// metre at every platform's edge. Here he walks the measured route and the courts, sixty frames a second, the view
// turning after him the way the measured walk turns it, and every frame the eye's own movement (what it does beyond
// following him) is measured.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker, LEVELS } from "../../app/src/site.js";
import { followEye, createFollow, FOLLOW, FRAMES, frameArm, aimAt } from "../../app/src/eye.js";
import { ROUTE } from "../../app/src/tour.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site);
const dt = 1 / 60;

// Walk `path` at his pace, the view turning after the way he goes as the measured walk turns it (`tour.js`), the eye
// riding as `yard.js` makes it ride. Returns, for every frame, how far the eye moved beyond the step he took.
function walk(path, { reach = 6.2, pitch = 0.04, arm = undefined } = {}) {   // (no arm: the default eye, B; `arm: null` the eye before #271)
  const follow = createFollow(), out = [];
  let x = path[0][0], z = path[0][1], yaw = Math.atan2(path[1][0] - x, -(path[1][1] - z)), eyeY = walker.eyeAt(x, z), side = 1.2, prev = null;
  for (const [tx, tz] of path.slice(1)) {
    for (let n = 0; n < 20000; n++) {
      const vx = tx - x, vz = tz - z, l = Math.hypot(vx, vz); if (l < 0.02) break;
      const step = Math.min(l, (walker.onStairs(x, z) ? 1.25 : 2.1) * dt); x += (vx / l) * step; z += (vz / l) * step;
      assert.ok(!walker.blocked(x, z), `the route passes through (${x.toFixed(2)}, ${z.toFixed(2)}), where he cannot walk`);
      const want = Math.atan2(vx, -vz); yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-3 * dt));
      const foot = walker.heightAt(x, z);
      eyeY += (walker.eyeAt(x, z) - eyeY) * (1 - Math.exp(-dt / 0.14));
      const rx = Math.cos(yaw), rz = Math.sin(yaw); side += ((walker.wall(x + rx * 1.4, z + rz * 1.4) ? 0 : 1.2) - side) * Math.min(1, dt * 3);
      const eye = followEye(walker, { x, z, foot, eyeY, yaw, pitch, side, reach, arm });
      // Where the eye would be if it only followed him and turned with the view: the same offset as the frame before,
      // turned through the same angle. What it moves beyond that is its own doing.
      const c = follow.step(dt, eye);
      if (prev) {
        const dy = yaw - prev.yaw, ox = prev.c[0] - prev.x, oz = prev.c[2] - prev.z;
        const ex = x + ox * Math.cos(dy) - oz * Math.sin(dy), ez = z + ox * Math.sin(dy) + oz * Math.cos(dy);
        out.push({ x, z, yaw, eyeY, foot, c, lean: follow.side, flat: Math.hypot(c[0] - ex, c[2] - ez), up: Math.abs(c[1] - prev.c[1] - (eyeY - prev.eyeY)), dist: follow.dist, forced: follow.forced });
      }
      prev = { c, x, z, yaw, eyeY };
    }
  }
  return out;
}
const T = LEVELS;
const routes = {
  "the measured route, bamboo to the first court": ROUTE,
  "round the first court, close past the bell and drum towers": [[-10.8, 19], [10.8, 19], [10.8, 6], [-10.8, 6], [-10.8, 19]],
  // (round the censer, which stands on the axis, close by its east side: the eye behind him must not pass into it)
  "up the axis of the first court to the main hall's stair": [[0, 29], [0, 15.4], [1.3, 13], [0, 10.6], [0, -4.5]],
  "up the stair to the second terrace and on to the Guanyin hall's steps": [[0, T[1].zS + 10], [0, T[1].zS - 5.5]],
};
// A walking pace is 0.035 m a frame. The eye may add to that, turning and settling, but not leap: 0.15 m a frame is
// nine metres a second, which it reaches only coming in behind a wall, gathering speed and losing it again. When the
// view swings the eye into a trunk or a wall it is put straight out of it; that may happen, but seldom (turning hard by a
// wall), and by no more than a trunk's thickness.
const FLAT = 0.15, UP = 0.05, FORCED = 1.0;
for (const [name, path] of Object.entries(routes)) {
  test(`the eye does not jump: ${name}`, () => {
    const frames = walk(path), free = frames.filter((f) => !f.forced), worst = (a, k) => a.reduce((b, f) => (f[k] > b[k] ? f : b), a[0]);
    const f = worst(free, "flat"), u = worst(free, "up"), at = (p) => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}), eye ${p.dist.toFixed(2)} m behind`;
    assert.ok(f.flat <= FLAT, `the eye moved ${f.flat.toFixed(3)} m on its own in one frame at ${at(f)}`);
    assert.ok(u.up <= UP, `the eye rose or fell ${u.up.toFixed(2)} m on its own in one frame at ${at(u)}`);
    const put = frames.filter((f) => f.forced > FLAT), most = put.length ? worst(put, "forced") : null;
    if (process.env.FOLLOW_REPORT) console.log(name, { frames: frames.length, flat: +f.flat.toFixed(3), up: +u.up.toFixed(3), forced: put.length, most: most && +most.forced.toFixed(2) });
    assert.ok(!most || most.forced <= FORCED, `the eye was put out of something by ${most?.forced.toFixed(2)} m at ${most && at(most)}`);
    assert.ok(put.length <= frames.length / 200, `the eye was put out of something in ${put.length} of ${frames.length} frames`);
  });
}
test("a column passing between him and the eye is let pass; a wall coming between brings it in", () => {
  // Built by hand: a walker with one column three metres behind him, and a wall that may be put up.
  let wallUp = false;
  const fake = {
    eyeShut: (x, y, z) => (wallUp && z > 2.5 && z < 3.5 ? true : Math.hypot(x - 0, z - 3) < 0.3 ? "post" : false),
    landAt: () => 0,
  };
  const follow = createFollow(), eye = () => followEye(fake, { x: 0, z: 0, foot: 0, eyeY: 0, yaw: 0, pitch: 0, side: 0, reach: 6 });
  for (let i = 0; i < 6; i++) follow.step(dt, followEye({ eyeShut: () => false, landAt: () => 0 }, { x: 0, z: 0, foot: 0, eyeY: 0, yaw: 0, pitch: 0, side: 0, reach: 6 }));
  const start = follow.dist;
  for (let i = 0; i < 6; i++) follow.step(dt, eye());   // a tenth of a second with the column in the way
  assert.equal(follow.dist, start, "a column crossing the view for a moment should not bring the eye in");
  wallUp = true; let last = follow.dist;
  for (let i = 0; i < 4; i++) { follow.step(dt, eye()); assert.ok(last - follow.dist < 1.2, "coming in, the eye should not leap"); last = follow.dist; }
  for (let i = 0; i < 60; i++) follow.step(dt, eye());
  assert.ok(follow.dist < 3, `behind a wall the eye should come in to him, but stands ${follow.dist.toFixed(2)} m back`);
});

// Visitors said the view swam about when they moved the mouse (2026-11-16). Standing still and swinging the view
// right round, as a hand on a mouse swings it (three radians a second, either way), all over the first court and its
// towers and steps: the arm sweeps into walls and eaves, and the eye used to be put straight out of them in 3% of the
// frames, by up to five metres at a time. It now looks a quarter of a second along the turn (`ahead`, as yard.js asks)
// and comes in before it gets there, or lets something narrow sweep past.
test("swinging the view round where he stands does not throw the eye about", () => {
  const spots = []; for (let x = -12; x <= 12; x += 3) for (let z = -4; z <= 28; z += 3) if (!walker.blocked(x, z)) spots.push([x, z]);
  let frames = 0, put = 0, far = 0, worst = 0;
  for (const [x, z] of spots) for (const rate of [3, -3]) {
    const follow = createFollow(), foot = walker.heightAt(x, z), eyeY = walker.eyeAt(x, z);
    let yaw = 0, side = 1.2;
    for (let i = 0; i < 60 + Math.round((2 * Math.PI) / 3 / dt); i++) {
      const turning = i >= 60; if (turning) yaw += rate * dt;
      const rx = Math.cos(yaw), rz = Math.sin(yaw); side += ((walker.wall(x + rx * 1.4, z + rz * 1.4) ? 0 : 1.2) - side) * Math.min(1, dt * 3);
      const at = { x, z, foot, eyeY, yaw, pitch: 0.04, side, reach: 6.2 };
      follow.step(dt, followEye(walker, at), turning ? followEye(walker, { ...at, yaw: yaw + rate * FOLLOW.ahead }) : null);
      if (!turning) continue;
      frames++; if (follow.forced > FLAT) put++; if (follow.forced > FORCED) far++; worst = Math.max(worst, follow.forced);
    }
  }
  if (process.env.FOLLOW_REPORT) console.log("turning", { spots: spots.length, frames, put, far, worst: +worst.toFixed(2) });
  assert.ok(put <= frames / 100, `the eye was put out of something in ${put} of ${frames} frames`);
  assert.ok(far <= frames / 600, `the eye was thrown more than a metre in ${far} of ${frames} frames`);
});

// Issue #271, `?frame=a|b`: where he stands in the picture is held, as a fraction of it, however near the eye comes.
// Along the same routes, the point in him that is held is carried through a camera at the eye, looking the way the view
// looks; across the picture it may not stray from where it is held (the eye's rise over a platform's edge moves it only
// up and down), and the eye must not jump any more than the eye of today. A leans its arm in by a wall on his right
// (eye.js, FOLLOW.leanTime): it is held to where that lean puts him.
for (const [key, F] of Object.entries(FRAMES)) for (const [w, h] of [[16, 9], [4, 3], [9, 19.5]]) {
  test(`frame ${key} at ${w}:${h} holds him where it says, on every route`, () => {
    const cam = new THREE.PerspectiveCamera(50, w / h, 0.05, 500), arm = frameArm(F, 50, w / h), v = new THREE.Vector3();
    let most = 0, n = 0;
    for (const [name, path] of Object.entries(routes)) {
      const frames = walk(path, { arm }), put = frames.filter((f) => f.forced > FLAT);
      for (const f of frames) {
        assert.ok(f.forced || f.flat <= FLAT, `${name}: the eye moved ${f.flat.toFixed(3)} m on its own at (${f.x.toFixed(1)}, ${f.z.toFixed(1)})`);
        if (f.dist < 0.85) continue;   // he is hidden when it is as near as that (yard.js, monkHidden)
        const aim = aimAt(f.c, [f.x, f.foot, f.z], f.yaw, F, 50); cam.position.fromArray(f.c); cam.rotation.set(0.04, -(aim ? aim[0] : f.yaw), 0, "YXZ"); cam.updateMatrixWorld();   // (across as the page turns it; up and down is aimAt's own business)
        v.set(f.x, f.eyeY + F.hold, f.z).project(cam); most = Math.max(most, Math.abs(v.x - F.nx * (F.nx ? f.lean : 1))); n++;
      }
      if (process.env.FOLLOW_REPORT) console.log(key, w, h, name, { frames: frames.length, forced: put.length, most: +Math.max(0, ...put.map((f) => f.forced)).toFixed(2), where: put.map((f) => `${f.x.toFixed(1)},${f.z.toFixed(1)}:${f.forced.toFixed(2)}`).join(" ") });
      // How often the eye is put straight out of something is reported, not yet held: shortening the arm alone puts it
      // out by up to 1.5 m a few times on these routes (the censer behind him on the axis, the gate's passage), where
      // today's eye, stepping in behind him, is put out by 0.5 m at most. Whichever the owner chooses is held to today's
      // bound when it becomes the default, with #161's fifth step (a swept sphere, not a point).
      void put;
    }
    // 0.02 of the half-width is 1% of the picture's width
    assert.ok(most < 0.02, `across ${n} frames he strayed ${(most * 50).toFixed(2)}% of the width from where frame ${key} holds him`);
  });
}

// Issue #271's measure of the default eye (B), on the walks tools/frame-measure.cjs walks in the page (worked out here by
// tools/frame-routes.mjs, the same plan and eye): on open ground his middle stays within 3% of the picture's width of
// one place; by the columns and the wall it moves no faster than 2% of the width in a second; and on the stair by the
// half-way pavilion, up and down, his knees (0.35 m) are always in the picture, his feet too.
test("the default eye holds him in the middle, and on the stair his whole body is in the picture", async () => {
  const { measure, WALKS } = await import("../../tools/frame-routes.mjs");
  for (const size of ["16x9", "4x3", "phone"]) for (const [name, path] of Object.entries(WALKS)) {
    const r = measure("b", size, path);
    if (name === "open" || name === "censer") assert.ok(r.across.range <= 3, `${size} ${name}: across ${r.across.min}–${r.across.max}%`);
    assert.ok(r.across.perSec <= 2, `${size} ${name}: he moved ${r.across.perSec}% of the width in a second`);
    assert.ok(Math.abs(r.across.mean - 50) <= 1.5, `${size} ${name}: his middle is ${r.across.mean}% across`);
    if (name.startsWith("stair")) assert.ok(r.kneesIn === 100 && r.feetIn === 100 && r.hidden === 0, `${size} ${name}: feet in ${r.feetIn}%, knees in ${r.kneesIn}%, hidden ${r.hidden}%`);
  }
});

// Issue #271 (the lead's review of #291): with the arm straight behind him, walking north past the censer and on, and
// in through the gate's middle bay from the forecourt, the eye was put straight out of the censer by 1.4 m in one
// frame. The owner will not have the eye jump: on these two walks it may not move more than FLAT on its own in any
// frame, put out of something or not.
for (const [name, path] of Object.entries({
  "from behind the censer north past it": [[0, 18], [1.3, 13], [0, 9], [0, 3]],
  "in through the gate's middle bay": [[8.5, 52], [8.5, 49], [0, 46.5], [0, 34]],
})) test(`the default eye never jumps: ${name}`, () => {
  const frames = walk(path), worst = frames.reduce((b, f) => (Math.max(f.flat, f.forced) > Math.max(b.flat, b.forced) ? f : b), frames[0]);
  if (process.env.FOLLOW_REPORT) console.log(name, { frames: frames.length, flat: +worst.flat.toFixed(3), forced: +worst.forced.toFixed(3) });
  assert.ok(worst.flat <= FLAT && worst.forced <= FLAT, `the eye moved ${worst.flat.toFixed(3)} m on its own (put out ${worst.forced.toFixed(2)} m) in one frame at (${worst.x.toFixed(2)}, ${worst.z.toFixed(2)}), ${worst.dist.toFixed(2)} m behind`);
});

// The owner, 2026-11-19 (after #291): going up a flight the view shook. The view was tilted every frame at his feet, which
// go up a tread at a time, so it nodded with each step (1.4° in one frame on the page, the direction turning back fifty
// times on one flight). It is tilted at the height the eye itself rides at, eased over the steps: up the flight by the
// half-way pavilion and on up the last flight, it tips no more than 0.3° from one frame to the next. (Coming down, the
// eye is still put in by metres in one frame where the flight rises behind him, and the view turns with it: #295.)
test("on a flight of steps the view does not nod with each tread", async () => {
  const { measure, WALKS } = await import("../../tools/frame-routes.mjs");
  for (const size of ["16x9", "phone"]) for (const name of ["stair-up"]) {
    const r = measure("b", size, WALKS[name]);
    assert.ok(r.pitchStep <= 0.3, `${size} ${name}: the view tipped ${r.pitchStep}° in one frame`);
  }
});
