// The temple grounds: assembles the modules in src/, walks the visitor through them,
// and hands over to the hall interior at the main hall's door.
import { TRAILER } from "./src/trailer-boot.js";   // first: in trailer mode (#610) it replaces the page's clock before anything reads it
import { mulberry32 } from "./src/blink.js";   // (the trailer's seeded air and cloth, #610)
import { debugGate, onBench } from "./src/debuggate.js";
import { MAIN, photoUrl } from "./src/goshuin.js";
import * as THREE from "three";
import { FOG_DENSITY, U } from "./src/glsl.js";
import { createMaterials } from "./src/materials.js";
import { mergeStatic, STAIR } from "./src/geo.js";
import { levelOf, loadLevel } from "./src/level.js";
import { createSky, FOG, SUN_DIR, SHADOW_BOX } from "./src/sky.js";
import { layerFog } from "./src/fog.js";
import { softShadows } from "./src/shadows.js";
import { createGround } from "./src/ground.js";
import { createBackdrop } from "./src/backdrop.js";
import { loadHeightmap, terrainAsked } from "./src/terrain-far.js";
import { createProps } from "./src/props.js";
import { createPost } from "./src/post.js";
import { pickQuality, createGovernor, mirrorAt } from "./src/quality.js";
import { recordTap, strike, flutter, cueState, shutterSound, stampSound, photoSounds, bellsRinging, startAmbience, listen, setLevels, musicState, wellDrip, onDrop, knock, bird, ambienceState, footstep, stepState } from "./src/audio.js";
import { createWell } from "./src/well.js";
import { underfoot } from "./src/steps.js";
import { zoneOf, layerOf } from "./src/score.js";
import { createSettings, browserSettingsStore, DEFAULTS as SETTING_DEFAULTS } from "./src/settings.js";
import { createBamboo } from "./src/bamboo.js";
import { createTrees, geometryHash } from "./src/trees.js";
import { createDrift } from "./src/drift.js";
import { createTrail } from "./src/trail.js";
import { bakeShelter, useShelter, shelterAt } from "./src/shelter.js";
import { createMonk } from "./src/monk.js";
import { loadNovice, bodyChoice, BODY_FILE } from "./src/novice.js";
import { followEye, createFollow, damp, FOLLOW, FRAMES, frameArm, aimAt } from "./src/eye.js";
import { createEyeSpace, eyeRadius } from "./src/eyespace.js";
import { planRecenter, recenterYaw, createFollowTurn, yawBehind } from "./src/camturn.js";
import { keyAxes, createKeyTurn } from "./src/keyturn.js";
import { gatherEye, eyeBoxes } from "./src/eyegather.js";
import EyeWorker from "./src/eyebvh.worker.js?worker";
import { MeshBVH } from "three-mesh-bvh";
import { clearOfCenser } from "./src/censer.js";
import { moodOf, moodNow, hourFollow, takeClock, startMood, SEASONS, TIMES, NAMES } from "./src/mood.js";
import { eventFor } from "./src/joya.js";
import { WIND_DIR, windAt } from "./src/wind.js";
import { KEY as JOURNEY_KEY, filledBefore } from "./src/journey.js";
import { composeCard } from "./src/card.js";
import { createClip, markCanvas, pickMime, clipSize, clipName, saveHint, CLIP } from "./src/clip.js";
import { loadTextures, textureState } from "./src/textures.js";
import { createGame } from "./src/game.js";
import { setTemple, paintTemple, templeOf, sealOf, stemOf, saidNow, verseOf, T00_NAME } from "./src/temple.js";
import { levelSay } from "./src/levelsay.js";
import { track } from "./src/analytics.js";
import { createFlock } from "./src/flock.js";
import { logSwing, riteNow, pauseRites } from "./src/rites.js";
import { buildInteriors } from "./src/interior.js";
import { INCENSE_HALLS, incenseId } from "./src/incense.js";
import { createDoorways } from "./src/doorway.js";
import { createLive } from "./src/doorway-live.js";
import { asset } from "./src/assets.js";
import { createHints } from "./src/hints.js";
import { createUI } from "./src/ui.js";
import { createCommunity } from "./src/community.js";
import { createCredits } from "./src/credits.js";
import { createShare, shareOrSave, countDownload } from "./src/share.js";
import { FROM, fromOf } from "./src/sharelink.js";
import { createCarryOut } from "./src/carry-page.js";
import { mountVersion, watchVersion } from "./src/version.js";
import { createPaper } from "./src/paper.js";
import { createTour } from "./src/tour.js";
import { poseQuery, readEye } from "./src/link.js";
import { PRODUCTION } from "./src/deploy.js";
import { findDrop, dropPose, findClimb, climbPose, seatHop, seatHopOff, seatExit, stepOff, stepPose } from "./src/drop.js";
import { planSteps, clearLine, wayThrough } from "./src/route.js";
import { createGridWalker, gridsByPlace, walkerMode, gridBytes, settle as settleAt } from "./src/gridwalker.js";
import { decode as decodeWalk, inflateRawAsync } from "./src/walkgrid.js";
import { createDirector, shotPose, placePoint as placePointOf, holdShot } from "./src/director.js";
import { createOpening } from "./src/opening.js";
import { takeRelang, keepRelang } from "./src/relang.js";
import { takeCrossing } from "./src/pilgrimage.js";
import { inkArrive, inkLift } from "./src/ink.js";
import { createProbes, PROBE_ON } from "./src/probe.js";
import { SKY_TRIAL } from "./src/atmosphere.js";
import { walkIsHis, heldUnder, viewKeyHeard } from "./src/walkgate.js";
/** Whether the walk is his now: no title, opening, language line or crossing's ink over the picture (#462, walkgate.js). */
const walkOpenNow = () => walkIsHis({ body: document.body.classList, html: document.documentElement.classList, openingActive: opening.active() });
import { stride, JUMP, leapStep } from "./src/stride.js";
import { t as tr, FACE, lang, langSource, takeSwitch, glyphs } from "./src/i18n.js";
// The season and the hour as the visitor reads them: 夏 · 昼, Summer · Day.
const moodWords = (m) => m.label.split(" · ").map((w) => tr(w)).join(" · ");

// Address parameters, for testing: ?q=low|medium|high  ?show=<view name>  ?cam=x,z,yaw,pitch  ?fast=1  ?shot=1
//   ?season=spring|summer|autumn|winter  ?time=dawn|day|dusk|night  ?view=first|third
const Q = new URLSearchParams(location.search);
// Opened by a change of language in the pause menu (#140, src/relang.js): the visit as it was, taken once. An address
// that names its own place (a test, a tool, a link) keeps to it and the handover is dropped.
const relang = (() => { let r = null; try { r = takeRelang(sessionStorage, { lang }); } catch {} return r && !["cam", "show", "shot", "in", "up", "enter", "tour", "at", "play", "seals"].some((k) => Q.has(k)) ? r : null; })();
if (!relang) document.documentElement.classList.remove("relang");
// The floor baked from the drawn meshes (#265, #274): fetched while the place is built, and walked on everywhere (the
// courts and the path, the summit pavilion's balcony, every room) unless `?walker=old` asks for the written plan.
// Only the bytes are fetched here; they are opened once the plan is built, and let go.
// Which temple (src/level.js, #369): ?level= names one; a name not known walks the prologue, and says so once.
const LV = levelOf(location.search), L = await loadLevel(LV.id);
setTemple(L); paintTemple(document, L); document.body.classList.toggle("nobook", !L.book);
if (!LV.known) console.warn(`?level=${LV.asked}: no such level; walking ${LV.id}`);
// A level that does not keep its written plan up to what is drawn (T05) refuses `?walker=old`, and says so once.
const WALKER = walkerMode(Q.get("walker"), L), WALKER_ASKED = Q.get("walker") === "old" && WALKER !== "old" ? "old" : undefined;
if (WALKER_ASKED) console.info(`?walker=old: ${L.id} keeps no written plan to walk on; walking on the baked floor`);
// Opened by a crossing from another temple (行脚图, #449, src/pilgrimage.js): the visit handed across, taken once, for this
// level only; an address that names its own place drops it, as a change of language's is. The ink curtain index.html's
// first script kept shut (`html.crossing`) is drawn back once this temple can be drawn (crossingBack below); a handover
// that came to nothing lifts it at once.
const crossing = (() => { let c = null; try { c = takeCrossing(sessionStorage, { level: LV.id }); } catch {} return c && !["cam", "show", "shot", "in", "up", "enter", "tour", "at", "play", "seals"].some((k) => Q.has(k)) ? c : null; })();
if (!crossing) inkLift();
let walkFile = WALKER === "old" ? null : (() => {
  const t0 = performance.now();
  return fetch(asset(`shared/walk/${L.id}.bin`)).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
    .then((buf) => ({ bytes: new Uint8Array(buf), fetchMs: Math.round(performance.now() - t0) }));
})();
const still = Q.has("shot") || matchMedia("(prefers-reduced-motion: reduce)").matches;
createPaper();   // the paper, strokes and seals the interface is drawn with (src/paper.js, src/ui.css)
const ui = createUI();   // what lies over the picture, in order: Esc puts away the top one (src/ui.js)
createCommunity(ui);
createCredits(ui);
createShare(ui);   // the sheet a picture is saved from where the system cannot share it (#344)
// 带走朱印帐 (#338): a link that takes this visit to another browser or device. Its way in is in the book of seals, the
// record it carries, on the small sheet behind 更多 (#473: the book's row is four, 分享 保存 更多 合上; the pause menu
// has no height to spare on a phone held upright, the lead's choice of 2026-11-20).
const carryOut = createCarryOut(ui);
document.getElementById("bookCarry")?.addEventListener("click", () => { ui.close("bookMore"); carryOut.open(); });   // (from the book's 更多 sheet, which it puts away first, #473)
mountVersion(document);   // which build this is, at the foot of the menu and the thanks (#310)
const hints = createHints({ off: Q.has("shot") || TRAILER, ui, strafeAD: () => settings.get().strafeAD }); let arrived = false, walked = false;   // what is said about the controls, and when; whether he has walked yet
const settings = createSettings(browserSettingsStore()); { const S = settings.get(); setLevels({ volume: S.volume, music: S.music, ambience: S.ambience, effects: S.effects }); }   // what the visitor has set for themselves (the pause menu)
// What a visitor changes in the pause menu or the photograph's settings (#326): one event per key in 800 ms, the
// last value winning, so that dragging a slider is a change and not a stream. A value that did not change is not sent.
{
  const text = (v) => (typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  const sent = new Map(Object.entries(settings.get()).map(([k, v]) => [k, text(v)]));
  const pending = new Map(); let timer = 0;
  settings.onChange((next, key) => {
    pending.set(key, next[key]);
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const [k, v] of pending) { const value = text(v); if (sent.get(k) === value) continue; sent.set(k, value); track("demo.setting", { key: k, value }); }
      pending.clear();
    }, 800);
  });
}
const quality = pickQuality(Q.get("q") || (settings.get().quality !== "auto" ? settings.get().quality : null));
const loading = window.templeLoading;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("yardGl"));
// A browser that cannot draw (no WebGL, or the graphics card turned off for it) is told so in words on the title, with no
// "try again", since trying again would fail the same way; the module then stops here and builds nothing more.
const renderer = await (async () => {
  try { return new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" }); }
  catch { loading?.fail({ reason: "webgl" }); return new Promise(() => {}); }
})();
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
// The film's finish (post.js) adds gtao, halation, lut and dof, and `layers` for the mist's layers (fog.js); these switch
// while walking. `softshadow` (shadows.js) and `leafshadow` (the bamboo's dappled shadows) are decided at load.
const PLANAR = quality.planar, PASSES = ["reflect", "bloom", "shadow", "gtao", "halation", "lut", "dof", "layers"];   // the mirror as the tier draws it, for switching it back on
if (OFF.has("reflect")) quality.planar = 0;
if (OFF.has("bloom")) quality.bloom = false;
if (OFF.has("shadow")) renderer.shadowMap.enabled = false;
// Both rewrite three's shader chunks, so they come before any material is made.
layerFog();
if (quality.softShadow && !OFF.has("softshadow")) softShadows(SHADOW_BOX);

await loading.step(tr("山路"));
const M = createMaterials();
const site = L.build(M);
// A closed hall the level says the mist does not fill (fog.js; T05's great hall): its box, for every shader's fog.
if (site.fogShut) { const f = site.fogShut; U.uFogShut.value.set(f.x0, f.z0, f.x1, f.z1); U.uFogShutY.value.set(f.y0, f.y1); layerFog({ shut: true }); }   // its sums go into the chunks now, before anything is drawn; a level with none compiles the shaders it always did
const roofMap = bakeShelter(site.walk.roofs); useShelter(roofMap);   // what the roofs keep out of the snow
part("site", () => scene.add(site.root));
/** @type {{ bake: any, outline: any }} */ let walkBaked = { bake: null, outline: null };   // the bake's settings and his outline, for the debug panel's drawing (src/walkviz.js)
const walker = await (async () => {
  const old = L.createWalker(site);
  if (!walkFile) return Object.assign(old, { stats: { mode: "old" } });
  try {
    const f = await walkFile; walkFile = null;
    const mode = WALKER, t0 = performance.now();
    let body = await inflateRawAsync(f.bytes); const inflated = body.length, d = decodeWalk(f.bytes, () => body, () => "floors"); body = /** @type {any} */ (null);
    const t1 = performance.now(), grids = gridsByPlace(d), w = createGridWalker(old, grids, { doors: site.halls });
    walkBaked = { bake: d.header.bake || null, outline: d.header.outline || null };
    return Object.assign(w, { stats: { mode, bytes: f.bytes.length, inflated, fetchMs: f.fetchMs, decodeMs: Math.round(t1 - t0), prepareMs: Math.round(performance.now() - t1), memory: gridBytes(grids), ledges: w.drops.length, ...(WALKER_ASKED ? { asked: WALKER_ASKED } : {}) } });
  } catch (e) {
    console.warn("[walk] the baked floor could not be read; walking on the written plan:", e);
    return Object.assign(old, { stats: { mode: "old", failed: String(e) } });
  }
})();
await loading.step(tr("山门"));
// The great hall's interior: a room of its own, far below the courts, entered at the hall's door.
const rooms = part("interior", () => { const h = buildInteriors(M, site.halls, renderer); scene.add(h.group); return h; });
if (rooms) rooms.group.visible = false;   // not seen from the courts: the mirror once drew them, figures and all, sixty metres down
// (A level without one of these halls has no place for its incense, #409.)
for (const hall of INCENSE_HALLS) if (rooms.places[incenseId(hall)]) site.places[incenseId(hall)] = rooms.places[incenseId(hall)];
site.seats.push(...rooms.seats);
for (const [id, p] of [...INCENSE_HALLS.map((h) => [incenseId(h), site.places[incenseId(h)]]), ["main-box", rooms.spots["main-box"]]]) if (p) site.views[`shot-${id}`] = [p.at[0], p.at[1], Math.PI - p.face, 0.05];   // their shots are indoors (src/director.js)
await loading.step(tr("殿堂"));
let hallIn = null, upIn = null, viewBefore = null;   // the room he is in, or the balcony he is up on (and the view he had below)
// Trial A (#592, `?trial=probe`): the baked light probes of the court and the great hall, loaded before the first frame so that no frame is drawn without them; a file that does not come leaves the page as it was.
const probes = createProbes(L.id);
if (PROBE_ON) await probes.load().catch((e) => { console.warn("probes: " + e.message); probes.strength(0); });
window.__probes = (k) => { if (k !== undefined) probes.strength(+k); return { on: PROBE_ON, ready: probes.ready, grids: probes.grids }; };
const sky = part("sky", () => createSky(renderer, scene, quality, site.sunFocus));
// The sky's dome is 600 m round and the eye sees 800 m: it stands where the level says, so that every spot walked keeps
// its far side in view (#409: T05 reaches 215 m south of its hall; the prologue's stays at the origin).
const SKY_AT = L.skyAt || [0, 0]; sky.at(SKY_AT[0], 0, SKY_AT[1]);
const ground = part("ground", () => createGround(scene, site.shade, site.censer, site.paving, site.trees));
// A level that has no far hills, no bamboo or no censer of its own (#409: T05 stands in a flat town) builds none of them.
const NONE = { setMood() {}, update() {} };
// #183's spike: on the workbench (the dev server, a preview) ?terrain=dem|made draws the far land from a heightmap instead
// of the hill rings; the canary and the public page never read it (terrainAsked, src/debuggate.js).
const TERRAIN_ASKED = L.backdrop ? terrainAsked({ dev: !!import.meta.env.DEV, hostname: location.hostname, search: location.search }) : null;
const TERRAIN = TERRAIN_ASKED ? await loadHeightmap(asset, TERRAIN_ASKED).catch((e) => { console.warn("terrain:", e.message); return null; }) : null;
const backdrop = L.backdrop ? part("backdrop", () => createBackdrop(scene, M, L.backdrop.site, L.backdrop.terraces, L.land, TERRAIN)) : NONE;
await loading.step(tr("山林"));
// Real bamboo where you come close to it: all round the zigzag you arrive by and the forecourt, and beyond the tea
// (where it grows and where it is kept clear is the level's `grove`).
const bamboo = !L.grove ? NONE : part("bamboo", () => createBamboo(scene, L.grove.areas, L.land, L.grove.keep, { a2c: quality.msaa > 0, fine: quality.name !== "low", leafShadow: quality.leafShadow && !OFF.has("leafshadow"), clearUnder: L.grove.clearUnder, clearCulm: L.grove.clearCulm, extraCulms: L.grove.extraCulms }));
await loading.step(tr("竹林"));
const props = site.censer ? part("props", () => createProps(scene, M, site.censer, L.propsAt)) : { ...NONE, censer: () => ({ none: true }), setTraces: () => 0 };
const post = createPost(renderer, scene, camera, quality, OFF);
await loading.step(tr("院落"));
// The trees that show the season, in every court; the things that fall through the air; the lamps' glow after dark.
const trees = part("trees", () => createTrees(scene, M, site.trees, { a2c: quality.msaa > 0 }));
const drift = part("drift", () => createDrift(scene, quality.name === "low" ? 640 : 1400, site.trees, { rand: TRAILER ? mulberry32(0x5eed) : undefined, areas: L.grove?.areas || [], land: walker.landAt, shelter: roofMap, litter: quality.name !== "low", keep: OFF.has("litter") ? 0 : quality.name === "low" ? 24 : 32 }));
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

await loading.step(tr("树影"));
// Nothing built so far will move again: draw it in as few pieces as the materials allow.
if (trees?.pitStones) site.root.add(trees.pitStones);   // the ginkgoes' pit stones are static stone: they go into the stone batches with the buildings (#611)
const merged = mergeStatic(site.root, [30, -32, -95, -1e9]);
// The dragon well's drops and the rings they send across the water (well.js); the rite's drops ring it too.
// A level with no well has none, and nothing asks it for drops (the same for the birds below).
const well = site.places.well ? createWell(scene, site.places.well.pool, wellDrip) : { update() {}, ripple() {}, state: () => ({ none: true, level: 0 }) };
onDrop(() => well.ripple());
// The birds in the old trees by the bell tower, flushed by the third stroke (flock.js; game.js says when). Not at night,
// when nothing of them would be seen, and not from indoors.
const flock = site.places.bell && site.cedars ? createFlock(scene, site.cedars, site.places.bell.at) : { update() {}, flush: () => false, state: () => ({ none: true }) };
addEventListener("flush", () => { if (!inside && mood.time !== "night" && flock.flush()) flutter(0.8); });

await loading.step(tr("石阶"));
const monk = createMonk({ rand: TRAILER }); monk.blinking = !Q.has("shot");   // the Tripo body blinks, but not in a held picture (#607)
part("monk", () => scene.add(monk.group));
// His opacity, for the eye going into his own eyes or out of them (#102): faded on every material he wears, and given back.
let faded = 1;
// While he is partly drawn, only the surface of him that faces the eye may show (#632): drawn alone, his back face and his front
// face blended one over the other showed the face through the back of the head. Each part is first drawn into the depth buffer
// alone (a twin of the mesh as its child, sharing its skeleton, writing no colour), and its blended pass then passes only where it
// is the nearest surface. The twins exist only while 0 < opacity < 1: at rest, and in every ordinary frame of the walk, there is no
// second draw.
const depthOnly = [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].map((side) => new THREE.MeshBasicMaterial({ colorWrite: false, side }));
const fade = (a) => {
  faded = a; const meshes = [];
  monk.group.traverse((/** @type {any} */ o) => { if (o.isMesh && !o.userData.fadeTwin) meshes.push(o); });
  for (const o of meshes) {
    let solid = true;
    for (const m of [o.material].flat()) {
      if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity, m.userData.baseTransparent = m.transparent;
      m.opacity = m.userData.baseOpacity * a; if (m.userData.baseTransparent) solid = false;
      const t = a < 1 || m.userData.baseTransparent;
      if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
    }
    const twin = o.children.find((c) => c.userData.fadeTwin), want = a > 0 && a < 1 && solid && o !== monk.shadow;
    if (want && !twin) { const tw = o.clone(false); tw.userData.fadeTwin = true; tw.material = depthOnly[[THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].indexOf([o.material].flat()[0].side)]; tw.castShadow = false; tw.receiveShadow = false; tw.renderOrder = 1; tw.morphTargetInfluences = o.morphTargetInfluences; /* after every opaque thing behind him, before the blended pass: drawn first, it would put his outline's depth in front of the wall and the sky, and what he is blended over would be the clear colour; the draped robe's morph (#666) is the body's own array, not a copy */ o.add(tw); }
    else if (!want && twin) o.remove(twin);
  }
};
// His own bounds in the world, the body, the hat and the beads but not his painted shadow, as the geometry's boxes put them where he
// stands (#612), and how near the eye may come to them before he must be wholly clear: the corners of the near plane and 3 cm.
const monkBounds = new THREE.Box3(), monkPart = new THREE.Box3();
const monkWorld = () => {
  monkBounds.makeEmpty(); monk.group.updateWorldMatrix(true, true);
  monk.group.traverse((/** @type {any} */ o) => { if (!o.isMesh || o === monk.shadow) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); monkPart.copy(g.boundingBox).applyMatrix4(o.matrixWorld); monkBounds.union(monkPart); });
  return monkBounds;
};
const monkNear = () => eyeRadius(camera.fov, camera.aspect, camera.near) + 0.03;
// He wears the figure built in code (src/monk.js, #642). ?body=tripo fetches the layered body made from Tripo's model
// (#163; src/novice.js) while the place is built, and the page is not called ready until it has arrived or failed, so
// that no picture catches him half dressed; ?body=sculpt wears the older body made with Meshy. A body that fails to
// arrive or to fit leaves him as built in code, with a warning. `body` is what he wears: "code" until a fetched body is on him.
const bodyAsked = bodyChoice(Q);
let body = "code", bodySettled = bodyAsked === "code";
if (bodyAsked !== "code") loadNovice(monk, asset(BODY_FILE[bodyAsked])).then(() => { body = bodyAsked; }, (e) => console.warn(`the ${bodyAsked} body was not worn: ${e?.message || e}`)).finally(() => { bodySettled = true; });

