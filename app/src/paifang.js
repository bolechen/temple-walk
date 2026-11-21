// A four-post, three-bay, three-tier timber archway (si zhu san jian san lou, a paifang): the one on the axis of the real temple between the
// inner gate and the Wuliang hall (docs/t05/SOURCES.md S23). A separate module on purpose: building.js has no archway and
// is not touched, so the prologue is unchanged. Built in local space: the plane of the posts is z = 0, centred on x = 0,
// the front faces +z, the ground is y = 0.
//
//   const pf = buildPaifang(M);                              // M: createMaterials()
//   pf.group.position.set(x, groundY, z); scene.add(pf.group); // (quarter turns: rotation.y)
//   pf.walk.posts  // the stones, as rectangles already BODY larger: add them to the level's walk.posts, moved to (x, z)
//   pf.walk.roofs  // the three tiers, for the eye and the snow's shelter map
//   pf.passage     // the clear width and headroom of each bay: all three can be walked through
//   pf.board       // where the name board goes (none is drawn: the writing is not decided, docs/t05/CULTURE.md §5)
//
// Every size is in PAIFANG and in docs/t05/SOURCES.md §12 with how far it is sourced: the form is a summary, the sizes are
// our proposal. The Yingzao Fashi has no archway; the bracket sets are drawn as building.js draws its own.
import * as THREE from "three";
import { box, merge, mesh, plain, smooth, tube, BODY } from "./geo.js";

export const PAIFANG = Object.freeze({
  // Between post axes: the middle bay, and each side bay.
  mid: 4.8, end: 3.6,
  colR: 0.25,
  // The clamp stones (jiaganshi): a plinth, and on it a collar of four slabs that hold the post on all four sides, wider at the foot
  // than at the head (outer size at the foot and at the head, square, a half-tenth of lean), and a cap. A quarter of the height under the lower beam.
  stone: Object.freeze({ plinth: [1.4, 0.12, 1.4], collar: [1.10, 1.04], capOver: 0.05, cap: 0.1, top: 1.25 }),
  // The two bands of beams (efang): small beam, filling board, great beam, and the flat plate on top that carries the sets.
  // `y` is the underside of the small beam; the thicknesses are across the archway (z).
  band: Object.freeze({ lower: 5.0, upper: 6.1, xiao: [0.24, 0.26], dian: [0.16, 0.14], da: [0.38, 0.26], plate: [0.12, 0.4], stub: 0.35 }),
  // The bracket sets are drawn at the scale of a standard timber (cai) of 0.16 m: three quarters of buildHall's 0.21 grade.
  cai: 0.16,
  // The roofs: depth front to back (the eave's edge stands out half of it from the post plane), rise from the eave's edge to
  // the ridge, and how far the eaves reach past an outer post (`out`) and past a middle one (`midOut`). The eave purlin lies
  // out from the post plane as in building.js, scaled to this cai.
  roof: Object.freeze({ side: { depth: 3.2, rise: 0.75 }, mid: { depth: 3.4, rise: 0.8 }, out: 1.6, midOut: 1.4, tileOver: 0.12, under: 0.3 }),
  quezi: [0.7, 0.24, 0.2],
});

const COL_EMBED = 0.02;
// The sets are drawn as tall as building.js's (a taller set lifted the roofs off the beams: the art review wants the three roofs close together).
const LIFT = 1.0;
// How far out from the post plane the eave purlin lies on a hall cut to the 0.21 grade (building.js's PURLIN).
const PURLIN = 0.88;

/** Where a part of the archway stands: which parts hold it up (by id; "ground" is the earth) and its box, from its real geometry. */
const boxOf = (geo) => new THREE.Box3().setFromBufferAttribute(geo.attributes.position);

