// A walker that knows only what is drawn (#161 spike). It answers what createWalker answers (heightAt, blocked,
// onGround, floorAt, eyeShut, and the rest of its face) from the meshes themselves, through a bounding volume hierarchy
// (three-mesh-bvh), inside a trial region; outside it, and wherever the spike does not reach (a balcony, a room other
// than the great hall's), it hands the question to the walker built from the written plan.
//
// How each question is put to the meshes:
//   heightAt   a ray straight down from a ceiling over the level (under the lowest eave, above the highest platform);
//              the highest face that looks up (normal y > 0.5) with CLEAR metres of air above it is the floor.
//   blocked    he is the solid of revolution tools/edges.mjs measures from the real models (his reach at every 5 cm of
//              height, over every pose: outline.json), standing on that floor. Anything drawn from CLIMB above the floor
//              to CLEAR above it that comes nearer his centre than his reach at its height stops him; a tread lower than
//              CLIMB is stepped onto; above CLEAR nothing stops him (an eave). What is marked as a thing to walk round
//              (`userData.walk = "post"`: a cushion, a low table) stops him at every height and is not a floor.
//              It is baked once into a grid (see `bake`) and read back cell by cell.
//   eyeShut    the eye is shut if any face is within EYE_R of it, if the first face straight above it is seen from
//              behind (it is inside a closed solid), or if faces close it in on all four sides and above (inside a
//              building's shell).
//   floorAt    the material of the face the floor ray stopped on.
import * as THREE from "three";
import { MeshBVH, SAH } from "three-mesh-bvh";
import { BODY } from "../../app/src/geo.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const OUTLINE = JSON.parse(readFileSync(new URL("./outline.json", import.meta.url), "utf8"));
const HEAD = 0.13;   // over the top of his outline (his hat), up to CLEAR
/** His reach from his centre over the heights [lo, hi] above the floor he stands on. */
export const BODY_SHAPE = (typeof process !== "undefined" && process.env.SPIKE_BODY) || "outline";   // or "cylinder": BODY at every height, as the written plan has him
export function reach(lo, hi) {
  if (BODY_SHAPE === "cylinder") return BODY;
  let r = 0; const b = OUTLINE.bin;
  for (let i = Math.max(0, Math.floor(lo / b)); i * b <= hi + 1e-9; i++) r = Math.max(r, i < OUTLINE.reach.length && OUTLINE.reach[i] > 0 ? OUTLINE.reach[i] : HEAD);
  return r;
}

export const MW = Object.freeze({
  CLIMB: 0.25,     // the highest rise he steps up without a jump (a tread is 0.10-0.17; a low platform is 0.30-0.45)
  CLEAR: 1.45,     // the air he needs over a floor: a child, his eye at 1.3
  EYE_R: 0.12,     // the near edge of the eye's lens
  SHELL: 12,       // how far the rays that ask "am I inside a building's shell" look
});

// What is drawn but is not there to stand on or be stopped by: flames, mist, smoke, leaves cut out of cards.
export const airy = (m) => !m || m.type === "ShaderMaterial" || m.type === "PointsMaterial" || m.name === "flame" || m.transparent || m.alphaTest > 0;

/**
 * Gather the triangles of every solid mesh under `root` whose bounds touch `box` into one geometry in world space.
 * @returns {{ bvh: MeshBVH, names: string[], mat: Uint16Array, tris: number, ms: number }}
 */
