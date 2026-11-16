// The temple grounds: assembles the modules in src/, walks the visitor through them,
// and hands over to the hall interior at the main hall's door.
import * as THREE from "three";
import { FOG_DENSITY, U } from "./src/glsl.js";
import { createMaterials } from "./src/materials.js";
import { mergeStatic } from "./src/geo.js";
import { buildSite, createWalker, SITE, LEVELS, APPROACH, SCREEN, terrain } from "./src/site.js";
import { createSky, FOG, SUN_DIR } from "./src/sky.js";
import { createGround } from "./src/ground.js";
import { createBackdrop } from "./src/backdrop.js";
import { createProps } from "./src/props.js";
import { createPost } from "./src/post.js";
import { pickQuality, createGovernor, mirrorAt } from "./src/quality.js";
import { strike, flutter, cueState, shutterSound, stampSound, photoSounds, bellsRinging, startAmbience, listen, setLevels, musicState, wellDrip, onDrop, knock, bird, ambienceState, footstep, stepState } from "./src/audio.js";
import { createWell } from "./src/well.js";
import { underfoot } from "./src/steps.js";
import { zoneOf, zoneBounds } from "./src/score.js";
import { createSettings, browserSettingsStore } from "./src/settings.js";
import { createBamboo } from "./src/bamboo.js";
import { createTrees } from "./src/trees.js";
import { createDrift } from "./src/drift.js";
import { createTrail } from "./src/trail.js";
import { bakeShelter, useShelter, shelterAt } from "./src/shelter.js";
import { createMonk } from "./src/monk.js";
import { loadNovice } from "./src/novice.js";
import { followEye, createFollow, damp, FOLLOW } from "./src/eye.js";
import { moodOf, moodNow, SEASONS, TIMES, NAMES } from "./src/mood.js";
import { composeCard } from "./src/card.js";
import { loadTextures, textureState } from "./src/textures.js";
import { createGame } from "./src/game.js";
import { track } from "./src/analytics.js";
import { createFlock } from "./src/flock.js";
import { logSwing, riteNow, pauseRites } from "./src/rites.js";
import { buildInteriors } from "./src/interior.js";
import { createHints } from "./src/hints.js";
import { createUI } from "./src/ui.js";
import { createCommunity } from "./src/community.js";
import { createPaper } from "./src/paper.js";
import { createTour } from "./src/tour.js";
import { findDrop, dropPose, seatHop } from "./src/drop.js";

// Address parameters, for testing: ?q=low|medium|high  ?show=<view name>  ?cam=x,z,yaw,pitch  ?fast=1  ?shot=1
//   ?season=spring|summer|autumn|winter  ?time=dawn|day|dusk|night  ?view=first|third
const Q = new URLSearchParams(location.search);
const still = Q.has("shot") || matchMedia("(prefers-reduced-motion: reduce)").matches;
createPaper();   // the paper, strokes and seals the interface is drawn with (src/paper.js, src/ui.css)
const ui = createUI();   // what lies over the picture, in order: Esc puts away the top one (src/ui.js)
createCommunity(ui);
const hints = createHints({ off: Q.has("shot"), ui }); let arrived = false;   // what is said about the controls, and when
const settings = createSettings(browserSettingsStore()); { const S = settings.get(); setLevels({ volume: S.volume, music: S.music, ambience: S.ambience, effects: S.effects }); }   // what the visitor has set for themselves (the pause menu)
const quality = pickQuality(Q.get("q") || (settings.get().quality !== "auto" ? settings.get().quality : null));
const loading = window.templeLoading;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("yardGl"));
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
const PLANAR = quality.planar, PASSES = ["reflect", "bloom", "shadow"];   // the mirror as the tier draws it, for switching it back on
if (OFF.has("reflect")) quality.planar = 0;
if (OFF.has("bloom")) quality.bloom = false;
if (OFF.has("shadow")) renderer.shadowMap.enabled = false;

await loading.step("山路");
const M = createMaterials();
const site = buildSite(M);
const roofMap = bakeShelter(site.walk.roofs); useShelter(roofMap);   // what the roofs keep out of the snow
part("site", () => scene.add(site.root));
const walker = createWalker(site);
await loading.step("山门");
// The great hall's interior: a room of its own, far below the courts, entered at the hall's door.
const rooms = part("interior", () => { const h = buildInteriors(M, site.halls, renderer); scene.add(h.group); return h; });
site.places.incense = rooms.places.incense; site.seats.push(...rooms.seats);
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
const trees = part("trees", () => createTrees(scene, M, site.trees, { a2c: quality.msaa > 0 }));
const drift = part("drift", () => createDrift(scene, quality.name === "low" ? 420 : 800));
// His footprints in the snow: on a phone a smaller square, more coarsely drawn.
const trail = createTrail(renderer, quality.name === "low" ? { size: 1024, span: 24 } : { size: 2048, span: 32 });
const glows = []; let glowCloud = null;
{
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,190,110,1)"); g.addColorStop(0.3, "rgba(255,150,70,.35)"); g.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), p = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  site.root.traverse((/** @type {any} */ o) => {
    if (!o.isMesh || o.material !== M.flame) return;
    glows.push({ position: o.getWorldPosition(p).clone(), scale: { x: (o.userData.glow || 2.6) * 0.55 } });
  });
  // Every flame's halo is one point of a single cloud: thirty lamps, one draw.
  const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(glows.flatMap((g) => g.position.toArray()), 3)); gg.setAttribute("size", new THREE.Float32BufferAttribute(glows.map((g) => g.scale.x), 1));
  glowCloud = new THREE.Points(gg, new THREE.ShaderMaterial({ uniforms: { tMap: { value: tex }, uPx: { value: 800 }, uOp: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "attribute float size; uniform float uPx; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=size*uPx*projectionMatrix[1][1]*.5/max(-mv.z,.2); }",
    fragmentShader: "uniform sampler2D tMap; uniform float uOp; void main(){ vec4 c=texture2D(tMap,gl_PointCoord); gl_FragColor=vec4(c.rgb*c.a*uOp,c.a*uOp); }" }));
  glowCloud.frustumCulled = false; glowCloud.visible = false; if (glows.length) scene.add(glowCloud);
  ground.setLamps(glows.map((g) => ({ x: g.position.x, y: g.position.y, z: g.position.z, reach: g.scale.x > 1 ? 1.9 : 0.9 })));
}

await loading.step("树影");
// Nothing built so far will move again: draw it in as few pieces as the materials allow.
const merged = mergeStatic(site.root, [30, -32, -95, -1e9]);
// The dragon well's drops and the rings they send across the water (well.js); the rite's drops ring it too.
const well = createWell(scene, site.places.well.pool, wellDrip); onDrop(() => well.ripple());
// The birds in the old trees by the bell tower, flushed by the third stroke (flock.js; game.js says when). Not at night,
// when nothing of them would be seen, and not from indoors.
const flock = createFlock(scene, site.cedars, site.places.bell.at);
addEventListener("flush", () => { if (!inside && mood.time !== "night" && flock.flush()) flutter(0.8); });

await loading.step("石阶");
const monk = createMonk(); part("monk", () => scene.add(monk.group));
// He is the figure built in code. The sculpted body's cloth tears at its texture seams when he walks, climbs or sits,
// so until its weights are mended it is fetched (after the first frames) only for ?body=sculpt; ?body=code asks for
// what he already wears.
if (Q.get("body") === "sculpt") loadNovice(monk).catch(() => {});

await loading.step("行走");
// ---- The hour and the season ----------------------------------------------------
const nowMood = moodNow();
const state = { season: SEASONS.includes(Q.get("season")) ? Q.get("season") : Q.has("shot") || Q.has("show") || Q.has("cam") ? "summer" : nowMood.season,
                time: TIMES.includes(Q.get("time")) ? Q.get("time") : Q.has("shot") || Q.has("show") || Q.has("cam") ? "day" : nowMood.time };
