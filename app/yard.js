// The temple grounds: assembles the modules in src/, walks the visitor through them,
// and hands over to the hall interior at the main hall's door.
import * as THREE from "./v/build/three.module.js";
import { FOG_DENSITY, U } from "./src/glsl.js";
import { createMaterials } from "./src/materials.js";
import { buildSite, createWalker, SITE, LEVELS, APPROACH, terrain } from "./src/site.js";
import { createSky, FOG } from "./src/sky.js";
import { createGround } from "./src/ground.js";
import { createBackdrop } from "./src/backdrop.js";
import { createProps } from "./src/props.js";
import { createPost } from "./src/post.js";
import { pickQuality, createGovernor } from "./src/quality.js";
import { strike, startAmbience, listen } from "./src/audio.js";
import { createBamboo } from "./src/bamboo.js";
import { createTrees } from "./src/trees.js";
import { createDrift } from "./src/drift.js";
import { createMonk } from "./src/monk.js";
import { moodOf, moodNow, SEASONS, TIMES, NAMES } from "./src/mood.js";
import { composeCard } from "./src/card.js";

// Address parameters, for testing: ?q=low|medium|high  ?show=<view name>  ?cam=x,z,yaw,pitch  ?fast=1  ?shot=1
//   ?season=spring|summer|autumn|winter  ?time=dawn|day|dusk|night  ?view=first|third
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
renderer.info.autoReset = false;   // so one frame's count covers every pass

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG, FOG_DENSITY);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 800);

const M = createMaterials();
const site = buildSite(M);
scene.add(site.root);
const walker = createWalker(site);
const sky = createSky(renderer, scene, quality, site.sunFocus);
const ground = createGround(scene, site.shade, site.censer, site.paving);
const backdrop = createBackdrop(scene, M, SITE, [LEVELS[0], LEVELS[2]], terrain);
// Real bamboo where you come close to it: all round the zigzag you arrive by and the forecourt, and beyond the tea.
const hill = { zS: LEVELS[1].zN, zN: LEVELS[2].zS }, A = APPROACH;
const near = (x, z, x0, x1, z0, z1, m) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
const bamboo = createBamboo(scene, [
  { x0: -28, x1: 44, z0: SITE.fore - 2, z1: A.zC1 + 12, n: 1150 },
  { x0: -34, x1: -13, z0: SITE.zS + 1, z1: SITE.fore, n: 130 }, { x0: 13, x1: 34, z0: SITE.zS + 1, z1: SITE.fore, n: 130 },
  { x0: -40, x1: -26.5, z0: LEVELS[2].zN - 5, z1: hill.zS, n: 190 }, { x0: 26.5, x1: 40, z0: LEVELS[2].zN - 5, z1: hill.zS, n: 190 },
], terrain, (x, z) => {
  if (z > SITE.fore - 0.5) return !(near(x, z, -A.w / 2, A.w / 2, SITE.fore, A.zA0, 0.9) || near(x, z, -A.w / 2, A.xB1 + 4.6, A.zA0, A.zA1, 0.8) || near(x, z, 3.6, 9.6, A.zA0 - 5.8, A.zA0, 0.5) || near(x, z, A.xC - A.w / 2, A.xC + A.w / 2, A.zA1, A.zC0, 0.9) || near(x, z, A.xB0, A.xB1 + 6, A.zC0, A.zC1, 0.7));   // clear of the path and the half-way pavilion
  if (z > SITE.zS) return !(x < -7.5 && x > -17.5 && z > 45.5 && z < 55.5);                 // clear of the stele pavilion
  return true;
});
const props = createProps(scene, M, site.censer, (SITE.zN + SITE.zS) / 2);
const post = createPost(renderer, scene, camera, quality);
// The trees that show the season, in every court; the things that fall through the air; the lamps' glow after dark.
const T1 = LEVELS[0], TOP = LEVELS[2];
const trees = createTrees(scene, M, [
  [11.5, 0, 52.5, "ginkgo", 11], [-9.5, 0, 28, "maple", 7.5], [9.5, 0, 28, "ginkgo", 9.5], [-11.5, 0, 3.5, "maple", 7], [11.5, 0, 3.5, "maple", 7.5],
  [9, T1.y, T1.zS - 5.5, "maple", 7], [-9.5, T1.y, T1.zS - 6, "ginkgo", 9], [-9, TOP.y, TOP.zS - 4.5, "maple", 6.5], [9.5, TOP.y, TOP.zS - 4.5, "ginkgo", 8],
]);
const drift = createDrift(scene, quality.name === "low" ? 420 : 800);
const glows = [];
{
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,190,110,1)"); g.addColorStop(0.3, "rgba(255,150,70,.35)"); g.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), p = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  site.root.traverse((o) => {
    if (!o.isMesh || o.material !== M.flame) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    sp.position.copy(o.getWorldPosition(p)); sp.scale.setScalar(2.6); glows.push(sp); scene.add(sp);
  });
}

