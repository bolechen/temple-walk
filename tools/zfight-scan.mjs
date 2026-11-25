// Z-fighting candidates in the built place (#655): where two surfaces lie in one plane, and which translucent layers write depth
// over one another. Run in Node on the scene the bake draws (tools/walk/scene.mjs) but with the page's real materials, so that
// transparent / depthWrite / side are what a visitor's page has. mergeStatic only batches meshes by material and keeps every vertex
// where it was, so a coplanar pair found here is a coplanar pair in the page; what changes is the mesh's name, which is why each
// finding carries the page's own labels: `part` (the top-level part `__pick` names) and `material` (customProgramCacheKey).
//
//   node tools/zfight-scan.mjs [--level=<id>] [--gap=0.002] [--min-area=1e-4] [--out=tools/out/zfight]
// → <out>/coplanar.json, transparent.json, summary.md  (world coordinates in metres, +x east, -z north/uphill, y up)
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
// props.js paints its mist and light shafts into a canvas and reads the pixels back: give the stub's canvas pixels to read.
{ const make = document.createElement; document.createElement = (tag) => { const c = make(tag), get = c.getContext; c.getContext = (...a) => { const x = get(...a); return new Proxy(x, { get: (t, k) => k === "getImageData" || k === "createImageData" ? (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) : t[k] }); }; return c; }; }
import { mkdirSync, writeFileSync } from "node:fs";
import { ROUTE } from "../app/src/tour.js";
import { MeshBVH, SAH } from "three-mesh-bvh";

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const GAP = +arg("gap", 0.002), MIN_AREA = +arg("min-area", 1e-4), OUT = arg("out", "tools/out/zfight"), LEVEL = arg("level", null);
const { LEVELS: KNOWN, DEFAULT_LEVEL, loadLevel } = await import("../app/src/level.js");
const { createMaterials } = await import("../app/src/materials.js");
const { buildInteriors } = await import("../app/src/interior.js");
const { createTrees } = await import("../app/src/trees.js");
const { createProps } = await import("../app/src/props.js");
const { createGround } = await import("../app/src/ground.js");
const { createBackdrop } = await import("../app/src/backdrop.js");
const L = await loadLevel(LEVEL || DEFAULT_LEVEL);

// The place as yard.js composes it (site, ground, backdrop, props, trees, the rooms), each top-level part tagged as yard.js's `part()` does.
const M = createMaterials(), keyOf = new Map(Object.entries(M).filter(([, v]) => v && v.isMaterial).map(([k, v]) => [v, k]));
const site = L.build(M), scene = new THREE.Scene(), tag = (name, make) => { const n = scene.children.length; make(); for (const o of scene.children.slice(n)) o.userData.part = name; };
tag("site", () => scene.add(site.root));
tag("ground", () => createGround(scene, site.shade, site.censer, site.paving));
if (L.backdrop) tag("backdrop", () => createBackdrop(scene, M, L.backdrop.site, L.backdrop.terraces, L.land));
let skipped = [];
try { tag("props", () => createProps(scene, M, site.censer, L.propsAt)); } catch (e) { skipped.push("props (" + e.message + ")"); }
tag("trees", () => createTrees(scene, M, site.trees, { a2c: false }));
const rooms = buildInteriors(M, site.halls); rooms.group.userData.part = "interior"; scene.add(rooms.group);
scene.updateMatrixWorld(true);

const partOf = (o) => { for (let p = o; p; p = p.parent) if (p.userData.part) return p.userData.part; return null; };
const matName = (m) => keyOf.get(m) || (m.customProgramCacheKey && /^[a-zA-Z]+$/.test(m.customProgramCacheKey()) ? m.customProgramCacheKey() : m.name || m.type);
const pathOf = (o) => { const a = []; for (let p = o; p && p.parent; p = p.parent) a.unshift(p.name || p.type); return a.slice(-4).join("/"); };

