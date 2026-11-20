// His own eyes have a size (#265; the owner and the lead, 2026-11-19, the spike's §九 list): seen from them the picture is
// cut off by the camera's near plane, whose corners lie BAKE.EYE_R from the eye at the widest view the page draws. So on
// every cell where the grid lets him stand (#274: the whole of the place out of doors, every room, the balcony), nothing
// drawn comes nearer his eye than that, or a wall cut open by the near plane shows its inside. Asked of the drawn meshes themselves (the bake's own bounding volume
// hierarchy), not of the grid: every fourth cell each way, at the eye and at the near plane's top and bottom.
// About a minute: run with `pnpm run nearplane` (and `nearplane:grid`), not with the quick unit tests.
import test from "node:test"; import assert from "node:assert/strict";
import * as THREE from "three";
import { inflateRawSync } from "node:zlib";
const { buildDrawn, gridsOf } = await import("../../tools/walk/scene.mjs");
const { gather, BAKE, eyeR } = await import("../../tools/walk/bake.mjs");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { decode, oldReached, NO_FLOOR } = await import("../../app/src/walkgrid.js");
const { SITE, LEVELS, GROVE } = await import("../../app/src/site.js?real");
const { FOV_RANGE } = await import("../../app/src/settings.js");

test("the eye's room is the near plane's: BAKE.EYE_R covers its corners at the widest view the settings allow", () => {
  assert.ok(BAKE.EYE_R >= eyeR(0.1, FOV_RANGE[1]) - 1e-9, `the near plane's corners lie ${eyeR(0.1, FOV_RANGE[1]).toFixed(3)} m from the eye, the bake keeps ${BAKE.EYE_R}`);
});

const file = ensure(prepare()), drawn = buildDrawn(), decoded = decode(file.bytes, (b) => inflateRawSync(b));
const defs = gridsOf(drawn), gridOf = (id) => decoded.grids.find((g) => g.id === id);
const xOf = (g, k) => g.x0 + ((k % g.nx) + 0.5) * g.step, zOf = (g, k) => g.z0 + (Math.floor(k / g.nx) + 0.5) * g.step, yOf = (g, k) => g.height[k] / 100 + g.base;

test("wherever the grid lets him stand, out of doors, in every room and on the balcony, nothing drawn is within the near plane's reach of his own eyes", () => {
  const tol = BAKE.step * 0.71 + 0.01, p = new THREE.Vector3(), hit = {}, bad = new Map(), seen = {};
  for (const def of defs) {
    const g = gridOf(def.id), S = gather(def.roots, def.box, def.postBase ?? 0), every = def.kind === "outdoors" ? 4 : 2; let n = 0;
    for (let j = 0; j < g.nz; j += every) for (let i = 0; i < g.nx; i += every) {
      const k = j * g.nx + i; if (g.state[k]) continue;
      const x = xOf(g, k), z = zOf(g, k), y = yOf(g, k); n++;
      for (const dy of [-BAKE.EYE_R, 0, Math.min(BAKE.EYE_R, BAKE.CLEAR - BAKE.EYE)]) {
        p.set(x, y + BAKE.EYE + dy, z);
        const h = S.bvh.closestPointToPoint(p, hit, 0, BAKE.EYE_R);
        if (h && h.distance < BAKE.EYE_R - tol) { const name = S.names[S.mat[(S.bvh.geometry.index.array[h.faceIndex * 3] / 3) | 0]] || "?", key = `${def.id} ${name}`, r = bad.get(key) || { cells: 0, nearest: 9, at: null }; r.cells++; if (h.distance < r.nearest) { r.nearest = +h.distance.toFixed(3); r.at = [+x.toFixed(2), +z.toFixed(2), +p.y.toFixed(2)]; } bad.set(key, r); break; }
      }
    }
    seen[def.id] = n;
  }
  assert.ok(seen.outdoors > 100000, `only ${seen.outdoors} cells looked at out of doors`);
  for (const def of defs) assert.ok(seen[def.id] > 400, `only ${seen[def.id]} cells looked at in ${def.id}`);
  assert.deepEqual(Object.fromEntries(bad), {}, "his own eyes come nearer than the near plane's corners");
});

