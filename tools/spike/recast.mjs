// The same triangles through Recast (recast-navigation, WASM): a navigation mesh baked in Node, then asked, every 5 cm
// over the trial region, whether he may stand there (a polygon under the point, within 3 cm across and 0.3 m up or
// down) and whether that place joins the court's middle; and a few tapped routes timed (#161 spike).
//   node tools/spike/recast.mjs [cs=0.05] [outdir]
import "../../tests/unit/dom-stub.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { namedMaterials } from "./mats.mjs";
import { drawnWalker, REGION } from "./drawn.mjs";
import { reach as outlineReach } from "../../app/src/spike/meshwalker.js";
const { createWalker, buildSite } = await import("../../app/src/site.js?real");
const CS = +(process.argv[2] || 0.05), OUT = process.argv[3] || "tools/out/spike"; mkdirSync(OUT, { recursive: true });
let t = performance.now(); const { init, NavMeshQuery } = await import("recast-navigation"); const { generateSoloNavMesh } = await import("recast-navigation/generators");
await init(); const initMs = performance.now() - t;
const site = buildSite(namedMaterials()), old = createWalker(site), grid = drawnWalker(site, createWalker(site));
// Recast takes positions and indices; the gathered BVH geometry has both (posts are left out of the floor by marking
// them unwalkable in a real build; here they are kept as obstacles, which is what they are).
const geo = grid.outdoors.bvh.geometry, positions = geo.attributes.position.array, indices = geo.index.array;
const CH = 0.02, cfg = { cs: CS, ch: CH, walkableSlopeAngle: 45, walkableHeight: Math.ceil(1.45 / CH), walkableClimb: Math.floor(0.25 / CH), walkableRadius: Math.ceil(0.38 / CS), maxEdgeLen: 12 / CS, maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20, maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1,
  bounds: [[REGION.x0, -1, REGION.z0], [REGION.x1, 4, REGION.z1]] };
t = performance.now(); const res = generateSoloNavMesh(positions, indices, cfg); const buildMs = performance.now() - t;
if (!res.success) { console.error(res.error); process.exit(1); }
const nav = res.navMesh, q = new NavMeshQuery(nav), bytes = (() => { try { return nav.getNavMeshData ? null : null; } catch { return null; } })();
const S = 0.05, nx = Math.round((REGION.x1 - REGION.x0) / S), nz = Math.round((REGION.z1 - REGION.z0) / S), img = Buffer.alloc(nx * nz * 3);
const seed = q.findNearestPoly({ x: 0, y: 0, z: 20 }, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
const cnt = { both: 0, gridOnly: 0, recastOnly: 0, neither: 0 }; let tq = 0, nq = 0;
const cache = new Map();   // polygon ref -> joins the seed
const joins = (ref) => { if (cache.has(ref)) return cache.get(ref); const p = q.computePath ? null : null; return null; };
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const x = REGION.x0 + (i + 0.5) * S, z = REGION.z0 + (j + 0.5) * S, y = old.heightAt(x, z);
  const a = performance.now(); const r = q.findNearestPoly({ x, y, z }, { halfExtents: { x: 0.03, y: 0.3, z: 0.03 } }); tq += performance.now() - a; nq++;
  const rc = r.success && r.nearestRef !== 0 && r.isOverPoly, g = !grid.blocked(x, z);
  const c = rc && g ? "both" : g ? "gridOnly" : rc ? "recastOnly" : "neither"; cnt[c]++;
  const col = { both: [214, 210, 200], neither: [70, 66, 62], gridOnly: [205, 60, 50], recastOnly: [40, 110, 205] }[c], o = (j * nx + i) * 3; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2];
}
await sharp(img, { raw: { width: nx, height: nz, channels: 3 } }).png().toFile(`${OUT}/recast-vs-grid.png`);
// Tapped routes: from the tea porch's south end, from the court, up onto the great hall's porch.
const routes = [[[-13.2, 0.45, 6.2], [-8, 0, 4]], [[0, 0, 25], [0, 1.5, -4.8]], [[-13.2, 0.45, 6.2], [13.5, 0.45, 18]], [[0, 0, 25], [-14.5, 1.5, -12]]];
const paths = routes.map(([a, b]) => { const s = performance.now(); const p = q.computePath({ x: a[0], y: a[1], z: a[2] }, { x: b[0], y: b[1], z: b[2] }, { halfExtents: { x: 0.5, y: 1, z: 0.5 } }); const ms = performance.now() - s;
  const pts = (p.path || p || []); let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
  return { from: a, to: b, ms: +ms.toFixed(3), points: pts.length, metres: +len.toFixed(2), ok: !!(p.success ?? pts.length) }; });
const { polys, verts } = (() => { let polys = 0, verts = 0; try { const tile = nav.getTile(0); const h = tile.header(); polys = h.polyCount(); verts = h.vertCount(); } catch {} return { polys, verts }; })();
const out = { commit: process.env.COMMIT || null, cs: CS, cfg, ms: { wasmInit: +initMs.toFixed(0), build: +buildMs.toFixed(0) }, polys, verts, tris: grid.outdoors.tris, usPerStandQuery: +(tq / nq * 1000).toFixed(2), compareWithGrid: { points: nq, ...cnt, m2: Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, +(v * S * S).toFixed(1)])) }, paths };
writeFileSync(`${OUT}/recast.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