// One bracket set (dougong), outward = +z, base at y = 0, drawn as building.js draws its own: the great block, a short arm along
// the wall and a longer one over it, arms stepping out with a small block at each end, the slanting beak, the last arm.
function bracketSet(K) {
  const arm = (len, y, z, along = "x", h = 0.21, t = 0.15) => {
    const L = len / 2, e = Math.min(0.2, len * 0.22), sh = new THREE.Shape([[-L, h], [L, h], [L, h * 0.5], [L - e * 0.5, h * 0.16], [L - e, 0], [-L + e, 0], [-L + e * 0.5, h * 0.16], [-L, h * 0.5]].map(([a, b]) => new THREE.Vector2(a, b)));
    const g = plain(new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2)); if (along === "z") g.rotateY(-Math.PI / 2);
    return g.translate(0, y, z);
  };
  const dou = (x, y, z, w = 0.21) => box(w, 0.13, w, x, y + 0.065, z);
  return merge([
    box(0.46, 0.17, 0.46, 0, 0.195, 0), box(0.34, 0.11, 0.34, 0, 0.055, 0),
    arm(0.9, 0.28, 0), dou(-0.35, 0.49, 0), dou(0.35, 0.49, 0),
    arm(1.02, 0.28, 0.16, "z"), dou(0, 0.49, 0.6),
    arm(1.32, 0.63, 0), dou(-0.55, 0.84, 0), dou(0.55, 0.84, 0),
    arm(0.9, 0.63, 0.6), dou(-0.35, 0.84, 0.6), dou(0.35, 0.84, 0.6),
    arm(1.5, 0.63, 0.3, "z"),
    new THREE.BoxGeometry(0.13, 0.16, 1.5).rotateX(0.4).translate(0, 0.6, 0.6),
    arm(1.0, 0.8, 0.88),
  ]).scale(K, K, K);
}