export function gather(roots, box, tag = () => null) {
  const t0 = performance.now(), pos = [], mat = [], names = [], ids = new Map(), v = new THREE.Vector3(), tb = new THREE.Box3(), m4 = new THREE.Matrix4();
  const grow = box.clone().expandByScalar(1);
  const take = (geo, world, name) => {
    let id = ids.get(name); if (id === undefined) { id = names.length; names.push(name); ids.set(name, id); }
    const p = geo.attributes.position, idx = geo.index, n = idx ? idx.count : p.count, tri = [];
    for (let i = 0; i < n; i += 3) {
      tri.length = 0; tb.makeEmpty();
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(world); tri.push(v.x, v.y, v.z); tb.expandByPoint(v); }
      if (!tb.intersectsBox(grow)) continue;
      pos.push(...tri); mat.push(id);
    }
  };
  for (const root of [roots].flat()) root.traverse((o) => {
    if (!o.isMesh || o.userData.walk === false) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (airy(m)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const name = (o.userData.walk === "post" || tag(o) === "post" ? "post:" : "") + (o.userData.ground ? "paving" : m.name || m.type);
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); tb.copy(o.geometry.boundingBox).applyMatrix4(m4); if (tb.intersectsBox(grow)) take(o.geometry, m4.clone(), name); } return; }
    tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); if (!tb.intersectsBox(grow)) return;
    take(o.geometry, o.matrixWorld, name);
  });
  const hash = createHash("sha1").update(Float32Array.from(pos)).digest("hex").slice(0, 12);
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const bvh = new MeshBVH(geo, { strategy: SAH, targetLeafSize: 8 });
  return { bvh, names, mat: Uint16Array.from(mat), tris: mat.length, hash, ms: Math.round(performance.now() - t0) };
}

