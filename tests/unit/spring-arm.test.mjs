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
const { levelPlan, need, isPrologue } = await import("./level-plan.mjs");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { followEye, createFollow, FRAMES, frameArm, aimAt, FOLLOW } = await import("../../app/src/eye.js");
const { createEyeSpace, eyeRadius } = await import("../../app/src/eyespace.js");
const { buildDrawn } = await import("../../tools/walk/scene.mjs");
const { gather } = await import("../../tools/walk/bake.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const { L, site, walker: written } = await levelPlan(M, { real: true }), springs = need("springArm");
const grids = gridsByPlace(decode(ensure(prepare(L)).bytes, (b) => inflateRawSync(b)));
const walker = createGridWalker(written, grids, { doors: site.halls });
const dt = 1 / 60, FOV = 50, ASPECT = 16 / 9, frame = FRAMES.b, arm = frameArm(frame, FOV, ASPECT);
// what is drawn, gathered as the floor is baked from it, for the eye to ask (#295)
const gathered = gather([buildDrawn(L).scene], springs.gather), bvh = gathered.bvh, space = createEyeSpace(bvh, null, { thickWalls: !!L.eyeThickWalls });
space.radius = eyeRadius(FOV, ASPECT, 0.1);

// How near the eye may come, from the point over his head it backs away from (`ty`, 1.3 m over the floor): a wall at his
// back brings it in, but not into him. Two metres is the eye far enough back to see all of him and the floor round his
// feet at the walk's 50°; it may come nearer for a moment (a corner turned, a column passed), never nearer than a metre.
const NEAR = 2.0, NEAREST = 1.0, OFTEN = 0.9;


/**
 * Does the line a-b ([x, y, z] each) cross a solid thicker than `min` (#562)? A wall is drawn as skins, so thickness is read from the
 * faces the line meets, in order: between two of them, more than `min` apart, the line is inside a solid if a line up from the middle
 * of that stretch meets an odd number of faces (the hollow of a closed wall; a column is thinner than `min`, a gap between two things
 * has an even number above it).
 */
const ray = new THREE.Ray(), up = new THREE.Vector3(0, 1, 0);
function thickBetween(a, b, min = 0.95) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(); if (len < 1e-6) return false; d.divideScalar(len);
  ray.origin.set(...a); ray.direction.copy(d);
  const hits = bvh.raycast(ray, THREE.DoubleSide).map((h) => h.distance).filter((t) => t <= len).sort((p, q) => p - q);
  ray.origin.set(...b); ray.direction.copy(up); if (bvh.raycast(ray, THREE.DoubleSide).length % 2 === 1) return true;   // (the eye itself in a wall's hollow)
  ray.origin.set(...a); ray.direction.copy(d);
  for (let i = 0; i + 1 < hits.length; i++) {
    if (hits[i + 1] - hits[i] < min) continue;
    const m = (hits[i] + hits[i + 1]) / 2; ray.origin.set(a[0] + d.x * m, a[1] + d.y * m, a[2] + d.z * m); ray.direction.copy(up);
    if (bvh.raycast(ray, THREE.DoubleSide).length % 2 === 1) return true;
  }
  return false;
}

