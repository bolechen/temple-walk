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
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { paintMaterial } from "./paint.js";
import recipe from "./paint/recipe.json";
// the masks some figures' zones are drawn from (paint/masks/*.png, tools/t05-hall/mask.py), loaded before the page says it is ready
const MASK_URLS = import.meta.glob("./paint/masks/*.png", { eager: true, query: "?url", import: "default" });
const MASKS = Object.fromEntries(await Promise.all(Object.entries(MASK_URLS).map(async ([k, u]) => {
  const t = await new THREE.TextureLoader().loadAsync(u); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
  return [k.replace(/^.*\/masks\//, ""), t]; })));
const ANCHORS = Object.fromEntries(Object.entries(import.meta.glob("./paint/*.json", { eager: true, import: "default" }))
  .filter(([k]) => !k.endsWith("recipe.json")).map(([k, v]) => [k.replace(/^.*\/(.*)\.json$/, "$1"), v]));

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
// The four tiers of each frame, the heights of their undersides, and how thick each is. Every height in this file is
// measured from the hall's floor (F above the court), not from the court: the page's hall (app/levels/t05/hall.js, #425,
// 665b0e4) gives the same tiers from the court, +11.8, 13.6, 15.4 and 17.2, the lowest on the bracket sets' heads
// (6.06 + 2.75), so that from the threshold the figures' heads and faces are all under it. Ten rafters front to back,
// 2.88 m each: eleven purlins about the ridge.
const BEAMS = [8.8, 10.6, 12.4, 14.2], BEAM_D = 0.9, BEAM_W = 0.6, RAFTER = 2.88;
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
  altar: mat(0x5d574e, 0.85), base: mat(0x6b5d4c, 0.7), gold: mat(0x6f5a34, 0.62, false, { metalness: 0.35 }),   // dark gold, not bright (ART.md §3.1, the lead 2026-11-21)
  halo: mat(0x6c5641, 0.72, false, { metalness: 0.08, side: THREE.DoubleSide }), clay: mat(0xa88a62, 0.75),
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
// The inner columns as app/levels/t05/hall.js has them since #425 (665b0e4): eight in the back row (z −20.1), one under
// each frame, and two in front at the ends of the front aisle (z −5.03); they rise past the eave columns' heads to the
// lowest tier of the frames, BEAMS[0] (at the head of this file), as the structural review gives.
// in the beams' dark old timber, not vermilion: in the red they were the brightest thing in cam03 (the art director, #480;
// the page's hall decided the same, #493 DECISIONS), 0.84 m across as #493 sets the inner columns
const innerColumn = (x, z) => { const h = BEAMS[0], c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, h, 20), M.timber); c.position.set(x, F + h / 2, z); c.castShadow = c.receiveShadow = true; scene.add(c);
  box(0.95, 0.25, 0.95, M.stone, x, F + 0.125, z); };
for (let i = 1; i < 9; i++) innerColumn(XS[i], ZS[4]);
for (const i of [1, 8]) innerColumn(XS[i], ZS[1]);

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
// The underside's height (from the court) over a point, the lowest of the four slopes there; and a purlin's height, its
// top just under the roof
const underAt = (x, z) => F + heightAt(Math.min(OZ - Math.abs(z - ZC), OX - Math.abs(x)));
const purlinY = (z) => Math.min(underAt(0, z - 0.2), underAt(0, z + 0.2)) - 0.2 - 0.06;
// purlins (槫) along the slopes at each step of the profile, and rafters (椽) every 0.6 m on the long slopes, merged
{
  const parts = [];
  // eleven purlins, one at each rafter's joint, 2.88 m apart about the ridge (#425); each runs along the hall only as far
  // as the hipped ends leave room over it
  for (let k = -5; k <= 5; k++) {
    const z = ZC + k * RAFTER, y = purlinY(z), within = (zz) => { let x = OX; while (x > 0 && underAt(x, zz) < y + 0.2 + 0.05) x -= 0.05; return x; };
    const half = Math.min(within(z - 0.2), within(z + 0.2)); if (half < 0.5) continue;
    const g = new THREE.CylinderGeometry(0.2, 0.2, 2 * half, 10); g.rotateZ(Math.PI / 2); g.translate(0, y, z); parts.push(g);
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
// the eight frames (八缝): four tiers of beams, each shorter than the one below, the lowest on the inner columns' heads,
// each running front and back as far as the purlin it carries or the roof's underside allows (the hipped ends lower
// it), short posts between tiers and one up to the ridge purlin; as app/levels/t05/hall.js builds them (#425). Under
// this white box's own roof (eave 8.2, ridge 15.86 above the floor; the page's is steeper) the fourth tier has no room
// and is left out.
{
  const parts = [], bx = (w, h, d, x, y, z) => parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const reach = (x, top) => { let f = null, k = null; for (let z = 0; z >= -DEPTH; z -= 0.05) if (underAt(x, z) >= top) { f ??= z; k = z; } return [f ?? ZC, k ?? ZC]; };
  for (let i = 1; i < 9; i++) {
    const x = XS[i], edge = x + Math.sign(x) * BEAM_W / 2; let prev = null;
    BEAMS.forEach((b, j) => {
      const y = F + b, pf = ZC + RAFTER * (4 - j), pb = ZC - RAFTER * (4 - j), [rf, rb] = reach(edge, y + BEAM_D + 0.05);
      const z1 = Math.min(pf, rf), z0 = Math.max(pb, rb); if (z1 - z0 < 1.5) return;
      bx(BEAM_W, BEAM_D, z1 - z0, x, y + BEAM_D / 2, (z0 + z1) / 2);
      if (prev) for (const z of [z0 + 0.4, z1 - 0.4]) bx(BEAM_W * 0.9, y - prev, 0.7, x, (prev + y) / 2, z);
      prev = y + BEAM_D;
      for (const [z, at] of [[z1, pf], [z0, pb]]) { const up = purlinY(at) - 0.2; if (Math.abs(z - at) < 0.01 && up - prev > 0.1) bx(BEAM_W * 0.8, up - prev, 0.5, x, (prev + up) / 2, z + Math.sign(ZC - z) * 0.25); }
    });
    const crown = purlinY(ZC) - 0.2;
    if (prev && crown - prev > 0.3 && crown <= underAt(edge, ZC + 0.3)) bx(BEAM_W * 0.8, crown - prev, 0.6, x, (prev + crown) / 2, ZC);
  }
  const frames = new THREE.Mesh(mergeGeometries(parts), M.timber); frames.castShadow = frames.receiveShadow = true; scene.add(frames);
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
// The body halo (身光): one form for all seven (ART.md §3.1). The art director's call of 2026-11-21 (#407): widest, 4.2 m,
// at the height of the shoulders, which it frames with the head, narrowing below behind the knees and rising above to a
// point (舟形), the top where it was; 4.2 m keeps every halo clear of the beams of the frames between the seats (the
// narrowest pair of seats stands 5.12 m apart, a beam 0.6 m wide between them).
function haloShape(w, h, ys, inset = 0) {
  // w the widest, h the height, ys the height of the widest; inset draws the band just inside the edge
  const s = new THREE.Shape(), half = w / 2 - inset, foot = half * 0.82, top = h - inset * 1.2;
  s.moveTo(-foot, 0);
  s.bezierCurveTo(-half, ys * 0.35, -half, ys * 0.75, -half, ys);
  s.bezierCurveTo(-half, ys + (top - ys) * 0.45, -half * 0.35, top * 0.9, 0, top);
  s.bezierCurveTo(half * 0.35, top * 0.9, half, ys + (top - ys) * 0.45, half, ys);
  s.bezierCurveTo(half, ys * 0.75, half, ys * 0.35, foot, 0);
  s.lineTo(-foot, 0);
  return s;
}
function mandorla(x, topY, headY, v = {}) {
  const g = new THREE.Group();
  const rings = v.rings ?? 3, tips = v.tips ?? 0, wB = v.width ?? 4.2, z = ALTAR.z - 2.25;
  const h = topY - AT - BASE_H, b = AT + BASE_H, ys = Math.max(0.5, Math.min(h * 0.85, (v.shoulderY ?? headY - 1.6) - b));
  // a figure's own gain on the body's colour (`halo.gain` in the spec): the end figures stand where the hall's light is weaker,
  // and the body is to read at about half the face's brightness on screen on each (issue #463, the art director 2026-11-21)
  let bodyMat = M.halo; if (v.gain) { bodyMat = M.halo.clone(); bodyMat.color.multiplyScalar(v.gain); }
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(haloShape(wB, h, ys), { depth: 0.18, bevelEnabled: false, curveSegments: 24 }), bodyMat); body.position.set(x, b, z); g.add(body);
  for (let r = 0; r < rings; r++) {   // concentric bands in relief: the outline drawn smaller, less its own inset
    const k = 0.9 - r * 0.14, outer = haloShape(wB * k, h * (0.55 + 0.45 * k), ys * k);
    outer.holes.push(new THREE.Path(haloShape(wB * k, h * (0.55 + 0.45 * k), ys * k, 0.18).getPoints(48)));
    const o = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.08, bevelEnabled: false, curveSegments: 24 }), M.gold); o.position.set(x, b, z + 0.18); g.add(o);
  }
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(v.head ?? 1.9, v.head ?? 1.9, 0.12, 48), M.gold); disc.rotation.x = Math.PI / 2; disc.position.set(x, headY, z + 0.3); g.add(disc);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry((v.head ?? 1.9) * 0.7, (v.head ?? 1.9) * 0.7, 0.14, 48), M.halo); inner.rotation.x = Math.PI / 2; inner.position.set(x, headY, z + 0.31); g.add(inner);
  for (let t = 0; t < tips; t++) {     // flame tips round the body halo's edge
    const a = Math.PI * (0.12 + 0.76 * t / Math.max(1, tips - 1)), r = 1;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 6), M.gold);
    const px = Math.cos(a) * wB * 0.52, py = Math.sin(a) * h * 0.98;
    cone.position.set(x + px, b + py * 0.92 + 0.2, z + 0.1); cone.rotation.z = a - Math.PI / 2; g.add(cone);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.halo = true; } });
  body.userData.haloBody = true;   // zoneIds counts the body panel apart from the head disc and the rings
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
const hemi = new THREE.HemisphereLight(0xf2ece2, 0x6f6152, 2.2); hemi.visible = false; scene.add(hemi);   // for { light: "diffuse" } only
const altarLamp = new THREE.PointLight(0xffa860, 0, 14, 2); altarLamp.position.set(0, AT + 0.9, ALTAR.z + 3.2); scene.add(altarLamp);
// The hall's main light as the sky and light session set it (#754): the light that comes in from the doors and windows high and
// before the figures, two wide spots at (±8, F+14, +8) aimed at (±6, F+10.5, ALTAR.z+0.3), half angle 0.7 and penumbra 0.6 (0.5 and 1 left the outer two figures at a third of the middle ones), no shadow; off unless a
// shot gives `keyI` (the candela of each), so the old pictures stay as they were.
const keyLights = [-1, 1].map((sx) => { const l = new THREE.SpotLight(0xfff4e8, 0, 42, 0.7, 0.6, 1.6); l.position.set(sx * 8, F + 14, 8); l.target.position.set(sx * 6, F + 10.5, ALTAR.z + 0.3); l.castShadow = false; scene.add(l, l.target); return l; });

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
  if (probe) { const old = probe; probe = captureProbe(); for (const f of figures) for (const m of Object.values(f.painted || {})) if (m.envMap === old) m.envMap = probe; old.dispose(); }   // the probe follows the light
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
    // a figure that brings its own lotus throne (issue #370's Śākyamuni) stands on a plain plinth of `plinth` metres
    if (s.base === false && s.plinth) { const pl = new THREE.Mesh(new THREE.BoxGeometry(SEAT_W * 0.98, s.plinth, SEAT_D * 0.98), M.base); pl.position.set(x, AT + s.plinth / 2, ALTAR.z + 0.3); pl.castShadow = pl.receiveShadow = true; group.add(pl); }
    const seatH = s.base === false ? (s.plinth || 0) : s.lotus === false ? SUMERU_H : BASE_H;   // a figure that brings its own lotus sits on the Sumeru base
    const gltf = await loader.loadAsync(s.url); const obj = gltf.scene;
    obj.rotation.y = s.turn ?? 0; obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3());
    const k = Math.min((total - seatH) / size.y, (s.maxW ?? SEAT_W) / Math.max(size.x, 0.01)); obj.scale.setScalar(k); obj.updateMatrixWorld(true);   // no wider than its seat
    const bb2 = new THREE.Box3().setFromObject(obj), c = bb2.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group(); pivot.add(obj); obj.position.sub(new THREE.Vector3(c.x, bb2.min.y, c.z));
    pivot.position.set(x, AT + seatH, ALTAR.z + 0.3 + (s.dz ?? 0)); pivot.rotation.y = s.yaw ?? 0; group.add(pivot);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true;
      o.userData.normalMap = o.material?.normalMap ?? null;   // a baked normal map in the file (#463) is kept under the clay and the paint
      if (s.paint) { o.material = M[s.paint]; if (o.userData.normalMap) { o.material = o.material.clone(); o.material.normalMap = o.userData.normalMap; } }
      else if (o.material) { o.material.envMapIntensity = 0; if (o.geometry.attributes.color && !o.material.map) o.material.vertexColors = true; }
      if (s.tint && o.material) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(s.tint)); } } });
    const figH = size.y * k, top = AT + seatH + figH, headY = top - figH * (s.headAt ?? 0.14);
    if (s.halo !== false) group.add(mandorla(x, s.haloTop ?? top + 1.6, headY, s.halo || {}));
    const meshes = []; obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
    figures.push({ group, pivot, obj, meshes, clay: meshes.map((o) => o.material), s, tris: countTris(obj), size: new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) });
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
  // close looks for judging the paint (issue #287), not places a visitor stands: the middle figure's face from 3.2 m in
  // front of it at its own height, and the same face as the eye sees it from 10 m before the altar through a long lens
  faceClose: { at: [0, AT + BASE_H + 4.75, SZ + 3.2], look: [0, AT + BASE_H + 4.75, SZ - 0.8], fov: 32, exp: 4.5 },
  faceFrom10: { at: [0, F + 1.6, SZ + 10], look: [0, AT + BASE_H + 4.75, SZ - 0.5], fov: 11, exp: 4.5 },
  handsClose: { at: [0, AT + BASE_H + 2.4, SZ + 5.5], look: [0, AT + BASE_H + 2.0, SZ], fov: 42, exp: 4.5 },
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
  // The eye ends on the face (about 9 m up).
  const level = F + 2.8 + inside * 1.2; camera.lookAt(0, level + e * (F + 9.0 - level), SZ); camera.updateProjectionMatrix();
  renderer.toneMappingExposure = (1.4 + inside * 3.6) * exposureScale;
  return tWalk + 7;
}

