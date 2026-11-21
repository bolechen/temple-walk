// The iron censer before the great hall, after the one that stands at Jingshan: cast in the Wanli reign (1618), in
// three parts, a censer, a pavilion and a cap. Three vase-shaped feet, one toward the visitor; a round body widest
// high up, under a short neck and a thick lip; two flat ears that lean out and turn up; on the lip, a round pavilion
// of banded posts with smoke windows between them, under a broad round eave, a narrower storey under a smaller
// round cap, and the gourd on top (gone from the real one; restored here). The incense is put in through the windows
// and the smoke comes out of them and from under the eaves.
//
// Measured from the one photograph on Wikimedia Commons (File:Ming Censer of Jingshan Temple 2023.jpg) and the
// Hangzhou heritage archive's figures: 2.7 m to the top of the cap as it stands, 3.53 m round the belly (1.12 m
// across). docs/t00/SOURCES.md says what was read and what is only judged.
//
// One unit is a metre; the foot of the censer is at y = 0, its front is +z, the ears are on ±x.
import * as THREE from "three";
import { merge } from "./geo.js";

// What is cast on it, in the board hand: the date down the front of the belly, and the couplet on the two plates
// either side of the front smoke window, the first line on the right as one faces it.
export const CAST = Object.freeze({ date: "萬曆歲次戊午季春吉旦", right: "帶月吐青霓", left: "和雲飛彩鳳" });

// The turned body, as (radius, height) from the foot up: a squat belly widest a little above its middle; a straight neck
// a quarter of the belly's height with two raised bands round it; a thick lip; the flange the pavilion stands on; and
// inside the lip the bed of ash, a centimetre under the flange.
export const BELLY = [[0, 0.42], [0.2, 0.425], [0.38, 0.5], [0.5, 0.62], [0.553, 0.76], [0.56, 0.86], [0.54, 0.97], [0.48, 1.06], [0.4, 1.11], [0.37, 1.13],
  [0.37, 1.17], [0.39, 1.175], [0.39, 1.2], [0.37, 1.205], [0.37, 1.255], [0.39, 1.26], [0.39, 1.285], [0.37, 1.29], [0.37, 1.32],
  [0.41, 1.325], [0.415, 1.38], [0.41, 1.44], [0.45, 1.445], [0.455, 1.475], [0.43, 1.483], [0.32, 1.483], [0.315, 1.472]];
const ASH = [[0.315, 1.472], [0.2, 1.476], [0.08, 1.478], [0, 1.478]];
// A foot, from the ground up: a small flat base, a vase's waist, and then a root that swells and goes on up into the belly, as the
// real feet are cast with the drum and grow out of the lower arc of it (#244). The root's top ring is 7 cm into the belly.
export const FOOT = [[0, 0], [0.11, 0], [0.115, 0.03], [0.085, 0.065], [0.065, 0.11], [0.08, 0.17], [0.1, 0.22], [0.095, 0.28], [0.075, 0.33], [0.078, 0.38], [0.095, 0.43], [0.115, 0.48], [0.123, 0.54], [0.118, 0.62], [0.105, 0.7], [0, 0.71]];
// The two storeys of the pavilion: the circle the posts stand on, the floor and the head of the posts, and how many
// pairs of post and plate part its windows (six on each, as the photograph's front shows two pairs and one at either edge).
const STOREYS = [{ r: 0.385, y0: 1.483, y1: 1.84, windows: 6 }, { r: 0.3, y0: 2.0, y1: 2.3, windows: 6 }];
// The eaves: broad thin discs, the lower as wide as the belly and a little more, the upper a little less, their edges
// thin and drooping; then the cap and the small gourd (restored: the real one's is lost).
const EAVE = [[0.42, 1.84], [0.43, 1.88], [0.585, 1.885], [0.605, 1.872], [0.61, 1.89], [0.5, 1.93], [0.37, 1.98], [0.34, 2.0], [0, 2.0]];
const CAP = [[0.32, 2.3], [0.33, 2.34], [0.51, 2.345], [0.53, 2.335], [0.535, 2.355], [0.45, 2.4], [0.3, 2.5], [0.15, 2.62], [0.08, 2.68], [0.06, 2.7],
  // the gourd
  [0.05, 2.71], [0.06, 2.74], [0.065, 2.77], [0.05, 2.8], [0.028, 2.815], [0.04, 2.835], [0.042, 2.855], [0.03, 2.875], [0.01, 2.89], [0, 2.89]];