/** Walk `path` as follow.test walks it, on the baked floor; for every frame, how far the eye stands from him and whether he is in the picture. */
function walk(path, { reach = 6.2, pitch = 0.04, clear = false } = {}) {
  const follow = createFollow(), out = [], cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 500);
  let x = path[0][0], z = path[0][1], yaw = Math.atan2(path[1][0] - x, -(path[1][1] - z)), eyeY = walker.eyeAt(x, z), prev = null, lastYaw = yaw;
  for (const [tx, tz] of path.slice(1)) {
    for (let n = 0; n < 20000; n++) {
      const vx = tx - x, vz = tz - z, l = Math.hypot(vx, vz); if (l < 0.02) break;
      const step = Math.min(l, (walker.onStairs(x, z) ? 1.25 : 2.1) * dt); x += (vx / l) * step; z += (vz / l) * step;
      assert.ok(!walker.blocked(x, z), `the route passes through (${x.toFixed(2)}, ${z.toFixed(2)}), where he cannot walk`);
      const want = Math.atan2(vx, -vz); yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-3 * dt));
      const foot = walker.heightAt(x, z);
      eyeY += (walker.eyeAt(x, z) - eyeY) * (1 - Math.exp(-dt / 0.14));
      const at = { x, z, foot, eyeY, yaw, pitch, side: 1, reach, arm, space }, vy = (yaw - lastYaw) / dt; lastYaw = yaw;
      const { eye, ahead } = follow.look(walker, at, vy, dt);   // (looking ahead while the view swings, as yard.js does)
      const c = follow.step(dt, eye, ahead);
      // what the eye moved on its own, beyond following him and turning with the view (follow.test's measure)
      let flat = 0, up = 0;
      if (prev) { const dy = yaw - prev.yaw, ox = prev.c[0] - prev.x, oz = prev.c[2] - prev.z, ex = x + ox * Math.cos(dy) - oz * Math.sin(dy), ez = z + ox * Math.sin(dy) + oz * Math.cos(dy); flat = Math.hypot(c[0] - ex, c[2] - ez); up = Math.abs(c[1] - prev.c[1] - (eyeY - prev.eyeY)); }
      prev = { c, x, z, yaw, eyeY };
      // him in the picture: his feet and the top of his head, seen from the eye as the page aims it
      const aim = aimAt(c, [x, foot, z], yaw, frame, FOV);
      let seen = false;
      if (aim) {
        cam.position.set(...c); cam.rotation.set(aim[1], -aim[0], 0, "YXZ"); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        seen = [foot, foot + 1.22].every((y) => { const p = new THREE.Vector3(x, y, z).project(cam); return p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1; });
      }
      out.push({ x, z, head: [x, foot + 1.22, z], c, back: Math.hypot(c[0] - x, c[1] - (eyeY + arm.h), c[2] - z), seen, flat, up, forced: follow.forced, cut: clear && follow.dist > 0.6 ? space.shut(c[0], c[1], c[2]) : false });
    }
  }
  return out;
}

// The routes walked are the level's own (app/levels/<id>/checks.js).
const routes = springs.routes(site, walker);

for (const [name, path] of Object.entries(routes)) {
  test(`#295: from behind him the eye stands back and sees him: ${name}`, () => {
    const frames = walk(path), n = frames.length;
    const near = frames.filter((f) => f.back < NEAR).length, nearest = frames.reduce((a, f) => (f.back < a.back ? f : a), frames[0]), unseen = frames.filter((f) => !f.seen);
    if (process.env.ARM_REPORT) console.log(name, { frames: n, near: +(near / n).toFixed(3), nearest: +nearest.back.toFixed(2), at: [+nearest.x.toFixed(1), +nearest.z.toFixed(1)], unseen: unseen.length });
    assert.ok(nearest.back >= NEAREST, `the eye came to ${nearest.back.toFixed(2)} m from him at (${nearest.x.toFixed(1)}, ${nearest.z.toFixed(1)})`);
    assert.ok(near <= n * (1 - OFTEN), `the eye stood nearer than ${NEAR} m in ${near} of ${n} frames`);
    assert.ok(!unseen.length, `he was out of the picture in ${unseen.length} of ${n} frames, first at (${unseen[0]?.x.toFixed(1)}, ${unseen[0]?.z.toFixed(1)})`);
    // The eye does not stand beyond a wall: the line from his head to it meets no solid thicker than a column (#562: turned out of an
    // aisle's end it was taken through a 1 m gable and stood outside the hall).
    const through = L.eyeThickWalls ? frames.filter((f) => thickBetween(f.head, f.c)) : [];   // (a level asks for it, #562: the prologue's camera is walked as it was)
    assert.ok(!through.length, `the eye stood beyond a thick solid in ${through.length} of ${n} frames, first at (${through[0]?.x.toFixed(1)}, ${through[0]?.z.toFixed(1)})`);
    holdsStill(frames);
  });
}

