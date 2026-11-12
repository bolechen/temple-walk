// The bronze censer with its thread of smoke, and sheets of mist hanging beyond the walls.
import * as THREE from "../v/build/three.module.js";
import { merge, mesh } from "./geo.js";

export function createProps(scene, M, at, centre) {
  // An iron censer of the kind cast in the Ming: a three-legged bowl with two handles, and over it two
  // small pavilion roofs, one above the other, on slender posts.
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const parts = [lathe([[0, 0.42], [0.3, 0.42], [0.5, 0.52], [0.6, 0.72], [0.6, 0.9], [0.67, 0.96], [0.67, 1.03], [0.57, 1.03], [0.54, 0.9], [0, 0.86]], 36)];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI / 2; parts.push(new THREE.CylinderGeometry(0.09, 0.06, 0.5, 10).translate(Math.cos(a) * 0.37, 0.25, Math.sin(a) * 0.37)); }
  for (const sx of [-1, 1]) parts.push(new THREE.TorusGeometry(0.12, 0.035, 8, 16, Math.PI).rotateY(Math.PI / 2).translate(sx * 0.62, 1.03, 0));
  const tier = (y, r, h) => {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(new THREE.CylinderGeometry(0.022, 0.022, h, 6).translate(Math.cos(a) * r * 0.62, y + h / 2, Math.sin(a) * r * 0.62)); }
    parts.push(lathe([[0, y + h + 0.3], [0.06, y + h + 0.26], [r * 0.5, y + h + 0.1], [r, y + h - 0.02], [r * 1.04, y + h + 0.02], [r * 0.9, y + h + 0.03], [0, y + h + 0.03]], 6));
  };
  tier(1.03, 0.78, 0.5); tier(1.86, 0.52, 0.34);
  parts.push(lathe([[0, 2.5], [0.07, 2.52], [0.1, 2.62], [0.04, 2.74], [0, 2.86]], 8));
  scene.add(mesh(merge(parts).translate(at.x, 0, at.z), M.iron));

  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"), r = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  r.addColorStop(0, "rgba(240,240,236,.55)"); r.addColorStop(0.5, "rgba(240,240,236,.16)"); r.addColorStop(1, "rgba(240,240,236,0)");
  x.fillStyle = r; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c), smoke = [], mist = [];
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { t: i / 40, seed: Math.random() * 100 }; smoke.push(s); scene.add(s);
  }
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5, color: 0xdfe6e4, fog: false }));
    const a = (i / 14) * Math.PI * 2 + 0.4, R = 34 + (i % 3) * 10;
    s.position.set(Math.cos(a) * R, 5 + (i % 4) * 2.2, centre + Math.sin(a) * R * 1.7); s.scale.set(38, 12, 1);
    s.userData = { a, R }; mist.push(s); scene.add(s);
  }
  return {
    update(t, dt, still) {
      for (const sp of mist) if (!still) sp.position.x = Math.cos(sp.userData.a) * sp.userData.R + Math.sin(t * 0.03 + sp.userData.a * 3) * 6;
      for (const sp of smoke) {
        const u = sp.userData; if (!still) u.t = (u.t + dt * 0.09) % 1;
        const a = u.t, sway = a * a;
        sp.position.set(at.x + Math.sin(t * 0.5 + u.seed + a * 5) * 0.4 * sway + a * 0.5, 1.02 + a * 4.2, at.z + Math.cos(t * 0.4 + u.seed * 1.7 + a * 4) * 0.3 * sway);
        sp.scale.setScalar(0.05 + a * 0.9); sp.material.opacity = Math.sin(Math.min(1, a * 6) * Math.PI / 2) * (1 - a) * 0.22;
      }
    },
  };
}
