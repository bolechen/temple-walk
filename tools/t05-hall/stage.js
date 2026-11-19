// A white-box of the hall of seven Buddhas (issue #280, T05 after Fengguo Temple): the measured bays, the altar, the
// door's light and the roof frame as plain blocks, and whatever statues are handed to it standing on the altar, so the
// figures can be judged at their real size, from where a visitor would stand, before the level is planned. Nothing in
// app/ is touched; three is the same package the site bundles. tools/t05-hall.cjs drives it.
//
// Frame: metres, +x east, +z south, y up. The courtyard is y 0, the platform and the hall's floor y 3 (docs/t05/DECISIONS.md
// 「可由主创定」). z 0 is the line of the front eave columns; the hall runs north to z -25.13.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const Q = new URLSearchParams(location.search);
const W = +(Q.get("w") || innerWidth), H = +(Q.get("h") || innerHeight);
const F = 3;                                                     // the hall's floor above the courtyard
// The bays across, west to east, in metres (docs/t05/ARCHITECTURE.md §2.1, from the 2012 Palace Museum paper's survey).
const BAYS = [4.98, 4.98, 5.26, 5.8, 5.8, 5.8, 5.26, 4.98, 4.98];
const XS = [0]; for (const b of BAYS) XS.push(XS[XS.length - 1] + b);
const HALF = XS[XS.length - 1] / 2; for (let i = 0; i < XS.length; i++) XS[i] -= HALF;   // column lines, -23.92 … 23.92
const DEPTH = 25.13, ZS = [0, 1, 2, 3, 4, 5].map((i) => -i * DEPTH / 5);              // five bays deep, taken as equal
const COL_H = 6.06, BRACKET = 2.75, WALL = 1.2;                   // column height, bracket sets, wall thickness
const EAVE = 3.8, RIDGE = 15.86;                                  // eaves out from the columns; ridge above the floor
// The altar along the middle seven bays, 37.5 × 4.8 × 0.87 m; the seven seats at the bays' centres.
const ALTAR = { w: 37.5, d: 4.8, h: 0.87, z: -17.9 };
const SEATS = [-16.45, -11.33, -5.8, 0, 5.8, 11.33, 16.45];

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.info.autoReset = false;   // count the scene pass, not the post passes
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);
RectAreaLightUniformsLib.init();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 400);

// Materials: plain colours from the palette in docs/t05/ART.md §3. Outdoor surfaces carry a fake sky fill in their
// emissive (there is no light bounce here, and a hemisphere light would light the inside of the hall as brightly).
const OUT = [];
function mat(hex, rough = 0.85, outdoor = false, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...extra });
  if (outdoor) OUT.push(m); return m;
}
const M = {
  brick: mat(0x6e6a60, 0.9), floor: mat(0x5f5b54, 0.82), stone: mat(0x7a7568, 0.9, true), court: mat(0x77736a, 0.92, true),
  wallIn: mat(0xb9b2a2, 0.95), wallFront: mat(0x8a3b2a, 0.9), wallOut: mat(0x8a3b2a, 0.9, true), timber: mat(0x3a2c23, 0.8), red: mat(0x7a3426, 0.75),
  roof: mat(0x2f251e, 0.85, false, { side: THREE.DoubleSide }), tile: mat(0x5a5f5c, 0.8, true),
  altar: mat(0x5d574e, 0.85), base: mat(0x6b5d4c, 0.7), gold: mat(0x9a7a3e, 0.45, false, { metalness: 0.55 }),
  halo: mat(0x5a4630, 0.6, false, { metalness: 0.25, side: THREE.DoubleSide }), clay: mat(0xa88a62, 0.75),
};
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
const hall = new THREE.Group(); scene.add(hall);