// ---- The hour and the season ----------------------------------------------------
const nowMood = moodNow();
const state = { season: SEASONS.includes(Q.get("season")) ? Q.get("season") : Q.has("shot") || Q.has("show") || Q.has("cam") ? "summer" : nowMood.season,
                time: TIMES.includes(Q.get("time")) ? Q.get("time") : Q.has("shot") || Q.has("show") || Q.has("cam") ? "day" : nowMood.time };
let mood = null;
function setMood(season, time) {
  state.season = season; state.time = time; mood = moodOf(season, time);
  sky.setMood(mood);
  U.uSnow.value = mood.snow; U.uWet.value = mood.wet; U.uLamp.value = mood.lamp; U.uLeaf.value.setRGB(...mood.leaf);
  backdrop.setMood(mood); bamboo.setMood(mood); props.setMood(mood); post.setMood(mood); trees.setMood(mood); drift.setMood(mood, U.uLight.value);
  for (const g of glows) g.material.opacity = Math.min(1, mood.lamp * 0.6);
  renderer.toneMappingExposure = mood.exp;
  renderer.shadowMap.needsUpdate = true;
  document.querySelectorAll("[data-season]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.season === season)));
  document.querySelectorAll("[data-time]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === time)));
  const tag = document.getElementById("moodTag"); if (tag) tag.textContent = mood.label;
}
setMood(state.season, state.time);

// ---- The novice ------------------------------------------------------------------
const monk = createMonk(); scene.add(monk.group);
let view = Q.get("view") === "third" || (!Q.has("view") && !Q.has("show") && !Q.has("cam")) ? "third" : "first";
const photo = { on: false, aspect: "tall", lens: 46, dist: 4.6, monk: true, pray: false };
const ASPECT = { tall: [3, 4], square: [1, 1], wide: [16, 9] };

// ---- Looking and walking ------------------------------------------------------
const EYE = 1.3;   // the eye height of a child
const pose = Q.has("cam") ? Q.get("cam").split(",").map(Number) : site.views[Q.get("show")] || site.start;
const pos = new THREE.Vector3(pose[0], EYE, pose[1]);
let yaw = pose[2], pitch = pose[3], target = null, route = [], running = true, footY = walker.heightAt(pos.x, pos.z), doorArmed = true;
let heading = Math.atan2(Math.sin(yaw), -Math.cos(yaw)), camDist = 4.4, speedNow = 0;
if (view === "third" && !Q.has("cam") && !Q.has("show")) pitch = -0.1;

let down = null;
// The first touch lets the place be heard: deepest in the bamboo on the way up, and again beyond the tea.
const grove = () => (pos.z > SITE.fore - 6 ? Math.min(1, (pos.z - SITE.fore + 6) / 10) : pos.z < LEVELS[1].zN ? 0.55 : 0.12);
canvas.addEventListener("pointerdown", () => startAmbience(() => ({ grove: grove() })), { once: true });
const touches = new Map(); let pinch = 0;
const zoom = (k) => { if (photo.on) photo.dist = THREE.MathUtils.clamp(photo.dist * k, 1.6, 16); };
canvas.addEventListener("pointerdown", (e) => {
  touches.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing";
  if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); down = null; return; }
  down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
});
canvas.addEventListener("pointermove", (e) => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size === 2) { const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch > 0) zoom(pinch / d); pinch = d; return; }
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.moved && Math.hypot(dx, dy) < (e.pointerType === "mouse" ? 6 : 14)) return;   // a finger never lands perfectly still
  const orbit = view === "third" || photo.on;                                              // round him, or from his eyes
  down.moved = true; yaw += dx * 0.0042; pitch = THREE.MathUtils.clamp(pitch + dy * 0.0042, orbit ? -1.0 : -0.5, orbit ? 0.45 : 0.75);
  down.x = e.clientX; down.y = e.clientY;
});
canvas.addEventListener("wheel", (e) => { zoom(e.deltaY > 0 ? 1.1 : 0.91); e.preventDefault(); }, { passive: false });
const lift = (e) => { touches.delete(e.pointerId); pinch = 0; };
canvas.addEventListener("pointercancel", (e) => { lift(e); down = null; });
const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
canvas.addEventListener("pointerup", (e) => {
  canvas.style.cursor = "grab"; lift(e);
  if (down && !down.moved && performance.now() - down.t < 600 && !photo.on) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    // The bell and the drum answer a tap from anywhere in their court.
    const struck = ray.intersectObjects(site.strikers.map((s) => s.mesh), false)[0];
    if (struck && struck.distance < 32) {
      const s = site.strikers.find((k) => k.mesh === struck.object);
      strike(s.kind, Math.min(1, 9 / Math.max(6, struck.distance) + 0.25)); s.t0 = performance.now();
      document.getElementById("hint").classList.add("gone"); down = null; return;
    }
    const hit = ray.ray.intersectPlane(floor, new THREE.Vector3());
    const hall = site.hall, toHall = ray.ray.intersectsBox(hall.box) && pos.z > hall.door.z && pos.z < SITE.zS - 4, onGround = walker.onGround(pos.x, pos.z);
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
  camera.aspect = w / h; camera.fov = photo.on ? photo.lens : w < h ? 68 : 52; camera.updateProjectionMatrix();
  pxH = h * k; layoutFrame();
}
let pxH = 800;
// The frame of the photograph, drawn over the view: what is inside it is what will be kept.
function frameRect() {
  const cw = canvas.clientWidth, ch = canvas.clientHeight, [aw, ah] = ASPECT[photo.aspect], r = aw / ah;
  let h = ch * 0.74, w = h * r; if (w > cw * 0.92) { w = cw * 0.92; h = w / r; }
  return { w, h, x: (cw - w) / 2, y: (ch - h) / 2 };
}
function layoutFrame() {
  const el = document.getElementById("frame"); if (!el) return;
  const f = frameRect(); Object.assign(el.style, { left: f.x + "px", top: f.y + "px", width: f.w + "px", height: f.h + "px" });
}
const governor = createGovernor(quality, resize);
new ResizeObserver(resize).observe(canvas); resize();

let prev = performance.now(), frames = 0;
const load = { tris: 0, calls: 0, ms: 0 };
function frame(now) {
  if (!running) return;
  governor.tick((now - prev) / 1000);
  const dt = Math.min(0.05, (now - prev) / 1000), t = still ? 0 : now / 1000; prev = now;

  // Walk: keys or the tapped spot, at a slow pace, sliding along what blocks the way.
  const f = photo.on ? 0 : (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), s = photo.on ? 0 : (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const x0 = pos.x, z0 = pos.z;
  let vx = 0, vz = 0;
  if (f || s) { target = null; route = []; vx = Math.sin(yaw) * f + Math.cos(yaw) * s; vz = -Math.cos(yaw) * f + Math.sin(yaw) * s; }
  else if (target) { vx = target.x - pos.x; vz = target.z - pos.z; if (Math.hypot(vx, vz) < 0.02) { target = route.shift() || null; vx = vz = 0; } }
  const len = Math.hypot(vx, vz);
  if (len > 0) {
    const step = Math.min(f || s ? 1e9 : len, (Q.has("fast") ? 14 : 2.1) * dt); vx = (vx / len) * step; vz = (vz / len) * step;
    // Take the step; if something is in the way, slide along it, and failing that close the last gap in smaller steps.
    let moved = false;
    for (let k = 1; k > 0.1 && !moved; k /= 2) {
      const sx = vx * k, sz = vz * k;
      if (!walker.blocked(pos.x + sx, pos.z + sz)) { pos.x += sx; pos.z += sz; moved = true; }
      else if (Math.abs(sx) > 1e-4 && !walker.blocked(pos.x + sx, pos.z)) { pos.x += sx; moved = true; }
      else if (Math.abs(sz) > 1e-4 && !walker.blocked(pos.x, pos.z + sz)) { pos.z += sz; moved = true; }
    }
    if (!moved) { target = null; route = []; }
    // The censer does not stop you: you are eased around it.
    const cx = pos.x - site.censer.x, cz = pos.z - site.censer.z, cd = Math.hypot(cx, cz);
    if (cd < 1.25) { const k = 1.25 / Math.max(cd, 1e-3); pos.x = site.censer.x + (cx || 0.01) * k; pos.z = site.censer.z + cz * k; }
  }
  footY += (walker.heightAt(pos.x, pos.z) - footY) * Math.min(1, dt * 9);
  // The novice: where he stands, which way he faces, how fast he is going.
  const moved = Math.hypot(pos.x - x0, pos.z - z0);
  speedNow += ((dt > 0 ? Math.min(moved / dt, 2.4) : 0) - speedNow) * Math.min(1, dt * 10);
  const want = view === "first" && !photo.on ? Math.atan2(Math.sin(yaw), -Math.cos(yaw)) : moved > 1e-4 ? Math.atan2(pos.x - x0, pos.z - z0) : heading;
  heading += Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * Math.min(1, dt * 9);
  monk.group.position.set(pos.x, footY, pos.z); monk.group.rotation.y = heading;
  monk.group.visible = photo.on ? photo.monk : view === "third";
  monk.update(dt, still ? 0 : speedNow, photo.on && photo.pray, t);
  // The eye: his own, or one that follows a few steps behind and keeps out of walls.
  const cp = Math.cos(pitch), lx = Math.sin(yaw) * cp, ly = Math.sin(pitch), lz = -Math.cos(yaw) * cp;
  if (view === "first" && !photo.on) camera.position.set(pos.x, footY + EYE + (len > 0 && !still ? Math.sin(t * 6.5) * 0.015 : 0), pos.z);
  else {
    const ty = footY + 1.12, reach = photo.on ? photo.dist : 4.4; let d = 0.5;
    for (let s2 = 0.5; s2 <= reach + 1e-3; s2 += 0.25) {
      const cx = pos.x - lx * s2, cz = pos.z - lz * s2, cy = ty - ly * s2;
      if (walker.blocked(cx, cz) && cy < walker.heightAt(pos.x, pos.z) + 5.5) break;
      d = s2;
    }
    camDist = d < camDist ? d : camDist + (d - camDist) * Math.min(1, dt * 4);
    const cx = pos.x - lx * camDist, cz = pos.z - lz * camDist;
    camera.position.set(cx, Math.max(ty - ly * camDist, Math.min(walker.heightAt(cx, cz), footY + 1.5) + 0.3), cz);
  }
  camera.rotation.set(pitch, -yaw, 0, "YXZ");
  camera.updateMatrixWorld();
  // Crossing the threshold hands over to the hall interior.
  const atDoor = site.hall.inside(pos.x, pos.z);
  if (!atDoor) doorArmed = true;
  else if (doorArmed) { doorArmed = false; target = null; route = []; window.dispatchEvent(new CustomEvent("enter-hall")); }

  sky.update(t); backdrop.update(t); props.update(t, dt, still); drift.update(t, camera.position, pxH);
  for (const s of site.strikers) if (s.swing && s.t0) {   // the striking log swings in, then settles
    const u = (now - s.t0) / 1000; s.swing.position.z = u > 4 ? 0 : -0.75 * Math.exp(-u * 1.3) * Math.cos(u * 4.2) * (u < 0.18 ? u / 0.18 : 1);
  }
  load.tris = renderer.info.render.triangles; load.calls = renderer.info.render.calls; renderer.info.reset();
  if (frames < 3) renderer.shadowMap.needsUpdate = true;
  if (quality.planar > 0) ground.render(renderer, camera);
  post.render(t);
  if (++frames === 3) document.body.dataset.ready = "1";
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setTimeout(() => document.getElementById("hint").classList.add("gone"), 9000);

// ---- The controls at the edge of the view ------------------------------------------
const $ = (id) => document.getElementById(id), on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
if (Q.has("shot")) document.body.classList.add("bare");
const setView = (v) => { view = v; pitch = v === "third" ? Math.min(pitch, -0.08) : Math.max(pitch, 0); const b = $("viewBtn"); if (b) b.textContent = v === "third" ? "身外" : "眼中"; };
setView(view);
on("viewBtn", () => setView(view === "third" ? "first" : "third"));
on("moodBtn", () => $("moodPanel").toggleAttribute("hidden"));
document.querySelectorAll("[data-season]").forEach((b) => b.addEventListener("click", () => setMood(b.dataset.season, state.time)));
document.querySelectorAll("[data-time]").forEach((b) => b.addEventListener("click", () => setMood(state.season, b.dataset.time)));

// ---- Taking a photograph ------------------------------------------------------------
function setPhoto(open) {
  photo.on = open; document.body.classList.toggle("photo", open); $("moodPanel")?.setAttribute("hidden", "");
  if (open) { target = null; route = []; photo.dist = 7; pitch = Math.min(pitch, 0.02); }
  else if (view === "first") pitch = Math.max(pitch, 0);
  resize();
}
on("photoBtn", () => setPhoto(true)); on("photoClose", () => setPhoto(false));
document.querySelectorAll("[data-aspect]").forEach((b) => b.addEventListener("click", () => { photo.aspect = b.dataset.aspect; document.querySelectorAll("[data-aspect]").forEach((o) => o.setAttribute("aria-pressed", String(o === b))); layoutFrame(); }));
document.querySelectorAll("[data-lens]").forEach((b) => b.addEventListener("click", () => { photo.lens = +b.dataset.lens; document.querySelectorAll("[data-lens]").forEach((o) => o.setAttribute("aria-pressed", String(o === b))); resize(); }));
on("monkToggle", (e) => { photo.monk = !photo.monk; e.currentTarget.setAttribute("aria-pressed", String(photo.monk)); });
on("prayToggle", (e) => { photo.pray = !photo.pray; e.currentTarget.setAttribute("aria-pressed", String(photo.pray)); });

// Draw the framed part of the view again, large, and mount it on its card.
async function capture() {
  const [aw, ah] = ASPECT[photo.aspect], long = quality.name === "low" ? 1600 : 2160;
  const W = aw >= ah ? long : Math.round((long * aw) / ah), H = aw >= ah ? Math.round((long * ah) / aw) : long;
  const f = frameRect(), keepFov = camera.fov;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(keepFov) / 2) * (f.h / canvas.clientHeight)));
  camera.aspect = W / H; camera.updateProjectionMatrix();
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); post.resize(W, H, 1); ground.resize(W >> 1, H >> 1, true);
  const t = still ? 0 : performance.now() / 1000;
  drift.update(t, camera.position, H); ground.render(renderer, camera); post.render(t);
  const shot = document.createElement("canvas"); shot.width = W; shot.height = H; shot.getContext("2d").drawImage(canvas, 0, 0);
  camera.fov = keepFov; resize();
  return composeCard(shot, { line: mood.line, label: mood.label, temple: "云径禅寺", url: location.host + location.pathname.replace(/\/$/, "") });
}
let lastBlob = null;
on("shutter", async () => {
  const b = $("shutter"); b.disabled = true;
  try {
    const card = await capture();
    lastBlob = await new Promise((r) => card.toBlob(r, "image/jpeg", 0.93));
    const url = URL.createObjectURL(lastBlob); $("printImg").src = url; $("saveLink").href = url;
    $("saveLink").download = `云径禅寺-${NAMES[state.season]}${NAMES[state.time]}.jpg`;
    const file = new File([lastBlob], "yunjing.jpg", { type: "image/jpeg" });
    $("shareBtn").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    $("print").hidden = false;
  } finally { b.disabled = false; }
});
on("printBack", () => { $("print").hidden = true; });
on("shareBtn", async () => {
  try { await navigator.share({ files: [new File([lastBlob], "yunjing.jpg", { type: "image/jpeg" })], title: "云径禅寺", text: mood.line }); } catch {}
});

