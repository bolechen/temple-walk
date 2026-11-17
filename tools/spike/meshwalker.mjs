// A walker that knows only what is drawn (#161 spike). It answers what createWalker answers (heightAt, blocked,
// onGround, floorAt, eyeShut, and the rest of its face) from the meshes themselves, through a bounding volume hierarchy
// (three-mesh-bvh), inside a trial region; outside it, and wherever the spike does not reach (a balcony, a room other
// than the great hall's), it hands the question to the walker built from the written plan.
//
// How each question is put to the meshes:
//   heightAt   a ray straight down from a ceiling over the level (under the lowest eave, above the highest platform);
//              the highest face that looks up (normal y > 0.5) with CLEAR metres of air above it is the floor.
//   blocked    he is a standing cylinder of radius BODY from CLIMB above that floor to CLEAR above it: anything drawn
//              inside that cylinder stops him. A tread lower than CLIMB is stepped onto; a platform's face, a column, a
//              table, a wall are in the cylinder. Below CLIMB nothing stops him, above CLEAR nothing does (an eave).
//   eyeShut    the eye is shut if any face is within EYE_R of it, if the first face straight above it is seen from
//              behind (it is inside a closed solid), or if faces close it in on all four sides and above (inside a
//              building's shell).
//   floorAt    the material of the face the floor ray stopped on.
import * as THREE from "three";
import { MeshBVH, SAH } from "three-mesh-bvh";
import { BODY } from "../../app/src/geo.js";

export const MW = Object.freeze({
  CLIMB: 0.25,     // the highest rise he steps up without a jump (a tread is 0.10-0.17; a low platform is 0.30-0.45)
  CLEAR: 1.45,     // the air he needs over a floor: a child, his eye at 1.3
  EYE_R: 0.12,     // the near edge of the eye's lens
  SHELL: 12,       // how far the rays that ask "am I inside a building's shell" look
});

// What is drawn but is not there to stand on or be stopped by: flames, mist, smoke, leaves cut out of cards.
const airy = (m) => !m || m.type === "ShaderMaterial" || m.type === "PointsMaterial" || m.name === "flame" || m.transparent || m.alphaTest > 0;

/**
 * Gather the triangles of every solid mesh under `root` whose bounds touch `box` into one geometry in world space.
 * @returns {{ bvh: MeshBVH, names: string[], mat: Uint16Array, tris: number, ms: number }}
 */
export function gather(root, box) {
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
  root.traverse((o) => {
    if (!o.isMesh || o.userData.walk === false) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (airy(m)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const name = o.userData.ground ? "paving" : m.name || m.type;
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); tb.copy(o.geometry.boundingBox).applyMatrix4(m4); if (tb.intersectsBox(grow)) take(o.geometry, m4.clone(), name); } return; }
    tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); if (!tb.intersectsBox(grow)) return;
    take(o.geometry, o.matrixWorld, name);
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const bvh = new MeshBVH(geo, { strategy: SAH, targetLeafSize: 8 });
  return { bvh, names, mat: Uint16Array.from(mat), tris: mat.length, ms: Math.round(performance.now() - t0) };
}

