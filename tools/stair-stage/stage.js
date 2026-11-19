// A bare stage with one flight of ten steps and the novice on it (tools/stair-strip.cjs, issue #270): he is moved exactly as
// tools/gait-stairs.mjs moves him, and eight frames across one full stride (two steps) are drawn from one side. `before`
// is the monk.js copied from main into app/src/.monk-before.js by the tool.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createMonk as createNow } from "../../app/src/monk.js";
import { createMonk as createWas } from "../../app/src/.monk-before.js";
import { STAIR } from "../../app/src/geo.js";

const W = 300, H = 400, N = 10, LEAD = 4;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8e9497);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xdfe6ea, 0x5a5048, 1.1));
const sun = new THREE.DirectionalLight(0xfff2e0, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -2 }); scene.add(sun, sun.target);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 40);
const stone = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.9 });

function flight(dir) {
  const run = N * STAIR.tread, top = N * STAIR.rise, base = dir > 0 ? 0 : top, nos = STAIR.nosing;
  const f = (z) => Math.min(1, Math.max(0, (z - LEAD) / run + nos / run));
  return { run, surface: (z) => base + dir * top * (Math.ceil(f(z) * N - 1e-6) / N), eye: (z) => base + dir * top * f(z), base, top };
}
const group = new THREE.Group(); scene.add(group);
function build(dir) {
  group.clear(); const fl = flight(dir), T = STAIR.tread, add = (z0, z1, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, h + 3, z1 - z0), stone); m.position.set(0, (h - 3) / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; group.add(m); };
  add(-6, LEAD - STAIR.nosing, fl.base);
  for (let k = 1; k <= N; k++) add(LEAD + (k - 1) * T - STAIR.nosing, LEAD + k * T - STAIR.nosing, fl.base + dir * STAIR.rise * k);
  add(LEAD + N * T - STAIR.nosing, LEAD + N * T + 6, fl.base + dir * fl.top);
  return fl;
}
/** Eight frames across one stride, mid-flight, from `yaw` (0 in front of him, PI/2 his left side, PI behind). */
function strip(version, dir, speed, yaw, fps = 60) {
  const fl = build(dir), m = (version === "before" ? createWas : createNow)(), dt = 1 / fps; scene.add(m.group);
  m.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const cycle = 2 * STAIR.tread / speed, shots = []; let z = 0.2, t = 0, t0 = null;
  while (shots.length < 8 && z < LEAD + fl.run + 4) {
    z += speed * dt; t += dt; m.group.position.set(0, fl.surface(z), z);
    m.update(dt, speed, false, t, (x, zz) => fl.surface(zz), { heightAt: (x, zz) => fl.eye(zz), stairs: z > LEAD - 0.3 && z < LEAD + fl.run + 0.3 }); m.group.updateMatrixWorld(true);
    const landed = m.steps.splice(0).length > 0;
    if (t0 === null && landed && z > LEAD + 1.4) t0 = t;
    if (t0 !== null && t - t0 >= shots.length * cycle / 8 - 1e-9) {
      const cy = fl.eye(z) + 0.45, d = 3.4; sun.position.set(z * 0 + 1.5, cy + 3, z + 2); sun.target.position.set(0, cy, z);
      const cz = z + Math.cos(yaw) * d; camera.position.set(Math.sin(yaw) * d, Math.max(cy + 0.25, fl.surface(cz) + 1.0), cz);   // over the flight when it lies between him and the eye
      camera.lookAt(0, cy, z); renderer.render(scene, camera); shots.push(renderer.domElement.toDataURL("image/png"));
    }
  }
  scene.remove(m.group); return shots;
}
window.stage = { strip, ready: true };
