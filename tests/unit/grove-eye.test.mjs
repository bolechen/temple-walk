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

// What the bamboo is drawn of (culms and sprays), grown as the page grows it, to look along the lines from the eye to him.
const { createBamboo } = await import("../../app/src/bamboo.js"), { terrain } = await import("../../app/src/site.js"), { EYE_EDGE } = await import("../../app/levels/t00/level.js");
const groveScene = new THREE.Scene(); createBamboo(groveScene, GROVE.areas, terrain, GROVE.keep, { fine: true }); groveScene.updateMatrixWorld(true);
const [culms] = groveScene.children, rc = new THREE.Raycaster();
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
      out.push({ at: [x, z], c, in: L.eyeKeepOut(c[0], c[1], c[2]) });
    }
  }
  return out;
}
const groveRoutes = isPrologue ? need("grove").routes(site, walker) : {};
for (const [name, path] of Object.entries(groveRoutes)) {
  test(`${name}, there and back: the eye keeps out of the grove but for its edge (#515)`, () => {
    for (const [screen, aspect] of [["16:9", 16 / 9], ["9:19.5", 9 / 19.5]]) for (const way of [path, [...path].reverse()]) {
      const f = walk(way, aspect), inside = f.filter((r) => r.in);
      assert.equal(inside.length, 0, `${screen}: in ${inside.length} of ${f.length} frames the eye stood deeper than ${EYE_EDGE} m in the grove, first with him at (${inside[0]?.at.map((v) => v.toFixed(2))}) and it at (${inside[0]?.c.map((v) => v.toFixed(2))})`);
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