// ---- 1. the triangles ----
const metas = [], T = [];   // T: flat records {m: mesh index, a,b,c: world points, n, d, area}
const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
let instanced = 0, hidden = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  if (!o.visible) { hidden++; return; }
  if (o.isInstancedMesh) { instanced++; return; }
  const mats = Array.isArray(o.material) ? o.material : [o.material], g = o.geometry, p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count;
  const id = metas.length; metas.push({ mesh: o, part: partOf(o), path: pathOf(o), material: matName(mats[0]), mat: mats[0], side: mats[0].side, name: o.name || "" });
  const groups = g.groups.length ? g.groups : null;
  for (let i = 0; i + 2 < n; i += 3) {
    let mat = mats[0]; if (groups && mats.length > 1) { const gr = groups.find((q) => i >= q.start && i < q.start + q.count); if (gr) mat = mats[gr.materialIndex] || mats[0]; }
    const f = (k) => (ix ? ix.getX(i + k) : i + k);
    va.fromBufferAttribute(p, f(0)).applyMatrix4(o.matrixWorld); vb.fromBufferAttribute(p, f(1)).applyMatrix4(o.matrixWorld); vc.fromBufferAttribute(p, f(2)).applyMatrix4(o.matrixWorld);
    e1.subVectors(vb, va); e2.subVectors(vc, va); nn.crossVectors(e1, e2); const len = nn.length(); if (len < 2e-8) continue;
    nn.divideScalar(len);
    T.push({ m: id, mat, a: va.toArray(), b: vb.toArray(), c: vc.toArray(), n: nn.toArray(), d: nn.dot(va), area: len / 2 });
  }
});

// ---- 2. coplanar pairs: bucket by the plane's normal, window by its offset, then the triangles' own overlap on the plane ----
const NQ = 100, key3 = (n) => n.map((x) => Math.round(x * NQ));
const buckets = new Map();
T.forEach((t, i) => { const k = key3(t.n).join(","); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); });
for (const arr of buckets.values()) arr.sort((p, q) => T[p].d - T[q].d);
const dist = (t, p) => t.n[0] * p[0] + t.n[1] * p[1] + t.n[2] * p[2] - t.d;
const bbox = (t) => [0, 1, 2].map((k) => [Math.min(t.a[k], t.b[k], t.c[k]), Math.max(t.a[k], t.b[k], t.c[k])]);
function clipArea(P, Q, ax) {   // area of the overlap of two triangles projected along axis ax (Sutherland–Hodgman), in the plane's own units ≈ m² after the cos correction
  const [u, v] = ax === 0 ? [1, 2] : ax === 1 ? [0, 2] : [0, 1], pr = (T3) => [T3.a, T3.b, T3.c].map((p) => [p[u], p[v]]);
  let poly = pr(P); const q = pr(Q), orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), s = orient(q[0], q[1], q[2]) > 0 ? 1 : -1;
  for (let i = 0; i < 3 && poly.length; i++) {
    const A = q[i], B = q[(i + 1) % 3], out = [];
    for (let j = 0; j < poly.length; j++) {
      const C = poly[j], D = poly[(j + 1) % poly.length], cs = s * orient(A, B, C), ds = s * orient(A, B, D);
      if (cs >= 0) out.push(C);
      if ((cs >= 0) !== (ds >= 0)) { const f = cs / (cs - ds); out.push([C[0] + (D[0] - C[0]) * f, C[1] + (D[1] - C[1]) * f]); }
    }
    poly = out;
  }
  let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], r = poly[(i + 1) % poly.length]; a += p[0] * r[1] - r[0] * p[1]; }
  return Math.abs(a) / 2;
}
const lower = (arr, d) => { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (T[arr[mid]].d < d) lo = mid + 1; else hi = mid; } return lo; };
const found = new Map();   // "meshA|meshB|nkey" → cluster
let tested = 0;
for (const [k, arr] of buckets) {
  const base = k.split(",").map(Number);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const nb = buckets.get([base[0] + dx, base[1] + dy, base[2] + dz].join(",")); if (!nb) continue;
    const self = dx === 0 && dy === 0 && dz === 0;
    for (const i of arr) {
      const ti = T[i], bi = bbox(ti);
      for (let q = lower(nb, ti.d - GAP - 1e-4); q < nb.length; q++) {
        const j = nb[q], tj = T[j]; if (tj.d > ti.d + GAP + 1e-4) break;
        if (self ? j <= i : (k + "" > [base[0] + dx, base[1] + dy, base[2] + dz].join(",") + "" )) continue;
        const dot = ti.n[0] * tj.n[0] + ti.n[1] * tj.n[1] + ti.n[2] * tj.n[2]; if (dot < 0.9995) continue;
        const bj = bbox(tj); if ([0, 1, 2].some((a) => bi[a][1] < bj[a][0] - GAP || bj[a][1] < bi[a][0] - GAP)) continue;
        const gaps = [tj.a, tj.b, tj.c].map((p) => Math.abs(dist(ti, p))).concat([ti.a, ti.b, ti.c].map((p) => Math.abs(dist(tj, p)))), gap = Math.max(...gaps);
        if (gap > GAP) continue;
        const ax = ti.n.map(Math.abs).indexOf(Math.max(...ti.n.map(Math.abs))); tested++;
        const area = clipArea(ti, tj, ax) * Math.abs(ti.n[ax]); if (area < MIN_AREA) continue;
        const mi = metas[ti.m], mj = metas[tj.m], same = ti.m === tj.m, A = Math.min(ti.m, tj.m), B = Math.max(ti.m, tj.m);
        const id = `${A}|${B}|${key3(ti.n).join(",")}|${Math.round(ti.d / 0.01)}`;   // one finding per pair of meshes, per plane (to the centimetre)
        const c = found.get(id) || found.set(id, { meshes: [A, B], same, n: ti.n.map((x) => +x.toFixed(3)), area: 0, gapMax: 0, gapMin: 1, box: [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]], tris: 0, mats: new Set(), exact: 0, best: 0, pt: null }).get(id);
        c.area += area; c.tris++; if (area > c.best) { c.best = area; c.pt = [0, 1, 2].map((a) => (ti.a[a] + ti.b[a] + ti.c[a]) / 3); } c.gapMax = Math.max(c.gapMax, gap); c.gapMin = Math.min(c.gapMin, gap); if (gap < 1e-6) c.exact++;
        c.mats.add(ti.mat.side + "/" + tj.mat.side);
        for (const p of [ti.a, ti.b, ti.c, tj.a, tj.b, tj.c]) for (let a = 0; a < 3; a++) { c.box[0][a] = Math.min(c.box[0][a], p[a]); c.box[1][a] = Math.max(c.box[1][a], p[a]); }
      }
    }
  }
}
const label = (i) => { const m = metas[i]; return { part: m.part, material: m.material, mesh: m.path, tris: undefined, transparent: !!m.mat.transparent, depthWrite: m.mat.depthWrite, side: m.side, polygonOffset: !!m.mat.polygonOffset }; };
const coplanar = [...found.values()].map((c) => {
  const [A, B] = c.meshes, ctr = [0, 1, 2].map((a) => +((c.box[0][a] + c.box[1][a]) / 2).toFixed(2)), ext = [0, 1, 2].map((a) => +(c.box[1][a] - c.box[0][a]).toFixed(2));
  const po = (i) => metas[i].mat.polygonOffset;
  return { a: label(A), b: label(B), sameMesh: c.same, sameMaterial: metas[A].mat === metas[B].mat, normal: c.n, gap_mm: { min: +(c.gapMin * 1e3).toFixed(3), max: +(c.gapMax * 1e3).toFixed(3) }, exactTris: c.exact, tris: c.tris, area_m2: +c.area.toFixed(3), at: ctr, extent: ext, offsetHides: po(A) || po(B), _box: c.box, _pt: c.pt };
});

