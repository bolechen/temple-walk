// Five faults of form that showed once he could walk everywhere (#274's survey, #288): a wall's tiled roof open at its end, a
// gate whose passage has no ceiling, the gate's back coping standing out over its top step, a young evergreen's boughs reached
// from a place he could stand, and the picture-cards of the grove within sight of a hall's platform. Each is held where it was found.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { levelPlan, L } from "./level-plan.mjs";
import { createBackdrop } from "../../app/src/backdrop.js";
import { SITE } from "../../app/src/site.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const { site, walker } = await levelPlan(M);
site.root.updateMatrixWorld(true);

test("every wall's tiled roof is shut at both ends: only its two lower rims are open edges", () => {
  const caps = site.root.children.filter((o) => o.isMesh && o.material.name === "tile");
  assert.ok(caps.length, "the walls' roofs are a mesh of their own");
  const bad = [];
  for (const m of caps) {
    const p = m.geometry.attributes.position, idx = m.geometry.index.array, key = (i) => [p.getX(i), p.getY(i), p.getZ(i)].map((v) => v.toFixed(4)).join(","), edges = new Map();
    for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = idx[t + k], b = idx[t + (k + 1) % 3], ka = key(a), kb = key(b), e = ka < kb ? ka + "|" + kb : kb + "|" + ka;
      edges.set(e, { n: (edges.get(e)?.n || 0) + 1, dy: Math.abs(p.getY(a) - p.getY(b)), at: ka });
    }
    for (const e of edges.values()) if (e.n === 1 && e.dy > 1e-4) bad.push(e.at);   // a sloped edge with one face is the open end of a roof
  }
  assert.deepEqual(bad, [], "ends of a wall's roof left open at these points");
});

test("every end of the summit's low wall shows a tile face to the stair head, not a hollow", () => {
  // The first fault: at the head of the summit's stair he stands level with the end of the wall's roof (x = -2.5).
  const [roof] = site.root.children.filter((o) => o.isMesh && o.material.name === "tile"), ray = new THREE.Raycaster();
  let seen = 0;
  for (const sx of [-1, 1]) {
    const pts = [];
    roof.geometry.attributes.position.array.forEach((v, i, a) => { if (i % 3 === 0 && Math.abs(Math.abs(v) - 2.5) < 5e-3 && a[i + 2] < -110 && a[i + 2] > -125) pts.push([v, a[i + 1], a[i + 2]]); });
    if (!pts.length) continue;
    const [x, , z] = pts.find((q) => Math.sign(q[0]) === sx) || [];
    if (x === undefined) continue;
    const yy = Math.max(...pts.map((q) => q[1])) - 0.15;
    ray.set(new THREE.Vector3(x - sx * 0.9, yy, z), new THREE.Vector3(sx, 0, 0));
    const hit = ray.intersectObject(roof, false).find((h) => h.distance < 1.2);
    assert.ok(hit, `a ray along the wall's line from the stair head meets its roof end at x ${x}`);
    assert.ok(hit.face.normal.clone().transformDirection(roof.matrixWorld).x * -sx > 0.5, "and that end faces him");
    seen++;
  }
  assert.ok(seen >= 1, "found a wall end beside the summit's stair");
});

test("the gate's passage has a ceiling: looking up from the way through meets boards before the roof's bare underside", () => {
  const ray = new THREE.Raycaster();
  for (const x of [-1.5, 0, 1.5]) for (const z of [SITE.zS - 2, SITE.zS, SITE.zS + 2]) {
    ray.set(new THREE.Vector3(x, 1.7, z), new THREE.Vector3(0, 1, 0));
    const names = ray.intersectObject(site.root, true).map((h) => h.object.material?.name), ceiling = names.indexOf("passage"), roof = names.findIndex((n) => n === "rafters" || n === "tile");
    assert.ok(ceiling >= 0 && (roof < 0 || ceiling < roof), `above (${x}, ${z}) the passage's boards come before the roof (${names.join(", ")})`);
  }
});

test("the gate's back coping stops at its stair: nothing stands out over the top step", () => {
  const gate = site.root.children.find((g) => Math.abs(g.position.x) < 0.01 && Math.abs(g.position.z - SITE.zS) < 0.01 && g.userData.flights?.length);
  assert.ok(gate, "found the gate's lower storey");
  const platH = gate.userData.flights[0].rise, ray = new THREE.Raycaster();
  // The back stair's head is where its top tread begins: the nearest z, going north from the middle, at which looking down meets a tread at the platform's height.
  let head = null;
  for (let z = SITE.zS - 0.5; z > SITE.zS - 8 && head === null; z -= 0.005) {
    ray.set(new THREE.Vector3(0, platH + 1, z), new THREE.Vector3(0, -1, 0));
    const h = ray.intersectObject(gate, true).find((q) => q.object.material.name === "steps");   // (the tread itself, whatever lies over it)
    if (h && Math.abs(h.point.y - platH) < 0.02) head = z;
  }
  assert.ok(head !== null, "the back stair's top tread is found");
  for (const dz of [0.01, 0.03, 0.05, 0.065]) for (const x of [-1.5, 0, 1.5]) {
    ray.set(new THREE.Vector3(x, platH + 1, head - dz), new THREE.Vector3(0, -1, 0));
    const first = ray.intersectObject(gate, true).find((q) => q.object.material.name !== "dark");
    assert.equal(first?.object.material.name, "steps", `${dz} m over the top step at x ${x}: what is above it? (${first?.object.material.name})`);
  }
});