// follow.test's bounds on what the eye does of its own accord, held for the eye that asks what is drawn: no more than
// 0.15 m across or 0.05 m up or down in a frame, coming in included; put straight out of something seldom, and by no more than a metre.
const FLAT = 0.15, UP = 0.05, FORCED = 1.0;
function holdsStill(frames) {
  const free = frames.filter((f) => !f.forced), worst = (a, k) => a.reduce((b, f) => (f[k] > b[k] ? f : b), a[0]);
  const f = worst(free, "flat"), u = worst(free, "up"), put = frames.filter((q) => q.forced > FLAT), most = put.length ? worst(put, "forced") : null;
  assert.ok(f.flat <= FLAT, `the eye moved ${f.flat.toFixed(3)} m on its own in one frame at (${f.x.toFixed(1)}, ${f.z.toFixed(1)})`);
  assert.ok(u.up <= UP, `the eye rose or fell ${u.up.toFixed(3)} m on its own in one frame at (${u.x.toFixed(1)}, ${u.z.toFixed(1)})`);
  assert.ok(!most || most.forced <= FORCED, `the eye was put out of something by ${most?.forced.toFixed(2)} m at (${most?.x.toFixed(1)}, ${most?.z.toFixed(1)})`);
  assert.ok(put.length <= frames.length / 200, `the eye was put out of something in ${put.length} of ${frames.length} frames`);
}
// and on follow.test's own routes
for (const [name, path] of Object.entries(need("follow").routes(site, walker))) test(`#295: asking what is drawn, the eye does not jump: ${name}`, () => holdsStill(walk(path)));

// The lead's measures of the arm on a flight of steps and on a phone held upright (#295, from #271/#291 and #306), worked out
// as tools/frame-routes.mjs works them, on the baked floor with the eye asking what is drawn: going down the flight by the
// half-way pavilion the arm does not draw in below 3 m nor change its picture by more than 5% a second, the view does not
// tip by more than 0.3° from one frame to the next up the flight or down it, and round the censer on a phone held upright
// (390 × 844) his head and feet are in the picture every frame.
const { measure, WALKS } = await import("../../tools/frame-routes.mjs");
test("#295: down the flight by the half-way pavilion the arm keeps 3 m and the view does not jump", { skip: !isPrologue && "its walks and its floor are the prologue's" }, () => {
  for (const size of ["16x9", "phone"]) {
    const r = measure("b", size, WALKS["stair-down"], 0.06, { walker, space });
    if (process.env.ARM_REPORT) console.log("stair-down", size, JSON.stringify(r));
    assert.ok(r.armMin >= 3, `${size}: the arm drew in to ${r.armMin} m going down the flight`);
    assert.ok(r.down.perSec <= 5, `${size}: his height in the picture changed ${r.down.perSec}% in a second going down`);
    assert.ok(r.pitchStep <= 0.3, `${size}: the view tipped ${r.pitchStep}° in one frame going down`);
  }
});
test("#295: up the flight the view does not tip more than 0.3° a frame either", { skip: !isPrologue && "its walks and its floor are the prologue's" }, () => {
  for (const size of ["16x9", "phone"]) { const r = measure("b", size, WALKS["stair-up"], 0.06, { walker, space }); assert.ok(r.pitchStep <= 0.3, `${size}: ${r.pitchStep}° in one frame going up`); }
});
test("#295: round the censer on a phone held upright, his head and feet are in the picture", { skip: !isPrologue && "its walks and its floor are the prologue's" }, () => {
  const r = measure("b", "phone", WALKS.censer, 0.06, { walker, space });
  if (process.env.ARM_REPORT) console.log("censer phone", JSON.stringify(r));
  assert.ok(r.top >= 0 && r.bottom <= 100 && r.feetIn === 100 && r.hidden === 0, `head at ${r.top}%, feet at ${r.bottom}%, feet in ${r.feetIn}%, hidden ${r.hidden}%`);
});

