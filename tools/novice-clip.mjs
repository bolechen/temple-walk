// How many of the hat's triangles, and of his hand's, cut through the robe, pose by pose (#642): triangle against
// triangle on the skinned meshes as the page poses them, through a BVH of the robe.
//   node tools/novice-clip.mjs
await import("../tests/unit/dom-stub.mjs");
const THREE = await import("three");
const { MeshBVH, ExtendedTriangle } = await import("three-mesh-bvh");
const { createMonk } = await import("../app/src/monk.js");

/** World-space triangles of a skinned mesh as it stands. */
function baked(mesh, keep = () => true) {
  const g = mesh.geometry, idx = g.index, n = idx ? idx.count : g.attributes.position.count, P = g.attributes.position;
  const pos = [], v = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    const k = [0, 1, 2].map((j) => (idx ? idx.getX(i + j) : i + j));
    if (!keep(k)) continue;
    for (const j of k) { v.fromBufferAttribute(P, j); if (mesh.isSkinnedMesh) mesh.applyBoneTransform(j, v); v.applyMatrix4(mesh.matrixWorld); pos.push(v.x, v.y, v.z); }
  }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); return out;
}
const hits = (geom, bvh) => {
  const P = geom.attributes.position, t = new ExtendedTriangle(); let n = 0;
  for (let i = 0; i < P.count; i += 3) {
    t.set(new THREE.Vector3().fromBufferAttribute(P, i), new THREE.Vector3().fromBufferAttribute(P, i + 1), new THREE.Vector3().fromBufferAttribute(P, i + 2));
    let cut = false;
    bvh.shapecast({
      intersectsBounds: (box) => box.intersectsTriangle(t),
      intersectsTriangle: (tri) => { if (tri.intersectsTriangle(t)) { cut = true; return true; } return false; },
    });
    if (cut) n++;
  }
  return n;
};
function pose(label, setup) {
  const m = createMonk(), names = m.skeleton.bones.map((b) => b.name);
  setup(m);
  m.group.updateMatrixWorld(true);
  const robe = baked(m.parts.robe), bvh = new MeshBVH(robe);
  const hat = baked(m.parts.hat);
  const handBone = new Set([names.indexOf("leftHand"), names.indexOf("rightHand")]);
  const g = m.parts.skin.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const isHand = (k) => k.some((i) => { for (let c = 0; c < 4; c++) if (sw.getComponent(i, c) > 0.5 && handBone.has(si.getComponent(i, c))) return true; return false; });
  const hand = baked(m.parts.skin, isHand);
  console.log(label.padEnd(8), `hat tris through the robe ${String(hits(hat, bvh)).padStart(4)} | hand tris ${String(hits(hand, bvh)).padStart(4)}`);
}
const walk = (m, f, s = 2.1) => { for (let i = 0; i <= f; i++) m.update(1 / 30, s, false, i / 30, () => 0, {}); };
pose("stand", (m) => { for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); });
pose("walk10", (m) => walk(m, 10)); pose("walk16", (m) => walk(m, 16)); pose("walk34", (m) => walk(m, 34));
pose("walk52", (m) => walk(m, 52));
pose("pray", (m) => { for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {}); });
pose("chair", (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "chair", i / 30, () => -0.44, {}); });
pose("sit", (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "sit", i / 30, () => -0.104, {}); });