// What he can reach keeps to the place (#265 for the first court; #274 for all of it; the lead, from the walk-round census,
// #252). Over the whole outdoor grid, of the cells he can reach: none lies outside the walls of the terrace it is on, none
// where bamboo stands (site.js GROVE, the same answer bamboo.js plants by), none on a roof (at or over the foot of the beams
// of any roof over it, `walk.roofs`), none within the walls of a hall he goes into by its door; and none brings his eye
// within 1.2 m of the backdrop (the far hills, the earth and the painted bamboo bands, backdrop.js), which seen nearer
// turns into a flat green sheet (the hill's own earth is held apart: below). 1.2 m: the nearest the written plan's walker ever let him come (1.42 m, at the
// forecourt's corner on the line where the bamboo closes in, SITE.GROVE_IN), less a margin; and nowhere nearer than
// the written plan let him come (on the path's lower landing that was already under a metre).
test("everything he can reach out of doors is inside the walls, out of the bamboo, under the roofs and outside the halls' walls, and well off the backdrop", async () => {
  const { MeshBVH } = await import("three-mesh-bvh");
  const { createBackdrop } = await import("../../app/src/backdrop.js");
  const { namedMaterials } = await import("../../tools/walk/scene.mjs");
  const { terrain } = await import("../../app/src/site.js?real");
  const site = drawn.site, M = namedMaterials(), scene = new THREE.Scene();
  createBackdrop(scene, M, SITE, [LEVELS[0], LEVELS[2]], terrain); scene.updateMatrixWorld(true);
  // The land (the hill's own earth, which the bake gathers and keeps him off as it does a wall) apart from the painted far things.
  const far = [], land = [], v = new THREE.Vector3(), m4 = new THREE.Matrix4();
  scene.traverse((o) => {
    if (!o.isMesh) return; const p = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : p.count;
    const keep = !o.material.transparent && o.material.type !== "ShaderMaterial" ? land : far;
    const ms = o.isInstancedMesh ? Array.from({ length: o.count }, (_, i) => { o.getMatrixAt(i, m4); return m4.clone().premultiply(o.matrixWorld); }) : [o.matrixWorld];
    for (const mw of ms) for (let t = 0; t + 2 < n; t += 3) { const tri = []; for (let c = 0; c < 3; c++) { v.fromBufferAttribute(p, idx ? idx.getX(t + c) : t + c).applyMatrix4(mw); tri.push(v.x, v.y, v.z); } if (tri.every((q, c) => c % 3 !== 0 || Math.abs(q) < 80)) keep.push(...tri); }
  });
  const tree = (tris) => { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3)); return new MeshBVH(geo); };
  const bvh = tree(far), earth = tree(land), eye = new THREE.Vector3();
  const g = gridOf("outdoors"), hit = {};
  // How wide the place is within its walls at z: the court and forecourt, then each terrace.
  const wide = (z) => { for (const L of [...LEVELS].reverse()) if (z < L.zS) return L.x; return z <= SITE.fore ? SITE.x : Infinity; };
  // The halls he goes into: within their column lines, less the depth of a wall and of the doorway he steps into.
  const bodies = site.halls.map((h) => {
    const b = site.buildings.find((q) => q.frame && !q.frame.storey && h.out[0] > q.x0 - 1.5 && h.out[0] < q.x1 + 1.5 && h.out[1] > q.z0 - 1.5 && h.out[1] < q.z1 + 1.5), f = b.frame, q = f.q || 0;
    const hx = (q % 2 ? Math.max(...f.zs) - Math.min(...f.zs) : Math.max(...f.xs) - Math.min(...f.xs)) / 2 - 0.7, hz = (q % 2 ? Math.max(...f.xs) - Math.min(...f.xs) : Math.max(...f.zs) - Math.min(...f.zs)) / 2 - 0.7;
    return { name: h.name, x0: f.at[0] - hx, x1: f.at[0] + hx, z0: f.at[1] - hz, z1: f.at[1] + hz };
  });
  const count = { outside: [], grove: [], roof: [], body: [] }, note = (list, x, z, what = "") => { if (list.length < 5) list.push(`(${x.toFixed(2)}, ${z.toFixed(2)})${what}`); else list.n = (list.n || 5) + 1; };
  let n = 0, nearest = Infinity, at = null, soil = Infinity, soilAt = null, was = Infinity;
  // (How near the written plan's walker let his eye come to the painted backdrop, over the cells it reached: on the path's
  // lower landing the bamboo's painted band stands within a metre of its east end, on either walker.)
  for (let j = 0; j < g.nz; j += 2) for (let i = 0; i < g.nx; i += 2) { const k = j * g.nx + i; if (!oldReached(g.old, k) || g.height[k] === NO_FLOOR) continue; const h = bvh.closestPointToPoint(eye.set(xOf(g, k), yOf(g, k) + BAKE.EYE, zOf(g, k)), hit, 0, 5); if (h && h.distance < was) was = h.distance; }
  for (let j = 0; j < g.nz; j += 2) for (let i = 0; i < g.nx; i += 2) {
    const k = j * g.nx + i; if (g.state[k]) continue;
    const x = xOf(g, k), z = zOf(g, k), y = yOf(g, k); n++;
    if (Math.abs(x) > wide(z)) note(count.outside, x, z);
    if (GROVE.grows(x, z)) note(count.grove, x, z);
    for (const r of site.walk.roofs) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && y >= r.bottom) { note(count.roof, x, z, ` at ${y.toFixed(2)} m`); break; }
    for (const b of bodies) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) { note(count.body, x, z, ` in ${b.name}`); break; }
    eye.set(x, y + BAKE.EYE, z);
    const h = bvh.closestPointToPoint(eye, hit, 0, 5); if (h && h.distance < nearest) { nearest = h.distance; at = [x, z]; }
    const e = earth.closestPointToPoint(eye, hit, 0, 2); if (e && e.distance < soil) { soil = e.distance; soilAt = [x, z]; }
  }
  assert.ok(n > 400000, `only ${n} cells`);
  for (const [what, list] of Object.entries(count)) assert.deepEqual(list, [], `${list.n || list.length} cells he can reach: ${what}`);
  if (process.env.EYEROOM_LOG) console.log(JSON.stringify({ cells: n, nearest: +nearest.toFixed(2), was: +was.toFixed(2), at, soil: +soil.toFixed(2), soilAt }));
  assert.ok(nearest >= Math.min(1.2, was - 0.05), `his eye comes ${nearest.toFixed(2)} m from the painted backdrop at (${at}); on the written plan the nearest was ${was.toFixed(2)} m`);
  // The hill's own earth, where it rises over the edge of the summit's terrace, is ground seen near, not a card: twice the near plane's reach is room enough.
  assert.ok(soil >= 2 * BAKE.EYE_R, `his eye comes ${soil.toFixed(2)} m from the earth at (${soilAt})`);
});