export const CENSER = Object.freeze({
  height: 2.89, standing: 2.7,  // with the gourd; and to the top of the cap, as the real one stands without it
  belly: 0.56,                  // its widest, below the ears
  reach: 0.57,                  // how far anything of it reaches from its axis up to 1.2 m, his height with his hat: what he must keep off
  ears: 0.76,                  // and the ears' reach, higher up (above his head: the eye keeps off them, `eyeR` in site.js)
  windowY: [STOREYS[0].y0, STOREYS[0].y1], ash: 1.478, ashR: 0.315,
  legs: [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2; return [Math.sin(a) * 0.36, Math.cos(a) * 0.36]; }),
});

const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// What each part is made of is written in the first texture coordinate, which the material reads (`censerMaterial`):
// the cast lettering is 0..1 into its picture; the iron -1; the ash -1.25; a stick of incense -2 less 0.9 of its place
// among the sticks (the first to be lit are the last to go out), the second coordinate how far up the stick; the red
// stubs of burnt sticks -3.25; a fallen leaf -4.25 and a petal -5.25, the second coordinate its tone.
const KIND = { iron: -1, ash: -1.25, stub: -3.25, leaf: -4.25, petal: -5.25 };
const markUV = (g, u, v = null) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v ?? uv.getY(i)); return g; };
const plainUV = (g) => markUV(g, KIND.iron, -1);
// A seeded draw, so that the incense and the leaves lie the same on every load.
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// The letters are laid out on one picture: the date down the first quarter, the two lines of the couplet down the top
// half of the second and third, and down the fourth the key fret that is cast on the ears.
const CELLS = { date: [0, 10], right: [1, 5], left: [2, 5] }, COLS = 4;
const ROWS = 10;

// A round band (a sill, a lintel) between two angles, at radius r, height y0..y1, thickness t.
const arcBand = (r, t, y0, y1, a0, a1) => [plainUV(new THREE.LatheGeometry([[r - t / 2, y0], [r + t / 2, y0], [r + t / 2, y1], [r - t / 2, y1], [r - t / 2, y0]].map(([u, v]) => new THREE.Vector2(u, v)), 6, a0, a1 - a0))];
// A post with three bands like the joints of bamboo.
function bandedPost(x, z, y0, y1) {
  const h = y1 - y0, list = [new THREE.CylinderGeometry(0.024, 0.026, h, 8).translate(x, y0 + h / 2, z)];
  for (const f of [0.18, 0.5, 0.82]) list.push(new THREE.CylinderGeometry(0.034, 0.034, 0.018, 8).translate(x, y0 + h * f, z));
  return list.map(plainUV);
}
// A flat plate set in the round, facing out at angle a; if `cast` names a line, its outer face carries that line.
function plate(r, a, y0, y1, w, cast) {
  const h = y1 - y0, list = [];
  const body = plainUV(new THREE.BoxGeometry(w, h, 0.022));
  const turn = (g) => g.rotateY(a).translate(Math.sin(a) * r, y0 + h / 2, Math.cos(a) * r);
  list.push(turn(body));
  if (cast) {
    const face = new THREE.PlaneGeometry(w * 0.86, h * 0.92).translate(0, 0, 0.0115), uv = face.attributes.uv, [col, n] = CELLS[cast];
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + 0.08 + uv.getX(i) * 0.84) / COLS, 1 - (n - uv.getY(i) * n) / ROWS);
    list.push(turn(face));
  }
  return list;
}

// One storey of the pavilion: at each parting of its windows a banded post with a narrow plate beside it, the windows
// between open (the smoke comes out of them, the incense goes in), each with a low sill and a fret hanging from its
// lintel; a ring under and over them all. On the first storey the plates either side of the front window carry the couplet.
function storey({ r, y0, y1, windows }, first) {
  const list = [], step = (Math.PI * 2) / windows;
  list.push(plainUV(lathe([[r - 0.03, y0 - 0.005], [r + 0.04, y0 - 0.005], [r + 0.045, y0 + 0.03], [r - 0.03, y0 + 0.03], [r - 0.03, y0 - 0.005]], 36)));
  list.push(plainUV(lathe([[r - 0.02, y1 - 0.03], [r + 0.035, y1 - 0.03], [r + 0.035, y1], [r - 0.02, y1], [r - 0.02, y1 - 0.03]], 36)));
  for (let k = 0; k < windows; k++) {
    const a = step * (k + 0.5), da = 0.042 / r, side = k < windows / 2 ? -1 : 1;   // the partings stand between the windows; the front window is at a = 0
    list.push(...bandedPost(Math.sin(a) * r, Math.cos(a) * r, y0 + 0.03, y1 - 0.03));
    // the plate on the front window's side of the posts either side of it; as one faces it, +x is on the right
    const cast = first && k === 0 ? "right" : first && k === windows - 1 ? "left" : null;
    list.push(...plate(r, a + side * da, y0 + 0.03, y1 - 0.035, 0.045, cast));
    // across the window: a low sill and a thin lintel with a fret hanging from it
    const w0 = a + 0.035 / r + (side > 0 ? da : 0), w1 = a + step - 0.035 / r - (k + 1 < windows / 2 || k === windows - 1 ? da : 0), mid = (w0 + w1) / 2;
    list.push(...arcBand(r, 0.018, y0 + 0.03, y0 + 0.05, w0, w1), ...arcBand(r, 0.018, y1 - 0.06, y1 - 0.035, w0, w1));
    for (const s of [-1, 1]) list.push(plainUV(new THREE.BoxGeometry(0.014, 0.045, 0.016).rotateY(mid + s * 0.16).translate(Math.sin(mid + s * 0.16) * r, y1 - 0.08, Math.cos(mid + s * 0.16) * r)));
    list.push(plainUV(new THREE.BoxGeometry(0.1, 0.014, 0.016).rotateY(mid).translate(Math.sin(mid) * r, y1 - 0.105, Math.cos(mid) * r)));
  }
  return list;
}