await loading.step(tr("行走"));
// ---- The hour and the season ----------------------------------------------------
const nowMood = moodNow();
// The prologue is where a visitor first meets the place, and it is walked by day, whatever the hour at home (the owner,
// 2026-11-17): until the book has been filled once, the hour is 昼 and does not follow the clock. The season stays the
// visitor's own. The workbench's ?seals= book counts as filled only when it is all seven.
const keptBook = (() => { try { return localStorage.getItem(JOURNEY_KEY); } catch { return null; } })();
const prologueDay = !(Q.has("seals") ? Q.get("seals") === "all" : filledBefore(keptBook));
const state = { hand: false, ...startMood({ query: Q, now: nowMood, prologueDay, firstMood: L.firstMood, keepsPlace: !!L.keepsPlace }) };
// After the prologue the hour follows the visitor's clock unless ?time=, a fixed view or a hand has chosen one; a hand's
// choice lasts this page only and is stored nowhere (#135). setMood itself does not decide it: the chips and __mood do.
// (A level may say how it looks the first time, Level.firstMood: T05 opens in early winter by day, J01; startMood in mood.js.)
// The year-end bell (#341): on that night (or on the workbench with ?event=joya) the mountain is a winter night, unless the
// address names a season, an hour or a fixed view. A hand that picks one later keeps it (`state.hand`).
const joyaNight = () => eventFor({ query: Q, bench: import.meta.env.DEV || /-temple-walk-preview\./.test(location.hostname) }).open && !(SEASONS.includes(Q.get("season")) || TIMES.includes(Q.get("time")) || Q.has("shot") || Q.has("show") || Q.has("cam"));
// What the visitor had before the night took over, given back when the window closes (unless a hand has chosen since).
let beforeJoya = null;
if (joyaNight()) { beforeJoya = { season: state.season, time: state.time, follow: state.follow }; state.season = "winter"; state.time = "night"; state.follow = false; }
// Across a change of language the season and hour of this visit are as they were, a hand's choice of hour too (#140).
{ const carried = relang || crossing;   // (a crossing from another temple carries the visit's season and hour too, #449)
  if (carried && carried.season && carried.time && !Q.has("season") && !Q.has("time")) { state.season = carried.season; state.time = carried.time; state.follow = carried.follow && !prologueDay; } }
let mood = null;
let afterMood = null;   // set further down, once there are rooms: what a change of hour means to someone indoors
// The mist's layers, as the hour gives them (indoors, where the rooms stand sixty metres under the courts, `dress`
// takes them away again).
const layers = () => { const L = mood.fogLayer; U.uFogLayer.value.set(OFF.has("layers") ? 0 : L[0], L[1], 1 / L[2], L[3]); if (document.body.classList.contains("indoors")) U.uFogLayer.value.x = 0; };
function setMood(season, time) {
  state.season = season; state.time = time; mood = moodOf(season, time, L.moodFor);
  sky.setMood(mood);
  U.uSnow.value = mood.snow; U.uWet.value = mood.wet; U.uLamp.value = mood.lamp; U.uWinNight.value = mood.winNight; U.uLeaf.value.fromArray(mood.leaf); U.uWin.value.fromArray(mood.win);
  layers();
  backdrop.setMood(mood); bamboo.setMood(mood); props.setMood(mood); post.setMood(mood); trees.setMood(mood); ground.setMood?.(mood); drift.setMood(mood, U.uLight.value); trail.enable(mood.snow > 0.01);
  if (glowCloud) { glowCloud.material.uniforms.uOp.value = Math.min(0.7, mood.lamp * 0.45); glowCloud.visible = mood.lamp > 0.01; }
  monk.setSun(SUN_DIR, mood.sunI / 3);
  renderer.toneMappingExposure = mood.exp;
  renderer.shadowMap.needsUpdate = true;
  document.querySelectorAll("[data-season]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.season === season)));
  document.querySelectorAll("[data-time]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === time && !(state.follow && b.closest("#menu, #moodPanel")))));
  document.querySelectorAll("[data-follow]").forEach((b) => b.setAttribute("aria-pressed", String(!!state.follow)));
  const tag = document.getElementById("moodTag"), said = moodWords(mood); if (tag) { if (tag.textContent && tag.textContent !== said) hints.say.mood(); tag.textContent = said; }
  afterMood?.();
}
setMood(state.season, state.time);

// ---- The novice ------------------------------------------------------------------
let view = relang ? relang.view : Q.get("view") === "third" || (!Q.has("view") && !Q.has("show") && !Q.has("cam")) ? "third" : "first";
// The camera is raised on what he is looking at: the same eye, the same direction, the whole view. From there it
// only draws nearer or farther (`zoom`: 1 is the view as it was); it does not turn.
const photo = { on: false, aspect: "screen", zoom: 1, monk: false, pray: false };
const ASPECT = { tall: [3, 4], square: [1, 1], wide: [16, 9] }, ZOOM = { min: 0.7, max: 6 };
// Where a fixed view or a photograph is focused (post.js's very shallow depth of field): on him when he is in the
// picture, otherwise some way into the place.
const focusAt = () => (monk.group.visible ? camera.position.distanceTo(new THREE.Vector3(pos.x, footY + 0.8, pos.z)) : 18);

// ---- Looking and walking ------------------------------------------------------
const EYE = 1.3;   // the eye height of a child
const pose = Q.has("cam") ? Q.get("cam").split(",").map(Number) : site.views[Q.get("show")] || site.start;
// A place copied into an address by an older ?devpose was cut to centimetres, which beside a stair can fall just inside
// the stop along its cheek, where the ground reads as the level below and he would stand sunk into the steps: such a
// place steps out to the nearest free point a few centimetres off.
// So may a place given before the floor was baked from what is drawn (#265): it moves to the nearest open spot within half
// a metre, or, with none, to the start of the path (`settle` in gridwalker.js).
if (Q.has("cam") && !Q.has("in")) { const p = settleAt(walker, pose[0], pose[1]) || { x: site.start[0], z: site.start[1] }; pose[0] = p.x; pose[1] = p.z; }
const pos = new THREE.Vector3(pose[0], EYE, pose[1]);
let yaw = pose[2], pitch = pose[3], target = null, route = [], running = true, footY = walker.heightAt(pos.x, pos.z), doorArmed = true;
// Where he stands in the picture from behind him is held fixed (eye.js, FRAMES; issue #271): by default B, in the middle
// and a little below it; ?frame=a over his shoulder, a little left of the middle; ?frame=old the eye as it was, 1.2 m to
// his right, eased in to his back by every wall, kept for comparing.
const FRAME_KEY = Q.get("frame") === "old" ? "old" : Q.get("frame") === "a" ? "a" : "b", FRAME = FRAME_KEY === "old" ? null : FRAMES[FRAME_KEY];
let heading = Math.atan2(Math.sin(yaw), -Math.cos(yaw)), sideNow = 1.2, speedNow = 0;
// Turning the view back behind him (#295, camturn.js): R, the middle mouse button or the small ring on a touch screen swings
// it round to look the way he faces; and while he walks a tapped way with the hand off the view, it drifts round behind
// the way he goes (镜头跟随, the pause menu). A hand on the view stops the drift and starts its wait again.
let turning = null, turnedByHand = 0;
// What the swings and the drift did, frame by frame (__probe().turn): the most the view turned in a second, tipped in a frame, and the eye moved in a frame.
const turnStats = { swings: 0, rate: 0, pitch: 0, move: 0, drifted: 0, driftRate: 0, last: null };
const driftTurn = createFollowTurn();
function handTurn(d) { driftTurn.hand(); turnedByHand += Math.abs(d); if (turnedByHand > Math.PI) hints.say.turned(); }
function recenter() {
  if (view !== "third" || photo.on || cine || director.active() || opening.active() || ui.modal()) return false;
  turning = { plan: planRecenter(yaw, yawBehind(heading)), t: 0 }; driftTurn.hand(); track("demo.recenter", {}); turnStats.swings++; turnStats.last = null;
  return true;
}
const follow = createFollow();
const LOOK_EASE = 0.06, look = { yaw, pitch, vy: 0, vp: 0 };   // the way the view looks this frame, coming round after yaw and pitch
const WALK = { up: 7, down: 8 }, pace = { v: 0, dir: [0, -1] }, bob = { phase: 0, amp: 0 };   // how fast he gathers and loses speed (m/s²); his speed and the way he goes
if (view === "third" && !Q.has("cam") && !Q.has("show")) pitch = 0.04;

// What a walk is for, and what he is doing when he has arrived: `arrive` is told whether he got there;
// `stage` holds him in place (facing a way, praying or seated) until the visitor sends him elsewhere.
let arrive = null, stage = null, cine = null, drawn = null, posed = null; const ticks = [];
const settle = (ok) => { if (arrive) { const fn = arrive; arrive = null; fn(ok); } };
const interrupt = () => { settle(false); if (stage) { const st = stage; stage = null; st.leave && st.leave(); } };
// While an observance is made the eye may leave his shoulder for the place's own shot and come back (src/director.js).
// The ink is the shutter's two leaves (#curtain), drawn here frame by frame; what lies over the picture fades meanwhile.
const curtainLeaves = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("#curtain i")]);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const inkVeil = (k) => { const c = document.getElementById("curtain"); if (!c) return; c.classList.toggle("cut", k > 0); for (const l of curtainLeaves) l.style.transform = k > 0 ? `scaleY(${k.toFixed(3)})` : ""; };
// What the director's swings and shots are kept out of (#295): once the eye's hierarchy is built, what is drawn, with the
// sphere of this frame's lens (a railing is drawn, so `railNear` has nothing more to add); until then the written plan.
const eyeWalker = Object.assign(Object.create(walker), {
  // (where the level keeps the eye out, the bamboo, it is shut whether or not the eye's space has been built yet: #515)
  eyeShut: (x, y, z, foot) => (L.eyeKeepOut?.(x, y, z, eyeSpace ? eyeSpace.radius : 0.25) ? true : eyeSpace ? (eyeSpace.shut(x, y, z) ? true : false) : walker.eyeShut(x, y, z, foot)),
  railNear: (x, y, z, m) => (eyeSpace ? false : walker.railNear(x, y, z, m)),
});
const director = createDirector({ walker: eyeWalker,
  enabled: () => settings.get().autocam && !Q.has("shot") || Q.get("show")?.startsWith("shot-") === true,
  reduced: () => reducedMotion.matches,
  veil: inkVeil,
  quiet: (on) => document.body.classList.toggle("directing", on),
});
// The opening after 入山 (src/opening.js): the eye on the summit, then down the mountain to him. While it plays nothing
// lies over the picture (body.opening), and a click, a key, a tap, the wheel or Esc brings it down the rest of the way at
// once; the event that does so goes no further (it does not walk him, strike the bell or open the menu).
const opening = createOpening({ veil: inkVeil }), openingEye = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50 };
let openingDone = null;
const endOpening = () => { document.body.classList.remove("opening"); const s = opening.state(); if (openingDone) { const fn = openingDone; openingDone = null; fn(s); } };
for (const ev of ["keydown", "pointerdown", "wheel"]) addEventListener(ev, (e) => {
  if (!opening.active()) return;
  if (!(ev === "keydown" && /** @type {KeyboardEvent} */ (e).repeat)) opening.skip();   // (a key held down from the title does not skip by repeating)
  e.stopPropagation(); if (ev !== "pointerdown") e.preventDefault();
}, { capture: true, passive: false });
const centre = new THREE.Vector3();
// The eye's swing keeps the observances' clock (rites.js), not the frames': on a page drawing fewer than twenty frames a
// second the frame's own step is cut short (`dt` is held to 0.05 s), and a swing timed by it would still be on its way
// when the lamp is lit and done. The clock stops with a photograph, as the observances do; a long pause is not swung through.
let directClock = riteNow();
const menuEl = document.getElementById("menu");
let planning = null, planGoal = null;   // a way round to a tapped spot, being worked out a few milliseconds a frame (route.js)
let down = null, hop = null, leap = null, climb = null, climbFor = null, climbs = 0;   // `hop`: a planned drop from a porch; `leap`: a small jump where he stands, steered as he goes
// The first touch lets the place be heard: deepest in the bamboo on the way up, and again beyond the tea.
const grove = () => L.groveSound(pos.x, pos.z);
// What the sound needs to know of the place: the bamboo, which part of the mountain (the music follows it), the mood.
const ZB = L.zones;
// `t`: the clock the frame draws the wind by (`now / 1000`, the same timeline as performance.now()), so that the gusts
// heard are the ones the leaves and the smoke are seen to follow. (Under ?shot or reduced motion the picture holds its
// clock at 0; the sound goes on along the timeline.)
let joyaOn = false;   // the year-end bell's night is open (joya-ui.js says so): the bell's court plays only the drone (score.js)
const hearing = () => ({ grove: grove(), zone: zoneOf(pos.x, pos.z, inside, ZB), layer: layerOf(pos.x, pos.z, inside, ZB), joya: joyaOn, season: state.season, time: state.time, wet: mood.wet, snow: mood.snow, t: performance.now() / 1000 });
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
  if (view === "first") { if (k > 1 && (nudge += Math.log(k)) > 0.3) { nudge = 0; reachWant = 2.6; setView("third"); if (/** @type {string} */ (view) !== "first") track("demo.view", { to: "third" }); } else if (k < 1) nudge = 0; return; }
  const near = reachWant <= 2.6 + 1e-6; reachWant = THREE.MathUtils.clamp(reachWant * k, 2.6, 11);
  if (k < 1 && reachWant <= 2.6 + 1e-6) hints.say.nearest();
  if (k < 1 && near) { if ((nudge -= Math.log(k)) > 0.3) { nudge = 0; setView("first"); if (view === "first") track("demo.view", { to: "first" }); } } else nudge = 0;
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
  if (e.movementX || e.movementY) director.back();
  if (turning) return;   // (while the view swings back behind him, the hand's turn is not taken: the two would pull against each other)
  if (e.movementX) handTurn(e.movementX * LOOK.yaw * S.sens);
  yaw += e.movementX * LOOK.yaw * S.sens; pitch = THREE.MathUtils.clamp(pitch - e.movementY * LOOK.pitch * S.sens * (S.invertY ? -1 : 1), orbit ? -1.0 : -0.75, orbit ? 0.45 : inside ? 0.9 : 0.5);
});
canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button === 1) { e.preventDefault(); recenter(); return; }   // the middle button turns the view back behind him (#295)
  touches.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing";
  if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); down = null; return; }
  down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
});
canvas.addEventListener("pointermove", (e) => {
  if (locked()) return;   // relative mousemove owns the camera while the pointer is held
  if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size === 2) { const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch > 0) { zoom(pinch / d); hints.say.pinched(); } pinch = d; return; }
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.moved && Math.hypot(dx, dy) < (e.pointerType === "mouse" ? 6 : 14)) return;   // a finger never lands perfectly still
  if (photo.on) { down.moved = true; return; }                                             // the camera does not turn: a drag is only not a click
  const orbit = view === "third";                                                          // round him, or from his eyes
  const S = settings.get();
  const k = dragRate(e.pointerType);
  director.back();   // a drag of the view: the visitor wants to look for themselves
  if (!down.moved) hints.say.dragged();
  if (turning) { down.moved = true; down.x = e.clientX; down.y = e.clientY; return; }   // (as with the mouse held)
  handTurn(dx * k * S.sens);
  down.moved = true; yaw += dx * k * S.sens; pitch = THREE.MathUtils.clamp(pitch - dy * k * S.sens * (S.invertY ? -1 : 1), orbit ? -1.0 : -0.75, orbit ? 0.45 : inside ? 0.9 : 0.5);   // a finger and a mouse look the same way
  down.x = e.clientX; down.y = e.clientY;
});
canvas.addEventListener("wheel", (e) => { zoom(e.deltaY > 0 ? 1.1 : 0.91); e.preventDefault(); }, { passive: false });
const lift = (e) => { touches.delete(e.pointerId); pinch = 0; };
canvas.addEventListener("pointercancel", (e) => { lift(e); down = null; });
// A right-click is the browser's own menu, except in the middle of a look-drag: there is nothing on the canvas it could
// be for, and it would only interrupt the hand that is turning the view. Let go and it is the browser's again.
canvas.addEventListener("contextmenu", (e) => { if (down?.moved) e.preventDefault(); });
const ray = new THREE.Raycaster();
// Where a tap lands on the ground. The ground is not flat: follow the line of sight outward until it first
// dips below whatever can be stood on there (a court, a terrace, a flight of steps), then close in on that spot.
// The dark behind each hall's open leaves is no ground (#411: the eye that follows him out of a door may stand in it, and a tap's line of sight then starts
// inside it): the line passes through it and goes on to find the court. The boxes are the ones the doorways paint (`site.doorways`), taken in world space once.
let darkBoxes = null;
const inDark = (p) => {
  if (inside) return false;   // interior rooms sit below the courts (FLOOR = -60); exterior doorway boxes only apply outdoors
  darkBoxes ||= Object.values(site.doorways || {}).map((w) => { w.mesh.updateWorldMatrix(true, false); w.mesh.geometry.computeBoundingBox(); const bx = w.mesh.geometry.boundingBox.clone().applyMatrix4(w.mesh.matrixWorld); bx.min.y = -1e3; return bx; });   // (the box's whole footprint, however far down: a line from an eye in the dark that leaves it through its floor is still in the hall)
  return darkBoxes.some((bx) => bx.containsPoint(p));
};
function pickFloor() {
  const o = ray.ray.origin, d = ray.ray.direction, p = new THREE.Vector3(), under = (s) => { p.copy(d).multiplyScalar(s).add(o); return p.y <= walker.heightAt(p.x, p.z) && !inDark(p); };
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
  if (down && !down.moved && performance.now() - down.t < 600 && !photo.on && walkOpenNow()) {   // (a tap that reaches the picture under the title walks nobody: #462)
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    // The bell and the drum answer a tap from anywhere in their court.
    const struck = ray.intersectObjects(site.strikers.map((s) => s.mesh), false)[0];
    if (struck && struck.distance < 32) {
      const s = site.strikers.find((k) => k.mesh === struck.object);
      strike(s.kind, Math.min(1, 9 / Math.max(6, struck.distance) + 0.25)); s.t0 = riteNow(); s.lead = 0; window.dispatchEvent(new CustomEvent("struck", { detail: s.kind }));
      down = null; return;
    }
    let hit = pickFloor();
    if (hit && upIn && Math.abs(walker.heightAt(hit.x, hit.z) - upIn.floor) > 0.05) hit = null;   // up on the balcony, only its own floor answers a tap
    const hall = site.hall, onBase = !!hall && pos.x >= hall.box.min.x && pos.x <= hall.box.max.x && pos.z >= hall.box.min.z && pos.z <= hall.box.max.z,
      toHall = !!hall && !inside && !onBase && ray.ray.intersectsBox(hall.box) && pos.z > hall.door.z && pos.z < L.hallTapZ, onGround = walker.onGround(pos.x, pos.z);
    // Tapping the main hall from its court means "go to its door" (only from the court: standing on its porch or steps he is inside the box, and a tap there is just a tap on the ground); the way there, and back, is over the steps.
    if (toHall) route = onGround ? [hall.foot.clone(), hall.door.clone()] : [hall.door.clone()];
    else if (hit && Math.hypot(hit.x - pos.x, hit.z - pos.z) < 70) {
      // A straight line that is open is walked as it was; one that is shut is searched round (route.js), a few milliseconds a frame, he waiting where he is.
      if (!walker.blocked(pos.x, pos.z) && clearLine(walker, pos, hit)) route = [hit];
      else { route = []; interrupt(); director.back(); target = null; planGoal = { x: hit.x, z: hit.z }; planning = planSteps(walker, walker.drops, { x: pos.x, z: pos.z }, planGoal); }
    } else route = [];
    if (route.length) { planning = null; interrupt(); director.back(); target = route.shift(); }
  }
  down = null;
});
const keys = {};
const dropButton = document.getElementById("dropBtn");
// Which way the keys and the stick walk him and turn him (keyturn.js): A and D turn unless the visitor keeps the old way.
const keyTurn = createKeyTurn();
const axes = () => keyAxes(keys, joy, settings.get().strafeAD ? "strafe" : "turn");
function availableDrop() {
  if (hop || leap || inside || stage || passing || photo.on || !document.body.classList.contains("entered")) return null;   // not in mid-air either
  if (ui.covered()) return null;
  const { f, s } = axes();
  return findDrop(walker, walker.drops, pos.x, pos.z, f || s ? Math.sin(yaw) * f + Math.cos(yaw) * s : Math.sin(yaw), f || s ? -Math.cos(yaw) * f + Math.sin(yaw) * s : -Math.cos(yaw));
}
function startDrop() {
  const plan = availableDrop(); if (!plan) return false;
  interrupt(); target = null; route = []; hop = { plan, elapsed: 0 }; return true;
}
// Facing the unrailed edge of a platform his jump reaches, from below it (drop.js `findClimb`): the way up.
function availableClimb() {
  if (hop || leap || inside || stage || passing || photo.on || !document.body.classList.contains("entered") || ui.covered()) return null;
  const { f, s } = axes();
  return findClimb(walker, walker.drops, pos.x, pos.z, f || s ? Math.sin(yaw) * f + Math.cos(yaw) * s : Math.sin(yaw), f || s ? -Math.cos(yaw) * f + Math.sin(yaw) * s : -Math.cos(yaw));
}
// Space: a child's jump (stride.js). He can be steered in the air and lands on whatever is under him.
function startJump() {
  if (hop || leap || stage || passing || photo.on || !document.body.classList.contains("entered")) return false;
  if (ui.covered()) return false;
  const plan = availableClimb();   // from below a low porch's edge, the jump goes up onto it
  if (plan) { interrupt(); target = null; route = []; hop = { plan, elapsed: 0 }; return true; }
  leap = { y: footY, v: JUMP.speed }; return true;
}
// On a touch screen, one faint ring lower right, across from the stick: it jumps, and where a porch's edge is before him it
// is the way down (下台阶) or up (上台), as Space is on a keyboard. It is made only for a coarse pointer, and the porch's own
// hop-down chip (#dropBtn) is hidden there: this is that button.
const jumpButton = hints.coarse ? Object.assign(document.createElement("button"), { id: "jumpBtn", type: "button", hidden: true }) : null;
if (jumpButton) {
  document.body.appendChild(jumpButton);
  // pointerdown, not click: a thumb on the stick and another on this are two touches, and the jump should leave as it lands
  jumpButton.addEventListener("pointerdown", (e) => { e.preventDefault(); if (!startDrop()) startJump(); });
  jumpButton.addEventListener("contextmenu", (e) => e.preventDefault());
}
// Over it, a smaller ring that turns the view back behind him (#295): the touch screen's R.
const turnButton = hints.coarse ? Object.assign(document.createElement("button"), { id: "turnBtn", type: "button", textContent: tr("回正") }) : null;
if (turnButton) {
  turnButton.setAttribute("aria-label", tr("镜头转回身后（鼠标中键亦可）"));
  document.body.appendChild(turnButton);
  turnButton.addEventListener("pointerdown", (e) => { e.preventDefault(); recenter(); });
  turnButton.addEventListener("contextmenu", (e) => e.preventDefault());
}
function labelJump() {
  if (!jumpButton) return;
  const kind = availableDrop() ? "drop" : availableClimb() ? "climb" : "jump";
  if (jumpButton.dataset.k !== kind) { jumpButton.dataset.k = kind; jumpButton.textContent = kind === "drop" ? tr("下台阶") : kind === "climb" ? tr("上台") : tr("跳"); }
  jumpButton.hidden = !document.body.classList.contains("entered") || photo.on;
}
if (dropButton) { dropButton.innerHTML = hints.coarse ? tr("下台阶") : tr("<kbd>Space</kbd>下台阶"); dropButton.addEventListener("click", startDrop); }

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
  else if ((k === "v" || k === "r") && !viewKeyHeard(walkOpenNow(), k)) return;   // (the view is not turned or changed under the title either, #462)
  else if (k === "v") { const to = view === "third" ? "first" : "third"; setView(to); if (view === to) track("demo.view", { to }); }
  else if (k === "r") { if (recenter()) e.preventDefault(); } else if (k === "b" || k === "tab") { press("bookBtn"); e.preventDefault(); }
  else if (k === "p") { if (!press("photoClose")) press("photoBtn"); } else if (k === "t") { if (document.body.classList.contains("seasons")) ui.toggle("moodPanel"); }   // the seasons are the visitor's once the book has been filled once (game.js)
  else if (k === "h" || k === "?") hints.card();
  else if (k === "escape") { if (stage || director.holding()) { interrupt(); director.back(); } else if (document.body.classList.contains("entered")) openMenu(true); }   // Esc lets go of what he is doing (the rope, a seat); with nothing open or held, it is the pause menu
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

