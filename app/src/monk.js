// The visitor: a novice of six or seven, round-headed, eyes closed in a small smile, in a terracotta robe tied with a
// sash, grey-brown trousers gathered into pale leg wraps, cloth shoes, a string of wooden beads at his throat and a
// bamboo hat carried on his back. He is modelled after the turnaround the owner drew of him in an A-pose (front, side
// and back, the hat and the beads beside), and he is bound to his skeleton in that same pose, as a sculpted figure is.
//
// The skeleton uses the humanoid names that VRM and most retargeting tools read (hips, spine, chest, neck, head, and
// for each side shoulder, upper arm, lower arm, hand, upper leg, lower leg, foot) under a root bone that carries his
// height above the step, with a few more for what hangs off him: four for the skirt of the robe, one for the ends of
// the sash, one for the hat. Skin and cloth are skinned meshes, weighted by hand: the robe bends at the waist and
// shoulders, the skirt swings on its own bones, the trousers fold at the knee. The legs reach for the ground with a
// two-bone solver, so each shoe stands on the tread under it; the spine is posed directly, and the arms reach with the
// same solver to bring the palms together. As with the girl in Watercolour (docs/WATERCOLOUR-TEARDOWN.md), what hangs
// off him swings on small springs driven by his speed and his turning.
import * as THREE from "../vendor/three/build/three.module.js";
import { STAIR } from "./geo.js";
import { mergeGeometries } from "../vendor/three/jsm/utils/BufferGeometryUtils.js";

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sq = (v) => v * v, clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp, TAU = Math.PI * 2;
const col = (hex) => new THREE.Color(hex);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const XV = V3(1, 0, 0), UPV = V3(0, 1, 0);

// His measure, in metres: 1.18 tall, the head a quarter of it, the arms bound 38° from his sides.
const APOSE = 0.66, UPPER = 0.2, FORE = 0.15, THIGH = 0.22, SHIN = 0.22, ANKLE = 0.06;
const SKULL = V3(0, 1.04, -0.004), R = 0.14;
const FOOT_X = 0.088, FOOT_Z = 0.012, TOE_OUT = 0.12;
const SIDES = [["left", 1], ["right", -1]];   // he faces +z, so his left hand is on +x
const SKIRT = ["robeFront", "robeLeft", "robeBack", "robeRight"];
// Under each sole, the points that must clear the ground (in the foot's own frame, on the floor).
const PROBES = [[0.045, -0.054], [-0.045, -0.054], [0.045, 0.114], [-0.045, 0.114], [0, 0.117], [0, -0.056]].map(([x, z]) => V3(x, 0, z));

const PAL = {
  skin: col(0xf0c6a4), crown: col(0xf3d0b2), blush: col(0xe9958a), lip: col(0x9a5244), brow: col(0x5e3b29), lash: col(0x3a271d), earIn: col(0xe4a58c),
  robe: col(0xb2633f), robeIn: col(0x6c3720), band: col(0x9c5232), sash: col(0xa2583a), collar: col(0xdcd1bb),
  trousers: col(0x6f6155), wrap: col(0xddd2bc), shoe: col(0x48423f), sole: col(0xc6b9a1), strap: col(0x523a2a), tie: col(0x7a5c38),
};

// ---- Cloth and straw, painted once ----
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function linen() {   // coarse, hand-woven: a thread to two pixels, and here and there a thicker slub
  const [c, x] = canvas(256, 256);
  x.fillStyle = "#f3f3f3"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) { x.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.15})`; x.fillRect(i, 0, 1, 256); x.fillStyle = `rgba(60,48,38,${0.05 + Math.random() * 0.09})`; x.fillRect(0, i, 256, 1); }
  for (let i = 0; i < 170; i++) { x.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${0.08 + Math.random() * 0.1})` : `rgba(40,30,20,${0.06 + Math.random() * 0.08})`; x.fillRect(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 44, 1 + Math.random()); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function straw() {   // split bamboo plaited on the diagonal: two strips over, two under, converging to the crown
  const W = 512, H = 128, [c, x] = canvas(W, H), cell = W / 64 / Math.SQRT2;
  x.fillStyle = "#5e4a2c"; x.fillRect(0, 0, W, H);
  x.save(); x.rotate(Math.PI / 4);
  for (let i = -4; i < 120; i++) for (let j = -110; j < 30; j++) {
    const u = i * cell, v = j * cell, h = Math.abs(Math.sin((i + j) * 12.9898 + (((i - j) % 128) + 128) % 128 * 78.233) * 43758.5453) % 1;
    const tone = 196 + h * 46, over = ((i + j) & 3) < 2;
    x.fillStyle = `rgb(${tone | 0},${(tone * 0.83) | 0},${(tone * 0.55) | 0})`;
    if (over) x.fillRect(u + 0.3, v + 0.1 * cell, cell - 0.6, cell * 0.8); else x.fillRect(u + 0.1 * cell, v + 0.3, cell * 0.8, cell - 0.6);
    x.fillStyle = "rgba(90,66,30,.22)";
    if (over) x.fillRect(u + 0.3, v + cell * 0.48, cell - 0.6, 0.6); else x.fillRect(u + cell * 0.48, v + 0.3, 0.6, cell - 0.6);
  }
  x.restore();
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- Geometry helpers ----
// A sheet of points joined row to row and round each row; `at(i, j)` gives [x, y, z, u, v, colour?].
function grid(nr, nc, at) {
  const pos = new Float32Array(nr * nc * 3), uv = new Float32Array(nr * nc * 2), clr = new Float32Array(nr * nc * 3), idx = [];
  let coloured = false;
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
    const [x, y, z, u, v, c] = at(i, j), k = i * nc + j;
    pos.set([x, y, z], k * 3); uv.set([u, v], k * 2); if (c) { clr.set([c.r, c.g, c.b], k * 3); coloured = true; }
  }
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) { const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); if (coloured) g.setAttribute("color", new THREE.BufferAttribute(clr, 3));
  g.setIndex(idx); return g;
}
// Frames along a path: the point, its tangent, the normal it lies on, and the side across it.
function frames(pts, normalAt, closed = false) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const t = b.clone().sub(a).normalize(), nn = normalAt(p, i).clone(); nn.addScaledVector(t, -nn.dot(t)).normalize();
    return { p, t, n: nn, s: V3().crossVectors(nn, t).normalize(), k: 1 };
  });
}
// A cross-section, as [across, out] pairs, swept along frames (scaled by each frame's k). Sections are listed so that
// the top runs toward +across, which keeps the faces turned outward.
function sweep(fr, section, closed = false) {
  const n = fr.length, m = section.length, pos = [], uv = [], idx = [];
  fr.forEach((f, i) => section.forEach(([a, o], j) => { pos.push(f.p.x + (f.s.x * a + f.n.x * o) * f.k, f.p.y + (f.s.y * a + f.n.y * o) * f.k, f.p.z + (f.s.z * a + f.n.z * o) * f.k); uv.push((i / Math.max(1, n - 1)) * 4, j / Math.max(1, m - 1)); }));
  for (let i = 0; i < (closed ? n : n - 1); i++) for (let j = 0; j < m - 1; j++) { const a = i * m + j, b = ((i + 1) % n) * m + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const oval = (w, h, k = 8) => Array.from({ length: k + 1 }, (_, i) => { const f = (-TAU * i) / k; return [w * Math.cos(f), h * Math.sin(f)]; });
// Smooth the shading across seams where points coincide (the back of a lathe, the poles of a sphere).
function weld(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, nr = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) { const key = `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`; let l = map.get(key); if (!l) map.set(key, (l = [])); l.push(i); }
  for (const ids of map.values()) if (ids.length > 1) { let x = 0, y = 0, z = 0; for (const i of ids) { x += nr.getX(i); y += nr.getY(i); z += nr.getZ(i); } const l = Math.hypot(x, y, z) || 1; for (const i of ids) nr.setXYZ(i, x / l, y / l, z / l); }
  return g;
}
function flip(g) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.index.needsUpdate = true; return g; }
function paint(g, c) {
  const p = g.attributes.position, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = typeof c === "function" ? c(p.getX(i), p.getY(i), p.getZ(i), i) : c; a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g;
}
// Bind each point to up to four bones: `w(x, y, z)` returns [[bone index, weight], ...], or one bone index for all.
function weigh(g, w) {
  const p = g.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const acc = new Map();
    for (const [b, v] of typeof w === "number" ? [[w, 1]] : w(p.getX(i), p.getY(i), p.getZ(i))) if (v > 1e-5) acc.set(b, (acc.get(b) || 0) + v);
    const list = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = list.reduce((s, [, v]) => s + v, 0) || 1;
    list.forEach(([b, v], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = v / sum; });
  }
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4)); return g;
}
function finish(g, color, w, keepUV) {
  if (!g.attributes.normal) g.computeVertexNormals();
  if (color) paint(g, color);
  if (w !== undefined) weigh(g, w);
  if (!keepUV) g.deleteAttribute("uv");
  return g;
}

