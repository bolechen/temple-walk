import "./dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../../app/src/monk.js");
const V = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const points = (mesh) => { const out = [], v = V(); for (let i = 0; i < mesh.geometry.attributes.position.count; i++) out.push(mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).clone()); return out; };
function baked(mesh) {
  const p = mesh.geometry.attributes.position, pos = new Float32Array(p.count * 3), v = V();
  for (let i = 0; i < p.count; i++) { mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex([...mesh.geometry.index.array]); g.computeBoundingSphere(); g.computeBoundingBox();
  const out = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); out.updateMatrixWorld(true); return out;
}
const m = createMonk(); const ray = new THREE.Raycaster();
const eyes = [V(0,0.4,1.5), V(0,0.9,1.4), V(1,0.5,1), V(-1,0.5,1), V(0,1.5,0.8)];
for (let f = 1; f <= 40; f++) {
  m.update(1/30, 0, "sit", f/30, () => -0.104, {});
  m.group.updateMatrixWorld(true); m.skeleton.update();
  if (f > 24) break;
  const cover = [baked(m.parts.robe), baked(m.parts.skin)];
  let vis = 0, hi = -9, thru = 0, thi = -9;
  for (const v of [...points(m.parts.legs)]) {
    for (const e of eyes) { const d = v.clone().sub(e); const L = d.length(); ray.set(e, d.normalize()); ray.far = L - 0.003;
      if (!ray.intersectObjects(cover, false).length) { vis++; hi = Math.max(hi, v.y);
        ray.set(v, new THREE.Vector3(0,-1,0)); ray.far = 1; if (ray.intersectObject(cover[0], false).length) { thru++; thi = Math.max(thi, v.y); } ray.far = Infinity; break; } }
  }
  console.log(f, "visible", vis, "hi", hi.toFixed(3), "THROUGH", thru, "hi", thi.toFixed(3));
}