// An ear: a broad flat plate rising out of the neck, leaning out and then standing up, its top level with the lower
// eave's underside and turned out a little; the key fret is cast on its faces.
function ear(side) {
  const line = [[0.34, 1.17], [0.45, 1.24], [0.53, 1.33], [0.565, 1.45], [0.575, 1.58], [0.58, 1.67], [0.62, 1.725], [0.7, 1.74]], half = 0.115;   // as tall as the neck and the lower storey, its outer edge a hand's breadth past the belly
  const left = [], right = [];
  line.forEach(([x, y], i) => {
    const [px, py] = line[Math.max(0, i - 1)], [nx, ny] = line[Math.min(line.length - 1, i + 1)], tx = nx - px, ty = ny - py, l = Math.hypot(tx, ty);
    left.push(new THREE.Vector2(x - (ty / l) * half, y + (tx / l) * half)); right.push(new THREE.Vector2(x + (ty / l) * half, y - (tx / l) * half));
  });
  const shape = new THREE.Shape([...left, ...right.reverse()]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 4 }).translate(0, 0, -0.03);
  if (side < 0) {   // mirrored, so every face is turned back the right way round
    g.scale(-1, 1, 1);
    for (const a of Object.values(g.attributes)) for (let i = 0; i < a.count; i += 3) for (let c = 0; c < a.itemSize; c++) { const j = (i + 1) * a.itemSize + c, k = (i + 2) * a.itemSize + c, t = a.array[j]; a.array[j] = a.array[k]; a.array[k] = t; }
    g.computeVertexNormals();
  }
  // its two faces carry the fret, laid along its length; its edges are plain iron
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(n.getZ(i)) < 0.9) { uv.setXY(i, -1, -1); continue; }
    const x = Math.abs(p.getX(i)), y = p.getY(i);
    uv.setXY(i, (3 + Math.min(1, Math.max(0, (x - 0.26) / 0.58))) / COLS, Math.min(1, Math.max(0, (y - 1.04) / 0.84)));
  }
  return g;
}

