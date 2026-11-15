// A wall's tiled cap sits on the wall: seen from the side, nothing may show through between the top of the plaster
// and the underside of the tiles (the summit's low wall was once drawn with its cap floating above it, sky and
// trees in the slit). The screen wall's eaves hang below its top, so it is held to the same rule as a guard.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, SCREEN, LEVELS } from "../../app/src/site.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), { name: String(k) });   // the tiles are seen from both sides
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M);
site.root.updateMatrixWorld(true);
const meshes = []; site.root.traverse((o) => o.isMesh && meshes.push(o));
const ray = new THREE.Raycaster();

// Shoot rays along z through a wall that runs along x at `zWall`, at heights from its top up to its cap's ridge.
function seeThrough(x, zWall, y0, y1) {
  const gaps = [];
  for (let y = y0; y <= y1 + 1e-9; y += 0.02) {
    ray.set(new THREE.Vector3(x, y, zWall + 3), new THREE.Vector3(0, 0, -1)); ray.far = 6;
    const hit = ray.intersectObjects(meshes, false).find((h) => h.point.z < zWall + 1.0 && h.point.z > zWall - 1.0);
    if (!hit) gaps.push(+y.toFixed(2));
  }
  return gaps;
}

test("the summit's low wall has no slit between its plaster and its tiles", () => {
  const top = LEVELS[2], zS = top.zS;
  for (const x of [5, 8, 11]) assert.deepEqual(seeThrough(x, zS, top.y + 1.15 + 0.01, top.y + 1.15 + 0.4), [], `see-through at x=${x}`);
});

test("the screen wall has no slit between its plaster and its tiles", () => {
  for (const x of [-4, 3.5]) assert.deepEqual(seeThrough(x, SCREEN.z, SCREEN.h + 0.01, SCREEN.h + 0.2), [], `see-through at x=${x}`);
});
