// What monk-sit.test.mjs, monk-sit-sitdown.test.mjs and monk-sit-sitdown-60.test.mjs share (split in #697: the frame-by-frame
// sitting-down check was nearly all of monk-sit's time, which on a CI machine was 205 s, more than a shard's share of the rest).
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
// Rays against the baked robe go through a bounds tree (three-mesh-bvh, as app/src/eyebvh.worker.js uses it) instead of every triangle in turn (#730).
THREE.Mesh.prototype.raycast = acceleratedRaycast;
const { createMonk } = await import("../../app/src/monk.js");

export const TOP = 0.104, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** A skinned mesh as it is drawn this frame, for rays: all of it, or the triangles whose three points `keep` takes. */
export function baked(mesh, keep = () => true) {
  const p = mesh.geometry.attributes.position, pos = new Float32Array(p.count * 3), v = V(), ix = mesh.geometry.index.array, idx = [];
  for (let i = 0; i < p.count; i++) { mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }
  for (let k = 0; k < ix.length; k += 3) if (keep(ix[k]) && keep(ix[k + 1]) && keep(ix[k + 2])) idx.push(ix[k], ix[k + 1], ix[k + 2]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeBoundingSphere(); g.computeBoundingBox();
  g.boundsTree = new MeshBVH(g);
  const out = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); out.updateMatrixWorld(true); return out;
}

/** Sitting down at each frame step in `dts`: every point of his legs above the hem has cloth before it (the first art review of #680). */
export function sitDownCase(dts) {
  // (the first art review of #680: for a few frames of sitting down the knees stood out of the front of the robe as
  // high as his hands. The legs folded out to the sides before the cloth had spread; now the cloth leads the legs.
  // With the old schedule this finds over three hundred points bare in the fifth frame.)
  const ray = new THREE.Raycaster(), v = V(); ray.far = 1;
  for (const dt of dts) {
    const m = createMonk();
    for (let f = 1; f * dt <= 1.4; f++) {
      m.update(dt, 0, "sit", f * dt, () => -TOP, {}); m.group.updateMatrixWorld(true); m.skeleton.update();
      const cloth = baked(m.parts.robe), hem = cloth.geometry.boundingBox.min.y, legs = m.parts.legs; let bare = 0;
      for (let i = 0; i < legs.geometry.attributes.position.count; i++) {
        legs.getVertexPosition(i, v).applyMatrix4(legs.matrixWorld); if (v.y < hem + 0.03) continue;   // (below the hem his shins show, as they do standing)
        const r = Math.hypot(v.x, v.z) || 1;
        ray.set(v, V(v.x / r, 0.25, v.z / r).normalize()); if (ray.intersectObject(cloth).length) continue;   // cloth outside it
        ray.set(v, V(0, 0, 1)); if (ray.intersectObject(cloth).length) continue;                               // or before it
        bare++;
      }
      assert.equal(bare, 0, `at ${(f * dt).toFixed(2)} s (frames of ${(dt * 1000).toFixed(0)} ms) ${bare} points of his legs stand out of the robe`);
    }
  }
}
