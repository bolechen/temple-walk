// Baking the floor he may stand on from the meshes as they are drawn (#194, the second step of #161's migration; the
// method is the one tools/spike/meshwalker.mjs measured, laid out as Recast lays out its heightfield):
//
//  1. Gather. Every solid mesh that touches a grid's box goes into one geometry in world space, with a bounding volume
//     hierarchy (three-mesh-bvh) over it. What is drawn but is not there to stand on or be stopped by is left out
//     (flames, mist, smoke, leaves cut out of cards: a ShaderMaterial, a transparent or alpha-tested one), except the
//     ground (ground.js's paving, a ShaderMaterial, marked). A low thing of its own to walk round, not on, is a "post".
//  2. Floors. A ray straight down each cell's centre meets every face; a face that lies flat enough (|n.y| > 0.5) with
//     CLEAR of air over it, to the next face above, is a floor that cell offers (a span), unless that next face looks
//     up and the floor is inside a closed solid (the ground under a terrace's stone: sideways, east and west, the first
//     faces are seen from behind). A cell may offer several: the
//     court, and a roof far over it.
//  3. Which floor. From the seeds (where he comes in), a flood from span to span between neighbouring cells, the floor
//     stepping no more than CLIMB: a roof is never reached, nor a table's top, nor the cap of a railing. Each cell takes
//     the floor the flood reached first; one it never reached has none.
//  4. What stands in his way, and how near. A cell is a border where something drawn stands in it from just over the
//     lowest floor round it up to CLEAR over its own (a wall, a column, a cheek stone), where a neighbour's floor is
//     more than CLIMB above its own (the foot of a ledge: the top of a ledge is not a border, so he may stand at a
//     porch's very edge), or where a neighbour has no floor at all. Every cell nearer a border than his reach at the
//     heights it takes up (his outline, measured from the real models by tools/edges.mjs, every 5 cm of height) is shut.
//  5. What cannot be walked to from the seeds, around the shut cells (a hall's hollow shell, a porch with no stair), is
//     shut too.
//
// The same grid is then asked of the walker of the written plan (createWalker), so that both can be compared while
// both exist (tools/walk-diff.mjs).
import "../../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import { MeshBVH, SAH } from "three-mesh-bvh";
import { readFileSync } from "node:fs";
import { NO_FLOOR } from "../../app/src/walkgrid.js";

export const OUTLINE = JSON.parse(readFileSync(new URL("./outline.json", import.meta.url), "utf8"));
export const BAKE = Object.freeze({
  version: 1,      // raise when the method changes, so that every grid baked by the old one is stale
  step: 0.05,      // metres a cell
  CLIMB: 0.25,     // the highest rise he steps up without a jump (a tread is 0.10-0.17; a low platform 0.30-0.45)
  CLEAR: 1.45,     // the air he needs over a floor: a child, his eye at 1.3
  HEAD: 0.13,      // his reach over the top of his outline (the hat), up to CLEAR
  OLD_STEP: 0.34,  // the most the written plan's floor may step between two cells he walks across (route.js's ROUTE.step)
});

// FNV-1a over 32-bit words: a short name for what a grid was baked from.
export function fnv(words, h = 0x811c9dc5) { for (let i = 0; i < words.length; i++) { h ^= words[i]; h = Math.imul(h, 16777619) >>> 0; } return h; }
const hex = (h) => h.toString(16).padStart(8, "0");
export const textHash = (s) => hex(fnv(new Uint32Array(Uint8Array.from(Buffer.from(s + "\0\0\0".slice(0, (4 - (Buffer.byteLength(s) % 4)) % 4))).buffer)));

/** The fingerprint of his outline and the bake's settings: change either and every grid is stale. */
export const bodyPrint = () => textHash(JSON.stringify({ OUTLINE, BAKE }));

// ---- 1. Gathering ----

// What is drawn but is not there to stand on or be stopped by.
export const airy = (m) => !m || m.type === "ShaderMaterial" || m.type === "PointsMaterial" || m.name === "flame" || m.transparent || m.alphaTest > 0;
// A thing to walk round rather than stand on: until the plan marks these where it draws them (`userData.walk = "post"`,
// the migration's third step), they are found by their shape, as the spike found them: a mesh of its own in a group,
// lower than 0.6 m, standing on a floor, no thinner than 0.4 m across and no wider than 1.2 m (a sill is thinner; a
// sill is a floor his shoes come down on). That is the cushions, the low tables and what stands on them.
const box3 = new THREE.Box3(), size3 = new THREE.Vector3();
export function postLike(o, base = 0) {
  if (o.userData.walk === "post") return true;
  if (o.userData.ground || !o.parent || o.parent.children.length < 4) return false;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  box3.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).getSize(size3);
  return size3.y < 0.6 && Math.min(size3.x, size3.z) > 0.4 && Math.min(size3.x, size3.z) < 1.2 && box3.min.y > base + 0.02 && box3.min.y < base + 2;
}

