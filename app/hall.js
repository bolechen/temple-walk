
import * as THREE from "./v/build/three.module.js";
import { GLTFLoader } from "./v/jsm/loaders/GLTFLoader.js";

// ---- Plate calibration (pixels of the 941x1672 plate) ----------------------
// Verticals in the plate are parallel: the camera is level with a vertical lens
// shift, so the horizon sits below the image centre.
const PLATE_W = 941, PLATE_H = 1672, HORIZON_Y = 1004, FOCAL_PX = 1793, EYE = 1.5;
const PLATFORM = { top: 0.5, frontZ: -14.5, depth: 3.25 };
const BUDDHA_H = 3.2;
const PED = { w: BUDDHA_H * 1.083, d: BUDDHA_H * 0.653, h: BUDDHA_H * 0.117 }; // /zen proportions
const CENTER_Z = PLATFORM.frontZ - PLATFORM.depth * 0.56;
const CENSER_Z = -9;
const HAZE = 0x2a2723;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

const stage = document.getElementById("stage");
const canvas = document.getElementById("hallGl");
const mirror = document.getElementById("mirror");
const mctx = mirror.getContext("2d");
const ui = document.getElementById("ui");

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
// Hall air: lifts the statue's blacks slightly so it sits at its distance.
scene.fog = new THREE.Fog(HAZE, 5, 75);
const fullH = 2 * Math.max(HORIZON_Y, PLATE_H - HORIZON_Y);
const camera = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2 * Math.atan(fullH / 2 / FOCAL_PX)), PLATE_W / fullH, 0.1, 100);
camera.position.set(0, EYE, 0);
camera.lookAt(0, EYE, -1);

// ---- Lights: one job each, as in the /zen scene -----------------------------
const door = new THREE.DirectionalLight(0xdfe6ee, 1.5); // soft daylight from the doorway
door.position.set(-1.5, 5.5, 2);
door.target.position.set(0, 1.6, CENTER_Z);
door.castShadow = true;
door.shadow.mapSize.set(2048, 2048);
door.shadow.radius = 9;
door.shadow.bias = -0.0004;
Object.assign(door.shadow.camera, { left: -4, right: 4, top: 5, bottom: -1, near: 1, far: 40 });
scene.add(door, door.target);
scene.add(new THREE.HemisphereLight(0x5b616b, 0x2b241c, 0.55));
const face = new THREE.SpotLight(0xfff1dc, 30, 30, 0.16, 0.9, 1.6); // eyes and brow stay readable
face.position.set(0.6, 3.4, -6);
face.target.position.set(0, PLATFORM.top + PED.h + BUDDHA_H * 0.8, CENTER_Z);
scene.add(face, face.target);
for (const sx of [-1, 1]) { // the two oil lamps painted in the plate
  const lamp = new THREE.PointLight(0xffa24a, 5, 9, 1.8);
  lamp.position.set(sx * 3.07, 1.22, -14.1);
  scene.add(lamp);
}

// ---- Shadow receivers and contact darkening ---------------------------------
const top = new THREE.Mesh(new THREE.PlaneGeometry(5.2, PLATFORM.depth), new THREE.ShadowMaterial({ opacity: 0.5, fog: false }));
top.rotation.x = -Math.PI / 2;
top.position.set(0, PLATFORM.top + 0.002, PLATFORM.frontZ - PLATFORM.depth / 2);
top.receiveShadow = true;
const wall = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.6), new THREE.ShadowMaterial({ opacity: 0.3, fog: false }));
wall.position.set(0, PLATFORM.top + 1.8, PLATFORM.frontZ - PLATFORM.depth - 0.25);
wall.receiveShadow = true;
scene.add(top, wall);

function softDisc(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  stops.forEach(([o, col]) => r.addColorStop(o, col));
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const darkTex = softDisc([[0, "rgba(0,0,0,.78)"], [0.55, "rgba(0,0,0,.42)"], [1, "rgba(0,0,0,0)"]]);
function contactBlob(w, d, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: darkTex, transparent: true, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, y, z); return m;
}
scene.add(contactBlob(PED.w * 1.5, PED.d * 1.9, PLATFORM.top + 0.004, CENTER_Z));