// A walk along any path (issue #370: the worship band 8–10 m before a figure, the side aisle): points [x, z] on the
// hall's floor at eye height 1.6 m, walked at `speed` m/s, the eye kept on `look` (a point in the world, or a figure's
// anchor). Returns the walk's length in seconds; walkPath(spec, t) poses the camera at time t.
function walkPath(spec, t) {
  const P = spec.points, v = spec.speed ?? 1.2; const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const dur = L[L.length - 1] / v; const d = Math.min(Math.max(t, 0) * v, L[L.length - 1]); let i = 1; while (i < P.length - 1 && L[i] < d) i++;
  const k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]), x = P[i - 1][0] + k * (P[i][0] - P[i - 1][0]), z = P[i - 1][1] + k * (P[i][1] - P[i - 1][1]);
  camera.fov = spec.fov ?? 55; camera.position.set(x, F + 1.6 + Math.sin(t * 2 * Math.PI * 1.75) * 0.012, z);
  const look = Array.isArray(spec.look) ? new THREE.Vector3(...spec.look) : figurePoint(spec.look.i, spec.look.at);
  camera.lookAt(look); camera.updateProjectionMatrix(); renderer.toneMappingExposure = (spec.exp ?? 4.5) * exposureScale;
  return dur;
}
// a point given in a figure's own frame (metres; x to the viewer's right, y up from its seat, z toward the viewer) in the world
function figurePoint(i, p) { const f = figures[i]; f.pivot.updateMatrixWorld(true); return f.pivot.localToWorld(new THREE.Vector3(...p)); }
// Which of a figure's named points the eye sees from where the camera stands: a line from the eye to each point; the
// point counts as seen if the first thing the line meets lies within `near` metres of it (the figure's own surface
// there), and as hidden otherwise, with what hid it (the altar, a column, a neighbour, the figure's own knee).
const ray = new THREE.Raycaster();
// A point on a figure's surface in its own frame (the frame the paint's anchors are written in): a line cast from the
// front (+z), the figure's right (-x), or from above at height `top`, through (a, b) of that view (#370's pick tool, in
// the page itself, so what it gives is exactly what the paint reads).
function pick(i, a, b, from = "front", top = 99) {
  const f = figures[i], P = f.pivot; P.updateMatrixWorld(true);
  const o = from === "front" ? new THREE.Vector3(a, b, 20) : from === "right" ? new THREE.Vector3(-20, b, a) : new THREE.Vector3(a, top, b);
  const d = from === "front" ? new THREE.Vector3(0, 0, -1) : from === "right" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const wo = P.localToWorld(o.clone()), wd = P.localToWorld(o.clone().add(d)).sub(wo).normalize();
  ray.set(wo, wd); ray.far = 100; const h = ray.intersectObject(f.obj, true)[0];
  return h ? P.worldToLocal(h.point.clone()).toArray().map((v) => +v.toFixed(3)) : null;
}
// Where a pixel of the last picture falls on figure i's surface, in the figure's own frame (the frame the anchors are written
// in): a ray from the camera through the pixel (x, y from the top left, in the canvas's pixels), the nearest hit on that figure.
function pixelPoint(i, x, y) {
  const f = figures[i]; f.pivot.updateMatrixWorld(true); ray.setFromCamera(new THREE.Vector2(x / W * 2 - 1, 1 - y / H * 2), camera); ray.far = 1e3;
  const hit = ray.intersectObjects(f.meshes, false)[0]; return hit ? f.pivot.worldToLocal(hit.point.clone()).toArray().map((v) => +v.toFixed(3)) : null;
}
function occlusion(i, pts, near = 0.3) {
  const eye = camera.position.clone(), out = {};
  const targets = []; scene.traverse((o) => { if (o.isMesh && o.visible && o !== sky) targets.push(o); });
  for (const [name, p] of Object.entries(pts)) {
    const w = figurePoint(i, p), dir = w.clone().sub(eye), dist = dir.length(); dir.normalize();
    ray.set(eye, dir); ray.far = dist + near; const hit = ray.intersectObjects(targets, false)[0];
    const ndc = w.clone().project(camera), onScreen = Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1;
    const by = !hit ? null : isIn(hit.object, figures[i].obj) ? "self" : figures.findIndex((f) => isIn(hit.object, f.obj)) >= 0 ? "figure" + figures.findIndex((f) => isIn(hit.object, f.obj)) : hit.object.geometry?.type || "scene";
    out[name] = { seen: onScreen && (!hit || hit.distance > dist - near), onScreen, by: hit && hit.distance <= dist - near ? by : null, gap: hit ? +(dist - hit.distance).toFixed(2) : null };
  }
  return out;
}