/**
 * Every solid triangle under `roots` whose bounds touch `box` (x0, x1, z0, z1, and y from `bottom` to `top`), in world
 * space, with the name of what it is made of ("post:" before it for a thing to walk round; "paving" for the ground).
 * @returns {{ bvh: MeshBVH, names: string[], mat: Uint8Array, tris: number, print: string }}
 */
export function gather(roots, box, base = 0) {
  const pos = [], mat = [], names = [], ids = new Map(), v = new THREE.Vector3(), tb = new THREE.Box3(), m4 = new THREE.Matrix4();
  const grow = new THREE.Box3(new THREE.Vector3(box.x0 - 1, box.bottom, box.z0 - 1), new THREE.Vector3(box.x1 + 1, box.top, box.z1 + 1));
  const take = (geo, world, name) => {
    let id = ids.get(name); if (id === undefined) { id = names.length; names.push(name); ids.set(name, id); }
    const p = geo.attributes.position, idx = geo.index, n = idx ? idx.count : p.count, tri = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i + 2 < n; i += 3) {
      tb.makeEmpty();
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(world); tri[k * 3] = v.x; tri[k * 3 + 1] = v.y; tri[k * 3 + 2] = v.z; tb.expandByPoint(v); }
      if (!tb.intersectsBox(grow)) continue;
      for (let k = 0; k < 9; k++) pos.push(tri[k]); mat.push(id);
    }
  };
  for (const root of [roots].flat()) root.traverse((o) => {
    if (!o.isMesh || o.userData.walk === false || !o.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!o.userData.ground && airy(m)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const name = o.userData.ground ? "paving" : (postLike(o, base) ? "post:" : "") + (m.name || m.type);
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); tb.copy(o.geometry.boundingBox).applyMatrix4(m4); if (tb.intersectsBox(grow)) take(o.geometry, m4.clone(), name); } return; }
    tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); if (!tb.intersectsBox(grow)) return;
    take(o.geometry, o.matrixWorld, name);
  });
  const f32 = Float32Array.from(pos), u8 = Uint8Array.from(mat);
  if (names.length > 250) throw new Error(`${names.length} materials in one grid: the cell state keeps one byte`);
  const pad = new Uint8Array(Math.ceil(u8.length / 4) * 4); pad.set(u8);
  const print = `${hex(fnv(new Uint32Array(f32.buffer)))}${hex(fnv(new Uint32Array(pad.buffer)))}${textHash(names.join("\n"))}`;
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(f32, 3));
  const bvh = mat.length ? new MeshBVH(geo, { strategy: SAH, targetLeafSize: 8, indirect: false }) : null;
  return { bvh, names, mat: u8, tris: mat.length, print };
}

// ---- 2-5. Baking ----

// The 2D distance from (px, pz) to the part of a triangle between heights y0 and y1, seen from above; slabY says the
// heights that part takes up.
const clipA = new Float64Array(30), clipB = new Float64Array(30), slabY = [0, 0];
function slabDistance(a, b, c, y0, y1, px, pz) {
  let n = 3, src = clipA, dst = clipB;
  src[0] = a.x; src[1] = a.y; src[2] = a.z; src[3] = b.x; src[4] = b.y; src[5] = b.z; src[6] = c.x; src[7] = c.y; src[8] = c.z;
  for (let pass = 0; pass < 2; pass++) {
    const h = pass ? y1 : y0, keepAbove = !pass; let m = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ay = src[i * 3 + 1], by = src[j * 3 + 1], ain = keepAbove ? ay >= h : ay <= h, bin = keepAbove ? by >= h : by <= h;
      if (ain) { dst[m * 3] = src[i * 3]; dst[m * 3 + 1] = ay; dst[m * 3 + 2] = src[i * 3 + 2]; m++; }
      if (ain !== bin) { const f = (h - ay) / (by - ay); dst[m * 3] = src[i * 3] + (src[j * 3] - src[i * 3]) * f; dst[m * 3 + 1] = h; dst[m * 3 + 2] = src[i * 3 + 2] + (src[j * 3 + 2] - src[i * 3 + 2]) * f; m++; }
    }
    n = m; const s = src; src = dst; dst = s; if (!n) return Infinity;
  }
  let best = Infinity, inside = false; slabY[0] = Infinity; slabY[1] = -Infinity;
  for (let i = 0; i < n; i++) { slabY[0] = Math.min(slabY[0], src[i * 3 + 1]); slabY[1] = Math.max(slabY[1], src[i * 3 + 1]); }
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = src[i * 3], zi = src[i * 3 + 2], xj = src[j * 3], zj = src[j * 3 + 2];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-12) + xi) inside = !inside;
    const ex = xj - xi, ez = zj - zi, L = ex * ex + ez * ez, f = L ? Math.max(0, Math.min(1, ((px - xi) * ex + (pz - zi) * ez) / L)) : 0;
    best = Math.min(best, Math.hypot(px - xi - ex * f, pz - zi - ez * f));
  }
  return inside ? 0 : best;
}