let mood = null;
let afterMood = null;   // set further down, once there are rooms: what a change of hour means to someone indoors
function setMood(season, time) {
  state.season = season; state.time = time; mood = moodOf(season, time);
  sky.setMood(mood);
  U.uSnow.value = mood.snow; U.uWet.value = mood.wet; U.uLamp.value = mood.lamp; U.uLeaf.value.fromArray(mood.leaf);
  backdrop.setMood(mood); bamboo.setMood(mood); props.setMood(mood); post.setMood(mood); trees.setMood(mood); drift.setMood(mood, U.uLight.value); trail.enable(mood.snow > 0.01);
  if (glowCloud) { glowCloud.material.uniforms.uOp.value = Math.min(0.7, mood.lamp * 0.45); glowCloud.visible = mood.lamp > 0.01; }
  monk.setSun(SUN_DIR, mood.sunI / 3);
  renderer.toneMappingExposure = mood.exp;
  renderer.shadowMap.needsUpdate = true;
  document.querySelectorAll("[data-season]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.season === season)));
  document.querySelectorAll("[data-time]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === time)));
  const tag = document.getElementById("moodTag"); if (tag) { if (tag.textContent && tag.textContent !== mood.label) hints.say.mood(); tag.textContent = mood.label; }
  afterMood?.();
}
setMood(state.season, state.time);

// ---- The novice ------------------------------------------------------------------
let view = Q.get("view") === "third" || (!Q.has("view") && !Q.has("show") && !Q.has("cam")) ? "third" : "first";
// The camera is raised on what he is looking at: the same eye, the same direction, the whole view. From there it
// only draws nearer or farther (`zoom`: 1 is the view as it was); it does not turn.
const photo = { on: false, aspect: "screen", zoom: 1, monk: false, pray: false };
const ASPECT = { tall: [3, 4], square: [1, 1], wide: [16, 9] }, ZOOM = { min: 0.7, max: 6 };

// ---- Looking and walking ------------------------------------------------------
const EYE = 1.3;   // the eye height of a child
const pose = Q.has("cam") ? Q.get("cam").split(",").map(Number) : site.views[Q.get("show")] || site.start;
// A place copied into an address by an older ?devpose was cut to centimetres, which beside a stair can fall just inside
// the stop along its cheek, where the ground reads as the level below and he would stand sunk into the steps: such a
// place steps out to the nearest free point a few centimetres off.
if (Q.has("cam") && !Q.has("in") && walker.blocked(pose[0], pose[1])) out: for (let r = 0.005; r <= 0.06; r += 0.005) for (let k = 0; k < 16; k++) {
  const x = pose[0] + r * Math.cos((k * Math.PI) / 8), z = pose[1] + r * Math.sin((k * Math.PI) / 8);
  if (!walker.blocked(x, z)) { pose[0] = x; pose[1] = z; break out; }
}
const pos = new THREE.Vector3(pose[0], EYE, pose[1]);
let yaw = pose[2], pitch = pose[3], target = null, route = [], running = true, footY = walker.heightAt(pos.x, pos.z), doorArmed = true;
let heading = Math.atan2(Math.sin(yaw), -Math.cos(yaw)), sideNow = 1.2, speedNow = 0;
const follow = createFollow();
const LOOK_EASE = 0.06, look = { yaw, pitch, vy: 0, vp: 0 };   // the way the view looks this frame, coming round after yaw and pitch
const WALK = { up: 7, down: 8 }, pace = { v: 0, dir: [0, -1] }, bob = { phase: 0, amp: 0 };   // how fast he gathers and loses speed (m/s²); his speed and the way he goes
if (view === "third" && !Q.has("cam") && !Q.has("show")) pitch = 0.04;

// What a walk is for, and what he is doing when he has arrived: `arrive` is told whether he got there;
// `stage` holds him in place (facing a way, praying or seated) until the visitor sends him elsewhere.
let arrive = null, stage = null, cine = null, drawn = null, posed = null; const ticks = [];
const settle = (ok) => { if (arrive) { const fn = arrive; arrive = null; fn(ok); } };
const interrupt = () => { settle(false); if (stage) { const st = stage; stage = null; st.leave && st.leave(); } };
const menuEl = document.getElementById("menu");
let down = null, hop = null, leap = null, climb = null, climbFor = null, climbs = 0;   // `hop`: a planned drop from a porch; `leap`: a small jump where he stands, steered as he goes
// The first touch lets the place be heard: deepest in the bamboo on the way up, and again beyond the tea.
const grove = () => (pos.z > SITE.fore - 6 ? Math.min(1, (pos.z - SITE.fore + 6) / 10) : pos.z < LEVELS[1].zN ? 0.55 : 0.12);
// What the sound needs to know of the place: the bamboo, which part of the mountain (the music follows it), the mood.
const ZB = zoneBounds(SITE, LEVELS, APPROACH, SCREEN);
const hearing = () => ({ grove: grove(), zone: zoneOf(pos.x, pos.z, inside, ZB), season: state.season, time: state.time, wet: mood.wet, snow: mood.snow });
const hear = () => startAmbience(hearing);
canvas.addEventListener("pointerdown", hear, { once: true });
const touches = new Map(); let pinch = 0;
let reachWant = 6.2;   // how far behind him the eye stands; the wheel changes it
// Drawing the eye all the way in to him and on (the wheel, or two fingers closing) puts it behind his own eyes; drawing
// it out of them stands it behind him again. `nudge` gathers how far past the nearest the visitor keeps pushing, so one
// stray notch at the end of a pinch does not change the view.
let nudge = 0;
const zoom = (k) => {
  if (photo.on) { photo.zoom = THREE.MathUtils.clamp(photo.zoom / k, ZOOM.min, ZOOM.max); lens(); return; }
  if (view === "first") { if (k > 1 && (nudge += Math.log(k)) > 0.3) { nudge = 0; reachWant = 2.6; setView("third"); } else if (k < 1) nudge = 0; return; }
  const near = reachWant <= 2.6 + 1e-6; reachWant = THREE.MathUtils.clamp(reachWant * k, 2.6, 11);
  if (k < 1 && near) { if ((nudge -= Math.log(k)) > 0.3) { nudge = 0; setView("first"); } } else nudge = 0;
};
// With a mouse the view turns while a button is held and dragged, as on most pages that show a place in three
// dimensions, and a click walks there or strikes the bell, as a tap does. Holding the pointer the way first-person
// games hold it (a click takes it, any movement of the mouse looks round, Esc lets go) is a setting, `lock`: by
// default it was a surprise to visitors on a web page, and every reach for a button swung the view (2026-11-16).
// How fast: a drag moves the picture a little faster than the pointer itself moves, 1.6 times for a mouse and 2.2
// for a finger, which has less room; it was 0.24° a pixel, five times the pointer. A held mouse turns 0.09° a count,
// about 12 cm of desk to turn right round at 800 dpi, near 《小王子》's 0.11° a pixel (it was 0.15°, 7.7 cm). The
// counts are asked for unaccelerated where the browser can, and a single report larger than any hand gives (a
// browser re-centring the hidden pointer) is dropped. (docs/t00/KNOWN-ISSUES.md, 镜头乱飘.)
const LOOK = { yaw: 0.0016, pitch: 0.0014, spike: 250, mouse: 1.6, touch: 2.2 };
const dragRate = (type) => THREE.MathUtils.degToRad(camera.fov) / Math.max(240, canvas.clientHeight || 0) * (type === "mouse" ? LOOK.mouse : LOOK.touch);
const locked = () => document.pointerLockElement === canvas;
const holdPointer = () => {
  const plain = () => { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch {} };
  try { const p = canvas.requestPointerLock?.({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); } catch { plain(); }
};
const joy = { x: 0, y: 0 };
document.addEventListener("pointerlockchange", () => { document.body.classList.toggle("held", locked()); if (locked()) hints.say.held(); });
document.addEventListener("mousemove", (e) => {
  if (!locked() || photo.on) return; const orbit = view === "third";   // with the camera raised, the view is held still
  const S = settings.get();   // in his own eyes and under a roof he may look up as far as the ceiling
  if (Math.abs(e.movementX) > LOOK.spike || Math.abs(e.movementY) > LOOK.spike) return;
  yaw += e.movementX * LOOK.yaw * S.sens; pitch = THREE.MathUtils.clamp(pitch - e.movementY * LOOK.pitch * S.sens * (S.invertY ? -1 : 1), orbit ? -1.0 : -0.75, orbit ? 0.45 : inside ? 0.9 : 0.5);
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
  if (photo.on) { down.moved = true; return; }                                             // the camera does not turn: a drag is only not a click
  const orbit = view === "third";                                                          // round him, or from his eyes
  const S = settings.get();
  const k = dragRate(e.pointerType);
  down.moved = true; yaw += dx * k * S.sens; pitch = THREE.MathUtils.clamp(pitch - dy * k * S.sens * (S.invertY ? -1 : 1), orbit ? -1.0 : -0.75, orbit ? 0.45 : inside ? 0.9 : 0.5);   // a finger and a mouse look the same way
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
  canvas.style.cursor = photo.on ? "crosshair" : "grab"; lift(e);
  // With the camera raised, the left button on the picture is the shutter.
  if (photo.on) { if (e.pointerType === "mouse" && e.button === 0 && down && !down.moved && ui.top() === "photo" && !$("shutter").disabled) $("shutter").click(); down = null; return; }
  if (e.pointerType === "mouse" && down && !down.moved && (locked() || settings.get().lock)) {
    if (!locked()) { holdPointer(); hear(); }
    else {   // held: a click strikes what the middle of the picture rests on
      ray.setFromCamera(new THREE.Vector2(0, 0), camera); const hit = ray.intersectObjects(site.strikers.map((s) => s.mesh), false)[0];
      if (hit && hit.distance < 32) { const s = site.strikers.find((k) => k.mesh === hit.object); strike(s.kind, Math.min(1, 9 / Math.max(6, hit.distance) + 0.25)); s.t0 = riteNow(); s.lead = 0; window.dispatchEvent(new CustomEvent("struck", { detail: s.kind })); }
    }
    down = null; return;
  }
  if (down && !down.moved && performance.now() - down.t < 600 && !photo.on) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    // The bell and the drum answer a tap from anywhere in their court.
    const struck = ray.intersectObjects(site.strikers.map((s) => s.mesh), false)[0];
    if (struck && struck.distance < 32) {
      const s = site.strikers.find((k) => k.mesh === struck.object);
      strike(s.kind, Math.min(1, 9 / Math.max(6, struck.distance) + 0.25)); s.t0 = riteNow(); s.lead = 0; window.dispatchEvent(new CustomEvent("struck", { detail: s.kind }));
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
  if (ui.covered()) return null;
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
  if (ui.covered()) return false;
  leap = { y: footY, v: JUMP.speed }; return true;
}
if (dropButton) { dropButton.innerHTML = hints.coarse ? "下台阶" : "<kbd>Space</kbd>下台阶"; dropButton.addEventListener("click", startDrop); }

addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase(); keys[k] = true; if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const press = (id) => { const el = /** @type {HTMLButtonElement | null} */ (document.getElementById(id)); if (el && el.offsetParent !== null && !el.disabled) { el.click(); return true; } return false; };
  if (ui.key(e)) return;   // Esc puts away whatever is on top; an open sheet hears only its own keys
  if (photo.on && k === "tab") return;   // Photo controls use normal keyboard focus navigation.
  // The keys such games use: E to do what is offered here, V to change the view, B for the book, P to photograph, T for the season and hour.
  if (k === " " && /** @type {Element} */ (e.target)?.tagName === "BUTTON") return;
  if (hop && (k === "e" || k === "enter" || k === " ")) { e.preventDefault(); return; }
  if (k === " " && /** @type {Element} */ (e.target)?.tagName !== "BUTTON" && startDrop()) { e.preventDefault(); return; }
  if (k === " ") { if (press("enterBtn") || startJump()) e.preventDefault(); }   // Space steps in from the title, and otherwise jumps
  else if (k === "e" || k === "enter") { if (press("act") || press("enterBtn")) e.preventDefault(); }
  else if (k === "v") setView(view === "third" ? "first" : "third"); else if (k === "b" || k === "tab") { press("bookBtn"); e.preventDefault(); }
  else if (k === "p") { if (!press("photoClose")) press("photoBtn"); } else if (k === "t") { if (document.body.classList.contains("seasons")) ui.toggle("moodPanel"); }   // the seasons are the visitor's once the book has been filled once (game.js)
  else if (k === "h" || k === "?") hints.card();
  else if (k === "escape") { if (stage) interrupt(); else if (document.body.classList.contains("entered")) openMenu(true); }   // Esc lets go of what he is doing (the rope, a seat); with nothing open or held, it is the pause menu
});
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
// A thumb-stick for a touch screen, lower left: push to walk, relative to where he is looking.
{
  const stick = document.getElementById("stick"), knob = document.getElementById("knob"); let id = null, cx = 0, cy = 0;
  if (stick) {
    const move = (e) => { const dx = e.clientX - cx, dy = e.clientY - cy, l = Math.hypot(dx, dy), m = Math.min(l, 46), k = l ? m / l : 0; joy.x = (dx * k) / 46; joy.y = (dy * k) / 46; knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`; };
    const end = (e) => { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; knob.style.transform = ""; stick.classList.remove("held"); };
    stick.addEventListener("pointerdown", (e) => { id = e.pointerId; stick.classList.add("held"); stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); hear(); e.preventDefault(); });
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
  camera.aspect = w / h; lens();
  pxH = h * k; layoutFrame();
}
// The angle of view: from behind him a longer lens than from his own eyes (the halls stand taller); and with the
// camera raised, that same angle drawn in or let out by the zoom. A narrow angle makes every turn of the head sweep
// the picture faster and was part of what made a visitor sick, so the walk is seen wider than the fixed views (which
// keep the angle the T00 camera manifest locks, 52° from his eyes, so that old pictures stay comparable): 50° from
// behind him as 《小王子》 has it, 65° from his eyes (Saltline uses 74°), and the visitor may widen or narrow it.
// `?devpose` (the dev server only) writes `cam` into the address as he walks; the view he comes back to is still the walk's.
const DEVPOSE = import.meta.env.DEV && Q.has("devpose");
const FIXED_VIEW = (Q.has("shot") || Q.has("show") || Q.has("cam")) && !DEVPOSE;
function lens() {
  const w = canvas.clientWidth, h = canvas.clientHeight, tall = w < h;
  const base = FIXED_VIEW ? (view === "third" ? (tall ? 58 : 44) : tall ? 68 : 52) : (view === "third" ? (tall ? 62 : 50) : tall ? 75 : 65) + settings.get().fov;
  camera.fov = photo.on ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / photo.zoom)) : base; camera.updateProjectionMatrix();
}
let pxH = 800;
// The frame of the photograph, drawn over the view: what is inside it is what will be kept.
function frameRect() {
  const cw = canvas.clientWidth, ch = canvas.clientHeight; if (photo.aspect === "screen") return { w: cw, h: ch, x: 0, y: 0 };   // the whole view, as he sees it
  const [aw, ah] = ASPECT[photo.aspect], r = aw / ah;
  let h = ch * 0.74, w = h * r; if (w > cw * 0.92) { w = cw * 0.92; h = w / r; }
  return { w, h, x: (cw - w) / 2, y: (ch - h) / 2 };
}
// The viewfinder over it (ui.css): the paper outside the frame has a hole cut where the frame is; over the whole view
// there is no paper, and the corners are drawn a little in from the edges.
function layoutFrame() {
  const el = document.getElementById("frame"), fd = document.getElementById("finder"); if (!el) return;
  const whole = photo.aspect === "screen", f = frameRect(), inset = whole ? 18 : 0;
  Object.assign(el.style, { left: f.x + inset + "px", top: f.y + inset + "px", width: f.w - 2 * inset + "px", height: f.h - 2 * inset + "px" });
  document.body.classList.toggle("whole", whole);
  if (fd) for (const [k, v] of /** @type {[string, number][]} */ ([["--fx", f.x], ["--fy", f.y], ["--fw", f.w], ["--fh", f.h]])) fd.style.setProperty(k, v + "px");
}
const governor = createGovernor(quality, resize);
new ResizeObserver(resize).observe(canvas); resize();

let prev = performance.now(), frames = 0, tour = null, devpose = null, eyeY = footY, mirrorOn = true, monkHidden = false;
const load = { tris: 0, calls: 0, ms: 0 };
let frozen = false;   // a photograph holds the picture still from the shutter until the print is put away
function frame(now) {
  if (!running) return;
  if (frozen) { prev = now; requestAnimationFrame(frame); return; }
  governor.tick((now - prev) / 1000); tour?.frame(now); devpose?.tick(now);
  const dt = Math.min(0.05, (now - prev) / 1000), t = still ? 0 : now / 1000; prev = now;

  // Walk: keys or the tapped spot, at a slow pace, sliding along what blocks the way.
  const menuUp = ui.modal();   // a sheet over the walk: he stands still
  const f = photo.on || menuUp ? 0 : (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - joy.y, s = photo.on || menuUp ? 0 : (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + joy.x;
  const x0 = pos.x, z0 = pos.z, flight = hop, airborne = !!flight;
  let vx = 0, vz = 0;
  if (f || s) { interrupt(); target = null; route = []; vx = Math.sin(yaw) * f + Math.cos(yaw) * s; vz = -Math.cos(yaw) * f + Math.sin(yaw) * s; }
  else if (target) { vx = target.x - pos.x; vz = target.z - pos.z; if (Math.hypot(vx, vz) < 0.02) { target = route.shift() || null; vx = vz = 0; if (!target) { settle(true); pace.v = 0; } } }
  const len = Math.hypot(vx, vz);
  if (menuUp || photo.on || airborne) pace.v = 0;   // a sheet over the walk, the camera raised, a hop: he stands, or the hop carries him
  // He gathers speed and loses it again over a few steps, as a child walks, rather than starting and stopping dead:
  // the picture lurching into motion is felt (《小王子》's PlayerController: 7 m/s² up, 8 m/s² down). Let go of the
  // keys and he slows along the way he was going; coming to a tapped spot he slows so as to stop on it.
  if (len > 0) { const ux = vx / len, uz = vz / len; pace.v *= Math.max(0, ux * pace.dir[0] + uz * pace.dir[1]); pace.dir = [ux, uz]; }   // turned right round, he starts again
  if ((len > 0 || pace.v > 0) && !airborne) {
    const walkPace = keys.shift || Math.hypot(joy.x, joy.y) > 0.94 ? 4.2 : 2.1 * (f || s ? Math.min(1, Math.max(0.35, len)) : 1);
    let want = len === 0 ? 0 : Math.min(walkPace, walker.onStairs(pos.x, pos.z) ? keys.shift ? 1.6 : 1.25 : Infinity);   // Shift to hurry; a stick pushed a little walks slowly
    if (target) { let left = len, at = target; for (const p of route) { left += Math.hypot(p.x - at.x, p.z - at.z); at = p; } want = Math.min(want, Math.sqrt(2 * WALK.down * left) + 0.15); }
    if (Q.has("fast")) pace.v = len === 0 ? 0 : 14;
    else pace.v += Math.max(-WALK.down * dt, Math.min(WALK.up * dt, want - pace.v));
    const step = Math.min(f || s || len === 0 ? 1e9 : len, pace.v * dt); vx = pace.dir[0] * step; vz = pace.dir[1] * step;
    // Take the step; if something is in the way, slide along it, and failing that close the last gap in smaller steps.
    let moved = false;
    for (let k = 1; k > 0.1 && !moved; k /= 2) {
      const sx = vx * k, sz = vz * k;
      if (!walker.blocked(pos.x + sx, pos.z + sz)) { pos.x += sx; pos.z += sz; moved = true; }
      else if (Math.abs(sx) > 1e-4 && !walker.blocked(pos.x + sx, pos.z)) { pos.x += sx; moved = true; }
      else if (Math.abs(sz) > 1e-4 && !walker.blocked(pos.x, pos.z + sz)) { pos.z += sz; moved = true; }
    }
    // Something round or cornered is square in his way (a column, a table): he goes round it, turning aside by as
    // little as will let him pass, to whichever hand is nearer the way he was going.
    for (const a of moved ? [] : [0.5, -0.5, 0.95, -0.95, 1.35, -1.35]) {
      const c = Math.cos(a), s = Math.sin(a), sx = (vx * c - vz * s) * 0.8, sz = (vx * s + vz * c) * 0.8;
      if (!walker.blocked(pos.x + sx, pos.z + sz)) { pos.x += sx; pos.z += sz; moved = true; break; }
    }
    if (!moved) { target = null; route = []; settle(false); pace.v = 0; }
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
  // The height the view rides at follows the floor softly; from behind him more softly still, as the up and down of a
  // following camera is what is felt most (《小王子》 smooths it over 0.14 s, its sideways following over 0.06 s).
  eyeY += ((aloft ? footY : walker.eyeAt(pos.x, pos.z)) - eyeY) * (1 - Math.exp(-dt / (view === "third" ? 0.14 : 0.08)));
  if (dropButton) dropButton.hidden = !availableDrop();
  // The novice: where he stands, which way he faces, how fast he is going.
  const moved = Math.hypot(pos.x - x0, pos.z - z0);
  if (!arrived && document.body.classList.contains("entered")) { arrived = true; hints.say.entered(); }
  if (arrived) hints.step(dt, moved, !!keys.shift, !stage && !photo.on && !aloft);
  speedNow += ((dt > 0 ? Math.min(moved / dt, 2.4) : 0) - speedNow) * Math.min(1, dt * 10);
  const want = flight ? Math.atan2(flight.plan.to[0] - flight.plan.from[0], flight.plan.to[2] - flight.plan.from[2]) : stage ? stage.face : view === "first" && !photo.on ? Math.atan2(Math.sin(yaw), -Math.cos(yaw)) : moved > 1e-4 ? Math.atan2(pos.x - x0, pos.z - z0) : heading;
  heading += Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * Math.min(1, dt * 9);
  // Seated on something that stands in the way (a stool): he came to stand behind it, and is drawn on it while he sits.
  const sat = stage && stage.seat ? stage.seat : null;
  // He is drawn going over to a seat and down onto it; a seat higher than he can step onto (a stool) he hops up onto,
  // with his own jump, from where he stood beside it, tucking his legs under him as he comes down on its top.
  if (stage !== climbFor) { climbFor = stage; climb = null; if (stage && sat && (stage.lift || 0) > 0.25 && drawn) { climb = { plan: seatHop([drawn[0], footY, drawn[2]], [sat[0], footY + stage.lift, sat[1]], JUMP.speed, JUMP.gravity), t: 0 }; climbs++; } }
  if (climb) { climb.t += dt; const p = dropPose(climb.plan, climb.t); drawn = [p.x, p.y, p.z]; if (p.done) climb = null; }
  else if (!stage || !drawn) drawn = [sat ? sat[0] : pos.x, footY, sat ? sat[1] : pos.z];
  else { const k = Math.min(1, dt * 7); drawn[0] += ((sat ? sat[0] : pos.x) - drawn[0]) * k; drawn[2] += ((sat ? sat[1] : pos.z) - drawn[2]) * k; drawn[1] += (footY + (stage.lift || 0) - drawn[1]) * k; }
  monk.group.position.set(drawn[0], stage ? drawn[1] : footY, drawn[2]); monk.group.rotation.y = heading;
  monk.group.visible = photo.on ? photo.monk : view === "third";
  // (`posed`: a tool may have him walk, hurry, climb, hop or sit on the spot, to be looked at closely: `__act`.)
  if (posed) monk.update(dt || 1 / 30, posed.speed || 0, posed.pose || false, t, walker.heightAt, { heightAt: walker.eyeAt, stairs: !!posed.stairs, act: posed.act || null });
  else monk.update(dt, stage && stage.speed != null ? stage.speed : still || aloft ? 0 : speedNow, aloft || (climb && climb.t < climb.plan.duration * 0.5) ? "hop" : stage ? stage.pose : photo.on && photo.pray, t, walker.heightAt, { heightAt: walker.eyeAt, stairs: walker.onStairs(pos.x, pos.z), act: stage ? stage.act : null });
  // Where he steps outdoors in the snow he leaves his prints (a room's floor keeps none, and the square stays outside),
  // and every step is heard, as what it comes down on sounds: snow, dry stone, stone wet after rain, a puddle in the
  // paving, a hall's floor. A little to the side of the foot that made it (his left is the listener's left, from
  // behind him or from his own eyes), a little clearer on a stair.
  for (const f of monk.steps.splice(0)) {
    if (passing) continue;
    if (!inside) trail.stamp(f);
    const kind = underfoot({ x: f.x, z: f.z, y: f.y, floor: walker.floorAt(f.x, f.z), snow: inside ? 0 : mood.snow, wet: mood.wet, roofed: !inside && shelterAt(roofMap, f.x, f.y + 0.05, f.z) > 0.5 });
    footstep(kind, { speed: speedNow, side: -f.side * (view === "third" ? 1 : 0.5), loud: (view === "third" ? 0.8 : 1) * (walker.onStairs(f.x, f.z) ? 1.15 : 1), wet: mood.wet, late: f.late || 0 });
  }
  if (!inside) trail.follow(pos.x, pos.z); trail.update(dt);
  // The eye: his own, or one that follows behind, as low as a child and a little to one side, so that he stands
  // small in the lower left of the picture and the place fills the rest. It comes in close rather than pass through
  // anything solid, and it never sinks into the ground or the hillside.
  // From behind him the view comes round a moment after the hand (0.06 s, as a third-person camera's axis eases in
  // and out), so a jerk of the mouse is not a jerk of the whole place; from his own eyes it turns with the hand.
  if (view === "first" || follow.fresh || cine) { look.yaw = yaw; look.pitch = pitch; look.vy = look.vp = 0; }
  else { [look.yaw, look.vy] = damp(look.yaw, yaw, look.vy, LOOK_EASE, dt); [look.pitch, look.vp] = damp(look.pitch, pitch, look.vp, LOOK_EASE, dt); }
  // From his own eyes the view dips a little with each step he takes, and only as much as he is walking (after
  // Saltline: the bob counted in strides and its depth eased in and out with the pace, never switched on and off).
  bob.phase += moved / 0.55; bob.amp += ((still || aloft ? 0 : Math.min(1, speedNow / 2.1)) - bob.amp) * (1 - Math.exp(-dt / 0.15));
  if (view === "first") camera.position.set(pos.x, eyeY + (stage && (stage.pose === "sit" || stage.pose === "chair") ? (stage.lift || 0) + 0.68 : EYE) - (1 - Math.cos(bob.phase * Math.PI * 2)) * 0.006 * bob.amp, pos.z);
  else {
    const rx = Math.cos(look.yaw), rz = Math.sin(look.yaw), wantSide = walker.wall(pos.x + rx * 1.4, pos.z + rz * 1.4) ? 0 : 1.2;
    sideNow += (wantSide - sideNow) * Math.min(1, dt * 3);
    const at = { x: pos.x, z: pos.z, foot: footY, eyeY, yaw: look.yaw, pitch: look.pitch, side: sideNow, reach: reachWant };
    // While the view is being swung round, the eye also looks where it is swinging to (eye.js, `ahead`).
    const ahead = Math.abs(look.vy) > 0.5 ? followEye(walker, { ...at, yaw: look.yaw + look.vy * FOLLOW.ahead }) : null;
    camera.position.fromArray(follow.step(dt, followEye(walker, at), ahead));
    // Backed against a wall, the eye is as good as his own. Hidden nearer than one distance and shown again only
    // beyond a farther one, so that he does not flicker in and out at the edge of it.
    monkHidden = follow.dist < (monkHidden ? 0.85 : 0.6);
    if (monkHidden && !photo.on) monk.group.visible = false;
  }
  camera.rotation.set(look.pitch, -look.yaw, 0, "YXZ");
  // A passage that is shown, not walked (the close of the chapter, rites.js), takes the eye from here and keeps him in the picture.
  if (cine) { cine(camera, dt); monk.group.visible = true; }
  camera.updateMatrixWorld();
  // Crossing the threshold hands over to the hall interior.
  const atDoor = inside ? null : site.halls.find((h) => h.inside(pos.x, pos.z)) || null;
  if (!atDoor) doorArmed = true;
  else if (doorArmed && !inside && !passing) { doorArmed = false; pass(atDoor); }
  if (inside && !passing && pos.z > hallIn.room.exitZ && Math.abs(pos.x - hallIn.room.cx) < 1.3) pass(null);

  for (const fn of ticks) fn(dt, t);
  if (glowCloud) glowCloud.material.uniforms.uPx.value = pxH;
  U.uT.value = t; sky.update(t); backdrop.update(t); props.update(t, dt, still, pxH); well.update(still ? 0 : dt, pos.x, pos.z, inside); flock.update(still ? 0 : dt, t); drift.update(t, camera.position, pxH);
  for (const s of site.strikers) if (s.swing && s.t0) s.swing.position.z = logSwing(s, riteNow());   // drawn back and let go, or only tapped: it touches the bell and swings itself out
  load.tris = renderer.info.render.triangles; load.calls = renderer.info.render.calls; renderer.info.reset();
  if (frames < 3) renderer.shadowMap.needsUpdate = true;
  // The mirror lies in the forecourt and the first court: not indoors, not on the terraces above, not down the
  // approach where the eye is under it. A jump does not change which of these he is in.
  if (!aloft) mirrorOn = mirrorAt(footY);   // the court, the forecourt, and the platforms that stand in them
  ground.mirror?.(mirrorOn && !inside);
  if (quality.planar > 0 && !inside && mirrorOn) ground.render(renderer, camera);
  post.render(t);
  // Ready when it has drawn a few frames and every scanned surface has arrived (or been given up on).
  loading.frame(frames + 1);
  if (++frames >= 3 && !document.body.dataset.ready) { const ts = textureState(); if (ts.loaded + ts.failed.length >= ts.total) { if (ts.loaded) renderer.shadowMap.needsUpdate = true; loading.finish(); document.body.dataset.ready = "1"; track("demo.ready", { tier: quality.name }); } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- The controls at the edge of the view ------------------------------------------
const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id)), on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
if (Q.has("shot")) document.body.classList.add("bare");
const setView = (v) => { view = v; follow.reset(); pitch = v === "third" ? Math.min(pitch, 0.06) : Math.max(pitch, 0); resize(); };
setView(view);
ui.layer("keys", { kind: "panel" }).layer("moodPanel", { kind: "panel", release: true });
document.querySelectorAll("[data-season]").forEach((b) => b.addEventListener("click", () => setMood(b.dataset.season, state.time)));
document.querySelectorAll("[data-time]").forEach((b) => b.addEventListener("click", () => setMood(state.season, b.dataset.time)));

// ---- Taking a photograph ------------------------------------------------------------
// The raised camera is a mode on the stack of layers, its settings a panel over it, the print a sheet over both:
// Esc folds the settings, then puts the print away, then lowers the camera.
const folded = (open) => () => { $("photoSettings").hidden = !open; $("photoSettingsToggle").setAttribute("aria-expanded", String(open)); };
ui.layer("photoSettings", { kind: "panel", show: folded(true), hide: folded(false), returnFocus: "photoSettingsToggle" });
ui.layer("photo", { kind: "mode", el: null, show: () => raise(true), hide: () => raise(false) });
function setPhotoSettings(open) { if (open) ui.open("photoSettings"); else ui.close("photoSettings"); }
function setPhoto(open) { if (open) { ui.close("keys"); ui.close("moodPanel"); if (!ui.open("photo")) raise(true); } else if (!ui.close("photo")) raise(false); }
function raise(open) {
  ui.close("photoSettings");   // the settings start folded every time the camera is raised
  photo.on = open; document.body.classList.toggle("photo", open); if (open) hints.say.photo(); else hints.drop("photo");
  if (open) {   // the view stays exactly as it was: only walking stops, and the pointer is let go so the buttons can be reached
    target = null; route = []; photo.zoom = 1; photo.monk = view === "third" && monk.group.visible; photo.pray = false; document.exitPointerLock?.();
    $("monkToggle").disabled = view !== "third"; $("monkToggle").setAttribute("aria-pressed", String(photo.monk)); $("prayToggle").disabled = !photo.monk; $("prayToggle").setAttribute("aria-pressed", "false");
    document.querySelectorAll("[data-lens]").forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.lens === "1")));
  }
  canvas.style.cursor = open ? "crosshair" : "grab";
  resize();
}
on("photoSettingsToggle", () => setPhotoSettings($("photoSettings").hidden));
on("photoBtn", () => setPhoto(true)); on("photoClose", () => setPhoto(false));
document.querySelectorAll("[data-aspect]").forEach((b) => b.addEventListener("click", () => { photo.aspect = b.dataset.aspect; document.querySelectorAll("[data-aspect]").forEach((o) => o.setAttribute("aria-pressed", String(o === b))); layoutFrame(); }));
document.querySelectorAll("[data-lens]").forEach((b) => b.addEventListener("click", () => { photo.zoom = +b.dataset.lens; document.querySelectorAll("[data-lens]").forEach((o) => o.setAttribute("aria-pressed", String(o === b))); lens(); }));
on("monkToggle", (e) => { photo.monk = !photo.monk; e.currentTarget.setAttribute("aria-pressed", String(photo.monk)); $("prayToggle").disabled = !photo.monk; });
// The thirds, faint in the viewfinder; kept with the visitor's settings.
const thirds = (v) => { document.body.classList.toggle("thirds", v); $("thirdsToggle")?.setAttribute("aria-pressed", String(v)); };
thirds(settings.get().thirds);
on("thirdsToggle", () => { settings.set("thirds", !settings.get().thirds); thirds(settings.get().thirds); });
on("prayToggle", (e) => { photo.pray = !photo.pray; e.currentTarget.setAttribute("aria-pressed", String(photo.pray)); });

// Draw the framed part of the view again, large, and mount it on its card.
async function capture(at = null) {
  const [aw, ah] = photo.aspect === "screen" ? [canvas.clientWidth, canvas.clientHeight] : ASPECT[photo.aspect], long = quality.name === "low" ? 1600 : quality.name === "medium" ? 2160 : 2880;   // drawn again far finer than the screen
  const W = aw >= ah ? long : Math.round((long * aw) / ah), H = aw >= ah ? Math.round((long * ah) / aw) : long;
  const f = frameRect(), keepFov = camera.fov;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(keepFov) / 2) * (f.h / canvas.clientHeight)));
  camera.aspect = W / H; camera.updateProjectionMatrix();
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); post.resize(W, H, 1); ground.resize(W >> 1, H >> 1, true);
  const t = still ? 0 : at ?? performance.now() / 1000;   // the moment the shutter was pressed, so the print is what was seen
  drift.update(t, camera.position, H); ground.render(renderer, camera); post.render(t);
  const shot = document.createElement("canvas"); shot.width = W; shot.height = H; shot.getContext("2d").drawImage(canvas, 0, 0);
  camera.fov = keepFov; resize();
  return composeCard(shot, { line: mood.line, label: mood.label, temple: "云径禅寺", url: location.host + location.pathname.replace(/\/$/, "") });
}
let lastBlob = null;
// The shutter. The view is drawn once more and copied onto a still that covers it, and the walk stops (the frame loop,
// the observances' clock): from here until the print is put away nothing in the picture moves. Two leaves of ink close
// and open over it with the shutter's click; behind the still, the large picture is drawn at that same moment, and the
// print comes with the seal's press.
function freeze(on) {
  frozen = on; document.body.classList.toggle("frozen", on); pauseRites(on);
  if (!on) { prev = performance.now(); return null; }
  const t = still ? 0 : performance.now() / 1000, c = $("still");
  if (quality.planar > 0 && mirrorOn && !inside) ground.render(renderer, camera);
  post.render(t);
  c.width = canvas.width; c.height = canvas.height; c.getContext("2d").drawImage(canvas, 0, 0);   // in the same task as the drawing: the buffer is not kept after it
  return t;
}
ui.layer("print", { kind: "modal" });
on("shutter", async () => {
  const b = $("shutter"); b.disabled = true;
  const at = freeze(true);
  shutterSound(); navigator.vibrate?.(12);
  const c = $("curtain"); c.classList.remove("shut"); void c.offsetWidth; c.classList.add("shut");
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));   // let the leaves and the still be drawn before the long work
    const card = await capture(at);
    lastBlob = await new Promise((r) => card.toBlob(r, "image/jpeg", 0.93));
    const url = URL.createObjectURL(lastBlob); $("printImg").src = url; $("saveLink").href = url;
    $("saveLink").download = `云径禅寺-${NAMES[state.season]}${NAMES[state.time]}.jpg`;
    const file = new File([lastBlob], "yunjing.jpg", { type: "image/jpeg" });
    $("shareBtn").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    ui.open("print", { onClose: () => { if (frozen) freeze(false); } }); stampSound();   // put away by its button or by Esc: the walk goes on
  } catch (e) { freeze(false); throw e; }
  finally { b.disabled = false; }
});
on("printBack", () => ui.close("print"));
on("shareBtn", async () => {
  try { await navigator.share({ files: [new File([lastBlob], "yunjing.jpg", { type: "image/jpeg" })], title: "云径禅寺", text: mood.line }); } catch {}
});

// ---- Through the door ----------------------------------------------------------------
// Eyes close on the way in and daylight floods on the way out; behind the veil he is moved between the porch and the
// room, the room's lamps are lit or put out, and the picture is exposed for indoors or for the sky.
let inside = false, passing = false;
const veil = $("veil"), pause = (ms) => new Promise((r) => setTimeout(r, Q.has("fast") ? ms / 6 : ms));
let lastHall = null;
// What is seen through a hall's door from inside. From where he would stand on its porch, at a grown eye's height, the
// whole surrounding is drawn once onto the six faces of a cube; the room hangs that beyond its doorway (interior.js).
// It is taken while the courts are still showing, behind the veil, and again if the season or the hour is changed
// while he is indoors.
const outCube = new THREE.WebGLCubeRenderTarget(quality.name === "low" ? 512 : 768, { type: THREE.HalfFloatType }), outCam = new THREE.CubeCamera(0.25, 700, outCube);
const COURTS = ["site", "backdrop", "bamboo", "trees", "ground", "props"];
function lookOut(hall) {
  const r = rooms.rooms[hall.id]; if (!r || !r.outlook) return;
  const was = walker.room; walker.setRoom(null);
  const [x, z] = hall.out, f = [Math.sin(hall.outYaw), -Math.cos(hall.outYaw)];
  const eye = [x + f[0] * 0.3, walker.heightAt(x, z) + 1.5, z + f[1] * 0.3];
  outCam.position.set(eye[0], eye[1], eye[2]); sky.at(eye[0], eye[1], eye[2]); walker.setRoom(was);
  const seen = scene.children.map((o) => o.visible);
  for (const o of scene.children) { const part = o.userData.part; if (COURTS.includes(part)) o.visible = !OFF.has(part); else if (part === "monk" || part === "interior" || part === "drift") o.visible = false; }
  ground.mirror?.(false);
  const target = renderer.getRenderTarget(), xr = renderer.xr.enabled; renderer.xr.enabled = false;
  try { outCam.update(renderer, scene); } finally { sky.at(0, 0, 0); }
  renderer.xr.enabled = xr; renderer.setRenderTarget(target);
  scene.children.forEach((o, i) => { o.visible = seen[i]; });
  const u = r.outlook.material.uniforms; u.tOut.value = outCube.texture; u.uHas.value = 1; u.uTurn.value.set(f[0], f[1]);
}
// Whatever falls through the air (snow, petals, leaves, fireflies) falls outdoors only.
const hideDrift = (on) => scene.children.forEach((o) => { if (o.userData.part === "drift") o.visible = !on && mood.drift !== "none" && !OFF.has("drift"); });
// Lamps lit, the sun put out, no snow on any floor, the picture exposed for a room.
const dress = () => { U.uLamp.value = 1; U.uSnow.value = 0; hideDrift(true); sky.indoors(); post.setMood({ ...mood, exp: 1.25, sat: 1.04, lift: 0.004, bloom: 0.32, sh: [0.96, 0.98, 1.06], hi: [1.06, 1, 0.92] }); };
afterMood = () => { if (inside && lastHall) { lookOut(lastHall); dress(); } };   // the doorway shows the new hour, the room keeps its lamps
function indoors(hall) {
  if (hall) hints.say.indoors();
  const on = !!hall; if (on) { lastHall = hall; hallIn = rooms.rooms[hall.id]; lookOut(hall); hallIn.hang(); }
  inside = on; walker.setRoom(on ? hallIn.room : null); interrupt(); target = null; route = []; hop = leap = null;
  for (const r of Object.values(rooms.rooms)) for (const l of r.lights) l.visible = on && r === hallIn;
  for (const o of scene.children) if (COURTS.includes(o.userData.part)) o.visible = !on && !OFF.has(o.userData.part);   // nothing of the courts is drawn from indoors
  hideDrift(on);
  if (on) { pos.set(hallIn.room.door[0], EYE, hallIn.room.door[1]); yaw = 0; dress(); }
  else { pos.set(lastHall.out[0], EYE, lastHall.out[1]); yaw = lastHall.outYaw; doorArmed = false; setMood(state.season, state.time); }
  pitch = 0.04; footY = eyeY = walker.heightAt(pos.x, pos.z); heading = on ? Math.PI : Math.atan2(Math.sin(yaw), -Math.cos(yaw)); follow.reset(0.6); document.body.classList.toggle("indoors", on);
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
if (Q.has("in")) { indoors(site.halls.find((h) => h.id === Q.get("in")) || site.halls.find((h) => h.id === "main")); if (Q.has("cam")) { pos.x = pose[0]; pos.z = pose[1]; yaw = pose[2]; pitch = pose[3]; footY = eyeY = walker.heightAt(pos.x, pos.z); follow.reset(); } }   // ?in=1 begins inside the hall
// For the test tools.
window.__inside = (id) => pass(id ? site.halls.find((h) => h.id === (id === true ? "main" : id)) : null); window.__figures = () => rooms.state.figures; window.__statues = () => ({ ...rooms.state.stood }); window.__gallery = rooms.spots; window.__halls = site.halls.map((h) => ({ id: h.id, name: h.name, door: h.door, out: h.out }));
window.__yard = () => ({ inside, room: inside ? hallIn.room.id : null, doorway: inside ? hallIn.outlook.material.uniforms.uHas.value : null, tier: quality.name, scale: +quality.scale.toFixed(2), planar: quality.planar, governed: governor.level, x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), h: +walker.heightAt(pos.x, pos.z).toFixed(2), footY: +monk.group.position.y.toFixed(4), groundY: +walker.heightAt(pos.x, pos.z).toFixed(4), dropping: !!hop, staged: stage ? stage.pose || "stand" : null, climbing: !!climb, climbs, pose: stage ? stage.pose : null, jumping: !!leap, bodyY: +(monk.group.position.y + monk.group.children[0].position.y).toFixed(4), dressed: monk.dressed, target: target && [+target.x.toFixed(2), +target.z.toFixed(2)], route: route.length, running, frames, tris: load.tris, calls: load.calls, season: state.season, time: state.time, view, fov: +camera.fov.toFixed(1) });
window.__views = Object.keys(site.views); window.__merged = merged; window.__textures = textureState;
// A named view, without loading the place again: out of any room, then stood where the view stands.
window.__show = (name) => { const v = site.views[name]; if (!v) return false; if (inside) indoors(null); window.__pose(v[0], v[1], v[2], v[3]); return true; };
// Switch a part of the scene, or one of the passes, while the walk goes on (the debug panel; `?off=` does the same at
// load). `__part()` lists them, each true when drawn. What a room or the hour hides stays hidden: a court switched
// back on while he is indoors is not drawn until he comes out. The novice and the rooms are shown or hidden by the
// walk itself every frame, so they are not offered.
const shownNow = (name) => !OFF.has(name) && !(inside && (COURTS.includes(name) || name === "drift")) && !(name === "drift" && mood.drift === "none");
window.__part = (name, on) => {
  const names = [...new Set(scene.children.map((o) => o.userData.part).filter((n) => n && n !== "monk" && n !== "interior"))];
  if (name === undefined) return Object.fromEntries([...names, ...PASSES].map((n) => [n, !OFF.has(n)]));
  if (!names.includes(name) && !PASSES.includes(name)) return null;
  if (on) OFF.delete(name); else OFF.add(name);
  if (name === "reflect") { quality.planar = on ? PLANAR : 0; resize(); }
  else if (name === "bloom") { quality.bloom = !!on; resize(); }
  else if (name === "shadow") { renderer.shadowMap.enabled = !!on; renderer.shadowMap.needsUpdate = true; scene.traverse((/** @type {any} */ o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
  else for (const o of scene.children) if (o.userData.part === name) o.visible = shownNow(name);
  return !OFF.has(name);
};
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
    top.traverse((/** @type {any} */ o) => {
      if (!(o.isMesh || o.isPoints || o.isSprite) || !o.geometry) return; row.meshes++;
      const g = o.geometry, n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
      row.tris += Math.round((o.isPoints ? 0 : n / 3) * (o.isInstancedMesh ? o.count : 1));
    });
  }
  return out;
};
// What the picture looks like right now, measured: draws one frame and averages it. Also reports the state the tests assert on.
// Where the novice stands in the picture, in page pixels (left, top, width, height), or null when he is not drawn:
// the corners of a box round him, as tall as he is, carried through the camera.
const monkBox = () => {
  if (!monk.group.visible) return null;
  const r = canvas.getBoundingClientRect(), o = monk.group.position, v = new THREE.Vector3(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) for (const dy of [0, 1.22]) {
    v.set(o.x + dx, o.y + dy, o.z + dz).project(camera); const x = r.left + (v.x + 1) / 2 * r.width, y = r.top + (1 - v.y) / 2 * r.height;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1 - x0, y1 - y0].map((n) => +n.toFixed(1));
};
window.__probe = () => {
  const t = still ? 0 : performance.now() / 1000;
  if (quality.planar > 0) ground.render(renderer, camera); post.render(t);
  const c = document.createElement("canvas"); c.width = 32; c.height = 32; const x = c.getContext("2d"); x.drawImage(canvas, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0, top = 0, n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; if (i < 32 * 8 * 4) top += d[i] + d[i + 1] + d[i + 2]; }
  return { r: r / n, g: g / n, b: b / n, lum: (r + g + b) / (3 * n), sky: top / (32 * 8 * 3), season: state.season, time: state.time, view, photo: photo.on, monk: monk.group.visible,
    photoSettings: !document.getElementById("photoSettings").hidden, frozen, aspect: photo.aspect, zoom: +photo.zoom.toFixed(3), camDist: +camera.position.distanceTo(new THREE.Vector3(pos.x, footY + 1, pos.z)).toFixed(2), snow: U.uSnow.value, drift: scene.children.some((o) => o.userData.part === "drift" && o.visible), prints: trail.state().stamps, lamp: U.uLamp.value, fov: camera.fov, monkBox: monkBox() };
};
window.__trail = (show) => { if (show === false) trail.hide(); return trail.state(); };
window.__mood = setMood; window.__view = setView; window.__photo = (open, opts) => { setPhoto(open); Object.assign(photo, opts || {}); resize(); };
window.__shots = photoSounds;
window.__flock = (go) => { if (go && flock.flush()) flutter(1); return flock.state(); };   // the birds going up now, if asked, and where they are
window.__cues = cueState;   // how many times the wings and the far bell have sounded   // how many shutters and seals have sounded
window.__capture = async () => { const c = await capture(); return { w: c.width, h: c.height, url: c.toDataURL("image/jpeg", 0.9) }; };
window.__blocked = (x, z) => walker.blocked(x, z);
window.__act = (o) => { posed = o || null; };   // { speed, pose, stairs }: how he is shown, whatever he is doing; null to let him be
window.__pose = (x, z, y, p) => { interrupt(); pos.x = x; pos.z = z; yaw = y; pitch = p; footY = eyeY = walker.heightAt(x, z); follow.reset(); };
window.__listen = listen; window.__strike = strike; window.__bells = bellsRinging; window.__steps = (play) => { if (play) footstep(play === true ? "snow" : play); return stepState(); };
window.__knock = (go) => { if (go) knock(1); return ambienceState(); };   // two culms knocking now, if asked, and how many have
window.__bird = (go) => { if (go) bird(1); return ambienceState(); };   // a bird now, if asked, and how many have sung
window.__well = (drip) => { if (drip) { well.ripple(); wellDrip(well.state().level); } return well.state(); };   // a drop now, if asked, and how the well stands
// The music: what it is doing; `__music(true)` lets the place be heard, as a first tap does.
window.__music = (begin) => { if (begin) hear(); return musicState(); };

// ---- The visit as a pilgrimage (src/game.js): what it may ask of the walk ----
window.__hud = () => hints.state();
window.__ui = () => ({ stack: ui.state(), modal: ui.modal(), focus: document.activeElement?.id || document.activeElement?.tagName || null });
// ---- The pause menu: what the visitor may set, a way back to the start, the keys ----
const SOUND = [["setVolume", "volume"], ["setMusic", "music"], ["setAmbience", "ambience"], ["setEffects", "effects"]];
ui.layer("menu", { kind: "modal" });
// A slider on paper is a line of ink, darker as far as it is set (src/ui.css reads --v).
const inked = (r) => r.style.setProperty("--v", `${(100 * (r.value - r.min)) / (r.max - r.min || 1)}%`);
menuEl.querySelectorAll("input[type=range]").forEach((r) => r.addEventListener("input", () => inked(r)));
function openMenu(open) {
  if (!open) { ui.close("menu"); return; }
  if (ui.open("menu")) { interrupt(); target = null; route = []; }
  const S = settings.get();
  menuEl.querySelectorAll("[data-q]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.q === S.quality)));
  $("setSens").value = S.sens; $("setFov").value = S.fov; for (const [id, k] of SOUND) $(id).value = S[k]; $("setInvert").setAttribute("aria-pressed", String(S.invertY)); $("setInvert").textContent = S.invertY ? "开" : "关";
  $("setLock").setAttribute("aria-pressed", String(S.lock)); $("setLock").textContent = S.lock ? "开" : "关";
  menuEl.querySelectorAll("input[type=range]").forEach(inked);
  $("qualityNote").hidden = S.quality === "auto" ? Q.has("q") || quality.fixed !== true : S.quality === quality.name;   // shown when what is chosen is not what is being drawn
}
{
  const set = (k, v) => { settings.set(k, v); openMenu(true); };
  menuEl.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => set("quality", b.dataset.q)));
  $("setSens").addEventListener("input", (e) => settings.set("sens", +/** @type {HTMLInputElement} */ (e.target).value));
  $("setFov").addEventListener("input", (e) => { settings.set("fov", +/** @type {HTMLInputElement} */ (e.target).value); lens(); });
  for (const [id, k] of SOUND) $(id).addEventListener("input", (e) => { settings.set(k, +/** @type {HTMLInputElement} */ (e.target).value); setLevels({ [k]: settings.get()[k] }); });
  on("setInvert", () => set("invertY", !settings.get().invertY));
  on("setLock", () => { set("lock", !settings.get().lock); if (!settings.get().lock) document.exitPointerLock?.(); });
  on("menuResume", () => openMenu(false)); on("menuBtn", () => openMenu(!ui.isOpen("menu"))); on("menuKeys", () => { openMenu(false); hints.card(true); });
  on("reloadBtn", () => location.reload());
  on("menuFull", () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.()?.catch?.(() => {}); });
  on("titleSet", () => openMenu(true));
  // Lost, or wedged somewhere he should not be: back to where the path begins.
  on("menuHome", () => { if (inside) indoors(null); /* straight out, not through the door: the walk back to the porch would undo this */ openMenu(false); const [x, z, y] = site.start; pos.x = x; pos.z = z; yaw = y; pitch = 0.1; footY = eyeY = walker.heightAt(x, z); hop = leap = null; follow.reset(); });
}
window.__settings = () => settings.get(); window.__menu = (open) => openMenu(open);
// What lies under a point of the picture, nearest first: which part of the scene, which material, how far, whether it is
// see-through. When something in a screenshot will not be explained, ask this before guessing.
window.__pick = (px, py, n = 6) => {
  const r = canvas.getBoundingClientRect(), rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1), camera);
  return rc.intersectObjects(scene.children, true).filter((h) => h.object.visible).slice(0, n).map((h) => { const m = /** @type {any} */ (h.object).material || {}; let o = h.object, part = null; while (o && !part) { part = o.userData.part; o = o.parent; }
    return { part, material: m.customProgramCacheKey && /^[a-zA-Z]+$/.test(m.customProgramCacheKey()) ? m.customProgramCacheKey() : m.type, distance: +h.distance.toFixed(2), at: h.point.toArray().map((v) => +v.toFixed(2)), transparent: !!m.transparent, kind: h.object.type }; });
};
createGame({
  hints, ui, tier: quality.name,
  site, walker, scene,
  where: () => ({ x: pos.x, z: pos.z, yaw }),
  // Stand him somewhere at once, facing a way (coming back to where a visit was left, or to the start of the path).
  place(x, z, turn) { interrupt(); if (inside) indoors(null); pos.x = x; pos.z = z; if (Number.isFinite(turn)) yaw = turn; pitch = 0.1; footY = eyeY = walker.heightAt(x, z); hop = leap = null; follow.reset(); },
  start: site.start,
  // Go somewhere at once behind the veil, as through a door: to a place out of doors, or to one inside a hall.
  async travel(x, z, turn, hallId) {
    if (passing) return false; passing = true; interrupt();
    if (veil) veil.className = "on"; await pause(700);
    const hall = hallId ? site.halls.find((h) => h.id === hallId) : null;
    if (inside && (!hall || hallIn.room.id !== hallId)) indoors(null);
    if (hall && !inside) indoors(hall);
    pos.x = x; pos.z = z; if (Number.isFinite(turn)) yaw = turn; pitch = 0.06; footY = eyeY = walker.heightAt(x, z); hop = leap = null; follow.reset(); await pause(250);
    if (veil) veil.className = ""; passing = false; return true;
  },
  // Send him along `points` ([x, z] each); `then(true)` when he arrives, `then(false)` if he is stopped or sent elsewhere.
  walkTo(points, then) { interrupt(); route = points.map(([x, z]) => new THREE.Vector3(x, 0, z)); target = route.shift(); arrive = then || null; },
  stage(o) { stage = o; },
  // `drawn`: he has drawn the log back himself (rites.js) and it is meeting the bell now; otherwise it is tapped.
  strike(kind, drawn) { const s = site.strikers.find((k) => k.kind === kind); strike(kind, 1); if (s && !drawn) { s.t0 = riteNow(); s.lead = 0; } window.dispatchEvent(new CustomEvent("struck", { detail: kind })); },
  monk, M, put(x, z) { pos.x = x; pos.z = z; }, staged: () => !!stage, seated: () => !!stage && (stage.pose === "sit" || stage.pose === "chair"),   // cross-legged, or on a stool as on a chair
  leave: () => interrupt(),
  // Hand the eye to `fn(camera, dt)` for a passage that is shown, or take it back with null.
  cine(fn) { cine = fn || null; if (!fn) follow.reset(); },
  mood: () => mood, season: () => state.season, night: () => inside || mood.lamp > 0.5, busy: () => photo.on || !running || passing || !!hop || !!leap, inside: () => inside,
  gallery: rooms.spots, room: () => (inside ? hallIn.room.id : null), hallName: () => (inside && lastHall ? lastHall.name : ""),
  listen: () => hear(),
  onTick: (fn) => ticks.push(fn),
  // Where a point of the place falls on the picture: x and y in pixels, and whether it is behind the eye.
  screenOf(x, yy, z) { const v = new THREE.Vector3(x, yy, z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, behind: v.z > 1, w: r.width, h: r.height }; },
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
// ?devpose on the dev server: the address follows him, so that a reload after a change to the code puts him back
// where he stood (src/devpose.js). The published build leaves this branch, and the module, out.
if (DEVPOSE) {
  const { createDevPose } = await import("./src/devpose.js");
  devpose = createDevPose({ where: location, history,
    read: () => (passing || hop || leap ? null : { x: pos.x, z: pos.z, yaw, pitch, view, season: state.season, time: state.time, room: inside ? hallIn.room.id : null,
      ok: (x, z) => !walker.blocked(x, z) && Math.abs(walker.heightAt(x, z) - walker.heightAt(pos.x, pos.z)) < 0.02 }) });   // the written point stands where he stands
  addEventListener("keydown", (e) => {   // C: the address of this view, to the clipboard and the console
    if (e.key.toLowerCase() !== "c" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || ui.modal() || /** @type {Element} */ (e.target)?.tagName === "INPUT") return;
    const link = devpose.link(); console.info("[devpose]", link); navigator.clipboard?.writeText(link).catch(() => {});
  });
  window.__devpose = () => devpose.link();
}
// The debug panel: where he stands, what the frame costs, the hour, and switches for each part (src/debug.js). It acts
// only through the hooks above. It opens by itself on the dev server and on a pull request's preview
// (<deployment>-temple-walk-preview.<account>.workers.dev, docs/PREVIEWS.md); ?debug=0 keeps it shut there. The published
// site never loads it: the module is a separate chunk fetched only here.
const PREVIEW = /-temple-walk-preview\./.test(location.hostname);
if ((import.meta.env.DEV || PREVIEW) && Q.get("debug") !== "0") {
  const { mountDebug } = await import("./src/debug.js");
  await mountDebug({ link: () => (devpose ? devpose.link() : null) });
}

await loading.step("山路");