// The date: a strip lying on the belly down its front, raised a few millimetres.
function dateStrip() {
  const y0 = 0.7, y1 = 1.2, w = 0.085, rows = 24, pos = [], uv = [], idx = [];
  const rAt = (y) => { for (let i = 1; i < BELLY.length; i++) { const [r0, a] = BELLY[i - 1], [r1, b] = BELLY[i]; if (y >= a && y <= b) return r0 + (r1 - r0) * (y - a) / (b - a); } return 0.5; };
  for (let j = 0; j <= rows; j++) {
    const y = y0 + (y1 - y0) * (j / rows), r = rAt(y) + 0.004, da = w / 2 / r, [col] = CELLS.date;
    for (const s of [-1, 1]) { pos.push(Math.sin(s * da) * r, y, Math.cos(s * da) * r); uv.push((col + 0.5 + s * 0.42) / COLS, j / rows); }
  }
  for (let j = 0; j < rows; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// The incense in the ash: sticks put in through the windows and burnt down to different lengths, each with its glowing
// end, and among them the red stubs of the ones burnt out.
export const STICKS = 26;
function incense() {
  const list = [], r = rng(217), y = CENSER.ash;
  const ranks = [...Array(STICKS).keys()].map(() => r()).sort((a, b) => a - b);   // which are still burning, as fewer are
  for (let i = 0; i < STICKS; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.26, h = 0.1 + r() * 0.24, tx = (r() - 0.5) * 0.12, tz = (r() - 0.5) * 0.12;
    const g = new THREE.BoxGeometry(0.0045, h, 0.0045, 1, 4, 1).translate(0, h / 2, 0), uv = g.attributes.uv, p = g.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, -2 - ranks[i] * 0.9, p.getY(k) / h);
    list.push(g.rotateX(tz).rotateZ(tx).translate(Math.sin(a) * d, y - 0.02, Math.cos(a) * d));
  }
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.28, h = 0.02 + r() * 0.05;
    list.push(markUV(new THREE.BoxGeometry(0.004, h, 0.004).translate(0, h / 2, 0).rotateX((r() - 0.5) * 0.3).rotateZ((r() - 0.5) * 0.3).translate(Math.sin(a) * d, y - 0.015, Math.cos(a) * d), KIND.stub, r()));
  }
  return list;
}
// The sticks other visitors set in the ash today (同修留痕, #340): burnt-out stubs, a few more for each person who has offered
// incense in any hall since midnight, up to a ceiling. They stand among the ones above, as cold as they are; nobody's
// own incense is marked. Each is drawn from the same seeded run, so a count that grows only adds stubs, none move.
export const TRACE_STUBS = 60;
/** How many stubs a day's offerings put in: about 3.6 for each doubling of the people, from the first (1 → 4, 100 → 24, 10 000 → 48), never over `TRACE_STUBS`. @param {number} people */
export const traceStubCount = (people) => (people >= 1 ? Math.min(TRACE_STUBS, Math.round(Math.log2(1 + people) * 3.6)) : 0);
/** `k` of them as one geometry at the censer's own origin; null for none. 12 triangles each. @param {number} k */
export function traceStubsGeometry(k) {
  k = Math.min(TRACE_STUBS, Math.max(0, Math.floor(k))); if (!k) return null;
  const r = rng(340), list = [];
  for (let i = 0; i < k; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.29, h = 0.02 + r() * 0.06, tx = (r() - 0.5) * 0.3, tz = (r() - 0.5) * 0.3, w = r();
    list.push(markUV(new THREE.BoxGeometry(0.0045, h, 0.0045).translate(0, h / 2, 0).rotateX(tx).rotateZ(tz).translate(Math.sin(a) * d, CENSER.ash - 0.015, Math.cos(a) * d), KIND.stub, w));
  }
  return merge(list);
}
// Leaves in autumn and petals in spring, a few on the flange and the ash and at its feet (the material shows only
// those of the season): blown in from the court's maples and the plum by the wall.
function fallen() {
  const list = [], r = rng(1618);
  const lie = (kind, w, l, x, y, z) => list.push(markUV(new THREE.CircleGeometry(0.5, kind === KIND.leaf ? 5 : 7).scale(w, l, 1).rotateX(-Math.PI / 2 + (r() - 0.5) * 0.25).rotateY(r() * Math.PI * 2).translate(x, y, z), kind, r()));
  for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, rim = i < 3, d = rim ? 0.43 : 0.42 + r() * 0.08; /* at its feet: under the belly, where he does not tread */ lie(KIND.leaf, 0.05, 0.075, Math.sin(a) * d, rim ? 1.587 : 0.004, Math.cos(a) * d); }
  for (let i = 0; i < 2; i++) { const a = r() * Math.PI * 2, d = r() * 0.22; lie(KIND.leaf, 0.05, 0.075, Math.sin(a) * d, CENSER.ash + 0.004, Math.cos(a) * d); }
  for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = i < 4 ? r() * 0.25 : 0.43; lie(KIND.petal, 0.022, 0.026, Math.sin(a) * d, (i < 4 ? CENSER.ash : 1.586) + 0.003, Math.cos(a) * d); }
  return list;
}

// The whole censer as one geometry, at its own origin.
export function censerGeometry() {
  const list = [lathe(BELLY, 40), lathe(EAVE, 40), lathe(CAP, 40)].map(plainUV);
  for (const [x, z] of CENSER.legs) list.push(plainUV(lathe(FOOT, 12).translate(x, 0, z)));
  STOREYS.forEach((s, i) => list.push(...storey(s, i === 0)));
  list.push(ear(1), ear(-1), dateStrip(), markUV(lathe(ASH, 32), KIND.ash, 0), ...incense(), ...fallen());
  return merge(list);
}

