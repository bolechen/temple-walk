// A grove you can stand in: real culms with drooping sprays of leaves, merged into two meshes.
// The far grove beyond is painted (backdrop.js); this is what stands close enough to be looked at.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { crownMaterial } from "./trees.js";

function leafTexture() {
  // Sprays as they grow: a thin twig, and slender leaves a hand long hanging off it in fans, tips down.
  const N = 1024, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"); let s = 4242; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 64; k++) {
    const tx = 60 + rnd() * (N - 120), ty = 30 + rnd() * (N * 0.62), ang = (rnd() - 0.5) * 1.3 + Math.PI / 2, len = 150 + rnd() * 170;
    x.strokeStyle = "rgb(150,150,120)"; x.lineWidth = 2; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + Math.cos(ang) * len * 0.5 + (rnd() - 0.5) * 30, ty + Math.sin(ang) * len * 0.5, tx + Math.cos(ang) * len, ty + Math.sin(ang) * len); x.stroke();
    for (let i = 0; i < 11; i++) {
      const t = 0.12 + (i / 11) * 0.88, px = tx + Math.cos(ang) * len * t, py = ty + Math.sin(ang) * len * t, a = ang + (i % 2 ? 1 : -1) * (0.35 + rnd() * 0.55) + 0.2, l = 70 + rnd() * 38, w = 5.2 + rnd() * 2.4;
      const g = 150 + rnd() * 105; x.fillStyle = `rgb(${Math.round(g * 0.9)},${Math.round(g)},${Math.round(g * 0.78)})`;   // pale: the season lays its green over it
      x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(l * 0.4, -w, l, 0); x.quadraticCurveTo(l * 0.4, w, 0, 0); x.fill();
      x.strokeStyle = "rgba(60,70,40,.35)"; x.lineWidth = 0.8; x.beginPath(); x.moveTo(0, 0); x.lineTo(l, 0); x.stroke(); x.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function culmTexture() {
  const c = document.createElement("canvas"); c.width = 16; c.height = 256;
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 16, 0);
  g.addColorStop(0, "#4c5c3a"); g.addColorStop(0.5, "#6f7f5a"); g.addColorStop(1, "#4f5e3e"); x.fillStyle = g; x.fillRect(0, 0, 16, 256);   // grey-green culms, with white bloom under each node
  for (let y = 0; y < 256; y += 32) { x.fillStyle = "rgba(225,230,215,.14)"; x.fillRect(0, y + 4, 16, 7); x.fillStyle = "rgba(210,215,180,.3)"; x.fillRect(0, y, 16, 2); x.fillStyle = "rgba(20,30,12,.6)"; x.fillRect(0, y + 2, 16, 2); }   // nodes
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t;
}

