// A grove you can stand in: real culms with drooping sprays of leaves, merged into two meshes.
// The far grove beyond is painted (backdrop.js); this is what stands close enough to be looked at.
import * as THREE from "../v/build/three.module.js";
import { mergeGeometries } from "../v/jsm/utils/BufferGeometryUtils.js";

function leafTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d"); let s = 4242; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Sprays: a thin twig, slender leaves hanging off it in pairs, tips down.
  for (let k = 0; k < 26; k++) {
    const tx = 40 + rnd() * 432, ty = 20 + rnd() * 300, ang = (rnd() - 0.5) * 1.2 + Math.PI / 2, len = 110 + rnd() * 120;
    x.strokeStyle = "rgba(96,110,52,1)"; x.lineWidth = 2.2; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + Math.cos(ang) * len, ty + Math.sin(ang) * len); x.stroke();
    for (let i = 0; i < 9; i++) {
      const t = 0.15 + (i / 9) * 0.85, px = tx + Math.cos(ang) * len * t, py = ty + Math.sin(ang) * len * t, a = ang + (i % 2 ? 1 : -1) * (0.5 + rnd() * 0.5) + 0.25, l = 46 + rnd() * 34;
      const g = 95 + rnd() * 70; x.fillStyle = `rgb(${Math.round(g * 0.55)},${Math.round(g)},${Math.round(g * 0.32)})`;
      x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(l * 0.45, -6.5, l, 0); x.quadraticCurveTo(l * 0.45, 6.5, 0, 0); x.fill(); x.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function culmTexture() {
  const c = document.createElement("canvas"); c.width = 16; c.height = 256;
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 16, 0);
  g.addColorStop(0, "#3f5a26"); g.addColorStop(0.5, "#6f8a3c"); g.addColorStop(1, "#40592a"); x.fillStyle = g; x.fillRect(0, 0, 16, 256);
  for (let y = 0; y < 256; y += 32) { x.fillStyle = "rgba(210,215,180,.55)"; x.fillRect(0, y, 16, 2); x.fillStyle = "rgba(20,30,12,.6)"; x.fillRect(0, y + 2, 16, 2); }   // nodes
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t;
}

// `areas`: [{x0, x1, z0, z1, n}], `heightAt(x, z)`: the land, `keep(x, z)`: false where nothing may grow.
export function createBamboo(scene, areas, heightAt, keep) {
  let s = 977; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const culms = [], leaves = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (const a of areas) for (let i = 0; i < a.n; i++) {
    const x = a.x0 + rnd() * (a.x1 - a.x0), z = a.z0 + rnd() * (a.z1 - a.z0);
    if (!keep(x, z)) continue;
    const y = heightAt(x, z), h = 9 + rnd() * 6, r = 0.035 + rnd() * 0.03, leanA = rnd() * 6.28, lean = 0.03 + rnd() * 0.09;
    const c = new THREE.CylinderGeometry(r * 0.45, r, h, 5, 1, true); c.translate(0, h / 2, 0);
    const uv = c.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * h * 0.35);
    q.setFromEuler(e.set(Math.cos(leanA) * lean, rnd() * 6, Math.sin(leanA) * lean));
    c.applyMatrix4(m4.compose(v.set(x, y - 0.2, z), q, one)); culms.push(c);
    const sprays = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < sprays; k++) {   // sprays of leaf hanging from the upper half
      const at = 0.5 + rnd() * 0.5, w = 2.6 + rnd() * 1.8, g = new THREE.PlaneGeometry(w, w * 1.15);
      g.translate(0, -w * 0.35, 0);
      q.setFromEuler(e.set((rnd() - 0.5) * 0.7, rnd() * 6.28, (rnd() - 0.5) * 0.5));
      const top = v.set(Math.sin(leanA) * lean * h * at * 0.9 + x + (rnd() - 0.5) * 0.8, y + h * at, -Math.cos(leanA) * lean * h * at * 0.9 + z + (rnd() - 0.5) * 0.8);
      g.applyMatrix4(m4.compose(top, q, one)); leaves.push(g);
    }
  }
  if (!culms.length) return { setMood() {} };
  const cm = new THREE.Mesh(mergeGeometries(culms), new THREE.MeshStandardMaterial({ map: culmTexture(), roughness: 0.55, envMapIntensity: 0.4 }));
  cm.castShadow = true;
  const lm = new THREE.Mesh(mergeGeometries(leaves), new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.25 }));
  scene.add(cm, lm);
  return { setMood(m) { lm.material.color.setRGB(...m.leaf); cm.material.color.setRGB(...m.leaf); } };
}