// The floor the written plan never let him onto (#295, from the third step's review: 209 m² in the first court alone, the
// platforms' sides and backs, the ground before the gate): from every metre of it, facing eight ways, once the eye has
// settled it stands back at least a metre and he is in the picture, unless something drawn stands right behind him
// (within 1.25 m of the point over his head), where no eye can stand that far behind him clear of it.
test("#295: on every metre of the floor the written plan never reached, the eye sees him", { skip: !isPrologue && "its walks and its floor are the prologue's" }, () => {
  const old = walker.old, pts = [];
  for (let x = -40; x <= 40; x += 1) for (let z = -130; z <= 95; z += 1) if (walker.answers(x, z) && !walker.blocked(x, z) && old.blocked(x, z)) pts.push([x, z]);
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 500), bad = [];
  let looked = 0, walled = 0;
  for (const [x, z] of pts) for (let k = 0; k < 8; k++) {
    const yaw = (k * Math.PI) / 4, foot = walker.heightAt(x, z), eyeY = walker.eyeAt(x, z), follow = createFollow();
    const bx = -Math.sin(yaw), bz = Math.cos(yaw);
    if ([0.5, 0.9, 1.25].some((d) => space.shut(x + bx * d, eyeY + arm.h, z + bz * d))) { walled++; continue; }
    let c; for (let i = 0; i < 40; i++) c = follow.step(dt, followEye(walker, { x, z, foot, eyeY, yaw, pitch: 0.04, side: 1, reach: 6.2, arm, space }));
    looked++;
    const aim = aimAt(c, [x, foot, z], yaw, frame, FOV); let seen = false;
    if (aim) { cam.position.set(...c); cam.rotation.set(aim[1], -aim[0], 0, "YXZ"); cam.updateMatrixWorld(); seen = [foot + 0.61].every((y) => { const p = new THREE.Vector3(x, y, z).project(cam); return p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1; }); }   // (in the picture, as __probe().monkBox has it: his middle)
    if (follow.dist < NEAREST || !seen) bad.push(`(${x}, ${z}) facing ${k * 45}°: eye ${follow.dist.toFixed(2)} m back, ${seen ? "seen" : "not seen"}`);
  }
  if (process.env.ARM_REPORT) console.log("new floor", { points: pts.length, looked, walled, bad: bad.length, first: bad.slice(0, 12) });
  assert.ok(pts.length > 150, `only ${pts.length} metres of new floor found`);
  // (what is left, under one in a hundred of the looks, is a lattice or a row of columns standing a little more than a
  // metre behind him at a slant, where the eye comes to 0.5–0.75 m and he is still drawn: listed in the PR for the lead)
  assert.ok(bad.length <= looked / 100, `the eye came nearer than ${NEAREST} m or lost him in ${bad.length} of ${looked} looks: ${bad.slice(0, 8).join("; ")}`);
  assert.ok(!bad.some((b) => / 0\.[0-4]\d m back/.test(b)), `the eye came into him: ${bad.filter((b) => / 0\.[0-4]\d m back/.test(b)).join("; ")}`);
});

// The sphere is worked out for the lens and the screen of the frame (#295; collision-spike.md: a fixed 0.24 m did not cover
// the widest picture the page draws): a phone held upright at the walk's 62° and the most the settings add (+16°), a 21:9
// screen at 50° + 16°, and that screen with the camera raised and drawn out to its widest (photo.zoom 0.7). With each, round
// the great hall's platform and through the gate, the eye's sphere is clear of everything drawn on every frame he is seen.
test("#295: the eye's sphere covers the near plane at the widest lenses the page draws", async () => {
  const { FOV_RANGE } = await import("../../app/src/settings.js");
  const widest = (fov, zoom) => (2 * Math.atan(Math.tan((fov * Math.PI) / 360) / zoom) * 180) / Math.PI;
  const lenses = [["a phone held upright", widest(62 + FOV_RANGE[1], 1), 390 / 844], ["21:9", widest(50 + FOV_RANGE[1], 1), 21 / 9], ["21:9, the camera drawn out", widest(50 + FOV_RANGE[1], 0.7), 21 / 9]];
  const bad = [];
  try {
    for (const [name, fov, aspect] of lenses) {
      space.radius = eyeRadius(fov, aspect, 0.1);
      for (const route of springs.lensRoutes) { const cut = walk(routes[route], { clear: true }).filter((f) => f.cut); if (cut.length) bad.push(`${name} (r ${space.radius.toFixed(3)} m), ${route}: ${cut.length} frames, first at (${cut[0].x.toFixed(1)}, ${cut[0].z.toFixed(1)})`); if (process.env.ARM_REPORT && cut.length) console.log(name, route, cut.map((f) => `${f.x.toFixed(1)},${f.z.toFixed(1)}`).join(' ')); }
    }
  } finally { space.radius = eyeRadius(FOV, ASPECT, 0.1); }
  assert.deepEqual(bad, []);
});
