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
  // The censer's smoke: forty soft puffs, drawn together as one cloud of points.
  const N = 40, sg = new THREE.BufferGeometry(), sp = new Float32Array(N * 3), sa = new Float32Array(N * 2);
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("puff", new THREE.BufferAttribute(sa, 2));
  for (let i = 0; i < N; i++) smoke.push({ t: i / N, seed: Math.random() * 100 });
  const su = { tMap: { value: tex }, uPx: { value: 800 }, uCol: { value: new THREE.Color(0.94, 0.94, 0.92) } };
  const cloud = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: su, transparent: true, depthWrite: false,
    vertexShader: "attribute vec2 puff; uniform float uPx; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=puff.x*uPx*projectionMatrix[1][1]*.5/max(-mv.z,.2); vA=puff.y; }",
    fragmentShader: "uniform sampler2D tMap; uniform vec3 uCol; varying float vA; void main(){ gl_FragColor=vec4(uCol,texture2D(tMap,gl_PointCoord).a*vA); }" }));
  cloud.frustumCulled = false; scene.add(cloud);
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5, color: 0xdfe6e4, fog: false }));
    // Beyond the walls, on either side, all the way up the hill: never over the courts or across a roof, where a
    // sheet of mist reads as a pale pane hung in front of the building.
    const a = i * 2.4, x0 = (i % 2 ? 1 : -1) * (44 + (i % 3) * 9);
    s.position.set(x0, 5 + (i % 4) * 2.2, 84 - i * 17); s.scale.set(38, 12, 1);
    s.userData = { a, x0 }; mist.push(s); scene.add(s);
  }
  return {
    setMood(m) { for (const sp of mist) { sp.material.color.setRGB(...m.fog).multiplyScalar(1.08); sp.material.opacity = 0.5 * m.mist; } },
    update(t, dt, still, px = 800) {
      su.uPx.value = px;
      for (const sp of mist) if (!still) sp.position.x = sp.userData.x0 + Math.sin(t * 0.03 + sp.userData.a * 3) * 6;
      smoke.forEach((u, i) => {
        if (!still) u.t = (u.t + dt * 0.09) % 1;
        const a = u.t, sway = a * a;
        sp[i * 3] = at.x + Math.sin(t * 0.5 + u.seed + a * 5) * 0.4 * sway + a * 0.5; sp[i * 3 + 1] = 1.02 + a * 4.2; sp[i * 3 + 2] = at.z + Math.cos(t * 0.4 + u.seed * 1.7 + a * 4) * 0.3 * sway;
        sa[i * 2] = 0.05 + a * 0.9; sa[i * 2 + 1] = Math.sin(Math.min(1, a * 6) * Math.PI / 2) * (1 - a) * 0.4;
      });
      sg.attributes.position.needsUpdate = true; sg.attributes.puff.needsUpdate = true;
    },
  };
}
