// #183: how much of the horizon the heightmap alone holds, without the far range made up round its rim (FAR.lift = 0).
// The same rays as tests/unit/horizon.test.mjs.  node tools/terrain/horizon-norim.mjs
import "../../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import * as THREE from "three";
import { FAR, parseHeightmap } from "../../app/src/terrain-far.js";
import { createBackdrop } from "../../app/src/backdrop.js";
import checks from "../../app/levels/t00/checks.js";
import { SITE, LEVELS, terrain } from "../../app/src/site.js";
FAR.lift = 0;
for (const T of ["dem", "made"]) {
  const d = new URL("../../app/shared/terrain/", import.meta.url).pathname;
  const far = parseHeightmap(JSON.parse(fs.readFileSync(d + T + ".json")), new Uint8Array(fs.readFileSync(d + T + ".bin")).buffer);
  const scene = new THREE.Scene(), M = new Proxy({}, { get: (t, k) => (t[k] ||= new THREE.MeshBasicMaterial()) });
  createBackdrop(scene, M, SITE, [LEVELS[0], LEVELS[2]], terrain, far); scene.updateMatrixWorld(true);
  const solid = []; scene.traverse((o) => { if (o.isMesh && !(o.material.uniforms && o.material.uniforms.uSeed)) solid.push(o); });
  const ray = new THREE.Raycaster(); let out = [];
  for (const [name, x, z, eyeY] of checks.horizon.places) { const eye = new THREE.Vector3(x, eyeY ?? terrain(x, z) + 1.6, z); let miss = 0;
    for (let k = 0; k < 72; k++) for (const deg of [0.5, 2, 4, 6, 8, 10]) { const yaw = (k / 72) * Math.PI * 2, p = (deg * Math.PI) / 180; ray.set(eye, new THREE.Vector3(Math.sin(yaw) * Math.cos(p), -Math.sin(p), Math.cos(yaw) * Math.cos(p))); if (!ray.intersectObjects(solid, false).length) miss++; }
    if (miss) out.push(`${name} ${miss}/432`); }
  console.log(T, "without the far rim:", out.join(", ") || "none reach the sky");
}