/** @type {any} */ let clipView = null;   // while a film is made: the view as it was, the frame in it, and the film's size (drawn at that size, whole: see startClip)
const viewW = () => (clipView ? clipView.w : canvas.clientWidth), viewH = () => (clipView ? clipView.h : canvas.clientHeight);
function resize() {
  if (clipView) { const v = clipView; renderer.setPixelRatio(1); renderer.setSize(v.W, v.H, false); post.resize(v.W, v.H, 1); ground.resize(v.W >> 1, v.H >> 1, quality.planar > 0); camera.aspect = v.W / v.H; lens(); pxH = v.H; return; }
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
// A level may give a named view a lens of its own (`site.lens[name] = { first, third }`, in degrees: T05's cam06 is seen at 65° from his eyes, docs/t05/PRD.md §3):
// `?show=<name>` then takes it where the fixed views take 52° and 44°, and a picture held upright is that much wider again as the fixed views' is. A view with no entry, and a page with no table, are as before.
const viewLens = Q.has("show") && !Q.has("cam") ? site.lens?.[Q.get("show")] : null;
const baseFov = () => {
  const w = viewW(), h = viewH(), tall = w < h, own = FIXED_VIEW && viewLens ? viewLens[view === "third" ? "third" : "first"] : null;
  if (own) return own + (tall ? (view === "third" ? 14 : 16) : 0);
  return FIXED_VIEW ? (view === "third" ? (tall ? 58 : 44) : tall ? 68 : 52) : (view === "third" ? (tall ? 62 : 50) : tall ? 75 : 65) + settings.get().fov;
};
// With the camera raised, the angle drawn in or let out by the zoom (from the walk's angle, or from a shot's).
const zoomed = (base) => (photo.on ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / photo.zoom)) : base);
let directedFov = null;   // the angle of view the director last asked for, while it has the eye
function lens() { camera.fov = zoomed(directedFov ?? baseFov()); camera.updateProjectionMatrix(); }
let pxH = 800;
// The frame of the photograph, drawn over the view: what is inside it is what will be kept.
function frameRect() {
  const cw = viewW(), ch = viewH(); if (photo.aspect === "screen") return { w: cw, h: ch, x: 0, y: 0 };   // the whole view, as he sees it
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
// When frames run long the governor gives things up (quality.js): the occlusion and the soft shadows go first, here.
const governor = createGovernor(quality, () => { if (!quality.gtao) post.off("gtao"); if (!quality.softShadow) sky.soft(false); resize(); track("demo.quality", { tier: quality.name, level: governor.level, gtao: quality.gtao, soft: quality.softShadow, planar: quality.planar, scale: +quality.scale.toFixed(2) }); });
new ResizeObserver(resize).observe(canvas); resize();

let prev = performance.now(), frames = 0, tour = null, devpose = null, eyeY = footY, mirrorOn = true, monkHidden = false;
// What the eye is kept out of (#295, eyespace.js): the place's own triangles, gathered a few milliseconds a frame once the
// walk is the visitor's, sorted into a hierarchy by a worker, then asked with a sphere as big as the near plane's corners.
// Until then (and with ?off=eyebvh) the eye asks the written plan, as it did.
let eyeSpace = null, eyeGather = null, eyeHeld = null;
// (#623) An address that names the eye (`eye=x,y,z,dist`, from __debugURL or ?devpose) stands it there and holds it until he
// first walks or the view is dragged, so that what a tester saw is what opens. Production does not read it.
let eyePin = null;
const eyeInfo = { state: OFF.has("eyebvh") ? "off" : "waiting", tris: 0, gatherMs: 0, buildMs: 0, t0: 0, byPart: /** @type {Record<string, number>} */ ({}) };
function growEyeSpace() {
  if (eyeInfo.state === "waiting") {
    if (frames < 30 || opening.active()) return;   // (from the title on: by the time the walk is the visitor's it is mostly built, #368)
    eyeInfo.state = "gathering"; eyeInfo.t0 = performance.now();
    eyeGather = gatherEye(scene, eyeBoxes(L.eyeBox, rooms?.group), 4, OFF, eyeInfo.byPart = {});   // (the rooms too, and the courts though he be in a room)
  }
  if (eyeInfo.state !== "gathering" || opening.active()) return;   // (the opening waits for steady frames and has them: the gathering waits for it)
  const r = eyeGather.next(); if (!r.done) return;
  const positions = r.value; eyeGather = null; eyeInfo.tris = positions.length / 9; eyeInfo.gatherMs = Math.round(performance.now() - eyeInfo.t0); eyeInfo.state = "building";
  const w = new EyeWorker();
  w.onmessage = (e) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(e.data.positions, 3));
    eyeSpace = createEyeSpace(MeshBVH.deserialize(e.data.data, geo, { setIndex: true }), L.eyeKeepOut || null, { thickWalls: !!L.eyeThickWalls }); eyeInfo.buildMs = Math.round(e.data.ms); eyeInfo.state = "ready"; w.terminate();
  };
  w.onerror = () => { eyeInfo.state = "failed"; w.terminate(); console.warn("the eye's hierarchy could not be built: it asks the written plan"); };
  w.postMessage({ positions }, [positions.buffer]);
}
const load = { tris: 0, calls: 0, ms: 0 };
/** @type {any} */ let clipRec = null;   // the short film being made (clip.js), if any
let frozen = false;   // a photograph holds the picture still from the shutter until the print is put away
/** @type {any} */ let walkViz = null;   // (the debug panel's drawing of what stops him; null until it is switched on)
function frame(now) {
  if (!running) return;
  if (frozen) { prev = now; requestAnimationFrame(frame); return; }
  governor.tick((now - prev) / 1000); tour?.frame(now); devpose?.tick(now); if (eyeInfo.state === "waiting" || eyeInfo.state === "gathering") growEyeSpace();
  const dt = Math.min(TRAILER ? 0.2 : 0.05, (now - prev) / 1000), t = still ? 0 : now / 1000; prev = now;   // (a film drawn at 12 frames a second for a preview must still run at the pace of a walk: its frame is the clock's, never slow)

  // Walk: keys or the tapped spot, at a slow pace, sliding along what blocks the way.
  const menuUp = ui.modal();   // a sheet over the walk: he stands still
  // Under the title, the opening, the line a change of language puts up and a crossing's ink the keys and the stick do nothing (#462, walkgate.js).
  const held = photo.on || menuUp ? { f: 0, s: 0, turn: 0 } : heldUnder(walkOpenNow(), axes()), f = held.f, s = held.s;
  // A and D turn him and the view with him (#295, keyturn.js; the side arrows step sideways), unless the visitor has asked
  // for the old way; a turn by the keys is a hand on the view: it sends the eye home from a shot and stops the drift.
  if (!cine && !stage && (held.turn || keyTurn.rate)) {
    if (held.turn) { if (turning) turning = null; director.back(); handTurn(0); }
    yaw = keyTurn.step(dt, yaw, held.turn, settings.get().sens);
  }
  const x0 = pos.x, z0 = pos.z, flight = hop, airborne = !!flight, stepping = !!(flight && flight.plan.step);   // (a step down is walked, not hopped)
  let vx = 0, vz = 0;
  if (planning && (f || s)) planning = null;
  if (planning) { const r = planning.next(); if (r.done) { planning = null; const pts = r.value.points; if (!r.value.reached && planGoal) pts.push({ x: planGoal.x, z: planGoal.z });   // (a spot that cannot be stood on: on to it as far as he can go, as before; a door is walked into this way)
      if (pts.length && !f && !s) { pts[0].escape = walker.blocked(pos.x, pos.z); route = pts.slice(1); target = pts[0]; } } }
  if (f || s) { interrupt(); director.back(); target = null; route = []; vx = Math.sin(yaw) * f + Math.cos(yaw) * s; vz = -Math.cos(yaw) * f + Math.sin(yaw) * s; }
  else if (target) { vx = target.x - pos.x; vz = target.z - pos.z; if (Math.hypot(vx, vz) < 0.02) { const reached = target; target = route.shift() || null; vx = vz = 0; if (reached.drop) { hop = { plan: reached.drop, elapsed: 0, then: [target, ...route].filter(Boolean) }; target = null; route = []; pace.v = 0; } else if (!target) { settle(true); pace.v = 0; } } }
  const len = Math.hypot(vx, vz);
  const dismounting = !!(climb && climb.down && climb.t < climb.plan.duration);
  if (menuUp || photo.on || (airborne && !stepping) || dismounting) pace.v = 0;   // a sheet over the walk, the camera raised, a hop or seat dismount: he stands, or the arc carries him (a step down he walks on from)
  // He gathers speed and loses it again over a few steps, as a child walks, rather than starting and stopping dead:
  // the picture lurching into motion is felt (《小王子》's PlayerController: 7 m/s² up, 8 m/s² down). Let go of the
  // keys and he slows along the way he was going; coming to a tapped spot he slows so as to stop on it.
  if (len > 0) { const ux = vx / len, uz = vz / len; pace.v *= Math.max(0, ux * pace.dir[0] + uz * pace.dir[1]); pace.dir = [ux, uz]; }   // turned right round, he starts again
  if ((len > 0 || pace.v > 0) && !airborne && !dismounting) {
    const walkPace = keys.shift || Math.hypot(joy.x, joy.y) > 0.94 ? 4.2 : 2.1 * (f || s ? Math.min(1, Math.max(0.35, len)) : 1);
    let want = len === 0 ? 0 : Math.min(walkPace, walker.onStairs(pos.x, pos.z) ? STAIR.tread * (keys.shift ? STAIR.hurry : STAIR.steps) : Infinity);   // Shift to hurry; a stick pushed a little walks slowly
    if (target) { let left = len, at = target; for (const p of route) { left += Math.hypot(p.x - at.x, p.z - at.z); at = p; } want = Math.min(want, Math.sqrt(2 * WALK.down * left) + 0.15); }
    if (Q.has("fast")) pace.v = len === 0 ? 0 : 14;
    else pace.v += Math.max(-WALK.down * dt, Math.min(WALK.up * dt, want - pace.v));
    const step = Math.min(f || s || len === 0 ? 1e9 : len, pace.v * dt); vx = pace.dir[0] * step; vz = pace.dir[1] * step;
    // Walking out over a low porch's edge (keys or the stick), he steps down it (#294, drop.js `stepOff`): on the baked floor only.
    const down = (f || s) && walker.kind === "grid" ? stepOff(walker, pos.x, pos.z, pace.dir[0], pace.dir[1]) : null;
    if (down) { interrupt(); target = null; route = []; hop = { plan: down, elapsed: 0 }; }
    // Take the step, sliding along what is in the way or going round it (stride.js).
    // (Put down in something that blocks, by a link or a tap's way out, he steps out of it by the first leg of the way.)
    const moved = down ? true : target && target.escape && walker.blocked(pos.x, pos.z) ? (pos.x += vx, pos.z += vz, true) : stride(walker, pos, vx, vz);
    if (!moved) { target = null; route = []; settle(false); pace.v = 0; }
  }
  if (flight) {
    flight.elapsed += dt; const p = (flight.plan.step ? stepPose : flight.plan.speed ? climbPose : dropPose)(flight.plan, flight.elapsed); pos.x = p.x; pos.z = p.z; footY = p.y;
    if (p.done) { hop = null; if (flight.then && flight.then.length) { target = flight.then.shift(); route = flight.then; } }
  } else if (leap) {
    const step = leapStep(leap, walker.heightAt(pos.x, pos.z), dt); footY = step.y; if (step.landed) leap = null;
  } else footY = walker.heightAt(pos.x, pos.z);
  const aloft = airborne || !!leap;
  // The height the view rides at follows the floor softly; from behind him more softly still, as the up and down of a
  // following camera is what is felt most (《小王子》 smooths it over 0.14 s, its sideways following over 0.06 s).
  eyeY += ((aloft ? footY : walker.eyeAt(pos.x, pos.z)) - eyeY) * (1 - Math.exp(-dt / (view === "third" ? 0.14 : 0.08)));
  if (dropButton) dropButton.hidden = !availableDrop();
  labelJump();
  // The novice: where he stands, which way he faces, how fast he is going.
  const moved = Math.hypot(pos.x - x0, pos.z - z0);
  if (!walked && moved > 0.02 && !stage && !photo.on && !aloft && document.body.classList.contains("entered")) { walked = true; track("demo.walk", { view, tier: quality.name }); }
  if (!arrived && document.body.classList.contains("entered") && !opening.active()) { arrived = true; hints.say.entered(); if (L.intro) hints.say.intro(levelSay(L, L.intro)); }   // how to walk is said once the walk is his
  if (arrived) hints.step(dt, moved, !!keys.shift, !stage && !photo.on && !aloft);
  speedNow += ((dt > 0 ? Math.min(moved / dt, 2.4) : 0) - speedNow) * Math.min(1, dt * 10);
  const want = flight ? Math.atan2(flight.plan.to[0] - flight.plan.from[0], flight.plan.to[2] - flight.plan.from[2]) : stage ? stage.face : view === "first" && !photo.on ? Math.atan2(Math.sin(yaw), -Math.cos(yaw)) : moved > 1e-4 ? Math.atan2(pos.x - x0, pos.z - z0) : keyTurn.rate ? Math.atan2(Math.sin(yaw), -Math.cos(yaw)) : heading;   // (turned by the keys standing still, he turns where he stands)
  heading += Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * Math.min(1, dt * 9);
  // Seated on something that stands in the way (a stool): he came to stand behind it, and is drawn on it while he sits.
  const sat = stage && stage.seat ? stage.seat : null;
  // He is drawn going over to a seat and down onto it; a seat higher than he can step onto (a stool, sill-bench or
  // platform) he hops up onto, and gets down off its front when he gets up, instead of dropping back over its back.
  if (stage !== climbFor) {
    const prev = climbFor; climbFor = stage; climb = null;
    if (stage && sat && (stage.lift || 0) > 0.25 && drawn) { climb = { plan: seatHop([drawn[0], footY, drawn[2]], [sat[0], footY + stage.lift, sat[1]], JUMP.speed, JUMP.gravity), t: 0 }; climbs++; }
    else if (!stage && prev && prev.seat && drawn && ((prev.lift || 0) > 0.25 || drawn[1] - footY > 0.25)) {
      // Where he gets down: off the seat's own front (the way a person on it faces and his knees point), or the nearest
      // clear side of that when what stands before it is in the way (the tea table before a stool). `pos` comes down with
      // him, so that the walk goes on from where he stands and not from behind what he sat on.
      const feet = seatExit(walker, prev.seat, prev.face, [pos.x, pos.z], walker.heightAt(pos.x, pos.z));
      if (feet) { pos.x = feet[0]; pos.z = feet[1]; footY = walker.heightAt(pos.x, pos.z); }
      climb = { plan: seatHopOff(drawn, [pos.x, footY, pos.z]), t: 0, down: true };
    }
  }
  if (climb) {
    climb.t += dt; const p = dropPose(climb.plan, climb.t); drawn = [p.x, p.y, p.z];
    // Landing, his knees take his weight for a moment (`crouch` in monk.update) before he stands up straight —
    // unless the visitor is already walking him away, in which case he steps straight into the walk on touchdown.
    if (p.done && (!climb.down || f || s || target || climb.t > climb.plan.duration + 0.34)) climb = null;
    // And he turns to face the way he comes down — the seat's front, or the side of it he steps off at — unless the visitor
    // is already walking him somewhere else.
    if (climb && climb.down && !f && !s) { const a = Math.atan2(climb.plan.to[0] - climb.plan.from[0], climb.plan.to[2] - climb.plan.from[2]); heading += Math.atan2(Math.sin(a - heading), Math.cos(a - heading)) * Math.min(1, dt * 9); }
  }
  else if (!stage || !drawn) drawn = [sat ? sat[0] : pos.x, footY, sat ? sat[1] : pos.z];
  else { const k = Math.min(1, dt * 7); drawn[0] += ((sat ? sat[0] : pos.x) - drawn[0]) * k; drawn[2] += ((sat ? sat[1] : pos.z) - drawn[2]) * k; drawn[1] += (footY + (stage.lift || 0) - drawn[1]) * k; }
  monk.group.position.set(drawn[0], stage || climb ? drawn[1] : footY, drawn[2]); monk.group.rotation.y = heading;
  monk.group.visible = photo.on ? photo.monk : view === "third";
  if (walkViz) walkViz.update(pos.x, walker.heightAt(pos.x, pos.z), pos.z);
  // (`posed`: a tool may have him walk, hurry, climb, hop or sit on the spot, to be looked at closely: `__act`.)
  if (posed) monk.update(dt || 1 / 30, posed.speed || 0, posed.pose || false, t, walker.heightAt, { heightAt: walker.eyeAt, stairs: !!posed.stairs, act: posed.act || null });
  else {
    monk.blinking = !Q.has("shot") && !photo.on;
    // Off a seat he does not tuck into a jump (`hop`): he rises over his feet, leaning forward as one does to get up, and
    // his knees take the landing (`rise`, and `crouch` once his feet are down).
    const down = climb && climb.down ? climb : null;
    monk.update(dt, stage && stage.speed != null ? stage.speed : still || (aloft && !stepping) || climb ? 0 : speedNow,
      (aloft && !stepping) || (climb && !climb.down && climb.t < climb.plan.duration * 0.5) ? "hop" : down ? "rise" : stage ? stage.pose : photo.on && photo.pray,
      t, walker.heightAt, { heightAt: walker.eyeAt, stairs: walker.onStairs(pos.x, pos.z), act: stage ? stage.act : null,
        rise: down ? Math.min(1, down.t / down.plan.duration) : null,
        crouch: down && down.t > down.plan.duration ? 0.045 * Math.sin(Math.PI * Math.min(1, (down.t - down.plan.duration) / 0.34)) : 0 });
  }
  // Where he steps outdoors in the snow he leaves his prints (a room's floor keeps none, and the square stays outside),
  // and every step is heard, as what it comes down on sounds: snow, dry stone, stone wet after rain, a puddle in the
  // paving, a hall's floor. A little to the side of the foot that made it (his left is the listener's left, from
  // behind him or from his own eyes), a little clearer on a stair.
  for (const f of monk.steps.splice(0)) {
    if (passing) continue;
    if (!inside && !upIn) { trail.stamp(f); drift.kick?.(f); }
    const kind = underfoot({ x: f.x, z: f.z, y: f.y, floor: walker.floorAt(f.x, f.z), snow: inside ? 0 : mood.snow, wet: mood.wet, roofed: !inside && shelterAt(roofMap, f.x, f.y + 0.05, f.z) > 0.5 });
    if (kind === "puddle") ground.ripple?.(f.x, f.y, f.z);
    footstep(kind, { speed: speedNow, side: -f.side * (view === "third" ? 1 : 0.5), loud: (view === "third" ? 0.8 : 1) * (walker.onStairs(f.x, f.z) ? 1.15 : 1), wet: mood.wet, late: f.late || 0 });
  }
  if (!inside) { trail.follow(pos.x, pos.z); drift.keep?.(pos.x, pos.z, still ? 0 : dt, U.uWind.value.x, U.uWind.value.y); } trail.update(dt);
  // The eye: his own, or one that follows behind, as low as a child, so that he stands small in the middle of the
  // picture, a little below its centre, and the place fills the rest (eye.js, FRAMES). It comes in close rather than
  // pass through anything solid, and it never sinks into the ground or the hillside.
  // From behind him the view comes round a moment after the hand (0.06 s, as a third-person camera's axis eases in
  // and out), so a jerk of the mouse is not a jerk of the whole place; from his own eyes it turns with the hand.
  // The view swung back behind him, or drifting round behind the way he walks (camturn.js).
  const yaw0 = yaw;
  if (turning) { if (view !== "third" || photo.on || cine || director.active()) turning = null; else { turning.t += dt; yaw = recenterYaw(turning.plan, turning.t); if (turning.t >= turning.plan.dur) turning = null; } if (dt > 0) turnStats.rate = Math.max(turnStats.rate, (Math.abs(yaw - yaw0) / dt) * 180 / Math.PI); }
  else if (view === "third" && settings.get().follow && !photo.on && !cine && !director.active() && !opening.active() && !stage) {
    const going = speedNow > 0.3 ? Math.atan2(pace.dir[0], pace.dir[1]) : null;
    yaw = driftTurn.step(dt, yaw, { going, by: target ? "route" : "keys" });
    if (yaw !== yaw0) { turnStats.drifted += Math.abs(yaw - yaw0); if (dt > 0) turnStats.driftRate = Math.max(turnStats.driftRate, (Math.abs(yaw - yaw0) / dt) * 180 / Math.PI); }
  }
  if (view === "first" || follow.fresh || cine) { look.yaw = yaw; look.pitch = pitch; look.vy = look.vp = 0; }
  else { [look.yaw, look.vy] = damp(look.yaw, yaw, look.vy, LOOK_EASE, dt); [look.pitch, look.vp] = damp(look.pitch, pitch, look.vp, LOOK_EASE, dt); }
  // From his own eyes the view dips a little with each step he takes, and only as much as he is walking (after
  // Saltline: the bob counted in strides and its depth eased in and out with the pace, never switched on and off).
  bob.phase += moved / 0.55; bob.amp += ((still || aloft ? 0 : Math.min(1, speedNow / 2.1)) - bob.amp) * (1 - Math.exp(-dt / 0.15));
  if (view === "first") camera.position.set(pos.x, eyeY + (stage && (stage.pose === "sit" || stage.pose === "chair") ? (stage.lift || 0) + 0.68 : EYE) - (1 - Math.cos(bob.phase * Math.PI * 2)) * 0.006 * bob.amp, pos.z);
  else {
    const rx = Math.cos(look.yaw), rz = Math.sin(look.yaw), wantSide = FRAME ? 0 : walker.wall(pos.x + rx * 1.4, pos.z + rz * 1.4) ? 0 : 1.2;
    sideNow += (wantSide - sideNow) * Math.min(1, dt * 3);
    if (eyeSpace) eyeSpace.radius = eyeRadius(camera.fov, camera.aspect, camera.near);   // (the lens and the screen of this frame)
    const at = { x: pos.x, z: pos.z, foot: footY, eyeY, yaw: look.yaw, pitch: look.pitch, side: sideNow, reach: reachWant, arm: FRAME ? frameArm(FRAME, camera.fov, camera.aspect) : null, space: FRAME ? eyeSpace : null };
    // While the view is being swung round, the eye also looks where it is swinging to (eye.js, `ahead`).
    // (And, before a thick wall that the swing would carry it through, the arm's bearing falls behind the view's: eye.js `look`, #562.)
    const led = follow.look(walker, at, look.vy, dt);
    if (eyePin) {
      eyePin.yaw ??= yaw; eyePin.pitch ??= pitch;
      if (Math.hypot(pos.x - eyePin.x, pos.z - eyePin.z) > 0.02 || Math.abs(yaw - eyePin.yaw) > 1e-4 || Math.abs(pitch - eyePin.pitch) > 1e-4 || photo.on || cine || director.active()) eyePin = null;
    }
    if (eyePin) { follow.reset(eyePin.dist); camera.position.fromArray(eyePin.at); }
    if (!eyePin && eyeHeld && (eyeSpace || !/waiting|gathering|building/.test(eyeInfo.state) || Math.hypot(pos.x - eyeHeld.x, pos.z - eyeHeld.z) > 0.3)) eyeHeld = null;
    if (eyePin) { /* held above */ }
    else if (eyeHeld) { follow.reset(eyeHeld.dist); camera.position.fromArray(followEye(walker, at).at(eyeHeld.dist)); }   // (held where it stood before the change of language, #368)
    else camera.position.fromArray(clearOfCenser(follow.step(dt, led.eye, led.ahead), [pos.x, footY + 1.15, pos.z], site.censer));   // never drawn from inside the censer (censer.js)
    // Backed against a wall, the eye is as good as his own. Hidden nearer than one distance and shown again only
    // beyond a farther one, so that he does not flicker in and out at the edge of it.
    monkHidden = follow.dist < (monkHidden ? 0.85 : 0.6);
    if (monkHidden && !photo.on) monk.group.visible = false;
  }
  camera.rotation.set(look.pitch, -look.yaw, 0, "YXZ");
  // From behind him the eye looks at him, not only along the view (eye.js, aimAt): on a flight of steps, looking level,
  // it would put him at the foot of the picture or over its top (a visitor's picture of 2026-11-19 on the stair by the
  // half-way pavilion had him cut off at the waist), and while its arm moves over past the censer it would lose the middle.
  // It is tilted at the height the eye itself rides at, eased over the steps, not at his feet, which go up a tread at a
  // time: tilted at them, the view nodded with every step he took on a flight (the owner, 2026-11-19).
  if (view === "third" && FRAME && !monkHidden && !cine) {
    const m = monk.group.position, aim = aimAt(camera.position.toArray(), [m.x, stage ? m.y : eyeY, m.z], look.yaw, FRAME, camera.fov);
    if (aim) camera.rotation.set(aim[1], -aim[0], 0, "YXZ");
  }
  if (push) {
    if (cine || photo.on || director.active() || opening.active() || push.to !== view) { push = null; fade(1); }
    // Moved somewhere else while the view changed (up the stair to the balcony, down it, through a door: #587), the eye
    // would set out from where it stood, hundreds of metres off, and creep there at PUSH.move a frame, the visitor seeing
    // only the mist: a change of place behind the veil is a cut, and only what stays within PUSH.far is pushed.
    else if (camera.position.distanceTo(push.p) > PUSH.far) { push = null; fade(1); monk.group.visible = view === "third" && !monkHidden; lens(); }
    else {
      // how far along: by time, and by no more than the frame's own bounds on moving and widening allow (smootherstep's
      // steepest is 1.875 times its mean)
      const fovTo = zoomed(directedFov ?? baseFov()), goes = camera.position.distanceTo(push.p), widens = Math.abs(fovTo - push.fov) || 1e-6;   // (the new view's own angle, not this frame's mixed one)
      push.t = Math.min(1, push.t + Math.min(dt / PUSH.time, PUSH.move / (1.875 * Math.max(goes, 1e-6)), PUSH.fov / (1.875 * widens)));
      const k = push.t * push.t * push.t * (push.t * (push.t * 6 - 15) + 10);
      const reachEnd = monkWorld().distanceToPoint(camera.position);   // (where the push ends, before it is mixed: the view's own eye)
      camera.position.lerpVectors(push.p, camera.position, k); camera.quaternion.slerpQuaternions(push.q, camera.quaternion, k);
      camera.fov = push.fov + (fovTo - push.fov) * k; camera.updateProjectionMatrix();
      // He fades by where the eye is, not by how far along the push is (#612: by time he was still a little drawn when the eye was
      // already at the back of his head): wholly clear while the eye is inside his bounds and the near plane's reach, wholly drawn
      // `PUSH.fade` beyond (or by where the push ends, if that is nearer: the eye behind him comes to rest drawn in full).
      monk.group.visible = true; const was = faded, edge = monkNear(), range = reachEnd - edge > 0.05 ? Math.min(PUSH.fade, reachEnd - edge) : PUSH.fade;
      fade(THREE.MathUtils.clamp((monkWorld().distanceToPoint(camera.position) - edge) / range, 0, 1));
      if (pushed) { const L = pushed.last; if (L) { pushed.fov = Math.max(pushed.fov, Math.abs(camera.fov - L.fov)); pushed.move = Math.max(pushed.move, camera.position.distanceTo(L.p)); } if (view === "first" ? faded > was + 1e-6 : faded < was - 1e-6) pushed.back++; pushed.frames++; pushed.last = { fov: camera.fov, p: camera.position.clone() }; }
      if (push.t >= 1) { push = null; fade(1); monk.group.visible = view === "third" && !monkHidden; lens(); }
    }
  }
  // The place's own shot, mixed over the eye that follows him (src/director.js). In the picture he is drawn whenever the
  // eye stands clear of his head, from his own eyes too.
  if (director.active()) {
    centre.set(drawn ? drawn[0] : pos.x, (stage ? drawn[1] : footY) + 0.85, drawn ? drawn[2] : pos.z);
    const clock = riteNow(), ddt = Math.min(0.25, Math.max(0, (clock - directClock) / 1000)); directClock = clock;
    const fv = director.apply(camera, photo.on ? 0 : ddt, centre, baseFov());
    if (fv !== directedFov) { directedFov = fv; lens(); }
    if (fv !== null && camera.position.distanceTo(centre) > 1.0) monk.group.visible = photo.on ? photo.monk || view === "first" : true;
  } else { directClock = riteNow(); if (directedFov !== null) { directedFov = null; lens(); } }
  // The opening takes the eye from the following eye it is handed, and gives it back on the frame it ends (src/opening.js).
  if (opening.active()) {
    openingEye.p.copy(camera.position); openingEye.q.copy(camera.quaternion);
    openingEye.fov = baseFov();
    if (!opening.apply(camera, openingEye)) endOpening();
    const fv = opening.fov(); if (fv !== directedFov) { directedFov = fv; lens(); }   // the long lens of the first picture, widening
    if (camera.position.distanceTo(openingEye.p) > 1) monk.group.visible = true;
  }
  // A passage that is shown, not walked (the close of the chapter, rites.js), takes the eye from here and keeps him in the picture.
  if (cine) { cine(camera, dt); monk.group.visible = true; }
  if (turning || (turnStats.last && turnStats.last.until > 0)) {
    const L = turnStats.last, e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    // (what the eye moved of its own: beyond following him and turning round him with the view, as follow.test measures it)
    if (L) { const dy = look.yaw - L.yaw, ox = L.p.x - L.x, oz = L.p.z - L.z, ex = pos.x + ox * Math.cos(dy) - oz * Math.sin(dy), ez = pos.z + ox * Math.sin(dy) + oz * Math.cos(dy);
      turnStats.pitch = Math.max(turnStats.pitch, Math.abs(e.x - L.pitch) * 180 / Math.PI); turnStats.move = Math.max(turnStats.move, Math.hypot(camera.position.x - ex, camera.position.z - ez)); }
    turnStats.last = { pitch: e.x, yaw: look.yaw, p: camera.position.clone(), x: pos.x, z: pos.z, until: turning ? 1 : (L ? L.until - 1 : 0) };
  }
  camera.updateMatrixWorld();
  // Crossing the threshold hands over to the hall interior.
  const atDoor = inside ? null : site.halls.find((h) => h.inside(pos.x, pos.z)) || null;
  if (!atDoor) doorArmed = true;
  else if (doorArmed && !inside && !passing) { doorArmed = false; pass(atDoor); }
  if (inside && !passing && pos.z > hallIn.room.exitZ && Math.abs(pos.x - hallIn.room.cx) < 1.3) pass(null);

  for (const fn of ticks) fn(dt, t);
  if (glowCloud) glowCloud.material.uniforms.uPx.value = pxH;
  { const w = windAt(mood?.wind ?? 0, t); U.uWind.value.set(WIND_DIR[0] * w, WIND_DIR[1] * w); if (!still) U.uWindPath.value.addScaledVector(U.uWind.value, dt); }   // the breeze (wind.js); a frozen picture keeps its lean
  U.uT.value = t; sky.update(t); backdrop.update(t); props.update(t, dt, still, pxH); well.update(still ? 0 : dt, pos.x, pos.z, inside); ground.update?.(still ? 0 : dt); flock.update(still ? 0 : dt, t); drift.update(t, camera.position, pxH);
  site.tick?.(dt, camera.position, still || frames < 3);   // what the level does by where the eye is (T05: the hall's fill as he walks in)
  for (const s of site.strikers) if (s.swing && s.t0) s.swing.position.z = logSwing(s, riteNow());   // drawn back and let go, or only tapped: it touches the bell and swings itself out
  load.tris = renderer.info.render.triangles; load.calls = renderer.info.render.calls; renderer.info.reset();
  if (frames < 3) renderer.shadowMap.needsUpdate = true;
  // The mirror lies in the forecourt and the first court: not indoors, not on the terraces above, not down the
  // approach where the eye is under it. A jump does not change which of these he is in.
  if (!aloft) mirrorOn = mirrorAt(footY) && (!L.mirror || L.mirror(mood));   // the court, the forecourt, and the platforms that stand in them; and in this mood, if the level says (T05: only wet paving shows it)
  ground.mirror?.(mirrorOn && !inside);
  if (doors && !inside && arrived) doors.tick(camera, dt, camera.position);
  if (live && !inside && arrived) live.frame(camera, camera.position, post.size());   // #320's trial: the near room drawn live into the door's own pixels   // the rooms seen through the doors (doorway.js): fetched pictures only, never a room drawn; nothing asked for until the walk is his (after 入山 and the opening), so the first screen fetches none of it
  if (quality.planar > 0 && !inside && mirrorOn) ground.render(renderer, camera);
  post.focus(photo.on && settings.get().blur ? focusAt() : 0);   // depth of field only with the camera raised and 虚化 switched on: never walking, never ?shot (the picture a visitor sees is the picture a tool takes)
  if (clipView) {   // a film: the framed part of the view drawn at the film's own size, the signature laid over it as it rises
    const keep = camera.fov; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(keep) / 2) * (clipView.f.h / clipView.h))); camera.updateProjectionMatrix();
    post.render(t); camera.fov = keep; camera.updateProjectionMatrix();
    const a = clipRec ? clipRec.frame() : 0;
    if (a > 0 && clipView.mark) { clipView.mark.mat.opacity = a; renderer.autoClear = false; renderer.setRenderTarget(null); renderer.render(clipView.mark.scene, clipView.mark.cam); renderer.autoClear = true; }
    clipRec?.ask();
  } else post.render(t);
  // Ready when it has drawn a few frames and every scanned surface has arrived (or been given up on).
  loading.frame(frames + 1);
  if (++frames >= 3 && !document.body.dataset.ready && bodySettled) { const ts = textureState(); if (ts.loaded + ts.failed.length >= ts.total) { if (ts.loaded) renderer.shadowMap.needsUpdate = true; loading.finish(); document.body.dataset.ready = "1"; if (relang) relangBack(); if (crossing) crossingBack(); track("demo.ready", { tier: quality.name, lang_source: langSource, lang_from: takeSwitch(), failed: ts.failed.length, from: fromOf(location.search) || "" }); } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- The controls at the edge of the view ------------------------------------------
const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id)), on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
if (Q.has("shot") || TRAILER) document.body.classList.add("bare");
if (TRAILER) document.body.classList.add("trailer");
// Into his own eyes and out of them again, the eye is moved, not cut (#102, folded into #295: a phone measured the angle of
// view jumping 13° in a frame): from where it stood, with the angle it had, it goes over to the new view's eye on a
// smootherstep, never more than PUSH.move metres or PUSH.fov degrees in a frame, and he fades out (or in) as it comes.
const PUSH = { time: 0.6, move: 0.12, fov: 1.5, far: 15, fade: 1.5 };   // (far: further than the follow arm ever reaches, 11 m, is not a push but a change of place)
let push = null;
const setView = (v) => { if (upIn && v === "third") { hints.say.upView(); return; }   // up on a balcony he sees with his own eyes only (#101)
  const from = frames > 3 && v !== view && !FIXED_VIEW && !cine && !photo.on && !reducedMotion.matches ? { p: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov, to: v } : null;
  view = v; follow.reset(); pitch = v === "third" ? Math.min(pitch, 0.06) : Math.max(pitch, 0); resize(); if (turnButton) turnButton.hidden = v !== "third"; turning = null;
  push = from ? { ...from, t: 0 } : null; if (push) { pushed = { to: v, frames: 0, fov: 0, move: 0, back: 0, last: null }; fade(v === "third" ? 0 : 1); } };   // (coming out of his eyes he begins unseen)