// The 2D distance from (px, pz) to the part of a triangle between heights y0 and y1, seen from above.
const clipA = new Float64Array(30), clipB = new Float64Array(30), slabY = [0, 0];
function slabDistance(a, b, c, y0, y1, px, pz) {
  let n = 3, src = clipA, dst = clipB;
  src[0] = a.x; src[1] = a.y; src[2] = a.z; src[3] = b.x; src[4] = b.y; src[5] = b.z; src[6] = c.x; src[7] = c.y; src[8] = c.z;
  for (const [h, keepAbove] of [[y0, true], [y1, false]]) {
    let m = 0;
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

/**
 * @param {{ outdoors: ReturnType<typeof gather>, region: { x0: number, x1: number, z0: number, z1: number, ceil: number, floorY: number },
 *   room?: { id: string, data: ReturnType<typeof gather>, ceil: number }, fallback: any, earthZ?: number }} o
 */
export function createMeshWalker(o) {
  const { region, fallback } = o;
  const ray = new THREE.Ray(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0), qbox = new THREE.Box3(), tmp = new THREE.Vector3(), hit = { point: new THREE.Vector3() };
  let room = null, loft = null, last = null;   // `last`: the face the latest floor ray stopped on, for floorAt
  const scope = (x, z) => {
    if (loft) return null;
    if (room) return o.room && room.id === o.room.id ? { ...o.room.data, ceil: o.room.ceil } : null;
    return x > region.x0 && x < region.x1 && z > region.z0 && z < region.z1 ? { ...o.outdoors, ceil: region.ceil } : null;
  };
  // The floor under (x, z): the highest upward face with CLEAR of air over it, below the ceiling.
  function floor(S, x, z) {
    ray.origin.set(x, S.ceil, z); ray.direction.copy(down);
    const hits = S.bvh.raycast(ray, THREE.DoubleSide, 0, 200).sort((a, b) => a.distance - b.distance);
    let above = S.ceil;
    for (const h of hits) {
      const ny = h.face.normal.y, y = h.point.y;
      const mat = S.names[S.mat[Math.floor(h.face.a / 3)]];
      if (mat.startsWith("post:")) continue;   // a cushion or a table is walked round, not stood on: look through it to the floor
      // The first face looking up is the floor, whatever is over it: if something hangs lower than CLEAR over it, that
      // thing stands in his way there (the body test sees it), rather than the ray going on down through the solid.
      if (ny > 0.5) { last = { y, mat, clear: above - y }; return last; }
      above = y;
    }
    last = null; return null;
  }
  const heightAt = (x, z) => { const S = scope(x, z); if (!S) return fallback.heightAt(x, z); const f = floor(S, x, z); return f ? f.y : region.floorY; };
  const tri = (S, i, a, b, c) => { const ix = S.bvh.geometry.index.array; const p = S.bvh.geometry.attributes.position; a.fromBufferAttribute(p, ix[i * 3]); b.fromBufferAttribute(p, ix[i * 3 + 1]); c.fromBufferAttribute(p, ix[i * 3 + 2]); };
  // What is drawn within `r` of the vertical line through (x, z), from CLIMB over the floor there (from the floor itself,
  // for a thing marked to be walked round) up to CLEAR: the material it is made of and the heights over the floor
  // that it takes up there, or null.
  function inBody(S, x, z, r) {
    const f = floor(S, x, z), y = f ? f.y : region.floorY, y1 = y + MW.CLEAR;
    qbox.min.set(x - r, y + 0.02, z - r); qbox.max.set(x + r, y1, z + r);
    let what = null, lo = Infinity, hi = -Infinity;
    const ix = S.bvh.geometry.index.array;
    S.bvh.shapecast({
      intersectsBounds: (box) => box.intersectsBox(qbox),
      intersectsTriangle: (t, i) => {
        const name = S.names[S.mat[Math.floor(ix[i * 3] / 3)]], post = name.startsWith("post:");
        if (slabDistance(t.a, t.b, t.c, y + (post ? 0.02 : MW.CLIMB), y1, x, z) < r) {
          if (!what || post) what = name; lo = Math.min(lo, slabY[0] - y); hi = Math.max(hi, slabY[1] - y);
          if (post) { lo = 0; }
        }
        return false;
      },
    });
    return what && { what, lo, hi, floor: y };
  }
  // Is (x, y, z) inside a closed solid: the first face a ray meets, going along +x, is seen from behind.
  function insideSolid(S, x, y, z) {
    ray.origin.set(x, y, z); ray.direction.set(1, 0, 0);
    const h = S.bvh.raycastFirst(ray, THREE.DoubleSide); return !!h && h.face.normal.x > 0.2;
  }
  // The floor he may stand on, baked once into a grid as Recast would: the floor's height in every cell; a cell is a
  // border if something drawn stands in it between CLIMB and CLEAR over that floor, or if a neighbour's floor is more than
  // CLIMB above it (the foot of a ledge; the top of the ledge is not a border, so he may stand at a porch's very edge, as
  // the written plan lets him); every cell within BODY of a border is shut. A stair is many small rises, none a border.
  function bake(S, box, step) {
    const t0 = performance.now(), nx = Math.ceil((box.x1 - box.x0) / step), nz = Math.ceil((box.z1 - box.z0) / step), N = nx * nz;
    const h = new Float32Array(N), border = new Int16Array(N).fill(-1), shut = new Uint8Array(N), cause = new Int16Array(N).fill(-1), LEDGE = S.names.length;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const f = floor(S, box.x0 + (i + 0.5) * step, box.z0 + (j + 0.5) * step); h[j * nx + i] = f ? f.y : region.floorY; }
    const t1 = performance.now();
    const rad = new Float32Array(N), top = new Float32Array(N), post = new Uint8Array(N);   // top: the highest point of what made a cell a border   // how far a border cell keeps his centre off: his reach at the heights it takes up
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, w = inBody(S, box.x0 + (i + 0.5) * step, box.z0 + (j + 0.5) * step, step * 0.71); if (w) { border[k] = S.names.indexOf(w.what); rad[k] = reach(w.lo, w.hi); top[k] = w.floor + w.hi; post[k] = w.what.startsWith("post:") ? 1 : 0; } }
    const t2 = performance.now();
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (border[k] >= 0) continue; let up = 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; up = Math.max(up, h[jj * nx + ii] - h[k]); }
      if (up > MW.CLIMB) { border[k] = LEDGE; rad[k] = reach(0, Math.min(up, MW.CLEAR)); top[k] = h[k] + up; } }
    const disks = new Map(), diskOf = (r) => { const q = Math.round(r * 100); if (!disks.has(q)) { const R = Math.ceil(q / 100 / step), d = []; for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) if (Math.hypot(a, b) * step < q / 100) d.push([a, b]); disks.set(q, d); } return disks.get(q); };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k0 = j * nx + i, c = border[k0]; if (c < 0) continue; shut[k0] = 1; cause[k0] = c;
      // What made the border keeps him off only where it stands above his feet: the face of a platform, seen from the
      // court, is no obstacle to him standing on the porch above it.
      for (const [a, b] of diskOf(rad[k0])) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const kk = jj * nx + ii; if (!shut[kk] && (post[k0] || top[k0] > h[kk] + MW.CLIMB)) { shut[kk] = 1; cause[kk] = c; } } }
    // What cannot be walked to from where he comes in (a hall's hollow shell, the top of a table, a railing's cap) is
    // shut too, as Recast drops the regions its seeds do not reach. Cells are joined eight ways when neither is shut
    // and the floor steps no more than CLIMB.
    const UNREACHED = S.names.length + 1;
    if (box.seeds) { const seen = new Uint8Array(N), q = [];
      for (const [sx, sz] of box.seeds) { const i = Math.floor((sx - box.x0) / step), j = Math.floor((sz - box.z0) / step), k = j * nx + i; if (i >= 0 && j >= 0 && i < nx && j < nz && !shut[k]) { seen[k] = 1; q.push(k); } }
      while (q.length) { const k = q.pop(), i = k % nx, j = (k - i) / nx;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const kk = jj * nx + ii;
          if (seen[kk] || shut[kk] || Math.abs(h[kk] - h[k]) > MW.CLIMB || (a && b && (shut[j * nx + ii] || shut[jj * nx + i]))) continue; seen[kk] = 1; q.push(kk); } }
      for (let k = 0; k < N; k++) if (!shut[k] && !seen[k]) { shut[k] = 1; cause[k] = UNREACHED; } }
    const t3 = performance.now();
    return { x0: box.x0, z0: box.z0, nx, nz, step, h, shut, cause, names: [...S.names, "ledge", "unreached"], ms: { floor: Math.round(t1 - t0), body: Math.round(t2 - t1), erode: Math.round(t3 - t2) } };
  }
  const cell = (G, x, z) => { const i = Math.floor((x - G.x0) / G.step), j = Math.floor((z - G.z0) / G.step); return i < 0 || j < 0 || i >= G.nx || j >= G.nz ? -1 : j * G.nx + i; };
  const grids = {};
  const gridFor = (x, z) => (loft ? null : room ? (o.room && room.id === o.room.id ? grids.room : null) : grids.outdoors);
  const near = (S, x, y, z, r) => { tmp.set(x, y, z); return S.bvh.closestPointToPoint(tmp, hit, 0, r) !== null; };
  function enclosed(S, x, y, z) {
    ray.origin.set(x, y, z); ray.direction.copy(up);
    const first = S.bvh.raycastFirst(ray, THREE.DoubleSide);
    if (first && first.face.normal.y > 0.2) return true;   // the face over him looks up: he is inside the solid it closes
    if (!first || first.distance > MW.SHELL) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ray.direction.set(dx, 0, dz); const h = S.bvh.raycastFirst(ray, THREE.DoubleSide); if (!h || h.distance > MW.SHELL) return false; }
    return true;
  }
  const me = {
    meshes: true,
    setRoom(r) { room = r || null; fallback.setRoom(r); }, get room() { return room; },
    setLoft(id) { fallback.setLoft(id); loft = fallback.loft; }, get loft() { return loft; },
    heightAt,
    eyeAt(x, z) { const S = scope(x, z); if (!S) return fallback.eyeAt(x, z); let s = 0; for (const [dx, dz] of [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) s += heightAt(x + dx, z + dz); return s / 5; },
    landAt(x, z) { const S = scope(x, z); return S ? heightAt(x, z) : fallback.landAt(x, z); },
    floorAt(x, z) {
      const S = scope(x, z); if (!S) return fallback.floorAt(x, z); if (room) return "room";
      const f = floor(S, x, z); if (!f || f.mat === "paving") return z > (o.earthZ ?? Infinity) ? "earth" : "paving";
      return /wood/.test(f.mat) ? "wood" : f.mat === "steps" ? "path" : "stone";
    },
    onGround(x, z) { const S = scope(x, z); if (!S) return fallback.onGround(x, z); if (room) return false; const f = floor(S, x, z); return !f || f.mat === "paving"; },
    onStairs(x, z) { const S = scope(x, z); if (!S) return fallback.onStairs(x, z); const f = floor(S, x, z); return !!f && f.mat === "steps"; },
    blocked(x, z) { const S = scope(x, z); if (!S) return fallback.blocked(x, z); const G = gridFor(x, z), k = G ? cell(G, x, z) : -1; return k >= 0 ? G.shut[k] === 1 : !!inBody(S, x, z, BODY); },
    /** What stopped him there (a material name, or "ledge"), or null: for the comparison. */
    why(x, z) { const S = scope(x, z); if (!S) return undefined; const G = gridFor(x, z), k = G ? cell(G, x, z) : -1; return k >= 0 ? (G.shut[k] ? G.names[G.cause[k]] : null) : inBody(S, x, z, BODY)?.what ?? null; },
    /** Bake the grids (outdoors over the region, and the room): returns the milliseconds each part took. */
    bake(step = 0.05, cache = null) {
      const one = (S, box, key) => { const file = cache && `${cache.dir}/bake-${key}-${S.hash}-${step}-${MW.CLIMB}-${MW.CLEAR}-${BODY_SHAPE}-v7.bin`;
        if (file && cache.exists(file)) return cache.read(file);
        const g = bake(S, box, step); if (file) cache.write(file, g); return g; };
      grids.outdoors = one({ ...o.outdoors, ceil: region.ceil }, region, "court");
      if (o.room) { const r = o.room.box; grids.room = one({ ...o.room.data, ceil: o.room.ceil }, r, "room"); }
      return { outdoors: grids.outdoors.ms, room: grids.room?.ms, cells: grids.outdoors.nx * grids.outdoors.nz + (grids.room ? grids.room.nx * grids.room.nz : 0) };
    },
    grids,
    wall(x, z) { const S = scope(x, z); if (!S) return fallback.wall(x, z); const y = heightAt(x, z); return !!inBody(S, x, z, 0.15) || insideSolid(S, x, y + 0.8, z); },
    // The eye: shut within EYE_R of anything drawn; and over ground he cannot walk to (a hall's shell, a wall, a
    // platform's body: cells the bake left unreached, or the very cells something stands in), shut below the topmost
    // face over that spot, so that it is never inside a building up to its ridge nor inside a wall.
    eyeShut(x, y, z, foot) {
      const S = scope(x, z); if (!S) return fallback.eyeShut(x, y, z, foot);
      if (near(S, x, y, z, MW.EYE_R)) return true;
      const G = gridFor(x, z), k = G ? cell(G, x, z) : -1;
      if (k >= 0 && G.shut[k] && G.names[G.cause[k]] === "unreached") { ray.origin.set(x, 80, z); ray.direction.copy(down); const t = S.bvh.raycastFirst(ray, THREE.DoubleSide); if (t && y < t.point.y) return true; }
      return enclosed(S, x, y, z);
    },
    // Near a railing, or anything else that stands up within `m` of the eye below head height (a floor is not counted).
    railNear(x, y, z, m = 0) { const S = scope(x, z); if (!S) return fallback.railNear(x, y, z, m); if (m <= 0 || y > heightAt(x, z) + 1.3) return false;
      qbox.min.set(x - m, y - m, z - m); qbox.max.set(x + m, y + m, z + m); tmp.set(x, y, z); let hitIt = false; const sph = new THREE.Sphere(tmp, m);
      S.bvh.shapecast({ intersectsBounds: (b) => b.intersectsBox(qbox), intersectsTriangle: (t) => { if (Math.abs(t.getNormal(new THREE.Vector3()).y) > 0.5) return false; if (t.intersectsSphere(sph)) { hitIt = true; return true; } return false; } });
      return hitIt; },
    get lastFloor() { return last; },
  };
  return me;
}