/** His reach from his centre over the heights [lo, hi] above the floor he stands on (his outline, 5 cm bins). */
export function reach(lo, hi) {
  let r = 0; const b = OUTLINE.bin;
  for (let i = Math.max(0, Math.floor(lo / b)); i * b <= hi + 1e-9; i++) r = Math.max(r, i < OUTLINE.reach.length && OUTLINE.reach[i] > 0 ? OUTLINE.reach[i] : BAKE.HEAD);
  return r;
}
const BINS = Math.ceil(BAKE.CLEAR / OUTLINE.bin) + 1, TABLE = new Float32Array(BINS * BINS);
for (let i = 0; i < BINS; i++) for (let j = i; j < BINS; j++) TABLE[i * BINS + j] = reach(i * OUTLINE.bin, j * OUTLINE.bin);
const reachBins = (a, b) => TABLE[Math.min(BINS - 1, a) * BINS + Math.min(BINS - 1, b)];
const MAXR = Math.max(...TABLE);
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Is (x, y, z) inside a closed solid: the first face met going east, and the first going west, are both seen from behind.
const side = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3());
function inside(S, x, y, z) {
  for (const dx of [1, -1]) { side.origin.set(x, y, z); side.direction.set(dx, 0, 0); const h = S.bvh.raycastFirst(side, THREE.DoubleSide); if (!h || h.face.normal.x * dx < 0.2) return false; }
  return true;
}

/**
 * One grid: `box` {x0, x1, z0, z1, top, bottom}, `seeds` [[x, z, y]] (each starts on the floor nearest its y).
 * @returns {{ x0: number, z0: number, nx: number, nz: number, step: number, h: Float32Array, state: Uint8Array, names: string[], ms: Record<string, number> }}
 */