test("a young evergreen's boughs are out of reach: he cannot stand where his eye would be among them, and can stand just beyond", () => {
  const young = site.cedars.filter(([, , , , h, far]) => !far && h < 8);
  assert.ok(young.length >= 2, "the pair before the great hall");
  for (const [x, , z, , h] of young) {
    // Shut to the baked floor (site.closed) as a circle round the trunk (#531: it was a 3 m square), out past the 0.95 m where the eye is among the boughs...
    const c = site.closed.find((c) => c.r !== undefined && Math.hypot(c.x - x, c.z - z) < 0.01);
    assert.ok(c && c.r >= 1.2 && c.r <= 1.35, `the ${h} m evergreen at (${x}, ${z}) is shut by a circle of about 1.25 m (the following eye is among its sprays at 1.0): ${JSON.stringify(c)}`);
    // ...and whichever walker answers, 0.95 m from the trunk is no place to stand (boughs start at 1.35 m and the eye is at 1.6).
    for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) { const dx = Math.cos((a * Math.PI) / 180) * 0.95, dz = Math.sin((a * Math.PI) / 180) * 0.95; assert.ok(walker.blocked(x + dx, z + dz), `0.95 m from the trunk at (${x}, ${z}), bearing ${a}, is no place to stand`); }
    // On the baked floor the shut ground ends where the eye is clear of them: the corner a square would have kept him out of is open (1.1 m either way, 1.56 m out at 45°: shut by the old square 1.5 m a side).
    if (walker.kind === "grid") for (const [dx, dz] of [[1.1, 1.1], [-1.1, 1.1], [1.1, -1.1], [-1.1, -1.1]]) assert.ok(!walker.blocked(x + dx, z + dz), `at the corner (${dx}, ${dz}) from the trunk of the evergreen at (${x}, ${z}) he may stand`);
  }
});

test("the picture-cards of the grove stand 10 m or more beyond the courts' walls (a hall's platform looks over a 3 m wall)", () => {
  // The side bands of the grove (backdrop.js) are flat cards; from a platform the eye is over the wall, and a card within 5 m of it shows its torn edge.
  const scene = new THREE.Scene();
  createBackdrop(scene, M, L.backdrop.site, L.backdrop.terraces, L.land);
  scene.updateMatrixWorld(true);
  const near = [];
  scene.traverse((o) => {
    if (!(o.isMesh && o.material.uniforms?.uSeed)) return;
    const along = Math.abs(Math.sin(o.rotation.y)) > 0.99;   // a band that runs north and south, beside the courts
    if (along && Math.abs(o.position.z - 40) < 150 && Math.abs(o.position.x) < SITE.x + 60 && Math.abs(o.position.x) < SITE.x + 10) near.push([+o.position.x.toFixed(1), +o.position.z.toFixed(1)]);
  });
  assert.deepEqual(near, [], "bands nearer than 10 m beyond the wall");
});

test("the gate's ceiling is out of the baked floor but in the eye's space, so the camera cannot back out of the doorway through it", async () => {
  // It moved the library's cells in the floor (not run to ground), and it is overhead; but the eye must keep out of it.
  const { gatherEye } = await import("../../app/src/eyegather.js"), { gather } = await import("../../tools/walk/bake.mjs");
  const box = { x0: -10, x1: 10, z0: SITE.zS - 4, z1: SITE.zS + 4 };
  const names = new Set(gather([site.root], { ...box, bottom: -1, top: 12 }).names);
  assert.ok(!names.has("passage"), "the floor's bake takes the ceiling");
  const scene = new THREE.Group(); site.root.userData.part = "site"; scene.add(site.root); scene.updateMatrixWorld(true);
  const it = gatherEye(scene, { ...box, y0: -1, y1: 12 }); let r = it.next(); while (!r.done) r = it.next();
  const t = r.value; let ceiling = 0;
  for (let i = 0; i < t.length; i += 9) if (Math.abs(t[i + 1] - 4.88) < 0.04 && Math.abs(t[i + 4] - 4.88) < 0.04 && Math.abs(t[i + 7] - 4.88) < 0.04 && Math.abs(t[i]) < 9.7) ceiling++;
  assert.ok(ceiling >= 20, `the eye's space holds the ceiling's boards: ${ceiling} triangles at 4.88 m under the gate`);
});
