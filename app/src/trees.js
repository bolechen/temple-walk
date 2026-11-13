// The trees that keep the calendar: one kind flowers pale pink in spring and burns red in autumn, the
// other is a ginkgo that turns gold. Both stand bare under snow.
import * as THREE from "../v/build/three.module.js";
import { mergeGeometries } from "../v/jsm/utils/BufferGeometryUtils.js";
import { merge, mesh } from "./geo.js";

function sprayTexture() {   // a scatter of small soft shapes: petals, or leaves, depending on the colour laid over them
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d"); let s = 77; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 230; i++) {
    const v = 190 + rnd() * 65; x.fillStyle = `rgb(${v},${v},${v})`;
    x.beginPath(); x.ellipse(18 + rnd() * 220, 18 + rnd() * 220, 4 + rnd() * 7, 3 + rnd() * 5, rnd() * 3.14, 0, 6.3); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const COLOURS = {
  maple:  { spring: [1.0, 0.8, 0.86], summer: [0.3, 0.5, 0.2], autumn: [0.82, 0.17, 0.07], winter: null },
  ginkgo: { spring: [0.6, 0.8, 0.34], summer: [0.34, 0.56, 0.2], autumn: [0.98, 0.74, 0.12], winter: null },
};

// `spots`: [x, y, z, kind, height]
export function createTrees(scene, M, spots) {
  let s = 311; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const wood = [], crowns = { maple: [], ginkgo: [] };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const limb = (a, b, r0, r1) => {   // a tapering cylinder from a to b
    const d = b.clone().sub(a), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, 6).translate(0, len / 2, 0);
    q.setFromUnitVectors(up, d.normalize()); wood.push(g.applyMatrix4(m4.compose(a, q, one)));
  };
  for (const [x, y, z, kind, h] of spots) {
    const base = new THREE.Vector3(x, y - 0.1, z), fork = new THREE.Vector3(x + (rnd() - 0.5) * 0.5, y + h * 0.42, z + (rnd() - 0.5) * 0.5);
    limb(base, fork, 0.2, 0.13);
    const n = 5 + Math.floor(rnd() * 2), wide = kind === "maple" ? 1 : 0.6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + rnd() * 0.6, reach = h * (0.26 + rnd() * 0.14) * wide, tip = new THREE.Vector3(fork.x + Math.cos(a) * reach, y + h * (0.72 + rnd() * 0.22), fork.z + Math.sin(a) * reach);
      const mid = fork.clone().lerp(tip, 0.5); mid.y -= h * 0.04; limb(fork, mid, 0.1, 0.06); limb(mid, tip, 0.06, 0.02);
      for (let k = 0; k < 13; k++) {   // sprays of leaf or blossom round each bough
        const w = 1.3 + rnd() * 1.3, g = new THREE.PlaneGeometry(w, w), t = 0.25 + rnd() * 0.9;
        v.copy(fork).lerp(tip, t).add(new THREE.Vector3((rnd() - 0.5) * 1.5, (rnd() - 0.35) * 1.3, (rnd() - 0.5) * 1.5));
        q.setFromEuler(e.set(rnd() * 3.1, rnd() * 6.3, rnd() * 3.1)); crowns[kind].push(g.applyMatrix4(m4.compose(v, q, one)));
      }
    }
  }
  scene.add(mesh(merge(wood), M.bark));
  const tex = sprayTexture(), mats = {};
  for (const kind of ["maple", "ginkgo"]) {
    if (!crowns[kind].length) continue;
    mats[kind] = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.3 });
    mats[kind].mesh = new THREE.Mesh(mergeGeometries(crowns[kind]), mats[kind]); mats[kind].mesh.castShadow = true; scene.add(mats[kind].mesh);
  }
  return {
    setMood(m) {
      for (const kind in mats) { const c = COLOURS[kind][m.season]; mats[kind].mesh.visible = !!c; if (c) mats[kind].color.setRGB(...c); }
    },
  };
}