let pushed = null;   // what the last push did, frame by frame (__probe().push): the most it turned the angle, moved the eye, and frames he faded back
setView(view);
ui.layer("keys", { kind: "panel" }).layer("moodPanel", { kind: "panel", release: true });
document.querySelectorAll("[data-season]").forEach((b) => b.addEventListener("click", () => { state.hand = true; setMood(b.dataset.season, state.time); track("demo.mood", { season: b.dataset.season, time: state.time, follow: state.follow ? 1 : 0 }); }));
document.querySelectorAll("[data-time]").forEach((b) => b.addEventListener("click", () => { state.hand = true; state.follow = false; setMood(state.season, b.dataset.time); track("demo.mood", { season: state.season, time: b.dataset.time, follow: 0 }); }));
document.querySelectorAll("[data-follow]").forEach((b) => b.addEventListener("click", () => { state.hand = true; state.follow = true; setMood(state.season, moodNow().time); track("demo.mood", { season: state.season, time: state.time, follow: 1 }); }));
// Following the clock is live: when the real hour turns, the picture turns with it (setMood has no fade of its own; a change of hour is a cut today).
setInterval(() => { const t = photo.on || frozen ? null : hourFollow(state); if (t) setMood(state.season, t); }, 20000);

// ---- Taking a photograph ------------------------------------------------------------
// The raised camera is a mode on the stack of layers, its settings a panel over it, the print a sheet over both:
// Esc folds the settings, then puts the print away, then lowers the camera.
const folded = (open) => () => { document.body.classList.toggle("photo-settings-open", open); $("photoSettings").hidden = !open; $("photoSettingsToggle").setAttribute("aria-expanded", String(open)); };
ui.layer("photoSettings", { kind: "panel", show: folded(true), hide: folded(false), returnFocus: "photoSettingsToggle" });
// On a touch screen the picture is taken with the round button and drawn nearer with two fingers: the line under the
// camera's settings says so, rather than speaking of a click and a wheel the hand does not have.
if (hints.coarse) { const how = document.querySelector("#photoSettings > p"); if (how) how.textContent = tr("画面就是你眼前所见 · 点快门即拍 · 双指远近"); }
ui.layer("photo", { kind: "mode", el: null, show: () => raise(true), hide: () => raise(false) });
function setPhotoSettings(open) { if (open) ui.open("photoSettings"); else ui.close("photoSettings"); }
function setPhoto(open) { if (open) { ui.close("keys"); ui.close("moodPanel"); if (!ui.open("photo")) raise(true); } else if (!ui.close("photo")) raise(false); }
function raise(open) {
  if (!open) dropClip();
  ui.close("photoSettings");   // the settings start folded every time the camera is raised
  photo.on = open; document.body.classList.toggle("photo", open); if (open) hints.say.photo(); else hints.drop("photo");
  // Raised in the middle of a swing to a place's shot, it is the shot that is framed; raised on the way home, the eye is
  // with him at once. Either way the ink is not left half shut over the viewfinder.
  if (open && !director.finish() && director.state().phase === "out") director.drop();
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
// The code on the card, kept with the visitor's settings: on until put away.
const qrOn = (v) => $("qrToggle")?.setAttribute("aria-pressed", String(v));
qrOn(settings.get().qr);
on("qrToggle", () => { settings.set("qr", !settings.get().qr); qrOn(settings.get().qr); });
on("thirdsToggle", () => { settings.set("thirds", !settings.get().thirds); thirds(settings.get().thirds); });
// 虚化: the photograph's very shallow depth of field, off unless asked for. Offered only where the tier keeps the depth to draw it.
const blur = (v) => $("blurToggle")?.setAttribute("aria-pressed", String(v));
blur(settings.get().blur);
if (quality.depth && quality.dof) $("blurToggle").hidden = false;
on("blurToggle", () => { settings.set("blur", !settings.get().blur); blur(settings.get().blur); });
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
  const link = L.cardLink !== false, verse = verseOf(L, state.season, state.time, mood.line);   // no address or code where the public page has no such temple
  return composeCard(shot, { line: verse && tr(verse), label: moodWords(mood), temple: templeOf(L, lang), seal: sealOf(L), url: link ? MAIN.host : "", qr: link && settings.get().qr ? photoUrl(lang) : null });
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
  track("demo.photo", { view, aspect: photo.aspect, monk: photo.monk, zoom: +photo.zoom.toFixed(2), mood: state.season + "-" + state.time });
  const at = freeze(true);
  shutterSound(); navigator.vibrate?.(12);
  const c = $("curtain"); c.classList.remove("shut"); void c.offsetWidth; c.classList.add("shut");
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));   // let the leaves and the still be drawn before the long work
    const card = await capture(at);
    lastBlob = await new Promise((r) => card.toBlob(r, "image/jpeg", 0.93));
    const url = URL.createObjectURL(lastBlob); $("printImg").src = url; $("saveLink").href = url;
    $("saveLink").download = lang === "zh" ? `${L.name || T00_NAME}-${NAMES[state.season]}${NAMES[state.time]}.jpg` : saidNow("云径禅寺-{mood}.jpg", { mood: `${tr(NAMES[state.season])}-${tr(NAMES[state.time])}` }, lang);
    ui.open("print", { onClose: () => { if (frozen) freeze(false); } }); stampSound();   // put away by its button or by Esc: the walk goes on
  } catch (e) { freeze(false); throw e; }
  finally { b.disabled = false; }
});
on("printBack", () => ui.close("print"));
// Shared from wherever the page is open (src/share.js, #344): the system's sheet where it can take the picture, else a
// sheet to press and hold it on; the address it carries names the observance he stands at, if he is at one.
const sceneHere = () => { let best = 12, id = "photo"; for (const [k, p] of Object.entries(site.places)) { if (!FROM.includes(k) || p.room) continue; const d = Math.hypot(p.at[0] - pos.x, p.at[1] - pos.z); if (d < best && !inside) { best = d; id = k; } } return id; };
on("shareBtn", () => shareOrSave({ blob: lastBlob, url: $("printImg").src, name: `${stemOf(L)}.jpg`, title: templeOf(L, lang), from: sceneHere(), content: "print", link: L.cardLink !== false }));
$("saveLink")?.addEventListener("click", () => countDownload("print", sceneHere()));