// Pictures of one figure for review (issue #370: the owner asked to see the hands and the paint before acceptance went on):
// shoot({ studio: { az, el, dist, at, fov, exp } }) stands the eye round figure 0 at `az` degrees (0 in front, 90 its
// right, 180 behind, 270 its left), `el` up, `dist` metres from `at` (a point in its own frame), with the hall hidden,
// a warm key, a cool fill and a rim, and a room environment for the gold to reflect; shoot({ view, over, mood, lamp })
// is a view in the hall, with the altar lamp (a warm point before the altar) at `lamp`.
let studioOn = false, studioEnv = null; const studioLights = [];
function studio(on) {
  if (on === studioOn) return; studioOn = on;
  if (!studioLights.length) {
    const key = new THREE.DirectionalLight(0xffd9a8, 3.2), fill = new THREE.DirectionalLight(0xb8c8e0, 0.9), rim = new THREE.DirectionalLight(0xfff0d8, 2.2);
    studioLights.push(key, fill, rim); for (const l of studioLights) { l.visible = false; scene.add(l, l.target); }
    const pm = new THREE.PMREMGenerator(renderer); studioEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  }
  const keepIn = new Set(); for (const f of figures) f.group.traverse((o) => keepIn.add(o));
  scene.traverse((o) => { if (o.isMesh && !keepIn.has(o)) { o.userData.studioHid ??= o.visible; o.visible = on ? false : o.userData.studioHid; } });
  for (const f of figures) f.group.traverse((o) => { if (o.isMesh && o.userData.halo) o.visible = !on; });
  for (const l of studioLights) l.visible = on; sun.visible = !on; for (const l of skyLights) l.visible = !on; floorFill.visible = bounce.visible = !on; for (const l of keyLights) l.visible = !on;
  scene.background = on ? new THREE.Color(0x2a2622) : null; sky.visible = !on;
  for (const f of figures) for (const m of Object.values(f.painted || {})) { m.userData.envKeep ??= m.envMap; m.envMap = on ? studioEnv : m.userData.envKeep; m.envMapIntensity = on ? 1.0 : 1.6; m.needsUpdate = true; }
  renderer.shadowMap.needsUpdate = true;
}
let lastShot = {};   // zoneIds measures under the same light as the last shot (a diffuse shot's lights are put back after it)
function shoot(s) {
  if (s.mood) setMood(s.mood); if (s.paint !== undefined) paint(s.paint);
  if (s.studio) {
    studio(true); const o = s.studio, f = figures[0], P = f.pivot; P.updateMatrixWorld(true);
    const at = P.localToWorld(new THREE.Vector3(...(o.at || [0, 4.3, 0]))), az = THREE.MathUtils.degToRad(o.az || 0), el = THREE.MathUtils.degToRad(o.el ?? 8), d = o.dist ?? 16;
    // in the figure's frame its front is +z and its right is -x (the viewer's left)
    const dir = P.localToWorld(new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))).sub(P.localToWorld(new THREE.Vector3()));
    camera.position.copy(at).addScaledVector(dir.normalize(), d); camera.fov = o.fov ?? 35; camera.lookAt(at); camera.updateProjectionMatrix();
    const W3 = (v) => P.localToWorld(new THREE.Vector3(...v)).sub(P.localToWorld(new THREE.Vector3()));
    const [key, fill, rim] = studioLights;   // lights fixed to the figure, not the eye: the four sides are lit the same way round it
    key.position.copy(at).add(W3([-9, 10, 12])); key.target.position.copy(at); fill.position.copy(at).add(W3([12, 3, 8])); fill.target.position.copy(at);
    rim.position.copy(at).add(W3([4, 9, -14])); rim.target.position.copy(at);
    renderer.toneMappingExposure = (o.exp ?? 1.0) * exposureScale;
  } else { studio(false); view(s.view || "front10", s.over || {}); altarLamp.intensity = s.lamp ?? 0; altarLamp.distance = s.lampDist ?? 14; keyLights.forEach((l, j) => { l.intensity = s.keyI ?? 0; l.target.position.x = (j ? 1 : -1) * (s.keyAim ?? 6); }); floorFill.intensity = s.noFloor ? 0 : MOODS[mood].floor; if (s.lampAt) altarLamp.position.set(...s.lampAt); altarLamp.color.set(s.lampColor ?? 0xffa860); }
  // { light: "diffuse" }: the same view lit only by a hemisphere light, the sun, the doors' light, the floor's fill and the
  // lamp put out, so a form can be told from the shadows the hall's light throws on it (#463, the 3D review's third round)
  const diffuse = s.light === "diffuse", keep = []; lastShot = s;
  if (diffuse) {
    for (const l of [sun, floorFill, bounce, altarLamp, ...keyLights, ...skyLights]) { keep.push([l, l.visible]); l.visible = false; }
    hemi.intensity = s.hemi ?? 2.2; hemi.visible = true;
  }
  render(); const tris = renderer.info.render.triangles;
  if (diffuse) { for (const [l, v] of keep) l.visible = v; hemi.visible = false; }
  return { tris };
}