// Courtyard, the 3 m platform, the moon terrace before it and the steps down (all proposals where the pack says so).
box(160, 1, 160, M.court, 0, -0.5, 0);
box(55.8, F, 32, M.stone, 0, F / 2, -DEPTH / 2);                  // platform under the hall
box(37, F, 15, M.stone, 0, F / 2, 0.6 + 7.5 + 2.4);               // moon terrace, z +2.4 … +17.4
for (let i = 0; i < 18; i++) box(9, F / 18 * (18 - i), 0.32, M.stone, 0, F / 18 * (18 - i) / 2, 17.4 + 0.16 + i * 0.32);
box(48.2, 0.06, DEPTH, M.floor, 0, F + 0.03, -DEPTH / 2);         // the hall's brick floor

// Walls: the eave column lines carry walls 1.2 m thick; the front opens three doors in the middle bays and four windows
// in the next two each side (三门四窗); the ends and the back are shut (the back door is drawn closed).
const DOOR = { w: 4.6, h: 5.3 }, WIN = { w: 3.0, sill: 1.2, top: 4.2 };
const OPENINGS = [];
for (let b = 0; b < 9; b++) {
  const cx = (XS[b] + XS[b + 1]) / 2;
  if (b >= 3 && b <= 5) OPENINGS.push({ x: cx, w: DOOR.w, y0: 0, y1: DOOR.h, door: true });
  else if (b >= 1 && b <= 7) OPENINGS.push({ x: cx, w: WIN.w, y0: WIN.sill, y1: WIN.top, door: false });
}
function wallRun(z, x0, x1, holes, inner, t = WALL, frames = true) {
  const hTop = COL_H;
  let x = x0;
  const piece = (a, b, y0, y1) => { if (b - a < 0.01 || y1 - y0 < 0.01) return; box(b - a, y1 - y0, t, inner, (a + b) / 2, F + (y0 + y1) / 2, z); };
  for (const o of holes) {
    const a = o.x - o.w / 2, b = o.x + o.w / 2;
    piece(x, a, 0, hTop); piece(a, b, o.y1, hTop); piece(a, b, 0, o.y0); x = b;
    if (!frames) continue;
    // frame round the opening; a window has upright bars (直棂); the doors' leaves are left out (open)
    box(o.w + 0.5, 0.35, t + 0.2, M.red, o.x, F + o.y1 + 0.17, z); box(0.25, o.y1 - o.y0, t + 0.2, M.red, a - 0.12, F + (o.y0 + o.y1) / 2, z); box(0.25, o.y1 - o.y0, t + 0.2, M.red, b + 0.12, F + (o.y0 + o.y1) / 2, z);
    if (!o.door) for (let k = 1; k < 9; k++) box(0.07, o.y1 - o.y0, 0.07, M.red, a + k * o.w / 9, F + (o.y0 + o.y1) / 2, z);
  }
  piece(x, x1, 0, hTop);
}
wallRun(0, XS[0] - WALL / 2, XS[9] + WALL / 2, OPENINGS, M.wallFront);
wallRun(WALL / 2 + 0.03, XS[0] - WALL / 2, XS[9] + WALL / 2, OPENINGS, M.wallOut, 0.06, false);   // its ochre-red outer face, lit as outdoors
wallRun(-DEPTH, XS[0] - WALL / 2, XS[9] + WALL / 2, [], M.wallIn);
box(WALL, COL_H, DEPTH, M.wallIn, XS[0], F + COL_H / 2, -DEPTH / 2); box(WALL, COL_H, DEPTH, M.wallIn, XS[9], F + COL_H / 2, -DEPTH / 2);

// Columns: the 28 eave columns stand in the walls; of the inner columns (20 in the hall, positions unsurveyed) the white
// box stands a full row behind the seats, through the altar's back, and two pairs at the ends of the front aisle, so the
// middle seven bays are open as the pack describes (减柱). A proposal, docs/t05/ARCHITECTURE.md §2.2.
const colG = new THREE.CylinderGeometry(0.32, 0.34, COL_H, 20);
const column = (x, z) => { const c = new THREE.Mesh(colG, M.red); c.position.set(x, F + COL_H / 2, z); c.castShadow = c.receiveShadow = true; scene.add(c);
  box(0.95, 0.25, 0.95, M.stone, x, F + 0.125, z); box(1.0, 0.5, 1.0, M.timber, x, F + COL_H + 0.25, z); };