// ---- A short film (#342, clip.js) ----------------------------------------------------
// 拍一段: the same view, held, filmed for twelve seconds (stopped whenever the visitor likes). Each frame the framed part
// of the drawing is copied onto a canvas of the film's own size (1080 on the short side, 720 on the low tier), the sound
// of the place is taken off the output, and, unless 落款 is off, a faint signature rises over the last second and a half.
// The interface steps away (body.clipping) leaving a hair of progress and a way to stop; Esc stops, never leaves.
const clipPick = typeof MediaRecorder !== "undefined" && HTMLCanvasElement.prototype.captureStream ? pickMime((m) => MediaRecorder.isTypeSupported(m)) : null;
if (!clipPick) $("clipBtn").hidden = true;
ui.layer("clip", { kind: "modal" });
let clipUrl = null, clipTimer = 0, clipTap = null, clipLast = null;
const clipEnded = () => {
  clearInterval(clipTimer); clipTimer = 0; clipTap?.release(); clipTap = null; document.body.classList.remove("clipping"); $("clipRec").hidden = true; $("clipBar").style.removeProperty("width"); $("shutter").disabled = false; clipRec = null;
  if (clipView) { clipView.mark?.dispose(); clipView = null; for (const k of ["left", "top", "width", "height"]) canvas.style.removeProperty(k); canvas.style.removeProperty("inset"); resize(); }
};
// Filming draws the framed part of the view at the film's size, whole, on the page's own canvas, and records that canvas: nothing is copied from frame to
// frame (a drawImage from the WebGL canvas onto a 2D one cost 25 ms a frame on a T4). The canvas is shown at the frame's place, so what is seen is what is kept.
async function startClip(secs, short = 0, layoutOnly = false) {
  if (!clipPick || clipRec || clipView || frozen || !photo.on) return false;
  const info = settings.get().clipMark ? { temple: templeOf(L, lang), label: moodWords(mood), seal: sealOf(L), url: L.cardLink === false ? "" : MAIN.host + "/?" + CLIP.utm } : null;
  if (info) { try { await Promise.all([document.fonts.load(`40px ${FACE.brush}`, info.seal), document.fonts.load(`30px ${FACE.serif}`, info.temple + info.label)]); } catch {} }
  if (clipRec || clipView || !photo.on) return false;
  const cw = canvas.clientWidth, ch = canvas.clientHeight, f = frameRect(), [aw, ah] = photo.aspect === "screen" ? [cw, ch] : ASPECT[photo.aspect];
  let { w: W, h: H } = clipSize(aw, ah, short); const px = W * H;   // no more pixels than the tier draws a frame with
  if (!short && px > quality.budget) { const k = Math.sqrt(quality.budget / px); W = Math.max(2, Math.round((W * k) / 2) * 2); H = Math.max(2, Math.round((H * k) / 2) * 2); }
  clipTap = recordTap();
  let mark = null;
  if (info) {
    const tex = new THREE.CanvasTexture(markCanvas(W, H, info)); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }), geo = new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geo, mat)); mark = { scene, mat, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), dispose() { tex.dispose(); mat.dispose(); geo.dispose(); } };
  }
  const was = { left: f.x, top: f.y, width: f.w, height: f.h };
  clipView = { w: cw, h: ch, f, W, H, mark };
  Object.assign(canvas.style, { left: was.left + "px", top: was.top + "px", width: was.width + "px", height: was.height + "px", inset: "auto" });
  resize();
  if (layoutOnly) return true;   // (a tool's: the film's size and place with nothing recorded, so that what recording adds can be told from what the size does)
  try {
    clipRec = createClip({ source: canvas, audio: clipTap?.stream, pick: clipPick, mark: !!info, secs,
      onEnd: (r) => { const early = r.early; clipEnded(); showClip(r); track("demo.clip.export", { fmt: r.ext, secs: Math.round(r.secs), early, tier: quality.name }); },
      onFail: () => { clipEnded(); } });
  } catch (e) { clipEnded(); return false; }
  ui.close("photoSettings"); document.body.classList.add("clipping"); $("shutter").disabled = true;
  $("clipRec").hidden = false; const rec = clipRec; rec.start();
  clipTimer = setInterval(() => { $("clipRec").style.setProperty("--clip", rec.progress().k.toFixed(3)); }, 100);
  track("demo.clip.start", { aspect: photo.aspect, tier: quality.name, fmt: clipPick.ext, mark: !!info });
  return true;
}
const stopClip = () => clipRec?.stop();
function dropClip() { if (clipRec) { clipRec.cancel(); clipEnded(); } }
function showClip(r) {
  clipUrl && URL.revokeObjectURL(clipUrl); clipUrl = URL.createObjectURL(r.blob);
  const file = new File([r.blob], clipName(r.ext, `${tr(NAMES[state.season])}-${tr(NAMES[state.time])}`), { type: r.type });
  clipLast = { file, type: r.type, ext: r.ext, size: r.blob.size, secs: r.secs, frames: r.frames };
  const v = $("clipVideo"); v.src = clipUrl; v.play?.().catch(() => {});
  $("clipSave").href = clipUrl; $("clipSave").download = file.name;
  const can = !!(navigator.canShare && navigator.canShare({ files: [file] })); $("clipShare").hidden = !can;
  const hint = saveHint({ canShare: can, coarse: hints.coarse }), h = $("clipHint"); h.hidden = !hint;
  if (hint) h.textContent = hint === "hold" ? tr("长按影片，选「存入相册」或「下载」。") : tr("点「保存」，或在影片上点右键，选「另存为」。");
  ui.open("clip", { onClose: () => { v.pause?.(); v.removeAttribute("src"); v.load?.(); clipUrl && URL.revokeObjectURL(clipUrl); clipUrl = null; clipLast = null; } });
}
on("clipBtn", () => { startClip(); });
on("clipStop", stopClip);
on("clipBack", () => ui.close("clip"));
on("clipShare", async () => {
  if (!clipLast) return;
  try { await navigator.share({ files: [clipLast.file], title: templeOf(L, lang), ...(verseOf(L, state.season, state.time, mood.line) ? { text: tr(verseOf(L, state.season, state.time, mood.line)) } : {}) }); track("demo.share", { from: "clip", method: "share" }); } catch {}
});
settings.onChange((s) => $("clipMarkToggle")?.setAttribute("aria-pressed", String(s.clipMark)));
$("clipMarkToggle").setAttribute("aria-pressed", String(settings.get().clipMark));
on("clipMarkToggle", () => settings.set("clipMark", !settings.get().clipMark));
addEventListener("keydown", (e) => { if (e.key === "Escape" && clipRec) { e.stopImmediatePropagation(); e.preventDefault(); stopClip(); } }, true);
document.addEventListener("visibilitychange", () => { if (document.hidden) dropClip(); });
window.__clip = (o) => { if (o && o.layout === true) return startClip(1, o.short, true); if (o && o.layout === false) { clipEnded(); return true; } if (o && o.start) return startClip(o.secs, o.short); if (o && o.stop) return stopClip(); return { supported: !!clipPick, mime: clipPick?.type ?? null, recording: !!clipRec, state: clipRec?.state ?? null, drawn: clipRec?.drawn ?? 0, last: clipLast && { type: clipLast.type, ext: clipLast.ext, size: clipLast.size, secs: clipLast.secs, frames: clipLast.frames } }; };