export function bakeGrid(S, box, seeds, step = BAKE.step) {
  const T = [performance.now()], { CLIMB, CLEAR } = BAKE;
  const nx = Math.round((box.x1 - box.x0) / step), nz = Math.round((box.z1 - box.z0) / step), N = nx * nz;
  const cx = (i) => box.x0 + (i + 0.5) * step, cz = (j) => box.z0 + (j + 0.5) * step;
  const names = [...S.names, "ledge", "nofloor", "unreached"], LEDGE = S.names.length, NOFLOOR = LEDGE + 1, UNREACHED = LEDGE + 2;
  const isPost = S.names.map((n) => n.startsWith("post:"));
  // 2. The floors each cell offers, highest first.
  const start = new Uint32Array(N + 1), ys = [];
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), far = box.top - box.bottom;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; start[k] = ys.length;
    if (!S.bvh) continue;
    ray.origin.set(cx(i), box.top, cz(j));
    const hits = S.bvh.raycast(ray, THREE.DoubleSide, 0, far);
    if (hits.length > 1) hits.sort((a, b) => a.distance - b.distance);
    let above = box.top, aboveUp = false;
    for (const h of hits) {
      if (isPost[S.mat[(h.face.a / 3) | 0]]) continue;   // a cushion or a low table is walked round, not stood on: look through it
      const y = h.point.y, ny = h.face.normal.y;
      // (Under a face that looks up, the ray may be inside a closed solid, seeing the inside of its top: the ground under a
      // terrace's stone mass is no floor, however much room the stone leaves over it. Or only under a tile's lip that
      // overhangs a step: asked sideways, below.)
      if (Math.abs(ny) > 0.5 && above - y >= CLEAR && !(aboveUp && inside(S, h.point.x, y + 0.1, h.point.z))) ys.push(y);
      above = y; aboveUp = ny > 0.2;
    }
  }
  start[N] = ys.length; const Y = Float32Array.from(ys);
  T.push(performance.now());
  // 3. Which floor: a flood over spans from the seeds.
  const h = new Float32Array(N).fill(NaN), queue = new Int32Array(N + 1); let qh = 0, qt = 0;
  const take = (k, y) => { h[k] = y; queue[qt++] = k; };
  for (const [sx, sz, sy] of seeds) {
    const i = Math.floor((sx - box.x0) / step), j = Math.floor((sz - box.z0) / step), k = j * nx + i;
    if (i < 0 || j < 0 || i >= nx || j >= nz || start[k] === start[k + 1] || !Number.isNaN(h[k])) continue;
    let best = Y[start[k]]; for (let s = start[k]; s < start[k + 1]; s++) if (Math.abs(Y[s] - (sy ?? -1e9)) < Math.abs(best - (sy ?? -1e9))) best = Y[s];
    take(k, best);
  }
  while (qh < qt) {
    const k = queue[qh++], i = k % nx, j = (k - i) / nx, y = h[k];
    for (let d = 0; d < 4; d++) {
      const ii = i + N8[d][0], jj = j + N8[d][1]; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = jj * nx + ii; if (!Number.isNaN(h[kk])) continue;
      let best = NaN; for (let s = start[kk]; s < start[kk + 1]; s++) if (Math.abs(Y[s] - y) <= CLIMB && !(Math.abs(Y[s] - y) >= Math.abs(best - y))) best = Y[s];
      if (!Number.isNaN(best)) take(kk, best);
    }
  }
  T.push(performance.now());
  // 4. Borders: what stands up in a cell from the lowest floor round it to CLEAR over its own; the foot of a ledge; the
  // edge of a cell that has no floor. Each border cell keeps the heights it takes up, as world heights.
  const border = new Int16Array(N).fill(-1), top = new Float32Array(N), bot = new Float32Array(N), post = new Uint8Array(N);
  const qbox = new THREE.Box3(), nrm = new THREE.Vector3(), r = step * 0.71, index = S.bvh ? S.bvh.geometry.index.array : null;
  // (The hierarchy reorders the triangles' index, not their vertices: a triangle's first vertex over three is its place in `mat`.)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (Number.isNaN(h[k])) continue;
    let lo = h[k], up = 0, open = true;
    for (const [a, b] of N8) {
      const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) { open = false; continue; }
      const hn = h[jj * nx + ii]; if (Number.isNaN(hn)) { open = false; continue; }
      lo = Math.min(lo, hn); up = Math.max(up, hn - h[k]);
    }
    const x = cx(i), z = cz(j), y = h[k];
    qbox.min.set(x - r, lo + 0.02, z - r); qbox.max.set(x + r, y + CLEAR, z + r);
    let what = -1, wlo = Infinity, whi = -Infinity, wpost = 0;
    if (S.bvh) S.bvh.shapecast({
      intersectsBounds: (bb) => bb.intersectsBox(qbox),
      intersectsTriangle: (t, ti) => {
        const id = S.mat[(index[ti * 3] / 3) | 0], p = isPost[id];
        if (!p && Math.abs(t.getNormal(nrm).y) > 0.5) return false;   // a face that lies flat is a floor, not a wall
        if (slabDistance(t.a, t.b, t.c, lo + 0.02, y + CLEAR, x, z) < r) {
          if (what < 0 || p) what = id; wlo = Math.min(wlo, p ? y : slabY[0]); whi = Math.max(whi, slabY[1]); if (p) wpost = 1;
        }
        return false;
      },
    });
    if (what >= 0) { border[k] = what; bot[k] = wlo; top[k] = whi; post[k] = wpost; }
    if (up > CLIMB) { if (border[k] < 0) { border[k] = LEDGE; bot[k] = y; top[k] = y + up; } else { bot[k] = Math.min(bot[k], y); top[k] = Math.max(top[k], y + up); } }
    if (!open && border[k] < 0) { border[k] = NOFLOOR; bot[k] = y; top[k] = y + CLEAR; }
  }
  T.push(performance.now());
  // Every cell within his reach of a border, at the heights the border takes up over that cell's floor, is shut.
  const state = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (Number.isNaN(h[k])) state[k] = 1 + NOFLOOR;
  const disk = []; { const R = Math.ceil((MAXR + 0.01) / step); for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const d = Math.hypot(a, b) * step; if (d < MAXR + 0.01) disk.push([a, b, d]); } disk.sort((p, q) => p[2] - q[2]); }
  const B = OUTLINE.bin;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k0 = j * nx + i, c = border[k0]; if (c < 0) continue;
    for (const [a, b, d] of disk) {
      const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = jj * nx + ii; if (state[kk]) continue;
      // Over which floor are its heights taken: the border cell's own, if he could step up onto it from here (the next
      // tread up a flight), otherwise the one he would stand on.
      const ref = h[k0] >= h[kk] && h[k0] - h[kk] <= CLIMB ? h[k0] : h[kk];
      const lo = Math.max(post[k0] ? 0 : CLIMB, bot[k0] - ref), hi = Math.min(CLEAR, top[k0] - ref); if (hi < lo) continue;
      if (d < reachBins(Math.floor(lo / B), Math.floor(hi / B))) state[kk] = 1 + c;
    }
  }
  T.push(performance.now());
  // 5. What cannot be walked to from the seeds.
  const seen = new Uint8Array(N); qh = qt = 0;
  for (const [sx, sz] of seeds) { const i = Math.floor((sx - box.x0) / step), j = Math.floor((sz - box.z0) / step), k = j * nx + i; if (i >= 0 && j >= 0 && i < nx && j < nz && !state[k] && !seen[k]) { seen[k] = 1; queue[qt++] = k; } }
  while (qh < qt) {
    const k = queue[qh++], i = k % nx, j = (k - i) / nx;
    for (const [a, b] of N8) {
      const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const kk = jj * nx + ii;
      if (seen[kk] || state[kk] || Math.abs(h[kk] - h[k]) > CLIMB || (a && b && (state[j * nx + ii] || state[jj * nx + i]))) continue;
      seen[kk] = 1; queue[qt++] = kk;
    }
  }
  for (let k = 0; k < N; k++) if (!state[k] && !seen[k]) state[k] = 1 + UNREACHED;
  T.push(performance.now());
  const ms = Object.fromEntries(["floors", "flood", "borders", "erode", "reach"].map((n, i) => [n, Math.round(T[i + 1] - T[i])]));
  return { x0: box.x0, z0: box.z0, nx, nz, step, h, state, names, ms };
}

