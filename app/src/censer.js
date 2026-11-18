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

// The turned body, as (radius, height) from the foot up: belly, neck, lip and the flange the pavilion stands on, and
// inside the lip the bed of ash, a little under the flange.
const BODY = [[0, 0.47], [0.2, 0.475], [0.36, 0.54], [0.48, 0.67], [0.545, 0.84], [0.56, 0.99], [0.545, 1.12], [0.49, 1.23], [0.4, 1.3], [0.36, 1.33],
  [0.355, 1.4], [0.4, 1.405], [0.405, 1.47], [0.4, 1.53], [0.44, 1.535], [0.445, 1.575], [0.42, 1.585], [0.32, 1.585], [0.31, 1.5], [0, 1.5]];
const LEG = [[0, 0], [0.12, 0], [0.125, 0.035], [0.095, 0.075], [0.07, 0.13], [0.085, 0.2], [0.11, 0.27], [0.105, 0.34], [0.075, 0.41], [0.08, 0.46], [0.11, 0.52], [0, 0.56]];
// The two storeys of the pavilion: the circle the posts stand on, the floor and the head of the posts.
const STOREYS = [{ r: 0.375, y0: 1.585, y1: 1.85, windows: 4 }, { r: 0.29, y0: 2.13, y1: 2.375, windows: 4 }];
// The eaves over each storey and the cap.
const EAVE = [[0.41, 1.85], [0.43, 1.92], [0.555, 1.925], [0.57, 1.965], [0.555, 1.99], [0.45, 2.04], [0.34, 2.1], [0.33, 2.13], [0, 2.13]];
const CAP = [[0.32, 2.375], [0.33, 2.42], [0.47, 2.425], [0.485, 2.46], [0.47, 2.48], [0.36, 2.55], [0.22, 2.625], [0.1, 2.68], [0.07, 2.7],
  // the gourd
  [0.06, 2.715], [0.08, 2.75], [0.09, 2.8], [0.075, 2.845], [0.038, 2.875], [0.05, 2.9], [0.064, 2.93], [0.055, 2.965], [0.02, 2.99], [0.012, 3.0], [0, 3.0]];

export const CENSER = Object.freeze({
  height: 3.0, standing: 2.7,   // with the gourd; and as the real one stands without it
  belly: 0.56,                  // its widest, below the ears
  reach: 0.57,                  // how far anything of it reaches from its axis below 1.3 m: what he must keep off
  ears: 0.69,                   // and the ears' reach, higher up
  windowY: [STOREYS[0].y0, STOREYS[0].y1], ash: 1.5,
  legs: [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2; return [Math.sin(a) * 0.36, Math.cos(a) * 0.36]; }),
});

const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// Everything but the cast lettering reads -1 in its texture coordinates, which the material takes as plain iron.
const plainUV = (g) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, -1, -1); return g; };
// The letters are laid out on one picture: the date down the first third, the two lines of the couplet down the top
// half of the second and third.
const CELLS = { date: [0, 10], right: [1, 5], left: [2, 5] };
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
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + 0.08 + uv.getX(i) * 0.84) / 3, 1 - (n - uv.getY(i) * n) / ROWS);
    list.push(turn(face));
  }
  return list;
}

// One storey of the pavilion: a banded post at each parting of the windows, a plate either side of it, a sill and a
// lintel of fretwork across each window, and a ring under and over them all.
function storey({ r, y0, y1, windows }, first) {
  const list = [], step = (Math.PI * 2) / windows, h = y1 - y0;
  list.push(plainUV(lathe([[r - 0.03, y0 - 0.005], [r + 0.04, y0 - 0.005], [r + 0.045, y0 + 0.03], [r - 0.03, y0 + 0.03], [r - 0.03, y0 - 0.005]], 36)));
  list.push(plainUV(lathe([[r - 0.02, y1 - 0.03], [r + 0.035, y1 - 0.03], [r + 0.035, y1], [r - 0.02, y1], [r - 0.02, y1 - 0.03]], 36)));
  for (let k = 0; k < windows; k++) {
    const a = step * (k + 0.5), da = 0.06 / r;   // the partings stand between the windows; the front window is at a = 0
    list.push(...bandedPost(Math.sin(a) * r, Math.cos(a) * r, y0 + 0.03, y1 - 0.03));
    // the plates either side of the parting; on the first storey the two nearest the front window carry the couplet
    const right = first && k === 0, left = first && k === windows - 1;   // as one faces it, +x is on the right
    list.push(...plate(r, a - da, y0 + 0.03, y1 - 0.035, 0.06, right ? "right" : null));
    list.push(...plate(r, a + da, y0 + 0.03, y1 - 0.035, 0.06, left ? "left" : null));
    // across the window: a low sill and a lintel with a fret hanging from it
    const w0 = a + da + 0.03 / r, w1 = a + step - da - 0.03 / r, mid = (w0 + w1) / 2;
    list.push(...arcBand(r, 0.02, y0 + 0.03, y0 + 0.075, w0, w1), ...arcBand(r, 0.02, y1 - 0.09, y1 - 0.035, w0, w1));
    for (const s of [-1, 1]) list.push(plainUV(new THREE.BoxGeometry(0.018, 0.05, 0.02).rotateY(mid + s * 0.18).translate(Math.sin(mid + s * 0.18) * r, y1 - 0.115, Math.cos(mid + s * 0.18) * r)));
    list.push(plainUV(new THREE.BoxGeometry(0.11, 0.016, 0.02).rotateY(mid).translate(Math.sin(mid) * r, y1 - 0.14, Math.cos(mid) * r)));
  }
  return list;
}

