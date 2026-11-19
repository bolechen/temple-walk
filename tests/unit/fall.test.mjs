// Leaves and petals have a source (#219): nothing falls 15 m from a maple or ginkgo (the bamboo start, the stair), it is
// denser than the old even cloud under one, and under a roof nothing falls.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, GROVE } = await import("../../app/src/site.js");
const { bakeShelter } = await import("../../app/src/shelter.js");
const { bakeFall, fallAt, fallFrom, SOURCES } = await import("../../app/src/fall.js");
const { KINDS, shown } = await import("../../app/src/drift.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), shelter = bakeShelter(site.walk.roofs);

for (const kind of ["leaf", "petal"]) {
  const map = bakeFall(site.trees, GROVE.areas), own = site.trees.filter((t) => SOURCES[kind].includes(t[3]));
  test(`${kind}: no density 15 m or more from any ${SOURCES[kind].join("/")}`, () => {
    let far = 0;
    for (let x = -60; x <= 60; x += 1.5) for (let z = -90; z <= 100; z += 1.5) {
      if (own.some((t) => Math.hypot(x - t[0], z - t[2]) < 15)) continue;
      far++; assert.equal(fallAt(map, kind, null, x, 5, z), 0, `${kind} falls at ${x}, ${z}`);
    }
    assert.ok(far > 1000);
    for (const v of ["cam01", "cam02", "stair", "halfway"]) { const [x, z] = site.views[v]; if (!own.some((t) => Math.hypot(x - t[0], z - t[2]) < 15)) assert.equal(fallAt(map, kind, null, x, 5, z), 0, `${kind} falls at ${v}`); }
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
  const map = bakeFall(site.trees, GROVE.areas), roofs = site.walk.roofs;
  const hall = roofs.find((r) => r.x0 < -17 && r.x1 > 17 && r.z0 < -26);
  assert.ok(hall, "the great hall's roof was not found");
  const x = -4, z = hall.z1 - 1.8, y = hall.floor + 1;
  assert.ok(fallAt(map, "leaf", null, x, y, z) > 0.05, "the eave is out of the maples' reach, which makes this test empty");
  assert.equal(fallAt(map, "leaf", shelter, x, y, z), 0, "leaves fall under the great hall's eave");
  const [cx, cz] = [-9.5, 28]; assert.ok(fallAt(map, "leaf", shelter, cx + 1, 3, cz + 1) > 0.9, "leaves do not fall under the maple in the first court");
});

// ---- Landing, resting, fading (#219, acceptance 2) and the grove's own leaves ----
const { createWalker } = await import("../../app/src/site.js");
const { leafAt, groundAt, LAND, NO_GROUND, PER_M, bambooFrom } = await import("../../app/src/fall.js");
const walker = createWalker(site), gmap = bakeFall(site.trees, GROVE.areas, (x, z) => walker.landAt(x, z));
const seeds = (n) => { let a = 12345; const r = () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296; return Array.from({ length: n }, () => [r(), r(), r(), r()].map(Math.fround)); };

// (Since #267 only the grove's narrow leaves lie and fade; a tree's leaf is handed to the ground, litter.test.mjs.)
test("200 bamboo leaves tracked to the ground: they lie within 5 cm of it for at least 3 s, then fade, and never go through it", () => {
  const cfg = { fall: 0.4, sway: 1.3, bamboo: true }; let tracked = 0;
  for (const s of seeds(4000)) {
    const L0 = leafAt(gmap, s, 100, cfg); if (!L0.live) continue;
    let restFor = 0, worst = 0, fading = false, minY = Infinity; const P = L0.P;
    // one whole cycle: the cycle number is fixed from t0 by starting at a cycle's beginning
    const t0 = 100 - L0.ph; let prevAlpha = 0, prev = null;
    for (let t = t0 + 0.02; t < t0 + P - 0.02; t += 0.05) {
      const L = leafAt(gmap, s, t, cfg), g = groundAt(gmap, L.bx, L.bz);
      assert.ok(L.y >= g + LAND.LIE - 1e-9, "a leaf went through the ground");
      minY = Math.min(minY, L.y - g);
      if (L.rest) { restFor += 0.05; worst = Math.max(worst, Math.abs(L.y - g)); assert.ok(prev === null || Math.hypot(L.x - prev.x, L.z - prev.z) < 1e-9, "a leaf on the ground moved"); if (L.alpha < 1) fading = true; prev = L; }
      prevAlpha = L.alpha;
    }
    assert.ok(restFor >= 3, `a leaf rested only ${restFor.toFixed(2)} s`);
    assert.ok(worst <= 0.05, `a leaf lay ${worst} m from the ground`);
    assert.ok(fading, "a leaf did not fade after resting");
    if (++tracked >= 200) break;
  }
  assert.equal(tracked, 200, "fewer than 200 leaves fall anywhere on the map");
});

test("a tree's leaf comes down onto the ground, never through it, and is gone from the air within SETTLE", () => {
  const cfg = { fall: 0.75, sway: 1.0 }; let tracked = 0;
  for (const s of seeds(4000)) {
    const L0 = leafAt(gmap, s, 100, cfg); if (!L0.live) continue;
    const t0 = 100 - L0.ph;
    for (let t = t0 + 0.02; t < t0 + L0.P - 0.02; t += 0.05) { const L = leafAt(gmap, s, t, cfg); assert.ok(L.y >= groundAt(gmap, L.bx, L.bz) + LAND.LIE - 1e-9, "a leaf went through the ground"); if (L.rest) assert.ok(L.ph - L.Tf <= LAND.SETTLE + 1e-9); }
    assert.ok(Math.abs(L0.P - L0.Tf - LAND.SETTLE) < 1e-9);
    if (++tracked >= 200) break;
  }
  assert.equal(tracked, 200);
});

test("the ground under the leaves is the walker's: the stair's treads, the court's paving, the terraces", () => {
  const spots = [[0, 29], [-9.5, 28], [9, 8.5], [-11.5, 3.5], ...Object.values(site.views).filter((v) => Math.abs(v[0]) < 25 && v[1] > -40 && v[1] < 66).map((v) => [v[0], v[1]])];
  for (const [x, z] of spots) assert.ok(Math.abs(groundAt(gmap, x, z) - walker.landAt((Math.floor(x * PER_M) + 0.5) / PER_M, (Math.floor(z * PER_M) + 0.5) / PER_M)) < 1e-6);
});

test("the grove's leaves come only from the grove, and the maples' none from it", () => {
  const far = (x, z) => !GROVE.areas.some((a) => Math.hypot(Math.max(a.x0 - x, 0, x - a.x1), Math.max(a.z0 - z, 0, z - a.z1)) < 5);
  let n = 0; for (let x = -60; x <= 60; x += 2) for (let z = -90; z <= 120; z += 2) if (far(x, z)) { n++; assert.equal(fallAt(gmap, "bamboo", null, x, 3, z), 0, `bamboo leaves fall at ${x}, ${z}`); }
  assert.ok(n > 500);
  const [x, z] = site.views.cam01; assert.equal(fallAt(gmap, "bamboo", null, x, 3, z), 1); assert.equal(bambooFrom(GROVE.areas, x, z), 1);
  assert.equal(fallAt(gmap, "leaf", null, x, 3, z), 0, "red leaves fall in the bamboo");
});

test("under the crown the cloud shows far more than the old even share", () => {
  assert.ok(shown("leaf", 1) >= KINDS.leaf.part * 2.2 && shown("petal", 1) >= KINDS.petal.part * 2.2);
});
