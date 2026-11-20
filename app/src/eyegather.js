// What the eye is kept out of, gathered from the page's own scene (#295): the triangles of what stands in the place, as
// tools/walk/bake.mjs gathers them for the floor (its `airy` materials left out: mist, glass, leaves cut out of a card,
// flames), from the parts of the scene that are built and stay (the plan, the rooms, the censer, the trees' wood, the
// land), within the box the walk is laid out in. A generator: it gives the frame back every few milliseconds, so that
// gathering the place does not stall the walk; what it returns is handed to a worker (eyebvh.worker.js) to be sorted
// into a hierarchy off the page's thread.
import * as THREE from "three";

// The same test as the bake's (tools/walk/bake.mjs `airy`): drawn, but not there to stop anything.
export const airy = (/** @type {any} */ m) => !m || m.type === "ShaderMaterial" || m.type === "RawShaderMaterial" || m.type === "PointsMaterial" || m.name === "flame" || m.transparent || m.alphaTest > 0;
/** The scene's parts (yard.js `part`) the eye is kept out of. */
export const EYE_PARTS = new Set(["site", "interior", "props", "trees", "backdrop"]);

/**
 * @param {THREE.Object3D} scene @param {{ x0: number, x1: number, y0: number, y1: number, z0: number, z1: number }} box
 * @param {number} budget milliseconds a slice
 * @returns {Generator<void, Float32Array, void>} the triangles, nine numbers each
 */
export function* gatherEye(scene, box, budget = 4) {
  const keep = new THREE.Box3(new THREE.Vector3(box.x0, box.y0, box.z0), new THREE.Vector3(box.x1, box.y1, box.z1));
  // what to take: every mesh of the parts named, not airy, visible, in the box (an instanced mesh, each instance in it)
  /** @type {{ geo: THREE.BufferGeometry, m: THREE.Matrix4 }[]} */
  const jobs = [], tb = new THREE.Box3(), m4 = new THREE.Matrix4();
  for (const top of scene.children) {
    // (a part switched off for a test or a measurement, `?off=site`, still stands there: the floor is baked from it, and the eye must be kept out of it as well, #354's hallexit)
    if (!EYE_PARTS.has(top.userData.part)) continue;
    top.updateMatrixWorld(true);
    top.traverse((/** @type {any} */ o) => {
      if (!o.isMesh || o.userData.walk === false || !o.visible) return;
      // (a hall's dark box behind its open door is drawn with a shader that paints the room, so it counts as airy, but it is a box the eye must not go into: before, the eye backed out through the door into the hall, #354)
      if (airy(Array.isArray(o.material) ? o.material[0] : o.material) && !o.userData.doorway) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); if (tb.copy(o.geometry.boundingBox).applyMatrix4(m4).intersectsBox(keep)) jobs.push({ geo: o.geometry, m: m4.clone() }); } return; }
      if (tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(keep)) jobs.push({ geo: o.geometry, m: o.matrixWorld });
    });
  }
  let n = 0; for (const j of jobs) { const idx = j.geo.index; n += Math.floor((idx ? idx.count : j.geo.attributes.position.count) / 3); }
  const out = new Float32Array(n * 9), v = new THREE.Vector3();
  let k = 0, t0 = performance.now();
  for (const { geo, m } of jobs) {
    const p = geo.attributes.position, idx = geo.index, count = idx ? idx.count : p.count, e = m.elements;
    for (let i = 0; i + 2 < count; i += 3) {
      for (let c = 0; c < 3; c++) {
        const a = idx ? idx.getX(i + c) : i + c; v.fromBufferAttribute(p, a);
        out[k++] = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12]; out[k++] = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13]; out[k++] = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
      }
      if ((i & 1023) === 0 && performance.now() - t0 > budget) { yield; t0 = performance.now(); }
    }
  }
  return k === out.length ? out : out.slice(0, k);
}