// An ear: a flat plate leaning out from the shoulder and turning up, its top bent outward.
function ear(side) {
  const line = [[0.3, 1.27], [0.46, 1.33], [0.55, 1.43], [0.585, 1.56], [0.6, 1.68], [0.64, 1.75], [0.7, 1.76]], half = 0.065;
  const left = [], right = [];
  line.forEach(([x, y], i) => {
    const [px, py] = line[Math.max(0, i - 1)], [nx, ny] = line[Math.min(line.length - 1, i + 1)], tx = nx - px, ty = ny - py, l = Math.hypot(tx, ty);
    left.push(new THREE.Vector2(x - (ty / l) * half, y + (tx / l) * half)); right.push(new THREE.Vector2(x + (ty / l) * half, y - (tx / l) * half));
  });
  const shape = new THREE.Shape([...left, ...right.reverse()]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 4 }).translate(0, 0, -0.03);
  if (side < 0) {   // mirrored, so every face is turned back the right way round
    g.scale(-1, 1, 1);
    for (const a of Object.values(g.attributes)) for (let i = 0; i < a.count; i += 3) for (let c = 0; c < a.itemSize; c++) { const j = (i + 1) * a.itemSize + c, k = (i + 2) * a.itemSize + c, t = a.array[j]; a.array[j] = a.array[k]; a.array[k] = t; }
    g.computeVertexNormals();
  }
  return plainUV(g);
}

// The date: a strip lying on the belly down its front, raised a few millimetres.
function dateStrip() {
  const y0 = 0.7, y1 = 1.2, w = 0.085, rows = 24, pos = [], uv = [], idx = [];
  const rAt = (y) => { for (let i = 1; i < BODY.length; i++) { const [r0, a] = BODY[i - 1], [r1, b] = BODY[i]; if (y >= a && y <= b) return r0 + (r1 - r0) * (y - a) / (b - a); } return 0.5; };
  for (let j = 0; j <= rows; j++) {
    const y = y0 + (y1 - y0) * (j / rows), r = rAt(y) + 0.004, da = w / 2 / r, [col] = CELLS.date;
    for (const s of [-1, 1]) { pos.push(Math.sin(s * da) * r, y, Math.cos(s * da) * r); uv.push((col + 0.5 + s * 0.42) / 3, j / rows); }
  }
  for (let j = 0; j < rows; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// The whole censer as one geometry, at its own origin.
export function censerGeometry() {
  const list = [lathe(BODY, 40), lathe(EAVE, 40), lathe(CAP, 40)].map(plainUV);
  for (const [x, z] of CENSER.legs) list.push(plainUV(lathe(LEG, 12).translate(x, 0, z)));
  STOREYS.forEach((s, i) => list.push(...storey(s, i === 0)));
  list.push(ear(1), ear(-1), dateStrip());
  return merge(list);
}

// The picture of the lettering: white where the iron stands up in a letter, black where it is the plate. Drawn when
// the board hand has come; until then the plates are plain.
export function castTexture() {
  if (typeof document === "undefined") return null;
  const cell = 96, c = document.createElement("canvas"); c.width = cell * 3; c.height = cell * ROWS;
  const x = c.getContext && c.getContext("2d"); if (!x) return null;
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const draw = () => {
    x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `${Math.round(cell * 0.8)}px "Yunjing Bang"`;
    for (const [key, [col, n]] of Object.entries(CELLS)) [...CAST[key]].slice(0, n).forEach((ch, i) => x.fillText(ch, cell * (col + 0.5), cell * (i + 0.53)));
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load(`${cell}px "Yunjing Bang"`, CAST.date + CAST.right + CAST.left).then(draw, () => {});
  return tex;
}

// Iron four hundred years out of doors: rust over black, the rust thickest on what faces the weather, the black kept
// in the hollows; the letters stand up from their plates and are rubbed a little brighter at their edges.
export function censerMaterial(procMat, tex) {
  const m = procMat("censer", { roughness: 0.8, metalness: 0.4, envMapIntensity: 0.45 }, `
      float r=smoothstep(.25,.7,fbm3(vWP*5.)+.25*vWN.y), pit=n3(vWP*48.);
      col=mix(vec3(.05,.04,.035),vec3(.2,.085,.04),r); col=mix(col,vec3(.11,.05,.03),smoothstep(.6,.9,fbm3(vWP*1.7+3.))*.5);
      col*=.75+.45*pit; rough_=mix(.6,.95,r); bump_=fbm3(vWP*30.)*.003+pit*.0015;
      if(vUv2.x>=0.){ float g=texture2D(tCast,vUv2).r, e=fwidth(g); col=mix(col*.8,col*1.35+vec3(.04,.02,.01),g); bump_+=g*.004; rough_=mix(rough_,.55,g*(1.-e)); }`);
  const own = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { own(sh, r); sh.uniforms.tCast = { value: tex || BLANK }; sh.fragmentShader = sh.fragmentShader.replace("uniform float uSnow, uLamp, uT;", "uniform sampler2D tCast; uniform float uSnow, uLamp, uT;"); };
  return m;
}
const BLANK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLANK.needsUpdate = true;