for (const x of XS) { column(x, 0); column(x, -DEPTH); }
for (const z of ZS.slice(1, -1)) { column(XS[0], z); column(XS[9], z); }
for (let i = 1; i < 9; i++) column(XS[i], ZS[4]);
for (const i of [1, 2, 7, 8]) column(XS[i], ZS[1]);

// Bracket sets as one band of blocks on the walls' heads, stepping out inside and out (七铺作 drawn as a mass).
const BY = F + COL_H, BH = BRACKET;
for (const [w, d, x, z] of [[48.2 + 2, 2.6, 0, 0], [48.2 + 2, 2.6, 0, -DEPTH], [2.6, DEPTH, XS[0], -DEPTH / 2], [2.6, DEPTH, XS[9], -DEPTH / 2]]) {
  box(w, BH * 0.45, d * 0.55, M.timber, x, BY + BH * 0.225, z);
  box(w + (d > 3 ? 0 : 1), BH * 0.55, d, M.timber, x, BY + BH * 0.725, z);
}

// The roof: a single-eaved hip roof (庑殿) on a stepped profile of height above the floor by distance in from the eave,
// drawn as its rafters' underside (彻上明造: nothing hides the frame), and the beams of the eight frames (八缝) under it.
const OX = HALF + EAVE, OZ = DEPTH / 2 + EAVE, ZC = -DEPTH / 2;  // eave outline: half-widths, centre
const PROF = [[0, 8.2], [EAVE, 9.2], [6.3, 10.2], [8.8, 11.5], [11.3, 12.9], [13.85, 14.4], [OZ, RIDGE]];
function roofGeometry(dy) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (let k = 0; k < PROF.length - 1; k++) {
    const [e0, h0] = PROF[k], [e1, h1] = PROF[k + 1], y0 = F + h0 + dy, y1 = F + h1 + dy;
    const x0 = OX - e0, x1 = OX - e1, z0 = OZ - e0, z1 = OZ - e1;
    quad([-x0, y0, ZC + z0], [x0, y0, ZC + z0], [x1, y1, ZC + z1], [-x1, y1, ZC + z1]);          // south slope
    quad([x0, y0, ZC - z0], [-x0, y0, ZC - z0], [-x1, y1, ZC - z1], [x1, y1, ZC - z1]);          // north slope
    quad([x0, y0, ZC + z0], [x0, y0, ZC - z0], [x1, y1, ZC - z1], [x1, y1, ZC + z1]);            // east hip
    quad([-x0, y0, ZC - z0], [-x0, y0, ZC + z0], [-x1, y1, ZC + z1], [-x1, y1, ZC - z1]);        // west hip
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
}
const roofIn = new THREE.Mesh(roofGeometry(0), M.roof); roofIn.castShadow = roofIn.receiveShadow = true; scene.add(roofIn);
const roofOut = new THREE.Mesh(roofGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0x5a5f5c, roughness: 0.8, side: THREE.FrontSide })); roofOut.castShadow = true; scene.add(roofOut); OUT.push(roofOut.material);
const heightAt = (e) => { for (let k = 0; k < PROF.length - 1; k++) if (e <= PROF[k + 1][0]) { const t = (e - PROF[k][0]) / (PROF[k + 1][0] - PROF[k][0]); return PROF[k][1] + t * (PROF[k + 1][1] - PROF[k][1]); } return RIDGE; };
// purlins (槫) along the slopes at each step of the profile, and rafters (椽) every 0.6 m on the long slopes, merged
{
  const parts = [];
  for (const [e] of PROF.slice(1)) {
    const y = F + heightAt(e) - 0.25, len = 2 * (OX - e);
    for (const s of [1, -1]) { if (e >= OZ - 0.01 && s < 0) continue; const g = new THREE.CylinderGeometry(0.2, 0.2, len, 10); g.rotateZ(Math.PI / 2); g.translate(0, y, ZC + s * (OZ - e)); parts.push(g); }
  }
  for (let x = -OX + 0.3; x < OX; x += 0.6) for (let k = 0; k < PROF.length - 1; k++) {
    const [e0, h0] = PROF[k], [e1, h1] = PROF[k + 1]; if (Math.abs(x) > OX - e1) continue;
    for (const s of [1, -1]) {
      const a = new THREE.Vector3(x, F + h0 - 0.1, ZC + s * (OZ - e0)), b = new THREE.Vector3(x, F + h1 - 0.1, ZC + s * (OZ - e1));
      const g = new THREE.BoxGeometry(0.12, 0.12, a.distanceTo(b)); g.lookAt(b.clone().sub(a)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); parts.push(g);
    }
  }
  const frame = new THREE.Mesh(mergeGeometries(parts), M.timber); frame.castShadow = frame.receiveShadow = true; scene.add(frame);
}
// the eight frames: tie beams stepping up to the ridge, on struts (驼峰/蜀柱 as blocks)
for (let i = 1; i < 9; i++) {
  const x = XS[i];
  const tiers = [[0.6, 1.0, 9.0, EAVE], [0.5, 0.8, 10.6, 6.3], [0.45, 0.7, 12.0, 8.8], [0.4, 0.6, 13.5, 11.3]];
  const ex = OX - Math.abs(x);                                    // in from the hip's eave here: no beam above the roof
  for (const [w, h, y, e] of tiers) { if (e > ex - 0.8) continue; const half = OZ - e; box(w, h, 2 * half, M.timber, x, F + y + h / 2, ZC); box(w * 1.2, 1.2, 0.8, M.timber, x, F + y - 0.6 + 0.01, ZC + half - 0.6); box(w * 1.2, 1.2, 0.8, M.timber, x, F + y - 0.6 + 0.01, ZC - half + 0.6); }
  if (ex > OZ) box(0.4, 1.4, 0.5, M.timber, x, F + 14.1 + 0.7, ZC);
}

