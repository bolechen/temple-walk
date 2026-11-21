// Off the page's thread (#295): the triangles of the place the eye is kept out of (eyegather.js), sorted into a bounding
// volume hierarchy (three-mesh-bvh), and handed back as its buffers with the triangles, both moved rather than copied.
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

self.onmessage = (/** @type {MessageEvent} */ e) => {
  const t0 = performance.now(), positions = /** @type {Float32Array} */ (e.data.positions);
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const bvh = new MeshBVH(geo, { targetLeafSize: 8, indirect: false });
  const data = MeshBVH.serialize(bvh, { cloneBuffers: false });
  const moved = [positions.buffer, ...data.roots, data.index.buffer].filter((b, i, a) => b instanceof ArrayBuffer && a.indexOf(b) === i);
  self.postMessage({ positions, data, ms: performance.now() - t0 }, /** @type {any} */ (moved));
};
