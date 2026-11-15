// The ink-stone pool on the approach: clear water standing a hand below its stone rim, and a stele facing the stair.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, APPROACH } = await import("../../app/src/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial({ name: k }))) });
const site = buildSite(M); site.root.updateMatrixWorld(true);
const water = site.root.getObjectByName("inkpool"), stele = site.root.getObjectByName("inkpool-stele");

test("the pool's water is its own clear material, below the rim and inside it", () => {
  assert.ok(water && water.material.name === "inkpool", "the pool is not drawn with its water");
  const w = new THREE.Box3().setFromObject(water), down = new THREE.Raycaster(new THREE.Vector3(w.max.x + 0.15, 50, (w.min.z + w.max.z) / 2), new THREE.Vector3(0, -1, 0));
  const rim = down.intersectObjects(site.root.children, true).find((h) => h.object !== water && h.object !== stele);
  assert.ok(rim && rim.point.y > w.max.y + 0.05, `the rim (${rim?.point.y.toFixed(2)}) does not stand above the water (${w.max.y.toFixed(2)})`);
});

test("the stele stands behind the pool on its plinth and faces back toward the stair", () => {
  assert.ok(stele, "no stele");
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(stele.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(n.x < -0.9, `it faces ${n.x.toFixed(2)}, ${n.z.toFixed(2)}, not west toward the landing`);
  const s = new THREE.Box3().setFromObject(stele), w = new THREE.Box3().setFromObject(water);
  assert.ok(s.min.x > w.max.x, "the stele stands in the water");
  assert.ok(s.min.y > w.max.y + 0.2 && s.max.y - s.min.y > 1, "the stele is not up on its plinth, or too small to read");
  assert.ok(Math.abs((s.min.z + s.max.z) / 2 - APPROACH.zMid) < 0.05, "the stele is not on the pool's middle");
});