// The altar and, per seat, a Sumeru base (须弥座) as stacked mouldings.
box(ALTAR.w, ALTAR.h, ALTAR.d, M.altar, 0, F + ALTAR.h / 2, ALTAR.z);
box(ALTAR.w + 0.3, 0.12, ALTAR.d + 0.3, M.stone, 0, F + ALTAR.h - 0.06, ALTAR.z);
const AT = F + ALTAR.h;                                           // top of the altar
// The throne: a Sumeru base 2.0 m and an upturned lotus 1.0 m, so the figure itself is about two thirds of the whole —
// the proportion the 2021 survey reading gives for these figures with their thrones (高宽比近 3∶2, docs/t05/statue-spike-research.md).
const SUMERU_H = 2.0, LOTUS_H = 1.0, BASE_H = SUMERU_H + LOTUS_H, SEAT_W = 5.5, SEAT_D = 4.2;
function sumeru(x, lotusOn = true) {
  const g = new THREE.Group(), z = ALTAR.z + 0.3;
  const tiers = [[1.0, 1.0, 0.3], [0.94, 0.94, 0.22], [0.82, 0.8, 0.8], [0.94, 0.94, 0.22], [1.02, 1.02, 0.46]];
  let y = AT; for (const [kw, kd, h] of tiers) { const o = new THREE.Mesh(new THREE.BoxGeometry(SEAT_W * kw, h, SEAT_D * kd), M.base); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; g.add(o); y += h; }
  // the lotus: two rows of petals round an oval drum, opening upward
  const parts = [], petal = new THREE.SphereGeometry(1, 10, 8);
  for (const [row, n, k, tilt] of [[0, 28, 1.0, 0.5], [1, 28, 0.9, 0.25]]) for (let i = 0; i < n; i++) {
    const a = (i + row * 0.5) / n * Math.PI * 2, rx = SEAT_W / 2 * k * 0.92, rz = SEAT_D / 2 * k * 0.92;
    const p = petal.clone(); p.scale(0.42, 0.62, 0.14); p.rotateX(-tilt); p.rotateY(-a + Math.PI / 2);
    p.translate(x + Math.cos(a) * rx, y + 0.42 + row * 0.32, z + Math.sin(a) * rz); parts.push(p);
  }
  const drum = new THREE.CylinderGeometry(1, 1, LOTUS_H, 40); drum.scale(SEAT_W * 0.42, 1, SEAT_D * 0.42); drum.translate(x, y + LOTUS_H / 2, z); parts.push(drum);
  if (!lotusOn) { scene.add(g); return g; }
  const lotus = new THREE.Mesh(mergeGeometries(parts.map((q) => q.toNonIndexed())), M.base); lotus.castShadow = lotus.receiveShadow = true; g.add(lotus);
  scene.add(g); return g;
}

