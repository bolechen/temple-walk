// Under a roof no snow lies (shelter.js): the floor of the gate's passage and the bell tower's platform stay bare stone,
// with only a strip blown in just under the eaves; the open court beside them is snow; and where the gate's upper roof
// hangs over its lower one, the lower roof's tiles are dry there and snowed on beyond it. His steps say the same.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../../app/src/site.js");
const { bakeShelter, shelterAt, SHELTER, BLOWN } = await import("../../app/src/shelter.js");
const { underfoot } = await import("../../app/src/steps.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), roofs = site.walk.roofs, map = bakeShelter(roofs);
const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
// The gate: the widest roof on the axis nearest the screen wall; its upper storey is the roof inside it, higher up.
const gate = roofs.filter((r) => r.x0 < 0 && r.x1 > 0).sort((a, b) => b.z1 - a.z1 || a.bottom - b.bottom)[0];
const upper = roofs.find((r) => r !== gate && r.x0 > gate.x0 && r.x1 < gate.x1 && r.z0 > gate.z0 && r.z1 < gate.z1 && r.bottom > gate.bottom);
const bell = roofs.find((r) => { const [bx, bz] = site.places.bell.at; return bx > r.x0 - 3 && bx < r.x1 + 3 && bz > r.z0 - 3 && bz < r.z1 + 3 && r.x0 > 5; });

test("the floor of the gate's passage and of the bell tower is dry, all of it but a strip under the eaves", () => {
  assert.ok(gate && upper && bell, "the gate, its upper storey or the bell tower was not found among the roofs");
  for (const [name, r] of [["gate", gate], ["bell tower", bell]]) {
    const [x, z] = mid(r);
    assert.equal(shelterAt(map, x, r.floor + 0.01, z), 1, `the middle of the ${name}'s floor takes snow`);
    // Everywhere more than the blown strip in from the eaves, the floor (and anything standing on it) is dry.
    for (let u = r.x0 + BLOWN[1] + 0.3; u < r.x1 - BLOWN[1] - 0.3; u += 0.5) for (let w = r.z0 + BLOWN[1] + 0.3; w < r.z1 - BLOWN[1] - 0.3; w += 0.5)
      assert.equal(shelterAt(map, u, r.floor + 0.01, w), 1, `snow on the ${name}'s floor at ${u.toFixed(1)}, ${w.toFixed(1)}`);
    // Just in from the edge of the footprint (about at the line of the tiles) the snow blows in.
    assert.ok(shelterAt(map, x, r.floor + 0.01, r.z1 - 0.2) < 0.05, `no snow blows in under the ${name}'s front eave`);
    assert.equal(shelterAt(map, x, r.floor + 0.01, r.z1 + 1), 0, `the ground before the ${name} is kept dry`);
  }
});

test("the gate's lower roof is dry where the upper one hangs over it and snowed on beyond, and the upper roof is open sky", () => {
  const y = (gate.bottom + upper.bottom) / 2, [, z] = mid(gate);
  assert.equal(shelterAt(map, 0, y, z), 1, "the lower roof's tiles under the upper eaves take snow");
  assert.equal(shelterAt(map, (gate.x1 + upper.x1) / 2, y, z), 0, "the lower roof's tiles out beyond the upper eaves are kept dry");
  assert.equal(shelterAt(map, 0, upper.bottom + 1, z), 0, "the upper roof is kept dry, as if a third roof were over it");
});

test("the first court inside the gate is under no roof", () => {
  for (let x = -8; x <= 8; x += 1) for (let z = 26; z < gate.z0 - 1; z += 1.5) assert.equal(shelterAt(map, x, 2, z), 0, `the court at ${x}, ${z} is sheltered`);
});

test("his steps under a roof in snow are on bare stone; out from under it, on snow", () => {
  const [x, z] = mid(bell);
  assert.equal(underfoot({ x, z, y: bell.floor, floor: "stone", snow: 1, wet: 0, roofed: shelterAt(map, x, bell.floor + 0.05, z) > 0.5 }), "stone");
  assert.equal(underfoot({ x, z: bell.z1 + 1, y: 0, floor: "path", snow: 1, wet: 0, roofed: shelterAt(map, x, 0.05, bell.z1 + 1) > 0.5 }), "snow");
});

test("the shader reads the map with the same reach of blown snow", () => {
  assert.ok(SHELTER.includes(`smoothstep(${BLOWN[0].toFixed(2)},${BLOWN[1].toFixed(2)}`));
});