// `areas`: [{x0, x1, z0, z1, n}], `heightAt(x, z)`: the land, `keep(x, z)`: false where nothing may grow.
export function createBamboo(scene, areas, heightAt, keep, opts = {}) {
  let s = 977; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const culms = [], leaves = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (const a of areas) for (let i = 0; i < a.n; i++) {
    const x = a.x0 + rnd() * (a.x1 - a.x0), z = a.z0 + rnd() * (a.z1 - a.z0);
    if (!keep(x, z)) continue;
    const y = heightAt(x, z), h = 9 + rnd() * 6, r = 0.035 + rnd() * 0.03, leanA = rnd() * 6.28, lean = 0.03 + rnd() * 0.09;
    const c = new THREE.CylinderGeometry(r * 0.45, r, h, opts.fine === false ? 5 : 8, 1, true); c.translate(0, h / 2, 0);
    const uv = c.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * h * 0.35);
    q.setFromEuler(e.set(Math.cos(leanA) * lean, rnd() * 6, Math.sin(leanA) * lean));
    c.applyMatrix4(m4.compose(v.set(x, y - 0.2, z), q, one)); culms.push(c);
    // From the upper half thin branches spring at the nodes, and each ends in a spray of leaves no bigger than a hand.
    const n = (opts.fine === false ? 4 : 6) + Math.floor(rnd() * 3), crown = new THREE.Vector3(x + Math.sin(leanA) * lean * h * 0.7, y + h * 0.62, z - Math.cos(leanA) * lean * h * 0.7);
    for (let k = 0; k < n; k++) {
      const at = 0.42 + rnd() * 0.56, a = rnd() * 6.283, reach = 0.5 + rnd() * 0.9, w = 1.15 + rnd() * 0.55;
      const from = new THREE.Vector3(x + Math.sin(leanA) * lean * h * at * 0.9, y + h * at, z - Math.cos(leanA) * lean * h * at * 0.9), tip = from.clone().add(new THREE.Vector3(Math.cos(a) * reach, 0.25 - rnd() * 0.3, Math.sin(a) * reach));
      if (opts.fine !== false) {   // the twig itself, where there is a card to spare for it
        const tw = new THREE.CylinderGeometry(0.004, 0.009, from.distanceTo(tip), 3, 1, true); tw.translate(0, from.distanceTo(tip) / 2, 0);
        q.setFromUnitVectors(up, v.copy(tip).sub(from).normalize()); tw.applyMatrix4(m4.compose(from, q, one)); culms.push(tw);
      }
      const g = new THREE.PlaneGeometry(w, w); g.translate(0, -w * 0.36, 0);
      q.setFromEuler(e.set((rnd() - 0.5) * 0.9, rnd() * 6.28, (rnd() - 0.5) * 0.6)); g.applyMatrix4(m4.compose(tip, q, one));
      // lit as part of the culm's whole plume, not as a flat card
      const P = g.attributes.position, Nn = g.attributes.normal, col = new Float32Array(P.count * 3), tint = 0.8 + rnd() * 0.4;
      for (let i2 = 0; i2 < P.count; i2++) { const nx = P.getX(i2) - crown.x, ny = (P.getY(i2) - crown.y) * 0.5 + 0.8, nz = P.getZ(i2) - crown.z, l = Math.hypot(nx, ny, nz) || 1; Nn.setXYZ(i2, nx / l, ny / l, nz / l); col[i2 * 3] = tint; col[i2 * 3 + 1] = tint * 0.5 + 0.5; col[i2 * 3 + 2] = tint; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3)); leaves.push(g);
    }
  }
  // Under the culms, what grows where nobody walks: knee-high clumps of dwarf bamboo and fern, thickest near the path.
  for (const a of areas) for (let i = 0, n = Math.round(a.n * (opts.fine === false ? 0.35 : 1.5)); i < n; i++) {
    const x = a.x0 + rnd() * (a.x1 - a.x0), z = a.z0 + rnd() * (a.z1 - a.z0);
    if (!keep(x, z)) continue;
    const y = heightAt(x, z), hh = 0.5 + rnd() * 0.7, w = 0.9 + rnd() * 0.9, turn = rnd() * 3.14, tint = 0.55 + rnd() * 0.35;
    for (let k = 0; k < 2; k++) {
      const g = new THREE.PlaneGeometry(w, hh); g.translate(0, hh * 0.46, 0);
      q.setFromEuler(e.set((rnd() - 0.5) * 0.5, turn + k * 1.57, 0)); g.applyMatrix4(m4.compose(v.set(x, y - 0.03, z), q, one));
      const P = g.attributes.position, Nn = g.attributes.normal, col = new Float32Array(P.count * 3);
      for (let i2 = 0; i2 < P.count; i2++) { const up2 = (P.getY(i2) - y) / hh, c = tint * (0.45 + 0.55 * up2); Nn.setXYZ(i2, (P.getX(i2) - x) * 0.4, 0.9, (P.getZ(i2) - z) * 0.4); col[i2 * 3] = c * 0.9; col[i2 * 3 + 1] = c; col[i2 * 3 + 2] = c * 0.8; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3)); leaves.push(g);
    }
  }
  if (!culms.length) return { setMood() {} };
  const cm = new THREE.Mesh(mergeGeometries(culms), new THREE.MeshStandardMaterial({ map: culmTexture(), roughness: 0.55, envMapIntensity: 0.4 }));
  cm.castShadow = true;
  const lm = new THREE.Mesh(mergeGeometries(leaves), crownMaterial(leafTexture(), { a2c: opts.a2c, sway: 0.05, snow: 0.75 }));
  // The sprays cast their leaves' shadows, holes and all (three cuts the shadow at the material's alpha test): the
  // dappled light on the steps and on the ground under the grove. Drawn once an hour, like every shadow.
  lm.castShadow = !!opts.leafShadow;
  lm.renderOrder = 1; scene.add(cm, lm);
  // The grove's grey-green, turned a little by the season.
  return { setMood(m) { lm.material.color.setRGB(0.2 * m.leaf[0], 0.28 * m.leaf[1], 0.155 * m.leaf[2]); cm.material.color.setRGB(0.72 * m.leaf[0], 0.74 * m.leaf[1], 0.7 * m.leaf[2]); } };
}
