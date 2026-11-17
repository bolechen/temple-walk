// Nowhere he is put down by the game is in something that blocks him (#154): he walks out of a blocked spot only by being
// helped (route.js), so the game itself must never leave him in one. (A spot reached by a link's `?cam=` is another matter.)
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { buildSite, createWalker } = await import("../../app/src/site.js");
const { findDrop, dropPose } = await import("../../app/src/drop.js");
const M = new Proxy({}, { get(t, k) { return k === "plaster" || k === "interior" ? () => (t[k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial()); } });
const site = buildSite(M), walker = createWalker(site);

test("every hop down from every porch edge, from anywhere along it, lands in the open and ends there", () => {
  let hops = 0;
  for (const e of site.walk.drops) {
    const [nx, nz] = e.normal, ax = e.b[0] - e.a[0], az = e.b[1] - e.a[1], span = Math.hypot(ax, az);
    for (let along = 0.3; along <= span - 0.3; along += 0.05) for (let back = 0; back <= 0.6; back += 0.05) {
      const x = e.a[0] + (ax * along) / span - nx * back, z = e.a[1] + (az * along) / span - nz * back;
      if (walker.blocked(x, z)) continue;
      const plan = findDrop(walker, [e], x, z, nx, nz); if (!plan) continue; hops++;
      const end = dropPose(plan, plan.duration + 1);
      assert.ok(!walker.blocked(end.x, end.z), `a hop from (${x.toFixed(2)}, ${z.toFixed(2)}) lands at (${end.x.toFixed(2)}, ${end.z.toFixed(2)}), in something that blocks`);
    }
  }
  assert.ok(hops > 500, `only ${hops} hops tried`);
});

test("where he stands coming out of a hall, and at each place an observance is made, is open ground", () => {
  for (const h of site.halls) { assert.ok(!walker.blocked(h.out[0], h.out[1]), `coming out of ${h.name} he would stand in something that blocks`); }
  for (const [id, p] of Object.entries(site.places)) if (!p.room) assert.ok(!walker.blocked(p.at[0], p.at[1]), `the place ${id} is made from a blocked spot (${p.at})`);
});