// The picture of the lettering: white where the iron stands up in a letter, black where it is the plate. Drawn when
// the board hand has come; until then the plates are plain.
export function castTexture() {
  if (typeof document === "undefined") return null;
  const cell = 96, c = document.createElement("canvas"); c.width = cell * COLS; c.height = cell * ROWS;
  const x = c.getContext && c.getContext("2d"); if (!x) return null;
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const draw = () => {
    x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `${Math.round(cell * 0.8)}px "Yunjing Bang"`;
    for (const [key, [col, n]] of Object.entries(CELLS)) [...CAST[key]].slice(0, n).forEach((ch, i) => x.fillText(ch, cell * (col + 0.5), cell * (i + 0.53)));
    // the key fret: a square spiral in each square, joined to the next (回纹), with a raised border round it
    x.strokeStyle = "#fff"; x.lineWidth = 5; x.lineCap = "square"; const q = cell / 4, x0 = cell * 3;
    x.strokeRect(x0 + 5, 5, cell - 10, cell * ROWS - 10);
    for (let yy = 0; yy < ROWS * 4; yy++) for (let xx = 0; xx < 4; xx++) {
      const ox = x0 + xx * q, oy = yy * q * 0.5 + 12, s = q * 0.5; if (xx === 0 || xx === 3 || oy > cell * ROWS - 20) continue;
      x.beginPath(); x.moveTo(ox + 2, oy + s); x.lineTo(ox + 2, oy + 2); x.lineTo(ox + s * 1.6, oy + 2); x.lineTo(ox + s * 1.6, oy + s * 0.9); x.lineTo(ox + s * 0.7, oy + s * 0.9); x.lineTo(ox + s * 0.7, oy + s * 0.5); x.stroke();
    }
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load(`${cell}px "Yunjing Bang"`, CAST.date + CAST.right + CAST.left).then(draw, () => {});
  return tex;
}

// Iron four hundred years out of doors: rust over black, the rust thickest on what faces the weather, the black kept
// in the hollows; the letters stand up from their plates and are rubbed a little brighter at their edges. After rain
// it is dark and glistening. The ash is pale grey, pitted where sticks have stood, darker wet; the sticks are brown
// with red stems and a glowing end, which at night lights the ash and the inside of the lip round it. Snow lies on
// the eaves and the cap only: the body and the mouth are warm from what burns in it.
export function censerMaterial(procMat, tex, at = new THREE.Vector3()) {
  const u = { tCast: { value: tex || BLANK }, uAt: { value: at }, uIncense: { value: 0.6 }, uEmber: { value: 0 }, uSeasonK: { value: new THREE.Vector2() }, uWet: { value: 0 } };
  const m = procMat("censer", { roughness: 0.8, metalness: 0.4, envMapIntensity: 0.45 }, `
      vec3 lp=vWP-uAt; float lr=length(lp.xz), kind=vUv2.x, wet=smoothstep(.55,1.,uWet);
      if(kind>=0.||kind>-1.1){
        float r=smoothstep(.25,.7,fbm3(vWP*5.)+.25*vWN.y), pit=n3(vWP*48.);
        col=mix(vec3(.05,.04,.035),vec3(.2,.085,.04),r); col=mix(col,vec3(.11,.05,.03),smoothstep(.6,.9,fbm3(vWP*1.7+3.))*.5);
        col*=.75+.45*pit; rough_=mix(.6,.95,r); bump_=fbm3(vWP*30.)*.003+pit*.0015;
        // dark under the eaves, among the posts and under the belly, where the rain does not reach; the rims of the eaves and
        // the bands that stand out are rubbed and washed paler
        float under=smoothstep(.1,-.6,vWN.y), among=smoothstep(.36,.3,lr)*smoothstep(1.47,1.5,lp.y)*(1.-smoothstep(2.3,2.32,lp.y));
        col*=(1.-.4*under)*(1.-.35*among)*mix(.72,1.,smoothstep(.45,.8,lp.y));
        float rim=smoothstep(.57,.6,lr)*smoothstep(1.86,1.88,lp.y)*(1.-step(1.95,lp.y))+smoothstep(.5,.53,lr)*smoothstep(2.33,2.35,lp.y)*(1.-step(2.4,lp.y));
        col=mix(col,col*1.5+vec3(.03,.012,0.),rim*.7);
        if(kind>=0.){ float g=texture2D(tCast,vUv2).r, e=fwidth(g); col=mix(col*.7,col*1.9+vec3(.07,.035,.012),g); bump_+=g*.004; rough_=mix(rough_,.55,g*(1.-e)); }
        float wf=wet*(.55+.45*smoothstep(-.4,.6,vWN.y)); col*=1.-.42*wf; rough_=mix(rough_,.22,wf*.85);
        // the inside of the lip and the posts round the ash, lit from below by what burns
        float near=smoothstep(.5,.3,lr)*smoothstep(1.84,1.52,lp.y)*smoothstep(1.4,1.5,lp.y);
        emit_+=vec3(1.,.36,.1)*uEmber*near*.5*smoothstep(.1,-.6,dot(normalize(vec3(lp.x,0.,lp.z)+1e-4),vWN))*smoothstep(.4,-.2,vWN.y);   // what faces in toward the fire
      } else if(kind>-1.5){
        float g=fbm3(vWP*14.), hole=smoothstep(.7,.82,n3(vWP*90.));
        col=vec3(.42,.4,.37)*(.82+.3*g)*(1.-.55*hole)*(1.-.45*wet); metal_=0.; rough_=mix(.95,.6,wet); bump_=g*.004-hole*.002;
        emit_+=vec3(1.,.38,.12)*uEmber*(.12+.9*smoothstep(.1,.0,length(lp.xz-vec2(.08,.05)))+.7*smoothstep(.08,.0,length(lp.xz-vec2(-.1,-.07))))*(.6+.4*g);   // two or three ends burning down into the ash
      } else if(kind>-3.){
        float rank=(-kind-2.)/.9, up=vUv2.y; if(!(rank<=uIncense)) discard;
        col=mix(vec3(.38,.05,.035),vec3(.26,.15,.08),step(.2,up)); metal_=0.; rough_=.8;
        float tip=smoothstep(.93,.99,up); col=mix(col,vec3(.35,.33,.3),tip*.7);
        emit_+=vec3(1.,.32,.07)*tip*(1.5+6.*uEmber)*(.85+.15*sin(uT*3.+rank*40.));
      } else if(kind>-3.5){
        col=mix(vec3(.4,.05,.04),vec3(.28,.26,.24),smoothstep(.85,1.,vWN.y)*.6); metal_=0.; rough_=.8;
      } else if(kind>-4.5){
        if(!(uSeasonK.x>=.5)) discard; float t=vUv2.y; col=mix(vec3(.3,.07,.03),vec3(.36,.25,.05),step(.55,t))*(.7+.4*t); col*=1.-.4*wet; metal_=0.; rough_=.75;
      } else {
        if(!(uSeasonK.y>=.5)) discard; col=mix(vec3(.7,.6,.6),vec3(.74,.7,.68),vUv2.y); metal_=0.; rough_=.6;
      }
      if(uSnow>.001){ float sn_=uSnow*smoothstep(1.875,1.885,lp.y)*smoothstep(.35,.75,vWN.y)*smoothstep(.2,.5,fbm3(vWP*3.)+.3);
        col=mix(col,vec3(.82,.86,.92),sn_); rough_=mix(rough_,.85,sn_); metal_*=1.-sn_; emit_+=vec3(.82,.86,.92)*uAmb*.2*sn_; }`, { snow: false });
  const own = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    own(sh, r); Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace("uniform float uSnow, uLamp, uT;", "uniform sampler2D tCast; uniform vec3 uAt; uniform vec2 uSeasonK; uniform float uIncense, uEmber, uWet, uSnow, uLamp, uT;")
      .replace("float rough_=roughness,", "float metal_=metalness; float rough_=roughness,")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor=metal_;");
  };
  // What the season and the hour do to it (mood.js): how much incense is burning, whether its ends glow in the dark,
  // the leaves or petals of the season, and the wet after rain.
  m.userData.setMood = (md) => {
    u.uIncense.value = md.incense ?? 0.6; u.uEmber.value = md.time === "night" ? 1 : md.time === "dusk" ? 0.35 : 0;
    u.uSeasonK.value.set(md.season === "autumn" ? 1 : 0, md.season === "spring" ? 1 : 0); u.uWet.value = md.wet ?? 0;
  };
  m.userData.state = () => ({ incense: u.uIncense.value, ember: u.uEmber.value, leaves: u.uSeasonK.value.x, petals: u.uSeasonK.value.y, wet: u.uWet.value });
  m.customProgramCacheKey = () => "censer2";
  return m;
}
const BLANK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLANK.needsUpdate = true;