// A small hip roof (wudian): the tiled surface, the boards under it, the fascia round the eave, the ridge with its two end
// ornaments, the four hip ridges. `hipL`/`hipR`: whether that end slopes down; an end without one is cut square, against
// the post it butts onto. The surface is a heightfield on a grid laid so that its diagonals follow the hip creases.
function hipRoof(s) {
  const { x0, x1, depth, rise, eaveY, hipL, hipR, under, pu } = s, Dm = depth / 2, N = 7, st = Dm / N;
  const xa = hipL ? x0 + Dm : x0, xb = hipR ? x1 - Dm : x1;
  const dxOf = (x) => Math.min(hipL ? x - x0 : Infinity, hipR ? x1 - x : Infinity);
  const yAt = (x, z) => {
    const dz = Dm - Math.abs(z), dx = dxOf(x), d = Math.min(dz, dx, Dm), t = Math.max(0, 1 - Math.max(dz, dx) / 1.0);
    // the corners turn up a little
    return eaveY + rise * Math.pow(d / Dm, 1.3) + (Number.isFinite(dx) ? 0.12 * t * t : 0);
  };
  const xs = [x0]; if (hipL) for (let i = 1; i <= N; i++) xs.push(x0 + i * st);
  const m0 = xs[xs.length - 1], n = Math.max(1, Math.ceil((xb - m0) / 0.8 - 1e-9));
  for (let i = 1; i <= n; i++) xs.push(m0 + ((xb - m0) * i) / n);
  if (hipR) for (let i = 1; i <= N; i++) xs.push(xb + i * st);
  const zs = Array.from({ length: 2 * N + 1 }, (_, j) => -Dm + j * st);
  const P = (i, j) => [xs[i], yAt(xs[i], zs[j]), zs[j]];
  const top = [], uv = [];
  // one tile triangle: wound to face the sky, its tile rows laid along the eave it falls to
  const tri = (a, b, c) => {
    let [p, q, r] = [a, b, c]; const ny = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]); if (ny > 0) [q, r] = [r, q];
    const cx = (p[0] + q[0] + r[0]) / 3, cz = (p[2] + q[2] + r[2]) / 3, dz = Dm - Math.abs(cz), dx = dxOf(cx), end = dx < dz;
    for (const v of [p, q, r]) { top.push(...v); const d = Math.min(Math.max(end ? dxOf(v[0]) : Dm - Math.abs(v[2]), 0), Dm); uv.push(end ? v[2] : v[0], end ? Math.min(d, 9) : d); }
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1), low = j < N;
    const left = hipL && xs[i + 1] <= x0 + Dm + 1e-6, right = hipR && xs[i] >= xb - 1e-6, slash = left ? low : right ? !low : true;
    if (slash) { tri(a, b, d); tri(a, d, c); } else { tri(a, b, c); tri(b, d, c); }
  }
  const tile = new THREE.BufferGeometry();
  tile.setAttribute("position", new THREE.Float32BufferAttribute(top, 3)); tile.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); tile.computeVertexNormals();
  // The boards seen from below: the same surface a hand lower, turned over.
  const ub = [], un = []; for (let i = 0; i < top.length; i += 9) { const t = (k) => [top[i + k * 3], top[i + k * 3 + 1] - under, top[i + k * 3 + 2]]; for (const v of [t(0), t(2), t(1)]) { ub.push(...v); un.push(0, -1, 0); } }
  const boards = new THREE.BufferGeometry(); boards.setAttribute("position", new THREE.Float32BufferAttribute(ub, 3)); boards.setAttribute("normal", new THREE.Float32BufferAttribute(un, 3)); boards.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  // The fascia closing the eave's edge: along the front, round the sloping ends, back along the rear.
  const path = [];
  for (const x of xs) path.push([x, -Dm]);
  if (hipR) for (const z of zs) path.push([x1, z]);
  for (const x of [...xs].reverse()) path.push([x, Dm]);
  if (hipL) for (const z of [...zs].reverse()) path.push([x0, z]);
  const fp = [], fi = []; path.forEach(([x, z], i) => { const y = yAt(x, z); fp.push(x, y + 0.04, z, x, y - under - 0.06, z); if (i) { const k = (i - 1) * 2; fi.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); } });
  const fascia = new THREE.BufferGeometry(); fascia.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3)); fascia.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((fp.length / 3) * 2).fill(0), 2)); fascia.setIndex(fi); fascia.computeVertexNormals();
  // The ridge ornaments: a low wall of tile courses along the ridge, a curled end at each hipped end, a tube down each hip.
  const ridgeY = eaveY + rise, rh = 0.28, /** @type {THREE.BufferGeometry[]} */ parts = [box(xb - xa + (hipL ? 0.3 : 0), rh + 0.12, 0.22, (xa + xb) / 2, ridgeY - 0.1 + (rh + 0.12) / 2, 0)];
  const k = 0.26, curl = new THREE.Shape([[0, 0], [0.95, 0], [1.0, 0.55], [0.74, 1.1], [0.34, 1.36], [0.1, 1.18], [0.36, 0.98], [0.46, 0.66], [0.22, 0.5], [0, 0.56]].map(([a, b]) => new THREE.Vector2(a * k, b * k)));
  const ends = [];
  for (const [on, sx, x] of [[hipL, -1, xa], [hipR, 1, xb]]) if (on) {
    const c = plain(new THREE.ExtrudeGeometry(curl, { depth: 0.24, bevelEnabled: false }).translate(-k, 0, -0.12));
    if (sx < 0) { c.scale(-1, 1, 1); for (const a of ["position", "uv"]) { const arr = c.attributes[a].array, w = a === "uv" ? 2 : 3; for (let i = 0; i < arr.length; i += w * 3) for (let q = 0; q < w; q++) { const t = arr[i + q]; arr[i + q] = arr[i + w + q]; arr[i + w + q] = t; } } }
    parts.push(c.translate(x + sx * 0.06, ridgeY + rh - 0.1, 0)); ends.push(x + sx * 0.06);
  }
  for (const [on, sx, xc] of [[hipL, -1, xa], [hipR, 1, xb]]) if (on) for (const sz of [-1, 1]) {
    const pts = []; for (let t = 0; t <= 1.0001; t += 0.1) { const d = Dm * (1 - t), x = xc + sx * d, z = sz * d; pts.push(new THREE.Vector3(x, yAt(x, z) + 0.1, z)); }
    parts.push(tube(pts, 0.09));
  }
  // The square-cut end of a roof that butts onto a post: a board closing the gap under the tiles, so that no daylight shows.
  const cut = [];
  for (const [on, x, sx] of [[hipL, x0, 1], [hipR, x1, -1]]) if (!on) {
    const sh = new THREE.Shape(); sh.moveTo(-Dm, eaveY - 0.2); for (let z = -Dm; z <= Dm + 1e-6; z += 0.2) sh.lineTo(z, yAt(x, z) - 0.05); sh.lineTo(Dm, eaveY - 0.2);
    cut.push(plain(new THREE.ShapeGeometry(sh).rotateY(sx * Math.PI / 2).translate(x + sx * 0.005, 0, 0)));
  }
  // The round end tiles (wadang) closing each row of cover tiles along the eave, seen face-on from below.
  const discs = [], cap = new THREE.CircleGeometry(0.055, 8);
  for (let x = x0 + 0.3; x < x1 - 0.3; x += 0.27) for (const sz of [-1, 1]) discs.push(cap.clone().rotateY(sz > 0 ? 0 : Math.PI).translate(x, yAt(x, sz * Dm) + 0.06, sz * (Dm + 0.05)));
  for (const [on, sx, xe] of [[hipL, -1, x0], [hipR, 1, x1]]) if (on) for (let z = -Dm + 0.3; z < Dm - 0.3; z += 0.27) discs.push(cap.clone().rotateY(sx * Math.PI / 2).translate(xe + sx * 0.05, yAt(xe, z) + 0.06, z));
  // The rafters under the boards, from the eave purlin out to the edge: one every third of a metre along the long sides, and round a hipped end.
  const raf = [], stick = (xa2, za, xb2, zb) => {
    const ya = yAt(xa2, za) - under + 0.03, yb = yAt(xb2, zb) - under + 0.03, d = new THREE.Vector3(xb2 - xa2, yb - ya, zb - za), L = d.length();
    raf.push(new THREE.BoxGeometry(0.1, 0.13, L).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((xa2 + xb2) / 2, (ya + yb) / 2 - 0.02, (za + zb) / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()), new THREE.Vector3(1, 1, 1))));
  };
  for (let x = Math.max(xa, x0 + 0.2); x <= Math.min(xb, x1 - 0.2) + 1e-6; x += 0.34) for (const sz of [-1, 1]) stick(x, sz * pu, x, sz * (Dm - 0.05));
  for (const [on, sx, xe] of [[hipL, -1, x0], [hipR, 1, x1]]) if (on) for (let z = -pu + 0.1; z <= pu - 0.1 + 1e-6; z += 0.34) stick(xe - sx * (Dm - pu), z, xe - sx * 0.05, z);
  return { tile, boards, fascia, discs: discs.length ? merge(discs) : null, rafters: raf.length ? merge(raf) : null, ridge: merge(parts), cut: cut.length ? merge(cut) : null, yAt, ridgeY, Dm, xa, xb, ends };
}

