// The temple grounds: assembles the modules in src/, walks the visitor through them,
// and hands over to the hall interior at the main hall's door.
import * as THREE from "./v/build/three.module.js";
import { FOG_DENSITY, U } from "./src/glsl.js";
import { createMaterials } from "./src/materials.js";
import { mergeStatic } from "./src/geo.js";
import { buildSite, createWalker, SITE, LEVELS, APPROACH, terrain } from "./src/site.js";
import { createSky, FOG, SUN_DIR } from "./src/sky.js";
import { createGround } from "./src/ground.js";
import { createBackdrop } from "./src/backdrop.js";
import { createProps } from "./src/props.js";
import { createPost } from "./src/post.js";
import { pickQuality, createGovernor } from "./src/quality.js";
import { strike, startAmbience, listen, setVolume } from "./src/audio.js";
import { createSettings, browserSettingsStore } from "./src/settings.js";
import { createBamboo } from "./src/bamboo.js";
import { createTrees } from "./src/trees.js";
import { createDrift } from "./src/drift.js";
import { createMonk } from "./src/monk.js";
import { moodOf, moodNow, SEASONS, TIMES, NAMES } from "./src/mood.js";
import { composeCard } from "./src/card.js";
import { loadTextures, textureState } from "./src/textures.js";
import { createGame } from "./src/game.js";
import { buildInteriors } from "./src/interior.js";
import { createHints } from "./src/hints.js";
import { createTour } from "./src/tour.js";
import { findDrop, dropPose } from "./src/drop.js";

// Address parameters, for testing: ?q=low|medium|high  ?show=<view name>  ?cam=x,z,yaw,pitch  ?fast=1  ?shot=1
//   ?season=spring|summer|autumn|winter  ?time=dawn|day|dusk|night  ?view=first|third
const Q = new URLSearchParams(location.search);
const still = Q.has("shot") || matchMedia("(prefers-reduced-motion: reduce)").matches;
const hints = createHints({ off: Q.has("shot") }); let arrived = false;   // what is said about the controls, and when
const settings = createSettings(browserSettingsStore()); setVolume(settings.get().volume);   // what the visitor has set for themselves (the pause menu)
const quality = pickQuality(Q.get("q") || (settings.get().quality !== "auto" ? settings.get().quality : null));
const loading = window.templeLoading;

const canvas = document.getElementById("yardGl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;      // applied by the output pass
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;   // so one frame's count covers every pass

loading.textures(loadTextures(Math.min(8, renderer.capabilities.getMaxAnisotropy()), loading.textures));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG, FOG_DENSITY);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 800);

// Each part of the scene is named as it is made, so that it can be counted, and switched off to see what it costs
// (?off=bamboo,trees,... ; also reflect, bloom and shadow for the passes). See window.__census().
const OFF = new Set((Q.get("off") || "").split(",").filter(Boolean));
const part = (name, make) => { const n = scene.children.length, made = make(); for (const o of scene.children.slice(n)) { o.userData.part = name; if (OFF.has(name)) o.visible = false; } return made; };
if (OFF.has("reflect")) quality.planar = 0;
if (OFF.has("bloom")) quality.bloom = false;
if (OFF.has("shadow")) renderer.shadowMap.enabled = false;

await loading.step("山路");
const M = createMaterials();
const site = buildSite(M);
part("site", () => scene.add(site.root));
const walker = createWalker(site);
await loading.step("山门");
// The great hall's interior: a room of its own, far below the courts, entered at the hall's door.
const rooms = part("interior", () => { const h = buildInteriors(M, site.halls); scene.add(h.group); return h; });
site.places.incense = rooms.places.incense;
await loading.step("殿堂");
let hallIn = null;   // the room he is in, when he is in one
const sky = part("sky", () => createSky(renderer, scene, quality, site.sunFocus));
const ground = part("ground", () => createGround(scene, site.shade, site.censer, site.paving));
const backdrop = part("backdrop", () => createBackdrop(scene, M, SITE, [LEVELS[0], LEVELS[2]], terrain));
await loading.step("山林");
// Real bamboo where you come close to it: all round the zigzag you arrive by and the forecourt, and beyond the tea.
const hill = { zS: LEVELS[1].zN, zN: LEVELS[2].zS }, A = APPROACH;
const near = (x, z, x0, x1, z0, z1, m) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
const bamboo = part("bamboo", () => createBamboo(scene, [
  { x0: -28, x1: 44, z0: SITE.fore + 0.8, z1: A.zC1 + 12, n: 1150 },
  { x0: -36, x1: -23.2, z0: SITE.zS + 1, z1: SITE.fore + 0.8, n: 130 }, { x0: 23.2, x1: 36, z0: SITE.zS + 1, z1: SITE.fore + 0.8, n: 130 },
  { x0: -40, x1: -26.5, z0: LEVELS[2].zN - 5, z1: hill.zS, n: 190 }, { x0: 26.5, x1: 40, z0: LEVELS[2].zN - 5, z1: hill.zS, n: 190 },
], terrain, (x, z) => {
  if (z > SITE.fore - 0.5) return !(near(x, z, -A.w / 2, A.w / 2, SITE.fore, A.zA0, 0.9) || near(x, z, -A.w / 2, A.xB1 + 4.6, A.zA0, A.zA1, 0.8) || near(x, z, 2.4, 8.0, A.zA1, A.zA1 + 5.8, 0.6) || near(x, z, A.xC - A.w / 2, A.xC + A.w / 2, A.zA1, A.zC0, 0.9) || near(x, z, A.xB0, A.xB1 + 6, A.zC0, A.zC1, 0.7));   // clear of the path and the half-way pavilion
  if (z > SITE.zS) return !(x < -7.5 && x > -17.5 && z > 45.5 && z < 55.5);                 // clear of the stele pavilion
  return true;
}, { a2c: quality.msaa > 0, fine: quality.name !== "low" }));
await loading.step("竹林");
const props = part("props", () => createProps(scene, M, site.censer, (SITE.zN + SITE.zS) / 2));
const post = createPost(renderer, scene, camera, quality);
await loading.step("院落");
// The trees that show the season, in every court; the things that fall through the air; the lamps' glow after dark.
const T1 = LEVELS[0], TOP = LEVELS[2];
const trees = part("trees", () => createTrees(scene, M, [
  [11.5, 0, 52.5, "ginkgo", 11], [-9.5, 0, 28, "maple", 7.5], [9.5, 0, 28, "ginkgo", 9.5], [-11.5, 0, 3.5, "maple", 7], [11.5, 0, 3.5, "maple", 7.5],
  [9, T1.y, T1.zS - 5.5, "maple", 7], [-9.5, T1.y, T1.zS - 6, "ginkgo", 9], [-9, TOP.y, TOP.zS - 4.5, "maple", 6.5], [9.5, TOP.y, TOP.zS - 4.5, "ginkgo", 8],
  ...site.cedars,
], { a2c: quality.msaa > 0 }));
const drift = part("drift", () => createDrift(scene, quality.name === "low" ? 420 : 800));
const glows = [];
{
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,190,110,1)"); g.addColorStop(0.3, "rgba(255,150,70,.35)"); g.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), p = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  site.root.traverse((o) => {
    if (!o.isMesh || o.material !== M.flame) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    sp.position.copy(o.getWorldPosition(p)); sp.scale.setScalar((o.userData.glow || 2.6) * 0.55); glows.push(sp); scene.add(sp);
  });
  ground.setLamps(glows.map((g) => ({ x: g.position.x, y: g.position.y, z: g.position.z, reach: g.scale.x > 1 ? 1.9 : 0.9 })));
}