// How far a geometry reaches from its axis in each 5 cm band of height: every face is gone over in points two
// centimetres apart, each counted in its own band, so that a tall face with no corner in a band still fills it.
export function reachBands(geo, band = 0.05, top = 3.2) {
  const p = geo.attributes.position, ix = geo.index, out = new Float32Array(Math.ceil(top / band)), n = ix ? ix.count : p.count, v = [0, 0, 0].map(() => [0, 0, 0]);
  for (let t = 0; t < n; t += 3) {
    for (let k = 0; k < 3; k++) { const i = ix ? ix.getX(t + k) : t + k; v[k][0] = p.getX(i); v[k][1] = p.getY(i); v[k][2] = p.getZ(i); }
    const edge = Math.max(Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1], v[0][2] - v[1][2]), Math.hypot(v[1][0] - v[2][0], v[1][1] - v[2][1], v[1][2] - v[2][2]), Math.hypot(v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]));
    const m = Math.max(1, Math.ceil(edge / 0.02));
    for (let a = 0; a <= m; a++) for (let c = 0; c <= m - a; c++) {
      const u = a / m, w = c / m, o = 1 - u - w, x = v[0][0] * o + v[1][0] * u + v[2][0] * w, y = v[0][1] * o + v[1][1] * u + v[2][1] * w, z = v[0][2] * o + v[1][2] * u + v[2][2] * w;
      const b = Math.floor(y / band); if (b >= 0 && b < out.length) out[b] = Math.max(out[b], Math.hypot(x, z));
    }
  }
  return out;
}
// How far the censer reaches from its axis at each height (5 cm bands), measured off its own geometry once.
let REACH = null;
export function censerReach(y) {
  if (!REACH) REACH = reachBands(censerGeometry());
  return y < 0 || y >= REACH.length * 0.05 ? 0 : REACH[Math.floor(y / 0.05)];
}
// The eye that follows him, kept out of the censer: if this frame's eye would stand inside it (coming in toward him
// through it, the censer having come between them), it is brought in along the line to his head until it is clear.
// (For this censer alone, until the following eye itself puts itself out of whatever it has come into the same frame.)
/** @param {number[]} eye @param {number[]} head @param {{x:number,y:number,z:number}} at */
export function clearOfCenser(eye, head, at, margin = 0.1) {
  if (!at) return eye;   // a level with no censer (#409)
  const inside = (/** @type {number[]} */ [x, y, z]) => Math.hypot(x - at.x, z - at.z) < censerReach(y - at.y) + margin;
  if (!inside(eye)) return eye;
  const d = [head[0] - eye[0], head[1] - eye[1], head[2] - eye[2]], l = Math.hypot(d[0], d[1], d[2]);
  for (let s = 0.02; s < l; s += 0.02) { const q = [eye[0] + d[0] * s / l, eye[1] + d[1] * s / l, eye[2] + d[2] * s / l]; if (!inside(q)) return q; }
  return head;
}