window.addEventListener("yard-pause", () => { running = false; });
window.addEventListener("yard-resume", () => {
  // Step back out of the hall: on the porch, facing the courtyard.
  pos.set(site.hall.out[0], EYE, site.hall.out[1]); yaw = Math.PI; pitch = view === "third" ? -0.1 : 0.04; target = null; route = []; doorArmed = false;
  footY = walker.heightAt(pos.x, pos.z); heading = 0; for (const k in keys) keys[k] = false;
  if (!running) { running = true; prev = performance.now(); requestAnimationFrame(frame); }
});
// For the test tools.
window.__yard = () => ({ tier: quality.name, scale: +quality.scale.toFixed(2), planar: quality.planar, governed: governor.level, x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), h: +walker.heightAt(pos.x, pos.z).toFixed(2), target: target && [+target.x.toFixed(2), +target.z.toFixed(2)], route: route.length, running, frames, tris: load.tris, calls: load.calls });
window.__views = Object.keys(site.views);
window.__mood = setMood; window.__view = setView; window.__photo = (open, opts) => { setPhoto(open); Object.assign(photo, opts || {}); resize(); };
window.__capture = async () => { const c = await capture(); return { w: c.width, h: c.height, url: c.toDataURL("image/jpeg", 0.9) }; };
window.__pose = (x, z, y, p) => { pos.x = x; pos.z = z; yaw = y; pitch = p; footY = walker.heightAt(x, z); };
window.__listen = listen; window.__strike = strike;
window.__walk = (pts) => { route = pts.map(([x, z]) => new THREE.Vector3(x, 0, z)); target = route.shift(); };
