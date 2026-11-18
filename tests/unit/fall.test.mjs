// Leaves and petals have a source (#219): nothing falls 15 m from a maple or ginkgo (the bamboo start, the stair), it is
// denser than the old even cloud under one, and under a roof nothing falls.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../../app/src/site.js");
const { bakeShelter } = await import("../../app/src/shelter.js");
const { bakeFall, fallAt, fallFrom, SOURCES } = await import("../../app/src/fall.js");
const { KINDS, shown } = await import("../../app/src/drift.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), shelter = bakeShelter(site.walk.roofs);

for (const kind of ["leaf", "petal"]) {
  const map = bakeFall(site.trees, kind), own = site.trees.filter((t) => SOURCES[kind].includes(t[3]));
  test(`${kind}: no density 15 m or more from any ${SOURCES[kind].join("/")}`, () => {
    let far = 0;
    for (let x = -60; x <= 60; x += 1.5) for (let z = -90; z <= 100; z += 1.5) {
      if (own.some((t) => Math.hypot(x - t[0], z - t[2]) < 15)) continue;
      far++; assert.equal(fallAt(map, null, x, 5, z), 0, `${kind} falls at ${x}, ${z}`);
    }
    assert.ok(far > 1000);
    for (const v of ["cam01", "cam02", "stair", "halfway"]) { const [x, z] = site.views[v]; if (!own.some((t) => Math.hypot(x - t[0], z - t[2]) < 15)) assert.equal(fallAt(map, null, x, 5, z), 0, `${kind} falls at ${v}`); }
  });
  test(`${kind}: thickest under a tree, and thicker than the old even cloud`, () => {
    for (const [x, , z] of own) { assert.equal(fallFrom(own, kind, x, z), 1); assert.ok(shown(kind, 1) > KINDS[kind].part * 1.5, "no denser under a tree"); }
    assert.equal(shown(kind, 0), 0);
  });
}

test("the bamboo start and the stair are far from every maple and ginkgo", () => {
  for (const v of ["cam01", "cam02"]) { const [x, z] = site.views[v]; for (const t of site.trees.filter((t) => t[3] !== "cedar")) assert.ok(Math.hypot(x - t[0], z - t[2]) >= 15, `${v} is within 15 m of a ${t[3]}`); }
});

test("under the great hall's front eave nothing falls, in the open court under a maple it does", () => {
  const map = bakeFall(site.trees, "leaf"), roofs = site.walk.roofs;
  const hall = roofs.find((r) => r.x0 < -17 && r.x1 > 17 && r.z0 < -26);
  assert.ok(hall, "the great hall's roof was not found");
  const x = -4, z = hall.z1 - 1.8, y = hall.floor + 1;
  assert.ok(fallAt(map, null, x, y, z) > 0.05, "the eave is out of the maples' reach, which makes this test empty");
  assert.equal(fallAt(map, shelter, x, y, z), 0, "leaves fall under the great hall's eave");
  const [cx, cz] = [-9.5, 28]; assert.ok(fallAt(map, shelter, cx + 1, 3, cz + 1) > 0.9, "leaves do not fall under the maple in the first court");
});
