// The temple grounds: assembles the modules in src/, walks the visitor through them,
// and hands over to the hall interior at the main hall's door.
import * as THREE from "./v/build/three.module.js";
import { FOG_DENSITY } from "./src/glsl.js";
import { createMaterials } from "./src/materials.js";
import { buildSite, createWalker, SITE } from "./src/site.js";
import { createSky, FOG } from "./src/sky.js";
import { createGround } from "./src/ground.js";
import { createBackdrop } from "./src/backdrop.js";
import { createProps } from "./src/props.js";
import { createPost } from "./src/post.js";
import { pickQuality, createGovernor } from "./src/quality.js";

// Address parameters, for testing: ?q=low|medium|high  ?show=<view name>  ?cam=x,z,yaw,pitch  ?fast=1  ?shot=1
const Q = new URLSearchParams(location.search);
const still = Q.has("shot") || matchMedia("(prefers-reduced-motion: reduce)").matches;
const quality = pickQuality(Q.get("q"));

const canvas = document.getElementById("yardGl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;      // applied by the output pass
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG, FOG_DENSITY);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);

const M = createMaterials();
const site = buildSite(M);
scene.add(site.root);
const walker = createWalker(site);
const sky = createSky(renderer, scene, quality, site.sunFocus);
const ground = createGround(scene, site.shade, site.censer);
const backdrop = createBackdrop(scene, SITE);
const props = createProps(scene, M, site.censer, (SITE.zN + SITE.zS) / 2);
const post = createPost(renderer, scene, camera, quality);

// ---- Looking and walking ------------------------------------------------------
const EYE = 1.62;
const pose = Q.has("cam") ? Q.get("cam").split(",").map(Number) : site.views[Q.get("show")] || site.start;
const pos = new THREE.Vector3(pose[0], EYE, pose[1]);
let yaw = pose[2], pitch = pose[3], target = null, route = [], running = true, eyeY = EYE + walker.heightAt(pos.x, pos.z), doorArmed = true;

let down = null;
canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
canvas.addEventListener("pointermove", (e) => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.moved && Math.hypot(dx, dy) < (e.pointerType === "mouse" ? 6 : 14)) return;   // a finger never lands perfectly still
  down.moved = true; yaw += dx * 0.0042; pitch = THREE.MathUtils.clamp(pitch + dy * 0.0042, -0.5, 0.75);
  down.x = e.clientX; down.y = e.clientY;
});
const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
canvas.addEventListener("pointerup", (e) => {
  canvas.style.cursor = "grab";
  if (down && !down.moved && performance.now() - down.t < 600) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.ray.intersectPlane(floor, new THREE.Vector3());
    const hall = site.hall, toHall = ray.ray.intersectsBox(hall.box) && pos.z > hall.door.z && pos.z < 15.5, onGround = walker.onGround(pos.x, pos.z);
    // Tapping the main hall from its court means "go to its door"; the way there, and back, is over the steps.
    if (toHall) route = onGround ? [hall.foot.clone(), hall.door.clone()] : [hall.door.clone()];
    else if (hit && hit.distanceTo(pos) < 70) route = [hit];
    else route = [];
    if (route.length) { target = route.shift(); document.getElementById("hint").classList.add("gone"); }
  }
  down = null;
});
const keys = {};
addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  // Device pixels, scaled by the tier, then capped by its pixel budget.
  let k = Math.min(devicePixelRatio, 2) * quality.scale;
  const px = w * h * k * k; if (px > quality.budget) k *= Math.sqrt(quality.budget / px);
  renderer.setPixelRatio(k); renderer.setSize(w, h, false);
  post.resize(w, h, k);
  ground.resize(Math.round(w * k * quality.planar), Math.round(h * k * quality.planar), quality.planar > 0);
  camera.aspect = w / h; camera.fov = w < h ? 68 : 52; camera.updateProjectionMatrix();
}
const governor = createGovernor(quality, resize);
new ResizeObserver(resize).observe(canvas); resize();