// ---- 3. translucent layers that write depth ----
const trans = [];
for (const m of metas) {
  const mt = m.mat; if (!(mt.transparent && mt.depthWrite !== false && mt.opacity <= 1)) continue;
  const bb = new THREE.Box3().setFromObject(m.mesh); if (bb.isEmpty()) continue;
  trans.push({ i: metas.indexOf(m), part: m.part, material: m.material, mesh: m.path, opacity: mt.opacity, alphaTest: mt.alphaTest, side: mt.side, renderOrder: m.mesh.renderOrder, box: bb, at: bb.getCenter(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)), extent: bb.getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)) });
}
const overlaps = [];
for (let i = 0; i < trans.length; i++) for (let j = i + 1; j < trans.length; j++) {
  const A = trans[i], B = trans[j], ib = A.box.clone().intersect(B.box); if (ib.isEmpty()) continue;
  const s = ib.getSize(new THREE.Vector3()); overlaps.push({ a: `${A.part}/${A.material}/${A.mesh}`, b: `${B.part}/${B.material}/${B.mesh}`, at: ib.getCenter(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)), overlapExtent: s.toArray().map((x) => +x.toFixed(2)), minThickness_mm: +(Math.min(...s.toArray()) * 1e3).toFixed(1), opacity: [A.opacity, B.opacity] });
}
const transOut = trans.map(({ box, i, ...r }) => r);