let composer = null, useAO = Q.get("ao") !== "0";
function buildComposer() {
  composer = new EffectComposer(renderer); composer.setSize(W, H); composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, W, H); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = +(Q.get("aoi") ?? 0.85);   // how much the occlusion darkens: `aoi` in the address, a spec's or a set's `aoi`
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 2, scale: 1, samples: 12 }); composer.addPass(ao); composer.addPass(new OutputPass());
}
function render() { if (useAO) { if (!composer) buildComposer(); composer.render(); } else renderer.render(scene, camera); }
// what one plain pass of the scene draws, as every frame after the first does (GTAO draws the scene again for its normals,
// and the shadow map is drawn only when the light changes; neither is counted here)
function stats() { if (renderer.shadowMap.needsUpdate) renderer.render(scene, camera);   // draw the (static) shadow map first, so only the frame itself is counted
  renderer.info.reset(); renderer.render(scene, camera); return { tris: renderer.info.render.triangles, calls: renderer.info.render.calls }; }
// what a frame costs with the card made to finish it (as the site's __cost does): mean milliseconds over n frames
function cost(n = 60) { const gl = renderer.getContext(); render(); gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { render(); gl.finish(); } return (performance.now() - t0) / n; }

// Paint (issue #287): each figure that names its anchors (s.colour, a file in paint/) is drawn with the recipe's zones,
// or in plain clay. Gold needs something to reflect, and a dark hall gives it almost nothing but the doors: the hall
// itself, figures left out, is captured once from before the altar into a prefiltered environment (a light probe, the
// usual stand-in for baked reflections), which only the painted figures use. paint(false) is clay, paint(true) painted,
// paint({ env: false }) painted without the probe (to show what gold does without it).
let probe = null, painted = false;
function captureProbe() {
  const pm = new THREE.PMREMGenerator(renderer);
  const hide = figures.map((f) => f.group); for (const g of hide) g.visible = false;
  const rt = pm.fromScene(scene, 0.02, 0.1, 300, { size: 256, position: new THREE.Vector3(0, AT + 4.5, ALTAR.z + 7) });
  for (const g of hide) g.visible = true; pm.dispose(); return rt.texture;
}
function paint(on = true) {
  const o = typeof on === "object" ? { on: true, ...on } : { on: !!on };
  if (o.on && o.env !== false && !probe) probe = captureProbe();
  for (const f of figures) {
    const A = f.s.colour && ANCHORS[f.s.colour];
    if (!o.on || !A) { f.meshes.forEach((m, i) => (m.material = f.clay[i])); continue; }
    // { masks: false }: the zones drawn from masks left out (their leaves get no anchors and are off), to measure what the
    // masks cost a frame (#370 round 6)
    const key = (o.env === false ? "noenv" : "env" + (o.envIntensity ?? "")) + (o.masks === false ? "-nomask" : "") + (o.folds === false ? "-nofolds" : "") + (o.skin ? "-skin" : "") + (o.hair ? "-hair" + o.hair : "") + (o.flat ? "-flat" : "");
    let rec = o.folds === false ? { ...recipe, folds: { ...recipe.folds, hollow: 0, edge: 0 } } : recipe;
    // { skin: "#00ff00" }: the zone of face and hands in a flat colour, to see where its edge lies on a hand (a tool's view, not a look)
    if (o.skin) rec = { ...rec, debugKey: "skin" + o.skin, zones: rec.zones.map((z) => z.name === rec.face.zone ? { ...z, color: o.skin, metal: 0, rough: 1, wear: 0 } : z) };
    // { flat: true }: every zone the director judges the edges of in one flat colour: skin green, curls magenta, the inner garment blue,
    // the robe orange, gilt edging yellow (draw it under { light: "diffuse" } to read them as they are)
    if (o.flat) { const FL = { "面与手（肤色）": "#00ff00", "螺发": "#ff00ff", "内衣": "#0080ff", "胸衣": "#0080ff", "袈裟": "#ff8000", "衣缘描金": "#ffff00" };
      rec = { ...rec, debugKey: (rec.debugKey ?? "") + "flat", zones: rec.zones.map((z) => FL[z.name] ? { ...z, color: FL[z.name], metal: 0, rough: 1, wear: 0, tint: false, gain: undefined } : z) }; }
    // { hair: "#ff00ff" }: the zone of the curls in a flat colour, the same kind of tool view
    if (o.hair) rec = { ...rec, debugKey: (rec.debugKey ?? "") + "hair" + o.hair, zones: rec.zones.map((z) => z.name === "螺发" ? { ...z, color: o.hair, metal: 0, rough: 1, wear: 0 } : z) };
    f.painted ??= {};
    const anchors = o.masks === false ? Object.fromEntries(Object.entries(A.anchors).filter(([k]) => !/^mask/.test(k))) : A.anchors;
    const masks = o.masks === false ? {} : { front: MASKS[A.anchors.maskFront?.file], back: MASKS[A.anchors.maskBack?.file], right: MASKS[A.anchors.maskRight?.file], hair: MASKS[A.anchors.maskHair?.file] };
    // one material for each normal map the file carries (a head baked on a map of its own is its own primitive, #463)
    for (const mesh of f.meshes) {
      const nmap = mesh.userData.normalMap ?? null, k2 = key + (nmap ? ":" + nmap.uuid : "");
      f.painted[k2] ??= paintMaterial(rec, anchors, f.pivot, o.env === false ? { masks, fig: figures.indexOf(f), normalMap: nmap } : { masks, fig: figures.indexOf(f), normalMap: nmap, envMap: probe, envIntensity: o.envIntensity ?? 1.6 });
      f.painted[k2].userData.paint.U.uInner.value.set(...(f.s.innerTint ?? [1, 1, 1]));   // likewise the inner garment's hue where the light is cooler at the ends
      f.painted[k2].userData.paint.U.uLotus.value = f.s.lotusGain ?? 1;   // the white box's light is weaker at the two ends: the spec's compensation, not part of a figure's anchors
      f.painted[k2].userData.update(); if (o.envIntensity) f.painted[k2].envMapIntensity = o.envIntensity;
      mesh.material = f.painted[k2];
    }
  }
  painted = o.on; return figures.map((f) => ({ colour: f.s.colour || null, painted: o.on && !!(f.s.colour && ANCHORS[f.s.colour]) }));
}

