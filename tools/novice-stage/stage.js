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
let body = null; const bodies = {};
// `load` fetches a body and wears it from then on; `use(url)` goes back to one already fetched, `use(null)` to the body built in code.
async function load(url) { const gltf = await new GLTFLoader().loadAsync(url); body = bodies[url] = { gltf }; }
function use(url) { body = url ? bodies[url] : null; }
// `stage.faces`: back faces magenta and the background green, to tell the inside of the cloth from a hole through it.
function showFaces(m) {
  if (!stage.faces) { scene.background.set(0x8e9497); return; }
  scene.background.set(0x00ff00);
  m.group.traverse((o) => { if (!o.isMesh || !o.material) return; const mat = o.material.clone(); mat.side = THREE.DoubleSide;
    mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);'); };
    mat.customProgramCacheKey = () => 'faces'; o.material = mat; });
}
function dress(m) { if (!body) return; const { geometries, material, robeColor } = bodyOf(body.gltf.scene, body.gltf.parser.json.extras, m); const g = {}; for (const k in geometries) g[k] = geometries[k].clone(); material.envMapIntensity = 0.45; m.dress(g, material, robeColor); m.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } }); }

// The poses, as tests/unit/novice.test.mjs and tools/novice-weld-trial.mjs run them: frames to settle, then the frame shown.
const POSES = {
  stand: (m) => { for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); },
  pray: (m) => { for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {}); },
  walk: (m, f = 52) => { for (let i = 0; i <= f; i++) m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); },
  chair: (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "chair", i / 30, () => -0.44, {}); },
  sit: (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "sit", i / 30, () => -0.104, {}); },
  // Two of the observances' hand places, as rites.js sets them (issue #246: do the hands still meet the body?): the bowl
  // of tea held in both hands at his lips, and the incense raised between his palms to the brow. Each frame the hands
  // are sent where rites.js would send them from the bones of the frame before.
  tea: (m) => hold(m, (B, act) => {
    const mouth = B.head.localToWorld(new THREE.Vector3(0, 0.052, 0.128)), cup = mouth.sub(new THREE.Vector3(0, 0.06, -0.07));
    bowl.position.copy(cup); scene.add(bowl);
    for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; h.at.set(s * 0.068, 0.034, 0.012).add(cup); h.fingers.set(-s * 0.45, 0.15, 1).normalize(); h.palm.set(-s, 0.25, 0).normalize(); h.w = 1; }
  }),
  incense: (m) => hold(m, (B, act) => { for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; B.head.localToWorld(h.at.set(s * 0.0125, 0.15, 0.15)); h.fingers.set(0, 1, 0.25).normalize(); h.palm.set(-s, 0, 0); h.w = 1; } }),
};
const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.05, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x3d3a36, roughness: 0.5, side: THREE.DoubleSide }));
function hold(m, set) {
  const hand = () => ({ at: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(1, 0, 0), w: 0 });
  const act = { bow: 0, twist: 0, nod: 0, look: 0, breath: null, hands: { left: hand(), right: hand() } };
  for (let i = 0; i < 90; i++) { m.group.updateMatrixWorld(true); set(m.bones, act); m.update(1 / 30, 0, false, i / 30, () => 0, { act }); }
}
/** Pose him and look from `yaw` (0: before him) and `pitch`; returns a PNG data URL. */
function shot(pose, yaw, pitch = 0.08, frame, near = 1) {
  scene.remove(bowl); const m = fresh(); dress(m); showFaces(m); POSES[pose](m, frame); for (const n of stage.hide || []) if (m.parts[n]) m.parts[n].visible = false; m.group.updateMatrixWorld(true);
  const seated = pose === "chair" || pose === "sit";
  scene.remove(stool, cushion); if (pose !== "tea") scene.remove(bowl); if (pose === "chair") scene.add(stool); if (pose === "sit") scene.add(cushion);
  floor.position.y = pose === "chair" ? -0.44 : pose === "sit" ? -0.104 : 0;
  const cy = (seated ? 0.35 : 0.6) * (near > 1 ? 0.0 : 1) + (near > 1 ? stage.focus ?? (seated ? 0.3 : 0.6) : 0), d = 3.3 / near;
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, cy + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
  camera.lookAt(0, cy, 0); renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/png");
}
const stage = { load, use, shot, ready: true, focus: null };
window.stage = stage;
