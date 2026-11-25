// T05's grown trees (app/levels/t05/flora.js): the pines, cypresses, pagoda trees and poplars inside and outside the walls. The same seed grows
// the same tree point for point (the page grows them again and the `t05-treeseed` scenario compares its fingerprint with Node's); no tree stands
// over the ceiling its place was given; the axis's crowns stay inside the ellipsoids the views along it are cleared against; and the whole is held
// to a budget of triangles and draws.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { createMaterials } = await import("../../app/src/materials.js");
const { growTree, buildFlora, floraHash, KINDS } = await import("../../app/levels/t05/flora.js");
const { buildSite, COURT_TREES, COMPOUND } = await import("../../app/levels/t05/site.js");
const { AXIS_TREES, TRUNKS, treeBlocks, SIGHTS } = await import("../../app/levels/t05/axis.js");
const { planSurround, eaveCap, growKind, LIMITS } = await import("../../app/levels/t05/surround.js");

const M = createMaterials(), site = buildSite(M);

test("the same tree twice is the same tree, to a tenth of a millimetre; a tree elsewhere is another", () => {
  for (const kind of Object.keys(KINDS)) for (const far of [false, true]) {
    const t = { kind, x: 31.3, z: 12.7, h: 10, r: 0.38 }, a = growTree(t, far), b = growTree(t, far), c = growTree({ ...t, x: 33.1 }, far);
    const fa = floraHash([a.trunk, a.wood, ...a.needles]), fb = floraHash([b.trunk, b.wood, ...b.needles]), fc = floraHash([c.trunk, c.wood, ...c.needles]);
    assert.equal(fa, fb, `${kind} (${far ? "far" : "near"}) grows the same twice`);
    assert.notEqual(fa, fc, `${kind} (${far ? "far" : "near"}) grows differently a little further on`);
  }
  const again = buildSite(createMaterials());
  assert.deepEqual(again.flora.census.map((c) => c.hash), site.flora.census.map((c) => c.hash), "the whole place grows the same trees on a second build");
  assert.equal(typeof globalThis.__flora, "function", "the page can be asked what it grew"); assert.equal(globalThis.__flora().inner.hash, again.flora.inner.hash);
});

test("every tree of the plan is grown, each of its kind: the court's four, the axis's fourteen, the town's 151", () => {
  const plan = planSurround(COMPOUND), census = site.flora.census;
  assert.equal(census.length, COURT_TREES.length + AXIS_TREES.length + plan.trees.length);
  const kinds = new Set(census.map((c) => c.kind)); for (const k of Object.keys(KINDS)) assert.ok(kinds.has(k), `${KINDS[k]} grows`);
  assert.ok(AXIS_TREES.filter((t) => t.y === 0).every((t) => t.kind === "cypress"), "the way between the gates is lined with cypresses");
  for (const t of plan.trees) assert.equal(growKind(t), t.kind === "bare" ? growKind(t) : t.kind, "a pine stays a pine, a cypress a cypress");
  assert.ok(plan.trees.filter((t) => t.kind === "bare").every((t) => ["huai", "poplar"].includes(growKind(t))), "a bare broadleaf is a pagoda tree or a poplar");
});

test("no tree stands over its height: the plan's (the eave line in cam01 and cam07, 13 m, 10 m beside the hall), the court's under the eave line too", () => {
  for (const c of site.flora.census) assert.ok(c.top <= c.h + 1e-6, `the ${c.kind} at (${c.at}) reaches ${c.top} m, over its ${c.h} m`);
  for (const t of COURT_TREES) assert.ok(Math.min(t.h, eaveCap(t.x, t.z)) <= LIMITS.treeMax, "the court's trees keep to the town's ceiling");
});

test("an axis tree's boughs and needles stay inside its ellipsoid, and its trunk inside the upright post the views are cleared against", () => {
  for (const t of AXIS_TREES) {
    const g = growTree(t), c = new THREE.Vector3(t.x, t.y + t.env.base + t.env.ry, t.z), p = new THREE.Vector3();
    for (const geo of [g.wood, ...g.needles]) { const A = geo.attributes.position; for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i); const e = Math.hypot((p.x - c.x) / t.env.rx, (p.y - c.y) / t.env.ry, (p.z - c.z) / t.env.rx); assert.ok(e <= 1.0001, `a point of the tree at (${t.x}, ${t.z}) is out of its ellipsoid (${e.toFixed(3)})`); } }
    const A = g.trunk.attributes.position; for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i); if (p.y > t.y + 1.2 && p.y < t.y + TRUNKS.h) assert.ok(Math.hypot(p.x - t.x, p.z - t.z) <= t.r + 1e-6, `the trunk at (${t.x}, ${t.z}) leaves its post at ${p.y.toFixed(2)} m`); }
  }
  // and so treeBlocks, which the cam07 tests ask, still bounds them
  const blocked = []; for (const l of SIGHTS.lines) for (const t of TRUNKS.list) if (treeBlocks(SIGHTS.eye, l.to, t)) blocked.push(l.kind);
  assert.deepEqual(blocked, []);
});

test("what he meets of a tree is its trunk only: boughs and needles are out of the bake and the eye, and nothing of the town's trees is", () => {
  let trunks = 0;
  site.root.traverse((o) => {
    if (!o.isMesh || !/(^|-)trees-/.test(o.name)) return;
    if (/-trunks$/.test(o.name)) { trunks++; assert.notEqual(o.userData.walk, false, `${o.name} is in his way`); assert.ok(!o.userData.surround); }
    else assert.equal(o.userData.walk, false, `${o.name} is over his head or outside the walls`);
    assert.ok(o.userData.keep, `${o.name} is merged already and kept out of the static merge`);
  });
  assert.ok(trunks >= 1);
});

test("a budget: under 300 000 triangles of trees in the whole place, in under 30 meshes, merged by stretch so that only what is in view is drawn", () => {
  let tris = 0, meshes = 0;
  site.root.traverse((o) => { if (o.isMesh && /(^|-)trees-/.test(o.name)) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  console.log(`# T05 trees: ${Math.round(tris)} triangles in ${meshes} meshes`);
  assert.ok(tris < 300000, `${tris} triangles`); assert.ok(meshes < 30, `${meshes} meshes`);
  const one = buildFlora(M, [{ kind: "pine", x: 0, z: 0, h: 10 }]); assert.ok(one.group.children.length <= 2, "one tree's wood and needles in a draw each");
});