// ---- Statue ------------------------------------------------------------------
function fit(obj, size) {
  const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  if (typeof size === "number") obj.scale.multiplyScalar(size / s.y);
  else obj.scale.multiply(new THREE.Vector3(size.w / s.x, size.h / s.y, size.d / s.z));
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
  const g = new THREE.Group(); g.add(obj); return g;
}
const loader = new GLTFLoader();
// Models ship as base64 inside JSON because the host serves no binary model types.
async function loadModel(url) {
  const { glb } = await (await fetch(url)).json();
  const bytes = Uint8Array.fromBase64 ? Uint8Array.fromBase64(glb) : Uint8Array.from(atob(glb), (c) => c.charCodeAt(0));
  return (await loader.parseAsync(bytes.buffer, "")).scene;
}
let buddhaRaw, pedRaw;
try {
  [buddhaRaw, pedRaw] = await Promise.all([loadModel("m/buddha.json"), loadModel("m/pedestal.json")]);
} catch (err) {
  document.getElementById("note").textContent = "佛像没有加载出来：" + (err && err.message ? err.message : err);
  document.getElementById("offer").hidden = true;
  throw err;
}
buddhaRaw.traverse((o) => {
  if (!o.isMesh) return;
  o.castShadow = true;
  // /zen contract: baked old-gold base colour, non-metal, no environment map.
  o.material.metalness = 0; o.material.roughness = 0.5; o.material.envMapIntensity = 0;
});
pedRaw.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.metalness = 0; o.material.roughness = 0.95; } });
const ped = fit(pedRaw, PED);
ped.position.set(0, PLATFORM.top, CENTER_Z);
const buddha = fit(buddhaRaw, BUDDHA_H);
buddha.position.set(0, PLATFORM.top + PED.h, CENTER_Z);
scene.add(ped, buddha);
// Two smaller figures in dark iron sit before the main one, as the old iron Buddhas of the temple sit
// with it: three in all. They share the main statue's geometry.
const ironMat = {};
for (const sx of [-1, 1]) {
  const fig = buddhaRaw.clone(true);
  fig.traverse((o) => {
    if (!o.isMesh) return;
    ironMat[o.material.uuid] = ironMat[o.material.uuid] || Object.assign(o.material.clone(), { roughness: 0.72, metalness: 0.45 });
    o.material = ironMat[o.material.uuid]; o.material.color.set(0x57524c); o.castShadow = true;
  });
  const g = new THREE.Group(); g.add(fig); g.scale.setScalar(0.44);
  g.position.set(sx * 1.92, PLATFORM.top, PLATFORM.frontZ - 0.62);
  scene.add(g); scene.add(contactBlob(1.9, 1.3, PLATFORM.top + 0.005, PLATFORM.frontZ - 0.62).translateX(sx * 1.92));
}

// ---- Censer (placeholder shape), incense, smoke, dust: hidden from the mirror pass
const extras = new THREE.Group(); scene.add(extras);
const bronze = new THREE.MeshStandardMaterial({ color: 0x4a4136, metalness: 0.5, roughness: 0.62 });
const profile = [[0, 0.22], [0.16, 0.22], [0.27, 0.28], [0.33, 0.38], [0.33, 0.47], [0.37, 0.5], [0.37, 0.54], [0.31, 0.54], [0.29, 0.46], [0, 0.43]]
  .map(([x, y]) => new THREE.Vector2(x, y));
const censer = new THREE.Group();
censer.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 40), bronze));
for (let i = 0; i < 3; i++) {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.26, 10), bronze);
  const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
  leg.position.set(Math.cos(a) * 0.2, 0.13, Math.sin(a) * 0.2); censer.add(leg);
}
for (const sx of [-1, 1]) { // two upright ears
  const ear = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI), bronze);
  ear.position.set(sx * 0.34, 0.54, 0); ear.rotation.y = Math.PI / 2; censer.add(ear);
}
censer.traverse((o) => { if (o.isMesh) o.castShadow = true; });
censer.position.set(0, 0, CENSER_Z);
extras.add(censer, contactBlob(1.3, 0.8, 0.004, CENSER_Z));

const STICK_LEN = 0.42, STICK_BASE = 0.44;
const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, STICK_LEN, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.9 }));
const ember = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8a3a, fog: false }));
const emberLight = new THREE.PointLight(0xff9a50, 0, 3, 2);
stick.visible = ember.visible = false;
extras.add(stick, ember, emberLight);

const smokeTex = softDisc([[0, "rgba(235,232,225,.5)"], [0.5, "rgba(235,232,225,.16)"], [1, "rgba(235,232,225,0)"]]);
const SMOKE_N = 46, smoke = [];
for (let i = 0; i < SMOKE_N; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, fog: false }));
  s.userData = { t: i / SMOKE_N, seed: Math.random() * 100 };
  smoke.push(s); extras.add(s);
}

const DUST_N = 240, dustPos = new Float32Array(DUST_N * 3), dustSeed = new Float32Array(DUST_N);
for (let i = 0; i < DUST_N; i++) {
  dustPos.set([(Math.random() - 0.5) * 7, 0.3 + Math.random() * 5.5, -3 - Math.random() * 10], i * 3);
  dustSeed[i] = Math.random() * 100;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dustBase = dustPos.slice();
extras.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
  map: softDisc([[0, "rgba(255,246,230,.9)"], [1, "rgba(255,246,230,0)"]]), size: 0.035, sizeAttenuation: true,
  transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
})));

