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
/** @typedef {{ x0: number, x1: number, y0: number, y1: number, z0: number, z1: number }} EyeBox */
/**
 * What the eye's space gathers from: the level's box round the courts, and wherever the rooms lie, which a level does not
 * know (the engine builds them, side by side, under the courts).
 * @param {EyeBox} box @param {THREE.Object3D | null | undefined} rooms @returns {EyeBox[]}
 */
export function eyeBoxes(box, rooms) {
  if (!rooms) return [box];
  rooms.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(rooms);
  return b.isEmpty() ? [box] : [box, { x0: b.min.x - 1, x1: b.max.x + 1, y0: b.min.y - 1, y1: b.max.y + 1, z0: b.min.z - 1, z1: b.max.z + 1 }];
}

/**
 * Whether a part is shown at the moment it is gathered says nothing: the rooms under the courts are hidden out of doors
 * and the courts from inside a room (a visit begun in a hall, ?in=, a language changed there), and left out, the eye went
 * through every wall of them (27c9458). Only what the address switches off (`?off=`, `off`) is not there.
 * @param {THREE.Object3D} scene @param {EyeBox | EyeBox[]} boxes what is kept: whatever lies in any of them
 * @param {number} budget milliseconds a slice @param {Set<string>} off the parts switched off
 * @param {Record<string, number> | null} byPart if given, how many triangles were taken from each part
 * @returns {Generator<void, Float32Array, void>} the triangles, nine numbers each
 */
export function* gatherEye(scene, boxes, budget = 4, off = new Set(), byPart = null) {
  const keeps = (Array.isArray(boxes) ? boxes : [boxes]).map((b) => new THREE.Box3(new THREE.Vector3(b.x0, b.y0, b.z0), new THREE.Vector3(b.x1, b.y1, b.z1)));
  const kept = (/** @type {THREE.Box3} */ b) => keeps.some((k) => k.intersectsBox(b));
  // what to take: every mesh of the parts named, not airy, visible, in the box (an instanced mesh, each instance in it)
  /** @type {{ geo: THREE.BufferGeometry, m: THREE.Matrix4, part: string }[]} */
  const jobs = [], tb = new THREE.Box3(), m4 = new THREE.Matrix4();
  for (const top of scene.children) {
    if (!EYE_PARTS.has(top.userData.part) || off.has(top.userData.part)) continue;
    top.updateMatrixWorld(true);
    top.traverse((/** @type {any} */ o) => {
      if (!o.isMesh) return;
      const stop = o.userData.eye === "stop";   // drawn nowhere, there only to stop the eye (a hall's doorway seen from inside)
      // (a part's own top may be a mesh, as the land's and the trees' are: whether it is shown is the part's, said above)
      if (!stop && (o.userData.walk === false || (o !== top && !o.visible) || airy(Array.isArray(o.material) ? o.material[0] : o.material))) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); if (kept(tb.copy(o.geometry.boundingBox).applyMatrix4(m4))) jobs.push({ geo: o.geometry, m: m4.clone(), part: top.userData.part }); } return; }
      if (kept(tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld))) jobs.push({ geo: o.geometry, m: o.matrixWorld, part: top.userData.part });
    });
  }
  let n = 0; for (const j of jobs) { const idx = j.geo.index, c = Math.floor((idx ? idx.count : j.geo.attributes.position.count) / 3); n += c; if (byPart) byPart[j.part] = (byPart[j.part] || 0) + c; }
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