// The smoke: a few thin threads out of the windows, one from each, that lean out past the eaves, rise, waver, and
// above a man's height thicken, run together and drift off with the breeze (wind.js), thinning as they go. Each is a
// ribbon turned to the eye in the vertex shader, its edge and its streaks worked out in the fragment shader as the air
// carries them up, so that nothing in it can be counted. One draw for all of them.
export const SMOKE = Object.freeze({ threads: 6, segs: 28, rise: 2.6, lean: 0.55 });
// Where a thread is, `a` of the way up (0..1), for a breeze `wind` [x, z] in m/s: the same sums as the vertex shader.
export function smokeAt(i, a, wind, t = 0) {
  const top = i >= 4, w = (i % 4) * Math.PI / 2 + (top ? Math.PI / 4 : 0), st = STOREYS[top ? 1 : 0], r0 = st.r - 0.05, y0 = st.y0 + 0.12;
  const out = r0 + 0.3 * Math.min(1, a * 6), h = a * SMOKE.rise * (top ? 0.8 : 1);
  const lean = SMOKE.lean * Math.pow(h, 1.4);
  return [Math.sin(w) * out + wind[0] * lean + Math.sin(t * 0.7 - h * 2.6 + i) * 0.06 * a, y0 + h, Math.cos(w) * out + wind[1] * lean + Math.cos(t * 0.53 - h * 2.2 + i * 1.7) * 0.06 * a];
}
export function createSmoke(at, U) {
  const { threads, segs } = SMOKE, pos = [], idx = [];
  for (let i = 0; i < threads; i++) for (let k = 0; k <= segs; k++) for (const s of [-1, 1]) pos.push(i, k / segs, s);
  for (let i = 0; i < threads; i++) for (let k = 0; k < segs; k++) { const b = (i * (segs + 1) + k) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const u = { uAt: { value: at }, uT: U.uT, uWind: U.uWind, uOp: { value: 0.5 }, uCol: { value: new THREE.Color(0.85, 0.86, 0.86) }, uRise: { value: 1 }, uIncense: { value: 0.6 },
    fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform vec3 uAt; uniform float uT, uRise; uniform vec2 uWind; varying vec2 vQ; varying float vA, vH, vI;
      vec3 at(float i, float a){
        float top=step(3.5,i), w=mod(i,4.)*1.5707963+top*.7853982, r0=mix(${(STOREYS[0].r - 0.05).toFixed(3)},${(STOREYS[1].r - 0.05).toFixed(3)},top), y0=mix(${(STOREYS[0].y0 + 0.12).toFixed(3)},${(STOREYS[1].y0 + 0.12).toFixed(3)},top);
        float out_=r0+.3*min(1.,a*6.), h=a*${SMOKE.rise.toFixed(2)}*mix(1.,.8,top)*uRise, lean=${SMOKE.lean.toFixed(2)}*pow(max(h,0.),1.4);
        return uAt+vec3(sin(w)*out_+uWind.x*lean+sin(uT*.7-h*2.6+i)*.06*a, y0+h, cos(w)*out_+uWind.y*lean+cos(uT*.53-h*2.2+i*1.7)*.06*a);
      }
      void main(){
        float i=position.x, a=position.y, s=position.z;
        // (every length divided by is kept off zero: a thread seen straight along its way has no side, and is drawn
        // with none rather than with a number that is not one)
        vec3 c=at(i,a), d=at(i,min(a+.02,1.))-at(i,max(a-.02,0.)), v=cameraPosition-c;
        d/=max(length(d),1e-6); v/=max(length(v),1e-6);
        vec3 side=cross(d,v); side/=max(length(side),1e-6);
        float wid=.02+.5*pow(clamp(a,0.,1.),1.3);
        vec4 mv=viewMatrix*vec4(c+side*s*wid,1.); gl_Position=projectionMatrix*mv;
        vQ=vec2(s,a); vA=clamp(a,0.,1.); vH=a*${SMOKE.rise.toFixed(2)}; vI=i;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; uniform float uOp, uT, uIncense; varying vec2 vQ; varying float vA, vH, vI;
      float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n1(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y); }
      void main(){
        // streaks carried up the thread, and the thread's own edge, soft and wandering
        vec2 q=vec2(vQ.x*(1.+vA*3.)+vI*7.3, vH*3.-uT*.55);
        float n=n1(q*vec2(2.2,1.6))*.55+n1(q*vec2(5.,3.5)+3.)*.3+n1(q*vec2(11.,7.)+7.)*.15, edge=1.-smoothstep(.1+.3*n,1.,abs(vQ.x+(n-.5)*.7*vA));
        float alive=step(vI/6.,uIncense+.05)+step(3.5,vI)*step(.25,uIncense);
        // the up-the-thread share comes from a value interpolated across the ribbon, which on a graphics card can land a
        // hair past 1 at its tip: a power of a number below zero is not a number there, and one such pixel, spread by the
        // bloom, blacked out half the picture (#217). Kept in range, and anything that is not a number is not drawn.
        float k=clamp(vA,0.,1.), a=edge*smoothstep(.0,.18,k)*pow(max(1.-k,0.),1.5)*(.3+.7*n*n)*uOp*min(alive,1.)*(1.-.5*smoothstep(.6,1.,abs(vQ.x)));
        if(!(a>=.004)) discard;
        gl_FragColor=vec4(uCol,clamp(a,0.,1.));
      }` });
  const smoke = new THREE.Mesh(g, mat); smoke.frustumCulled = false; smoke.renderOrder = 2;
  return {
    mesh: smoke,
    state: () => ({ opacity: u.uOp.value, rise: u.uRise.value, threads: SMOKE.threads }),
    // After rain it hangs low and faint over the mouth; in the cold it is whiter and stands straighter (the breeze is
    // the mood's too); at night hardly to be seen; at dawn, after the service, the most of it.
    setMood(m) {
      const wetK = m.wet >= 1 ? 1 : 0;
      u.uRise.value = wetK ? 0.55 : 1; u.uIncense.value = m.incense ?? 0.6;
      u.uOp.value = (m.time === "night" ? 0.06 : 0.14 + 0.1 * (m.incense ?? 0.6)) * (wetK ? 0.6 : 1) * (m.snow ? 1.3 : 1);
      const [cr, cg, cb] = m.snow ? [0.93, 0.94, 0.96] : [0.8, 0.82, 0.82];
      u.uCol.value.setRGB(cr, cg, cb).multiply(new THREE.Color().fromArray(m.fog).lerp(new THREE.Color(1, 1, 1), 0.35));   // smoke takes the colour of the air it is in
    },
  };
}
