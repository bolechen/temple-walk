// A bare stage for the novice alone (tools/novice-views.cjs): no temple, so software rendering draws a frame in moments.
// He is moved exactly as the unit tests move him (monk.update, frame by frame), so every view of a pose is the same
// instant and two bodies can be set side by side frame for frame.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createMonk } from "../../app/src/monk.js";
import { bodyOf } from "../../app/src/novice.js";

const W = 300, H = 640;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8e9497);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xdfe6ea, 0x5a5048, 1.1));
const sun = new THREE.DirectionalLight(0xfff2e0, 1.6); sun.position.set(1.2, 3, 2); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1.5, bottom: -0.6 }); scene.add(sun);
const camera = new THREE.PerspectiveCamera(26, W / H, 0.05, 30);
const floorM = new THREE.MeshStandardMaterial({ color: 0x6f7375, roughness: 0.9 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const seatM = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.8 });
const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.44, 24), seatM); stool.position.y = -0.22; stool.castShadow = stool.receiveShadow = true;
const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.104, 24), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.95 })); cushion.position.y = -0.052; cushion.receiveShadow = true;

let monk = null;
function fresh() {
  if (monk) scene.remove(monk.group);
  monk = createMonk(); scene.add(monk.group);
  monk.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  return monk;
}
let body = null;
async function load(url) { const gltf = await new GLTFLoader().loadAsync(url); body = { gltf }; }
function dress(m) { if (!body) return; const { geometries, material, robeColor } = bodyOf(body.gltf.scene, body.gltf.parser.json.extras, m); const g = {}; for (const k in geometries) g[k] = geometries[k].clone(); material.envMapIntensity = 0.45; m.dress(g, material, robeColor); m.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } }); }

// The poses, as tests/unit/novice.test.mjs and tools/novice-weld-trial.mjs run them: frames to settle, then the frame shown.
const POSES = {
  stand: (m) => { for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); },
  pray: (m) => { for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {}); },
  walk: (m, f = 52) => { for (let i = 0; i <= f; i++) m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); },
  chair: (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "chair", i / 30, () => -0.44, {}); },
  sit: (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "sit", i / 30, () => -0.104, {}); },
};
/** Pose him and look from `yaw` (0: before him) and `pitch`; returns a PNG data URL. */
function shot(pose, yaw, pitch = 0.08, frame) {
  const m = fresh(); dress(m); POSES[pose](m, frame); m.group.updateMatrixWorld(true);
  const seated = pose === "chair" || pose === "sit";
  scene.remove(stool, cushion); if (pose === "chair") scene.add(stool); if (pose === "sit") scene.add(cushion);
  floor.position.y = pose === "chair" ? -0.44 : pose === "sit" ? -0.104 : 0;
  const cy = seated ? 0.35 : 0.6, d = 3.3;
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, cy + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
  camera.lookAt(0, cy, 0); renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/png");
}
window.stage = { load, shot, ready: true };
