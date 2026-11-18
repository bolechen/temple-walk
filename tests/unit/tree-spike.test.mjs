import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
// #162, second round: the court maple's two lowest orders of wood are drawn to the structure review's table (#186),
// the rest grown by three's TreeGenerator from them. These read the skeleton the trial reports and hold it to the table.
const { buildSite } = await import("../../app/src/site.js");
const { createTrees } = await import("../../app/src/trees.js");
const { grow } = await import("../../app/src/spike/gens.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), court = site.trees.find((t) => t[3] === "maple" && t[0] === -9.5 && t[2] === 28);
// the court maple as the page grows it, and the same tree from other seeds, so the table holds for more than one draw
const trees = [7, 3, 9, 21, 40].map((seed) => ({ seed, t: grow("three", "maple", 0, 0, 0, court[4], seed, 0.22) }));
const size = (t) => { const b = new THREE.Box3(); for (const w of t.wood) { w.computeBoundingBox(); b.union(w.boundingBox); } for (const l of t.leaves) b.expandByPoint(l.p.clone().add(new THREE.Vector3(0, 0.5, 0))); const s = b.getSize(new THREE.Vector3()); return { h: b.max.y, w: Math.max(s.x, s.z) }; };

test("the court maple's lowest limb leaves at 0.8-1.5 m, its trunk is 0.2-0.3 m across at 0.3 m, and the tree is 3-7.5 m tall", () => {
  for (const { seed, t } of trees) { const k = t.skeleton, s = size(t);
    assert.ok(k, `seed ${seed}: no skeleton reported`);
    assert.ok(k.forkHeight >= 0.8 && k.forkHeight <= 1.5, `seed ${seed}: divides at ${k.forkHeight.toFixed(2)} m`);
    assert.ok(k.trunkD03 >= 0.2 && k.trunkD03 <= 0.3, `seed ${seed}: ${k.trunkD03.toFixed(3)} m across at 0.3 m`);
    assert.ok(s.h >= 3 && s.h <= 7.5, `seed ${seed}: ${s.h.toFixed(2)} m tall`); }
});
test("its crown is as broad as it is tall or a little more: width over height 1.0-1.3", () => {
  for (const { seed, t } of trees) { const s = size(t); assert.ok(s.w / s.h >= 1.0 && s.w / s.h <= 1.3, `seed ${seed}: ${s.w.toFixed(2)} m wide, ${s.h.toFixed(2)} m tall (${(s.w / s.h).toFixed(2)})`); }
});
test("three to five great limbs, leaving the trunk one above another between 1.2 and 2.2 m, each 0.45-0.6 of its radius there, leaning 40-65 degrees from upright, in two or three tiers", () => {
  for (const { seed, t } of trees) { const k = t.skeleton;
    assert.ok(k.limbs.length >= 3 && k.limbs.length <= 5, `seed ${seed}: ${k.limbs.length} limbs`);
    const starts = k.limbs.map((l) => l.start).sort((p, q) => p - q);
    assert.ok(starts[0] >= 1.2 && starts[starts.length - 1] <= 2.2, `seed ${seed}: limbs leave at ${starts.map((y) => y.toFixed(2)).join(", ")} m`);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 0.05, `seed ${seed}: two limbs leave within 5 cm of each other`);
    for (const l of k.limbs) { if (!l.leader) assert.ok(l.ratio >= 0.45 && l.ratio <= 0.6, `seed ${seed}: a limb ${l.ratio.toFixed(2)} of the trunk`); assert.ok(l.angle >= 40 && l.angle <= 65, `seed ${seed}: a limb ${l.angle.toFixed(0)} degrees from upright`); }
    assert.equal(k.limbs.filter((l) => l.leader).length, 1, `seed ${seed}: the trunk should end as one of the limbs, not as a stump`);
    assert.ok(k.tiers >= 2 && k.tiers <= 3, `seed ${seed}: ${k.tiers} tiers`); }
});
test("at every fork of the maple, trunk to limbs and all the generator grew, the children carry 0.8-1.2 of the parent's wood", () => {
  for (const { seed, t } of trees) { const k = t.skeleton;
    for (const f of k.trunkForks) assert.ok(f >= 0.8 && f <= 1.2, `seed ${seed}: a limb and the trunk going on carry ${f.toFixed(2)} of the trunk below`);
    assert.ok(k.forks.length > 30, `seed ${seed}: only ${k.forks.length} forks reported`);
    const off = k.forks.filter((r) => r < 0.8 || r > 1.2); assert.deepEqual(off.map((r) => r.toFixed(2)).slice(0, 6), [], `seed ${seed}: ${off.length} forks out of balance`); }
});
test("the maple's wood stays under 8,000 triangles, and the page's court maple is the one measured here", () => {
  for (const { seed, t } of trees) { const n = t.wood.reduce((a, g) => a + (g.index ? g.index.count : g.attributes.position.count) / 3, 0); assert.ok(n <= 8000, `seed ${seed}: ${n} triangles of wood`); }
  const T = createTrees(new THREE.Group(), M, [court], { gen: "three" }); assert.equal(T.spike.length, 1); assert.ok(T.spike[0].skeleton && T.spike[0].skeleton.limbs.length >= 3);
});
