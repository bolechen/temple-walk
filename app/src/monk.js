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
import * as THREE from "three";
import { STAIR } from "./geo.js";
import { createBlink, mulberry32 } from "./blink.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// A shoe in the air between two stair heights: `y0` the tread it left, `y1` the one it will come down on, `w` how far on
// its way it is (0..1), `here` the tread under it now. Returns the height of its toe and heel line and its pitch (+ toe down).
export function swingOnStair(y0, y1, w, here) {
  const G = STAIRGAIT, d = y1 - y0, arc = Math.sin(Math.PI * w);
  if (d > G.kind) return { y: Math.max(y0 + d * smooth(0, G.upBy, w) + G.upClear * arc, here), pitch: -G.upToe * arc };
  if (d < -G.kind) return { y: Math.max(y0 + d * smooth(G.downFrom, G.downTo, w) + G.downClear * arc, here), pitch: G.downToe * smooth(G.downFrom, 0.7, w) * (1 - smooth(0.8, 1, w)) };
  return { y: Math.max(y0 + G.flat * arc, here), pitch: 0 };
}
// How much of his weight a shoe carries, 0..1, at `u` of its stride (0 as it comes down, 0.5 as it lifts): the pelvis goes
// from one foot's height to the other's across the whole step, reaching the landing foot's just as it comes down, so the
// two feet's loads always add to one.
export function loadOf(u) { return u < 0.5 ? 1 - smooth(0, 0.5, u) : smooth(0.5, 1, u); }
const sq = (v) => v * v, clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp, TAU = Math.PI * 2;
const col = (hex) => new THREE.Color(hex);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const XV = V3(1, 0, 0), UPV = V3(0, 1, 0), ZV = V3(0, 0, 1);