// ---- 4. depth precision ----
// A fixed-point depth buffer of b bits stores d = (1/n - 1/z) / (1/n - 1/f) in steps of 1/(2^b - 1), so two surfaces z metres from the
// eye can be told apart only if they are at least  dz(z) = z^2 (1/n - 1/f) / (2^b - 1)  apart (the derivative of d by z, inverted). Turned
// round, a gap g is lost beyond  z*(g) = sqrt(g (2^b - 1) / (1/n - 1/f)).
const NEAR = 0.1, FAR = 800, K = 1 / NEAR - 1 / FAR, STEPS = (b) => 2 ** b - 1;
const dz = (z, b) => (z * z * K) / STEPS(b), zStar = (g, b) => Math.sqrt((g * STEPS(b)) / K);
const precision = [10, 50, 200].map((z) => ({ z_m: z, "24bit_mm": +(dz(z, 24) * 1e3).toFixed(3), "16bit_mm": +(dz(z, 16) * 1e3).toFixed(1) }));

// ---- 5. distance from the walk, and the ranking ----
// The walk the acceptance covers (docs/t00/…): the measured route from the bamboo start to the first court, the court's round and the
// axis to the main hall's stair, the stair to the second terrace; indoors, each room's door. Horizontal distance from a finding's box to
// the nearest of these (1 m apart). The eye rides 2.6–11 m behind him (6.2 m by default), so a surface seen "from the route" is
// typically seen from about route distance + 6.2 m; that is the distance the finding is judged at, and the nearest it can be seen from is
// the route distance itself.
const pts = [];
const walk = (poly) => { for (let i = 0; i + 1 < poly.length; i++) { const [a, b] = [poly[i], poly[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let k = 0; k <= n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } };
if ((LEVEL || DEFAULT_LEVEL) === "t00") {
  walk(ROUTE); walk([[-10.8, 19], [10.8, 19], [10.8, 6], [-10.8, 6], [-10.8, 19]]); walk([[0, 29], [0, 15.4], [1.3, 13], [0, 10.6], [0, -4.5]]); walk([[0, 18], [0, -40]]);
} else walk([[site.start[0], site.start[1]], [site.start[0], site.start[1] - 40]]);
const doors = Object.values(rooms.rooms).map((r) => r.room.door);
const routeDist = (box, part) => {
  const [lo, hi] = box; let best = 1e9;
  const P = part === "interior" ? doors.map((d) => [d[0], d[1]]) : pts;
  for (const [x, z] of P) best = Math.min(best, Math.hypot(Math.max(lo[0] - x, 0, x - hi[0]), Math.max(lo[2] - z, 0, z - hi[2])));
  return best;
};
// Is it seen? A ray from each eye point along the walk (every 3 m, at the height the eye rides) to a point on the overlap, against every
// triangle drawn: a finding nobody can see from the walk is not a flicker candidate, however exactly it coincides.
const walker = L.createWalker ? L.createWalker(site) : null;
const geoAll = new THREE.BufferGeometry(), flat = new Float32Array(T.length * 9); T.forEach((t, i) => flat.set([...t.a, ...t.b, ...t.c], i * 9)); geoAll.setAttribute("position", new THREE.BufferAttribute(flat, 3));
const bvh = new MeshBVH(geoAll, { strategy: SAH, targetLeafSize: 8 });
const eyes = pts.filter((_, i) => i % 3 === 0).map(([x, z]) => new THREE.Vector3(x, (walker ? walker.eyeAt(x, z) : 0) + 1.6, z));
for (const r of Object.values(rooms.rooms)) { const R = r.room; eyes.push(new THREE.Vector3(R.door[0], R.y + 1.6, R.door[1]), new THREE.Vector3((R.x0 + R.x1) / 2, R.y + 1.6, (R.z0 + R.z1) / 2)); }
const seenAt = new Map(), ray = new THREE.Ray(), dir = new THREE.Vector3(), P = new THREE.Vector3();
for (const c of coplanar) {
  const r = routeDist(c._box, c.a.part), g = c.gap_mm.max / 1e3, n = new THREE.Vector3(...c.normal), seen = [];
  P.set(...c._pt).addScaledVector(n, 0.0005);
  for (const e of eyes) {
    dir.subVectors(P, e); const dd = dir.length(); if (dd < 0.05 || dd > 120) continue; dir.divideScalar(dd);
    if (dir.dot(n) >= 0 && c.a.side === 0 && c.b.side === 0) continue;   // seen from behind, and drawn on its front only
    ray.set(e, dir); const h = bvh.raycastFirst(ray, THREE.DoubleSide);
    if (!h || h.distance >= dd - 0.004) seen.push(dd), seenAt.set(dd, e);
  }
  seen.sort((p, q) => p - q);
  c.pt = P.toArray().map((x) => +x.toFixed(3)); c.medianEye = seen.length ? seenAt.get(seen[seen.length >> 1]).toArray().map((x) => +x.toFixed(2)) : null; seenAt.clear();
  c.routeDist_m = +r.toFixed(1); c.eyesSeeing = seen.length; c.eyesTried = eyes.length;
  c.seenFrom_m = seen.length ? { nearest: +seen[0].toFixed(1), median: +seen[seen.length >> 1].toFixed(1), farthest: +seen[seen.length - 1].toFixed(1) } : null;
  const view = seen.length ? seen[seen.length >> 1] + 0 : 0;   // judged at the median distance of the route points that see it
  c.visibleDifference = c.sameMaterial ? "same material: shades alike unless per-vertex AO / uv differ" : "different materials";
  c.lostBeyond_m = { "24bit": g < 1e-6 ? 0 : +zStar(g, 24).toFixed(2), "16bit": g < 1e-6 ? 0 : +zStar(g, 16).toFixed(2) };
  c.fights24 = seen.length > 0 && view > c.lostBeyond_m["24bit"]; c.fights16 = seen.length > 0 && view > c.lostBeyond_m["16bit"];
  c.tier = !seen.length ? "H: not in sight from the walk" : c.fights24 ? "A: fights at 24 bit (median view distance)" : c.fights16 ? "B: fights at 16 bit only" : "C: holds at both at the median view distance";
  const vis = c.sameMaterial ? 0.25 : 1, cover = Math.sqrt(Math.min(c.area_m2, 20)), reach = seen.length / eyes.length, down = c.normal[1] < -0.5 ? 0.5 : 1;
  c.score = +(vis * cover * Math.sqrt(reach) * down * (seen.length ? 1 : 0)).toFixed(3);
  delete c._box; delete c._pt;
}
const tierRank = (c) => (c.tier[0] === "H" ? 3 : c.fights24 ? 0 : c.fights16 ? 1 : 2);
coplanar.sort((p, q) => tierRank(p) - tierRank(q) || q.score - p.score);

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/coplanar.json`, JSON.stringify(coplanar, null, 1));
writeFileSync(`${OUT}/transparent.json`, JSON.stringify({ layers: transOut, overlaps }, null, 1));
const stats = { level: L.id || LEVEL || DEFAULT_LEVEL, meshes: metas.length, triangles: T.length, instancedSkipped: instanced, hiddenSkipped: hidden, buildSkipped: skipped, gap_mm: GAP * 1e3, minArea_m2: MIN_AREA, pairsTested: tested, coplanarFindings: coplanar.length, tiers: Object.fromEntries(["A", "B", "C", "H"].map((k) => [k, coplanar.filter((c) => c.tier[0] === k).length])), exact: coplanar.filter((c) => c.gap_mm.max < 1e-3).length, transparentDepthWriters: trans.length, transparentOverlaps: overlaps.length, depthPrecision: precision };
writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 1));
const kinds = new Map(); for (const m of metas) { const t = m.mat; if (t.transparent || t.opacity < 1 || t.alphaTest > 0) { const k = `${m.part}/${m.material}: transparent=${t.transparent} depthWrite=${t.depthWrite} opacity=${t.opacity} alphaTest=${t.alphaTest}`; kinds.set(k, (kinds.get(k) || 0) + 1); } }
const md = ["# z-fighting scan", "", "```json", JSON.stringify(stats, null, 1), "```", "", "## translucent or cut-out materials in the built scene", "", ...[...kinds].map(([k, n]) => `- ${n}× ${k}`), "",
  "## top coplanar candidates", "", "| # | tier | parts / materials | gap mm | area m² | at (x,y,z) | route m | seen from | 24-bit lost beyond m | 16-bit lost beyond m |", "|---|---|---|---|---|---|---|---|---|---|",
  ...coplanar.slice(0, 40).map((c, i) => `| ${i + 1} | ${c.tier[0]} | ${c.a.part}/${c.a.material} × ${c.b.part}/${c.b.material}${c.sameMesh ? " (one mesh)" : ""} | ${c.gap_mm.min}–${c.gap_mm.max} | ${c.area_m2} | ${c.at.join(", ")} | ${c.routeDist_m} | ${c.seenFrom_m ? `${c.eyesSeeing}/${c.eyesTried} eyes, ${c.seenFrom_m.nearest}–${c.seenFrom_m.farthest} m` : "—"} | ${c.lostBeyond_m["24bit"]} | ${c.lostBeyond_m["16bit"]} |`)];
writeFileSync(`${OUT}/summary.md`, md.join("\n") + "\n");
console.log(stats); console.log(md.slice(md.indexOf("## translucent or cut-out materials in the built scene")).slice(0, 8).join("\n"));
