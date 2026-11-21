// Below the horizon there is land, wood or fog, never a strip of sky (#114). From every place a visitor can stand
// that this test samples, rays are cast all round, between the horizon and ten degrees under it, against the land and
// the three ranges of hills (the bamboo bands have leaf gaps and are not counted: what shows through them is what is
// being tested). The first opaque thing must exist; sky is what is left when none does.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { L, LEVEL_ID, need } from "./level-plan.mjs";
import { createBackdrop } from "../../app/src/backdrop.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (t[k] ||= named(k)) });
const scene = new THREE.Scene();
// A level with no far hills has no horizon to hold: its `backdrop` is null, and these tests have nothing to look at.
if (L.backdrop) createBackdrop(scene, M, L.backdrop.site, L.backdrop.terraces, L.land);
scene.updateMatrixWorld(true);
// The bamboo bands are the only ShaderMaterials with a transparent-by-discard fragment: they carry uSeed.
const solid = []; scene.traverse((o) => { if (o.isMesh && !(o.material.uniforms && o.material.uniforms.uSeed)) solid.push(o); });

// Where the horizon is held from is the level's own list (app/levels/<id>/checks.js): name, x, z, and the eye's height where it is not the land's plus 1.6.
const places = L.backdrop ? need("horizon").places : [];

const skip = !L.backdrop && `${LEVEL_ID} draws no far hills`;
test("below the horizon, from every sampled place, the first opaque thing is land or hill", { skip }, () => {
  const ray = new THREE.Raycaster(), bad = [];
  for (const [name, x, z, eyeY] of places) {
    const eye = new THREE.Vector3(x, eyeY ?? L.land(x, z) + 1.6, z);
    let miss = 0, first = null;
    for (let k = 0; k < 72; k++) for (const deg of [0.5, 2, 4, 6, 8, 10]) {
      const yaw = (k / 72) * Math.PI * 2, p = (deg * Math.PI) / 180;
      ray.set(eye, new THREE.Vector3(Math.sin(yaw) * Math.cos(p), -Math.sin(p), Math.cos(yaw) * Math.cos(p)));
      ray.far = 1e4;
      if (!ray.intersectObjects(solid, false).length) { miss++; first ||= `yaw ${Math.round((yaw * 180) / Math.PI)}° pitch -${deg}°`; }
    }
    if (miss) bad.push(`${name}: ${miss} of 432 rays reach the sky, first at ${first}`);
  }
  assert.deepEqual(bad, []);
});

test("the hills have no seam: height and colour inputs are continuous where the angle wraps", { skip }, () => {
  // Every range is a cylinder whose shader reads the angle atan(z, x); a noise sampled on that raw angle jumps at -x.
  // The shader must therefore wrap it (the `ang` helper), or the nearest range shows a vertical hard edge.
  const src = scene.children.filter((o) => o.isMesh && o.material.fragmentShader && o.material.fragmentShader.includes("uTop")).map((o) => o.material.fragmentShader);
  assert.ok(src.length >= 3);
  for (const s of src) assert.ok(/float ang\(/.test(s), "hill shader samples noise on the raw angle");
});