// ---- State -------------------------------------------------------------------
let yaw = 0, yawTarget = 0, dragging = false, lastX = 0;
let lit = false, litAt = 0, dirty = true, k = 1;
const MAX_YAW = THREE.MathUtils.degToRad(32);

stage.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; stage.setPointerCapture(e.pointerId); stage.style.cursor = "grabbing"; });
stage.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  yawTarget = THREE.MathUtils.clamp(yawTarget + (e.clientX - lastX) * 0.006, -MAX_YAW, MAX_YAW); lastX = e.clientX;
});
const release = () => { dragging = false; yawTarget = 0; stage.style.cursor = "grab"; }; // the statue always returns to face you
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);

document.getElementById("offer").addEventListener("click", () => {
  if (lit) return;
  lit = true; litAt = performance.now(); yawTarget = 0; window.dispatchEvent(new CustomEvent("incense-offered"));
  stick.visible = ember.visible = true;
  ui.classList.add("gone");
});

function resize() {
  // Cover the viewport with the plate's aspect: crop the sides on wide screens, mostly the floor on tall ones.
  const box = stage.parentElement.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const h = Math.max(box.height, box.width * PLATE_H / PLATE_W), w = h * PLATE_W / PLATE_H;
  Object.assign(stage.style, { width: w + "px", height: h + "px", left: (box.width - w) / 2 + "px", top: (box.height - h) * 0.3 + "px" });
  const r = { width: w, height: h };
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(r.width, r.height, false);
  k = r.height / PLATE_H;
  // Vertical lens shift: the visible frame is the top part of a taller, horizon-centred frame.
  camera.setViewOffset(r.width, fullH * k, 0, (fullH / 2 - HORIZON_Y) * k, r.width, r.height);
  mirror.width = canvas.width; mirror.height = canvas.height;
  dirty = true;
}
new ResizeObserver(resize).observe(document.body);
resize();

function drawMirror() {
  // A planar mirror at one depth is a 2D flip about that depth's floor line.
  extras.visible = false;
  renderer.render(scene, camera);
  const floorY = ((HORIZON_Y + (EYE * FOCAL_PX) / -CENTER_Z) / PLATE_H) * canvas.height;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, mirror.width, mirror.height);
  mctx.setTransform(1, 0, 0, -1, 0, 2 * floorY);
  mctx.drawImage(canvas, 0, 0);
  extras.visible = true;
}

let prev = performance.now(), shown = false, running = false;
function frame(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - prev) / 1000), t = now / 1000; prev = now;

  const before = yaw;
  yaw += (yawTarget - yaw) * Math.min(1, dt * (dragging ? 12 : 3));
  if (Math.abs(yaw - before) > 1e-5) { buddha.rotation.y = yaw; dirty = true; }

  // Incense: the stick rises, then burns; ember breathes; smoke follows the tip.
  const burn = lit ? Math.min(1, (now - litAt) / 2200) : 0;
  const tipY = STICK_BASE + STICK_LEN * burn;
  stick.position.set(0, STICK_BASE + (STICK_LEN * burn) / 2 - (STICK_LEN * (1 - burn)) / 2, CENSER_Z);
  ember.position.set(0, tipY, CENSER_Z);
  emberLight.position.copy(ember.position);
  emberLight.intensity = burn * (0.9 + (still ? 0 : Math.sin(t * 2.1) * 0.25));
  for (const s of smoke) {
    const u = s.userData;
    if (!still) u.t = (u.t + dt * 0.11) % 1;
    const a = u.t, rise = a * 3.4, sway = a * a;
    s.position.set(
      Math.sin(t * 0.5 + u.seed + a * 5) * 0.28 * sway + Math.sin(t * 0.17 + u.seed) * 0.12 * a,
      tipY + rise,
      CENSER_Z + Math.cos(t * 0.4 + u.seed * 1.7 + a * 4) * 0.2 * sway
    );
    s.scale.setScalar(0.03 + a * 0.6);
    s.material.opacity = burn * Math.sin(Math.min(1, a * 6) * Math.PI / 2) * (1 - a) * 0.62;
  }
  if (!still) {
    for (let i = 0; i < DUST_N; i++) {
      dustPos[i * 3] = dustBase[i * 3] + Math.sin(t * 0.12 + dustSeed[i]) * 0.35;
      dustPos[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(t * 0.09 + dustSeed[i] * 2.3) * 0.25;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  if (dirty) { renderer.shadowMap.needsUpdate = true; drawMirror(); dirty = false; }
  renderer.render(scene, camera);
  if (!shown) { shown = true; canvas.classList.add("on"); mirror.classList.add("on"); document.body.dataset.hall = "1"; }
  requestAnimationFrame(frame);
}
window.addEventListener("hall-show", () => {
  yaw = yawTarget = 0; buddha.rotation.y = 0; resize();
  if (!running) { running = true; prev = performance.now(); requestAnimationFrame(frame); }
});
window.addEventListener("hall-hide", () => { running = false; });