// ---- Through the door ----------------------------------------------------------------
// Eyes close on the way in and daylight floods on the way out; behind the veil he is moved between the porch and the
// room, the room's lamps are lit or put out, and the picture is exposed for indoors or for the sky.
let inside = false, passing = false;
const veil = $("veil"), pause = (ms) => new Promise((r) => setTimeout(r, Q.has("fast") ? ms / 6 : ms));
let lastHall = null;
const hallsSeen = new Set();   // the halls first entered this visit, for the one event that says how far he went
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
  try { outCam.update(renderer, scene); } finally { sky.at(SKY_AT[0], 0, SKY_AT[1]); }
  renderer.xr.enabled = xr; renderer.setRenderTarget(target);
  scene.children.forEach((o, i) => { o.visible = seen[i]; });
  const u = r.outlook.material.uniforms; u.tOut.value = outCube.texture; u.uHas.value = 1; u.uTurn.value.set(f[0], f[1]);
}
// Whatever falls through the air (snow, petals, leaves, fireflies) falls outdoors only.
const hideDrift = (on) => scene.children.forEach((o) => { if (o.userData.part === "drift") o.visible = !on && !OFF.has("drift"); });
// Lamps lit, the sun put out, no snow on any floor, the picture exposed for a room.
const dress = () => { U.uLamp.value = 1; U.uSnow.value = 0; U.uFogLayer.value.x = 0; hideDrift(true); sky.indoors(); post.setMood({ ...mood, exp: 1.25, sat: 1.04, lift: 0.004, bloom: 0.32, sh: [0.96, 0.98, 1.06], hi: [1.06, 1, 0.92] }); };
// What is seen of each room from outside, through its door (doorway.js, #218): each hall is taken when he first comes
// near it or sees it, one face a frame, and taken again when the hour changes its lamps. `__doorways(true[, id])` takes them
// all (or the one named) at once, for a picture.
// `?doorway=live` (#320's trial, deferred by the owner on 2026-11-20, off by default): the near room drawn live through
// its door on the middle and high tiers (doorway-live.js; `?warm=0` leaves out its warming ahead, to measure it;
// `?live=half` draws the room at half the frame's size). The larger baked face into each room is always shown.
const DOORWAY = new Set((Q.get("doorway") || "").split(",").filter((m) => m === "live"));
const doors = rooms && !OFF.has("doorway") ? createDoorways({ renderer, scene, site, rooms, U, steps: quality.name === "low" ? 4 : 12, keep: quality.name === "low" ? 3 : 4, inward: quality.name === "low" ? 512 : 0, base: asset("shared/doorways/"), level: L.id, modes: DOORWAY }) : null;
const live = doors && DOORWAY.has("live") && quality.name !== "low" ? createLive({ renderer, scene, U, rooms, halls: doors.halls, msaa: quality.msaa, warm: Q.get("warm") !== "0", scale: Q.get("live") === "half" ? 0.5 : 1 }) : null;
live?.camera(camera);
// A tool that draws the doorways in the page (or the bake) sets the hour for each drawing, and the visitor's is put back.
doors?.moods({ set: (season, time) => setMood(season, time), keep: () => { const { season, time } = state; return () => setMood(season, time); } });   // `keep` remembers the hour before the drawing changes it
// Where the altar of a hall stands in the picture (x and y from -1 to 1): from inside, the altar itself; from outside,
// where its doorway shows it. Going in should not move it (the doorway scenario).
window.__doorAltar = (id) => { const r = rooms?.rooms[id]; if (!r || !doors) return null; const a = r.altar.getWorldPosition(new THREE.Vector3()), p = inside ? a : doors.seenAt(id, a); camera.updateMatrixWorld(); const n = p.clone().project(camera); return { x: n.x, y: n.y, world: p.toArray() }; };
// Where a hall's open door and the lattice of the bay beside it lie in the picture, in pixels: the brightness of the one
// against the other (tools/doorway-views.cjs --moods).
window.__doorRect = (id) => {
  const h = site.halls.find((x) => x.id === id), d = site.doorways[id]; if (!h || !d) return null;
  const xs = [...h.xs].sort((a, b) => a - b), mid = Math.floor((xs.length - 1) / 2), y0 = d.platH + 0.4, y1 = d.platH + 2.6, W = canvas.clientWidth, H = canvas.clientHeight;
  camera.updateMatrixWorld(); d.group.updateMatrixWorld();
  const rect = (pts) => { const ps = pts.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(d.group.matrixWorld).project(camera)).map((v) => [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]);
    return [Math.min(...ps.map((q) => q[0])), Math.min(...ps.map((q) => q[1])), Math.max(...ps.map((q) => q[0])), Math.max(...ps.map((q) => q[1]))].map(Math.round); };
  const box = (x0, x1) => rect([[x0, y0, d.Z], [x1, y0, d.Z], [x0, y1, d.Z], [x1, y1, d.Z]]);
  // `floor`: the platform's paving before the door, out under the sky (the measure of the doorway's brightness by day).
  const floor = rect([[xs[mid] + 0.4, d.platH, d.Z + 1.6], [xs[mid + 1] - 0.4, d.platH, d.Z + 1.6], [xs[mid] + 0.4, d.platH, d.Z + 2.4], [xs[mid + 1] - 0.4, d.platH, d.Z + 2.4]]);
  return { door: box(xs[mid] + 1.4, xs[mid + 1] - 1.4), beside: box(xs[mid + 1] + 0.4, xs[mid + 2] - 0.4), floor };
};
window.__doorways = (all, only) => (!doors ? null : all ? doors.takeAll(only).then(() => ({ ...doors.report(), live: live?.report() ?? null })) : { ...doors.report(), live: live?.report() ?? null });
// #320: the larger face into each room switched off or on again where it has come, to set it against the cube (doorway-hires).
window.__doorHires = (on) => { if (!doors) return null; let n = 0; for (const o of Object.values(doors.halls)) if (o.hi) { o.mat.uniforms.uHi.value = on ? 1 : 0; n++; } return n; };
window.__doorBake = (id, q, lossless, inward) => doors?.bakeHall(id, q, lossless, inward);   // tools/bake-doorways.mjs: one hall's three pictures, drawn in this page
afterMood = () => { if (inside && lastHall) { lookOut(lastHall); dress(); } };   // the doorway shows the new hour, the room keeps its lamps
function indoors(hall) {
  if (hall) { if (hall.up) hints.say.stair(); else hints.say.indoors(); }
  const on = !!hall; if (on) { lastHall = hall; hallIn = rooms.rooms[hall.id]; lookOut(hall); hallIn.hang(); }
  inside = on; if (rooms) rooms.group.visible = on;   // the rooms under the courts are drawn only from inside one (and into a doorway's cube, doorway.js)
  walker.setRoom(on ? hallIn.room : null); probes.setRoom(on ? hall.id : null); interrupt(); director.drop(); target = null; route = []; hop = leap = climb = climbFor = drawn = null;
  for (const r of Object.values(rooms.rooms)) for (const l of r.lights) l.visible = on && r === hallIn;
  for (const o of scene.children) if (COURTS.includes(o.userData.part)) o.visible = !on && !OFF.has(o.userData.part);   // nothing of the courts is drawn from indoors
  hideDrift(on);
  if (on) { pos.set(hallIn.room.door[0], EYE, hallIn.room.door[1]); yaw = 0; dress(); }
  else { pos.set(lastHall.out[0], EYE, lastHall.out[1]); yaw = lastHall.outYaw; doorArmed = false; setMood(state.season, state.time); }
  pitch = 0.04; footY = eyeY = walker.heightAt(pos.x, pos.z); heading = on ? Math.PI : Math.atan2(Math.sin(yaw), -Math.cos(yaw)); follow.reset(0.6); document.body.classList.toggle("indoors", on);
  window.dispatchEvent(new CustomEvent(on ? "entered-hall" : "left-hall", { detail: hall && hall.id }));
  if (on && !hallsSeen.has(hall.id)) { hallsSeen.add(hall.id); track("demo.hall", { id: hall.id, count: hallsSeen.size }); }
}
// `hall`: one of site.halls to go into, or null to come out of the one he is in.
async function pass(hall) {
  const on = !!hall; if (passing) return;
  if (TRAILER) { indoors(hall); return; }   // the film cuts on the frame, with no veil and no real-time wait (#610)
  passing = true;
  if (veil) veil.className = on ? "on" : "on day"; await pause(900);
  indoors(hall); await pause(200);
  if (veil) { veil.className = on ? "" : "day"; if (!on) { await pause(700); veil.className = ""; } }
  passing = false;
}
// ---- Up on a balcony walked round (site.lofts; issue #101) ----------------------------------
// The top storey of the summit pavilion is reached from the stair in its ground-floor room, behind the veil. Up there
// he is out of doors (the courts drawn, the sun out, the court's echo and the summit's music), stands on the balcony's
// own floor only, and sees with his own eyes: the view he had below comes back when he comes down.
function upstairs(L, at = null, turn = null) {
  if (inside) indoors(null);
  upIn = L || null; walker.setLoft(L ? L.id : null); interrupt(); director.drop(); target = null; route = []; hop = leap = climb = climbFor = drawn = null;
  if (L) { if (viewBefore === null) viewBefore = view; setView("first"); const p = at ? settleAt(walker, at[0], at[1]) : null; pos.set(p ? p.x : L.door[0], EYE, p ? p.z : L.door[1]); yaw = turn ?? L.face; pitch = -0.12; }   // (a kept place or an address that falls in the railing, or off the balcony: the nearest open floor up there, or its door)
  else if (viewBefore !== null) { const v = viewBefore; viewBefore = null; setView(v); }
  footY = eyeY = walker.heightAt(pos.x, pos.z); heading = Math.atan2(Math.sin(yaw), -Math.cos(yaw)); follow.reset(0.6);
  document.body.classList.toggle("aloft", !!L);
  window.dispatchEvent(new CustomEvent(L ? "went-up" : "came-down", { detail: L ? L.id : null }));
}
// Up from the foot of the stair, or (null) back down to it: the veil opens on daylight going up, on the room's lamps coming down.
async function climbTo(L) {
  if (passing || (!L && !upIn) || (L && !(inside && hallIn.room.stair))) return false;
  passing = true; const from = upIn;
  if (veil) veil.className = L ? "on day" : "on"; await pause(900);
  if (L) upstairs(L);
  else {
    upstairs(null); indoors(site.halls.find((h) => h.id === from.hall));
    const st = hallIn.room.stair; pos.set(st.at[0], EYE, st.at[1]); yaw = st.back; pitch = 0.04; footY = eyeY = walker.heightAt(pos.x, pos.z); heading = Math.atan2(Math.sin(yaw), -Math.cos(yaw)); follow.reset(0.6);
  }
  await pause(200);
  if (veil) { veil.className = L ? "day" : ""; if (L) { await pause(700); veil.className = ""; } }
  passing = false; return true;
}
const comeDown = () => { if (upIn) upstairs(null); };   // straight off the balcony, for a jump to somewhere else (the book, the menu, a tool)
if (Q.has("up") && site.lofts[Q.get("up")]) upstairs(site.lofts[Q.get("up")], Q.has("cam") ? [pose[0], pose[1]] : null, Q.has("cam") ? pose[2] : null);   // ?up=<balcony> begins up there
else if (Q.has("show") && site.viewUp[Q.get("show")]) upstairs(site.lofts[site.viewUp[Q.get("show")]], [pose[0], pose[1]], pose[2]);
if (upIn && (Q.has("cam") || Q.has("show"))) pitch = pose[3];
// ?show=shot-<id> of an observance made in a hall begins inside that hall.
{ const sp = site.places[(Q.get("show") || "").replace(/^shot-/, "")] || rooms.spots[(Q.get("show") || "").replace(/^shot-/, "")]; if (Q.get("show")?.startsWith("shot-") && sp?.room && !Q.has("in")) { indoors(site.halls.find((h) => h.id === sp.room)); pos.x = sp.at[0]; pos.z = sp.at[1]; yaw = Math.PI - sp.face; footY = eyeY = walker.heightAt(pos.x, pos.z); follow.reset(); } }
if (Q.has("in")) { indoors(site.halls.find((h) => h.id === Q.get("in")) || site.halls.find((h) => h.id === "main")); if (Q.has("cam")) { const p = settleAt(walker, pose[0], pose[1]); if (p) { pos.x = p.x; pos.z = p.z; } yaw = pose[2]; pitch = pose[3]; footY = eyeY = walker.heightAt(pos.x, pos.z); follow.reset(); } }   // ?in=1 begins inside the hall (an address that falls in something there is moved to the nearest open floor of the room, or left at its door)
// Back where he was before a change of language (#140): the balcony, the hall or the open ground, the way he faced and
// looked. A place that falls in something moves to the nearest open floor, as a kept place does.
if (relang) {
  if (relang.up && site.lofts[relang.up]) upstairs(site.lofts[relang.up], [relang.x, relang.z], relang.yaw);
  else {
    const h = relang.hall ? site.halls.find((x) => x.id === relang.hall) : null; if (h) indoors(h);
    const p = settleAt(walker, relang.x, relang.z); if (p) { pos.x = p.x; pos.z = p.z; } else if (!h) { [pos.x, pos.z] = site.start; }
    yaw = relang.yaw;
  }
  pitch = relang.pitch; footY = eyeY = walker.heightAt(pos.x, pos.z); heading = Math.atan2(Math.sin(yaw), -Math.cos(yaw));
  if (relang.reach) reachWant = THREE.MathUtils.clamp(relang.reach, 2.6, 11);
  follow.reset(relang.dist ?? null);
  // (#368) Until the eye's hierarchy is built it would ask the written plan, which has solid stone where he walks now
  // (round the great hall's platform, the forecourt by the gate) and would draw it in to his shoulder, then let it out
  // again a second later. It stood where it was, clear of what is drawn, a moment ago: it stands there again, and is held
  // there until the hierarchy can answer or he walks away from the spot.
  if (relang.view === "third" && relang.dist !== null && !relang.hall && !relang.up) eyeHeld = { dist: relang.dist, x: pos.x, z: pos.z };
}
if (!PRODUCTION && !relang && view === "third" && !Q.has("shot")) { const e = readEye(location.search); if (e) { eyePin = { at: e.at, dist: e.dist, x: pos.x, z: pos.z, yaw: null, pitch: null }; follow.reset(e.dist); } }
// Choosing another language in the pause menu hands the walk across the reload that follows (lang.js calls this first).
window.templeRelang = (to) => {
  if (!document.body.classList.contains("entered") || Q.has("shot")) return false;
  return keepRelang(sessionStorage, { x: +pos.x.toFixed(3), z: +pos.z.toFixed(3), yaw: +yaw.toFixed(4), pitch: +pitch.toFixed(4), view, reach: reachWant, dist: follow.dist === null ? null : +follow.dist.toFixed(3), hall: inside && lastHall ? lastHall.id : null, up: upIn ? upIn.id : null, season: state.season, time: state.time, follow: !!state.follow, from: lang, to });
};
// For the test tools.
window.__inside = (id) => pass(id ? site.halls.find((h) => h.id === (id === true ? "main" : id)) : null); window.__figures = () => rooms.state.figures; window.__statues = () => ({ ...rooms.state.stood }); window.__gallery = rooms.spots; window.__columns = (id) => (rooms?.rooms?.[id]?.room.frame.cols || []).map((c) => ({ x: c.x, z: c.z }));   // where a hall's free columns stand, for the scenarios that walk into one
window.__halls = site.halls.map((h) => ({ id: h.id, name: h.name, door: h.door, out: h.out, outYaw: h.outYaw }));
window.__lofts = site.lofts;
// A newer build put up while this page was open (#310, src/version.js): said once at the foot, never while an observance,
// the raised camera, the close or the opening has the picture, and never on a page that names its own view.
const updates = Q.has("shot") || TRAILER ? null : watchVersion({ say: () => hints.say.update(), busy: () => !document.body.classList.contains("entered") || photo.on || !!cine || !!stage || ["far", "opening", "directing"].some((c) => document.body.classList.contains(c)) });
window.__updates = (now) => (updates ? (now ? updates.ask().then(() => updates.state()) : updates.state()) : null);
window.__fade = (/** @type {number} */ a) => (monk.group.visible = true, fade(a), faded);   // (a picture tool's hold on his opacity: the push's fade by hand, #632)
window.__yard = () => ({ opacity: +faded.toFixed(3), fadeTwins: (() => { let n = 0; monk.group.traverse((/** @type {any} */ o) => { if (o.userData.fadeTwin) n++; }); return n; })(), monkShown: monk.group.visible, monkWorld: (() => { const b = monkWorld(); return { min: b.min.toArray().map((v) => +v.toFixed(3)), max: b.max.toArray().map((v) => +v.toFixed(3)), near: +monkNear().toFixed(3) }; })(), shadowY: +monk.shadow.getWorldPosition(new THREE.Vector3()).y.toFixed(3), shadowOp: +monk.shadow.material.opacity.toFixed(3), inside, up: upIn ? upIn.id : null, stair: inside && hallIn.room.stair ? hallIn.room.stair.at : null, room: inside ? hallIn.room.id : null, doorway: inside ? hallIn.outlook.material.uniforms.uHas.value : null, tier: quality.name, scale: +quality.scale.toFixed(2), planar: quality.planar, governed: governor.level, x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), h: +walker.heightAt(pos.x, pos.z).toFixed(2), footY: +monk.group.position.y.toFixed(4), groundY: +walker.heightAt(pos.x, pos.z).toFixed(4), dropping: !!hop, staged: stage ? stage.pose || "stand" : null, climbing: !!climb, climbs, pose: stage ? stage.pose : null, jumping: !!leap, bodyY: +(monk.group.position.y + monk.group.children[0].position.y).toFixed(4), dressed: monk.dressed, body, skirt: monk.skirt, lid: +monk.lid.value.toFixed(2), target: target && [+target.x.toFixed(2), +target.z.toFixed(2)], goal: (() => { const g = planning ? planGoal : route.length ? route[route.length - 1] : target; return g ? [+g.x.toFixed(2), +g.z.toFixed(2)] : null; })(), route: route.length, running, frames, tris: load.tris, calls: load.calls, season: state.season, time: state.time, view, fov: +camera.fov.toFixed(1) });
// For the picture tools: the eye stood anywhere, looking at a point, as the close's camera is (`__look()` lets it go).
window.__look = (at, to) => { cine = at ? (camera) => { camera.position.set(at[0], at[1], at[2]); camera.lookAt(to[0], to[1], to[2]); } : null; if (!at) follow.reset(); return !!cine; };
if (Q.get("review") === "1" && onBench({ dev: !!import.meta.env.DEV, hostname: location.hostname })) import("./src/review.js").then((m) => m.installReview({ monk, camera, dev: !!import.meta.env.DEV, hostname: location.hostname, search: location.search }));   // tools/review-sheet.cjs: the workbench only, and only with ?review=1; the module is a chunk a visitor never fetches
window.__views = Object.keys(site.views); window.__merged = merged; window.__textures = textureState;
// The address of the view he has now, for the console: where he stands and looks, the mood, the hall or balcony he is
// in, and `devpose` so that a dev server opened with it will follow him. It writes nothing into this page's address and
// sends nothing anywhere; everything else in the address (the language, the tier, the parts switched off) is kept, and
// a tool's `shot` is dropped.
const eyeNow = () => (view === "third" && follow.dist !== null ? [camera.position.x, camera.position.y, camera.position.z, follow.dist] : null);   // where the eye is and how long its arm (#623)
window.__debugURL = () => {
  const q = new URLSearchParams(location.search); q.delete("shot");
  return location.origin + location.pathname + poseQuery("?" + q.toString(), { x: pos.x, z: pos.z, yaw, pitch, view,
    season: state.season, time: state.time, room: inside ? hallIn.room.id : null, up: upIn ? upIn.id : null, devpose: true, eye: eyeNow(),
    ok: (x, z) => !walker.blocked(x, z) && Math.abs(walker.heightAt(x, z) - walker.heightAt(pos.x, pos.z)) < 0.02 }) + location.hash;
};
// A named view, without loading the place again: out of any room, then stood where the view stands.
window.__show = (name) => { const v = site.views[name]; if (!v) return false; if (inside) indoors(null); comeDown(); if (site.viewUp[name]) { upstairs(site.lofts[site.viewUp[name]], [v[0], v[1]], v[2]); pitch = v[3]; return true; } window.__pose(v[0], v[1], v[2], v[3]); return true; };
window.__up = (id) => (id === undefined ? (upIn ? upIn.id : null) : id ? climbTo(site.lofts[id === true ? "lingxiao" : id]) : climbTo(null));   // go up (from the stair's foot), come down (false), or say where he is
// Switch a part of the scene, or one of the passes, while the walk goes on (the debug panel; `?off=` does the same at
// load). `__part()` lists them, each true when drawn. What a room or the hour hides stays hidden: a court switched
// back on while he is indoors is not drawn until he comes out. The novice and the rooms are shown or hidden by the
// walk itself every frame, so they are not offered.
const shownNow = (name) => !OFF.has(name) && !(inside && (COURTS.includes(name) || name === "drift")) ;
window.__part = (name, on) => {
  const names = [...new Set(scene.children.map((o) => o.userData.part).filter((n) => n && n !== "monk" && n !== "interior"))];
  if (name === undefined) return Object.fromEntries([...names, ...PASSES].map((n) => [n, !OFF.has(n)]));
  if (!names.includes(name) && !PASSES.includes(name)) return null;
  if (on) OFF.delete(name); else OFF.add(name);
  if (name === "reflect") { quality.planar = on ? PLANAR : 0; resize(); }
  else if (name === "bloom") { quality.bloom = !!on; resize(); }
  else if (name === "layers") layers();
  else if (["gtao", "halation", "lut", "dof"].includes(name)) { if (post.part(name, on) === null) { OFF.add(name); return null; } }
  else if (name === "shadow") { renderer.shadowMap.enabled = !!on; renderer.shadowMap.needsUpdate = true; scene.traverse((/** @type {any} */ o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
  else for (const o of scene.children) if (o.userData.part === name) o.visible = shownNow(name);
  return !OFF.has(name);
};
// What a frame costs to draw, in milliseconds: `n` frames drawn back to back, each waited for until the graphics card
// has really finished it. Unlike frames-per-second this leaves out the browser's own work of presenting the picture.
window.__cost = (n = 40) => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const one = () => { renderer.info.reset(); if (live && !inside) live.frame(camera, camera.position, post.size()); if (quality.planar > 0) ground.render(renderer, camera); post.render(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  for (let i = 0; i < 6; i++) one();
  const t0 = performance.now(); for (let i = 0; i < n; i++) one();
  return +((performance.now() - t0) / n).toFixed(2);
};
// What each part of the scene weighs: meshes, and triangles as drawn (instances counted).
window.__trees = () => ({ cedars: trees.cedars ? trees.cedars.length : 0, hash: trees.cedars ? geometryHash(trees.cedars.map((c) => c.geometry)) : null, ginkgos: trees.ginkgos ? trees.ginkgos.length : 0, ginkgoHash: trees.ginkgos ? geometryHash(trees.ginkgos.map((g) => g.geometry)) : null });   // (the cedars' and the ginkgoes' grown wood)   // the cedars' grown wood, for the Node/browser check
window.__census = () => {
  const out = {};
  for (const top of scene.children) {
    const k = top.userData.part || top.type, row = (out[k] ||= { meshes: 0, tris: 0, hidden: !top.visible, hiddenTris: 0 });
    top.traverse((/** @type {any} */ o) => {
      if (!(o.isMesh || o.isPoints || o.isSprite) || !o.geometry) return; row.meshes++;
      const g = o.geometry, n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0, tris = Math.round((o.isPoints ? 0 : n / 3) * (o.isInstancedMesh ? o.count : 1));
      row.tris += tris; if (o !== top && !o.visible) row.hiddenTris += tris;   // (hidden within its part: a season's crowns, a lamp's flame)
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
// `points` ([[x, y], …] in the page's pixels) also asks for the colour at each of them, read from the same frame at full size.
window.__probe = (points) => {
  const t = still ? 0 : performance.now() / 1000;
  if (quality.planar > 0) ground.render(renderer, camera); post.render(t);
  let at = null;
  if (Array.isArray(points)) {
    const r = canvas.getBoundingClientRect(), f = document.createElement("canvas"); f.width = canvas.width; f.height = canvas.height;
    const fx = f.getContext("2d", { willReadFrequently: true }); fx.drawImage(canvas, 0, 0); const sx = canvas.width / r.width, sy = canvas.height / r.height;
    at = points.map(([px, py]) => Array.from(fx.getImageData(Math.min(f.width - 1, Math.round((px - r.left) * sx)), Math.min(f.height - 1, Math.round((py - r.top) * sy)), 1, 1).data.slice(0, 3)));
  }
  const c = document.createElement("canvas"); c.width = 32; c.height = 32; const x = c.getContext("2d"); x.drawImage(canvas, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0, top = 0, n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; if (i < 32 * 8 * 4) top += d[i] + d[i + 1] + d[i + 2]; }
  return { r: r / n, g: g / n, b: b / n, lum: (r + g + b) / (3 * n), sky: top / (32 * 8 * 3), season: state.season, time: state.time, follow: !!state.follow, view, photo: photo.on, monk: monk.group.visible, opacity: +faded.toFixed(3), pushing: !!push, turn: { active: !!turning, swings: turnStats.swings, rate: +turnStats.rate.toFixed(2), pitch: +turnStats.pitch.toFixed(3), move: +turnStats.move.toFixed(4), drifted: +(turnStats.drifted * 180 / Math.PI).toFixed(2), driftRate: +turnStats.driftRate.toFixed(2), heading: +heading.toFixed(4), yaw: +yaw.toFixed(4) }, push: pushed && { to: pushed.to, frames: pushed.frames, fov: +pushed.fov.toFixed(3), move: +pushed.move.toFixed(4), back: pushed.back }, cam: camera.position.toArray().map((v) => +v.toFixed(3)),
    photoSettings: !document.getElementById("photoSettings").hidden, frozen, aspect: photo.aspect, zoom: +photo.zoom.toFixed(3), camDist: +camera.position.distanceTo(new THREE.Vector3(pos.x, footY + 1, pos.z)).toFixed(2), snow: U.uSnow.value, drift: scene.children.some((o) => o.userData.part === "drift" && o.visible), prints: trail.state().stamps, lamp: U.uLamp.value, fov: camera.fov, monkBox: monkBox(), post: post.state(), layers: U.uFogLayer.value.x, soft: sky.softOn && quality.softShadow && !OFF.has("softshadow"), governed: governor.level, at };
};
// The censer before the great hall (#217): how much incense burns, whether it glows, the smoke and the breeze; and, for
// each point given (metres from the censer's foot), how bright the picture is where that point is drawn, 0..255.
window.__censer = (points = []) => {
  const t = still ? 0 : performance.now() / 1000;
  if (quality.planar > 0) ground.render(renderer, camera); post.render(t);
  const c = document.createElement("canvas"), w = canvas.width, h = canvas.height; c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(canvas, 0, 0);
  if (!site.censer) return { none: true };   // a level with no censer (#409)
  const lum = points.map(([px, py, pz]) => { const v = new THREE.Vector3(site.censer.x + px, site.censer.y + py, site.censer.z + pz).project(camera);
    const sx = Math.round((v.x + 1) / 2 * w), sy = Math.round((1 - v.y) / 2 * h); if (v.z > 1 || sx < 2 || sy < 2 || sx > w - 3 || sy > h - 3) return null;
    const d = x.getImageData(sx - 2, sy - 2, 5, 5).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / 25; });
  return { ...props.censer(), wind: U.uWind.value.toArray().map((q) => +q.toFixed(3)), carried: U.uWindPath.value.toArray().map((q) => +q.toFixed(2)), lum };
};
// Rings on the water: how many made, how many spreading. `__ripples(true)` sets a step's worth going at his feet;
// `__ripples([x, z, age])` one at that spot as if made `age` seconds ago, so a still picture can hold them.
window.__ripples = (go) => {
  if (Array.isArray(go)) ground.ripple?.(go[0], walker.heightAt(go[0], go[1]), go[1], go[2] || 0);
  else if (go) ground.ripple?.(pos.x, walker.heightAt(pos.x, pos.z), pos.z);
  return ground.ripples?.() || null;
};
// What the falling leaves are doing, as fall.js's sums have it: kind, how many lie on the ground, and where each is (a diagnostic for tests).
window.__drift = (n) => drift.report(n);
// The ground's record of what has come down (litter.js); `__litter(secs, [x, z, r])` runs the falling and the breeze on that long first and counts what lies within r of x, z (`true`: lists the leaves kept each in its place).
window.__fall = (k) => drift.fall?.(k);
window.__litterDraw = (m) => { if (m !== undefined) U.uLitMode.value = m; return U.uLitMode.value; };   // which of the ground's kept things the paving draws (1 heaps, 2 kept leaves, 3 both), to measure each   // how readily the trees let go: 1 as built, 0.5 half, -1 the old steady fall (#267)
window.__litter = (secs, at) => { if (secs > 0) drift.runOn?.(secs, camera.position, (t) => { const w = windAt(mood?.wind ?? 0, t); return [WIND_DIR[0] * w, WIND_DIR[1] * w]; }); return drift.litter?.(at) ?? null; };
window.__trail = (show) => { if (show === false) trail.hide(); return trail.state(); };
window.__sun = (k) => { sky.scaleSun(k); return k; };   // the sun's light times k (tools/sun-lit.cjs: with it and without it, to see which paving is in direct sun, #488)
window.__mood = (s, t) => { state.follow = false; setMood(s, t); };
window.__skyTrial = (on) => { if (on !== undefined) { SKY_TRIAL.on = !!on; setMood(state.season, state.time); } return SKY_TRIAL.on; };   // #592 trial B: the sky from the sun's height, on or off while the page runs
window.__view = setView; window.__photo = (open, opts) => { setPhoto(open); Object.assign(photo, opts || {}); resize(); };
window.__shots = photoSounds;
window.__flock = (go) => { if (go && flock.flush()) flutter(1); return flock.state(); };   // the birds going up now, if asked, and where they are
window.__cues = cueState;   // how many times the wings and the far bell have sounded   // how many shutters and seals have sounded
window.__capture = async () => { const c = await capture(); return { w: c.width, h: c.height, url: c.toDataURL("image/jpeg", 0.9) }; };
window.__blocked = (x, z) => walker.blocked(x, z);
// Which walker answers (#265): its mode, what the baked floor weighed and cost to fetch, open and keep, and the porch edges.
window.__eyeShutAt = (x, y, z) => (eyeSpace ? eyeSpace.shut(x, y, z) : null);   // would the eye's sphere at this point touch something drawn (the scenarios, #411)
window.__eyeSpace = () => ({ ...eyeInfo, t0: undefined, radius: eyeSpace ? +eyeSpace.radius.toFixed(3) : null, shutNow: eyeSpace ? eyeSpace.shut(camera.position.x, camera.position.y, camera.position.z) : null });   // (shutNow: the eye where it stands this frame touches something drawn, asked of the hierarchy itself)
window.__level = () => ({ ...LV, keepsPlace: !!L.keepsPlace });   // which temple this page walks, what the address asked for (src/level.js, #369), and whether it keeps the prologue's place and book (#385, #426)
window.__walker = () => ({ ...walker.stats, grid: walker.grid ? walker.grid()?.id || null : null, answers: walker.answers ? walker.answers(pos.x, pos.z) : false, drops: walker.drops.length, start: site.start.slice(0, 2), blockedHere: walker.blocked(pos.x, pos.z), floor: walker.heightAt(pos.x, pos.z), eye: camera.position.y });   // (asked where he is, not at __yard()'s centimetres: on a 5 cm grid those can fall in the next cell)
window.__drops = () => walker.drops.map((e) => ({ a: e.a, b: e.b, normal: e.normal, top: e.top }));   // the porch edges as this walker has them
window.__act = (o) => { posed = o || null; };   // { speed, pose, stairs }: how he is shown, whatever he is doing; null to let him be
window.__pose = (x, z, y, p) => { interrupt(); director.drop(); pos.x = x; pos.z = z; yaw = y; pitch = p; footY = eyeY = walker.heightAt(x, z); hop = leap = climb = climbFor = drawn = null; follow.reset(); };
window.__listen = listen; window.__strike = strike; window.__bells = bellsRinging; window.__steps = (play) => { if (play) footstep(play === true ? "snow" : play); return stepState(); };
window.__knock = (go) => { if (go) knock(1); return ambienceState(); };   // two culms knocking now, if asked, and how many have
window.__bird = (go) => { if (go) bird(1); return ambienceState(); };   // a bird now, if asked, and how many have sung
window.__well = (drip) => { if (drip) { well.ripple(); wellDrip(well.state().level); } return well.state(); };   // a drop now, if asked, and how the well stands
// The music: what it is doing; `__music(true)` lets the place be heard, as a first tap does.
window.__music = (begin) => { if (begin) hear(); return musicState(); };

// ---- The visit as a pilgrimage (src/game.js): what it may ask of the walk ----
window.__hud = () => hints.state();
window.__hintSet = (html) => hints.set(html);   // (the line set to some words, to see how it breaks)
window.__eventLog = () => (globalThis.__events || []).slice();   // what the page has named since it opened (src/analytics.js), the last 100
window.__ui = () => ({ stack: ui.state(), modal: ui.modal(), focus: document.activeElement?.id || document.activeElement?.tagName || null });
// ---- The pause menu: what the visitor may set, a way back to the start, the keys ----
const SOUND = [["setVolume", "volume"], ["setMusic", "music"], ["setAmbience", "ambience"], ["setEffects", "effects"]];
ui.layer("menu", { kind: "modal" });
// A slider on paper is a line of ink, darker as far as it is set (src/ui.css reads --v).
const inked = (r) => r.style.setProperty("--v", `${(100 * (r.value - r.min)) / (r.max - r.min || 1)}%`);
menuEl.querySelectorAll("input[type=range]").forEach((r) => r.addEventListener("input", () => inked(r)));
function openMenu(open, quiet = false) {
  if (!open) { ui.close("menu"); return; }
  if (!ui.isOpen("menu") && !quiet) track("demo.menu", { inside: inside ? 1 : 0, up: upIn ? upIn.id : "", tier: quality.name });
  if (ui.open("menu")) { interrupt(); target = null; route = []; }
  const S = settings.get();
  menuEl.querySelectorAll("[data-q]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.q === S.quality)));
  $("setSens").value = S.sens; $("setFov").value = S.fov; for (const [id, k] of SOUND) $(id).value = S[k]; $("setInvert").setAttribute("aria-pressed", String(S.invertY)); $("setInvert").textContent = S.invertY ? tr("开") : tr("关");
  $("setLock").setAttribute("aria-pressed", String(S.lock)); $("setLock").textContent = S.lock ? tr("开") : tr("关");
  $("setStrafe").setAttribute("aria-pressed", String(S.strafeAD)); $("setStrafe").textContent = S.strafeAD ? tr("开") : tr("关"); $("keysAD").textContent = S.strafeAD ? tr("平移") : tr("转身");
  $("setAutocam").setAttribute("aria-pressed", String(S.autocam)); $("setAutocam").textContent = S.autocam ? tr("开") : tr("关");
  $("setFollow").setAttribute("aria-pressed", String(S.follow));   // (its word stays 跟随; the ring round it says whether it is on)
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
  on("setAutocam", () => { set("autocam", !settings.get().autocam); if (!settings.get().autocam) director.drop(); });
  on("setFollow", () => set("follow", !settings.get().follow));
  on("setLock", () => { set("lock", !settings.get().lock); if (!settings.get().lock) document.exitPointerLock?.(); });
  on("setStrafe", () => { set("strafeAD", !settings.get().strafeAD); keyTurn.stop(); });
  on("menuResume", () => openMenu(false)); on("menuBtn", () => openMenu(!ui.isOpen("menu"))); on("menuKeys", () => { openMenu(false); hints.card(true); });
  // The three levels under the whole volume are folded away until asked for, and open by themselves when one of them
  // has been moved from where it began.
  const mix = (open) => { menuEl.classList.toggle("mix", open); $("menuMix").setAttribute("aria-expanded", String(open)); $("menuMix").textContent = open ? tr("收起") : tr("分开调"); };
  on("menuMix", () => mix(!menuEl.classList.contains("mix")));
  { const S = settings.get(); mix(SOUND.slice(1).some(([, k]) => S[k] !== SETTING_DEFAULTS[k])); }
  on("reloadBtn", () => location.reload());
  on("menuFull", () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.()?.catch?.(() => {}); });
  on("titleSet", () => openMenu(true));
  // Lost, or wedged somewhere he should not be: back to where the path begins.
  on("menuHome", () => { director.drop(); if (inside) indoors(null); comeDown(); /* straight out, not through the door: the walk back to the porch would undo this */ openMenu(false); const [x, z, y] = site.start; pos.x = x; pos.z = z; yaw = y; pitch = 0.1; footY = eyeY = walker.heightAt(x, z); hop = leap = climb = climbFor = drawn = null; follow.reset(); });
}
// Back after a change of language (#140): the menu open again as it was, the language just chosen in hand, so that Esc
// puts it away and he walks on. Not counted as the visitor opening the menu (docs/t00/ANALYTICS.md). Sound waits, as
// it always does, for the first touch or key.
function relangBack() {
  openMenu(true, true);
  const b = /** @type {HTMLElement | null} */ (menuEl.querySelector(`[data-lang="${lang}"]`)); if (b) { b.focus({ preventScroll: true }); b.scrollIntoView({ block: "nearest" }); }
  for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, hear, { once: true });
}
// Back after a crossing from another temple (#449): this temple can be drawn, so the ink curtain it came up behind is drawn back, and
// how long the crossing took (from the press to the temple drawn, and to the walk his) is kept and named. Sound waits for the first touch or key.
function crossingBack() {
  inkArrive(crossing).then((a) => track("pilgrimage.arrive", { from: a.from, to: a.to, ms: a.ms, walk_ms: a.walkMs }));
  for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, hear, { once: true });
}
window.__settings = () => settings.get(); window.__menu = (open) => openMenu(open);
// What lies under a point of the picture, nearest first: which part of the scene, which material, how far, whether it is
// see-through. When something in a screenshot will not be explained, ask this before guessing.
window.__pick = (px, py, n = 6) => {
  const r = canvas.getBoundingClientRect(), rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1), camera);
  return rc.intersectObjects(scene.children, true).filter((h) => h.object.visible).slice(0, n).map((h) => { const m = /** @type {any} */ (h.object).material || {}; let o = h.object, part = null; while (o && !part) { part = o.userData.part; o = o.parent; }
    return { part, material: m.customProgramCacheKey && /^[a-zA-Z]+$/.test(m.customProgramCacheKey()) ? m.customProgramCacheKey() : m.type, distance: +h.distance.toFixed(2), at: h.point.toArray().map((v) => +v.toFixed(2)), transparent: !!m.transparent, kind: h.object.type }; });
};
// The place's own shot while an observance is made (src/director.js): see `direct` below. `__direct(id)` asks for one, for a test.
function directShot(id, opts) {
  if (!id) return director.back({ soft: true });   // the observance is over: a swing still on its way arrives first
  if (upIn) return false;   // up on a balcony he sees with his own eyes only: no place's shot is taken there
  const p = site.places[id] || site.restPlaces?.[id] || rooms.spots[id]; if (!p || (p.room || null) !== (inside ? hallIn.room.id : null)) return false;   // a place, or a spot before something in a hall that has a shot of its own (the 功德箱)
  const foot = p.y ?? walker.heightAt(p.at[0], p.at[1]), going = director.go(id, p, foot, opts);
  if (going) { try { warmShot(p, foot); } catch (e) { console.warn("[director] the shot could not be made ready:", e); } }   // a picture made ready or not, the observance goes on
  return going;
}
window.__direct = (id) => directShot(id);
createGame({
  hints, ui, tier: quality.name, relang: !!relang, crossing: !!crossing,
  visit: () => ({ season: state.season, time: state.time, follow: !!state.follow }),   // what a crossing to another temple hands across (#449)
  level: L,   // which temple: whether it keeps a place, plays the opening, raises the prologue's title (#385)
  traceStubs: (k) => props.setTraces(k),   // the stubs other visitors left in the censer today (同修留痕)
  site, walker, scene,
  where: () => ({ x: pos.x, z: pos.z, yaw, up: upIn ? upIn.id : null, hall: inside && !upIn ? hallIn.room.id : null }),
  hallIds: site.halls.map((h) => h.id),
  // Up on a balcony walked round: which one; the stair's foot in the room he is in, if it has one; go up or come down.
  up: () => (upIn ? upIn.id : null), stair: () => (inside && hallIn.room.stair) || null, lofts: site.lofts,
  climb: (id) => climbTo(site.lofts[id]), descend: () => climbTo(null),
  // Stand him somewhere at once, facing a way (coming back to where a visit was left, or to the start of the path).
  // Stood where a kept place says: on a balcony, in a hall's room (#375: indoors first, so that the room's floor is the one
  // asked, as a change of language does), or on the ground; a spot that falls in something moves to the nearest open floor,
  // in a room else its door, out of doors else the foot of the path.
  place(x, z, turn, up = null, hallId = null) { interrupt(); director.drop(); if (inside) indoors(null); comeDown(); if (up && site.lofts[up]) { upstairs(site.lofts[up], [x, z], turn); return; } const hall = hallId ? site.halls.find((h) => h.id === hallId) : null; if (hall) indoors(hall); { const p = settleAt(walker, x, z); if (p) { x = p.x; z = p.z; } else if (hall) { x = pos.x; z = pos.z; } else { [x, z] = site.start; } } pos.x = x; pos.z = z; if (Number.isFinite(turn)) yaw = turn; pitch = 0.1; footY = eyeY = walker.heightAt(x, z); hop = leap = climb = climbFor = drawn = null; follow.reset(); },
  start: site.start,
  // Go somewhere at once behind the veil, as through a door: to a place out of doors, or to one inside a hall.
  async travel(x, z, turn, hallId) {
    if (passing) return false; passing = true; interrupt(); director.drop();
    if (veil) veil.className = "on"; await pause(700);
    const hall = hallId ? site.halls.find((h) => h.id === hallId) : null;
    comeDown();
    if (inside && (!hall || hallIn.room.id !== hallId)) indoors(null);
    if (hall && !inside) indoors(hall);
    { const p = settleAt(walker, x, z); if (p) { x = p.x; z = p.z; } }   // (where a seal was earned may be shut on the baked floor, #274: the nearest open spot within half a metre)
    pos.x = x; pos.z = z; if (Number.isFinite(turn)) yaw = turn; pitch = 0.06; footY = eyeY = walker.heightAt(x, z); hop = leap = climb = climbFor = drawn = null; follow.reset(); await pause(250);
    if (veil) veil.className = ""; passing = false; return true;
  },
  // Send him along `points` ([x, z] each); `then(true)` when he arrives, `then(false)` if he is stopped or sent elsewhere.
  walkTo(points, then) { interrupt(); route = points.map(([x, z]) => new THREE.Vector3(x, 0, z)); target = route.shift(); arrive = then || null; },
  stage(o) { stage = o; },
  // `drawn`: he has drawn the log back himself (rites.js) and it is meeting the bell now; otherwise it is tapped.
  strike(kind, drawn) { const s = site.strikers.find((k) => k.kind === kind); strike(kind, 1); if (s && !drawn) { s.t0 = riteNow(); s.lead = 0; } window.dispatchEvent(new CustomEvent("struck", { detail: kind })); },
  monk, M, put(x, z) { pos.x = x; pos.z = z; }, staged: () => !!stage, seated: () => !!stage && (stage.pose === "sit" || stage.pose === "chair"),   // cross-legged, or on a stool as on a chair
  leave: () => { interrupt(); director.back(); },   // standing up (起身) brings the eye home too, from the far view as from any shot
  // Hand the eye to `fn(camera, dt)` for a passage that is shown, or take it back with null.
  cine(fn) { cine = fn || null; if (!fn) follow.reset(); },
  // The opening after 入山 (src/opening.js): `eye` "fly" or "ink"; resolves with its state when the walk is handed back.
  opening(eye) {
    if (opening.active()) return Promise.resolve(opening.state());
    interrupt(); director.drop(); follow.reset(); document.body.classList.add("opening");
    return new Promise((done) => { openingDone = done; opening.start(eye); });
  },
  openingActive: () => opening.active(), autocam: () => settings.get().autocam, reduced: () => reducedMotion.matches,
  // The place's own shot while an observance is made (src/director.js): `direct(id)` goes to it, `direct(null)` comes back
  // to him; `direct(id, { now })` is there at once (a picture tool), `undirect()` lets go without a swing (a passage takes
  // the eye from it); `directOut()` is how many seconds the way back takes, so an observance can send it that much early.
  direct: directShot,
  // The close of the chapter leaves the eye where it stands, on a shot made of that very pose (`holdShot`): nothing moves
  // when it is handed over, it drifts a very little, and `direct(null)`, a step, a tap on the ground or Esc bring it home by the
  // usual swing. Not for an observance: it is gone to with 自动镜头 off too, as the close itself is.
  holdEye(eye) { const { place, shot } = holdShot(eye, camera.aspect || 16 / 9); return director.go("ending", { ...place, shot }, 0, { now: true, force: true }); },
  undirect: () => director.drop(), directOut: () => director.out(), directed: () => director.active(), directArrived: () => director.state().phase === "hold",
  // The year-end bell's night has come while the page was open (joya-ui.js): a winter night, unless a hand has chosen.
  eventNight() { if (!state.hand && joyaNight() && (state.season !== "winter" || state.time !== "night")) { beforeJoya = { season: state.season, time: state.time, follow: state.follow }; state.follow = false; setMood("winter", "night"); } },
  // And when it has gone: what he had before, the hour following the clock again if it did (prologueDay keeps 昼).
  eventDay() { if (!beforeJoya || state.hand) { beforeJoya = null; return; } const b = beforeJoya; beforeJoya = null; state.follow = b.follow; setMood(b.season, b.follow ? moodNow().time : b.time); },
  setJoya(on) { joyaOn = !!on; },
  eventMood: () => ({ before: beforeJoya, hand: state.hand, season: state.season, time: state.time }),
  // The book shut for the first time after the close (#726): the hour goes to the visitor's own, as the clock's own check does; false where it must stay.
  // The book's paper goes in a single frame, so the hour is changed in that same task and the ink leaves are already shut when the picture shows: the first frame after the book is ink, the hour behind it is the visitor's own, and the ink opens on it (no cut is seen, #726).
  followHour() {
    const h = takeClock(state, Q); if (!h) return false;
    const changed = h !== state.time; setMood(state.season, h);
    if (!changed) return true;
    inkVeil(1); document.body.classList.add("veiled"); const t0 = performance.now(), HOLD = 0.12, OPEN = 0.6;
    const step = () => { const k = ((performance.now() - t0) / 1000 - HOLD) / OPEN; if (k >= 1) { inkVeil(0); document.body.classList.remove("veiled"); return; } const e = k <= 0 ? 0 : k * k * (3 - 2 * k); inkVeil(1 - e); requestAnimationFrame(step); };
    requestAnimationFrame(step); return true;
  },
  mood: () => mood, season: () => state.season, night: () => inside || mood.lamp > 0.5, busy: () => photo.on || !running || passing || !!hop || !!leap, inside: () => inside,
  gallery: rooms.spots, room: () => (inside ? hallIn.room.id : null), hallName: () => (inside && lastHall ? lastHall.name : ""),
  listen: () => hear(),
  onTick: (fn) => ticks.push(fn),
  // Where a point of the place falls on the picture: x and y in pixels, and whether it is behind the eye.
  screenOf(x, yy, z) { const v = new THREE.Vector3(x, yy, z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, behind: v.z > 1, w: r.width, h: r.height }; },
});
// What a shot sees first (the inside of the well's niche, the lamps from before them) may never have been drawn: its
// programs compiled and its textures sent to the card on the frame it first comes into view, a stall in the middle of
// the swing (138 ms at the well on a T4). They are made ready when the eye is sent, drawn once from the shot into a
// small picture nobody sees, while he is still only taking his first step into the observance.
const warmTarget = new THREE.WebGLRenderTarget(64, 36), warmEye = new THREE.PerspectiveCamera();
function warmShot(p, foot) {
  if (Q.has("shot")) return;   // a picture tool is already on the shot
  const o = shotPose(p, p.shot, foot, 0, camera.aspect || 16 / 9);
  warmEye.copy(camera); warmEye.position.copy(o.p); warmEye.quaternion.copy(o.q); warmEye.fov = o.fov; warmEye.updateProjectionMatrix(); warmEye.updateMatrixWorld();
  // What is hidden until the observance shows it (the well's rings, which first appear with the first drop, mid-swing)
  // is shown for this one picture too: it is never on the screen. (Not renderer.compile: that compiles every room
  // under the courts as well, and the swing stalled on it.)
  const near = placePointOf(p, foot, [0, 0, 0]), shown = [];
  scene.traverse((o) => { if (!o.visible && o.userData.warm && o.position.distanceTo(near) < 12) { o.visible = true; shown.push(o); } });   // only what says it may be drawn so (`userData.warm`)
  const was = renderer.getRenderTarget(); renderer.setRenderTarget(warmTarget); renderer.render(scene, warmEye); renderer.setRenderTarget(was);
  for (const o of shown) o.visible = false;
  director.warmed = (director.warmed || 0) + 1;
}
window.__opening = () => ({ ...opening.state(), active: opening.active(), hint: hints.state().tip, cues: cueState() });
// A picture tool's: the eye held `secs` seconds into the way down (null lets it go on), as if the opening were playing.
window.__openingAt = (secs) => { if (secs !== null && !opening.active()) { document.body.classList.add("opening"); follow.reset(); } opening.pin(secs); };
window.__lampStrength = (v) => { if (v !== undefined) U.uLamp.value = v; return U.uLamp.value; };   // for tools/window-lit.cjs: the lamps' strength, until the next mood sets its own
window.__frame = () => ({ frame: FRAME_KEY, ...(FRAME || {}), dist: follow.dist, side: follow.side, sideNow, monkBox: monkBox(), opacity: faded, hidden: monkHidden, w: innerWidth, h: innerHeight, eye: camera.position.toArray(), look: [camera.rotation.y, camera.rotation.x], at: [pos.x, footY, pos.z], frames });   // monkBox as __probe() has it, without drawing a frame
// Where a point of the ground (x, z) is on the page, in CSS pixels, and whether it is in the picture, away from the edge where the slips lie (for the scenarios that tap a place, #411).
window.__project = (x, z) => { const v = new THREE.Vector3(x, walker.heightAt(x, z), z).project(camera); let clear = true, hid = null; const e = camera.position; for (let k = 1; k < 85; k++) { const f = k / 100, px = e.x + (x - e.x) * f, pz = e.z + (z - e.z) * f, py = e.y + (walker.heightAt(x, z) - e.y) * f; if (py < walker.heightAt(px, pz) + 0.15) { clear = false; hid = [+px.toFixed(2), +pz.toFixed(2), +py.toFixed(2), +walker.heightAt(px, pz).toFixed(2)]; break; } }   // (the ground there is in sight, with 15 cm to spare up to 85% of the way (nearer the end a level line is bound to come down to the ground): nothing of the floor stands over the line to it, nor grazes it)
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, on: v.z < 1 && Math.abs(v.x) <= 0.7 && Math.abs(v.y) <= 0.8, clear, hid }; };
window.__director = () => ({ ...director.state(), warmed: director.warmed || 0 });
// A way walked point by point (the scenarios and tools): a leg that something stands across is searched round as a tap is (#323).
window.__walk = (pts) => { planning = null; route = wayThrough(walker, walker.drops, { x: pos.x, z: pos.z }, pts.map(([x, z]) => ({ x, z }))); target = route.shift() || null; };
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
    read: () => (passing || hop || leap ? null : { x: pos.x, z: pos.z, yaw, pitch, view, season: state.season, time: state.time, room: inside ? hallIn.room.id : null, up: upIn ? upIn.id : null, eye: eyeNow(),
      ok: (x, z) => !walker.blocked(x, z) && Math.abs(walker.heightAt(x, z) - walker.heightAt(pos.x, pos.z)) < 0.02 }) });   // the written point stands where he stands
  addEventListener("keydown", (e) => {   // C: the address of this view, to the clipboard and the console
    if (e.key.toLowerCase() !== "c" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || ui.modal() || /** @type {Element} */ (e.target)?.tagName === "INPUT") return;
    const link = devpose.link(); console.info("[devpose]", link); navigator.clipboard?.writeText(link).catch(() => {});
  });
  window.__devpose = () => devpose.link();
}
// The debug panel: where he stands, what the frame costs, the hour, and switches for each part (src/debug.js). It acts
// only through the hooks above. It opens by itself on the dev server and on a pull request's preview
// (<deployment>-temple-walk-preview.<account>.workers.dev, docs/PREVIEWS.md); ?debug=0 keeps it shut there. On the canary
// it opens only with ?debug=1, for testers' reports; the workbench addresses stay a preview's (src/debuggate.js). The
// published site never loads it: the module is a separate chunk fetched only here.
const PREVIEW = /-temple-walk-preview\./.test(location.hostname);
const DEBUG = debugGate({ dev: !!import.meta.env.DEV, hostname: location.hostname, search: location.search });
if (DEBUG) {
  const { mountDebug } = await import("./src/debug.js");
  await mountDebug({ link: () => (devpose ? devpose.link() : null) });
}
// What stops him, drawn (src/walkviz.js, #274): the floor's cells round him, his outline, the ball round his eye. Behind
// the same door as the panel, whose switch calls this; nothing is fetched, built or drawn until it is first switched on.
if (DEBUG) {
  window.__walkviz = async (on) => {
    if (on === undefined) return walkViz ? walkViz.state() : { on: false, objects: 0, inScene: !!scene.getObjectByName("walkviz") };
    if (on && !walkViz) { const { createWalkViz } = await import("./src/walkviz.js"); walkViz = createWalkViz({ scene, walker, bake: walkBaked.bake, outline: walkBaked.outline }); }
    else if (!on && walkViz) { walkViz.dispose(); walkViz = null; }
    return walkViz ? walkViz.state() : { on: false, objects: 0, inScene: !!scene.getObjectByName("walkviz") };
  };
}

await loading.step(tr("山路"));

// ---- Trailer mode (#610): the page drawn frame by frame for the film (src/trailer-boot.js, src/trailer.js) --------------
// The clock is the film's (trailer-clock.js); here are the two things only this file can reach: a free eye, and the wind's
// accumulated path, which a shot starts again from nothing so that it is the same whenever it is drawn.
if (TRAILER) {
  const { createTrailerPlayer } = await import("./src/trailer.js");
  window.__trailerEye = (eye) => {   // eye: { p: [x, y, z], look: [x, y, z], fov, stand?: boolean } or null to let it go
    if (!eye) { cine = null; follow.reset(); lens(); return false; }
    cine = (cam) => { cam.position.set(eye.p[0], eye.p[1], eye.p[2]); cam.lookAt(eye.look[0], eye.look[1], eye.look[2]); if (cam.fov !== eye.fov) { cam.fov = eye.fov; cam.updateProjectionMatrix(); } };
    return true;
  };
  window.__trailerReset = () => { U.uWindPath.value.set(0, 0); };
  createTrailerPlayer(window);
}
