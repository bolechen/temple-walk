// The ground lays the court's paving (with the mirror) and then each terrace's, and lights each of them by the lamps above
// it (ground.js setLamps). #414's review found the court's own layer dropped by a comment that swallowed its line: the
// court then took no lamplight at night. Here, for the prologue and for T05 (which has no censer), the court comes first.
import "./dom-stub.mjs";
import test from "node:test"; import assert from "node:assert/strict"; import * as THREE from "three";
const { createGround } = await import("../../app/src/ground.js");
const T00 = await import("../../app/src/site.js?real");
const T05 = await import("../../app/levels/t05/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });

test("the court's paving is the first layer, and every terrace's follows it", () => {
  for (const [name, plan] of [["t00", T00], ["t05", T05]]) {
    const site = plan.buildSite(M), g = createGround(new THREE.Scene(), site.shade, site.censer, site.paving);
    assert.deepEqual(g.layers(), [0, ...site.paving.map((p) => p.y)], name);
  }
});