// His measure, in metres: 1.18 tall, 4.55 heads tall (refs/monk-sheet-v6-2026-11-22-eyes-closed.webp, #642), arms bound 38° from his sides.
const APOSE = 0.66, UPPER = 0.2, FORE = 0.15, THIGH = 0.22, SHIN = 0.22, ANKLE = 0.06;
const LEG = THIGH + SHIN;
// How a shoe goes over the steps (issue #270), in his own measure so that another body keeps it. Up, the foot is lifted
// early and comes over the nosing a finger above it, toe up; down, it goes forward at the height of the tread it leaves and
// only then lets itself down onto the one below, toe first (a foot lifted on the way down is what read as a high knee).
// Where the pelvis stands is decided by the feet that bear him, not by the slope.
export const STAIRGAIT = { upBy: 0.42, upClear: 0.034 * LEG, upToe: 0.2, downFrom: 0.35, downTo: 0.95, downClear: 0.008 * LEG, downToe: 0.35, flat: 0.09 * LEG, kind: 0.08 * LEG, sag: 0.1 * LEG, upFollow: 0.5, toeLen: 0.117, heelLen: 0.072 };
// Seated on a cushion his shadow lies this far below the seat, on the floor the cushion (geo.js CUSHION, 0.104 m) stands on.
const SHADOW_SIT = 0.13;
const SIT_DROP = 0.41;   // seated on a stool, how far he comes down: his hip joints about 9 cm above the seat
// Cross-legged on a cushion he sits a little deeper, his hip joints about 6 cm over its crown: the design sheet's seated
// figure is 2.7 heads from the cushion to his crown (#664), and a cushion gives under him.
const CUSHION_DROP = 0.44;
// Seated on a cushion, the sleeves (#664): how far the cuff is drawn up the arm on the side the forearm leaves by (`cut`),
// how far it hangs on past the elbow behind it (`hang`) and at the two sides between (`side`), and how much wider it opens.
// Sitting down on a cushion, by how far he has come down (0 standing, 1 seated): the skirt's bones stop following his
// knees at once (`KNEE_FADE`), the robe spreads into its seated lap (`DRAPE`) ahead of the legs folding out under it
// (`LEG_FOLD`), so that at every frame the knees are under cloth. Folded on one schedule, the knees stood out of the
// front of the robe for a few frames, as high as his hands (the first art review of #680).
const KNEE_FADE = [0, 0.25], LEG_FOLD = [0.25, 0.9], DRAPE = [0.05, 0.7];
export const SLEEVE_SIT = { cut: 0.07, hang: 0.055, side: 0.012, open: 0.05, round: 0.8, bevel: 0.45 };
// Seated on a cushion, where his folded legs lie (#664, refs/monk-poses-v6-2026-11-23-sitting.webp), in the seat's frame:
// x to his left, y up from the cushion's crown, z the way he faces, his hips over the origin (the cushion's middle is
// `back` before them). The knees are out to the
// sides and forward, about as high as the hips; the shins come in before him, the left in front of the right, and the
// feet lie on past the ankles. `r` is how thick each part is under the cloth (trousers and robe together), which is what
// the robe is draped over (`lapTop`): the lap is made by the legs, and the hands are laid on it.
export const SEAT_LEGS = {
  hip: [0.086, 0.06, 0], knee: [0.179, 0.083, 0.18], ankle: { left: [0, 0.062, 0.255], right: [0.01, 0.064, 0.222] },
  r: { hip: 0.084, knee: 0.08, ankle: 0.054, foot: 0.046 }, footLen: 0.1, tuck: 0.3,
  // He sits back on the cushion, as the sheet has him: his hips this far behind its middle, so that the lap lies over
  // the middle of it and its hem reaches the rim before him and at the knees, and stops short of it behind.
  back: 0.05,
};
/** The folded legs as tapered rods, [from, to, radius at each end], in the seat's frame. */
const rodsOf = () => {
  const L = SEAT_LEGS, out = [];
  for (const [n, s] of /** @type {[string, number][]} */ ([["left", 1], ["right", -1]])) {
    const hip = [s * L.hip[0], L.hip[1], L.hip[2]], knee = [s * L.knee[0], L.knee[1], L.knee[2]], ank = L.ankle[n];
    // the joints as the skeleton will have them: each bone its own length along the way given
    const along = (a, b, len) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d); return a.map((v, i) => v + (d[i] / l) * len); };
    const K = along(hip, knee, THIGH), A = along(K, ank, SHIN), T = [A[0] - s * L.footLen, A[1] - 0.008, A[2] + 0.012];
    out.push({ n, s, hip, knee: K, ankle: A, toe: T, rods: [[hip, K, L.r.hip, L.r.knee], [K, A, L.r.knee, L.r.ankle], [A, T, L.r.foot, L.r.foot * 0.9]] });
  }
  return out;
};
let seatRods = rodsOf();
// Cloth over a rod of radius r, at a distance d to the side of its middle line: round over the top, then falling away
// at the slope it has where the round is left (LAP.cap of the radius out), as cloth hangs from a knee.
export const LAP = { cap: 0.9, sharp: 95, belly: 10, back: 11, pool: 0.034, tail: 0.03, lie: 0.02, thick: 0.004, taut: 0.6, hollow: 0.9, droop: 0.012, trail: 0.018, hem: 0.008, roll: 0.005, press: 0.03, sitFrom: 0.1, sitTo: 0.9, soft: 4 };
const overRod = (d, r) => { const c = LAP.cap, e = c * r; return d < e ? Math.sqrt(r * r - d * d) : r * Math.sqrt(1 - c * c) - (c / Math.sqrt(1 - c * c)) * (d - e); };
/** How high the folded legs hold the cloth at a point of the seat's frame (above the cushion's crown); far from them it falls below any floor. */
export function legsTop(x, z) {
  let sum = 0;
  for (const leg of seatRods) for (const [a, b, ra, rb] of leg.rods) {
    const dx = b[0] - a[0], dz = b[2] - a[2], t = clamp(((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t), h = a[1] + (b[1] - a[1]) * t + overRod(d, ra + (rb - ra) * t);
    sum += Math.exp(LAP.sharp * h);
  }
  return Math.log(sum) / LAP.sharp;
}
// The cushion's top, as a height above its crown, at a distance from its middle (geo.js CUSHION, held by monk.test);
// past its rim the cloth hangs a little way down its side.
const cushionTop = (r) => r <= 0.1 ? 0 : r <= 0.262 ? -0.012 * (r - 0.1) / 0.162 : -0.012 - LAP.droop * smooth(0.262, 0.3, r);
/** The lap: how high the robe lies at a point before him or beside him, over his legs or on the cushion (the seat's frame). */
const cushionAt = (x, z) => cushionTop(Math.hypot(x, z - SEAT_LEGS.back));
export function lapTop(x, z) { return Math.max(cushionAt(x, z) + LAP.thick, legsTop(x, z)); }
// Seated on a cushion, the hands in the lap (#664; refs/monk-poses-v6-2026-11-23-sitting.webp; the owner's photograph of
// the meditation seal, 2026-11-25): palms up against his belly, the right below and the left lying on it (`stack` higher,
// its fingers over the right's), each palm's middle `x` to its own side and `z` before his hips, the fingers running in
// toward the other hand and `out` forward; the thumbs rise from the far edge of the palms and meet over the middle,
// `thumb.up` over the left palm and `thumb.fwd` before the palms' middle (each rising to `arch` of that height within
// `turn` of its way in), so that thumbs and fingers close round an open oval. How high the hands lie is not written here: they are let down onto the cloth as the lap has it
// (`layHands`), each lying no steeper than `tip`. In the lap the hands are drawn `big` times their standing size and
// plump (the sheet's are a small child's mitts), `x` being where the middle of each hand's length lies: the two lie
// deep over each other, the left's fingers on the right's fingers and palm, so that from before him there is little
// more than one hand's width to see. `elbow` is the way the elbows are drawn.
// The two thumbs are one even arch (the first art review of #680 found the left a level bar and the right a hook, since
// the left hand lies higher): each leaves its own palm at `thumb.root` above or below the palm's middle, leans `lean` of
// the way forward to the meeting place before it turns in, and the tips' middles lie `gap` to either side of the
// middle, just touching. The wrist's ball is pressed to `wrist` of its thickness, as flat as the hand is.
export const LAP_HAND = { x: 0.002, z: 0.1625, out: 0.05, tip: 0.04, stack: 0.019, big: 1.12, elbow: [1, -1, -0.6], thumb: { up: 0.022, fwd: 0.036, gap: 0.008, turn: 0.35, arch: 1.0, thick: 1.25, lean: 0.75, root: { left: -0.006, right: 0.012 } }, wrist: 0.75 };
// A hand lying palm up, as rods along its fingers' way from the wrist's middle: how far along, how thick it is there
// (the wrist's ball, the palm, the knuckles, the fingertips) and how far to either side it reaches.
const HAND_ROD = [[0, 0.027 * LAP_HAND.wrist, 0], [0.03, 0.0118, 0.022], [0.052, 0.0105, 0.018], [0.082, 0.0105, 0.014]].map(([d, r, w], i) => (i ? [d * LAP_HAND.big, r * LAP_HAND.big, w * LAP_HAND.big] : [d, r, w]));
const HAND_MID = 0.045 * LAP_HAND.big;   // from the wrist to the middle of the hand's length
const HAND_SHIFT = [-0.0045, -0.002, 0];   // how the palm and its fingers are set against the wrist's bone (buildHand)
const SKULL = V3(0, 1.049, 0.006), R = 0.131;
// The light under his chin (#664): the skull's normals that look more than `from` downward keep only `keep` of the rest
// of their tilt, and the neck's own colour goes from `low` at the collar to `top` under the jaw, darkening from `from`
// of the way up it.
const JAW = { from: 0.3, keep: 0.35 }, NECK_SHADE = { low: 0.96, top: 0.7, from: 0.3 };
const FOOT_X = 0.09, FOOT_Z = 0.012, TOE_OUT = 0.08;
/** @type {[string, number][]} */
const SIDES = [["left", 1], ["right", -1]];   // he faces +z, so his left hand is on +x
// How far the skirt's bones follow a raised knee (radians of bone turn): freely up to SKIRT_FREE, easing to SKIRT_REACH for
// the front and to SKIRT_SIDE for the side bones, which lie over the knees. Level walking never gets past SKIRT_FREE.
const SKIRT_FREE = 0.5, SKIRT_REACH = 0.7, SKIRT_SIDE = 0.8;
// The back of the skirt swings lightly: what walking turns it by (the trail and the trailing knee together) is free up to
// the first and eased to the second, whatever the stride. Level walking turns it by no more than 0.14.
const SKIRT_BACK_FREE = 0.25, SKIRT_BACK_REACH = 0.4;
// The turn at the start of a walk (#284): the page turns him about at once and his speed rises, which would swing the whole
// skirt sideways by 0.2 rad and push the trail back by 0.25, opening the cloth over a thigh (the trousers came out of the robe's
// side for the first half second). The sideways swing is cut to SKIRT_SWING and the side panels, which lie over the thighs,
// take only SKIRT_SIDE_SWING of it; the trail's acceleration part is held to SKIRT_TRAIL.
const SKIRT_SWING = 0.05, SKIRT_SIDE_SWING = 0.25, SKIRT_TRAIL = 0.15;
const SKIRT = ["robeFront", "robeLeft", "robeBack", "robeRight"];
// Under each sole, the points that must clear the ground (in the foot's own frame, on the floor).
const PROBES = [[0.055, -0.072], [-0.055, -0.072], [0.055, 0.11], [-0.055, 0.11], [0, 0.112], [0, -0.073]].map(([x, z]) => V3(x, 0, z));

// v6 colour palette (refs/monk-sheet-v6-2026-11-22-eyes-closed.webp & docs/t00/novice-v6-brief.md), calibrated for T00 courtyard light (#642).
const PAL = {
  skin: col(0xf0c7a7), crown: col(0xf4d1b4), blush: col(0xe48e7e), lip: col(0x8e4b3a), brow: col(0x543320), lash: col(0x362014), earIn: col(0xdca486),
  robe: col(0xa96243), robeIn: col(0x64331e), band: col(0x985538), sash: col(0x905034), collar: col(0xe2d2ba),
  trousers: col(0x7c5b43), wrap: col(0xe0d1b8), shoe: col(0x523e30), sole: col(0xd4c1a5), strap: col(0xcab698), tie: col(0x8c6438),
};

// ---- Cloth and bamboo, painted once ----
/** @returns {[HTMLCanvasElement, CanvasRenderingContext2D]} */
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function linen(createRnd) {   // soft matte cotton/felt micro-grain matching the v6 soft-clay finish (#642)
  const [c, x] = canvas(256, 256), rnd = createRnd ? createRnd(0x11e4) : Math.random;   // (the trailer seeds it: the same cloth every time, #610)
  x.fillStyle = "#f7f5f2"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    x.fillStyle = `rgba(255,255,255,${0.035 + rnd() * 0.045})`; x.fillRect(i, 0, 1, 256);
    x.fillStyle = `rgba(70,50,35,${0.02 + rnd() * 0.035})`; x.fillRect(0, i, 256, 1);
  }
  for (let i = 0; i < 420; i++) {
    const rad = 1 + rnd() * 2.5;
    x.fillStyle = rnd() < 0.5 ? `rgba(255,250,245,${0.025 + rnd() * 0.035})` : `rgba(60,40,24,${0.02 + rnd() * 0.03})`;
    x.fillRect(rnd() * 256, rnd() * 256, rad * (1 + rnd() * 2), rad);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function straw() {   // split bamboo woven in concentric rings with 24 radial ribs converging to the crown (refs/monk-props-v6)
  const W = 512, H = 256, [c, x] = canvas(W, H), spokes = 24, rings = 22;
  x.fillStyle = "#c88d52"; x.fillRect(0, 0, W, H);
  const rh = H / rings, sw = W / spokes;
  for (let r = 0; r < rings; r++) {
    const y = r * rh;
    for (let s = 0; s < spokes; s++) {
      const h = Math.abs(Math.sin(r * 19.31 + s * 7.13) * 43758.5453) % 1;
      const lum = 0.93 + h * 0.14;
      const cr = Math.min(255, Math.round(213 * lum)), cg = Math.min(255, Math.round(154 * lum)), cb = Math.min(255, Math.round(96 * lum));
      x.fillStyle = `rgb(${cr},${cg},${cb})`;
      x.fillRect(s * sw, y + 1, sw, rh - 2);
      // fine parallel bamboo splints within each ring
      x.fillStyle = "rgba(110,72,34,0.16)";
      x.fillRect(s * sw, y + rh * 0.35, sw, 1);
      x.fillRect(s * sw, y + rh * 0.68, sw, 1);
    }
    // dark weave seam between concentric rings
    x.fillStyle = "rgba(96,60,26,0.34)";
    x.fillRect(0, y, W, 1.5);
  }
  // 24 radial bamboo ribs running from apex (v=0) to rim (v=1)
  for (let s = 0; s < spokes; s++) {
    const sx = s * sw;
    x.fillStyle = "rgba(92,58,24,0.38)";
    x.fillRect(sx - 2, 0, 4.5, H);
    x.fillStyle = "rgba(232,182,122,0.85)";
    x.fillRect(sx - 1, 0, 2.2, H);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
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
// A capsule from one point to another, of radius r (points as [x, y, z]).
function seg(a, b, r) {
  const A = V3(...a), d = V3(...b).sub(A), l = d.length();
  return new THREE.CapsuleGeometry(r, l, 4, 8).translate(0, l / 2, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize())).translate(A.x, A.y, A.z);
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

// ---- The robe's body, as half-widths (across), depths (front to back) and z-centre at each height (refs/monk-v6-ortho) ----
const PROF = new THREE.CatmullRomCurve3([
  [0.192, 0.277], [0.186, 0.315], [0.174, 0.37], [0.158, 0.44], [0.141, 0.51], [0.123, 0.58], [0.111, 0.625],
  [0.105, 0.658], [0.111, 0.695], [0.12, 0.745], [0.126, 0.79], [0.118, 0.822], [0.095, 0.846], [0.068, 0.866], [0.056, 0.876],
].map(([r, y]) => V3(r, y, 0)), false, "centripetal").getPoints(42);
const rxAt = (y) => { if (y <= PROF[0].y) return PROF[0].x; for (let i = 1; i < PROF.length; i++) if (PROF[i].y >= y) { const a = PROF[i - 1], b = PROF[i]; return a.x + (b.x - a.x) * ((y - a.y) / (b.y - a.y || 1)); } return PROF[PROF.length - 1].x; };
const DEPTH = [[0.277, 0.865], [0.42, 0.905], [0.56, 0.96], [0.658, 1.07], [0.74, 0.94], [0.80, 0.76], [0.845, 0.78], [0.876, 0.88]];
const depthAt = (y) => { if (y <= DEPTH[0][0]) return DEPTH[0][1]; for (let i = 1; i < DEPTH.length; i++) if (DEPTH[i][0] >= y) { const [y0, d0] = DEPTH[i - 1], [y1, d1] = DEPTH[i]; return d0 + (d1 - d0) * smooth(y0, y1, y); } return DEPTH[DEPTH.length - 1][1]; };
const zOffAt = (y) => 0.008 * smooth(0.28, 0.58, y) * smooth(0.87, 0.76, y) + 0.004 * smooth(0.277, 0.45, y);
const belly = (y) => 0.008 * Math.exp(-sq((y - 0.66) / 0.08));   // soft child front
const rzAt = (y, c) => rxAt(y) * depthAt(y) + belly(y) * smooth(-0.3, 0.6, c);
const inBody = (x, y, z) => { if (y < 0.277 || y > 0.876) return 9; const zo = z - zOffAt(y), r = Math.hypot(x, zo) || 1e-9; return Math.hypot(x / rxAt(y), zo / rzAt(y, zo / r)); };
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
  const pts = guesses.map(([x, y, z, cx = 0, cy = y, cz = zOffAt(y)]) => toBody(V3(x, y, z), V3(cx, cy, cz)));
  let s = new THREE.CatmullRomCurve3(pts, closed, "centripetal").getSpacedPoints(count);
  if (closed) s = s.slice(0, -1);
  return s.map((p) => { const n = bodyNormal(p), q = toBody(p.clone().addScaledVector(n, 0.06), p.clone().addScaledVector(n, -0.045)), m = bodyNormal(q); return { p: q.addScaledVector(m, lift), n: m }; });
}

// The skull (v6 4.55 heads): smooth soft-clay sphere, gentle chubby lower cheeks, soft rounded chin, full round occiput.
function deform(p) {
  const r = p.length() || 1, n = p.clone().divideScalar(r), u = n.y, front = smooth(-0.4, 0.45, n.z), back = smooth(0.15, -0.55, n.z);
  const cheek = Math.exp(-sq((u + 0.34) / 0.32)) * front;
  const kx = 1.012 + 0.036 * cheek - 0.075 * smooth(-0.74, -1, u);
  const kz = 1.06 + 0.03 * cheek + 0.042 * Math.exp(-sq((u + 0.06) / 0.44)) * back - 0.024 * smooth(0.68, 1, n.z) * (1 - smooth(0.55, 0.9, Math.abs(u))) + 0.055 * Math.exp(-sq((u + 0.68) / 0.25)) * front;
  const ky = 1.0;
  return V3(p.x * kx, p.y * ky, p.z * kz);
}
const onFace = (az, el, lift = 0) => deform(V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(R + lift)).add(SKULL);

const spring = (k = 70, c = 9) => ({ x: 0, v: 0, step(target, dt) { for (let left = dt; left > 1e-6; left -= 1 / 60) { const h = Math.min(left, 1 / 60); this.v += (k * (target - this.x) - c * this.v) * h; this.x += this.v * h; } return this.x; } });

// The hand as one soft mitt (#664: the owner wanted the jointed fingers gone), in the hand's own frame: from the wrist
// along -y to the fingertips, the palm toward +z. `w` is its half width at the palm and `wf` at the fingers, `h` its half
// thickness there and `hf`, `L` its length from `y0`; past `at` of the way the fingers bend up toward the palm by `curl`
// (a curve, so they cup), and across it the edges come up by `cup`. A unit sphere is drawn out into that shape, its
// cross-section kept nearly full to the ends (`full`) so the sides are flat and the ends round. The fingers are closed
// together: `groove` is how deep the lines between them are, `tips` how much further the middle ones reach.
export const HAND_SHAPE = {
  stand: { w: 0.0245, wf: 0.0215, h: 0.0145, hf: 0.0085, L: 0.076, y0: -0.003, at: 0.5, curl: 0.012, cup: 0.0015, full: 0.35, groove: 0.0012, tips: 0.04 },
  lap: { w: 0.0215, wf: 0.0205, h: 0.013, hf: 0.009, L: 0.078, y0: -0.003, at: 0.5, curl: 0.004, cup: 0.004, full: 0.3, groove: 0.003, tips: 0.035, heel: 0.004 },
};
function mitt(M) {
  const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i), rho = Math.hypot(nx, nz), t = (1 - ny) / 2;
    const f = smooth(M.at - 0.1, M.at + 0.2, t), w = M.w + (M.wf - M.w) * f, h = M.h + (M.hf - M.h) * f + (M.heel || 0) * (1 - smooth(0.05, 0.4, t));
    const k = rho > 1e-6 ? Math.pow(rho, M.full) / rho : 0, x = nx * k * w;
    const bend = Math.max(0, t - M.at) / (1 - M.at);
    // the four fingers: closed together, so only shallow grooves between them over the last part, and their tips
    // rounded one by one, the middle two the longest
    const u = x / w, fing = smooth(M.at, M.at + 0.15, t), groove = M.groove * fing * Math.pow(Math.max(0, Math.cos(2 * Math.PI * u)), 3) * (1 - sq(u));
    const tipY = M.L * M.tips * (1 - sq(u)) * smooth(0.82, 1, t) - M.L * 0.02 * Math.abs(Math.sin(2 * Math.PI * u)) * smooth(0.9, 1, t);
    const z = nz * k * (h - groove) + M.curl * bend * bend + M.cup * sq(u) * smooth(0.15, 0.9, t);
    p.setXYZ(i, x, M.y0 - t * M.L - tipY, z);
  }
  g.deleteAttribute("uv"); g.computeVertexNormals(); return weld(g);
}
// A thumb as one tube from its root through the pull of `mid` to its tip, `r0` thick at the root and `r1` at the tip,
// closed with a ball at each end; always the same number of points, so the standing and the lap's can be morphed.
function thumbTube(a, mid, b, r0, r1) {
  const curve = new THREE.QuadraticBezierCurve3(V3(...a), V3(...mid), V3(...b)), pts = curve.getPoints(10);
  const fr = frames(pts, (q, i) => V3(0, 0, 1).cross(curve.getTangent(i / 10)).lengthSq() > 1e-6 ? V3(0, 0, 1) : V3(1, 0, 0));
  fr.forEach((q, i) => { q.k = r0 + (r1 - r0) * (i / 10); });
  const tube = sweep(fr, oval(1, 1, 10)), parts = [tube];
  for (const [q, r] of [[pts[0], r0], [pts[10], r1]]) parts.push(new THREE.SphereGeometry(r, 10, 8).translate(q.x, q.y, q.z));
  return mergeGeometries(parts.map((q) => { q.deleteAttribute("uv"); return q; }));
}

export function createMonk(opts = {}) {
  seatRods = rodsOf();
  // ---- The skeleton, in the A-pose he was drawn in (4.55 heads tall, arms 38°) ----
  const group = new THREE.Group(), bones = [], B = {};
  const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); (parent || group).add(b); bones.push(b); B[name] = b; return b; };
  bone("root", null, 0, 0, 0);
  bone("hips", B.root, 0, 0.53, 0);
  bone("spine", B.hips, 0, 0.08, 0);
  bone("chest", B.spine, 0, 0.11, 0);
  bone("neck", B.chest, 0, 0.146, -0.002);
  bone("head", B.neck, 0, 0.04, 0.004);
  for (const [n, s] of SIDES) {
    bone(n + "Shoulder", B.chest, s * 0.028, 0.088, 0);
    bone(n + "UpperArm", B[n + "Shoulder"], s * 0.048, -0.004, 0).rotation.z = s * APOSE;
    bone(n + "LowerArm", B[n + "UpperArm"], 0, -UPPER, 0);
    bone(n + "Hand", B[n + "LowerArm"], 0, -FORE, 0);
  }
  for (const [n, s] of SIDES) {
    bone(n + "UpperLeg", B.hips, s * 0.086, -0.03, 0);
    bone(n + "LowerLeg", B[n + "UpperLeg"], 0, -THIGH, 0);
    bone(n + "Foot", B[n + "LowerLeg"], 0, -SHIN, 0);
  }
  for (const n of SKIRT) bone(n, B.hips, 0, 0.07, 0);     // the skirt hangs from the waist on four bones (kept at 0.07 for worn-body compatibility)
  bone("sashTail", B.hips, 0.036, 0.115, 0.126);          // at the double knot
  bone("hat", B.chest, 0, 0.055, -0.10);                 // hung on the straps just off his upper back: laid against it, its rim cut through the robe (#642)
  group.updateMatrixWorld(true);
  const IDX = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  const at = (name) => B[name].getWorldPosition(V3());

  // ---- Weights ----
  // The robe: chest above, then spine, hips at the waist; below the sash the skirt bones take over, each the side it
  // faces; at the shoulders the cloth goes some way with the arm.
  const robeW = (x, y, z) => {
    const w = {}, add = (n, v) => { if (v > 1e-5) w[n] = (w[n] || 0) + v; };
    const up = smooth(0.615, 0.675, y), top = smooth(0.69, 0.77, y), skirt = smooth(0.64, 0.42, y), a = Math.atan2(x, z), sk = (1 - up) * skirt;
    add("chest", up * top); add("spine", up * (1 - top)); add("hips", (1 - up) * (1 - skirt));
    add("robeFront", sk * sq(Math.max(0, Math.cos(a)))); add("robeBack", sk * sq(Math.max(0, -Math.cos(a))));
    add("robeLeft", sk * sq(Math.max(0, Math.sin(a)))); add("robeRight", sk * sq(Math.max(0, -Math.sin(a))));
    const arm = 0.55 * smooth(0.072, 0.118, Math.abs(x)) * smooth(0.71, 0.785, y) * smooth(0.885, 0.835, y);
    if (arm > 0) { for (const k in w) w[k] *= 1 - arm; add(x > 0 ? "leftUpperArm" : "rightUpperArm", arm); }
    return Object.entries(w).map(([n, v]) => [IDX[n], v]);
  };
  const ARM = SIDES.map(([n, s]) => { const J = at(n + "UpperArm"), d = V3(s * Math.sin(APOSE), -Math.cos(APOSE), 0), o = V3(s * Math.cos(APOSE), Math.sin(APOSE), 0); return { n, s, J, d, o, e2: d.clone().cross(o) }; });
  const along = ({ J, d }, x, y, z) => V3(x, y, z).sub(J).dot(d);

  // ---- Seated on a cushion: the line of each column of the skirt, the cloth's height, and where the hands lie on it ----
  const NT = 64;
  const WAIST = 0.645, waistY = WAIST - CUSHION_DROP, SKIRT_END = 0.277;
  const lapLine = (a) => {
    const s = Math.sin(a), c = Math.cos(a), cz = zOffAt(WAIST), wx = rxAt(WAIST) * s, wz = rzAt(WAIST, c) * c, rw = Math.hypot(wx, wz), nx = wx / rw, nz = wz / rw;
    const fall = LAP.belly + (LAP.back - LAP.belly) * smooth(0.3, -0.5, c), STEP = 0.002, pts = [];
    let pooled = -1;
    for (let k = 0; k < 260; k++) {
      const rho = k * STEP, x = wx + nx * rho, z = cz + wz + nz * rho, ground = cushionAt(x, z) + LAP.thick;
      let h = Math.max(waistY - fall * rho, legsTop(x, z)) - ground;
      // once the cloth is nearly down it runs out along the cushion, thinning, and ends
      if (pooled < 0 && h < LAP.pool && rho > 0.02) pooled = rho;
      if (pooled >= 0) h = Math.min(Math.max(h, 0), LAP.pool) * Math.exp(-(rho - pooled) / LAP.tail);
      pts.push({ rho, x, z, y: ground + Math.max(0, h), len: 0 });
      if (pooled >= 0 && rho > pooled + LAP.lie + LAP.trail * smooth(-0.3, -0.9, c)) break;   // (behind him it trails a little further)
    }
    // Cloth does not follow every hollow: between the waist and the knees, and from a knee to the cushion, it is drawn
    // nearly straight over whatever stands highest (`taut` of the way from where it would lie to that straight line).
    // Straight before his belly it is let lie: there the hands press it into the hollow between his thighs.
    const hull = [], taut = LAP.taut * (1 - LAP.hollow * Math.exp(-sq(a / 0.62)));
    for (const q of pts) { while (hull.length > 1) { const a = hull[hull.length - 2], b = hull[hull.length - 1]; if ((b.y - a.y) * (q.rho - a.rho) <= (q.y - a.y) * (b.rho - a.rho)) hull.pop(); else break; } hull.push(q); }
    for (let i = 0, k = 0; i < pts.length; i++) { while (k < hull.length - 2 && hull[k + 1].rho < pts[i].rho) k++; const a = hull[k], b = hull[k + 1], line = a.y + (b.y - a.y) * (pts[i].rho - a.rho) / (b.rho - a.rho); if (line > pts[i].y) pts[i].y += taut * (line - pts[i].y); }
    // Cloth has no corners: the line is smoothed over a finger's width, so that where it leaves the legs or comes down
    // onto the cushion it turns, and does not fold in a ring (the first art review: 「袍下段一圈台阶折痕」).
    for (let pass = 0; pass < LAP.soft; pass++) { const ys = pts.map((q) => q.y); for (let i = 2; i < pts.length - 2; i++) pts[i].y = (ys[i - 2] + 2 * ys[i - 1] + 3 * ys[i] + 2 * ys[i + 1] + ys[i + 2]) / 9; }
    // Where it comes down onto the cushion the cloth is pressed into a crease, and its hem rolls up a little at the end
    // (the sheet has both, and the art review asked for them back): over `LAP.hem` at its end the cloth lies pressed on
    // the cushion and then lifts `LAP.roll` at its edge.
    if (pooled >= 0) {
      const end = pts[pts.length - 1].rho, from = end - LAP.hem;
      // the crease: just before the hem the cloth is pressed down onto the cushion; then the hem rolls up off it
      for (const q of pts) { if (q.rho < from - LAP.press) continue; const g = cushionAt(q.x, q.z) + LAP.thick; const press = smooth(from - LAP.press, from, q.rho); q.y = g + (1 - press) * Math.max(0, q.y - g) + LAP.roll * smooth(from, end, q.rho) * (1 - 0.5 * smooth(end - 0.002, end, q.rho)); }
    }
    let len = 0; for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].rho - pts[i - 1].rho, pts[i].y - pts[i - 1].y); pts[i].len = len; }
    return { pts, len };
  };
  const lapLines = Array.from({ length: NT + 1 }, (_, j) => lapLine(-Math.PI + (TAU * j) / NT));
  const onLine = ({ pts, len }, u) => {   // the point a share `u` of the way along a column's line
    const want = u * len; let k = 1; while (k < pts.length - 1 && pts[k].len < want) k++;
    const p = pts[k - 1], q = pts[k], f = clamp((want - p.len) / (q.len - p.len || 1), 0, 1);
    return [p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f, p.z + (q.z - p.z) * f];
  };
  /** @type {{ y: number, k: number, inner?: number }[]} */
  const rows = [
    { y: 0.68, k: 0.9, inner: 1 }, { y: 0.61, k: 0.92, inner: 1 }, { y: 0.54, k: 0.93, inner: 1 }, { y: 0.46, k: 0.94, inner: 1 }, { y: 0.38, k: 0.948, inner: 1 },
    { y: 0.32, k: 0.958, inner: 1 }, { y: 0.286, k: 0.972, inner: 1 }, { y: 0.2785, k: 0.99, inner: 1 },
    // (just above the hem the skirt has a few rows more than its profile: seated, the last few centimetres of each column
    // hold the crease and the rolled hem, and one row's step drew them as a flat band, #664)
    ...PROF.flatMap((p, i) => (i < 3 && PROF[i + 1] ? [0, 0.25, 0.5, 0.75].map((f) => ({ y: p.y + (PROF[i + 1].y - p.y) * f, k: 1 })) : [{ y: p.y, k: 1 }])),
    { y: 0.868, k: 0.84, inner: 1 },
  ];
  // Seated on a cushion (#664, refs/monk-poses-v6-2026-11-23-sitting.webp): the skirt lies over his folded legs. Each
  // column of it leaves the waist where it is as he stands, drops down his belly (or his back), runs out over the legs
  // wherever they hold it up (`legsTop`) and comes down to lie on the cushion, pooling a little and ending in a hem that
  // rolls out; so the lap is as wide and as high as the legs under it, the widest at the knees, level before his belly
  // where the shins cross and the hands rest. A column's points are set out along that line by how far down the
  // standing skirt each is. The heights are measured up from the seat; the bind pose is SIT_DROP higher.
  const torsoSit = grid(rows.length, NT + 1, (i, j) => {
    const { y: y0, k, inner } = rows[i], a = -Math.PI + (TAU * j) / NT, s = Math.sin(a), c = Math.cos(a);
    const vDip = Math.max(0, 1 - Math.abs(a) / 0.85) * 0.068 * smooth(0.75, 0.876, y0);
    const y = y0 - vDip, m = 1 - 0.005 * smooth(0.295, 0.277, y0) * (inner ? 0 : 1);
    const x = rxAt(y) * k * m * s, z = zOffAt(y) + rzAt(y, c) * k * m * c;
    const u = clamp((WAIST - y0) / (WAIST - SKIRT_END), 0, 1);
    if (u <= 0) return [x, y, z, (j / NT) * 5, y * 7];
    const line = lapLines[j];
    let [lx, ly, lz] = onLine(line, u);
    // The lining has only a few rows down the skirt, and straight between them it would cut up through a lap that rises
    // and falls; seated it is never seen, so it is laid low inside the skirt, meeting the cloth at the hem.
    if (inner) { const [ex, ey, ez] = onLine(line, 1), g = cushionAt(lx, lz) + 0.002; lx = ex + (lx - ex) * 0.96; lz = ez + (lz - ez) * 0.96; ly = Math.min(ly - 0.004, Math.max(g, ey - 0.002) + (ly - ey) * 0.15); }
    const blend = smooth(0, 0.06, u);
    return [x + (lx - x) * blend, y + (ly + CUSHION_DROP - y) * blend, z + (lz - z) * blend, (j / NT) * 5, y * 7];
  });
  weld(torsoSit);
  // How high the cloth of the lap lies at a point of the seat's frame: the seated skirt's own triangles, as they will be
  // drawn, laid into half-centimetre squares (the highest in each).
  const CELL = 0.005, SPAN = 92, cloth = new Float32Array((2 * SPAN + 1) * (2 * SPAN + 1)).fill(-9);
  {
    const P = torsoSit.attributes.position, ix = torsoSit.index.array, W = 2 * SPAN + 1, top = waistY + CUSHION_DROP + 0.002;
    for (let k = 0; k < ix.length; k += 3) {
      const [a, b, c] = [ix[k], ix[k + 1], ix[k + 2]].map((i) => [P.getX(i), P.getY(i), P.getZ(i)]);
      if (Math.max(a[1], b[1], c[1]) > top) continue;   // (above the waist: not the lap)
      const n = Math.ceil(Math.max(Math.hypot(b[0] - a[0], b[2] - a[2]), Math.hypot(c[0] - a[0], c[2] - a[2]), Math.hypot(c[0] - b[0], c[2] - b[2])) / (CELL * 0.5)) + 1;
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v, x = a[0] * w + b[0] * u + c[0] * v, y = a[1] * w + b[1] * u + c[1] * v - CUSHION_DROP, z = a[2] * w + b[2] * u + c[2] * v;
        const cx = Math.round(x / CELL) + SPAN, cz = Math.round(z / CELL) + SPAN; if (cx < 0 || cz < 0 || cx >= W || cz >= W) continue;
        if (y > cloth[cz * W + cx]) cloth[cz * W + cx] = y;
      }
    }
  }
  const clothTop = (x, z) => {
    const fx = clamp(x / CELL + SPAN, 0, 2 * SPAN - 1e-6), fz = clamp(z / CELL + SPAN, 0, 2 * SPAN - 1e-6), ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, W = 2 * SPAN + 1;
    // (within the waist there is no skirt, only his belly: a square there counts as the lowest of the squares beside it)
    const c = [cloth[iz * W + ix], cloth[iz * W + ix + 1], cloth[(iz + 1) * W + ix], cloth[(iz + 1) * W + ix + 1]], low = Math.min(...c.filter((y) => y > -8), 9), g = (y) => (y < -8 ? (low > 8 ? 0 : low) : y);
    return (g(c[0]) * (1 - u) + g(c[1]) * u) * (1 - v) + (g(c[2]) * (1 - u) + g(c[3]) * u) * v;
  };
  // The hands are let down onto that cloth (#664). Each lies along a straight way from its wrist toward the other hand;
  // of the slopes it might lie at, the one that brings its palm lowest with every part of it clear of what is under it
  // is taken: under the right hand the cloth, under the left the cloth and the right hand. All in the seat's frame.
  const layHands = () => {
    const out = {}, under = [];
    for (const [n, s] of /** @type {[string, number][]} */ ([["right", -1], ["left", 1]])) {
      const hx = -s / Math.hypot(1, LAP_HAND.out), hz = LAP_HAND.out / Math.hypot(1, LAP_HAND.out), px = s * LAP_HAND.x, pz = LAP_HAND.z;
      const floorAt = (x, z) => { let y = clothTop(x, z); for (const u of under) { const d = (x - u.wrist.x) * u.f.x + (z - u.wrist.z) * u.f.z, side = Math.abs((x - u.wrist.x) * u.f.z - (z - u.wrist.z) * u.f.x); if (d > -0.02 && d < 0.09 * LAP_HAND.big && side < 0.03 * LAP_HAND.big) y = Math.max(y, u.wrist.y + u.f.y * d + (d < 0.015 ? 0.0165 : (d < 0.045 * LAP_HAND.big ? 0.0118 : 0.0105) * LAP_HAND.big)); } return y; };
      let best = null;
      for (let sl = -LAP_HAND.tip; sl <= LAP_HAND.tip + 1e-9; sl += 0.02) {
        const l = Math.hypot(1, sl), f = V3(hx / l, sl / l, hz / l), cosl = 1 / l; let wy = -9;
        // (the wrist's plan place: the palm's middle is 0.03 along the hand from it)
        const wx = px - f.x * HAND_MID, wz = pz - f.z * HAND_MID;
        for (const [d, r, side] of HAND_ROD) for (const k of side ? [-1, 0, 1] : [0]) {
          const x = wx + f.x * d + hz * k * side, z = wz + f.z * d - hx * k * side;
          wy = Math.max(wy, floorAt(x, z) + r / cosl + 0.003 - f.y * d);
        }
        const palm = wy + f.y * HAND_MID;
        if (!best || palm + 0.004 * Math.abs(sl) < best.score) best = { score: palm + 0.004 * Math.abs(sl), wrist: V3(wx, wy, wz), f, palm: V3(wx + f.x * HAND_MID, palm, wz + f.z * HAND_MID) };
      }
      // the hand's own frame there: fingers toward -y, the palm up along +z as nearly as the fingers' way lets it
      const y = best.f.clone().negate(), z = V3(0, 1, 0).addScaledVector(best.f, -best.f.y).normalize(), x = V3().crossVectors(y, z);
      best.q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); best.s = s;
      out[n] = best; under.push(best);
    }
    // The thumbs' tips meet over the middle, a little apart to either side; each is worked back into its own hand's frame
    // (the right hand is the left's mirror, so its own x is counted the other way).
    const T = LAP_HAND.thumb, meet = V3(0, out.left.palm.y + T.up, (out.left.palm.z + out.right.palm.z) / 2 + T.fwd);
    for (const n of ["left", "right"]) {
      const h = out[n], tip = meet.clone(); tip.x += h.s * T.gap;
      tip.sub(h.wrist).applyQuaternion(h.q.clone().invert()); tip.x *= h.s; tip.sub(V3(...HAND_SHIFT)).divideScalar(LAP_HAND.big);
      const reach = -tip.y, up = tip.z;
      // (the thumb is long and leaves the palm at its heel, as the owner's photograph of the seal has it)
      const by = -0.008;
      // (it rises from the heel of the palm and comes into the meeting level, the pull `turn` of the way along at the tip's height, so that the two together are one arch with a level top, not a peak)
      h.thumb = { base: [0.016, by, T.root[n]], joint: [T.lean * tip.x + (1 - T.lean) * 0.016, by + T.turn * (tip.y - by), tip.z * T.arch], tip: tip.toArray() };   // (the pull level with the tip: each thumb comes into the meeting level, so the two read as one arch)
      h.meet = meet;
    }
    return out;
  };
  const lapHands = layHands();

  // ---- Skin: head, neck, forearms, hands, one mesh ----
  const skinParts = [], skinMudraParts = [];
  const pushSkin = (base, mudra = base) => { skinParts.push(base); skinMudraParts.push(mudra); };
  {
    const g = new THREE.SphereGeometry(R, 48, 32), p = g.attributes.position, clr = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const n = V3(p.getX(i), p.getY(i), p.getZ(i)).divideScalar(R);
      const cheek = Math.max(...[1, -1].map((s) => Math.exp(-(sq(n.x - s * 0.53) + sq(n.y + 0.34) + sq(n.z - 0.76)) / 0.082)));   // soft feathered blush
      const jawShade = smooth(-0.68, -0.98, n.y) * 0.04;
      c.copy(PAL.skin).lerp(PAL.crown, smooth(0.38, 0.95, n.y)).lerp(PAL.blush, 0.62 * cheek).multiplyScalar(1 - jawShade);
      clr.set([c.r, c.g, c.b], i * 3);
      const q = deform(n.multiplyScalar(R)).add(SKULL); p.setXYZ(i, q.x, q.y, q.z);
    }
    g.setAttribute("color", new THREE.BufferAttribute(clr, 3)); weld(g);
    // Under the chin (#664). He casts no shadow on himself, so the underside of his jaw, which faces the ground and takes
    // only the ground's light, came out darker than the neck right below it, which faces the sky's side light and has
    // nothing over it: a dark band between two lighter ones, read as a beard. The jaw's underside is turned a little
    // toward the horizon for the light (its normals only, JAW), and the neck is shaded where the head stands over it (NECK_SHADE).
    { const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) { const y = nr.getY(i); if (y >= -JAW.from) continue; const y2 = -JAW.from + (y + JAW.from) * JAW.keep, k = Math.sqrt((1 - y2 * y2) / Math.max(1e-9, 1 - y * y)); nr.setXYZ(i, nr.getX(i) * k, y2, nr.getZ(i) * k); } }
    pushSkin(finish(g, null, IDX.head));
    // Face strokes (refs/monk-poses-v6-2026-11-23-gassho-head.webp):
    // short flat rounded-cap brows, gentle downward U-arc closed eyes (no eyelashes), small button nose, tiny shallow smile.
    const stroke = (pts, width, color, depthRatio = 0.5, cap = true) => {
      const P = pts.map(([az, el]) => onFace(az, el, 0.0005)), fr = frames(P, (q) => q.clone().sub(SKULL).normalize());
      fr.forEach((f, i) => { f.k = width(i / (fr.length - 1)); });
      const parts = [sweep(fr, oval(1, depthRatio, 8))];
      if (cap) for (const end of [fr[0], fr[fr.length - 1]]) {
        parts.push(new THREE.SphereGeometry(end.k, 8, 6).scale(1, 1, depthRatio).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), end.n)).translate(end.p.x, end.p.y, end.p.z));
      }
      return finish(mergeGeometries(parts.map((q) => { q.deleteAttribute("uv"); return q; })), color, IDX.head);
    };
    const arc = (n, f) => Array.from({ length: n + 1 }, (_, i) => f((2 * i) / n - 1));
    for (const s of [1, -1]) {
      // Closed eyes: gentle downward-curving smile arc, no eyelashes
      pushSkin(stroke(arc(12, (t) => [s * (0.46 + 0.12 * t), -0.15 - 0.046 * (1 - t * t)]), (u) => 0.0026 + 0.0014 * Math.sin(Math.PI * u), PAL.lash, 0.52));
      // Short flat rounded brows (uniform pill bar with barely a gentle lift)
      pushSkin(stroke(arc(10, (t) => [s * (0.465 + 0.118 * t), 0.195 + 0.015 * (1 - t * t)]), () => 0.0058, PAL.brow, 0.48));
    }
    // Small sweet shallow smile mouth
    pushSkin(stroke(arc(10, (t) => [0.115 * t, -0.505 + 0.036 * t * t]), (u) => 0.0013 + 0.0007 * Math.sin(Math.PI * u), PAL.lip, 0.48));
    // Cute small rounded button nose
    pushSkin(finish(new THREE.SphereGeometry(0.0106, 14, 10).scale(1.04, 0.84, 0.96).translate(...onFace(0, -0.34, -0.0012).toArray()), PAL.skin.clone().lerp(PAL.blush, 0.18), IDX.head));
    // Low-set plump C-cup ears (ear top roughly level with closed eyes, y = 0.95..1.01, smooth clay lobe)
    for (const s of [1, -1]) {
      const ear = mergeGeometries([
        paint(new THREE.SphereGeometry(1, 14, 10).scale(0.0155, 0.0295, 0.0235), PAL.skin),
        paint(new THREE.TorusGeometry(0.0175, 0.0062, 8, 20).rotateY(Math.PI / 2).scale(0.82, 1.28, 1.0).translate(0.0032, 0.0005, -0.001), PAL.skin),
        paint(new THREE.SphereGeometry(1, 10, 8).scale(0.0045, 0.0135, 0.0105).translate(0.0055, -0.0015, 0.001), PAL.earIn),
      ]);
      if (s < 0) { ear.scale(-1, 1, 1); flip(ear); }
      ear.rotateY(-s * 0.26).translate(...onFace(s * 1.58, -0.45, -0.002).toArray());
      pushSkin(finish(ear, null, IDX.head));
    }
    // Sturdy child's neck + throat extending cleanly behind the crossed cream V-collar (zero seam!)
    {
      const NNY = 10, NNC = 20;
      const nk = grid(NNY, NNC + 1, (i, j) => {
        const u = i / (NNY - 1), y = 0.798 + 0.134 * u, a = -Math.PI + (TAU * j) / NNC;
        const flare = 1 + 0.07 * sq(Math.max(0, u - 0.6) / 0.4);
        const rx = 0.049 * flare, rz = 0.046 * flare;
        const frontChest = 0.026 * smooth(0.55, 0, u) * Math.max(0, Math.cos(a));
        return [rx * Math.sin(a), y, rz * Math.cos(a) - 0.001 + frontChest, 0, 0, PAL.skin.clone().multiplyScalar(NECK_SHADE.low - (NECK_SHADE.low - NECK_SHADE.top) * smooth(NECK_SHADE.from, 0.95, u))];
      });
      weld(nk);
      pushSkin(finish(nk, null, (x, y) => {
        const h = smooth(0.896, 0.922, y), c2 = smooth(0.875, 0.848, y);
        return [[IDX.head, h], [IDX.chest, c2], [IDX.neck, Math.max(0, 1 - h - c2)]];
      }));
    }
    // Plump child's forearms and sculpted soft-clay hands (wrist sphere centred on B.Hand so pray/tea/sit stay connected)
    for (const arm of ARM) {
      const { J, d, o, e2, n, s } = arm, NC = 16, NA = 10;
      const fa = grid(NA, NC + 1, (i, j) => {
        const u = i / (NA - 1), t = 0.145 + (UPPER + FORE + 0.004 - 0.145) * u, th = Math.PI + (TAU * j) / NC;
        const r = 0.0365 - 0.0115 * smooth(0.15, UPPER + FORE, t) + 0.002 * Math.exp(-sq((t - 0.21) / 0.045));
        const tuckIn = -0.0085 * smooth(0.16, 0.30, t) * (1 - 0.45 * smooth(0.30, UPPER + FORE, t));
        const q = J.clone().addScaledVector(d, t).addScaledVector(o, r * Math.cos(th) + tuckIn).addScaledVector(e2, r * 0.96 * Math.sin(th));
        return [q.x, q.y, q.z, 0, 0];
      });
      weld(fa);
      pushSkin(finish(fa, PAL.skin, (x, y, z) => { const t = along(arm, x, y, z), l = smooth(0.175, 0.215, t), h = 0.5 * smooth(UPPER + FORE - 0.02, UPPER + FORE, t); return [[IDX[n + "UpperArm"], 1 - l], [IDX[n + "LowerArm"], l * (1 - h)], [IDX[n + "Hand"], l * h]]; }));
      // The hand in its own frame: a ball at the wrist, then the hand itself as one soft mitt, palm and fingers in one piece
      // as the sheet's clay hands are (the owner on the jointed fingers, 2026-11-25: 「重做手指」), and the thumb as one
      // tube. Standing, the fingers hang a little curled and the hand is turned down at the wrist (-0.46 rad); in the lap
      // (法界定印, a morph) the fingers are shorter, rounder and cupped up with the palm, and the thumb arches over to the
      // other's. Both are built by the same two functions with the same counts, so a morph moves each point to its own.
      const buildHand = (mudra) => {
        const M = mudra ? HAND_SHAPE.lap : HAND_SHAPE.stand;
        /** @type {THREE.BufferGeometry[]} */
        const palmParts = [mitt(M)];
        // The thumb. In the lap (法界定印) it rises off the far edge of the palm and comes over toward the other hand, so that
        // the two tips meet in the middle over the fingers and the thumbs and the fingers below them close round an open
        // oval, not a peak. Where each tip must be for that is worked out with the hands' places (layHands).
        if (mudra) {
          const t = lapHands[s > 0 ? "left" : "right"].thumb, K = LAP_HAND.thumb.thick;
          palmParts.push(thumbTube(t.base, t.joint, t.tip, 0.0088 * K, 0.0078 * K));
        } else {
          // Standing, the thumb lies along the side of the hand, a little apart from it.
          const at = (y) => V3(0, y, 0).applyAxisAngle(ZV, 0.24).applyAxisAngle(XV, -0.55).add(V3(0.012, -0.018, 0.009)).toArray();
          palmParts.push(thumbTube(at(0), at(-0.0095), at(-0.019), 0.0076, 0.0072));
        }
        const big = mudra ? LAP_HAND.big : 1, palm = mergeGeometries(palmParts.map((g) => { g.deleteAttribute("uv"); return g; })).rotateZ(mudra ? 0 : -0.46).scale(big, big, big).translate(-0.0045, -0.002, 0);
        const wrist = new THREE.SphereGeometry(mudra ? 0.0262 : 0.0245, 14, 10).scale(1, 1, mudra ? LAP_HAND.wrist : 1).translate(-0.0045, 0, 0); wrist.deleteAttribute("uv");   // (in the lap the wrist bends further, and a ball the forearm's own size flickered against its end)
        const hand = mergeGeometries([wrist, palm]);
        if (s < 0) { hand.scale(-1, 1, 1); flip(hand); }
        hand.applyMatrix4(B[n + "Hand"].matrixWorld);
        return finish(hand, PAL.skin, IDX[n + "Hand"]);
      };
      pushSkin(buildHand(false), buildHand(true));
    }
  }

  // ---- The robe: clean A-line body & skirt, wide sleeves, crisp crossed cream V-collar, lapel, sash with twin knot & single flat tail ----
  const robeParts = [];
  const torso = grid(rows.length, NT + 1, (i, j) => {
    const { y: y0, k, inner } = rows[i], a = -Math.PI + (TAU * j) / NT, s = Math.sin(a), c = Math.cos(a);
    // Smooth parametric V-neckline along the top rows so the torso edge tucks cleanly behind the crossed cream collar bands (zero stair-stepping)
    const vDip = Math.max(0, 1 - Math.abs(a) / 0.85) * 0.068 * smooth(0.75, 0.876, y0);
    const y = y0 - vDip;
    let m = 1 - 0.005 * smooth(0.295, 0.277, y0) * (inner ? 0 : 1);
    const x = rxAt(y) * k * m * s, z = zOffAt(y) + rzAt(y, c) * k * m * c;
    const inBackCollar = !inner && z <= zOffAt(y) && y0 > 0.868;
    const colour = inner ? PAL.robeIn
      : inBackCollar ? PAL.robe.clone().lerp(PAL.collar, smooth(0.868, 0.873, y0))
      : PAL.robe;
    return [x, y, z, (j / NT) * 5, y * 7, colour];
  });
  weld(torso);
  robeParts.push(finish(torso, null, robeW, true));
  const torsoCount = torso.attributes.position.count;
  // Wide conical sleeves to the elbow with crisp rolled cuff and dark interior lining
  /** @type {[number, THREE.BufferGeometry][]} */
  const sleeveSit = [];   // each sleeve as it is seated, and where it starts in the robe
  for (const arm of ARM) {
    const { J, d, o, e2, n, s } = arm, NC = 28, NA = 12;
    /** @type {{ v: number, k: number, back: number, lining?: number }[]} */
    const srows = [
      ...Array.from({ length: NA }, (_, i) => ({ v: i / (NA - 1), k: 1, back: 0 })),
      { v: 1, k: 0.94, back: 0.008, lining: 1 },
      { v: 1, k: 0.88, back: 0.052, lining: 1 },
    ];
    // `sit` is the sleeve as it hangs when he is seated on a cushion with his hands in his lap (#664): the elbow is bent
    // toward the front of the arm (the side the bone's own z looks to), so there the cuff is drawn up the arm and the
    // forearm comes out under it, not through its side; round the back of the elbow the cloth hangs on past it and
    // covers it, and the whole cuff is opened wider, as the drawing has a sleeve that reaches the lap.
    const sleeve = (sit) => grid(srows.length, NC + 1, (i, j) => {
      const th = Math.PI + (TAU * j) / NC, c = Math.cos(th), sn = Math.sin(th), row = srows[i], fore = s * sn;
      const tEnd = 0.214 + 0.016 * Math.pow(Math.max(0, -c), 1.4) + sit * (SLEEVE_SIT.hang * smooth(0, SLEEVE_SIT.round, Math.sqrt(Math.max(0, 0.5 - 0.5 * fore))) + SLEEVE_SIT.side * (1 - fore * fore) - SLEEVE_SIT.cut * Math.max(0, fore));
      const t = -0.032 + (tEnd + 0.032) * row.v - row.back, vv = clamp((t + 0.032) / 0.255, 0, 1);
      const open = (1 + sit * SLEEVE_SIT.open * smooth(0.35, 1, row.v)) * (1 - sit * SLEEVE_SIT.bevel * sq(smooth(0.72, 1, row.v)) * Math.max(0, -fore));   // (and its hanging corner is turned in a little, so that it is round, not a point)
      const rO = (0.053 + 0.02 * smooth(0, 1, vv)) * row.k * (1 - 0.14 * Math.max(0, -c) * smooth(0.15, 0.8, vv)) * open;
      const rZ = (0.054 + 0.02 * smooth(0, 1, vv)) * row.k * open;
      const q = J.clone().addScaledVector(d, t).addScaledVector(o, rO * c + 0.006 * (1 - vv)).addScaledVector(e2, rZ * sn);
      q.x += s * 0.005 * (1 - vv);
      return [q.x, q.y, q.z, (j / NC) * 2, vv * 1.6, row.lining ? PAL.robeIn : PAL.robe];
    });
    const sl = weld(sleeve(0));
    sleeveSit.push([robeParts.reduce((k, g) => k + g.attributes.position.count, 0), weld(sleeve(1))]);
    robeParts.push(finish(sl, null, (x, y, z) => {
      if (Math.abs(x) < 0.052) return [[IDX.chest, 1]];
      const t = along(arm, x, y, z), w = smooth(-0.024, 0.068, t);
      return [[IDX[n + "UpperArm"], w], [IDX[n + "Shoulder"], (1 - w) * 0.5], [IDX.chest, (1 - w) * 0.5]];
    }, true));
  }
  const band = (pts, section, color, w = robeW) => finish(sweep(frames(pts.map((q) => q.p), (_, i) => pts[i].n), section), color, w, true);
  const flat = (hw, h) => [[-hw, 0], [-hw, h], [hw, h], [hw, 0]];
  // Crisp crossed cream inner collar (two narrow bands crossing at the V-point, skin showing smoothly above) + robe crossover lapels.
  const F = (x, y) => [x, y, 0.3, x, y, zOffAt(y)], Bk = (x, y) => [x, y, -0.3, x, y, zOffAt(y)];
  // Left-side cream under-collar strip crossing cleanly over right at the bottom of the V
  robeParts.push(band(onBody([
    [-0.12, 0.872, -0.3], [0, 0.87, -0.3], [0.12, 0.872, -0.3], [0.25, 0.873, -0.14], [0.25, 0.873, 0.06],
    F(0.05, 0.866), F(0.027, 0.84), F(0.002, 0.813), F(-0.011, 0.802),
  ], 44, 0.0038), flat(0.0092, 0.0046), PAL.collar));
  robeParts.push(band(onBody([
    [-0.25, 0.873, -0.14], [-0.25, 0.873, 0.06], F(-0.05, 0.866), F(-0.027, 0.84), F(-0.002, 0.813), F(0.008, 0.805),
  ], 28, 0.0026), flat(0.0092, 0.0042), PAL.collar));
  // Left-over-right crossover outer robe lapel (subtle form relief in robe colour)
  robeParts.push(band(onBody([
    F(0.062, 0.86), F(0.036, 0.826), F(0.004, 0.79), F(-0.028, 0.746), F(-0.058, 0.702), F(-0.082, 0.67),
  ], 36, 0.002), flat(0.009, 0.0038), PAL.band));
  robeParts.push(band(onBody([
    F(-0.062, 0.86), F(-0.036, 0.826), F(-0.004, 0.79),
  ], 16, 0.0014), flat(0.009, 0.0032), PAL.band));

  // The waist sash (y = 0.635..0.681, height 4.6 cm): clean bevelled belt, twin plump cloth-knot puffs at front-left, and one crisp rectangular hanging tail.
  {
    const y = 0.658;
    const ring = Array.from({ length: 56 }, (_, k) => {
      const a = -Math.PI + (TAU * k) / 56, c = Math.cos(a), q = V3(rxAt(y) * Math.sin(a), y, zOffAt(y) + rzAt(y, c) * c);
      const n = bodyNormal(q); return { p: q.addScaledVector(n, 0.0018), n };
    });
    robeParts.push(finish(sweep(frames(ring.map((q) => q.p), (_, i) => ring[i].n, true),
      [[-0.0235, 0], [-0.0238, 0.004], [-0.0215, 0.0085], [0.0215, 0.0085], [0.0238, 0.004], [0.0235, 0]], true), PAL.sash, IDX.spine, true));
    // Twin rounded knot puffs right on the sash front-left (matching front.webp & side.webp)
    const kz = zOffAt(y) + rzAt(y, 1) + 0.011;
    const knot = mergeGeometries([
      new THREE.SphereGeometry(1, 14, 10).scale(0.0175, 0.0215, 0.014).translate(0.009, y, kz),
      new THREE.SphereGeometry(1, 14, 10).scale(0.018, 0.0215, 0.0145).translate(0.037, y, kz - 0.002),
    ]);
    robeParts.push(finish(knot, PAL.sash, IDX.spine, true));
    // Single clean flat rectangular hanging sash tail from under the right knot puff down to y = 0.432
    const pts = [], N = 12, wd = 0.0205, len = 0.214;
    for (let i = 0; i <= N; i++) {
      const u = i / N, y2 = (y - 0.012) - len * u, x2 = 0.037;
      const frontZ = zOffAt(y2) + rzAt(y2, 1) * Math.sqrt(Math.max(0.1, 1 - sq(x2 / rxAt(y2))));
      pts.push(V3(x2, y2, frontZ + 0.006));
    }
    const fr = frames(pts, () => V3(0, 0, 1));
    const tailGeo = sweep(fr, [[-wd, -0.003], [-wd, 0.0035], [wd, 0.0035], [wd, -0.003], [-wd, -0.003]]);
    const endP = pts[pts.length - 1];
    const cap = new THREE.BoxGeometry(wd * 2, 0.006, 0.0065).translate(endP.x, endP.y, endP.z);
    robeParts.push(finish(mergeGeometries([tailGeo, cap].map((q) => { if (!q.attributes.uv) q.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); return q; })), PAL.sash, IDX.sashTail, true));
  }

  // The straps that hold the hat: over each shoulder from the hat's upper rim, kept on their own SkinnedMesh (`straps`).
  const strapParts = [], strapLine = [];
  for (const s of [1, -1]) {
    const c = [s * 0.055, 0.79, zOffAt(0.79)];
    const g = [Bk(s * 0.062, 0.76), Bk(s * 0.07, 0.82), [s * 0.072, 0.94, -0.14, ...c], [s * 0.075, 0.96, 0.04, ...c], [s * 0.08, 0.91, 0.16, ...c], F(s * 0.085, 0.78), F(s * 0.09, 0.71)];
    const line = onBody(g, 28, 0.0028), strap = band(line, flat(0.0062, 0.0024), PAL.strap);
    strapParts.push(strap); strapLine.push(line.map(({ p, n }) => ({ p: p.clone(), n: n.clone() })));
  }

  // ---- Plump balloon trousers and chunky layered leg wraps (refs/monk-v6-ortho) ----
  const legParts = [];
  const TROUSER = new THREE.CatmullRomCurve3([
    [0.038, 0.142], [0.052, 0.152], [0.068, 0.172], [0.078, 0.2], [0.081, 0.232], [0.079, 0.262],
    [0.071, 0.288], [0.062, 0.325], [0.057, 0.38], [0.055, 0.445], [0.054, 0.5], [0.052, 0.54],
  ].map(([r, y]) => V3(r, y, 0)), false, "centripetal").getPoints(20);
  // Pelvis/seat cap closing the top of the trousers inside the robe so looking up under the hem never sees empty tubes
  legParts.push(finish(new THREE.SphereGeometry(1, 18, 12).scale(0.105, 0.062, 0.088).translate(0, 0.525, -0.008), PAL.trousers, IDX.hips, true));
  for (const [n, s] of SIDES) {
    const cx = s * 0.088, cz = -0.006, NC = 24;
    const tr = grid(TROUSER.length, NC + 1, (i, j) => {
      const { x: r0, y } = TROUSER[i], a = -Math.PI + (TAU * j) / NC;
      const gather = 1 + 0.045 * Math.sin(10 * a + s) * smooth(0.185, 0.145, y);
      const rx = r0 * gather * (1 + 0.035 * smooth(0.16, 0.24, y) * smooth(0.285, 0.24, y) * Math.max(0, s * Math.sin(a)));
      const rz = r0 * gather * (1 + 0.24 * smooth(0.15, 0.22, y) * smooth(0.285, 0.245, y)) * (1 - 0.24 * smooth(0.32, 0.42, y) * Math.max(0, -Math.cos(a)));
      const hipIn = s * 0.028 * smooth(0.28, 0.52, y);
      return [cx - hipIn + rx * Math.sin(a), y, cz + rz * Math.cos(a), (j / NC) * 3, y * 6, PAL.trousers];
    });
    weld(tr);
    legParts.push(finish(tr, null, (x, y) => { const lo = smooth(0.315, 0.245, y), hip = 0.55 * smooth(0.44, 0.53, y); return [[IDX.hips, hip], [IDX[n + "UpperLeg"], (1 - hip) * (1 - lo)], [IDX[n + "LowerLeg"], (1 - hip) * lo]]; }, true));
    // Chunky pale cream leg wraps (y = 0.062..0.152, width ~7.2 cm, depth ~9.0 cm)
    const ys = []; for (let y = 0.062; y <= 0.153; y += 0.0045) ys.push(y);
    const wr = grid(ys.length, 21, (i, j) => {
      const y = ys[i], a = -Math.PI + (TAU * j) / 20, f = ((((y - 0.062) / 0.0165 + (s * a) / (TAU * 2.5)) % 1) + 1) % 1;
      const rx = 0.0345 + 0.0035 * smooth(0.07, 0.145, y) + 0.0014 * f;
      const rz = 0.0435 + 0.0035 * smooth(0.07, 0.145, y) + 0.0014 * f;
      return [cx + rx * Math.sin(a), y, -0.012 + rz * Math.cos(a), (j / 20) * 2, y * 8, PAL.wrap.clone().multiplyScalar(0.9 + 0.1 * smooth(0, 0.22, f))];
    });
    weld(wr);
    legParts.push(finish(wr, null, IDX[n + "LowerLeg"], true));
  }

  // ---- Chunky flat-soled cloth shoes (width ~10.2 cm, length ~17.6 cm, thick 2 cm pale sole) ----
  const shoeParts = [];
  for (const [n, s] of SIDES) {
    const up = new THREE.SphereGeometry(1, 24, 14), p = up.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
      const widen = 1 + 0.08 * smooth(-0.3, 0.5, uz);
      const x = ux * 0.0485 * widen;
      const z = uz * 0.086 + 0.018;
      let y = uy > 0 ? uy * 0.049 - 0.041 : uy * 0.006 - 0.041;
      y = Math.min(y, 0.008 - Math.max(0, z - 0.03) * 0.36);
      p.setXYZ(i, x, y, z);
    }
    up.computeVertexNormals();
    const sole = new THREE.CylinderGeometry(1, 1.01, 0.02, 24, 1);
    const sp = sole.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const sx = sp.getX(i), sy = sp.getY(i), sz = sp.getZ(i);
      const widen = 1 + 0.08 * smooth(-0.3, 0.5, sz);
      sp.setXYZ(i, sx * 0.0505 * widen, sy - 0.05, sz * 0.0885 + 0.018);
    }
    sole.computeVertexNormals();
    const shoe = mergeGeometries([paint(up, PAL.shoe), paint(sole, PAL.sole)]);
    shoe.translate(s * 0.091, ANKLE, 0);
    shoeParts.push(finish(shoe, null, IDX[n + "Foot"], true));
  }

  // ---- Materials and meshes (soft matte clay / fine cotton feel matching v6) ----
  const lin = linen(opts.rand ? mulberry32 : null);
  const clothM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, map: lin, bumpMap: lin, bumpScale: 0.16, roughness: 0.92, sheen: 0.5, sheenRoughness: 0.78, sheenColor: new THREE.Color(0xffe0c6), envMapIntensity: 0.4 });
  const skinM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, sheen: 0.18, sheenRoughness: 0.85, sheenColor: new THREE.Color(0xffe2ca), envMapIntensity: 0.42, emissive: 0x2a1206, emissiveIntensity: 0.42 });
  const shoeM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, bumpMap: lin, bumpScale: 0.1, envMapIntensity: 0.28 });
  const beadM = new THREE.MeshStandardMaterial({ color: 0x9e4e26, roughness: 0.34, metalness: 0.02, envMapIntensity: 0.85 });
  const skinned = (parts, mat) => { const m = new THREE.SkinnedMesh(mergeGeometries(parts), mat); m.frustumCulled = false; m.receiveShadow = true; group.add(m); return m; };
  const skin = skinned(skinParts, skinM), robe = skinned(robeParts, clothM), legs = skinned(legParts, clothM), shoes = skinned(shoeParts, shoeM);
  {
    const skinMudra = mergeGeometries(skinMudraParts);
    skin.geometry.morphAttributes.position = [skinMudra.attributes.position];
    skin.geometry.morphAttributes.normal = [skinMudra.attributes.normal];
    skin.updateMorphTargets();
  }
  {
    const basePos = robe.geometry.attributes.position.array, baseNorm = robe.geometry.attributes.normal.array;
    const sitPos = new Float32Array(basePos), sitNorm = new Float32Array(baseNorm);
    sitPos.set(torsoSit.attributes.position.array, 0);
    sitNorm.set(torsoSit.attributes.normal.array, 0);
    for (const [at, g] of sleeveSit) { sitPos.set(g.attributes.position.array, at * 3); sitNorm.set(g.attributes.normal.array, at * 3); }
    robe.geometry.morphAttributes.position = [new THREE.BufferAttribute(sitPos, 3)];
    robe.geometry.morphAttributes.normal = [new THREE.BufferAttribute(sitNorm, 3)];
    robe.updateMorphTargets();
  }
  const straps = skinned(strapParts, clothM); straps.visible = true;   // shown whenever the hat is on his back (panel 4)
  const skeleton = new THREE.Skeleton(bones);
  for (const m of [skin, robe, legs, shoes, straps]) m.bind(skeleton);
  const rigid = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; parent.add(m); return m; };

  // The beads: thirty-eight smooth wooden beads draped loosely around his neck down to mid-chest (tucked neatly at nape so only 2-3 show each side from behind).
  let beadMesh; const beadAt = [];
  {
    const F = (x, y) => [x, y, 0.3, x, y, zOffAt(y)], Bk = (x, y) => [x, y, -0.3, x, y, zOffAt(y)];
    const guess = [
      Bk(0, 0.856), Bk(0.036, 0.868), [0.06, 0.905, -0.09, 0.045, 0.82, 0], [0.066, 0.925, 0.02, 0.048, 0.82, 0],
      [0.072, 0.905, 0.14, 0.05, 0.82, 0], F(0.072, 0.815), F(0.066, 0.755), F(0.045, 0.712), F(0, 0.696),
    ];
    const loop = [...guess, ...guess.slice(1, -1).reverse().map(([x, y, z, cx, cy, cz]) => [-x, y, z, cx === undefined ? undefined : -cx, cy, cz])];
    const NBEADS = 38;
    const pts = onBody(loop, NBEADS, 0.011, true), chest = at("chest"), beads = [];
    pts.forEach(({ p, n }, i) => {
      // Pull the centre-nape beads snugly behind the collar rim so back view shows 2-3 beads each side like back.webp
      const nape = smooth(-0.01, -0.046, p.z) * smooth(0.054, 0.014, Math.abs(p.x));
      const pos = p.clone().addScaledVector(n, -0.017 * nape);
      pos.y -= 0.015 * nape;
      const nx = pts[(i + 1) % pts.length].p.clone().sub(pts[(i - 1 + pts.length) % pts.length].p).normalize();
      const r = 0.0108;
      beads.push(new THREE.SphereGeometry(r, 8, 6).scale(1, 0.92, 1).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, nx)).translate(pos.x - chest.x, pos.y - chest.y, pos.z - chest.z));
      beadAt.push({ c: pos.clone(), r });
    });
    beadMesh = rigid(mergeGeometries(beads), beadM, B.chest);
  }
  // The bamboo hat (refs/monk-props-v6 & panel 4): 40 cm shallow cone (height/diam ~0.36) with radial ribs, rolled rim, apex cap and inner head-ring.
  let hat;
  {
    const RH = 0.198, HH = 0.136;
    const prof = [[0, HH + 0.01], [0.012, HH + 0.008], [0.018, HH + 0.002], [0.021, HH - 0.004]];
    for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push([0.02 + (RH - 0.02) * t, (HH - 0.005) * (1 - t) + 0.004 * Math.sin(Math.PI * t) + 0.002]); }
    prof.push([RH + 0.003, 0], [RH, -0.004]);
    for (let i = 14; i >= 0; i--) { const t = i / 14; prof.push([0.016 + (RH - 0.02) * t, (HH - 0.009) * (1 - t) + 0.004 * Math.sin(Math.PI * t) - 0.003]); }
    const cone = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const cu = cone.attributes.uv, cp = cone.attributes.position;
    for (let i = 0; i < cp.count; i++) cu.setY(i, clamp(Math.hypot(cp.getX(i), cp.getZ(i)) / RH, 0, 1));
    const parts = [
      paint(cone, new THREE.Color(1, 1, 1)),
      paint(new THREE.TorusGeometry(RH, 0.0075, 7, 40).rotateX(Math.PI / 2), new THREE.Color(0.95, 0.9, 0.82)),
      paint(new THREE.SphereGeometry(0.02, 12, 8).scale(1, 0.65, 1).translate(0, HH + 0.003, 0), new THREE.Color(0.95, 0.88, 0.78)),
      paint(new THREE.TorusGeometry(0.078, 0.0055, 6, 28).rotateX(Math.PI / 2).translate(0, HH * 0.42, 0), new THREE.Color(0.88, 0.82, 0.72)),
    ];
    const g = mergeGeometries(parts.map((q) => { q.deleteAttribute("normal"); q.computeVertexNormals(); return q; })).rotateX(-(Math.PI / 2 - 0.1)).translate(0, -0.11, -0.016);
    const tex = straw();
    hat = rigid(g, new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.85, roughness: 0.82, vertexColors: true, side: THREE.DoubleSide, envMapIntensity: 0.32 }), B.hat);
  }

  // He casts no real shadow (the shadow map is drawn once, for the buildings); a soft dark patch goes with him.
  const [pc, px] = canvas(64, 64), gr = px.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); px.fillStyle = gr; px.fillRect(0, 0, 64, 64);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  patch.position.y = 0.03; group.add(patch);
  const sun = { az: 0, len: 1, op: 1 };

  // ---- What the pose is computed from ----
  const rest = bones.map((b) => [b.position.clone(), b.quaternion.clone()]);
  const springs = { trail: spring(), side: spring(), tailX: spring(60, 7), tailZ: spring(60, 7), hatX: spring(55, 6), hatZ: spring(55, 6) };
  const blink = createBlink(), lid = { value: 0 }; let eyed = false, blinking = true;
  let phase = 0, gait = 0, palms = 0, seat = 0, perch = 0, legSit = 0, legKind = null, hopW = 0, lastYaw = null, lastSpeed = 0, turn = 0, accel = 0, drop = 0, bodyHeight = null, hangs = [false, false], pelvisRef = null, stairW = 0, climbing = 0;
  const footY = [null, null], launchY = [null, null], landY = [0, 0], pitchOf = [0, 0], hemScale = [1, 1, 1, 1], targets = [V3(), V3()];
  // Each time a shoe comes down flat, where (the middle of its sole), on what height and pointing which way: yard.js
  // takes these to press his prints into the snow. `lastN`: how many strides each foot had begun a frame ago.
  const steps = [], lastN = [null, null];
  const gq = new THREE.Quaternion(), tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), pq = new THREE.Quaternion();
  const hipL = V3(), kneeL = V3(), ankL = V3(), kneeW = V3(), ankW = V3(), hipW = V3();   // a seated leg, in his frame and in the world
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
  function handFrame(mode, s, out) {
    if (mode === "lap") { _z.set(0, 1, 0); _y.set(s, 0, -0.3).normalize(); }   // (a worn body's: palms up in the lap, fingers in toward each other)
    else if (mode === "thigh") { _y.set(0, 0.15, -1).normalize(); _z.set(0, -1, -0.15).normalize(); }   // palms down on the thighs, fingers forward
    else { _y.set(0, -Math.cos(0.22), -Math.sin(0.22)); _z.set(-s, 0, 0); }   // fingers up and a little forward, palm to palm
    _x.crossVectors(_y, _z).normalize(); _z.crossVectors(_x, _y);
    return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
  }
  // The skirt is lifted off any step it would pass into: its bones are shortened, never more than the cloth needs.
  const SK = SKIRT.map((n) => IDX[n]), hem = [];
  let rp, rsi, rsw;
  // Which of the robe's vertices the skirt bones carry, and how far each hangs: the first `count` vertices are the robe's
  // body (in the robe built here, the sleeves, collar and sash come after them; a sculpted robe is all body).
  function setupHem(count) {
    rp = robe.geometry.attributes.position.array; rsi = robe.geometry.attributes.skinIndex.array; rsw = robe.geometry.attributes.skinWeight.array; hem.length = 0;
    // every bone a hem point hangs from, the thighs included, is posed when the hem is skinned
    const used = new Set([IDX.hips, ...SK]);
    for (let i = 0; i < count; i++) {
      const y = rp[i * 3 + 1]; if (y > 0.5) continue;
      const w = []; let W = 0; for (let k = 0; k < 4; k++) { const b = SK.indexOf(rsi[i * 4 + k]); if (b >= 0 && rsw[i * 4 + k] > 0) { w.push([b, rsw[i * 4 + k]]); W += rsw[i * 4 + k]; } }
      if (W > HEM_SHARE) { hem.push({ i, drop: Math.max(0.05, 0.6 - y), w, W }); for (let k = 0; k < 4; k++) if (rsw[i * 4 + k] > 0) used.add(rsi[i * 4 + k]); }
    }
    hemBones.length = 0; hemBones.push(...used);
  }
  // A bone is never shortened below HEM_FLOOR of its length (the robe of the drawing ends above the knee: drawn up further
  // it shows the trousers' seat). A point is lifted only if the skirt's bones carry a fair share of it (#163): a made body's skirt front is weighted to
  // the thighs as well (tools/novice-tripo.mjs), and a point a thigh carries is carried off the step by that thigh;
  // shortening the skirt's bones for it would only pull the whole skirt up to the waist without moving it.
  const HEM_SHARE = 0.3, HEM_FLOOR = 0.7, HEM_NEXT = 0.85, hemBones = [], mats = [];
  setupHem(torsoCount);
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
      B.hips.updateMatrixWorld(true); for (const b of hemBones) (mats[b] ||= new THREE.Matrix4()).multiplyMatrices(skeleton.bones[b].matrixWorld, skeleton.boneInverses[b]);
      const need = [0, 0, 0, 0]; let any = false;
      for (const h of hem) { skinPoint(h.i, tv); const L = surfaceAt(tv.x, tv.z) + 0.007 - tv.y; if (L <= 0) continue; any = true; for (const [b] of h.w) need[b] = Math.max(need[b], L / (h.drop * h.W)); }
      if (!any) break;
      for (let b = 0; b < 4; b++) if (need[b] > 0) { const sc = B[SKIRT[b]].scale, y = Math.max(HEM_FLOOR, sc.y - need[b] * 1.05); hemScale[b] *= y / sc.y; sc.y = y; }
    }
    // One skirt, not four flaps: no bone hangs shorter than HEM_NEXT of either bone beside it (front, left, back, right go
    // round him), so the cloth is drawn up as a ring and never as a panel gone to the waist beside a full one (#163, the 3D
    // review). A centimetre of hem on a step is a smaller fault than that.
    for (let pass = 0; pass < 2; pass++) for (let b = 0; b < 4; b++) {
      const sc = B[SKIRT[b]].scale, most = Math.max(B[SKIRT[(b + 1) % 4]].scale.y, B[SKIRT[(b + 3) % 4]].scale.y), y = Math.max(sc.y, HEM_NEXT * most);
      if (y > sc.y) { hemScale[b] *= y / sc.y; sc.y = y; }
    }
    B.hips.updateMatrixWorld(true);
  }

  // ---- Helper bones and the beads, for a body that asks for them (#163, #286) ----
  // Under a raised arm: a body made from a sculpted or generated model (tools/novice-tripo.mjs) may weigh the cloth of the
  // armpit against a helper bone of its own on each side, carried by the chest at the shoulder's ball and turned each
  // frame through a share (`k`) of the way the upper arm has swung from where it hangs (its swing, not its twist about
  // its own length): the corrective or "half" joint game rigs use there, so that holding incense at the brow the cloth
  // goes a third of the way, then two thirds, rather than all at once from the chest to the arm. The figure built here
  // has sleeves of their own and needs none; the bones are added after his own, so their numbers follow his bones'.
  const helpers = [];
  function addHelpers(list) {
    if (!list.length || helpers.length) return;
    bones.forEach((b, i) => { b.position.copy(rest[i][0]); b.quaternion.copy(rest[i][1]); b.scale.set(1, 1, 1); });
    group.updateMatrixWorld(true);
    const toGroup = group.matrixWorld.clone().invert(), m = new THREE.Matrix4();
    for (const h of list) {
      const parent = B[h.parent], follow = B[h.follow]; if (!parent || !follow || B[h.name]) throw new Error(`the helper bone ${h.name} cannot be put on this skeleton`);
      const bone = new THREE.Bone(); bone.name = h.name; parent.add(bone);
      bone.position.copy(parent.worldToLocal(follow.getWorldPosition(V3()))); bone.updateMatrixWorld(true);
      // the arm's way in the parent's frame at rest, and the direction it hangs (its own -y)
      const restQ = parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(follow.getWorldQuaternion(new THREE.Quaternion()));
      // bound as his own bones were, with him standing at the origin
      skeleton.bones.push(bone); skeleton.boneInverses.push(m.multiplyMatrices(toGroup, bone.matrixWorld).clone().invert()); B[h.name] = bone;
      helpers.push({ name: h.name, k: h.k, bone, parent, follow, restInv: restQ.clone().invert(), axis: V3(0, -1, 0).applyQuaternion(restQ).normalize() });
    }
    skeleton.boneMatrices = new Float32Array(skeleton.bones.length * 16);
    if (skeleton.boneTexture) { skeleton.boneTexture.dispose(); skeleton.boneTexture = null; }
  }
  const hq = new THREE.Quaternion(), ha = new THREE.Quaternion(), hd = new THREE.Quaternion(), ht = new THREE.Quaternion(), hs = new THREE.Quaternion(), hI = new THREE.Quaternion(), hv = V3();
  function driveHelpers(bind) {
    for (const h of helpers) {
      h.parent.updateWorldMatrix(true, false); h.follow.updateWorldMatrix(true, false);
      if (bind) h.bone.quaternion.identity();
      else {
        // how the arm has turned since the bind pose, in the chest's frame; its swing is what is left once the turn about
        // the way it hung (its twist) is taken out
        hq.copy(h.parent.getWorldQuaternion(hq)).invert(); ha.copy(h.follow.getWorldQuaternion(ha));
        hd.copy(hq).multiply(ha).multiply(h.restInv);
        const p = hv.set(hd.x, hd.y, hd.z).projectOnVector(h.axis); ht.set(p.x, p.y, p.z, hd.w).normalize();
        hs.copy(hd).multiply(ht.invert());
        h.bone.quaternion.slerpQuaternions(hI, hs, h.k);
      }
      h.bone.position.copy(h.parent.worldToLocal(h.follow.getWorldPosition(hv)));
      h.bone.updateMatrixWorld(true);
    }
  }
  // The beads are laid 1.5 cm proud of the robe built here (onBody). A worn body's robe may stand further out (Tripo's,
  // some 3 cm on the chest and 2 cm on the back), and they would sink into it. So once a body is worn, each bead is
  // moved out along the line from his middle (the upright axis at its own height) through its centre until it sits `gap`
  // off the outermost cloth there, in the pose he is bound in; a bead already clear by more than that stays where it is.
  function layBeads(gap = 0.004) {
    const P = beadMesh.geometry.attributes.position, per = P.count / beadAt.length;
    const cloth = [robe, skin].map((s) => { const m = new THREE.Mesh(s.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.updateMatrixWorld(true); return m; });
    const ray = new THREE.Raycaster(), o = V3(), d = V3();
    let moved = 0, most = 0;
    beadAt.forEach(({ c, r }, b) => {
      o.set(0, c.y, 0); d.set(c.x, 0, c.z); const len = d.length(); if (len < 0.02) return; d.normalize();
      ray.set(o, d); const hits = ray.intersectObjects(cloth, false); if (!hits.length) return;
      const want = hits[hits.length - 1].distance + r + gap; if (want <= len) return;
      // the chest bone is not turned in the bind pose, so a shift in his frame is the same in the beads' own
      const sx = d.x * (want - len), sz = d.z * (want - len);
      for (let k = b * per; k < (b + 1) * per; k++) P.setXYZ(k, P.getX(k) + sx, P.getY(k), P.getZ(k) + sz);
      c.x += sx; c.z += sz; moved++; most = Math.max(most, want - len);
    });
    P.needsUpdate = true; beadMesh.geometry.computeBoundingSphere();
    return { beads: beadAt.length, moved, most };
  }

  // The hat's straps are laid on the robe built here too; a worn body's robe stands further out at the shoulders and over
  // the chest, and they sank out of sight in it (#163, the three-column sheet). Each point of a strap's centre line is
  // looked at along its own way out, from 15 cm inside: if the worn cloth there lies further out than `gap` under the
  // strap, that cross-section of the strap is moved out until it is `gap` off (smoothed along the strap, so that it
  // lies as a ribbon and does not kink).
  function layStraps(gap = 0.003) {
    const g = straps.geometry, P = g.attributes.position, cloth = [robe, skin].map((m) => { const c = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); c.updateMatrixWorld(true); return c; });
    const ray = new THREE.Raycaster(), o = V3(), d = V3(), IN = 0.15;
    const shifts = strapLine.map((line) => {
      const raw = line.map(({ p, n }) => { ray.set(o.copy(p).addScaledVector(n, -IN), n); ray.far = IN + 0.08; const hits = ray.intersectObjects(cloth, false); const dist = hits.length ? hits[hits.length - 1].distance - IN : -Infinity; return Math.max(0, dist + gap); });
      return raw.map((_, i) => { let m = 0; for (let k = -3; k <= 3; k++) m = Math.max(m, raw[Math.min(raw.length - 1, Math.max(0, i + k))] * (1 - Math.abs(k) / 4)); return m; });
    });
    const v = V3(); let most = 0;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i); let best = Infinity, at = null, sh = 0;
      strapLine.forEach((line, L) => line.forEach((q, k) => { const dist = q.p.distanceToSquared(v); if (dist < best) { best = dist; at = q; sh = shifts[L][k]; } }));
      if (sh > 0) { v.addScaledVector(at.n, sh); most = Math.max(most, sh); }
      // Clear any remaining horizontal overlap with worn cloth without lifting the strap into the head.
      if (v.y < 0.95) {
        d.set(v.x, 0, v.z); const len = d.length();
        if (len > 0.03) {
          d.divideScalar(len); ray.set(o.copy(v).addScaledVector(d, 0.0005), d); ray.far = 0.03;
          const rh = ray.intersectObjects(cloth, false);
          if (rh.length) { const push = rh[rh.length - 1].distance + gap; v.addScaledVector(d, push); most = Math.max(most, push); }
        }
      }
      P.setXYZ(i, v.x, v.y, v.z);
    }
    P.needsUpdate = true; g.computeBoundingSphere();
    return most;
  }

  let dressed = false;
  return {
    group, skeleton, bones: B, parts: { skin, robe, legs, shoes, hat, straps }, steps,
    /** Seated on a cushion, in the seat's frame (x to his left, y up from the cushion's crown, z the way he faces): each hand's wrist, palm, the way its fingers run and its thumb, where the thumbs meet, `clothTop(x, z)`, how high the lap's cloth lies, and the line each column of the skirt is laid along (`lines`, from behind him round by his right). */
    lap: { hands: lapHands, clothTop, legs: seatRods, handMid: HAND_MID, lines: lapLines },
    get dressed() { return dressed; },
    /** How many of the robe's points, from its first, are its body (trunk and skirt); the sleeves, collar and sash come after them. */
    get robeBody() { return dressed ? robe.geometry.attributes.position.count : torsoCount; },
    // Put the sculpted body (tools/novice.mjs, app/shared/models/novice.glb) on the skeleton in place of the one built here:
    // `geometries` holds a skinned geometry for each of skin, robe, legs and shoes, its joints numbered as `skeleton.bones`
    // are, `material` is what they are drawn with, `robeColor` the robe's own colour (no longer used: it coloured a lap of cloth that seated legs have replaced). The skeleton,
    // its bind pose and everything `update` does are unchanged; what was built here is let go.
    // `o.helpers`: the helper bones the body is weighted to besides these (its glTF's extras.helpers: name, the bone that
    // carries it, the arm it follows and the share of that arm's swing it takes), added before it is put on; `o.beads`
    // or `o.straps` false leaves the beads or the hat's straps where they were laid for the robe built here; `o.skinMaterial`
    // draws the skin with a material of its own.
    get helpers() { return helpers.map((h) => h.name); },
    /** How long each skirt bone hangs this frame (front, left, back, right; 1 is its full length): the hem's lift shortens them. */
    /** The eyelid uniform the skin's material reads (0 open, 1 shut), shared by reference; always 0 unless the body has eyes to close (`dress` with `o.eyes`). */
    get lid() { return lid; },
    /** Whether he blinks: off for a held picture (`?shot`); sitting on a cushion still shuts his eyes. */
    get blinking() { return blinking; }, set blinking(v) { blinking = !!v; },
    get skirt() { return SKIRT.map((n) => +B[n].scale.y.toFixed(3)); },
    get helperRig() { return helpers; },   // each helper's bone, the bone carrying it, the arm it follows, its share and the way the arm hung (for the tests)
    dress(geometries, material, robeColor, o = {}) {
      for (const name of ["skin", "robe", "legs", "shoes"]) { const g = geometries[name]; if (!g?.attributes.skinIndex || !g.attributes.skinWeight) throw new Error(`the sculpted ${name} is not skinned`); }
      const joints = skeleton.bones.length + (helpers.length ? 0 : (o.helpers?.length || 0));
      for (const name of ["skin", "robe", "legs", "shoes"]) { const si = geometries[name].attributes.skinIndex, sw = geometries[name].attributes.skinWeight; for (let i = 0; i < si.count; i++) for (let k = 0; k < si.itemSize; k++) if (si.getComponent(i, k) >= joints && sw.getComponent(i, k) > 0) throw new Error(`the sculpted ${name} is weighted to a bone this skeleton has not got (joint ${si.getComponent(i, k)} of ${joints})`); }
      addHelpers(o.helpers || []);
      // A glTF's vertices come interleaved (position, normal, uv, joints and weights side by side in one buffer), and the
      // hem's lifting reads the robe's arrays three and four to a vertex: each attribute is laid out on its own first.
      for (const g of Object.values(geometries)) for (const [k, a] of Object.entries(g.attributes)) if (/** @type {any} */ (a).isInterleavedBufferAttribute) {
        const flat = new /** @type {any} */ (a.array.constructor)(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) flat[i * a.itemSize + c] = a.getComponent(i, c);
        g.setAttribute(k, new THREE.BufferAttribute(flat, a.itemSize, a.normalized));
      }
      for (const [name, mesh] of Object.entries({ skin, robe, legs, shoes })) { mesh.geometry.dispose(); mesh.geometry = geometries[name]; mesh.material = name === "skin" && o.skinMaterial ? o.skinMaterial : material; }
      setupHem(robe.geometry.attributes.position.count);
      straps.visible = true;
      dressed = true; eyed = !!o.eyes;
      const laid = o.beads === false ? { beads: beadAt.length, moved: 0, most: 0 } : layBeads();
      laid.straps = o.straps === false ? 0 : layStraps(); return laid;
    },
    // Where the light comes from (a direction toward it) and how strong it is, 0..1: his shadow lies away from it,
    // long when it is low.
    shadow: patch,
    setSun(dir, strength) { const flat = Math.hypot(dir.x, dir.z) || 1e-3; sun.az = Math.atan2(-dir.x, -dir.z); sun.len = Math.min(3.4, Math.max(1, flat / Math.max(dir.y, 0.12))); sun.op = 0.35 + 0.65 * Math.min(1, strength); },
    // `speed` in metres a second. `pose`: false to stand or walk, true or "pray" for palms together, "sit" to sit with
    // legs folded (on a cushion), "chair" to sit on a stool as on a chair, "rise" getting up from a seat, "hop" in the air,
    // "bind" for the A-pose he is bound in. `surfaceAt(x, z)` is the ground under a
    // point; `grounding.heightAt` the smooth height his body follows, `grounding.stairs` whether he is on a stair.
    // `grounding.act` is what an observance asks of him over the pose (rites.js): `bow` and `twist` of the trunk and
    // `nod` of the head in radians, `look` the head turned aside (radians, + to his left), `breath` from -1 (out) to 1 (in), and for either hand a place in the world to
    // reach (`hands.left.at`), which way its fingers and palm turn there, and how far it has gone over (`w`, 0 to 1).
    // `grounding.rise` (0 as he leaves the seat, 1 stood up) and `grounding.crouch` (how far his knees give as he lands,
    // in metres) are the getting-up-from-a-seat pose's.
    update(dt, speed, pose, t, surfaceAt, grounding = {}) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1); speed = Math.max(0, speed || 0);
      bones.forEach((b, i) => { b.position.copy(rest[i][0]); b.quaternion.copy(rest[i][1]); b.scale.set(1, 1, 1); });
      if (pose === "bind") { legs.visible = shoes.visible = straps.visible = true; group.updateMatrixWorld(true); driveHelpers(true); return; }
      const pray = pose === true || pose === "pray", sit = pose === "sit", chair = pose === "chair", hop = pose === "hop", rise = pose === "rise", stairs = !!grounding.stairs, ease = (k) => Math.min(1, dt * k);
      const act = grounding.act || null, bow = act?.bow || 0, turnTo = act?.twist || 0, nod = act?.nod || 0, look = act?.look || 0, air = act && act.breath != null ? act.breath : null;
      // Getting up: how far it has gone, and the lean forward over his feet that carries him up (back straight as he lands).
      const rising = rise ? Math.min(1, Math.max(0, grounding.rise ?? 0)) : 0, lean = rise ? 0.3 * Math.sin(Math.PI * Math.min(1, rising / 0.8)) : 0;
      // `seat`: cross-legged on a cushion; `perch`: on a stool, as on a chair.
      seat += ((sit ? 1 : 0) - seat) * ease(3.5); perch += ((chair ? 1 : 0) - perch) * ease(3.5);
      hopW += ((hop ? 1 : 0) - hopW) * ease(14);
      lid.value = eyed ? blink.step(dt, sit && seat > 0.4, blinking) : 0;   // the Tripo body's eyelids (#607): shut once he is mostly down on the cushion, open as he rises
      // His legs fold into the seat as slowly as he sits down; getting up off a raised seat (or hopping) they unfold smoothly
      // to reach the floor, while stepping straight down off a low cushion releases them at once so his shoes never dip underground.
      const kind = sit ? "sit" : chair ? "chair" : null;
      if (kind) { legSit = kind === legKind ? legSit + (1 - legSit) * ease(3.5) : ease(3.5); legKind = kind; }
      else if ((hop || rise) && legSit > 0.02) { legSit *= 1 - ease(14); if (legSit <= 0.02) { legSit = 0; legKind = null; } }
      else { legSit = 0; legKind = null; }
      gait += ((speed > 0.05 && !sit && !chair ? 1 : 0) - gait) * ease(8);
      palms += ((pray ? 1 : 0) - palms) * ease(4);
      // How fast he turns and speeds up: what swings the cloth.
      const yaw = group.rotation.y; let dyaw = lastYaw === null ? 0 : yaw - lastYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); lastYaw = yaw;
      if (dt > 0) { turn = damp(turn, dyaw / dt, 8, dt); accel = damp(accel, (speed - lastSpeed) / dt, 6, dt); } lastSpeed = speed;
      // The stride: short steps for short legs; on a stair, a step to each tread.
      const A = stairs ? STAIR.tread / 2 : clamp(0.07 + 0.055 * speed, 0.07, 0.19), rate = stairs ? Math.PI / STAIR.tread : (0.8 * Math.PI) / (2 * A);
      const pace = speed * rate; phase += dt * pace;
      const step = [0, Math.PI].map((o) => { const u = ((((phase + o) / TAU) % 1) + 1) % 1; if (u < 0.5) return { off: A * (1 - 4 * u), lift: 0, u, w: -1 }; const w = (u - 0.5) * 2; return { off: A * (2 * smooth(0, 1, w) - 1), lift: Math.sin(Math.PI * w), u, w }; });
      const lead = step.map((s) => (s.off / A) * gait), breathe = Math.sin(t * 1.6);

      // His body follows a smooth height over the steps, which the root bone carries; the shoes find each tread.
      group.updateWorldMatrix(true, false); group.getWorldQuaternion(gq);
      const rootY = group.matrixWorld.elements[13];
      let lift = 0;
      if (surfaceAt && seat < 0.01 && perch < 0.01 && !hop && !rise) {
        const want = grounding.heightAt ? grounding.heightAt(group.position.x, group.position.z) : rootY;
        bodyHeight = bodyHeight === null || Math.abs(want - bodyHeight) > 1.2 ? want : damp(bodyHeight, want, 18, dt);
        lift = clamp(bodyHeight - rootY, -0.35, 0.2);
      } else bodyHeight = rootY;
      // (Landing from a seat, `crouch` lets his knees give a little under him before he stands straight.)
      // (A worn body, made elsewhere, sits as it did: the seat worked out here is for the robe built here, `lapSeat`.)
      const lapSeat = !dressed;
      B.root.position.z = lapSeat ? -SEAT_LEGS.back * smooth(LAP.sitFrom, LAP.sitTo, seat) : 0;
      // (onto a cushion he comes down as the robe is laid over his folding legs, the one with the other: `down` is both)
      const down = lapSeat ? smooth(LAP.sitFrom, LAP.sitTo, seat) : seat;
      B.root.position.y = lift - SIT_DROP * perch - (lapSeat ? CUSHION_DROP : SIT_DROP) * down + Math.sin(t * 0.9) * 0.006 * seat - (rise ? Math.max(0, grounding.crouch || 0) : 0);

      // The spine, posed directly: the pelvis turns with the leading leg, the chest against it; he leans into his walk,
      // bows to pray, and otherwise carries his face a little up.
      const twist = -0.045 * (lead[0] - lead[1]);
      B.hips.position.y += 0.0025 * breathe * (1 - gait);
      B.hips.position.z += 0.035 * perch;   // on a stool he sits toward its front edge, so that his shins hang clear of it
      B.hips.rotation.set(0, twist, 0.022 * Math.sin(phase) * gait);
      B.spine.rotation.set(0.025 * gait + 0.04 * palms + (lapSeat ? 0 : 0.04 * seat) + 0.05 * perch + 0.5 * bow + lean, -twist * 0.5 + 0.5 * turnTo, 0);
      B.chest.rotation.set(0.03 * gait + 0.05 * palms + 0.006 * breathe + 0.4 * bow + 0.6 * lean - 0.035 * (air || 0), -twist * 0.9 + 0.5 * turnTo, -0.012 * Math.sin(phase) * gait);
      B.neck.rotation.x = -0.03 * gait - 0.25 * lean;   // (rising, his face stays up as his trunk comes over his feet)
      B.head.rotation.set(-0.06 * (1 - palms) * (1 - seat) * (1 - perch) + 0.2 * palms + (lapSeat ? 0.04 : 0.14) * seat + 0.05 * perch + 0.015 * Math.sin(phase * 2) * gait + 0.1 * bow + nod, twist * 0.4 + 0.6 * look, -0.018 * Math.sin(phase) * gait);
      // A breath taken on purpose shows: the chest fills and rises, the shoulders with it; the head keeps its size.
      if (air !== null) { const k = 0.5 + 0.5 * air; B.chest.scale.set(1 + 0.035 * k, 1, 1 + 0.06 * k); B.neck.scale.set(1 / (1 + 0.035 * k), 1, 1 / (1 + 0.06 * k)); B.chest.position.y += 0.007 * k; for (const [n] of SIDES) B[n + "Shoulder"].position.y += 0.006 * k; }

      // The legs reach for the ground under each shoe. Getting up off a seat, they hang straight down until his feet are
      // nearly there (`rising` past a half): reached for from the top of the drop, the floor's pull would set them on it
      // at once and he would slide down planted, not come down on them.
      const sitW = Math.max(seat, perch), legsShown = legSit < 0.9, thigh = [0, 0];
      legs.visible = shoes.visible = true;
      if (!hop && legsShown && !(rise && rising < 0.5)) {
        group.updateMatrixWorld(true);
        SIDES.forEach(([, s], i) => {
          tv.set(s * FOOT_X, 0, FOOT_Z + step[i].off * gait);
          let ground = -Infinity;
          for (const pr of PROBES) { tv2.copy(pr).applyAxisAngle(UPV, s * TOE_OUT).add(tv); tv2.y = 0; group.localToWorld(tv2); ground = Math.max(ground, surfaceAt ? surfaceAt(tv2.x, tv2.z) : rootY); }
          // At the side of a stair the ground under one shoe can be metres below the treads under the other. That shoe
          // hangs, a tread below the body at most, and does not count when the pelvis is lowered to reach: reaching for it
          // would bring him down through the stair.
          hangs[i] = false;
          if (surfaceAt && grounding.heightAt && bodyHeight !== null && ground < bodyHeight - 0.3) { ground = bodyHeight - 0.3; hangs[i] = true; }
          if (footY[i] !== null && Math.abs(footY[i] - ground) < 0.6 && dt > 0) ground = Math.max(ground, damp(footY[i], ground, 16, dt));   // down a step gently, never through it
          footY[i] = ground;
          // On a stair a shoe in the air goes by its own path from the tread it left to the one it will come down on; the
          // pelvis below then rides on the feet's heights. Elsewhere: the plain arc.
          const w = step[i].w; let y = ground + step[i].lift * gait * 0.05, pitch = 0, landing = ground;
          if (w < 0) launchY[i] = ground;
          else if (stairs && surfaceAt && launchY[i] !== null) {
            // where it will come down: the body goes on by the rest of the tread as the foot completes its swing
            tv2.set(s * FOOT_X, 0, FOOT_Z + A + (1 - w) * 2 * A); landing = -Infinity;
            for (const pr of PROBES) { tv.copy(pr).applyAxisAngle(UPV, s * TOE_OUT).add(tv2); tv.y = 0; group.localToWorld(tv); landing = Math.max(landing, surfaceAt(tv.x, tv.z)); }
            const sw = swingOnStair(launchY[i], landing, w, ground);
            y = ground + gait * (sw.y - ground); pitch = gait * sw.pitch;
            y += STAIRGAIT.toeLen * Math.sin(Math.max(pitch, 0)) + STAIRGAIT.heelLen * Math.sin(Math.max(-pitch, 0));   // a toe down raises the heel, a toe up the toe
          }
          landY[i] = w < 0 ? ground : landing; pitchOf[i] = pitch;
          group.localToWorld(targets[i].copy(tv.set(s * FOOT_X, 0, FOOT_Z + step[i].off * gait))); targets[i].y = y + ANKLE;
        });
        // The pelvis rides on the feet that carry him: the height of the stance foot, passing to the landing one as its
        // weight comes over. (A straight slope under him, as before, made the foot left behind on a higher tread fold its
        // knee on the way down and the lifted one come up to meet a pelvis that had already risen.)
        stairW += (((stairs && surfaceAt && gait > 0.02) ? 1 : 0) - stairW) * ease(6);
        if (pelvisRef === null || !stairs) pelvisRef = bodyHeight;
        if (stairW > 0.002 && bodyHeight !== null) {
          let l0 = loadOf(step[0].u), l1 = loadOf(step[1].u);
          l0 = 0.5 + (l0 - 0.5) * gait; l1 = 0.5 + (l1 - 0.5) * gait;
          if (hangs[0] && !hangs[1]) { l0 = 0; l1 = 1; } else if (hangs[1] && !hangs[0]) { l0 = 1; l1 = 0; }
          // Going up, the body is pushed up by the foot behind it and the feet's heights alone would make him bob, so there the
          // slope's own smooth line counts for half; going down, the feet alone: the body is let down onto the lower one.
          const sw = step[0].w >= 0 ? 0 : 1, dh = landY[sw] - launchY[sw];
          if (launchY[sw] !== null && Math.abs(dh) > STAIRGAIT.kind) climbing += ((dh > 0 ? 1 : 0) - climbing) * ease(8);
          const follow = 1 - (1 - STAIRGAIT.upFollow) * smooth(0, 1, climbing);
          const H = follow * ((l0 * landY[0] + l1 * landY[1]) / (l0 + l1 || 1) - STAIRGAIT.sag) + (1 - follow) * bodyHeight;
          pelvisRef = Math.abs(H - pelvisRef) > 1.2 ? H : damp(pelvisRef, H, 12, dt);
          B.root.position.y += stairW * (clamp(pelvisRef - rootY, -0.35, 0.2) - lift);
          group.updateMatrixWorld(true);
        }
        // The pelvis comes down when a foot could not otherwise reach its ground.
        let need = 0;
        SIDES.forEach(([n], i) => { if (hangs[i] && !hangs[1 - i]) return; const hip = B[n + "UpperLeg"].getWorldPosition(tv), h = Math.hypot(targets[i].x - hip.x, targets[i].z - hip.z), L = (THIGH + SHIN) * 0.992; need = Math.max(need, hip.y - targets[i].y - Math.sqrt(Math.max(0, L * L - h * h))); });
        drop = dt > 0 ? Math.max(need, damp(drop, need, 10, dt)) : need;
        B.hips.position.y -= Math.max(0, drop);
        B.hips.updateMatrixWorld(true);
        SIDES.forEach(([n, s], i) => {
          const up = B[n + "UpperLeg"], lo = B[n + "LowerLeg"], ft = B[n + "Foot"];
          reach(up, lo, THIGH, SHIN, targets[i], tv2.set(s * 0.15, 0, 1).applyQuaternion(gq), 1);
          up.updateMatrixWorld(true); lo.getWorldQuaternion(tq);
          tq2.setFromAxisAngle(UPV, s * TOE_OUT).multiply(pq.setFromAxisAngle(XV, pitchOf[i])).premultiply(gq);   // the sole flat (on a stair, pitched with the step), the toes a little out
          ft.quaternion.copy(tq.invert().multiply(tq2));
          tv.set(0, -1, 0).applyQuaternion(up.quaternion); thigh[i] = Math.atan2(tv.z, -tv.y);
        });
        // A shoe has come down when its stride turns over from the swing into the stance.
        SIDES.forEach(([, s], i) => {
          const n = Math.floor((phase + i * Math.PI) / TAU), was = lastN[i]; lastN[i] = n;
          if (was === null || n === was || gait < 0.5) return;
          tv.set(0, 0, 0.03).applyAxisAngle(UPV, s * TOE_OUT); tv.x += s * FOOT_X; tv.z += FOOT_Z + step[i].off * gait; group.localToWorld(tv);
          // `late`: how long ago in this frame the shoe came down, so the sound can keep an even time on a slow frame.
          const late = Math.min(dt, ((((phase + i * Math.PI) % TAU) + TAU) % TAU) / Math.max(1e-3, pace));
          steps.push({ x: tv.x, z: tv.z, y: footY[i], yaw: group.rotation.y + s * TOE_OUT, side: s, late });
        });
      } else lastN[0] = lastN[1] = null;
      // In the air (`hop`), his legs tuck up as a jump's do, and his shoes go up with him: they never reach for the floor
      // he has left until he is standing on it again (a body dropped into the air, walked through a test, must not be
      // drawn planted on the floor below it).
      if (hop) {
        SIDES.forEach(([n], i) => {
          const up = B[n + "UpperLeg"], lo = B[n + "LowerLeg"], ft = B[n + "Foot"];
          up.rotation.set(-0.55 - 0.1 * i, 0, 0); lo.rotation.set(1.0, 0, 0); ft.rotation.set(-0.4, 0, 0);
          thigh[i] = 0.6 + 0.1 * i;
        });
      }
      // Seated, the legs are put where the seat has them, in his own frame, whose floor is the seat's top. On a stool, as
      // on a chair: the thighs level and the shins hanging, a little forward of the stool's swell (a stool is a grown
      // man's height, and a child's feet do not reach the floor). On a cushion, cross-legged upon it: the knees out on
      // its edge, the shins folded before him, the left in front.
      // Sitting down (or unfolding off a stool into a hop), the seated legs are blended smoothly with the current legs.
      if (legSit > 0.02) {
        const onStool = legKind === "chair", w = !onStool && lapSeat ? smooth(LEG_FOLD[0], LEG_FOLD[1], legSit) : smooth(0.02, 0.9, legSit);
        group.updateMatrixWorld(true);
        SIDES.forEach(([n, s], i) => {
          const up = B[n + "UpperLeg"], lo = B[n + "LowerLeg"], ft = B[n + "Foot"];
          q0.copy(up.quaternion); q1.copy(lo.quaternion); q2.copy(ft.quaternion);
          group.worldToLocal(up.getWorldPosition(hipL));
          if (onStool) {
            kneeL.copy(hipL).addScaledVector(tv.set(s * 0.12, -0.05, 1).normalize(), THIGH);
            ankL.copy(kneeL).addScaledVector(tv.set(-s * 0.08, -1, 0.14).normalize(), SHIN);
          } else if (!lapSeat) {
            const front = s > 0 ? 0.04 : 0;
            kneeL.copy(hipL).addScaledVector(tv.set(s * 0.235, 0.075, 0.13 + front).sub(hipL).normalize(), THIGH);
            ankL.copy(kneeL).addScaledVector(tv.set(-s * 0.959, 0, -0.283), SHIN); ankL.z += front * 0.5;
          } else {
            // (the seat's frame is his own, with the cushion's crown at his feet: SEAT_LEGS)
            const leg = seatRods[i];
            // (while he is still coming down the legs are folded under him at the height his hips have reached, so they go
            // down with him under the robe, rather than lying on the cushion below a body still in the air)
            const high = CUSHION_DROP * (1 - down);
            kneeL.copy(hipL).addScaledVector(tv.set(leg.knee[0], leg.knee[1] + high, leg.knee[2] - SEAT_LEGS.back).sub(hipL).normalize(), THIGH);
            ankL.copy(kneeL).addScaledVector(tv.set(leg.ankle[0], leg.ankle[1] + high, leg.ankle[2] - SEAT_LEGS.back).sub(kneeL).normalize(), SHIN);
          }
          group.localToWorld(kneeW.copy(kneeL)); group.localToWorld(ankW.copy(ankL)); group.localToWorld(hipW.copy(hipL));
          const pole = tv2.copy(kneeW).sub(hipW.add(ankW).multiplyScalar(0.5));   // (hipW is not needed after this)
          if (hop || (rise && rising < 0.5)) {
            reach(up, lo, THIGH, SHIN, ankW, pole, 1);
            up.quaternion.slerpQuaternions(q0, up.quaternion, w); lo.quaternion.slerpQuaternions(q1, lo.quaternion, w);
          } else {
            // While he folds in (or the ground-reaching legs are still his), the ankle is moved from where it stood on the
            // floor to where the seat has it, and the leg solved for that point: blending the joints' turns instead can
            // carry the shoe through the floor halfway.
            if (legsShown && w < 1) { ankW.lerpVectors(targets[i], ankW, w); pole.lerp(tv.set(s * 0.15, 0, 1).applyQuaternion(gq), 1 - w); }
            reach(up, lo, THIGH, SHIN, ankW, pole, 1);
          }
          ft.quaternion.setFromAxisAngle(XV, onStool ? 0.45 : 1.0);   // the feet hang, toes a little down; folded, they lie along the shin
          qc.copy(ft.quaternion); ft.quaternion.slerpQuaternions(q2, qc, w);
          // Folded under the robe, the loose trousers are pressed in by the cloth lying on them (the joints stay where they are).
          if (!onStool && !dressed) { const tuck = 1 - SEAT_LEGS.tuck * w; up.scale.set(tuck, 1, tuck); lo.scale.set(tuck, 1, tuck); }
        });
      }

      // The arms hang a little out from his sides and swing against the legs; to pray, or seated, they reach.
      SIDES.forEach(([n, s], i) => {
        const ua = B[n + "UpperArm"], la = B[n + "LowerArm"], hd = B[n + "Hand"], swing = -lead[i] * 0.32;
        ua.rotation.set(-swing * (1 - hopW) - 0.3 * hopW, 0, s * ((0.42 - 0.03 * gait) * (1 - hopW) + 0.58 * hopW));
        la.rotation.set(-(0.22 + 0.35 * Math.max(0, swing)) * (1 - hopW) - 0.5 * hopW, -s * 1.15, 0);
        hd.rotation.set(-0.1 * (1 - hopW), 0, s * 0.05 * (1 - hopW));
        const w = Math.max(palms, seat, perch);
        if (w < 0.001) return;
        q0.copy(ua.quaternion); q1.copy(la.quaternion); q2.copy(hd.quaternion);
        // Palms together before the chest; on a cushion, the hands in the lap, the left lying on the right with the
        // thumbs meeting; on a stool, the palms resting on the thighs.
        const mode = palms >= Math.max(seat, perch) ? "pray" : perch > seat ? "thigh" : "lap", anchor = mode === "pray" ? B.chest : B.hips;
        group.updateMatrixWorld(true);
        if (mode === "pray") anchor.localToWorld(tv.set(s * 0.0125, 0.02, 0.165));
        else if (mode === "lap" && !lapSeat) anchor.localToWorld(tv.set(s * 0.012, 0.055 + (s > 0 ? 0.012 : 0), 0.13));
        else if (mode === "lap") { tv.copy(lapHands[n].wrist); tv.z -= SEAT_LEGS.back; tv.y += CUSHION_DROP * (1 - down); group.localToWorld(tv); }
        else anchor.localToWorld(tv.set(s * 0.085, 0.062, 0.14));
        reach(ua, la, UPPER, FORE, tv, (mode === "lap" && !lapSeat ? tv2.set(s, -0.2, -0.6) : mode === "lap" ? tv2.set(s * LAP_HAND.elbow[0], LAP_HAND.elbow[1], LAP_HAND.elbow[2]) : tv2.set(s, mode === "pray" ? -1.3 : -0.8, mode === "pray" ? -0.35 : -0.5)).applyQuaternion(gq), -1);
        ua.updateMatrixWorld(true);
        if (mode === "lap" && lapSeat) tq.copy(gq).multiply(lapHands[n].q); else anchor.getWorldQuaternion(tq).multiply(handFrame(mode, s, tq2));
        la.getWorldQuaternion(qa); hd.quaternion.copy(qa.invert().multiply(tq));
        qa.copy(ua.quaternion); qb.copy(la.quaternion); qc.copy(hd.quaternion);
        ua.quaternion.slerpQuaternions(q0, qa, w); la.quaternion.slerpQuaternions(q1, qb, w); hd.quaternion.slerpQuaternions(q2, qc, w);
      });

      // A hand sent somewhere by an observance goes there over whatever the pose had it doing: the elbow down and a
      // little out, the fingers and the palm turned as asked.
      if (act && act.hands) SIDES.forEach(([n, s]) => {
        const h = act.hands[n]; if (!h || !h.at || !(h.w > 0)) return;
        const ua = B[n + "UpperArm"], la = B[n + "LowerArm"], hd = B[n + "Hand"];
        q0.copy(ua.quaternion); q1.copy(la.quaternion); q2.copy(hd.quaternion);
        group.updateMatrixWorld(true);
        reach(ua, la, UPPER, FORE, tv.copy(h.at), tv2.set(s * 0.8, -1, -0.35).applyQuaternion(gq), -1);
        ua.updateMatrixWorld(true);
        if (h.fingers && h.palm) {
          _y.copy(h.fingers).negate().normalize(); _z.copy(h.palm); _x.crossVectors(_y, _z).normalize(); _z.crossVectors(_x, _y);
          tq.setFromRotationMatrix(_m.makeBasis(_x, _y, _z)); la.getWorldQuaternion(qa); hd.quaternion.copy(qa.invert().multiply(tq));
        } else hd.quaternion.copy(q2);
        const w = Math.min(1, h.w); qa.copy(ua.quaternion); qb.copy(la.quaternion); qc.copy(hd.quaternion);
        ua.quaternion.slerpQuaternions(q0, qa, w); la.quaternion.slerpQuaternions(q1, qb, w); hd.quaternion.slerpQuaternions(q2, qc, w);
      });

      // What hangs off him swings: the skirt trails his walk and is pushed by his knees, flares as he turns; the sash's
      // ends and the hat lag on their springs.
      const tr = springs.trail.step(clamp(0.05 * speed + 0.03 * accel, -0.15, SKIRT_TRAIL) * (1 - seat), dt);
      const sd = springs.side.step(clamp(-0.07 * turn * Math.min(1, speed + 0.3), -SKIRT_SWING, SKIRT_SWING) + 0.02 * Math.sin(phase) * gait, dt);
      // A thigh comes up a long way on a stair; cloth does not follow it into a board. The skirt follows the knee as it
      // always did up to SKIRT_FREE and eases to SKIRT_REACH, past which no bone turns on the knee's account.
      const reachOf = (x, to = SKIRT_REACH, free = SKIRT_FREE) => x <= free ? x : free + (to - free) * Math.tanh((x - free) / (to - free));
      const kneeLift = (k, to) => reachOf(0.9 * Math.max(0, k), to) / 0.9, backTurn = (k) => reachOf(tr + 0.7 * Math.max(0, -k), SKIRT_BACK_REACH, SKIRT_BACK_FREE);
      // (Sitting down onto a cushion the knees come up as the legs fold, and the skirt's bones would lift the cloth with
      // them into a ring held out at the height of his lap; the robe built here is laid over the folded legs by its
      // own shape there, so the knees do not lift it, #664.)
      const kneeK = !dressed ? 1 - smooth(KNEE_FADE[0], KNEE_FADE[1], seat) : 1;
      const fwd = kneeK * kneeLift(Math.max(thigh[0], thigh[1])), back = backTurn(Math.min(thigh[0], thigh[1]) * kneeK), lf = kneeK * kneeLift(thigh[0], SKIRT_SIDE), rt = kneeK * kneeLift(thigh[1], SKIRT_SIDE);
      // Seated, the front of the skirt drapes smoothly over his lap and thighs, the sides open over his knees, the back rests on the seat.
      // Climbing stairs: a high knee pushes the code robe's cloth over it forward without lifting the whole hem into a flat board (#615, #642).
      const kneePush = (k) => (dressed || sitW > 0.05 ? 0 : 0.105 * smooth(0.48, 1.48, k));
      const pushF = kneePush(Math.max(thigh[0], thigh[1])), pushL = kneePush(thigh[0]), pushR = kneePush(thigh[1]);
      B.robeFront.position.z += pushF; B.robeFront.position.y -= 0.25 * pushF;
      B.robeLeft.position.z += 0.65 * pushL; B.robeLeft.position.x += 0.14 * pushL;
      B.robeRight.position.z += 0.65 * pushR; B.robeRight.position.x -= 0.14 * pushR;
      const sitDrape = !dressed && robe.morphTargetInfluences?.length ? smooth(DRAPE[0], DRAPE[1], seat) : 0;   // (the lap is laid a little before his legs fold under it, #664)
      if (robe.morphTargetInfluences?.length) robe.morphTargetInfluences[0] = sitDrape;
      if (skin.morphTargetInfluences?.length) skin.morphTargetInfluences[0] = !dressed ? smooth(0, 1, seat) * (1 - palms) : 0;
      const boneSeat = dressed ? seat : 0;
      B.robeFront.rotation.set(tr - 0.9 * fwd - 1.04 * boneSeat - 0.78 * perch, 0, sd);
      B.robeBack.rotation.set(back + 0.32 * boneSeat + 0.22 * perch, 0, sd);
      // each side of the skirt goes with the knee on that side, forward as far as the front does, and a little out
      B.robeLeft.rotation.set(tr - 0.9 * lf + 0.6 * Math.max(0, -thigh[0]) - 0.66 * boneSeat - 0.66 * perch, 0, sd * SKIRT_SIDE_SWING + 0.015 + 0.2 * lf + 0.64 * boneSeat + 0.22 * perch);
      B.robeRight.rotation.set(tr - 0.9 * rt + 0.6 * Math.max(0, -thigh[1]) - 0.66 * boneSeat - 0.66 * perch, 0, sd * SKIRT_SIDE_SWING - 0.015 - 0.2 * rt - 0.64 * boneSeat - 0.22 * perch);
      B.robeFront.scale.y = 1 - 0.04 * boneSeat - 0.18 * perch; B.robeBack.scale.y = 1 - 0.3 * boneSeat - 0.62 * perch;   // on a stool the back of the skirt is gathered on the seat
      B.robeLeft.scale.y = B.robeRight.scale.y = 1 - 0.14 * boneSeat - 0.14 * perch;
      // Seated, the sash's end tucks neatly at the waist under his wrists rather than poking over his hands.
      B.sashTail.scale.y = 1 - (dressed ? 0 : 0.9 * seat);
      B.sashTail.position.z -= dressed ? 0 : 0.01 * seat;
      B.sashTail.rotation.set((dressed ? B.robeFront.rotation.x * (1 - 0.6 * sitW) : B.robeFront.rotation.x * (1 - 0.6 * perch) - 0.12 * seat) - 2.2 * pushF + springs.tailX.step(0.07 * speed + 0.05 * Math.abs(Math.sin(phase)) * gait, dt), 0, springs.tailZ.step(0.09 * Math.sin(phase) * gait + sd, dt));
      B.hat.rotation.set(0.15 + Math.max(-0.02, springs.hatX.step(0.04 * gait * Math.abs(Math.cos(phase)) + 0.02 * gait - 0.01 * accel, dt)) + 0.08 * seat + 0.12 * perch, 0, springs.hatZ.step(0.05 * Math.sin(phase) * gait - 0.05 * turn, dt));
      // (Seated on a cushion too the hat stays on his back: the owner, 2026-11-25, 「改回去」.)
      if (surfaceAt && seat < 0.01 && perch < 0.01 && !hop) liftHem(surfaceAt, dt);

      // The shadow keeps to the ground and to the sun, whichever way he turns.
      const a = sun.az - group.rotation.y, off = (sun.len - 1) * 0.42;
      // (On a cushion it lies on the floor the cushion stands on, SHADOW_SIT under the seat: at the seat's own height the
      // patch, a sheet seen through, cut through his robe in a dark ring, #664.)
      // In the air (a jump, a hop off a porch) the patch stays on the floor under him, as far below the group as that floor
      // is, and thins and spreads with the height (to six tenths as dark and a fifth wider at a jump's top, 0.46 m);
      // seated, or on the way to a seat, it goes with him as before.
      const free = 1 - Math.max(seat, perch), under = free > 0 && surfaceAt ? surfaceAt(group.position.x, group.position.z) : 0;
      const up = free > 0 && Number.isFinite(under) ? Math.max(0, group.position.y - under) * free : 0, jumpAir = Math.min(1, up / 0.46);
      patch.rotation.y = a; patch.scale.set(1 + 0.2 * jumpAir, 1, sun.len * (1 + 0.2 * jumpAir)); patch.position.set(Math.sin(a) * off, 0.03 - up - SHADOW_SIT * seat, Math.cos(a) * off); patch.material.opacity = sun.op * (1 - 0.4 * jumpAir);
      group.updateMatrixWorld(true);
      if (helpers.length) driveHelpers(false);
    },
  };
}
