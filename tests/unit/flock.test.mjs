// The birds the bell's third stroke sends up: from the tall trees by the bell tower, up and away from it, and gone.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../../app/src/site.js");
const { createFlock, FLOCK } = await import("../../app/src/flock.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), bell = site.places.bell.at;

test("the birds go up from the old trees near the bell, away from it, and are gone within their time", () => {
  const scene = new THREE.Scene(), f = createFlock(scene, site.cedars, bell);
  assert.ok(f.state().roosts >= 1, "no tall tree near the bell tower to roost in");
  assert.equal(f.mesh.visible, false, "nothing is flying before the bell");
  assert.ok(f.flush());
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), start = [];
  f.update(0.7, 0); for (let i = 0; i < FLOCK.count; i++) { f.mesh.getMatrixAt(i, m); start.push(p.setFromMatrixPosition(m).clone()); }
  for (let t = 0.7; t < 3; t += 0.1) f.update(0.1, t);
  let away = 0, up = 0;
  for (let i = 0; i < FLOCK.count; i++) {
    f.mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m);
    if (Math.hypot(p.x - bell[0], p.z - bell[1]) > Math.hypot(start[i].x - bell[0], start[i].z - bell[1])) away++;
    if (p.y > start[i].y + 1) up++;
  }
  assert.ok(away >= FLOCK.count - 1 && up >= FLOCK.count - 1, `the birds should go up and away from the bell: ${away} away, ${up} up of ${FLOCK.count}`);
  assert.ok(f.state().flying && f.state().climbed > 3, "they should have climbed well above their trees: " + JSON.stringify(f.state()));
  for (let t = 3; t < FLOCK.life + 1; t += 0.2) f.update(0.2, t);
  assert.ok(!f.mesh.visible && !f.state().flying, "the birds should be gone after their time");
  assert.equal(f.state().flights, 1);
});
