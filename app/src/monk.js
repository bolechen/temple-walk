// The visitor: a novice of nine or ten in a grey robe, with a string of beads too long for him.
// He walks where you send him, and can put his palms together.
import * as THREE from "../v/build/three.module.js";

export function createMonk() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, envMapIntensity: 0.45 });
  const robe = mat(0x82858c), dark = mat(0x4d4f56), skin = mat(0xe6bb9b, 0.7), cloth = mat(0x26252a), bead = mat(0x3c2416, 0.45), white = mat(0xece8de), blush = mat(0xe79c8c, 0.9);
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20);

  add(body, lathe([[0, 0.17], [0.27, 0.17], [0.285, 0.21], [0.21, 0.42], [0.175, 0.58], [0.2, 0.72], [0.19, 0.84], [0.085, 0.905], [0, 0.905]]), robe);
  add(body, new THREE.CylinderGeometry(0.182, 0.186, 0.055, 20), dark, 0, 0.585, 0);                                  // sash
  const collar = add(body, new THREE.TorusGeometry(0.092, 0.024, 8, 20), white, 0, 0.9, 0.012); collar.rotation.x = Math.PI / 2 - 0.25;
  const beads = add(body, new THREE.TorusGeometry(0.125, 0.015, 6, 22), bead, 0, 0.8, 0.1); beads.rotation.x = 1.05;

  const head = new THREE.Group(); head.position.set(0, 0.93, 0); body.add(head);
  add(head, new THREE.SphereGeometry(0.178, 24, 18).scale(1, 0.96, 0.98), skin, 0, 0.15, 0);
  for (const sx of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.036, 10, 8).scale(0.5, 1, 0.8), skin, sx * 0.174, 0.14, 0);                   // ears
    add(head, new THREE.SphereGeometry(0.017, 8, 6).scale(1, 1.25, 0.6), cloth, sx * 0.064, 0.165, 0.158);             // eyes
    add(head, new THREE.SphereGeometry(0.032, 8, 6).scale(1, 0.7, 0.3), blush, sx * 0.105, 0.105, 0.14);              // cheeks
  }
  const arms = [], legs = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 0.19, 0.83, 0); body.add(arm); arms.push(arm);
    add(arm, new THREE.CylinderGeometry(0.052, 0.09, 0.34, 12).translate(0, -0.17, 0), robe);
    add(arm, new THREE.SphereGeometry(0.043, 10, 8), skin, 0, -0.36, 0);
    const leg = new THREE.Group(); leg.position.set(sx * 0.085, 0.24, 0); root.add(leg); legs.push(leg);
    add(leg, new THREE.CylinderGeometry(0.052, 0.05, 0.2, 10).translate(0, -0.1, 0), dark);
    add(leg, new THREE.BoxGeometry(0.095, 0.05, 0.16), cloth, 0, -0.215, 0.03);
  }
  // He casts no real shadow (the shadow map is drawn once, for the buildings); a soft dark patch goes with him.
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  patch.position.y = 0.03; root.add(patch);

  let phase = 0, gait = 0, palms = 0;
  return {
    group: root,
    // `speed` in metres a second; `pray` true to bring the palms together and bow the head a little.
    update(dt, speed, pray, t) {
      gait += ((speed > 0.05 ? 1 : 0) - gait) * Math.min(1, dt * 8); palms += ((pray ? 1 : 0) - palms) * Math.min(1, dt * 4);
      phase += dt * Math.max(speed, 0.4) * 4.4;
      const sw = Math.sin(phase) * 0.6 * gait, breathe = Math.sin(t * 1.6) * 0.004;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      arms.forEach((a, i) => { const sx = i ? 1 : -1; a.rotation.set(-1.25 * palms + (i ? sw : -sw) * 0.55 * (1 - palms), 0, -sx * 0.5 * palms + sx * 0.06); });
      body.position.y = Math.abs(Math.sin(phase)) * 0.028 * gait + breathe; body.rotation.x = 0.07 * gait + 0.1 * palms;
      head.rotation.x = 0.26 * palms + Math.sin(phase * 2) * 0.02 * gait;
    },
  };
}