// A mandorla (背光) and head halo behind each figure: a pointed body halo and a disc, in dark gold, whose ring count and
// flame tips are the per-figure differences (the pack: 七尊各有背光).
function mandorla(x, topY, headY, v = {}) {
  const g = new THREE.Group();
  const rings = v.rings ?? 3, tips = v.tips ?? 0, wB = v.width ?? 5.6, z = ALTAR.z - 2.25;
  const s = new THREE.Shape(); const h = topY - AT - BASE_H, b = AT + BASE_H;
  s.moveTo(-wB / 2, 0); s.bezierCurveTo(-wB / 2, h * 0.55, -wB * 0.32, h * 0.82, 0, h); s.bezierCurveTo(wB * 0.32, h * 0.82, wB / 2, h * 0.55, wB / 2, 0); s.lineTo(-wB / 2, 0);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false, curveSegments: 24 }), M.halo); body.position.set(x, b, z); g.add(body);
  for (let r = 0; r < rings; r++) {   // concentric bands in relief
    const k = 0.9 - r * 0.14, s2 = new THREE.Shape(); const ww = wB * k, hh = h * (0.55 + 0.45 * k);
    s2.moveTo(-ww / 2, 0); s2.bezierCurveTo(-ww / 2, hh * 0.55, -ww * 0.32, hh * 0.82, 0, hh); s2.bezierCurveTo(ww * 0.32, hh * 0.82, ww / 2, hh * 0.55, ww / 2, 0); s2.lineTo(ww / 2 - 0.18, 0);
    s2.bezierCurveTo(ww / 2 - 0.18, hh * 0.55 - 0.1, ww * 0.32 - 0.12, hh * 0.82 - 0.18, 0, hh - 0.22); s2.bezierCurveTo(-ww * 0.32 + 0.12, hh * 0.82 - 0.18, -ww / 2 + 0.18, hh * 0.55 - 0.1, -ww / 2 + 0.18, 0); s2.lineTo(-ww / 2, 0);
    const o = new THREE.Mesh(new THREE.ExtrudeGeometry(s2, { depth: 0.08, bevelEnabled: false, curveSegments: 24 }), M.gold); o.position.set(x, b, z + 0.18); g.add(o);
  }
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(v.head ?? 1.9, v.head ?? 1.9, 0.12, 48), M.gold); disc.rotation.x = Math.PI / 2; disc.position.set(x, headY, z + 0.3); g.add(disc);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry((v.head ?? 1.9) * 0.7, (v.head ?? 1.9) * 0.7, 0.14, 48), M.halo); inner.rotation.x = Math.PI / 2; inner.position.set(x, headY, z + 0.31); g.add(inner);
  for (let t = 0; t < tips; t++) {     // flame tips round the body halo's edge
    const a = Math.PI * (0.12 + 0.76 * t / Math.max(1, tips - 1)), r = 1;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 6), M.gold);
    const px = Math.cos(a) * wB * 0.52, py = Math.sin(a) * h * 0.98;
    cone.position.set(x + px, b + py * 0.92 + 0.2, z + 0.1); cone.rotation.z = a - Math.PI / 2; g.add(cone);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g); return g;
}

