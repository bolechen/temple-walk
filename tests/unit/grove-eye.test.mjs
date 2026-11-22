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
const { followEye, createFollow, FRAMES, frameArm, aimAt } = await import("../../app/src/eye.js");
const { createEyeSpace, eyeRadius } = await import("../../app/src/eyespace.js");
const { buildDrawn } = await import("../../tools/walk/scene.mjs");
const { gather } = await import("../../tools/walk/bake.mjs");
const { GROVE, APPROACH } = await import("../../app/src/site.js");

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

// What the bamboo is drawn of (culms and sprays), grown as the page grows it, to look along the lines from the eye to him.
const { createBamboo } = await import("../../app/src/bamboo.js"), { terrain } = await import("../../app/src/site.js"), { EYE_EDGE } = await import("../../app/levels/t00/level.js");
const grow = (clearUnder) => { const g = new THREE.Scene(); createBamboo(g, GROVE.areas, terrain, GROVE.keep, { fine: true, clearUnder }); g.updateMatrixWorld(true); return g.children; };
const [culms, leaves] = grow(L.grove.clearUnder), rc = new THREE.Raycaster();
const culmAcross = (c, p) => { const e = new THREE.Vector3(...c), d = new THREE.Vector3(...p).sub(e); rc.set(e, d.clone().normalize()); rc.far = d.length() - 0.05; return rc.intersectObject(culms, false).length > 0; };
/** Where the box round him (the corners of 0.6 m round his feet and the top of his head, as `__probe().monkBox`) falls in the picture, [bottom, top] of its height, and how far down the view looks against the visitor's own. */
function framed(c, x, z, yaw, pitch, aspect) {
  const foot = walker.heightAt(x, z), aim = aimAt(c, [x, foot, z], yaw, FRAMES.b, FOV); if (!aim) return null;
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.05, 500); cam.position.set(...c); cam.rotation.set(aim[1], -aim[0], 0, "YXZ"); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const ys = []; for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) for (const y of [foot, foot + 1.22]) ys.push(new THREE.Vector3(x + dx, y, z + dz).project(cam).y);
  return { bottom: Math.min(...ys), top: Math.max(...ys), tilt: ((pitch - aim[1]) * 180) / Math.PI };
}