// The parts that do not rest on what they say they rest on, and so would hang in the air. `parts` are the records
// `buildPaifang` returns: { id, box, on }. A part rests when its box meets (within `tol`) the box of a part that holds it up,
// and that part itself is held, down to the ground (a part whose box reaches y = 0).
export function loose(parts, tol = 0.01) {
  const byId = new Map(parts.map((p) => [p.id, p])), memo = new Map();
  const meets = (a, b) => a.min.x <= b.max.x + tol && a.max.x >= b.min.x - tol && a.min.y <= b.max.y + tol && a.max.y >= b.min.y - tol && a.min.z <= b.max.z + tol && a.max.z >= b.min.z - tol;
  const held = (p, seen = new Set()) => {
    if (memo.has(p.id)) return memo.get(p.id);
    if (seen.has(p.id)) return false; seen.add(p.id);
    const ok = p.on.some((id) => id === "ground" ? p.box.min.y <= tol : byId.has(id) && meets(p.box, byId.get(id).box) && held(byId.get(id), seen));
    memo.set(p.id, ok); return ok;
  };
  return parts.filter((p) => !held(p)).map((p) => p.id);
}

/**
 * @param {Record<string, any>} M the materials (createMaterials()); any object with these keys will do in a test
 * @param {{ x?: number, z?: number }} [opts] unused for now: the archway is placed by the group it returns
 */