// An orthographic look at one figure in its own frame (pivot: x to the viewer's right when facing it, y up from the top of
// its seat, z toward the viewer), shaded by its normals, with a metric grid laid over it: 0.1 m faint, 0.5 m stronger, 1 m
// red. The frame is fixed (x -3.5…3.5, y -0.5…6.5 m from the front; z -3.5…3.5 from the side), so a pixel of a 1400 px
// picture is 5 mm and a point read off the grid is a point in the frame the paint's anchors are written in.
const orthoCam = new THREE.OrthographicCamera(-3.5, 3.5, 3.5, -3.5, 0.1, 100);
let orthoGrid = null;
function ortho(i, side = "front", z = {}) {
  const f = figures[i], P = f.pivot; P.updateMatrixWorld(true);
  if (orthoGrid) orthoGrid.removeFromParent();
  const pts = [[], [], []];
  // zoomed in (z.half under 1 m) the faint lines are every 2 cm, the stronger every 10 cm and the red every 50 cm
  const fine = (z.half ?? 3.5) < 1, st = fine ? 50 : 10, mid = fine ? 5 : 5, big = fine ? 25 : 10;
  for (let k = -3.5 * st; k <= 3.5 * st; k++) { const v = k / st, c = k % big === 0 ? 2 : k % mid === 0 ? 1 : 0; pts[c].push(v, -0.5, 0, v, 10, 0); }
  for (let k = -0.5 * st; k <= 10 * st; k++) { const v = k / st, c = k % big === 0 ? 2 : k % mid === 0 ? 1 : 0; pts[c].push(-3.5, v, 0, 3.5, v, 0); }
  orthoGrid = new THREE.Group();
  [[0x8a8a8a, 0.25], [0xffffff, 0.6], [0xff3030, 0.9]].forEach(([col, op], c) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts[c], 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthTest: false })); l.renderOrder = 10; orthoGrid.add(l); });
  if (z.grid !== false) P.add(orthoGrid);   // a picture for tools/t05-hall/mask.py is drawn without the grid
  orthoGrid.rotation.y = side === "side" ? -Math.PI / 2 : side === "back" ? Math.PI : 0;   // the side view looks from the figure's right (viewer's left), +z to the right of the picture
  const d = 20, cx = z.cx ?? 0, cy = z.cy ?? 3, hh = z.half ?? 3.5;
  const asp = z.square ? 1 : W / H;   // keep metres square on a wide picture (#370; #287 drew its grids square at 1400 px)
  Object.assign(orthoCam, { left: -hh * asp, right: hh * asp, top: hh, bottom: -hh });
  // from behind (#370 round 6, a mask for the back): +x is on the picture's left
  const at = side === "side" ? new THREE.Vector3(-d, cy, cx) : side === "back" ? new THREE.Vector3(cx, cy, -d) : new THREE.Vector3(cx, cy, d);
  orthoCam.position.copy(P.localToWorld(at.clone())); orthoCam.up.set(0, 1, 0); orthoCam.lookAt(P.localToWorld(at.clone().add(side === "side" ? new THREE.Vector3(d, 0, 0) : side === "back" ? new THREE.Vector3(0, 0, d) : new THREE.Vector3(0, 0, -d))));
  orthoCam.updateProjectionMatrix();
  const keep = scene.overrideMaterial; scene.overrideMaterial = null;
  const hidden = []; scene.traverse((o) => { if (o.isMesh && !isIn(o, f.obj) && o.visible) { o.visible = false; hidden.push(o); } });
  // { depth: true }: the depth of the nearest surface toward the eye, in the figure's frame, as grey: (z·s + 3.5) / 7, s = 1
  // from the front and -1 from behind (#370 round 6: a mask is laid only on the surface its picture saw, mask.py)
  const depthMat = z.depth ? new THREE.ShaderMaterial({ uniforms: { uToFig: { value: P.matrixWorld.clone().invert() }, uS: { value: side === "back" ? -1 : 1 }, uSide: { value: side === "side" ? 1 : 0 } },
    vertexShader: "uniform mat4 uToFig; uniform float uSide; varying float vZ; void main() { vec3 f = (uToFig * modelMatrix * vec4(position, 1.)).xyz; vZ = uSide > .5 ? -f.x : f.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: "uniform float uS; uniform float uSide; varying float vZ; void main() { float g = clamp((vZ * (uSide > .5 ? 1. : uS) + 3.5) / 7., 0., 1.); gl_FragColor = vec4(vec3(g), 1.); }" }) : null;
  const mats = new Map(); if (!z.lit) f.obj.traverse((o) => { if (o.isMesh) { mats.set(o, o.material); o.material = depthMat ?? new THREE.MeshNormalMaterial(); } });
  const ex = renderer.toneMappingExposure; if (z.lit) renderer.toneMappingExposure = z.exp ?? 4.5; else renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x202020); const bg = scene.background; scene.background = new THREE.Color(0x202020); sky.visible = false;
  renderer.render(scene, orthoCam);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = ex; scene.background = bg; sky.visible = true;
  for (const [o, m] of mats) o.material = m; for (const o of hidden) o.visible = true; orthoGrid.visible = false; scene.overrideMaterial = keep;
}
// The picture as drawn and, pixel for pixel, which zone of which figure each pixel shows (issue #463): the painted figures
// write their zone's number (paint.js, uIdMode), each figure's halo is zone 15, everything else is black. Returns, for
// each figure and zone, how many pixels showed it (those whose four neighbours show the same zone, so no edge blends in)
// and their mean colour on screen, 0–255; call after shoot(), with the same view.
function zoneIds() {
  const gl = renderer.getContext(), Wd = gl.drawingBufferWidth, Hd = gl.drawingBufferHeight, shown = new Uint8Array(Wd * Hd * 4), id = new Uint8Array(Wd * Hd * 4);
  const dif = lastShot.light === "diffuse", kept0 = [];
  if (dif) { for (const l of [sun, floorFill, bounce, altarLamp, ...keyLights, ...skyLights]) { kept0.push([l, l.visible]); l.visible = false; } hemi.intensity = lastShot.hemi ?? 2.2; hemi.visible = true; }
  render(); gl.readPixels(0, 0, Wd, Hd, gl.RGBA, gl.UNSIGNED_BYTE, shown);
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 }), kept = new Map(), mats = [];
  const haloMat = (i, c = 15) => new THREE.ShaderMaterial({ vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }", fragmentShader: `void main() { gl_FragColor = vec4(${c}. / 16., ${(i + 1).toFixed(1)} / 16., 0., 1.); }`, side: THREE.DoubleSide });
  const own = new Set(); figures.forEach((f, i) => { const hm = haloMat(i), hd = haloMat(i, 16); mats.push(hm, hd); f.group.traverse((o) => { if (o.isMesh && o.userData.halo) { kept.set(o, o.material); o.material = o.userData.haloBody ? hm : hd; own.add(o); } }); for (const m of f.meshes) { own.add(m); if (m.material.userData.paint) m.material.userData.paint.U.uIdMode.value = 1; } });
  scene.traverse((o) => { if ((o.isMesh || o.isLine || o.isPoints) && !own.has(o)) { kept.set(o, o.material); o.material = black; } });
  const tm = renderer.toneMapping, bg = scene.background, sv = sky.visible; renderer.toneMapping = THREE.NoToneMapping; scene.background = new THREE.Color(0); sky.visible = false;
  renderer.setRenderTarget(null); renderer.render(scene, camera); gl.readPixels(0, 0, Wd, Hd, gl.RGBA, gl.UNSIGNED_BYTE, id);
  renderer.toneMapping = tm; scene.background = bg; sky.visible = sv;
  for (const [o, m] of kept) o.material = m; for (const f of figures) for (const m of f.meshes) if (m.material.userData.paint) m.material.userData.paint.U.uIdMode.value = 0;
  if (dif) { for (const [l, v] of kept0) l.visible = v; hemi.visible = false; }
  black.dispose(); mats.forEach((m) => m.dispose());
  // the head alone (the zone of face and hands also holds the hands, the neck and the chest): the skin pixels inside the screen
  // rectangle from the hairline to the chin and from ear to ear, from each figure's own anchors (the reviewer's denominator, #683)
  const faceZi = recipe.zones.findIndex((z) => z.name === recipe.face.zone) + 1, heads = figures.map((f) => {
    const A = f.s.colour && ANCHORS[f.s.colour]?.anchors; if (!A) return null;
    const eyeY = (A.eyeL[1] + A.eyeR[1]) / 2, ps = [A.hairFront, [A.mouth[0], A.mouth[1] - 0.6 * (eyeY - A.mouth[1]), A.mouth[2]], A.earL, A.earR].map((p) => figurePoint(figures.indexOf(f), p).project(camera));
    const x = ps.map((q) => (q.x + 1) / 2 * Wd), y = ps.map((q) => (1 - q.y) / 2 * Hd); return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)]; });
  const headAcc = figures.map(() => [0, 0, 0, 0, new Uint32Array(256)]);
  const code = (k) => (id[k + 1] ? Math.round(id[k] * 16 / 255) * 100 + Math.round(id[k + 1] * 16 / 255) : 0);
  const acc = {};
  for (let y = 1; y < Hd - 1; y++) for (let x = 1; x < Wd - 1; x++) {
    const k = (y * Wd + x) * 4, c = code(k); if (!c) continue;
    if (code(k + 4) !== c || code(k - 4) !== c || code(k + Wd * 4) !== c || code(k - Wd * 4) !== c) continue;
    if (Math.floor(c / 100) === faceZi && heads[(c % 100) - 1]) { const h = heads[(c % 100) - 1], yy = Hd - 1 - y; if (x >= h[0] && x <= h[2] && yy >= h[1] && yy <= h[3]) { const q = headAcc[(c % 100) - 1]; q[0]++; q[1] += shown[k]; q[2] += shown[k + 1]; q[3] += shown[k + 2]; q[4][Math.round(0.2126 * shown[k] + 0.7152 * shown[k + 1] + 0.0722 * shown[k + 2])]++; } }
    const a = (acc[c] ??= [0, 0, 0, 0, new Uint32Array(256)]); a[0]++; a[1] += shown[k]; a[2] += shown[k + 1]; a[3] += shown[k + 2]; a[4][Math.round(0.2126 * shown[k] + 0.7152 * shown[k + 1] + 0.0722 * shown[k + 2])]++;
  }
  const names = [...recipe.zones.map((z) => z.name)]; names[13] = "唇"; names[14] = "背光"; names[15] = "头光与光环";
  const out = figures.map(() => ({}));
  // the 10th, 50th and 90th percentile of each zone's luma (0–255), for how much light and shade the zone holds on screen
  const pct = (h, n, q) => { let t = 0; for (let i = 0; i < 256; i++) { t += h[i]; if (t >= n * q) return i; } return 255; };
  for (const [c, [n, r, g, b, h]] of Object.entries(acc)) { const zi = Math.floor(c / 100), fi = (c % 100) - 1; if (!out[fi]) continue; out[fi][zi === 0 ? "base" : names[zi - 1] ?? `zone${zi}`] = { px: n, rgb: [r / n, g / n, b / n].map((v) => +v.toFixed(1)), q: [0.1, 0.5, 0.9].map((q) => pct(h, n, q)) }; }
  figures.forEach((f, i) => { const q = headAcc[i]; if (q[0]) out[i]["头"] = { px: q[0], rgb: [q[1] / q[0], q[2] / q[0], q[3] / q[0]].map((v) => +v.toFixed(1)), q: [0.1, 0.5, 0.9].map((qq) => pct(q[4], q[0], qq)) }; });
  return out;
}
function isIn(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }

setMood(Q.get("mood") || "summer"); view(Q.get("view") || "door");
window.hall = { ready: true, keyLights, pixelPoint, zoneIds, ortho, pick, shoot, studio, walkPath, figurePoint, occlusion, paint, figures, recipe, ANCHORS, setMood, setStatues, view, walk, render, stats, cost, VIEWS, SEATS, F, AT, ALTAR, scene, renderer, camera,
  set ao(v) { useAO = v; }, set exposure(v) { exposureScale = v; }, info() { return { gl: renderer.getContext().getParameter(renderer.getContext().VERSION), renderer: (() => { const gl = renderer.getContext(), e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; })() }; } };
if (Q.get("live")) { const loop = () => { render(); requestAnimationFrame(loop); }; loop(); }
document.body.dataset.ready = "1";   // tools/gpu/job.cjs waits for this, as it does on the site