// Sky: a dome with a vertical gradient, drawn behind everything.
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: "uniform vec3 top; uniform vec3 hor; varying vec3 v; void main(){ float t = clamp(v.y*1.6,0.,1.); gl_FragColor = vec4(mix(hor, top, t), 1.); }" }));
scene.add(sky);

// Light. The sun casts the only real shadows; the sky's light through each door and window is a rectangle facing in,
// with the sky's colour; outside, the fake fill in the outdoor materials' emissive; inside, almost nothing else.
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
const ambient = new THREE.AmbientLight(0xffffff, 0.02); scene.add(ambient);
const skyLights = OPENINGS.map((o) => {
  const l = new THREE.RectAreaLight(0xffffff, 1, o.w, o.y1 - o.y0); l.position.set(o.x, F + (o.y0 + o.y1) / 2, -WALL / 2 - 0.02); l.lookAt(o.x, F + (o.y0 + o.y1) / 2, -10); scene.add(l); l.userData.o = o; return l;
});
// light off the floor and walls in front of the altar (no bounce is computed here): a broad warm-grey panel facing up
const floorFill = new THREE.RectAreaLight(0xd8ccb8, 0, 30, 12); floorFill.position.set(0, F + 0.1, ALTAR.z + 9); floorFill.rotation.x = -Math.PI / 2; scene.add(floorFill);
const bounce = new THREE.RectAreaLight(0xffe2c0, 0, 3.6, 6); bounce.rotation.x = -Math.PI / 2; scene.add(bounce);   // sunlit floor inside the door
const altarLamp = new THREE.PointLight(0xffa860, 0, 14, 2); altarLamp.position.set(0, AT + 0.9, ALTAR.z + 3.2); scene.add(altarLamp);

// Two moods. Summer by day (the T00 baseline, for comparison) and early winter, clear and cold, about 09:45 in early
// December at 41.5° N (docs/t05/ART.md §4.2): the sun at about 17° in the south-south-east comes in low through the doors.
const MOODS = {
  summer: { el: 68, az: 180, sun: [1.0, 0.97, 0.9], sunI: 3.2, top: [0.42, 0.58, 0.82], hor: [0.78, 0.82, 0.86], skyI: 2.6, skyC: [0.75, 0.82, 0.92], fill: 0.35, amb: 0.03, lamp: 0.0, floor: 0.10, floorC: [0.88, 0.8, 0.68] },
  winter: { el: 17, az: 152, sun: [1.0, 0.9, 0.78], sunI: 3.4, top: [0.36, 0.52, 0.78], hor: [0.8, 0.84, 0.9], skyI: 2.0, skyC: [0.7, 0.8, 0.96], fill: 0.26, amb: 0.02, lamp: 0.0, floor: 0.11, floorC: [0.74, 0.76, 0.8] },
};
let mood = "summer";
function setMood(name) {
  mood = name; const m = MOODS[name];
  const el = THREE.MathUtils.degToRad(m.el), az = THREE.MathUtils.degToRad(m.az);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));   // +x east, -z north
  sun.position.copy(dir.clone().multiplyScalar(120)).add(new THREE.Vector3(0, 0, -10)); sun.target.position.set(0, 0, -10);
  sun.color.setRGB(...m.sun); sun.intensity = m.sunI;
  skyU.top.value.setRGB(...m.top); skyU.hor.value.setRGB(...m.hor);
  for (const l of skyLights) { l.color.setRGB(...m.skyC); l.intensity = m.skyI * (l.userData.o.door ? 1 : 0.7); }
  const fill = new THREE.Color(...m.skyC).multiplyScalar(m.fill);
  for (const mm of OUT) mm.emissive.copy(fill).multiply(mm.color);
  ambient.intensity = m.amb; altarLamp.intensity = m.lamp; floorFill.intensity = m.floor; floorFill.color.setRGB(...m.floorC);
  // where the sun through the middle door lands on the floor: its warm bounce, if it comes in at all
  const reach = DOOR.h / Math.tan(el);
  if (reach > 2) { const dx = dir.x / Math.hypot(dir.x, dir.z), dz = dir.z / Math.hypot(dir.x, dir.z); const c = Math.min(reach, 22) / 2;
    bounce.position.set(-dx * c, F + 0.05, -dz * c - 0.6); bounce.width = DOOR.w; bounce.height = Math.min(reach, 22); bounce.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, -dz)); bounce.intensity = m.sunI * 0.35; }
  else bounce.intensity = 0;
  renderer.shadowMap.needsUpdate = true;
}