export function buildPaifang(M, opts = {}) {
  const A = PAIFANG, S = A.stone, B = A.band, R = A.roof, K = A.cai / 0.21, r = A.colR, PU = PURLIN * K;
  const g = new THREE.Group(), parts = [];
  // the four post axes
  const cx = [-(A.mid / 2 + A.end), -A.mid / 2, A.mid / 2, A.mid / 2 + A.end];
  const endX = cx[3] + B.stub, midX = cx[2] + B.stub;
  // Every band: its members, from the underside of the small beam up to the plate.
  const level = (y0) => { const t = {}; let y = y0; for (const [k, h] of [["xiao", B.xiao[0]], ["dian", B.dian[0]], ["da", B.da[0]], ["plate", B.plate[0]]]) { t[k] = [y, y + h]; y += h; } return t; };
  const lo = level(B.lower), up = level(B.upper);
  const postTop = { mid: up.da[1] + COL_EMBED, end: lo.plate[0] + COL_EMBED };
  // The tiers: where each roof stands, and the height of its eave purlin.
  const tiers = [];
  const purlinY = (plateTop) => plateTop + LIFT * K, tileY = (py) => py + 0.1 + R.tileOver;
  const mk = (id, spec, plate) => {
    const py = purlinY(plate[1]), Dm = spec.depth / 2, dp = Dm - PU, eaveY = tileY(py) - spec.rise * Math.pow(dp / Dm, 1.3);
    tiers.push({ id, ...spec, py, eaveY, ridgeY: eaveY + spec.rise, plateTop: plate[1] });
  };
  const sideIn = cx[2] + r, sideOut = cx[3] + R.out;
  mk("side-e", { ...R.side, x0: cx[2], x1: sideOut, hipL: false, hipR: true }, lo.plate);
  mk("side-w", { ...R.side, x0: -sideOut, x1: -cx[2], hipL: true, hipR: false }, lo.plate);
  mk("mid", { ...R.mid, x0: -(cx[2] + R.midOut), x1: cx[2] + R.midOut, hipL: true, hipR: true }, up.plate);
  const ao = (x, y, z) => { let a = 1; for (const t of tiers) { const dx = Math.min(x - t.x0, t.x1 - x), dz = t.depth / 2 - Math.abs(z); if (dx > -0.3 && dz > -0.3 && y < t.eaveY + 0.4) a = Math.min(a, 1 - 0.38 * smooth(-0.3, 0.8, Math.min(dx, dz)) * smooth(t.eaveY - 2.4, t.eaveY, y)); } return a; };
  // (a stand-in M in a test may have no names to give)
  const names = new Map(Object.entries(M).map(([k, v]) => [v, k]));
  const add = (id, on, geo, mat, o = {}) => { const m = mesh(geo, mat, { ao, ...o }); g.add(m); parts.push({ id, on, box: boxOf(geo), tris: (geo.index ? geo.index.count : geo.attributes.position.count) / 3, material: names.get(mat) ?? "?" }); return m; };

  // ---- Clamp stones and posts ----
  // The stones are a bluish grey, a little darker than the dressed stone of the halls' steps, and have no coursing: the shader
  // of the cut-stone material, its colour pulled toward grey-blue.
  const stoneMat = M.monolith.clone(), was = M.monolith.onBeforeCompile;
  stoneMat.onBeforeCompile = (sh, rr) => { was.call(M.monolith, sh, rr); sh.fragmentShader = sh.fragmentShader.replace("diffuseColor.rgb=col;", "diffuseColor.rgb=col*vec3(.62,.68,.76);"); };
  stoneMat.customProgramCacheKey = () => "paifang-stone";
  names.set(stoneMat, "stone");
  const stones = [];
  cx.forEach((x, i) => {
    const [pw, ph, pd] = S.plinth, [cb, ct] = S.collar, sTop = S.top, hc = sTop - S.cap - ph;
    add(`plinth-${i}`, ["ground"], box(pw, ph, pd, x, ph / 2, 0), stoneMat, { ao: null });
    // The collar: a square frustum, leaning in as it rises, closed round the post on all four sides (the post stands in it, so
    // its hole is not drawn).
    const collar = new THREE.CylinderGeometry(0.5, 0.5, hc, 4, 1, false).rotateY(Math.PI / 4), pos = collar.attributes.position;
    for (let k = 0; k < pos.count; k++) { const w = pos.getY(k) > 0 ? ct : cb; pos.setXYZ(k, Math.sign(pos.getX(k)) * w / 2, pos.getY(k), Math.sign(pos.getZ(k)) * w / 2); }
    collar.computeVertexNormals(); collar.translate(x, ph + hc / 2, 0);
    const slabs = [collar];
    const caps = [box(ct + S.capOver * 2, S.cap, ct + S.capOver * 2, x, sTop - S.cap / 2, 0)];
    add(`slabs-${i}`, [`plinth-${i}`], merge(slabs), stoneMat, { ao: null }); add(`caps-${i}`, [`slabs-${i}`], merge(caps), stoneMat, { ao: null });
    // the one upright joint between the two stones that hold the post, front and back (the iron bands round it are left out)
    const lean = Math.atan((cb - ct) / 2 / hc), zf = (cb + ct) / 4 - 0.004;
    add(`seam-${i}`, [`slabs-${i}`], merge([-1, 1].map((sz) => new THREE.BoxGeometry(0.03, hc, 0.02).rotateX(-sz * lean).translate(x, ph + hc / 2, sz * zf))), M.iron, { ao: null, cast: false });
    stones.push({ x, z: 0, x0: x - pw / 2, x1: x + pw / 2, z0: -pd / 2, z1: pd / 2, top: sTop });
  });
  {
    // a post swells a little above its foot and is drawn in toward its head, as the halls' columns are; the shaft is drawn one metre tall and stretched
    const shaft = new THREE.LatheGeometry([[r, 0], [r * 1.02, 0.12], [r, 0.5], [r * 0.95, 0.88], [r * 0.9, 1]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
    cx.forEach((x, i) => {
      const y0 = S.plinth[1], mid = i === 1 || i === 2, y1 = mid ? postTop.mid : postTop.end;
      add(`post-${i}`, [`plinth-${i}`], shaft.clone().scale(1, y1 - y0, 1).translate(x, y0, 0), M.woodV);
    });
  }

  // ---- Beams: the small beam, the filling board and the great beam, in both bands ----
  const span = (xa, xb, lv, k, th, y0 = lv[k][0], y1 = lv[k][1]) => box(xb - xa, y1 - y0, th, (xa + xb) / 2, (y0 + y1) / 2, 0);
  const posts = (...ix) => ix.map((i) => `post-${i}`);
  // lower: through all four posts, a stub beyond each outer one
  for (const [k, mat] of [["xiao", M.woodX], ["dian", M.woodX], ["da", M.woodX]]) {
    const th = B[k][1], on = k === "xiao" ? posts(0, 1, 2, 3) : [`${k === "dian" ? "xiao" : "dian"}-lower`];
    add(`${k}-lower`, on, span(-endX, endX, lo, k, th), mat, { ao: ao });
  }
  // upper: between the two middle posts, a stub beyond each
  for (const [k, mat] of [["xiao", M.woodX], ["dian", M.woodX], ["da", M.woodX]]) {
    const th = B[k][1], on = k === "xiao" ? posts(1, 2) : [`${k === "dian" ? "xiao" : "dian"}-upper`];
    add(`${k}-upper`, on, span(-midX, midX, up, k, th), mat, { ao: ao });
  }
  // the board between the bands in the middle bay: a framed panel, left without writing (the name board's place)
  {
    const x0 = cx[1] + r + 0.05, x1 = cx[2] - r - 0.05, y0 = lo.da[1], y1 = up.xiao[0], t = 0.09, f = 0.1;
    add("huaban", ["da-lower", "xiao-upper", "post-1", "post-2"], merge([box(x1 - x0, y1 - y0 - f * 2, t, 0, (y0 + y1) / 2, 0), box(x1 - x0, f, t + 0.06, 0, y0 + f / 2, 0), box(x1 - x0, f, t + 0.06, 0, y1 - f / 2, 0), box(f, y1 - y0 - 0.04, t + 0.06, x0 + f / 2, (y0 + y1) / 2, 0), box(f, y1 - y0 - 0.04, t + 0.06, x1 - f / 2, (y0 + y1) / 2, 0)]), M.woodV);
  }
  // the corbels (queti) under the small beam, either side of every post
  {
    const [qw, qh, qd] = A.quezi, list = [];
    cx.forEach((x) => { for (const s of [-1, 1]) list.push(box(qw, qh, qd, x + s * (r + qw / 2 - 0.06), lo.xiao[0] - qh / 2, 0)); });
    add("quezi", ["xiao-lower", ...posts(0, 1, 2, 3)], merge(list), M.woodX);
  }
  // the plates that carry the sets: under each side roof, and over the middle bay
  add("plate-e", ["da-lower"], box(endX - sideIn, B.plate[0], B.plate[1], (endX + sideIn) / 2, (lo.plate[0] + lo.plate[1]) / 2, 0), M.woodX, { ao });
  add("plate-w", ["da-lower"], box(endX - sideIn, B.plate[0], B.plate[1], -(endX + sideIn) / 2, (lo.plate[0] + lo.plate[1]) / 2, 0), M.woodX, { ao });
  add("plate-mid", ["da-upper"], box(midX * 2, B.plate[0], B.plate[1], 0, (up.plate[0] + up.plate[1]) / 2, 0), M.woodX, { ao });

  // ---- Bracket sets and eave purlins ----
  const set = bracketSet(K).scale(1, LIFT, 1);
  // list: { x, z, a }: where each set stands and the way it faces
  const sets = (id, on, plateTop, list) => {
    add(id, [on], merge(list.map((s) => set.clone().rotateY(s.a).translate(s.x, plateTop, s.z))), M.woodX, { ao });
  };
  const faces = (xl) => xl.flatMap((x) => [{ x, z: 0.1, a: 0 }, { x, z: -0.1, a: Math.PI }]);
  // two between the posts, one on the outer post
  const sideX = [cx[2] + A.end / 3, cx[2] + (2 * A.end) / 3, cx[3]];
  sets("sets-e", "plate-e", lo.plate[1], [...faces(sideX), { x: cx[3], z: 0, a: Math.PI / 2 }]);
  sets("sets-w", "plate-w", lo.plate[1], [...faces(sideX.map((x) => -x)), { x: -cx[3], z: 0, a: -Math.PI / 2 }]);
  sets("sets-mid", "plate-mid", up.plate[1], [...faces([-cx[2], -cx[2] / 2, 0, cx[2] / 2, cx[2]]), { x: cx[2], z: 0, a: Math.PI / 2 }, { x: -cx[2], z: 0, a: -Math.PI / 2 }]);
  for (const t of tiers) {
    const Dm = t.depth / 2, xe = t.hipR ? t.x1 - (Dm - PU) : t.x1, xw = t.hipL ? t.x0 + (Dm - PU) : t.x0;
    const pl = [box(xe - xw, 0.2, 0.17, (xe + xw) / 2, t.py, PU), box(xe - xw, 0.2, 0.17, (xe + xw) / 2, t.py, -PU)];
    if (t.hipR) pl.push(box(0.17, 0.2, PU * 2, xe, t.py, 0)); if (t.hipL) pl.push(box(0.17, 0.2, PU * 2, xw, t.py, 0));
    add(`purlin-${t.id}`, [t.id === "mid" ? "sets-mid" : t.id === "side-e" ? "sets-e" : "sets-w", ...(t.id === "mid" ? [] : [t.id === "side-e" ? "post-2" : "post-1"])], merge(pl), M.woodZ, { ao });
  }

  // ---- Roofs ----
  const roofs = tiers.map((t) => {
    const rf = hipRoof({ x0: t.x0, x1: t.x1, depth: t.depth, rise: t.rise, eaveY: t.eaveY, hipL: t.hipL, hipR: t.hipR, under: R.under, pu: PU });
    const on = [`purlin-${t.id}`];
    add(`roof-${t.id}`, on, rf.tile, M.tile, { ao: null }); add(`boards-${t.id}`, [`roof-${t.id}`], rf.boards, M.rafters, { ao: null, cast: false });
    add(`fascia-${t.id}`, [`roof-${t.id}`], rf.fascia, M.fascia, { ao: null });
    if (rf.discs) add(`wadang-${t.id}`, [`roof-${t.id}`], rf.discs, M.tile, { ao: () => 0.7, cast: false });
    if (rf.rafters) add(`rafters-${t.id}`, [`purlin-${t.id}`], rf.rafters, M.woodZ, { ao, cast: false }); add(`ridge-${t.id}`, [`roof-${t.id}`], rf.ridge, M.ridge, { ao: null });
    if (rf.cut) add(`cut-${t.id}`, [`roof-${t.id}`, t.id === "side-e" ? "post-2" : "post-1"], rf.cut, M.gable, { ao: null });
    // a great beam out to each roof corner, from the end set's head
    const cb = [], Dm = t.depth / 2;
    for (const [on2, sx, xs0] of [[t.hipL, -1, t.x0], [t.hipR, 1, t.x1]]) if (on2) for (const sz of [-1, 1]) {
      const sx0 = sx * cx[t.id === "mid" ? 2 : 3], p0 = new THREE.Vector3(sx0, t.py - 0.1, 0), p1 = new THREE.Vector3(xs0 - sx * 0.14, rf.yAt(xs0 - sx * 0.14, sz * (Dm - 0.14)) - R.under - 0.12, sz * (Dm - 0.14));
      const d = p1.clone().sub(p0), L = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize());
      cb.push(new THREE.BoxGeometry(0.16, 0.22, L).applyMatrix4(new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))));
    }
    if (cb.length) add(`corner-${t.id}`, [t.id === "mid" ? "sets-mid" : t.id === "side-e" ? "sets-e" : "sets-w"], merge(cb), M.woodX, { ao, cast: false });
    return { id: t.id, ridgeY: rf.ridgeY, ends: rf.ends };
  });

  // ---- What the walkers read ----
  const sw = S.plinth[0] / 2;
  const walk = { solids: [], decks: [], ramps: [], posts: [], drops: [], roofs: [], rails: [] };
  for (const s of stones) walk.posts.push({ x0: s.x0 - BODY - 0.02, x1: s.x1 + BODY + 0.02, z0: s.z0 - BODY - 0.02, z1: s.z1 + BODY + 0.02, h: s.top });
  for (const t of tiers) walk.roofs.push({ x0: t.x0 - 0.3, x1: t.x1 + 0.3, z0: -t.depth / 2 - 0.3, z1: t.depth / 2 + 0.3, bottom: t.eaveY - R.under - 0.15, inner: lo.xiao[0] - A.quezi[1] - 0.15, top: t.ridgeY + 0.9,
    core: { x0: t.x0 - 0.3, x1: t.x1 + 0.3, z0: -0.5, z1: 0.5 } });
  const bays = /** @type {[number, number, string][]} */ ([[cx[0], cx[1], "end-w"], [cx[1], cx[2], "mid"], [cx[2], cx[3], "end-e"]]).map(([a, b, id]) => ({ id, x0: a + sw, x1: b - sw, clear: b - a - 2 * sw, head: lo.xiao[0] - A.quezi[1] }));
  const board = { x: 0, y: (lo.da[1] + up.xiao[0]) / 2, z: 0.05, w: cx[2] - cx[1] - 2 * r - 0.1, h: up.xiao[0] - lo.da[1] };
  const bounds = new THREE.Box3(); for (const p of parts) bounds.union(p.box);
  // what it costs: triangles in all and by material, meshes drawn before mergeStatic batches them, and how many materials that comes to
  const census = () => {
    /** @type {Record<string, number>} */ const by = {}; for (const p of parts) by[p.material] = (by[p.material] || 0) + p.tris;
    return { triangles: parts.reduce((n, p) => n + p.tris, 0), byMaterial: by, meshes: g.children.length, materials: Object.keys(by).length, parts: parts.length };
  };
  g.userData.paifang = true;
  return { group: g, parts, walk, cols: cx.map((x) => [x, 0]), stones, passage: { bays, headroom: lo.xiao[0] - A.quezi[1] }, tiers: roofs, board, size: { w: bounds.max.x - bounds.min.x, h: bounds.max.y, d: bounds.max.z - bounds.min.z }, bounds, census };
}
