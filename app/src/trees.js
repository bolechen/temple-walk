// The trees that keep the calendar: one kind flowers pale pink in spring and burns red in autumn, the
// other is a ginkgo that turns gold. Both stand bare under snow.
import * as THREE from "../v/build/three.module.js";
import { mergeGeometries } from "../v/jsm/utils/BufferGeometryUtils.js";
import { merge, mesh } from "./geo.js";

// Sprays drawn large and fine, one sheet for each thing a tree can wear: five-petalled blossom,
// the five-pointed leaf of a maple, the fan of a ginkgo. Drawn pale; the season lays its colour over them.
function sprayTexture(kind) {
  const N = 1024, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"); let s = kind.length * 131; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tone = () => { const v = 205 + rnd() * 50; return `rgb(${v},${v},${v})`; };
  x.strokeStyle = "rgba(120,110,100,.9)";
  for (let k = 0; k < 9; k++) {   // twigs, so the sprays hang from something
    let px = 80 + rnd() * (N - 160), py = 80 + rnd() * (N - 160), a = rnd() * 6.3; x.lineWidth = 3.2; x.beginPath(); x.moveTo(px, py);
    for (let i = 0; i < 9; i++) { a += (rnd() - 0.5) * 0.7; px += Math.cos(a) * 46; py += Math.sin(a) * 46; x.lineTo(px, py); } x.stroke();
  }
  const count = kind === "blossom" ? 190 : 150;
  for (let i = 0; i < count; i++) {
    const px = 50 + rnd() * (N - 100), py = 50 + rnd() * (N - 100), r = (kind === "blossom" ? 15 : 24) * (0.7 + rnd() * 0.6), rot = rnd() * 6.3;
    x.save(); x.translate(px, py); x.rotate(rot); x.fillStyle = tone();
    if (kind === "blossom") {
      for (let p = 0; p < 5; p++) { x.rotate(6.283 / 5); x.beginPath(); x.ellipse(0, -r * 0.62, r * 0.42, r * 0.6, 0, 0, 6.3); x.fill(); }
      x.fillStyle = "rgb(150,140,130)"; x.beginPath(); x.arc(0, 0, r * 0.16, 0, 6.3); x.fill();
    } else if (kind === "maple") {
      x.beginPath();
      for (let p = 0; p < 5; p++) { const a0 = -1.57 + (p - 2) * 0.62, len = r * (p === 2 ? 1.25 : p === 1 || p === 3 ? 1.05 : 0.72); x.lineTo(Math.cos(a0 - 0.2) * len * 0.42, Math.sin(a0 - 0.2) * len * 0.42); x.lineTo(Math.cos(a0) * len, Math.sin(a0) * len); x.lineTo(Math.cos(a0 + 0.2) * len * 0.42, Math.sin(a0 + 0.2) * len * 0.42); }
      x.lineTo(0, r * 0.5); x.closePath(); x.fill();
      x.strokeStyle = "rgba(120,110,100,.55)"; x.lineWidth = 1.2; for (let p = 0; p < 5; p++) { const a0 = -1.57 + (p - 2) * 0.62; x.beginPath(); x.moveTo(0, r * 0.15); x.lineTo(Math.cos(a0) * r * 0.9, Math.sin(a0) * r * 0.9); x.stroke(); }
    } else {   // ginkgo: a fan with a notch, on a thin stalk
      x.beginPath(); x.moveTo(0, r * 0.75); x.arc(0, r * 0.75, r * 1.5, -1.57 - 0.72, -1.57 - 0.05); x.lineTo(0, -r * 0.3); x.arc(0, r * 0.75, r * 1.5, -1.57 + 0.05, -1.57 + 0.72); x.closePath(); x.fill();
      x.strokeStyle = "rgba(120,110,100,.45)"; x.lineWidth = 1; for (let p = -5; p <= 5; p++) { x.beginPath(); x.moveTo(0, r * 0.75); x.lineTo(Math.sin(p * 0.13) * r * 1.4, r * 0.75 - Math.cos(p * 0.13) * r * 1.4); x.stroke(); }
    }
    x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
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
  const tex = { blossom: sprayTexture("blossom"), maple: sprayTexture("maple"), ginkgo: sprayTexture("ginkgo") }, mats = {};
  for (const kind of ["maple", "ginkgo"]) {
    if (!crowns[kind].length) continue;
    mats[kind] = new THREE.MeshStandardMaterial({ map: tex[kind], alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.3 });
    mats[kind].mesh = new THREE.Mesh(mergeGeometries(crowns[kind]), mats[kind]); mats[kind].mesh.castShadow = true; scene.add(mats[kind].mesh);
  }
  return {
    setMood(m) {
      for (const kind in mats) { const c = COLOURS[kind][m.season]; mats[kind].mesh.visible = !!c; if (c) mats[kind].color.setRGB(...c); mats[kind].map = kind === "maple" && m.season === "spring" ? tex.blossom : tex[kind]; }
    },
  };
}