// ---- The robe's body, as half-widths (across) and depths (front to back) at each height ----
const PROF = new THREE.CatmullRomCurve3([[0.172, 0.255], [0.164, 0.3], [0.146, 0.4], [0.124, 0.5], [0.106, 0.58], [0.099, 0.62], [0.1, 0.66], [0.104, 0.72], [0.108, 0.775], [0.111, 0.8], [0.098, 0.826], [0.075, 0.85], [0.055, 0.866], [0.044, 0.876]]
  .map(([r, y]) => V3(r, y, 0)), false, "centripetal").getPoints(48);
const rxAt = (y) => { if (y <= PROF[0].y) return PROF[0].x; for (let i = 1; i < PROF.length; i++) if (PROF[i].y >= y) { const a = PROF[i - 1], b = PROF[i]; return a.x + (b.x - a.x) * ((y - a.y) / (b.y - a.y || 1)); } return PROF[PROF.length - 1].x; };
const DEPTH = [[0.255, 0.68], [0.45, 0.71], [0.62, 0.76], [0.7, 0.73], [0.79, 0.645], [0.84, 0.75], [0.876, 0.93]];
const depthAt = (y) => { if (y <= DEPTH[0][0]) return DEPTH[0][1]; for (let i = 1; i < DEPTH.length; i++) if (DEPTH[i][0] >= y) { const [y0, d0] = DEPTH[i - 1], [y1, d1] = DEPTH[i]; return d0 + (d1 - d0) * smooth(y0, y1, y); } return DEPTH[DEPTH.length - 1][1]; };
const belly = (y) => 0.009 * Math.exp(-sq((y - 0.655) / 0.06));   // a child's round front
const rzAt = (y, c) => rxAt(y) * depthAt(y) + belly(y) * smooth(-0.3, 0.6, c);
const inBody = (x, y, z) => { if (y < 0.255 || y > 0.876) return 9; const r = Math.hypot(x, z) || 1e-9; return Math.hypot(x / rxAt(y), z / rzAt(y, z / r)); };
function toBody(p, c) {   // where the line from c (inside him) out through p meets the robe
  const d = p.clone().sub(c), q = V3(), f = (m) => inBody(...q.copy(c).addScaledVector(d, m).toArray());
  let hi = 1; while (f(hi) < 1 && hi < 16) hi *= 2;
  let lo = 0; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (f(m) < 1) lo = m; else hi = m; }
  return c.clone().addScaledVector(d, (lo + hi) / 2);
}
function bodyNormal(p) { const h = 0.0015, f = (dx, dy, dz) => inBody(p.x + dx, p.y + dy, p.z + dz); return V3(f(h, 0, 0) - f(-h, 0, 0), f(0, h, 0) - f(0, -h, 0), f(0, 0, h) - f(0, 0, -h)).normalize(); }
// A path laid on the robe: each guess [x, y, z, cx, cy, cz] is projected from the centre given (inside him), the result
// smoothed and resampled, and every sample settled back onto the cloth `lift` above it.
function onBody(guesses, count, lift, closed = false) {
  const pts = guesses.map(([x, y, z, cx = 0, cy = y, cz = 0]) => toBody(V3(x, y, z), V3(cx, cy, cz)));
  let s = new THREE.CatmullRomCurve3(pts, closed, "centripetal").getSpacedPoints(count);
  if (closed) s = s.slice(0, -1);
  return s.map((p) => { const n = bodyNormal(p), q = toBody(p.clone().addScaledVector(n, 0.06), p.clone().addScaledVector(n, -0.045)), m = bodyNormal(q); return { p: q.addScaledVector(m, lift), n: m }; });
}

// The skull: a deep, round head, full in the cheek, the back of it full, the face a little flat.
function deform(p) {
  const r = p.length() || 1, n = p.clone().divideScalar(r), u = n.y, front = smooth(-0.5, 0.4, n.z), back = smooth(0.1, -0.6, n.z);
  const cheek = Math.exp(-sq((u + 0.5) / 0.3)) * front;
  const kx = 1 + 0.085 * cheek - 0.05 * smooth(-0.78, -1, u);
  const kz = 1.07 + 0.025 * cheek + 0.06 * Math.exp(-sq((u + 0.2) / 0.38)) * back - 0.03 * smooth(0.72, 1, n.z) * (1 - smooth(0.55, 0.9, Math.abs(u)));
  const ky = 1 - 0.02 * smooth(0, 1, u);
  return V3(p.x * kx, p.y * ky, p.z * kz);
}
const onFace = (az, el, lift = 0) => deform(V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(R + lift)).add(SKULL);

const spring = (k = 70, c = 9) => ({ x: 0, v: 0, step(target, dt) { for (let left = dt; left > 1e-6; left -= 1 / 60) { const h = Math.min(left, 1 / 60); this.v += (k * (target - this.x) - c * this.v) * h; this.x += this.v * h; } return this.x; } });