// By the ink-stone pool (the tester's place), looking into the grove: the eye keeps out of the grove but for its edge, as
// it did before #295, 1.99 m behind him (the art review's choice (b) for #518): no nearer than 1.9 m, his head inside the
// picture (his feet may go out of it a little, to 110%), and no culm on the lines from the eye to his head, waist and feet.
// How far the view looks down against the visitor's own the art reviewer judges from the pictures (#518: 0.6.0 beside it).
const POOL = [23.636, 75.6, 2.422, 0.084];
test("by the ink-stone pool the eye stands in the grove's edge, as before #295: 1.9 m or more back, his head in the picture, no culm across him (#515)", { skip: !isPrologue && "the grove is the prologue's" }, () => {
  const bad = [], [x, z, yaw, pitch] = POOL, foot = walker.heightAt(x, z);
  for (const [name, aspect] of [["16:9", 16 / 9], ["9:19.5", 9 / 19.5]]) {
    const c = rest(x, z, yaw, pitch, aspect), arm = Math.hypot(c[0] - x, c[2] - z), f = framed(c, x, z, yaw, pitch, aspect), at = `(eye ${c.map((v) => v.toFixed(2)).join(", ")}, ${arm.toFixed(2)} m back)`;
    if (L.eyeKeepOut(c[0], c[1], c[2])) bad.push(`${name}: the eye stands deeper than ${EYE_EDGE} m in the grove ${at}`);
    if (arm < 1.9) bad.push(`${name}: the eye came in to ${arm.toFixed(2)} m ${at}`);
    if (!f || f.top > 0.9 || f.bottom < -1.2) bad.push(`${name}: his box runs ${f?.bottom.toFixed(2)} to ${f?.top.toFixed(2)} of the picture's height ${at}`);
    for (const [part, h] of [["head", 1.1], ["waist", 0.6], ["feet", 0.1]]) if (culmAcross(c, [x, foot + h, z])) bad.push(`${name}: a culm stands across the line to his ${part} ${at}`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

// Round the pool the undergrowth at the grove's edge is cleared (`GROVE.underClear`, the level's `grove.clearUnder`): its
// clumps stood between the eye in the edge and him, and across the pool and its stele (#518's art review: no leaf within his
// box, leaves at most at the corners). Every leaf card is counted whole, holes and all, so this is stricter than the
// picture: over a grid of the frame, no line of sight meets a leaf before it has come as far out as he stands. Without the
// clearing it did, so the test can tell.
const POOL_SCREENS = [["16:9", 16 / 9], ["9:19.5", 9 / 19.5]];
function nearLeaves(cards, aspect) {
  const [x, z, yaw, pitch] = POOL, foot = walker.heightAt(x, z), c = rest(x, z, yaw, pitch, aspect), aim = aimAt(c, [x, foot, z], yaw, FRAMES.b, FOV), him = Math.hypot(c[0] - x, c[2] - z);
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.05, 500); cam.position.set(...c); cam.rotation.set(aim[1], -aim[0], 0, "YXZ"); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const hits = []; rc.far = 40;
  for (let i = 0; i < 48; i++) for (let j = 0; j < 27; j++) {
    rc.setFromCamera(new THREE.Vector2(-1 + (i + 0.5) / 24, -1 + (j + 0.5) / 13.5), cam);
    const h = rc.intersectObject(cards, false)[0]; if (h && h.distance * Math.hypot(rc.ray.direction.x, rc.ray.direction.z) < him) hits.push(h.point.toArray().map((v) => +v.toFixed(2)));
  }
  return hits;
}
test("round the ink-stone pool no leaf stands between the eye and him, at 16:9 or upright: the edge's undergrowth is cleared there (#518)", { skip: !isPrologue && "the grove is the prologue's" }, () => {
  for (const [name, aspect] of POOL_SCREENS) { const hits = nearLeaves(leaves, aspect); assert.deepEqual(hits.slice(0, 5), [], `${name}: ${hits.length} lines of sight meet a leaf before him`); }
  const [, uncleared] = grow(null);
  assert.ok(POOL_SCREENS.some(([, aspect]) => nearLeaves(uncleared, aspect).length > 0), "without the clearing no leaf stood before him either: the test cannot tell the fix from nothing");
});
test("the clearing takes out only the pool edge's undergrowth: every other clump and every culm stands where it stood (#518)", { skip: !isPrologue && "the grove is the prologue's" }, () => {
  const [c0, l0] = grow(null), key = (P, i) => `${P.getX(i).toFixed(3)},${P.getY(i).toFixed(3)},${P.getZ(i).toFixed(3)}`;
  assert.equal(culms.geometry.attributes.position.count, c0.geometry.attributes.position.count, "the culms changed");
  const a = l0.geometry.attributes.position, b = leaves.geometry.attributes.position, before = new Map(), kept = new Set();
  for (let i = 0; i < a.count; i++) before.set(key(a, i), [a.getX(i), a.getZ(i)]);
  for (let i = 0; i < b.count; i++) kept.add(key(b, i));
  let moved = 0; for (const k of kept) if (!before.has(k)) moved++;
  assert.equal(moved, 0, `${moved} points of the leaves stand where none stood`);
  // what went is within the stretch by the pool (a clump's card reaches 0.9 m from its middle), and only there
  const A = APPROACH, far = []; for (const [k, [x, z]] of before) if (!kept.has(k) && (x < A.xB1 - 8.1 || x > A.xB1 + 6.9 || z < A.zMid - 10.5 || z > A.zMid + 5.5)) far.push([x, z].map((v) => +v.toFixed(2)));
  assert.deepEqual(far.slice(0, 5), [], `${far.length} points of leaves went far from the pool`);
  assert.ok(b.count < a.count && b.count > 0.98 * a.count, `the clearing took ${a.count - b.count} of ${a.count} points of leaves: more than the pool's edge`);
  assert.ok(!L.grove.clearUnder(...site.start.slice(0, 2)), "the clearing reaches the start");
});

// The start of the walk, where the title is shown, the first picture after 入山 is taken and the opening comes to rest: the
// eye stands where it stood before the grove was kept out (six metres back in the strip the grove leaves open behind him),
// to the centimetre, looking as the visitor looks to within 5° (the art review of #518: the title had been seen from over
// his head, 1.5 m off).
test("at the start of the walk the eye stands where it always stood: six metres back, to the centimetre, looking as he looks (#518)", { skip: !isPrologue && "the grove is the prologue's" }, () => {
  const bad = [], [x, z, yaw] = site.start;
  for (const pitch of [0.04, 0.3]) for (const [name, aspect] of [["16:9", 16 / 9], ["9:19.5", 9 / 19.5], ["4:3", 4 / 3]]) {
    const before = (() => { const space = createEyeSpace(drawn); space.radius = eyeRadius(FOV, aspect, 0.1); const arm = frameArm(FRAMES.b, FOV, aspect), follow = createFollow(), foot = walker.heightAt(x, z); let c; for (let n = 0; n < 240; n++) c = follow.step(dt, followEye(walker, { x, z, foot, eyeY: walker.eyeAt(x, z), yaw, pitch, side: 1, reach: 6.2, arm, space })); return c; })();
    const c = rest(x, z, yaw, pitch, aspect), arm = Math.hypot(c[0] - x, c[2] - z), f = framed(c, x, z, yaw, pitch, aspect), moved = Math.hypot(c[0] - before[0], c[1] - before[1], c[2] - before[2]);
    if (moved >= 0.01) bad.push(`${name}, pitch ${pitch}: the eye stands ${moved.toFixed(3)} m from where it stood without the keep-out`);
    if (arm < 4.5) bad.push(`${name}, pitch ${pitch}: the eye is ${arm.toFixed(2)} m back`);
    if (!f || Math.abs(f.tilt) > 5 + Math.abs(((pitch - aimAt(before, [x, walker.heightAt(x, z), z], yaw, FRAMES.b, FOV)[1]) * 180) / Math.PI)) bad.push(`${name}, pitch ${pitch}: the view looks ${f?.tilt.toFixed(1)}° off the visitor's`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

// Along the old path, each route walked there and back at his pace, the view turning after him as spring-arm.test turns
// it: in no frame may the eye stand deeper in the grove than its edge (`EYE_EDGE`). The routes are the level's own
// (app/levels/t00/checks.js, `grove`).
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
      out.push({ at: [x, z], foot, yaw, c, in: L.eyeKeepOut(c[0], c[1], c[2]) });
    }
  }
  return out;
}
const groveRoutes = isPrologue ? need("grove").routes(site, walker) : {};
// Each culm as the line of its axis, from the culms as grown (each an open cylinder of 18 points: its top ring, then its foot).
const culmLines = (() => { const P = culms.geometry.attributes.position, out = []; for (let i = 0; i + 18 <= P.count; i += 18) { const t = [0, 0, 0], b = [0, 0, 0]; for (let k = 0; k < 9; k++) for (let d = 0; d < 3; d++) { t[d] += P.getComponent(i + k, d) / 9; b[d] += P.getComponent(i + 9 + k, d) / 9; } out.push({ b, t }); } return out; })();
/** Is a culm within 1 m of the eye standing in his strip of the picture, his box's width and 5% more each side, across
 *  its whole height (the art review of #518: a culm close before the lens beside him is let be, one over him is not)? */
function culmBeforeHim(r, aspect, wide = false) {
  const aim = aimAt(r.c, [r.at[0], r.foot, r.at[1]], r.yaw, FRAMES.b, FOV); if (!aim) return false;
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.05, 500); cam.position.set(...r.c); cam.rotation.set(aim[1], -aim[0], 0, "YXZ"); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const xs = []; for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) for (const y of [r.foot, r.foot + 1.22]) xs.push(new THREE.Vector3(r.at[0] + dx, y, r.at[1] + dz).project(cam).x);
  const lo = wide ? -1 : Math.min(...xs), hi = wide ? 1 : Math.max(...xs), pad = wide ? 0 : (hi - lo) * 0.05, v = new THREE.Vector3();
  for (const { b, t } of culmLines) {
    const k = (r.c[1] - b[1]) / (t[1] - b[1]); if (k < -0.1 || k > 1.1) continue;
    if (Math.hypot(b[0] + (t[0] - b[0]) * k - r.c[0], b[2] + (t[2] - b[2]) * k - r.c[2]) > 1) continue;
    for (let s = 0; s <= 1; s += 0.01) {
      v.set(b[0] + (t[0] - b[0]) * s, b[1] + (t[1] - b[1]) * s, b[2] + (t[2] - b[2]) * s); if (v.distanceTo(cam.position) > 1.6) continue;
      const q = v.clone().applyMatrix4(cam.matrixWorldInverse); if (q.z > -0.05) continue;
      v.project(cam); if (Math.abs(v.y) <= 1 && v.x > lo - pad && v.x < hi + pad) return true;
    }
  }
  return false;
}
// and the count can see one: along these routes a culm does come within 1 m of the eye somewhere in the picture (the art
// review saw one before the lens by the pool, beside him), so a strip clear of them is a finding, not a blind test.
test("a culm close before the lens is seen where there is one: the strip's count is not blind (#518)", { skip: !isPrologue && "the grove is the prologue's" }, () => {
  let seen = 0; for (const path of Object.values(groveRoutes)) for (const [, aspect] of [["16:9", 16 / 9], ["9:19.5", 9 / 19.5]]) seen += walk(path, aspect).filter((r, i) => i % 3 === 0 && culmBeforeHim(r, aspect, true)).length;
  assert.ok(seen > 0, "no culm came within 1 m of the eye anywhere in the picture on any route: the count would see nothing");
});
for (const [name, path] of Object.entries(groveRoutes)) {
  test(`${name}, there and back: the eye keeps out of the grove but for its edge, and a culm close before the lens stands over him in no more than 2% of frames (#515, #518)`, () => {
    for (const [screen, aspect] of [["16:9", 16 / 9], ["9:19.5", 9 / 19.5]]) for (const way of [path, [...path].reverse()]) {
      const f = walk(way, aspect), inside = f.filter((r) => r.in);
      assert.equal(inside.length, 0, `${screen}: in ${inside.length} of ${f.length} frames the eye stood deeper than ${EYE_EDGE} m in the grove, first with him at (${inside[0]?.at.map((v) => v.toFixed(2))}) and it at (${inside[0]?.c.map((v) => v.toFixed(2))})`);
      const over = f.filter((r, i) => i % 3 === 0 && culmBeforeHim(r, aspect)), n = Math.ceil(f.length / 3);
      if (process.env.GROVE_REPORT) console.log(`# culm over him: ${name} ${screen} ${way === path ? "there" : "back"}: ${over.length} of ${n} frames (${((over.length / n) * 100).toFixed(1)}%)${over[0] ? `, first with him at (${over[0].at.map((v) => v.toFixed(2))})` : ""}`);
      assert.ok(over.length <= 0.02 * n, `${screen}: a culm within 1 m of the eye stood over him in ${over.length} of ${n} frames, first with him at (${over[0]?.at.map((v) => v.toFixed(2))})`);
    }
  });
}

// The keep-out is the level's to say (an engine module imports no level): a level that gives none, T05's white box and the
// probe, keeps the eye exactly as it was, and its space is the space of what is drawn alone.
test("a level without a keep-out keeps the eye as it was: T05 and the probe give none, and their space asks only what is drawn (#515)", async () => {
  for (const id of ["t05", "_probe"]) {
    const lv = (await import(`../../app/levels/${id}/level.js`)).default;
    assert.equal(lv.eyeKeepOut, undefined, `${id} gives the eye a keep-out`);
  }
  const plain = createEyeSpace(drawn), none = createEyeSpace(drawn, undefined), kept = createEyeSpace(drawn, L.eyeKeepOut);
  let differ = 0, keptMore = 0;
  for (let i = 0; i < 400; i++) {
    const x = -40 + (i % 20) * 4.1, z = -130 + Math.floor(i / 20) * 11.3, y = walker.landAt(x, z) + 1.5;
    if (plain.shut(x, y, z) !== none.shut(x, y, z)) differ++;
    if (kept.shut(x, y, z) && !plain.shut(x, y, z)) keptMore++;
  }
  assert.equal(differ, 0, "a space made without a keep-out answers differently from one made before it existed");
  assert.ok(keptMore > 0, "the prologue's keep-out shut nothing more over the whole place: the comparison says nothing");
  // and no engine module imports a level to get one
  const fs = await import("node:fs"), src = new URL("../../app/src/", import.meta.url);
  for (const f of ["eyespace.js", "eye.js", "director.js", "opening.js"]) {
    const imports = fs.readFileSync(new URL(f, src), "utf8").split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
    assert.doesNotMatch(imports, /levels\/|GROVE/, `${f} imports a level or its grove`);
  }
});