// Statues: each a glTF, scaled to its height above the base, centred on its seat, facing south.
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const figures = [];
async function setStatues(list) {
  for (const f of figures) scene.remove(f.group); figures.length = 0;
  for (const s of list) {
    const group = new THREE.Group(); scene.add(group);
    const x = s.x ?? SEATS[3], total = s.h ?? 9.0;          // 通高 above the altar, base included
    if (s.base !== false) group.add(sumeru(x, s.lotus !== false));
    const seatH = s.base === false ? 0 : s.lotus === false ? SUMERU_H : BASE_H;   // a figure that brings its own lotus sits on the Sumeru base
    const gltf = await loader.loadAsync(s.url); const obj = gltf.scene;
    obj.rotation.y = s.turn ?? 0; obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3());
    const k = Math.min((total - seatH) / size.y, (s.maxW ?? SEAT_W) / Math.max(size.x, 0.01)); obj.scale.setScalar(k); obj.updateMatrixWorld(true);   // no wider than its seat
    const bb2 = new THREE.Box3().setFromObject(obj), c = bb2.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group(); pivot.add(obj); obj.position.sub(new THREE.Vector3(c.x, bb2.min.y, c.z));
    pivot.position.set(x, AT + seatH, ALTAR.z + 0.3 + (s.dz ?? 0)); pivot.rotation.y = s.yaw ?? 0; group.add(pivot);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true;
      if (s.paint) o.material = M[s.paint];
      else if (o.material) { o.material.envMapIntensity = 0; if (o.geometry.attributes.color && !o.material.map) o.material.vertexColors = true; }
      if (s.tint && o.material) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(s.tint)); } } });
    const figH = size.y * k, top = AT + seatH + figH, headY = top - figH * (s.headAt ?? 0.14);
    if (s.halo !== false) group.add(mandorla(x, s.haloTop ?? top + 1.6, headY, s.halo || {}));
    figures.push({ group, s, tris: countTris(obj), size: new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) });
  }
  renderer.shadowMap.needsUpdate = true;
  return figures.map((f) => ({ url: f.s.url, tris: f.tris, size: f.size }));
}
function countTris(o) { let n = 0; o.traverse((m) => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return n; }

// Views a visitor would stand at (issue #280): the middle door from the terrace (about 24 m from the middle figure), before
// the altar 6 m from it looking up, and from the side aisle at about 12 m; then the pack's six cameras (camera-manifest.json).
const SZ = ALTAR.z + 0.3;
const VIEWS = {
  door: { at: [0, F + 1.6, 6.0], look: [0, F + 4.6, SZ], fov: 50, exp: 1.15 },
  front: { at: [0, F + 1.6, SZ + 6], look: [0, F + 8.6, SZ], fov: 60, exp: 5 },
  front10: { at: [0, F + 1.6, SZ + 10], look: [0, F + 7.0, SZ], fov: 55, exp: 4.5 },
  side: { at: [8.6, F + 1.6, SZ + 8.4], look: [0, F + 5.6, SZ], fov: 55, exp: 4.5 },
  door3: { at: [0, F + 1.6, -1.2], look: [0, F + 5.0, SZ], fov: 55, exp: 3.5 },
  side3: { at: [15.5, F + 1.6, -7.5], look: [-2.0, F + 5.0, SZ], fov: 55, exp: 4.5 },
  cam03: { at: [0, F + 1.6, 0.6], yaw: 0, pitch: 8, fov: 50, exp: 3 },
  cam04: { at: [19, F + 1.6, -8], yaw: 305, pitch: 5, fov: 50, exp: 4.5 },
  cam05: { at: [0, F + 1.6, -12], yaw: 0, pitch: 58, fov: 55, exp: 5.5 },
  cam06: { at: [0, F + 1.6, -2], yaw: 0, pitch: 9, fov: 65, exp: 3.5 },
  court: { at: [0, 1.6, 55], yaw: 0, pitch: 11, fov: 50, exp: 1.0 },
};
let exposureScale = 1;
function view(name, over = {}) {
  const v = { ...VIEWS[name], ...over }; camera.fov = v.fov; camera.position.set(...v.at);
  if (v.look) camera.lookAt(...v.look);
  else { const y = THREE.MathUtils.degToRad(v.yaw), p = THREE.MathUtils.degToRad(v.pitch); camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)))); }
  camera.updateProjectionMatrix(); renderer.toneMappingExposure = (v.exp ?? 1) * exposureScale * (MOODS[mood].exp ?? 1);
}
// The walk for the film: from the terrace in through the middle door at the novice's pace (T00: 2.1 m/s), stopping 6 m
// from the middle figure, then the eye lifts slowly to its face. Eye height 1.6 m.
function walk(t) {
  const z0 = 5.0, z1 = SZ + 6.2, v = 2.1, tWalk = (z0 - z1) / v;
  const z = t < tWalk ? z0 - v * t : z1, k = Math.max(0, Math.min(1, (t - tWalk) / 6)), e = k * k * (3 - 2 * k);
  const inside = Math.max(0, Math.min(1, (2 - z) / 6));
  camera.fov = 55; camera.position.set(0, F + 1.6 + Math.sin(t * 2 * Math.PI * 1.75) * 0.012 * (t < tWalk ? 1 : 0), z);
  camera.lookAt(0, F + 1.6 + 1.2 + e * 7.2 + inside * 1.2, SZ); camera.updateProjectionMatrix();
  renderer.toneMappingExposure = (1.4 + inside * 3.6) * exposureScale;
  return tWalk + 7;
}