export function createMonk() {
  // ---- The skeleton, in the A-pose he was drawn in ----
  const group = new THREE.Group(), bones = [], B = {};
  const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); (parent || group).add(b); bones.push(b); B[name] = b; return b; };
  bone("root", null, 0, 0, 0);
  bone("hips", B.root, 0, 0.53, 0);
  bone("spine", B.hips, 0, 0.08, 0);
  bone("chest", B.spine, 0, 0.11, 0);
  bone("neck", B.chest, 0, 0.145, -0.004);
  bone("head", B.neck, 0, 0.04, 0.004);
  for (const [n, s] of SIDES) {
    bone(n + "Shoulder", B.chest, s * 0.03, 0.08, 0);
    bone(n + "UpperArm", B[n + "Shoulder"], s * 0.062, -0.005, 0).rotation.z = s * APOSE;
    bone(n + "LowerArm", B[n + "UpperArm"], 0, -UPPER, 0);
    bone(n + "Hand", B[n + "LowerArm"], 0, -FORE, 0);
  }
  for (const [n, s] of SIDES) {
    bone(n + "UpperLeg", B.hips, s * 0.085, -0.03, 0);
    bone(n + "LowerLeg", B[n + "UpperLeg"], 0, -THIGH, 0);
    bone(n + "Foot", B[n + "LowerLeg"], 0, -SHIN, 0);
  }
  for (const n of SKIRT) bone(n, B.hips, 0, 0.07, 0);   // the skirt hangs from the waist on four bones
  bone("sashTail", B.hips, 0.032, 0.096, 0.094);         // at the knot
  bone("hat", B.chest, 0, 0.045, -0.085);                 // where the hat rests against his upper back
  group.updateMatrixWorld(true);
  const IDX = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  const at = (name) => B[name].getWorldPosition(V3());

  // ---- Weights ----
  // The robe: chest above, then spine, hips at the waist; below the sash the skirt bones take over, each the side it
  // faces; at the shoulders the cloth goes some way with the arm.
  const robeW = (x, y, z) => {
    const w = {}, add = (n, v) => { if (v > 1e-5) w[n] = (w[n] || 0) + v; };
    const up = smooth(0.585, 0.655, y), top = smooth(0.67, 0.76, y), skirt = smooth(0.62, 0.4, y), a = Math.atan2(x, z), sk = (1 - up) * skirt;
    add("chest", up * top); add("spine", up * (1 - top)); add("hips", (1 - up) * (1 - skirt));
    add("robeFront", sk * sq(Math.max(0, Math.cos(a)))); add("robeBack", sk * sq(Math.max(0, -Math.cos(a))));
    add("robeLeft", sk * sq(Math.max(0, Math.sin(a)))); add("robeRight", sk * sq(Math.max(0, -Math.sin(a))));
    const arm = 0.55 * smooth(0.07, 0.112, Math.abs(x)) * smooth(0.7, 0.775, y) * smooth(0.885, 0.83, y);
    if (arm > 0) { for (const k in w) w[k] *= 1 - arm; add(x > 0 ? "leftUpperArm" : "rightUpperArm", arm); }
    return Object.entries(w).map(([n, v]) => [IDX[n], v]);
  };
  const ARM = SIDES.map(([n, s]) => { const J = at(n + "UpperArm"), d = V3(s * Math.sin(APOSE), -Math.cos(APOSE), 0), o = V3(s * Math.cos(APOSE), Math.sin(APOSE), 0); return { n, s, J, d, o, e2: d.clone().cross(o) }; });
  const along = ({ J, d }, x, y, z) => V3(x, y, z).sub(J).dot(d);

  // ---- Skin: head, neck, forearms, hands, one mesh ----
  const skinParts = [];
  {
    const g = new THREE.SphereGeometry(R, 56, 40), p = g.attributes.position, clr = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const n = V3(p.getX(i), p.getY(i), p.getZ(i)).divideScalar(R);
      const cheek = Math.max(...[1, -1].map((s) => Math.exp(-(sq(n.x - s * 0.53) + sq(n.y + 0.41) + sq(n.z - 0.74)) / 0.024)));   // the cheeks flush
      c.copy(PAL.skin).lerp(PAL.crown, smooth(0.45, 0.95, n.y)).lerp(PAL.blush, 0.6 * cheek);
      clr.set([c.r, c.g, c.b], i * 3);
      const q = deform(n.multiplyScalar(R)).add(SKULL); p.setXYZ(i, q.x, q.y, q.z);
    }
    g.setAttribute("color", new THREE.BufferAttribute(clr, 3)); weld(g);
    skinParts.push(finish(g, null, IDX.head));
    // The face is a few fine strokes: closed eyes curving down in a smile, soft brows, a small mouth.
    const stroke = (pts, width, color) => {
      const P = pts.map(([az, el]) => onFace(az, el, 0.0006)), fr = frames(P, (q) => q.clone().sub(SKULL).normalize());
      fr.forEach((f, i) => { f.k = width(i / (fr.length - 1)); });
      return finish(sweep(fr, oval(1, 0.45, 8)), color, IDX.head);
    };
    const arc = (n, f) => Array.from({ length: n + 1 }, (_, i) => f((2 * i) / n - 1));
    for (const s of [1, -1]) {
      skinParts.push(stroke(arc(12, (t) => [s * (0.485 + 0.125 * t), -0.262 - 0.048 * (1 - t * t)]), (u) => 0.001 + 0.0026 * Math.sin(Math.PI * u), PAL.lash));
      skinParts.push(stroke(arc(12, (t) => [s * (0.49 + 0.15 * t), 0.014 + 0.036 * (1 - t * t)]), (u) => 0.0016 + 0.0058 * Math.pow(Math.sin(Math.PI * u), 0.7), PAL.brow));
      for (const [a0, e0, a1, e1] of [[0.585, -0.27, 0.635, -0.292], [0.6, -0.266, 0.655, -0.278]]) skinParts.push(stroke(arc(4, (t) => [s * (a0 + (a1 - a0) * (t + 1) / 2), e0 + (e1 - e0) * (t + 1) / 2]), (u) => 0.0011 * (1 - u) + 0.0002, PAL.lash));
    }
    skinParts.push(stroke(arc(10, (t) => [0.125 * t, -0.7 + 0.045 * t * t]), (u) => 0.001 + 0.0011 * Math.sin(Math.PI * u), PAL.lip));
    skinParts.push(finish(new THREE.SphereGeometry(0.0125, 14, 10).scale(1.25, 0.85, 0.8).translate(...onFace(0, -0.5, -0.0035).toArray()), PAL.skin.clone().lerp(PAL.blush, 0.25), IDX.head));   // the nose
    for (const s of [1, -1]) {   // large ears, standing a little out and turned forward
      const ear = mergeGeometries([paint(new THREE.SphereGeometry(1, 16, 12).scale(0.0095, 0.036, 0.0245), PAL.skin),
        paint(new THREE.TorusGeometry(0.021, 0.0062, 8, 24).rotateY(Math.PI / 2).scale(1, 1.36, 1.05).translate(0.003, 0.001, 0), PAL.skin),
        paint(new THREE.SphereGeometry(1, 12, 8).scale(0.0045, 0.017, 0.011).translate(0.0055, -0.003, 0.001), PAL.earIn)]);
      if (s < 0) { ear.scale(-1, 1, 1); flip(ear); }
      ear.rotateY(-s * 0.45).translate(...onFace(s * 1.66, -0.56, -0.004).toArray());
      skinParts.push(finish(ear, null, IDX.head));
    }
    skinParts.push(finish(new THREE.CylinderGeometry(0.036, 0.041, 0.08, 20, 3, true).translate(0, 0.885, -0.006), PAL.skin, (x, y) => {
      const h = smooth(0.888, 0.918, y), c2 = smooth(0.875, 0.85, y); return [[IDX.head, h], [IDX.chest, c2], [IDX.neck, Math.max(0, 1 - h - c2)]];
    }));
    for (const arm of ARM) {   // a child's soft forearm, thinning to the wrist, out of the sleeve
      const { J, d, o, e2, n } = arm, NC = 16, NA = 9;
      const fa = grid(NA, NC + 1, (i, j) => {
        const t = 0.165 + ((0.352 - 0.165) * i) / (NA - 1), th = Math.PI + (TAU * j) / NC;
        const r = 0.0235 - 0.0055 * smooth(0.17, 0.34, t) + 0.0015 * Math.exp(-sq((t - 0.23) / 0.03));
        const q = J.clone().addScaledVector(d, t).addScaledVector(o, r * Math.cos(th)).addScaledVector(e2, r * 0.86 * Math.sin(th));
        return [q.x, q.y, q.z, 0, 0];
      });
      weld(fa);
      skinParts.push(finish(fa, PAL.skin, (x, y, z) => { const t = along(arm, x, y, z), l = smooth(0.18, 0.215, t), h = 0.5 * smooth(0.335, 0.352, t); return [[IDX[n + "UpperArm"], 1 - l], [IDX[n + "LowerArm"], l * (1 - h)], [IDX[n + "Hand"], l * h]]; }));
      // The hand, made in its own frame (wrist at the origin, fingers down -y, palm to +z, thumb outward), then set where
      // the bone is.
      const parts = [new THREE.SphereGeometry(1, 16, 12).scale(0.0215, 0.026, 0.0118).translate(0, -0.026, 0.002), new THREE.CylinderGeometry(0.0185, 0.0195, 0.024, 14)];
      [[0.0132, 0.021], [0.0045, 0.025], [-0.0045, 0.024], [-0.0132, 0.019]].forEach(([fx, len], k) => parts.push(new THREE.CapsuleGeometry(0.0061 - k * 0.0003, len, 4, 8).translate(0, -len / 2, 0).rotateX(-0.28 - k * 0.04).rotateZ(fx * 3).translate(fx, -0.046, 0.002)));
      parts.push(new THREE.CapsuleGeometry(0.0068, 0.018, 4, 8).translate(0, -0.009, 0).rotateZ(0.75).rotateX(-0.5).translate(0.017, -0.016, 0.007));
      const hand = mergeGeometries(parts.map((g) => { g.deleteAttribute("uv"); return g; }));
      if (arm.s < 0) { hand.scale(-1, 1, 1); flip(hand); }
      hand.applyMatrix4(B[n + "Hand"].matrixWorld);
      skinParts.push(finish(hand, PAL.skin, IDX[n + "Hand"]));
    }
  }

  // ---- The robe: body and skirt, sleeves, collar, sash, the hat's straps; one mesh ----
  const robeParts = [];
  const rows = [{ y: 0.3, k: 0.955, inner: 1 }, { y: 0.266, k: 0.972, inner: 1 }, { y: 0.2568, k: 0.99, inner: 1 }, ...PROF.map((p) => ({ y: p.y, k: 1 })), { y: 0.868, k: 0.78, inner: 1 }];
  const NT = 72;
  const torso = grid(rows.length, NT + 1, (i, j) => {
    const { y: y0, k, inner } = rows[i], a = -Math.PI + (TAU * j) / NT, s = Math.sin(a), c = Math.cos(a);
    const low = 1 - smooth(0.3, 0.62, y0), hem = smooth(0.36, 0.26, y0);
    const y = y0 + hem * (0.006 * Math.sin(5 * a + 1.2) + 0.0035 * Math.sin(11 * a + 0.3));                                // the hem is not quite level
    let m = 1 + low * (0.034 * Math.sin(7 * a + 0.6) + 0.017 * Math.sin(13 * a + 2.1) + 0.008 * Math.sin(23 * a + 0.4));   // folds that open toward the hem
    m += 0.02 * smooth(-0.68, -0.63, a) * smooth(2.4, 1.9, a) * (1 - smooth(0.6, 0.64, y0));   // the left panel lies over the right: its edge runs down his right front
    m += 0.024 * Math.exp(-sq((y0 - 0.664) / 0.016));                                          // the cloth pouches a little over the sash
    m -= 0.012 * Math.exp(-sq((Math.abs(a) - Math.PI) * 9)) * (1 - smooth(0.8, 0.84, y0));     // the seam down his back
    const x = rxAt(y0) * k * m * s, z = rzAt(y0, c) * k * m * c;
    const v = (y0 - 0.8) * 0.667 - Math.abs(x);   // inside the V at his throat the under-collar shows
    const colour = inner ? PAL.robeIn : z > 0 && y0 > 0.79 ? PAL.robe.clone().lerp(PAL.collar, smooth(-0.002, 0.002, v)) : PAL.robe;
    return [x, y, z, (j / NT) * 5, y0 * 7, colour];
  });
  weld(torso);
  robeParts.push(finish(torso, null, robeW, true));
  const torsoCount = torso.attributes.position.count;
  for (const arm of ARM) {   // wide sleeves to the elbow, the underside hanging longer, lined a shade darker
    const { J, d, o, e2, n } = arm, NC = 36, NA = 15;
    const srows = [...Array.from({ length: NA }, (_, i) => ({ v: i / (NA - 1), k: 1, back: 0 })), { v: 1, k: 0.93, back: 0.012, lining: 1 }, { v: 1, k: 0.88, back: 0.06, lining: 1 }];
    const sl = grid(srows.length, NC + 1, (i, j) => {
      const th = Math.PI + (TAU * j) / NC, c = Math.cos(th), sn = Math.sin(th), row = srows[i];
      const tEnd = 0.198 + 0.036 * Math.pow(Math.max(0, -c), 1.5), t = -0.035 + (tEnd + 0.035) * row.v - row.back, vv = clamp((t + 0.035) / 0.235, 0, 1);
      let r = (0.047 + 0.019 * smooth(0, 1, vv)) * row.k;
      r *= (1 - 0.14 * Math.max(0, -c) * smooth(0.1, 0.6, vv)) * (1 + 0.02 * Math.sin(th * 5 + vv * 3) * vv);
      const q = J.clone().addScaledVector(d, t).addScaledVector(o, r * c).addScaledVector(e2, r * sn);
      return [q.x, q.y, q.z, (j / NC) * 2, vv * 1.6, row.lining ? PAL.robeIn : PAL.robe];
    });
    weld(sl);
    robeParts.push(finish(sl, null, (x, y, z) => { const t = along(arm, x, y, z), w = smooth(-0.025, 0.07, t); return [[IDX[n + "UpperArm"], w], [IDX[n + "Shoulder"], (1 - w) * 0.5], [IDX.chest, (1 - w) * 0.5]]; }, true));
  }
  const band = (pts, section, color, w = robeW) => finish(sweep(frames(pts.map((q) => q.p), (_, i) => pts[i].n), section), color, w, true);
  const flat = (hw, h) => [[-hw, 0], [-hw, h], [hw, h], [hw, 0]];
  // The collar: in the V at his throat the cream under-collar; over it the robe's own band, the left panel's crossing
  // down to his right side under the sash (the way a robe is always closed), the right panel's running under it.
  const F = (x, y) => [x, y, 0.3, x, y, 0], Bk = (x, y) => [x, y, -0.3, x, y, 0];   // straight onto his front, or his back
  robeParts.push(band(onBody([F(-0.0035, 0.806), F(-0.022, 0.835), F(-0.038, 0.858), [-0.25, 0.869, 0.1], [-0.25, 0.869, -0.12], [-0.12, 0.869, -0.3], [0, 0.869, -0.3], [0.12, 0.869, -0.3], [0.25, 0.869, -0.12], [0.25, 0.869, 0.1], F(0.038, 0.858), F(0.022, 0.835), F(0.0035, 0.806)], 64, 0.0012), flat(0.0075, 0.0022), PAL.collar));
  robeParts.push(band(onBody([F(-0.0549, 0.8589), [-0.25, 0.86, 0.12], [-0.25, 0.86, -0.12], [-0.12, 0.86, -0.3], [0, 0.86, -0.3], [0.12, 0.86, -0.3], [0.25, 0.86, -0.12], [0.25, 0.86, 0.12], F(0.0549, 0.8589), F(0.033, 0.826), F(0.0109, 0.7929), F(-0.022, 0.743), F(-0.056, 0.691), F(-0.0893, 0.64)], 90, 0.0024), flat(0.013, 0.0034), PAL.band));
  robeParts.push(band(onBody([F(-0.0549, 0.8589), F(-0.033, 0.826), F(-0.0109, 0.7929), F(0, 0.776)], 16, 0.0014), flat(0.013, 0.003), PAL.band));
  // The sash: a band round the waist, knotted at his left front, its two ends hanging.
  {
    const y = 0.626, ring = Array.from({ length: 72 }, (_, k) => { const a = -Math.PI + (TAU * k) / 72, c = Math.cos(a), q = V3(rxAt(y) * Math.sin(a), y, rzAt(y, c) * c); const n = bodyNormal(q); return { p: q.addScaledVector(n, 0.0022), n }; });
    robeParts.push(finish(sweep(frames(ring.map((q) => q.p), (_, i) => ring[i].n, true), [[-0.022, 0], [-0.0226, 0.0035], [-0.021, 0.0072], [0.021, 0.0072], [0.0226, 0.0035], [0.022, 0]], true), PAL.sash, IDX.spine, true));
    const K = at("sashTail");
    const knot = mergeGeometries([new THREE.SphereGeometry(0.019, 14, 10).scale(1, 0.95, 0.65).translate(K.x, K.y, K.z),
      new THREE.TorusGeometry(0.0165, 0.0068, 8, 20).scale(1, 0.72, 0.5).rotateZ(0.55).translate(K.x - 0.024, K.y + 0.009, K.z - 0.002)]);
    robeParts.push(finish(knot, PAL.sash, IDX.spine, true));
    for (const [dx, len, spread, wd] of [[0.004, 0.205, 0.006, 0.019], [-0.013, 0.17, -0.03, 0.017]]) {
      const pts = [], N = 12;
      for (let i = 0; i <= N; i++) {
        const u = i / N, y2 = K.y - 0.008 - len * u, x2 = K.x + dx + spread * u * u, front = rzAt(y2, 1) * (1 + 0.06 * (1 - smooth(0.3, 0.62, y2)));
        pts.push(V3(x2, y2, Math.max(K.z - 0.004, front + 0.013) + 0.002 * Math.sin(u * 5)));
      }
      const fr = frames(pts, () => V3(0, 0, 1));
      fr.forEach((f, i) => { f.k = 1 + 0.25 * (i / N); });
      robeParts.push(finish(sweep(fr, [[-wd, -0.002], [-wd, 0.002], [wd, 0.002], [wd, -0.002], [-wd, -0.002]]), PAL.sash, IDX.sashTail, true));
    }
  }
  // The straps that hold the hat: over each shoulder and down his front, tucked under the sash.
  for (const s of [1, -1]) {
    const c = [s * 0.05, 0.78, 0];
    const g = [Bk(s * 0.05, 0.74), Bk(s * 0.058, 0.8), [s * 0.064, 0.95, -0.2, ...c], [s * 0.068, 1.0, 0, ...c], [s * 0.074, 0.95, 0.2, ...c], F(s * 0.082, 0.79), F(s * 0.086, 0.72), F(s * 0.088, 0.655)];
    robeParts.push(band(onBody(g, 40, 0.0042), flat(0.0075, 0.0028), PAL.strap));
  }

  // ---- Trousers and leg wraps: full below the hem, slim where the robe always covers them ----
  const legParts = [];
  const TROUSER = new THREE.CatmullRomCurve3([[0.034, 0.118], [0.041, 0.128], [0.053, 0.141], [0.064, 0.16], [0.071, 0.19], [0.072, 0.225], [0.066, 0.262], [0.052, 0.3], [0.04, 0.36], [0.033, 0.43], [0.029, 0.5], [0.027, 0.53]].map(([r, y]) => V3(r, y, 0)), false, "centripetal").getPoints(22);
  for (const [n, s] of SIDES) {
    const cx = s * 0.085, NC = 28;
    const tr = grid(TROUSER.length, NC + 1, (i, j) => {
      const { x: r0, y } = TROUSER[i], a = -Math.PI + (TAU * j) / NC;
      const pleat = 1 + 0.075 * Math.sin(10 * a + s) * smooth(0.2, 0.13, y) + 0.025 * Math.sin(5 * a + 1 + s) * smooth(0.3, 0.19, y) * smooth(0.13, 0.17, y);   // gathered into the wraps
      const r = r0 * pleat * (1 + 0.06 * smooth(0.12, 0.2, y) * smooth(0.32, 0.22, y) * Math.max(0, s * Math.sin(a)));                                          // and ballooning outward over them
      return [cx + r * Math.sin(a), y, r * Math.cos(a) * 0.97 - 0.004, (j / NC) * 3, y * 6, PAL.trousers];
    });
    weld(tr);
    legParts.push(finish(tr, null, (x, y) => { const lo = smooth(0.315, 0.245, y), hip = 0.55 * smooth(0.44, 0.53, y); return [[IDX.hips, hip], [IDX[n + "UpperLeg"], (1 - hip) * (1 - lo)], [IDX[n + "LowerLeg"], (1 - hip) * lo]]; }, true));
    const ys = []; for (let y = 0.044; y <= 0.1375; y += 0.0029) ys.push(y);
    const wr = grid(ys.length, 25, (i, j) => {   // the cloth wound up the shin, each turn over the last
      const y = ys[i], a = -Math.PI + (TAU * j) / 24, f = ((((y - 0.044) / 0.0115 + (s * a) / TAU) % 1) + 1) % 1;
      const r = 0.0305 + 0.003 * smooth(0.05, 0.1, y) + 0.0065 * smooth(0.11, 0.135, y) + 0.0017 * f;
      return [cx + r * Math.sin(a), y, r * Math.cos(a) - 0.002, (j / 24) * 2, y * 8, PAL.wrap.clone().multiplyScalar(0.84 + 0.16 * smooth(0, 0.2, f))];
    });
    weld(wr);
    legParts.push(finish(wr, null, IDX[n + "LowerLeg"], true));
  }
  // ---- Cloth shoes on pale soles ----
  const shoeParts = [];
  for (const [n, s] of SIDES) {
    const up = new THREE.SphereGeometry(1, 28, 16), p = up.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) * 0.041, z = p.getZ(i) * 0.079 + 0.03; let y = p.getY(i) * 0.04 - 0.031; y = Math.min(Math.max(y, -0.047), -0.013 - Math.max(0, z - 0.05) * 0.35); p.setXYZ(i, x, y, z); }
    up.computeVertexNormals();
    const shoe = mergeGeometries([paint(up, PAL.shoe), paint(new THREE.CylinderGeometry(1, 1, 1, 28).scale(0.045, 0.012, 0.084).translate(0, -0.054, 0.03), PAL.sole)]);
    shoe.translate(s * 0.085, ANKLE, 0);
    shoeParts.push(finish(shoe, null, IDX[n + "Foot"], true));
  }

  // ---- Materials and meshes ----
  const lin = linen();
  const clothM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, map: lin, bumpMap: lin, bumpScale: 0.6, roughness: 0.92, sheen: 0.5, sheenRoughness: 0.75, sheenColor: new THREE.Color(0xffe2cc), envMapIntensity: 0.4 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.56, envMapIntensity: 0.45, emissive: 0x2a1206, emissiveIntensity: 0.5 });
  const shoeM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.86, bumpMap: lin, bumpScale: 0.35, envMapIntensity: 0.3 });
  const beadM = new THREE.MeshStandardMaterial({ color: 0x9a6038, roughness: 0.34, envMapIntensity: 0.9 });
  const skinned = (parts, mat) => { const m = new THREE.SkinnedMesh(mergeGeometries(parts), mat); m.frustumCulled = false; m.receiveShadow = true; group.add(m); return m; };
  const skin = skinned(skinParts, skinM), robe = skinned(robeParts, clothM), legs = skinned(legParts, clothM), shoes = skinned(shoeParts, shoeM);
  const skeleton = new THREE.Skeleton(bones);
  for (const m of [skin, robe, legs, shoes]) m.bind(skeleton);
  const rigid = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; parent.add(m); return m; };

  // The beads: thirty-two turned beads on a loop that lies over his shoulders and hangs to his chest.
  {
    const F = (x, y) => [x, y, 0.3, x, y, 0], Bk = (x, y) => [x, y, -0.3, x, y, 0];
    const guess = [Bk(0, 0.872), Bk(0.035, 0.869), [0.062, 0.95, -0.12, 0.05, 0.8, 0], [0.072, 1.0, 0.02, 0.05, 0.8, 0], [0.08, 0.95, 0.15, 0.05, 0.8, 0], F(0.08, 0.8), F(0.072, 0.745), F(0.045, 0.705), F(0, 0.69)];
    const loop = [...guess, ...guess.slice(1, -1).reverse().map(([x, y, z, cx, cy, cz]) => [-x, y, z, cx === undefined ? undefined : -cx, cy, cz])];
    const pts = onBody(loop, 32, 0.0152, true), chest = at("chest"), beads = [];
    pts.forEach(({ p }, i) => { const nx = pts[(i + 1) % pts.length].p.clone().sub(pts[(i - 1 + pts.length) % pts.length].p).normalize(), r = 0.0122 * (0.96 + 0.08 * Math.abs(Math.sin(i * 7.3)));
      beads.push(new THREE.SphereGeometry(r, 9, 6).scale(1, 0.84, 1).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, nx)).translate(p.x - chest.x, p.y - chest.y, p.z - chest.z)); });
    rigid(mergeGeometries(beads), beadM, B.chest);
  }
  // The hat: a shallow cone of plaited bamboo with a bound rim and a small finial, carried on his back, hollow to him.
  let hat;
  {
    const prof = [[0, 0.124], [0.006, 0.122], [0.01, 0.116], [0.0125, 0.109], [0.016, 0.104]];
    for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push([0.016 + 0.154 * t, 0.102 * (1 - t) + 0.006 * Math.sin(Math.PI * t) + 0.002]); }
    prof.push([0.1735, 0], [0.17, -0.004]);
    for (let i = 14; i >= 0; i--) { const t = i / 14; prof.push([0.012 + 0.153 * t, 0.098 * (1 - t) + 0.006 * Math.sin(Math.PI * t) - 0.003]); }
    const parts = [paint(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48), new THREE.Color(1, 1, 1)), paint(new THREE.TorusGeometry(0.1725, 0.0055, 6, 48).rotateX(Math.PI / 2), new THREE.Color(0.8, 0.78, 0.74))];
    for (let k = 0; k < 18; k++) { const a = (TAU * k) / 18; parts.push(paint(new THREE.BoxGeometry(0.011, 0.016, 0.017).translate(0.1725, 0, 0).rotateY(a), PAL.tie)); }
    const g = mergeGeometries(parts.map((q) => { q.deleteAttribute("normal"); q.computeVertexNormals(); return q; })).rotateX(-(Math.PI / 2 - 0.1)).translate(0, -0.16, -0.02);
    const tex = straw();
    hat = rigid(g, new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 1.2, roughness: 0.8, vertexColors: true, side: THREE.DoubleSide, envMapIntensity: 0.35 }), B.hat);
  }

  // He casts no real shadow (the shadow map is drawn once, for the buildings); a soft dark patch goes with him.
  const [pc, px] = canvas(64, 64), gr = px.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); px.fillStyle = gr; px.fillRect(0, 0, 64, 64);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  patch.position.y = 0.03; group.add(patch);
  const sun = { az: 0, len: 1, op: 1 };
  // Seated, his legs are folded under the robe: what shows is a lap of cloth spreading round him.
  const lapGeo = mergeGeometries([new THREE.SphereGeometry(0.3, 24, 12).scale(1.12, 0.36, 0.95).translate(0, 0.1, 0.06), new THREE.SphereGeometry(0.13, 14, 10).scale(1.2, 0.7, 1.3).translate(-0.2, 0.1, 0.2), new THREE.SphereGeometry(0.13, 14, 10).scale(1.2, 0.7, 1.3).translate(0.2, 0.1, 0.2)]);
  const lap = rigid(paint(lapGeo, PAL.robe), clothM, group); lap.visible = false;

  // ---- What the pose is computed from ----
  const rest = bones.map((b) => [b.position.clone(), b.quaternion.clone()]);
  const springs = { trail: spring(), side: spring(), tailX: spring(60, 7), tailZ: spring(60, 7), hatX: spring(55, 6), hatZ: spring(55, 6) };
  let phase = 0, gait = 0, palms = 0, seat = 0, lastYaw = null, lastSpeed = 0, turn = 0, accel = 0, drop = 0, bodyHeight = null;
  const footY = [null, null], hemScale = [1, 1, 1, 1], targets = [V3(), V3()];
  const gq = new THREE.Quaternion(), tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  const tv = V3(), tv2 = V3(), _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _t = V3(), _p = V3(), _d = V3(), _k = V3(), _u = V3(), _x = V3(), _y = V3(), _z = V3();
  // Two bones reaching for a point: `target` in the world, `pole` a world direction the middle joint should point
  // toward; `sign` +1 for a knee (the lower bone folds back), -1 for an elbow (it folds forward).
  function reach(upper, lower, L1, L2, target, pole, sign) {
    upper.parent.updateWorldMatrix(true, false); _inv.copy(upper.parent.matrixWorld).invert();
    _t.copy(target).applyMatrix4(_inv); _p.copy(pole).transformDirection(_inv);
    _d.subVectors(_t, upper.position); const dist = clamp(_d.length(), Math.abs(L1 - L2) + 1e-4, (L1 + L2) * 0.9995); _d.normalize();
    const a = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1)), bend = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
    _k.copy(_p).addScaledVector(_d, -_p.dot(_d)); if (_k.lengthSq() < 1e-10) _k.set(0, 0, 1).addScaledVector(_d, -_d.z); _k.normalize();
    _u.copy(_d).multiplyScalar(Math.cos(a)).addScaledVector(_k, Math.sin(a));
    _y.copy(_u).negate(); _z.copy(_k).addScaledVector(_u, -_k.dot(_u)).normalize().multiplyScalar(sign); _x.crossVectors(_y, _z);
    upper.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
    lower.quaternion.setFromAxisAngle(XV, sign * bend);
  }
  // The hands' own frame for a pose, in the frame of the bone they are placed against.
  function handFrame(lap, s, out) {
    if (lap) { _z.set(0, 1, 0); _y.set(s, 0, -0.3).normalize(); }   // palms up in the lap, fingers in toward each other
    else { _y.set(0, -Math.cos(0.22), -Math.sin(0.22)); _z.set(-s, 0, 0); }   // fingers up and a little forward, palm to palm
    _x.crossVectors(_y, _z).normalize(); _z.crossVectors(_x, _y);
    return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
  }
  // The skirt is lifted off any step it would pass into: its bones are shortened, never more than the cloth needs.
  const rp = robe.geometry.attributes.position.array, rsi = robe.geometry.attributes.skinIndex.array, rsw = robe.geometry.attributes.skinWeight.array;
  const SK = SKIRT.map((n) => IDX[n]), hem = [];
  for (let i = 0; i < torsoCount; i++) {
    const y = rp[i * 3 + 1]; if (y > 0.5) continue;
    const w = []; let W = 0; for (let k = 0; k < 4; k++) { const b = SK.indexOf(rsi[i * 4 + k]); if (b >= 0 && rsw[i * 4 + k] > 0) { w.push([b, rsw[i * 4 + k]]); W += rsw[i * 4 + k]; } }
    if (W > 0.05) hem.push({ i, drop: Math.max(0.05, 0.6 - y), w, W });
  }
  const mats = bones.map(() => new THREE.Matrix4()), hemBones = [IDX.hips, ...SK];
  const skinPoint = (i, out) => {
    const x = rp[i * 3], y = rp[i * 3 + 1], z = rp[i * 3 + 2]; out.set(0, 0, 0);
    for (let k = 0; k < 4; k++) { const w = rsw[i * 4 + k]; if (!w) continue; const e = mats[rsi[i * 4 + k]].elements; out.x += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); out.y += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); out.z += w * (e[2] * x + e[6] * y + e[10] * z + e[14]); }
    return out;
  };
  function liftHem(surfaceAt, dt) {
    for (let b = 0; b < 4; b++) { hemScale[b] = dt > 0 ? damp(hemScale[b], 1, 4, dt) : 1; B[SKIRT[b]].scale.y *= hemScale[b]; }
    group.updateMatrixWorld(true);
    let high = -Infinity; for (let k = 0; k < 16; k++) { tv.set(Math.sin((k * TAU) / 16) * 0.21, 0, Math.cos((k * TAU) / 16) * 0.21); group.localToWorld(tv); high = Math.max(high, surfaceAt(tv.x, tv.z)); }
    if (high < B.robeFront.getWorldPosition(tv).y - 0.42) return;   // nothing near the hem to clear
    for (let it = 0; it < 3; it++) {
      B.hips.updateMatrixWorld(true); for (const b of hemBones) mats[b].multiplyMatrices(bones[b].matrixWorld, skeleton.boneInverses[b]);
      const need = [0, 0, 0, 0]; let any = false;
      for (const h of hem) { skinPoint(h.i, tv); const L = surfaceAt(tv.x, tv.z) + 0.007 - tv.y; if (L <= 0) continue; any = true; for (const [b] of h.w) need[b] = Math.max(need[b], L / (h.drop * h.W)); }
      if (!any) break;
      for (let b = 0; b < 4; b++) if (need[b] > 0) { const sc = B[SKIRT[b]].scale, y = Math.max(0.3, sc.y - need[b] * 1.05); hemScale[b] *= y / sc.y; sc.y = y; }
    }
    B.hips.updateMatrixWorld(true);
  }

  return {
    group, skeleton, bones: B, parts: { skin, robe, legs, shoes, hat },
    // Where the light comes from (a direction toward it) and how strong it is, 0..1: his shadow lies away from it,
    // long when it is low.
    setSun(dir, strength) { const flat = Math.hypot(dir.x, dir.z) || 1e-3; sun.az = Math.atan2(-dir.x, -dir.z); sun.len = Math.min(3.4, Math.max(1, flat / Math.max(dir.y, 0.12))); sun.op = 0.35 + 0.65 * Math.min(1, strength); },
    // `speed` in metres a second. `pose`: false to stand or walk, true or "pray" for palms together, "sit" to sit with
    // legs folded, "hop" in the air, "bind" for the A-pose he is bound in. `surfaceAt(x, z)` is the ground under a
    // point; `grounding.heightAt` the smooth height his body follows, `grounding.stairs` whether he is on a stair.
    update(dt, speed, pose, t, surfaceAt, grounding = {}) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1); speed = Math.max(0, speed || 0);
      bones.forEach((b, i) => { b.position.copy(rest[i][0]); b.quaternion.copy(rest[i][1]); b.scale.set(1, 1, 1); });
      if (pose === "bind") { legs.visible = shoes.visible = true; lap.visible = false; group.updateMatrixWorld(true); return; }
      const pray = pose === true || pose === "pray", sit = pose === "sit", hop = pose === "hop", stairs = !!grounding.stairs, ease = (k) => Math.min(1, dt * k);
      seat += ((sit ? 1 : 0) - seat) * ease(3.5);
      gait += ((speed > 0.05 && !sit ? 1 : 0) - gait) * ease(8);
      palms += ((pray ? 1 : 0) - palms) * ease(4);
      // How fast he turns and speeds up: what swings the cloth.
      const yaw = group.rotation.y; let dyaw = lastYaw === null ? 0 : yaw - lastYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); lastYaw = yaw;
      if (dt > 0) { turn = damp(turn, dyaw / dt, 8, dt); accel = damp(accel, (speed - lastSpeed) / dt, 6, dt); } lastSpeed = speed;
      // The stride: short steps for short legs; on a stair, a step to each tread.
      const A = stairs ? STAIR.tread / 2 : clamp(0.07 + 0.055 * speed, 0.07, 0.19), rate = stairs ? Math.PI / STAIR.tread : (0.8 * Math.PI) / (2 * A);
      phase += dt * Math.max(speed, 0.4 * gait) * rate;
      const step = [0, Math.PI].map((o) => { const u = ((((phase + o) / TAU) % 1) + 1) % 1; if (u < 0.5) return { off: A * (1 - 4 * u), lift: 0 }; const w = (u - 0.5) * 2; return { off: A * (2 * smooth(0, 1, w) - 1), lift: Math.sin(Math.PI * w) }; });
      const lead = step.map((s) => (s.off / A) * gait), breathe = Math.sin(t * 1.6);

      // His body follows a smooth height over the steps, which the root bone carries; the shoes find each tread.
      group.updateWorldMatrix(true, false); group.getWorldQuaternion(gq);
      const rootY = group.matrixWorld.elements[13];
      let lift = 0;
      if (surfaceAt && seat < 0.01 && !hop) {
        const want = grounding.heightAt ? grounding.heightAt(group.position.x, group.position.z) : rootY;
        bodyHeight = bodyHeight === null || Math.abs(want - bodyHeight) > 1.2 ? want : damp(bodyHeight, want, 18, dt);
        lift = clamp(bodyHeight - rootY, -0.35, 0.2);
      } else bodyHeight = rootY;
      B.root.position.y = lift - 0.37 * seat + Math.sin(t * 0.9) * 0.006 * seat;

      // The spine, posed directly: the pelvis turns with the leading leg, the chest against it; he leans into his walk,
      // bows to pray, and otherwise carries his face a little up.
      const twist = -0.045 * (lead[0] - lead[1]);
      B.hips.position.y += 0.0025 * breathe * (1 - gait);
      B.hips.rotation.set(0, twist, 0.022 * Math.sin(phase) * gait);
      B.spine.rotation.set(0.025 * gait + 0.04 * palms + 0.04 * seat, -twist * 0.5, 0);
      B.chest.rotation.set(0.03 * gait + 0.05 * palms + 0.006 * breathe, -twist * 0.9, -0.012 * Math.sin(phase) * gait);
      B.neck.rotation.x = -0.03 * gait;
      B.head.rotation.set(-0.06 * (1 - palms) * (1 - seat) + 0.2 * palms + 0.14 * seat + 0.015 * Math.sin(phase * 2) * gait, twist * 0.4, -0.018 * Math.sin(phase) * gait);

      // The legs reach for the ground under each shoe.
      const legsShown = seat < 0.45, thigh = [0, 0];
      legs.visible = shoes.visible = legsShown;
      if (hop) {
        SIDES.forEach(([n], i) => { B[n + "UpperLeg"].rotation.x = -0.55 - 0.1 * i; B[n + "LowerLeg"].rotation.x = 1.0; B[n + "Foot"].rotation.x = -0.4; thigh[i] = 0.6 + 0.1 * i; });
      } else if (legsShown) {
        group.updateMatrixWorld(true);
        SIDES.forEach(([, s], i) => {
          tv.set(s * FOOT_X, 0, FOOT_Z + step[i].off * gait);
          let ground = -Infinity;
          for (const pr of PROBES) { tv2.copy(pr).applyAxisAngle(UPV, s * TOE_OUT).add(tv); tv2.y = 0; group.localToWorld(tv2); ground = Math.max(ground, surfaceAt ? surfaceAt(tv2.x, tv2.z) : rootY); }
          if (footY[i] !== null && Math.abs(footY[i] - ground) < 0.6 && dt > 0) ground = Math.max(ground, damp(footY[i], ground, 16, dt));   // down a step gently, never through it
          footY[i] = ground;
          group.localToWorld(targets[i].copy(tv)); targets[i].y = ground + ANKLE + step[i].lift * gait * (stairs ? 0.075 : 0.05);
        });
        // The pelvis comes down when a foot could not otherwise reach its ground.
        let need = 0;
        SIDES.forEach(([n], i) => { const hip = B[n + "UpperLeg"].getWorldPosition(tv), h = Math.hypot(targets[i].x - hip.x, targets[i].z - hip.z), L = (THIGH + SHIN) * 0.992; need = Math.max(need, hip.y - targets[i].y - Math.sqrt(Math.max(0, L * L - h * h))); });
        drop = dt > 0 ? Math.max(need, damp(drop, need, 10, dt)) : need;
        B.hips.position.y -= Math.max(0, drop);
        B.hips.updateMatrixWorld(true);
        SIDES.forEach(([n, s], i) => {
          const up = B[n + "UpperLeg"], lo = B[n + "LowerLeg"], ft = B[n + "Foot"];
          reach(up, lo, THIGH, SHIN, targets[i], tv2.set(s * 0.15, 0, 1).applyQuaternion(gq), 1);
          up.updateMatrixWorld(true); lo.getWorldQuaternion(tq);
          tq2.setFromAxisAngle(UPV, s * TOE_OUT).premultiply(gq);   // the sole flat, the toes a little out
          ft.quaternion.copy(tq.invert().multiply(tq2));
          tv.set(0, -1, 0).applyQuaternion(up.quaternion); thigh[i] = Math.atan2(tv.z, -tv.y);
        });
      }

      // The arms hang a little out from his sides and swing against the legs; to pray, or seated, they reach.
      SIDES.forEach(([n, s], i) => {
        const ua = B[n + "UpperArm"], la = B[n + "LowerArm"], hd = B[n + "Hand"], swing = -lead[i] * 0.32;
        ua.rotation.set(-swing, 0, s * (0.27 - 0.03 * gait)); la.rotation.set(-(0.22 + 0.35 * Math.max(0, swing)), -s * 1.15, 0); hd.rotation.set(-0.1, 0, s * 0.05);
        if (hop) { ua.rotation.set(-0.3, 0, s * 0.62); la.rotation.set(-0.5, -s * 1.15, 0); }
        const w = Math.max(palms, seat);
        if (w < 0.001) return;
        q0.copy(ua.quaternion); q1.copy(la.quaternion); q2.copy(hd.quaternion);
        const inLap = seat >= palms, anchor = inLap ? B.hips : B.chest;
        group.updateMatrixWorld(true);
        anchor.localToWorld(tv.set(inLap ? s * 0.05 : s * 0.0125, inLap ? 0.055 : 0.02, inLap ? 0.13 : 0.165));
        reach(ua, la, UPPER, FORE, tv, tv2.set(s, inLap ? -0.2 : -1.3, inLap ? -0.6 : -0.35).applyQuaternion(gq), -1);
        ua.updateMatrixWorld(true);
        anchor.getWorldQuaternion(tq).multiply(handFrame(inLap, s, tq2));
        la.getWorldQuaternion(qa); hd.quaternion.copy(qa.invert().multiply(tq));
        qa.copy(ua.quaternion); qb.copy(la.quaternion); qc.copy(hd.quaternion);
        ua.quaternion.slerpQuaternions(q0, qa, w); la.quaternion.slerpQuaternions(q1, qb, w); hd.quaternion.slerpQuaternions(q2, qc, w);
      });

      // What hangs off him swings: the skirt trails his walk and is pushed by his knees, flares as he turns; the sash's
      // ends and the hat lag on their springs.
      const tr = springs.trail.step(clamp(0.05 * speed + 0.03 * accel, -0.15, 0.25) * (1 - seat), dt);
      const sd = springs.side.step(clamp(-0.07 * turn * Math.min(1, speed + 0.3), -0.2, 0.2) + 0.02 * Math.sin(phase) * gait, dt);
      const fwd = Math.max(0, thigh[0], thigh[1]), back = Math.max(0, -thigh[0], -thigh[1]);
      B.robeFront.rotation.set(tr - 0.9 * fwd - 0.9 * seat, 0, sd);
      B.robeBack.rotation.set(tr + 0.7 * back + 0.5 * seat, 0, sd);
      // each side of the skirt goes with the knee on that side, forward as far as the front does, and a little out
      B.robeLeft.rotation.set(tr - 0.9 * Math.max(0, thigh[0]) + 0.6 * Math.max(0, -thigh[0]), 0, sd + 0.015 + 0.2 * Math.max(0, thigh[0]) + 0.5 * seat);
      B.robeRight.rotation.set(tr - 0.9 * Math.max(0, thigh[1]) + 0.6 * Math.max(0, -thigh[1]), 0, sd - 0.015 - 0.2 * Math.max(0, thigh[1]) - 0.5 * seat);
      for (const n of SKIRT) B[n].scale.y = 1 - 0.55 * seat;
      B.sashTail.rotation.set(B.robeFront.rotation.x + springs.tailX.step(0.07 * speed + 0.05 * Math.abs(Math.sin(phase)) * gait, dt), 0, springs.tailZ.step(0.09 * Math.sin(phase) * gait + sd, dt));
      B.hat.rotation.set(Math.max(-0.02, springs.hatX.step(0.04 * gait * Math.abs(Math.cos(phase)) + 0.02 * gait - 0.01 * accel, dt)), 0, springs.hatZ.step(0.05 * Math.sin(phase) * gait - 0.05 * turn, dt));
      if (surfaceAt && seat < 0.01 && !hop) liftHem(surfaceAt, dt);

      lap.visible = seat > 0.3; lap.scale.setScalar(Math.min(1, seat * 1.2));
      // The shadow keeps to the ground and to the sun, whichever way he turns.
      const a = sun.az - group.rotation.y, off = (sun.len - 1) * 0.42;
      patch.rotation.y = a; patch.scale.set(1, 1, sun.len); patch.position.set(Math.sin(a) * off, 0.03, Math.cos(a) * off); patch.material.opacity = sun.op;
      group.updateMatrixWorld(true);
    },
  };
}