await loading.step("树影");
// Nothing built so far will move again: draw it in as few pieces as the materials allow.
const merged = mergeStatic(site.root, [30, -32, -95, -1e9]);

await loading.step("石阶");
const monk = createMonk(); part("monk", () => scene.add(monk.group));

await loading.step("行走");
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
  for (const g of glows) { g.material.opacity = Math.min(0.7, mood.lamp * 0.45); g.visible = mood.lamp > 0.01; }
  monk.setSun(SUN_DIR, mood.sunI / 3);
  renderer.toneMappingExposure = mood.exp;
  renderer.shadowMap.needsUpdate = true;
  document.querySelectorAll("[data-season]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.season === season)));
  document.querySelectorAll("[data-time]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === time)));
  const tag = document.getElementById("moodTag"); if (tag) { if (tag.textContent && tag.textContent !== mood.label) hints.say.mood(); tag.textContent = mood.label; }
}
setMood(state.season, state.time);

// ---- The novice ------------------------------------------------------------------
let view = Q.get("view") === "third" || (!Q.has("view") && !Q.has("show") && !Q.has("cam")) ? "third" : "first";
const photo = { on: false, aspect: "tall", lens: 46, dist: 4.6, monk: true, pray: false, focus: null };   // focus: metres, or null to follow the novice
const APERTURE = { 66: 0.006, 46: 0.012, 26: 0.022 };
const ASPECT = { tall: [3, 4], square: [1, 1], wide: [16, 9] };

// ---- Looking and walking ------------------------------------------------------
const EYE = 1.3;   // the eye height of a child
const pose = Q.has("cam") ? Q.get("cam").split(",").map(Number) : site.views[Q.get("show")] || site.start;
const pos = new THREE.Vector3(pose[0], EYE, pose[1]);
let yaw = pose[2], pitch = pose[3], target = null, route = [], running = true, footY = walker.heightAt(pos.x, pos.z), doorArmed = true;
let heading = Math.atan2(Math.sin(yaw), -Math.cos(yaw)), camDist = 6.2, sideNow = 1.2, speedNow = 0;
if (view === "third" && !Q.has("cam") && !Q.has("show")) pitch = 0.04;

// What a walk is for, and what he is doing when he has arrived: `arrive` is told whether he got there;
// `stage` holds him in place (facing a way, praying or seated) until the visitor sends him elsewhere.
let arrive = null, stage = null; const ticks = [];
const settle = (ok) => { if (arrive) { const fn = arrive; arrive = null; fn(ok); } };
const interrupt = () => { settle(false); if (stage) { const st = stage; stage = null; st.leave && st.leave(); } };
const menuEl = document.getElementById("menu");
let down = null, hop = null, leap = null;   // `hop`: a planned drop from a porch; `leap`: a small jump where he stands, steered as he goes
// The first touch lets the place be heard: deepest in the bamboo on the way up, and again beyond the tea.
const grove = () => (pos.z > SITE.fore - 6 ? Math.min(1, (pos.z - SITE.fore + 6) / 10) : pos.z < LEVELS[1].zN ? 0.55 : 0.12);
canvas.addEventListener("pointerdown", () => startAmbience(() => ({ grove: grove() })), { once: true });
const touches = new Map(); let pinch = 0;
let reachWant = 6.2;   // how far behind him the eye stands; the wheel changes it
const zoom = (k) => { if (photo.on) photo.dist = THREE.MathUtils.clamp(photo.dist * k, 1.6, 16); else reachWant = THREE.MathUtils.clamp(reachWant * k, 2.6, 11); };
// With a mouse the view is held the way such games hold it: a click on the picture takes the pointer, moving the
// mouse looks round, Esc lets go. A touch still drags to look and taps to walk.
const locked = () => document.pointerLockElement === canvas;
const joy = { x: 0, y: 0 };
document.addEventListener("pointerlockchange", () => { document.body.classList.toggle("held", locked()); if (locked()) hints.say.held(); });
document.addEventListener("mousemove", (e) => {
  if (!locked()) return; const orbit = view === "third" || photo.on;
  const S = settings.get();
  yaw += e.movementX * 0.0026 * S.sens; pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0022 * S.sens * (S.invertY ? -1 : 1), orbit ? -1.0 : -0.75, orbit ? 0.45 : 0.5);
});
canvas.addEventListener("pointerdown", (e) => {
  touches.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing";
  if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); down = null; return; }
  down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
});
canvas.addEventListener("pointermove", (e) => {
  if (locked()) return;   // relative mousemove owns the camera while the pointer is held
  if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size === 2) { const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch > 0) zoom(pinch / d); pinch = d; return; }
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.moved && Math.hypot(dx, dy) < (e.pointerType === "mouse" ? 6 : 14)) return;   // a finger never lands perfectly still
  const orbit = view === "third" || photo.on;                                              // round him, or from his eyes
  const S = settings.get();
  down.moved = true; yaw += dx * 0.0042 * S.sens; pitch = THREE.MathUtils.clamp(pitch - dy * 0.0042 * S.sens * (S.invertY ? -1 : 1), orbit ? -1.0 : -0.75, orbit ? 0.45 : 0.5);   // a finger and a mouse look the same way
  down.x = e.clientX; down.y = e.clientY;
});
canvas.addEventListener("wheel", (e) => { zoom(e.deltaY > 0 ? 1.1 : 0.91); e.preventDefault(); }, { passive: false });
const lift = (e) => { touches.delete(e.pointerId); pinch = 0; };
canvas.addEventListener("pointercancel", (e) => { lift(e); down = null; });
const ray = new THREE.Raycaster();
// Where a tap lands on the ground. The ground is not flat: follow the line of sight outward until it first
// dips below whatever can be stood on there (a court, a terrace, a flight of steps), then close in on that spot.
function pickFloor() {
  const o = ray.ray.origin, d = ray.ray.direction, p = new THREE.Vector3(), under = (s) => { p.copy(d).multiplyScalar(s).add(o); return p.y <= walker.heightAt(p.x, p.z); };
  let a = 0.3, b = -1;
  for (let s = 0.5; s < 90 && b < 0; s += 0.25) { if (under(s)) b = s; else a = s; }
  if (b < 0) return null;
  for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if (under(m)) b = m; else a = m; }
  under(b); return p;
}
canvas.addEventListener("pointerup", (e) => {
  canvas.style.cursor = "grab"; lift(e);
  if (e.pointerType === "mouse" && !photo.on && down && !down.moved) {
    if (!locked()) { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch {} startAmbience(() => ({ grove: grove() })); }
    else {   // held: a click strikes what the middle of the picture rests on
      ray.setFromCamera(new THREE.Vector2(0, 0), camera); const hit = ray.intersectObjects(site.strikers.map((s) => s.mesh), false)[0];
      if (hit && hit.distance < 32) { const s = site.strikers.find((k) => k.mesh === hit.object); strike(s.kind, Math.min(1, 9 / Math.max(6, hit.distance) + 0.25)); s.t0 = performance.now(); window.dispatchEvent(new CustomEvent("struck", { detail: s.kind })); }
    }
    down = null; return;
  }
  if (down && !down.moved && performance.now() - down.t < 600 && photo.on) {   // in a photograph, a tap chooses what is sharp
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hits = ray.intersectObjects([site.root, monk.group], true)[0], floorHit = pickFloor();
    const d = Math.min(hits ? hits.distance : 1e9, floorHit ? floorHit.distanceTo(camera.position) : 1e9);
    photo.focus = d < 200 ? d : null;
  }
  if (down && !down.moved && performance.now() - down.t < 600 && !photo.on) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    // The bell and the drum answer a tap from anywhere in their court.
    const struck = ray.intersectObjects(site.strikers.map((s) => s.mesh), false)[0];
    if (struck && struck.distance < 32) {
      const s = site.strikers.find((k) => k.mesh === struck.object);
      strike(s.kind, Math.min(1, 9 / Math.max(6, struck.distance) + 0.25)); s.t0 = performance.now(); window.dispatchEvent(new CustomEvent("struck", { detail: s.kind }));
      down = null; return;
    }
    const hit = pickFloor();
    const hall = site.hall, toHall = !inside && ray.ray.intersectsBox(hall.box) && pos.z > hall.door.z && pos.z < SITE.zS - 4, onGround = walker.onGround(pos.x, pos.z);
    // Tapping the main hall from its court means "go to its door"; the way there, and back, is over the steps.
    if (toHall) route = onGround ? [hall.foot.clone(), hall.door.clone()] : [hall.door.clone()];
    else if (hit && Math.hypot(hit.x - pos.x, hit.z - pos.z) < 70) route = [hit];
    else route = [];
    if (route.length) { interrupt(); target = route.shift(); }
  }
  down = null;
});
const keys = {};
const dropButton = document.getElementById("dropBtn");
function availableDrop() {
  if (hop || leap || inside || stage || passing || photo.on || !document.body.classList.contains("entered")) return null;   // not in mid-air either
  for (const id of ["book", "print", "slip", "keys", "moodPanel", "menu"]) { const el = document.getElementById(id); if (el && !el.hidden && el.offsetParent !== null) return null; }
  const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - joy.y;
  const s = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + joy.x;
  return findDrop(walker, site.walk.drops, pos.x, pos.z, f || s ? Math.sin(yaw) * f + Math.cos(yaw) * s : Math.sin(yaw), f || s ? -Math.cos(yaw) * f + Math.sin(yaw) * s : -Math.cos(yaw));
}
function startDrop() {
  const plan = availableDrop(); if (!plan) return false;
  interrupt(); target = null; route = []; hop = { plan, elapsed: 0 }; return true;
}
// Space: a child's jump, a hand and a half high. He can be steered in the air and lands on whatever is under him.
const JUMP = { speed: 3.0, gravity: 9.8 };
function startJump() {
  if (hop || leap || stage || passing || photo.on || !document.body.classList.contains("entered")) return false;
  for (const id of ["book", "print", "slip", "keys", "moodPanel", "menu"]) { const el = document.getElementById(id); if (el && !el.hidden && el.offsetParent !== null) return false; }
  leap = { y: footY, v: JUMP.speed }; return true;
}
const jumpButton = document.getElementById("jumpBtn"); if (jumpButton) jumpButton.addEventListener("click", () => { startDrop() || startJump(); });
if (dropButton) { dropButton.innerHTML = hints.coarse ? "下台阶" : "<kbd>Space</kbd>下台阶"; dropButton.addEventListener("click", startDrop); }

addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase(); keys[k] = true; if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const press = (id) => { const el = document.getElementById(id); if (el && el.offsetParent !== null && !el.disabled) { el.click(); return true; } return false; };
  if (!menuEl.hidden && k !== "escape") return;   // while the pause menu is open only Esc is heard
  // The keys such games use: E to do what is offered here, V to change the view, B for the book, P to photograph, T for the season and hour.
  if (k === " " && e.target?.tagName === "BUTTON") return;
  if (hop && (k === "e" || k === "enter" || k === " ")) { e.preventDefault(); return; }
  if (k === " " && e.target?.tagName !== "BUTTON" && startDrop()) { e.preventDefault(); return; }
  if (k === " ") { if (press("slipTake") || press("enterBtn") || startJump()) e.preventDefault(); }   // Space steps in from the title, takes what is held out, and otherwise jumps
  else if (k === "e" || k === "enter") { if (press("slipTake") || press("act") || press("enterBtn") || press("offer")) e.preventDefault(); }
  else if (k === "v") press("viewBtn"); else if (k === "b" || k === "tab") { if (!press("bookClose")) press("bookBtn"); e.preventDefault(); }
  else if (k === "p") { if (!press("photoClose")) press("photoBtn"); } else if (k === "t") press("moodBtn");
  else if (k === "h" || k === "?") hints.card();
  else if (k === "escape") {   // Esc shuts whatever is open; with nothing open it is the pause menu
    const keysOpen = !document.getElementById("keys")?.hidden, moodOpen = !document.getElementById("moodPanel")?.hidden; hints.card(false); if (moodOpen) document.getElementById("moodPanel").hidden = true;
    const shut = [keysOpen, moodOpen, press("menuResume"), press("bookClose"), press("printBack") || press("photoClose")].some(Boolean);
    if (!shut && document.body.classList.contains("entered") && !stage) openMenu(true);
  }
});
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
// A thumb-stick for a touch screen, lower left: push to walk, relative to where he is looking.
{
  const stick = document.getElementById("stick"), knob = document.getElementById("knob"); let id = null, cx = 0, cy = 0;
  if (stick) {
    const move = (e) => { const dx = e.clientX - cx, dy = e.clientY - cy, l = Math.hypot(dx, dy), m = Math.min(l, 46), k = l ? m / l : 0; joy.x = (dx * k) / 46; joy.y = (dy * k) / 46; knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`; };
    const end = (e) => { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; knob.style.transform = ""; };
    stick.addEventListener("pointerdown", (e) => { id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); startAmbience(() => ({ grove: grove() })); e.preventDefault(); });
    stick.addEventListener("pointermove", (e) => { if (e.pointerId === id) move(e); }); stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
  }
}
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  // Device pixels, scaled by the tier, then capped by its pixel budget.
  let k = Math.min(devicePixelRatio, 2) * quality.scale;
  const px = w * h * k * k; if (px > quality.budget) k *= Math.sqrt(quality.budget / px);
  renderer.setPixelRatio(k); renderer.setSize(w, h, false);
  post.resize(w, h, k);
  ground.resize(Math.round(w * k * quality.planar), Math.round(h * k * quality.planar), quality.planar > 0);
  camera.aspect = w / h; camera.fov = photo.on ? photo.lens : view === "third" ? (w < h ? 58 : 44) : w < h ? 68 : 52; camera.updateProjectionMatrix();   // from behind him, a longer lens: the halls stand taller
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

let prev = performance.now(), frames = 0, tour = null, eyeY = footY, mirrorOn = true;
const load = { tris: 0, calls: 0, ms: 0 };
function frame(now) {
  if (!running) return;
  governor.tick((now - prev) / 1000); tour?.frame(now);
  const dt = Math.min(0.05, (now - prev) / 1000), t = still ? 0 : now / 1000; prev = now;

  // Walk: keys or the tapped spot, at a slow pace, sliding along what blocks the way.
  const menuUp = !menuEl.hidden;
  const f = photo.on || menuUp ? 0 : (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - joy.y, s = photo.on || menuUp ? 0 : (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + joy.x;
  const x0 = pos.x, z0 = pos.z, flight = hop, airborne = !!flight;
  let vx = 0, vz = 0;
  if (f || s) { interrupt(); target = null; route = []; vx = Math.sin(yaw) * f + Math.cos(yaw) * s; vz = -Math.cos(yaw) * f + Math.sin(yaw) * s; }
  else if (target) { vx = target.x - pos.x; vz = target.z - pos.z; if (Math.hypot(vx, vz) < 0.02) { target = route.shift() || null; vx = vz = 0; if (!target) settle(true); } }
  const len = Math.hypot(vx, vz);
  if (len > 0 && !airborne) {
    const walkPace = keys.shift || Math.hypot(joy.x, joy.y) > 0.94 ? 4.2 : 2.1 * (f || s ? Math.min(1, Math.max(0.35, len)) : 1);
    const pace = Q.has("fast") ? 14 : Math.min(walkPace, walker.onStairs(pos.x, pos.z) ? keys.shift ? 1.6 : 1.25 : Infinity);   // Shift to hurry; a stick pushed a little walks slowly
    const step = Math.min(f || s ? 1e9 : len, pace * dt); vx = (vx / len) * step; vz = (vz / len) * step;
    // Take the step; if something is in the way, slide along it, and failing that close the last gap in smaller steps.
    let moved = false;
    for (let k = 1; k > 0.1 && !moved; k /= 2) {
      const sx = vx * k, sz = vz * k;
      if (!walker.blocked(pos.x + sx, pos.z + sz)) { pos.x += sx; pos.z += sz; moved = true; }
      else if (Math.abs(sx) > 1e-4 && !walker.blocked(pos.x + sx, pos.z)) { pos.x += sx; moved = true; }
      else if (Math.abs(sz) > 1e-4 && !walker.blocked(pos.x, pos.z + sz)) { pos.z += sz; moved = true; }
    }
    if (!moved) { target = null; route = []; settle(false); }
    // The censer does not stop you: you are eased around it.
    const cx = pos.x - site.censer.x, cz = pos.z - site.censer.z, cd = Math.hypot(cx, cz);
    if (cd < 1.25) { const k = 1.25 / Math.max(cd, 1e-3); pos.x = site.censer.x + (cx || 0.01) * k; pos.z = site.censer.z + cz * k; }
  }
  if (flight) {
    flight.elapsed += dt; const p = dropPose(flight.plan, flight.elapsed); pos.x = p.x; pos.z = p.z; footY = p.y;
    if (p.done) hop = null;
  } else if (leap) {
    const ground = walker.heightAt(pos.x, pos.z); leap.v -= JUMP.gravity * dt; leap.y += leap.v * dt;
    if (leap.y <= ground) { footY = ground; leap = null; } else footY = leap.y;                 // down again, on whatever he has come over
  } else footY = walker.heightAt(pos.x, pos.z);
  const aloft = airborne || !!leap;
  eyeY += ((aloft ? footY : walker.eyeAt(pos.x, pos.z)) - eyeY) * Math.min(1, dt * 12);
  if (dropButton) dropButton.hidden = !availableDrop();
  // The novice: where he stands, which way he faces, how fast he is going.
  const moved = Math.hypot(pos.x - x0, pos.z - z0);
  if (!arrived && document.body.classList.contains("entered")) { arrived = true; hints.say.entered(); }
  if (arrived) hints.step(dt, moved, !!keys.shift, !stage && !photo.on && !aloft);
  speedNow += ((dt > 0 ? Math.min(moved / dt, 2.4) : 0) - speedNow) * Math.min(1, dt * 10);
  const want = flight ? Math.atan2(flight.plan.to[0] - flight.plan.from[0], flight.plan.to[2] - flight.plan.from[2]) : stage ? stage.face : view === "first" && !photo.on ? Math.atan2(Math.sin(yaw), -Math.cos(yaw)) : moved > 1e-4 ? Math.atan2(pos.x - x0, pos.z - z0) : heading;
  heading += Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * Math.min(1, dt * 9);
  monk.group.position.set(pos.x, footY + (stage ? stage.lift || 0 : 0), pos.z); monk.group.rotation.y = heading;
  monk.group.visible = photo.on ? photo.monk : view === "third";
  monk.update(dt, still || aloft ? 0 : speedNow, aloft ? "hop" : stage ? stage.pose : photo.on && photo.pray, t, walker.heightAt, { heightAt: walker.eyeAt, stairs: walker.onStairs(pos.x, pos.z) });
  // The eye: his own, or one that follows behind, as low as a child and a little to one side, so that he stands
  // small in the lower left of the picture and the place fills the rest. It comes in close rather than pass through
  // anything solid, and it never sinks into the ground or the hillside.
  const cp = Math.cos(pitch), lx = Math.sin(yaw) * cp, ly = Math.sin(pitch), lz = -Math.cos(yaw) * cp;
  if (view === "first" && !photo.on) camera.position.set(pos.x, eyeY + (stage && stage.pose === "sit" ? 0.78 : EYE) + (len > 0 && !still ? Math.sin(t * 6.5) * 0.015 : 0), pos.z);
  else {
    const rx = Math.cos(yaw), rz = Math.sin(yaw), wantSide = photo.on || walker.wall(pos.x + rx * 1.4, pos.z + rz * 1.4) ? 0 : 1.2;
    sideNow += (wantSide - sideNow) * Math.min(1, dt * 3);
    const ox = pos.x + rx * sideNow, oz = pos.z + rz * sideNow, ty = (photo.on ? footY : eyeY) + (photo.on ? 0.72 : 1.18), reach = photo.on ? photo.dist : reachWant; let d = 0.5;
    for (let s2 = 0.5; s2 <= reach + 1e-3; s2 += 0.25) {
      const cx = ox - lx * s2, cz = oz - lz * s2, cy = ty - ly * s2;
      if (walker.wall(cx, cz) && cy < walker.heightAt(pos.x, pos.z) + 5.5) break;
      d = s2;
    }
    camDist = d < camDist ? d : camDist + (d - camDist) * Math.min(1, dt * 4);
    const cx = ox - lx * camDist, cz = oz - lz * camDist;
    // Standing on something higher than he is (a platform, a stair above him), the eye rises enough to see his feet over its edge.
    const under = walker.landAt(cx, cz), over = Math.max(0, under - footY);
    camera.position.set(cx, Math.max(ty - ly * camDist, under + 0.35 + over * 1.6), cz);
    if (camDist < 0.95 && !photo.on) monk.group.visible = false;   // backed against a wall, the eye is as good as his own
  }
  camera.rotation.set(pitch, -yaw, 0, "YXZ");
  camera.updateMatrixWorld();
  // Crossing the threshold hands over to the hall interior.
  const atDoor = inside ? null : site.halls.find((h) => h.inside(pos.x, pos.z)) || null;
  if (!atDoor) doorArmed = true;
  else if (doorArmed && !inside && !passing) { doorArmed = false; pass(atDoor); }
  if (inside && !passing && pos.z > hallIn.room.exitZ && Math.abs(pos.x - hallIn.room.cx) < 1.3) pass(null);

  for (const fn of ticks) fn(dt, t);
  U.uT.value = t; sky.update(t); backdrop.update(t); props.update(t, dt, still, pxH); drift.update(t, camera.position, pxH);
  for (const s of site.strikers) if (s.swing && s.t0) {   // the striking log swings in, then settles
    const u = (now - s.t0) / 1000; s.swing.position.z = u > 4 ? 0 : -0.75 * Math.exp(-u * 1.3) * Math.cos(u * 4.2) * (u < 0.18 ? u / 0.18 : 1);
  }
  if (photo.on) post.focus(photo.focus ?? (photo.monk ? camDist : 14), APERTURE[photo.lens] || 0.012);
  load.tris = renderer.info.render.triangles; load.calls = renderer.info.render.calls; renderer.info.reset();
  if (frames < 3) renderer.shadowMap.needsUpdate = true;
  // The mirror lies in the forecourt and the first court: not indoors, not on the terraces above, not down the
  // approach where the eye is under it. A jump does not change which of these he is in.
  if (!aloft) mirrorOn = footY > -0.6 && footY < 0.6;
  if (quality.planar > 0 && !inside && mirrorOn) ground.render(renderer, camera);
  post.render(t);
  // Ready when it has drawn a few frames and every scanned surface has arrived (or been given up on).
  loading.frame(frames + 1);
  if (++frames >= 3 && !document.body.dataset.ready) { const ts = textureState(); if (ts.loaded + ts.failed.length >= ts.total) { if (ts.loaded) renderer.shadowMap.needsUpdate = true; loading.finish(); document.body.dataset.ready = "1"; } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- The controls at the edge of the view ------------------------------------------
const $ = (id) => document.getElementById(id), on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
if (Q.has("shot")) document.body.classList.add("bare");
const setView = (v) => { view = v; pitch = v === "third" ? Math.min(pitch, 0.06) : Math.max(pitch, 0); const b = $("viewBtn"); if (b) b.textContent = v === "third" ? "身外" : "眼中"; resize(); };
setView(view);
on("viewBtn", () => setView(view === "third" ? "first" : "third"));
on("moodBtn", () => $("moodPanel").toggleAttribute("hidden"));
document.querySelectorAll("[data-season]").forEach((b) => b.addEventListener("click", () => setMood(b.dataset.season, state.time)));
document.querySelectorAll("[data-time]").forEach((b) => b.addEventListener("click", () => setMood(state.season, b.dataset.time)));

// ---- Taking a photograph ------------------------------------------------------------
function setPhoto(open) {
  if (!open) post.focus(null);
  photo.on = open; document.body.classList.toggle("photo", open); if (open) hints.say.photo(); else hints.drop("photo"); $("moodPanel")?.setAttribute("hidden", "");
  if (open) { target = null; route = []; photo.dist = 7; photo.focus = null; pitch = Math.min(pitch, 0.02); }
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

// ---- Through the door ----------------------------------------------------------------
// Eyes close on the way in and daylight floods on the way out; behind the veil he is moved between the porch and the
// room, the room's lamps are lit or put out, and the picture is exposed for indoors or for the sky.
let inside = false, passing = false;
const veil = $("veil"), pause = (ms) => new Promise((r) => setTimeout(r, Q.has("fast") ? ms / 6 : ms));
let lastHall = null;
function indoors(hall) {
  if (hall) hints.say.indoors();
  const on = !!hall; if (on) { lastHall = hall; hallIn = rooms.rooms[hall.id]; }
  inside = on; walker.setRoom(on ? hallIn.room : null); interrupt(); target = null; route = []; hop = leap = null;
  for (const r of Object.values(rooms.rooms)) for (const l of r.lights) l.visible = on && r === hallIn;
  for (const o of scene.children) if (["site", "backdrop", "bamboo", "trees", "ground", "props"].includes(o.userData.part)) o.visible = !on && !OFF.has(o.userData.part);   // nothing of the courts is drawn from indoors
  scene.children.forEach((o) => { if (o.userData.part === "drift") o.visible = !on && mood.drift !== "none"; });
  if (on) { pos.set(hallIn.room.door[0], EYE, hallIn.room.door[1]); yaw = 0; U.uLamp.value = 1; sky.indoors(); post.setMood({ ...mood, exp: 1.25, sat: 1.04, lift: 0.004, bloom: 0.45, sh: [0.96, 0.98, 1.06], hi: [1.06, 1, 0.92] }); }
  else { pos.set(lastHall.out[0], EYE, lastHall.out[1]); yaw = lastHall.outYaw; doorArmed = false; setMood(state.season, state.time); }
  pitch = 0.04; footY = eyeY = walker.heightAt(pos.x, pos.z); heading = on ? Math.PI : Math.atan2(Math.sin(yaw), -Math.cos(yaw)); camDist = 0.6; document.body.classList.toggle("indoors", on);
  window.dispatchEvent(new CustomEvent(on ? "entered-hall" : "left-hall", { detail: hall && hall.id }));
}
// `hall`: one of site.halls to go into, or null to come out of the one he is in.
async function pass(hall) {
  const on = !!hall; if (passing) return; passing = true;
  if (veil) veil.className = on ? "on" : "on day"; await pause(900);
  indoors(hall); await pause(200);
  if (veil) { veil.className = on ? "" : "day"; if (!on) { await pause(700); veil.className = ""; } }
  passing = false;
}
if (Q.has("in")) { indoors(site.halls.find((h) => h.id === Q.get("in")) || site.halls.find((h) => h.id === "main")); if (Q.has("cam")) { pos.x = pose[0]; pos.z = pose[1]; yaw = pose[2]; pitch = pose[3]; } }   // ?in=1 begins inside the hall
// For the test tools.
window.__inside = (id) => pass(id ? site.halls.find((h) => h.id === (id === true ? "main" : id)) : null); window.__figures = () => rooms.state.figures; window.__gallery = rooms.spots; window.__halls = site.halls.map((h) => ({ id: h.id, name: h.name, door: h.door, out: h.out }));
window.__yard = () => ({ inside, room: inside ? hallIn.room.id : null, tier: quality.name, scale: +quality.scale.toFixed(2), planar: quality.planar, governed: governor.level, x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), h: +walker.heightAt(pos.x, pos.z).toFixed(2), footY: +monk.group.position.y.toFixed(4), groundY: +walker.heightAt(pos.x, pos.z).toFixed(4), dropping: !!hop, jumping: !!leap, bodyY: +(monk.group.position.y + monk.group.children[0].position.y).toFixed(4), target: target && [+target.x.toFixed(2), +target.z.toFixed(2)], route: route.length, running, frames, tris: load.tris, calls: load.calls });
window.__views = Object.keys(site.views); window.__merged = merged; window.__textures = textureState;
// What a frame costs to draw, in milliseconds: `n` frames drawn back to back, each waited for until the graphics card
// has really finished it. Unlike frames-per-second this leaves out the browser's own work of presenting the picture.
window.__cost = (n = 40) => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const one = () => { renderer.info.reset(); if (quality.planar > 0) ground.render(renderer, camera); post.render(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  for (let i = 0; i < 6; i++) one();
  const t0 = performance.now(); for (let i = 0; i < n; i++) one();
  return +((performance.now() - t0) / n).toFixed(2);
};
// What each part of the scene weighs: meshes, and triangles as drawn (instances counted).
window.__census = () => {
  const out = {};
  for (const top of scene.children) {
    const k = top.userData.part || top.type, row = (out[k] ||= { meshes: 0, tris: 0, hidden: !top.visible });
    top.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isSprite) || !o.geometry) return; row.meshes++;
      const g = o.geometry, n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
      row.tris += Math.round((o.isPoints ? 0 : n / 3) * (o.isInstancedMesh ? o.count : 1));
    });
  }
  return out;
};
// What the picture looks like right now, measured: draws one frame and averages it. Also reports the state the tests assert on.
window.__probe = () => {
  const t = still ? 0 : performance.now() / 1000;
  if (quality.planar > 0) ground.render(renderer, camera); post.render(t);
  const c = document.createElement("canvas"); c.width = 32; c.height = 32; const x = c.getContext("2d"); x.drawImage(canvas, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0, top = 0, n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; if (i < 32 * 8 * 4) top += d[i] + d[i + 1] + d[i + 2]; }
  return { r: r / n, g: g / n, b: b / n, lum: (r + g + b) / (3 * n), sky: top / (32 * 8 * 3), season: state.season, time: state.time, view, photo: photo.on, monk: monk.group.visible,
    camDist: +camera.position.distanceTo(new THREE.Vector3(pos.x, footY + 1, pos.z)).toFixed(2), snow: U.uSnow.value, lamp: U.uLamp.value, fov: camera.fov };
};
window.__mood = setMood; window.__view = setView; window.__photo = (open, opts) => { setPhoto(open); Object.assign(photo, opts || {}); resize(); };
window.__capture = async () => { const c = await capture(); return { w: c.width, h: c.height, url: c.toDataURL("image/jpeg", 0.9) }; };
window.__pose = (x, z, y, p) => { pos.x = x; pos.z = z; yaw = y; pitch = p; footY = eyeY = walker.heightAt(x, z); };
window.__listen = listen; window.__strike = strike;

// ---- The visit as a pilgrimage (src/game.js): what it may ask of the walk ----
window.__hud = () => hints.state();
// ---- The pause menu: what the visitor may set, a way back to the start, the keys ----
function openMenu(open) {
  menuEl.hidden = !open; if (!open) return; document.exitPointerLock?.(); interrupt(); target = null; route = [];
  const S = settings.get();
  menuEl.querySelectorAll("[data-q]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.q === S.quality)));
  $("setSens").value = S.sens; $("setVolume").value = S.volume; $("setInvert").setAttribute("aria-pressed", String(S.invertY)); $("setInvert").textContent = S.invertY ? "开" : "关";
  $("qualityNote").hidden = S.quality === "auto" ? Q.has("q") || quality.fixed !== true : S.quality === quality.name;   // shown when what is chosen is not what is being drawn
}
{
  const set = (k, v) => { settings.set(k, v); openMenu(true); };
  menuEl.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => set("quality", b.dataset.q)));
  $("setSens").addEventListener("input", (e) => settings.set("sens", +e.target.value));
  $("setVolume").addEventListener("input", (e) => { settings.set("volume", +e.target.value); setVolume(settings.get().volume); });
  on("setInvert", () => set("invertY", !settings.get().invertY));
  on("menuResume", () => openMenu(false)); on("menuBtn", () => openMenu(menuEl.hidden)); on("menuKeys", () => { openMenu(false); hints.card(true); });
  on("reloadBtn", () => location.reload());
  // Lost, or wedged somewhere he should not be: back to where the path begins.
  on("menuHome", () => { if (inside) indoors(null); /* straight out, not through the door: the walk back to the porch would undo this */ openMenu(false); const [x, z, y] = site.start; pos.x = x; pos.z = z; yaw = y; pitch = 0.1; footY = eyeY = walker.heightAt(x, z); hop = leap = null; });
}
window.__settings = () => settings.get(); window.__menu = (open) => openMenu(open);
// What lies under a point of the picture, nearest first: which part of the scene, which material, how far, whether it is
// see-through. When something in a screenshot will not be explained, ask this before guessing.
window.__pick = (px, py, n = 6) => {
  const r = canvas.getBoundingClientRect(), rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1), camera);
  return rc.intersectObjects(scene.children, true).filter((h) => h.object.visible).slice(0, n).map((h) => { const m = h.object.material || {}; let o = h.object, part = null; while (o && !part) { part = o.userData.part; o = o.parent; }
    return { part, material: m.customProgramCacheKey && /^[a-zA-Z]+$/.test(m.customProgramCacheKey()) ? m.customProgramCacheKey() : m.type, distance: +h.distance.toFixed(2), at: h.point.toArray().map((v) => +v.toFixed(2)), transparent: !!m.transparent, kind: h.object.type }; });
};
createGame({
  hints,
  site, walker, scene,
  where: () => ({ x: pos.x, z: pos.z }),
  // Send him along `points` ([x, z] each); `then(true)` when he arrives, `then(false)` if he is stopped or sent elsewhere.
  walkTo(points, then) { interrupt(); route = points.map(([x, z]) => new THREE.Vector3(x, 0, z)); target = route.shift(); arrive = then || null; },
  stage(o) { stage = o; },
  strike(kind) { const s = site.strikers.find((k) => k.kind === kind); strike(kind, 1); if (s) s.t0 = performance.now(); window.dispatchEvent(new CustomEvent("struck", { detail: kind })); },
  mood: () => mood, night: () => inside || mood.lamp > 0.5, busy: () => photo.on || !running || passing || !!hop || !!leap, inside: () => inside,
  gallery: rooms.spots, room: () => (inside ? hallIn.room.id : null), hallName: () => (inside && lastHall ? lastHall.name : ""),
  listen: () => startAmbience(() => ({ grove: grove() })),
  onTick: (fn) => ticks.push(fn),
});
window.__walk = (pts) => { route = pts.map(([x, z]) => new THREE.Vector3(x, 0, z)); target = route.shift(); };
// ?tour=120x3: the measured walk from the bamboo to the first court and back (src/tour.js).
if (Q.has("tour")) setView("first");   // it is measured from his own eyes
if (Q.has("tour")) tour = createTour(Q.get("tour"), {
  walk: window.__walk,
  state: () => ({ target: !!target, heading: target ? Math.atan2(target.x - pos.x, -(target.z - pos.z)) : yaw }),
  face: (want, dt) => { const k = 1 - Math.exp(-3 * dt); yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * k; pitch += (0.06 - pitch) * k; },
  env: () => { const gl = renderer.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info"); return { size: [canvas.clientWidth, canvas.clientHeight], dpr: devicePixelRatio, tier: quality.name, scale: +quality.scale.toFixed(2), governed: governor.level, view, season: state.season, time: state.time, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown", ua: navigator.userAgent }; },
});

await loading.step("山路");