// The 2D distance from (px, pz) to the part of a triangle between heights y0 and y1, seen from above.
const clipA = new Float64Array(30), clipB = new Float64Array(30);
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
  let best = Infinity, inside = false;
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
      if (ny > 0.5 && above - y >= MW.CLEAR - 1e-6) { last = { y, mat: S.names[S.mat[Math.floor(h.face.a / 3)]] }; return last; }
      above = y;
    }
    last = null; return null;
  }
  const heightAt = (x, z) => { const S = scope(x, z); if (!S) return fallback.heightAt(x, z); const f = floor(S, x, z); return f ? f.y : region.floorY; };
  const tri = (S, i, a, b, c) => { const ix = S.bvh.geometry.index.array; const p = S.bvh.geometry.attributes.position; a.fromBufferAttribute(p, ix[i * 3]); b.fromBufferAttribute(p, ix[i * 3 + 1]); c.fromBufferAttribute(p, ix[i * 3 + 2]); };
  // What is in his cylinder standing at (x, z): the name of its material, or null.
  function inBody(S, x, z, r = BODY) {
    const f = floor(S, x, z), y = f ? f.y : region.floorY, y0 = y + MW.CLIMB, y1 = y + MW.CLEAR;
    qbox.min.set(x - r, y0, z - r); qbox.max.set(x + r, y1, z + r);
    let what = null;
    S.bvh.shapecast({
      intersectsBounds: (box) => box.intersectsBox(qbox),
      intersectsTriangle: (t, i) => {
        if (slabDistance(t.a, t.b, t.c, y0, y1, x, z) < r) { what = S.names[S.mat[Math.floor(S.bvh.geometry.index.array[i * 3] / 3)]]; return true; }
        return false;
      },
    });
    return what;
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
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, w = inBody(S, box.x0 + (i + 0.5) * step, box.z0 + (j + 0.5) * step, step * 0.71); if (w !== null) border[k] = S.names.indexOf(w); }
    const t2 = performance.now();
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (border[k] >= 0) continue;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; if (h[jj * nx + ii] - h[k] > MW.CLIMB) { border[k] = LEDGE; break; } } }
    const R = Math.ceil(BODY / step), disk = [];
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) if (Math.hypot(a, b) * step < BODY) disk.push([a, b]);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const c = border[j * nx + i]; if (c < 0) continue;
      for (const [a, b] of disk) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const kk = jj * nx + ii; if (!shut[kk] || (a === 0 && b === 0)) { shut[kk] = 1; cause[kk] = c; } } }
    const t3 = performance.now();
    return { x0: box.x0, z0: box.z0, nx, nz, step, h, shut, cause, names: [...S.names, "ledge"], ms: { floor: Math.round(t1 - t0), body: Math.round(t2 - t1), erode: Math.round(t3 - t2) } };
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
    blocked(x, z) { const S = scope(x, z); if (!S) return fallback.blocked(x, z); const G = gridFor(x, z), k = G ? cell(G, x, z) : -1; return k >= 0 ? G.shut[k] === 1 : inBody(S, x, z) !== null; },
    /** What stopped him there (a material name, or "ledge"), or null: for the comparison. */
    why(x, z) { const S = scope(x, z); if (!S) return undefined; const G = gridFor(x, z), k = G ? cell(G, x, z) : -1; return k >= 0 ? (G.shut[k] ? G.names[G.cause[k]] : null) : inBody(S, x, z); },
    /** Bake the grids (outdoors over the region, and the room): returns the milliseconds each part took. */
    bake(step = 0.05) {
      grids.outdoors = bake({ ...o.outdoors, ceil: region.ceil }, region, step);
      if (o.room) { const r = o.room.box; grids.room = bake({ ...o.room.data, ceil: o.room.ceil }, r, step); }
      return { outdoors: grids.outdoors.ms, room: grids.room?.ms, cells: grids.outdoors.nx * grids.outdoors.nz + (grids.room ? grids.room.nx * grids.room.nz : 0) };
    },
    grids,
    wall(x, z) { const S = scope(x, z); if (!S) return fallback.wall(x, z); return inBody(S, x, z, 0.15) !== null; },
    eyeShut(x, y, z, foot) { const S = scope(x, z); if (!S) return fallback.eyeShut(x, y, z, foot); return near(S, x, y, z, MW.EYE_R) || enclosed(S, x, y, z); },
    railNear(x, y, z, m = 0) { const S = scope(x, z); if (!S) return fallback.railNear(x, y, z, m); return m > 0 && near(S, x, y, z, m) && y < heightAt(x, z) + 1.3; },
    get lastFloor() { return last; },
  };
  return me;
}