/** The same grid asked of the written plan's walker: which cells it lets him reach from the seeds (one bit each). */
export function oldReach(walker, g, seeds) {
  const { nx, nz, step } = g, N = nx * nz, open = new Uint8Array(N), h = new Float32Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = g.x0 + (i + 0.5) * step, z = g.z0 + (j + 0.5) * step, k = j * nx + i; open[k] = walker.blocked(x, z) ? 0 : 1; h[k] = walker.heightAt(x, z); }
  const seen = new Uint8Array(N), queue = new Int32Array(N + 1); let qh = 0, qt = 0;
  for (const [sx, sz] of seeds) { const i = Math.floor((sx - g.x0) / step), j = Math.floor((sz - g.z0) / step), k = j * nx + i; if (i >= 0 && j >= 0 && i < nx && j < nz && open[k] && !seen[k]) { seen[k] = 1; queue[qt++] = k; } }
  while (qh < qt) {
    const k = queue[qh++], i = k % nx, j = (k - i) / nx;
    for (const [a, b] of N8) {
      const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const kk = jj * nx + ii;
      if (seen[kk] || !open[kk] || Math.abs(h[kk] - h[k]) > BAKE.OLD_STEP || (a && b && (!open[j * nx + ii] || !open[jj * nx + i]))) continue;
      seen[kk] = 1; queue[qt++] = kk;
    }
  }
  const bits = new Uint8Array(Math.ceil(N / 8)); for (let k = 0; k < N; k++) if (seen[k]) bits[k >> 3] |= 1 << (k & 7);
  return bits;
}

/** A grid's cells as the file keeps them (walkgrid.js): heights in centimetres over `base` where open, the state, the old walker's bits. */
export function cellsOf(g, base, old) {
  const N = g.nx * g.nz, height = new Int16Array(N).fill(NO_FLOOR);
  for (let k = 0; k < N; k++) if (!g.state[k]) height[k] = Math.max(-32767, Math.min(32767, Math.round((g.h[k] - base) * 100)));
  return { height, state: g.state, old };
}