let composer = null, useAO = Q.get("ao") !== "0";
function buildComposer() {
  composer = new EffectComposer(renderer); composer.setSize(W, H); composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, W, H); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.85;
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 2, scale: 1, samples: 12 }); composer.addPass(ao); composer.addPass(new OutputPass());
}
function render() { if (useAO) { if (!composer) buildComposer(); composer.render(); } else renderer.render(scene, camera); }
// what one plain pass of the scene draws (GTAO draws the scene again for its normals; that is not counted here)
function stats() { renderer.info.reset(); renderer.render(scene, camera); return { tris: renderer.info.render.triangles, calls: renderer.info.render.calls }; }
// what a frame costs with the card made to finish it (as the site's __cost does): mean milliseconds over n frames
function cost(n = 60) { const gl = renderer.getContext(); render(); gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { render(); gl.finish(); } return (performance.now() - t0) / n; }

setMood(Q.get("mood") || "summer"); view(Q.get("view") || "door");
window.hall = { ready: true, setMood, setStatues, view, walk, render, stats, cost, VIEWS, SEATS, F, AT, ALTAR, scene, renderer, camera,
  set ao(v) { useAO = v; }, set exposure(v) { exposureScale = v; }, info() { return { gl: renderer.getContext().getParameter(renderer.getContext().VERSION), renderer: (() => { const gl = renderer.getContext(), e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; })() }; } };
if (Q.get("live")) { const loop = () => { render(); requestAnimationFrame(loop); }; loop(); }
document.body.dataset.ready = "1";   // tools/gpu/job.cjs waits for this, as it does on the site