let prev = performance.now(), frames = 0;
function frame(now) {
  if (!running) return;
  governor.tick((now - prev) / 1000);
  const dt = Math.min(0.05, (now - prev) / 1000), t = still ? 0 : now / 1000; prev = now;

  // Walk: keys or the tapped spot, at a slow pace, sliding along what blocks the way.
  const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), s = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  let vx = 0, vz = 0;
  if (f || s) { target = null; route = []; vx = Math.sin(yaw) * f + Math.cos(yaw) * s; vz = -Math.cos(yaw) * f + Math.sin(yaw) * s; }
  else if (target) { vx = target.x - pos.x; vz = target.z - pos.z; if (Math.hypot(vx, vz) < 0.02) { target = route.shift() || null; vx = vz = 0; } }
  const len = Math.hypot(vx, vz);
  if (len > 0) {
    const step = Math.min(f || s ? 1e9 : len, (Q.has("fast") ? 14 : 2.1) * dt); vx = (vx / len) * step; vz = (vz / len) * step;
    if (!walker.blocked(pos.x + vx, pos.z + vz)) { pos.x += vx; pos.z += vz; }
    else if (!walker.blocked(pos.x + vx, pos.z)) pos.x += vx;
    else if (!walker.blocked(pos.x, pos.z + vz)) pos.z += vz;
    else { target = null; route = []; }
    // The censer does not stop you: you are eased around it.
    const cx = pos.x - site.censer.x, cz = pos.z - site.censer.z, cd = Math.hypot(cx, cz);
    if (cd < 1.25) { const k = 1.25 / Math.max(cd, 1e-3); pos.x = site.censer.x + (cx || 0.01) * k; pos.z = site.censer.z + cz * k; }
  }
  eyeY += (EYE + walker.heightAt(pos.x, pos.z) - eyeY) * Math.min(1, dt * 9);
  camera.position.set(pos.x, eyeY + (len > 0 && !still ? Math.sin(t * 6.5) * 0.018 : 0), pos.z);
  camera.rotation.set(pitch, -yaw, 0, "YXZ");
  camera.updateMatrixWorld();
  // Crossing the threshold hands over to the hall interior.
  const atDoor = site.hall.inside(pos.x, pos.z);
  if (!atDoor) doorArmed = true;
  else if (doorArmed) { doorArmed = false; target = null; route = []; window.dispatchEvent(new CustomEvent("enter-hall")); }

  sky.update(t); backdrop.update(t); props.update(t, dt, still);
  if (frames < 3) renderer.shadowMap.needsUpdate = true;
  if (quality.planar > 0) ground.render(renderer, camera);
  post.render(t);
  if (++frames === 3) document.body.dataset.ready = "1";
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setTimeout(() => document.getElementById("hint").classList.add("gone"), 9000);

window.addEventListener("yard-pause", () => { running = false; });
window.addEventListener("yard-resume", () => {
  // Step back out of the hall: on the porch, facing the courtyard.
  pos.set(site.hall.out[0], EYE, site.hall.out[1]); yaw = Math.PI; pitch = 0.04; target = null; route = []; doorArmed = false;
  eyeY = EYE + walker.heightAt(pos.x, pos.z); for (const k in keys) keys[k] = false;
  if (!running) { running = true; prev = performance.now(); requestAnimationFrame(frame); }
});
// For the test tools.
window.__yard = () => ({ tier: quality.name, scale: +quality.scale.toFixed(2), planar: quality.planar, governed: governor.level, x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), h: +walker.heightAt(pos.x, pos.z).toFixed(2), target: target && [+target.x.toFixed(2), +target.z.toFixed(2)], route: route.length, running, frames, tris: renderer.info.render.triangles, calls: renderer.info.render.calls });
window.__views = Object.keys(site.views);
