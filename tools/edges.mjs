// The edge sweep: does the novice's body fit everywhere his feet are allowed to go?
//
//     node tools/edges.mjs [--json tools/out/edge-audit/sweep.json] [--tol 0.01] [--top 12]
//
// The walker asks only whether a point of ground is free. The boy standing on that point is wider than a point: his
// sleeves, his hands when he walks, the hat on his back. So this builds the real plan, floods every place his centre
// can reach (a twentieth of a metre at a time), measures how far the real model reaches from its centre at each
// height in every pose it takes (standing, walking, hurrying, hands together), and then goes over the surface of
// everything that is built and asks of each point on it: is there a place he can stand from which some part of him
// would be inside this? Turning on the spot sweeps his whole outline round, so the outline is taken as a solid of
// revolution; that is the strict reading, and it is the one a visitor sees when he turns beside a column.
//
// Below the knee his shoes and the hem of his robe are gone over by themselves (see `outline` and `PARTS`), and each
// point of what is built is put down as a part of its building (a column's base, a sill, a cheek stone, a rail's end,
// the foot of a wall), so that the table can say how near he comes to each part, not only that he never got in.
//
// What it prints: for each building and each kind of thing (by material), the deepest any part of him can get into
// it and where he stands when it happens. It exits with an error if anything is deeper than the tolerance.
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import fs from "node:fs";
const { buildSite, createWalker, SITE, APPROACH, LEVELS } = await import("../app/src/site.js");
const { CHEEK, stairProfile } = await import("../app/src/geo.js");
const { createMonk } = await import("../app/src/monk.js");
const { dressed } = await import("../tests/unit/novice-glb.mjs");   // the sculpted body he wears in the page, read from the file
const { createTrees } = await import("../app/src/trees.js");
const { censerGeometry } = await import("../app/src/censer.js");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const TOL = +arg("tol", 0.01), TOP = +arg("top", 12), OUT = arg("json", "tools/out/edge-audit/sweep.json");
const G = 0.05, KNEE = 0.32, BIN = 0.05, MARGIN = 0.3;   // MARGIN: how far off a thing he may stay and still be said to have come up to it
// Below the knee he is gone over separately: his shoes and the hem of his robe against what stands beside his way
// (a column's base, a sill, a cheek stone, the foot of a wall, a platform's edge). Not against the treads he climbs:
// on a stair, and against a tread ahead, a foot is always near stone, and that is the business of the stair tests.
// What each part of a building is called in the table, and which of them are gone over below the knee.
export const PARTS = ["台基外缘", "踏步鼻口", "踏步侧沿", "门槛", "柱础", "外檐柱", "栏杆端头", "墙地接缝", "墙与屋身", "树", "摆设", "其他"];
const P = Object.fromEntries(PARTS.map((n, i) => [n, i])), LOW_SKIP = new Set([P["踏步鼻口"]]);

// ---- How far he reaches from his centre, at each height, over every pose ----
export function outline() {
  // `bins`: how far any part of him reaches, turned through a whole circle, in every pose. `low`: the same below the
  // knee, but for his walking stride only sideways: a foot is put out ahead only toward where he is going, and where
  // something stands in his way he is stopped short of it and stands (he turns on the spot with his feet together).
  const bins = new Float32Array(40), low = new Float32Array(40), v = new THREE.Vector3();
  for (const make of [createMonk, () => dressed(createMonk)]) for (const [speed, pray] of [[0, false], [2.1, false], [4.2, false], [0, true], [0, "hop"], [2.1, "hop"]]) {   // both bodies; standing, walking, hurrying, hands together, in the air
    const monk = make(), striding = speed > 0 && pray !== "hop";
    for (let k = 0; k < 150; k++) {
      monk.update(1 / 30, speed, pray, k / 30, () => 0, { heightAt: () => 0, stairs: false }); monk.group.updateMatrixWorld(true); monk.skeleton?.update?.();   // he is a skinned figure: his surface is where his bones put it, not where it was modelled
      monk.group.traverse((o) => {
        if (!o.isMesh || !o.visible || o.userData.shadow || o.material?.transparent) return;
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { (o.isSkinnedMesh ? o.getVertexPosition(i, v) : v.fromBufferAttribute(a, i)).applyMatrix4(o.matrixWorld); const b = Math.floor(v.y / BIN); if (b < 0 || b >= 40 || v.y <= 0.02) continue;
          bins[b] = Math.max(bins[b], Math.hypot(v.x, v.z)); low[b] = Math.max(low[b], striding ? Math.abs(v.x) : Math.hypot(v.x, v.z)); }
      });
    }
  }
  return Object.assign(bins, { low });
}

export function sweep({ tol = TOL } = {}) {
  const M = new Proxy({}, { get: (t, k) => { const mk = () => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) }); return k === "plaster" || k === "interior" ? () => (t["__" + k] ||= mk()) : (t[k] ||= mk()); } });
  const T0 = Date.now(), lap = (m) => process.env.EDGE_LAPS && console.error(((Date.now() - T0) / 1000).toFixed(1), m);
  const site = buildSite(M), walker = createWalker(site); site.root.updateMatrixWorld(true); lap("built");
  const prof = outline(), top = (() => { let t = 0; prof.forEach((r, i) => { if (r > 0) t = (i + 1) * BIN; }); return t; })();
  const RMAX = Math.max(...prof.slice(Math.floor(KNEE / BIN)));

  lap("outline");
  // ---- Everywhere his centre can be ----
  const X0 = -36, X1 = 36, Z0 = SITE.zN - 3, Z1 = APPROACH.end + 3, nx = Math.ceil((X1 - X0) / G), nz = Math.ceil((Z1 - Z0) / G);
  const reach = new Uint8Array(nx * nz), foot = new Float32Array(nx * nz), cx = (i) => X0 + (i + 0.5) * G, cz = (j) => Z0 + (j + 0.5) * G;
  const at = (x, z) => { const i = Math.floor((x - X0) / G), j = Math.floor((z - Z0) / G); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
  const todo = [at(site.start[0], site.start[1])]; reach[todo[0]] = 1; foot[todo[0]] = walker.heightAt(site.start[0], site.start[1]);
  // Then each balcony walked round (site.lofts), from its door, with the walker up there: its floor lies inside the walls
  // of the storeys below, where nothing on the ground reaches, so the two floods never meet. The walker comes back down
  // for the rest of the sweep (the stairs and the open ground are asked of it), and each spot keeps the floor it had.
  const flood = () => { while (todo.length) {
    const c = todo.pop(), i = c % nx, j = (c / nx) | 0, h = foot[c];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const n = b * nx + a; if (reach[n]) continue;
      const x = cx(a), z = cz(b); if (walker.blocked(x, z)) continue; const nh = walker.heightAt(x, z); if (Math.abs(nh - h) > 0.45) continue;
      reach[n] = 1; foot[n] = nh; todo.push(n);
    }
  } };
  flood();
  for (const L of Object.values(site.lofts || {})) { walker.setLoft(L.id); const c = at(L.door[0], L.door[1]); reach[c] = 1; foot[c] = walker.heightAt(L.door[0], L.door[1]); todo.push(c); flood(); }
  walker.setLoft(null);
  lap("flooded");
  // Coarse tiles: the lowest and highest feet anywhere near, so that most of what is built can be passed over at once.
  const T = 0.8, tx = Math.ceil((X1 - X0) / T), tz = Math.ceil((Z1 - Z0) / T), lo = new Float32Array(tx * tz).fill(Infinity), hi = new Float32Array(tx * tz).fill(-Infinity);
  for (let c = 0; c < reach.length; c++) if (reach[c]) {
    const i = Math.floor(((c % nx) * G) / T), j = Math.floor((((c / nx) | 0) * G) / T);
    for (let a = Math.max(0, i - 1); a <= Math.min(tx - 1, i + 1); a++) for (let b = Math.max(0, j - 1); b <= Math.min(tz - 1, j + 1); b++) { const t = b * tx + a; if (foot[c] < lo[t]) lo[t] = foot[c]; if (foot[c] > hi[t]) hi[t] = foot[c]; }
  }
  const near = (xa, xb, za, zb, ya, yb) => {
    const i0 = Math.max(0, Math.floor((xa - X0) / T)), i1 = Math.min(tx - 1, Math.floor((xb - X0) / T)), j0 = Math.max(0, Math.floor((za - Z0) / T)), j1 = Math.min(tz - 1, Math.floor((zb - Z0) / T));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const t = j * tx + i; if (yb > lo[t] + 0.02 && ya < hi[t] + top) return true; }
    return false;
  };

  // ---- Building by building, side by side: where he can come up to each thing, and what he meets there ----
  const NAME = { "万年正续": "山门", "云径禅寺": "山门", "释迦宝殿": "大雄宝殿" }, groups = new Map();
  for (const b of site.buildings) {   // storeys of one building are one thing; an unnamed storey belongs to the named one it stands in
    let name = NAME[b.name] || b.name;
    if (!name) { const host = site.buildings.find((o) => o.name && o !== b && o.x0 <= b.x1 && o.x1 >= b.x0 && o.z0 <= b.z1 && o.z1 >= b.z0); name = host ? NAME[host.name] || host.name : "?"; }
    const g = groups.get(name) || groups.set(name, { name, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }).get(name);
    g.x0 = Math.min(g.x0, b.x0); g.x1 = Math.max(g.x1, b.x1); g.z0 = Math.min(g.z0, b.z0); g.z1 = Math.max(g.z1, b.z1);
  }
  const Ap = APPROACH, items = [...groups.values(),
    { name: "照壁", x0: -5.75, x1: 5.75, z0: 54.5, z1: 55.5 }, { name: "龙井", x0: 11.6, x1: 14.8, z0: LEVELS[1].zS - 0.5, z1: LEVELS[1].zS + 1.4 },
    { name: "古道转折（上：正对前院的一段与平台）", x0: -Ap.w / 2 - CHEEK, x1: Ap.xTurn, z0: Ap.zA0, z1: Ap.zA1 },
    { name: "古道转折（中：洗砚池旁平台）", x0: Ap.xB0, x1: Ap.xB1, z0: Ap.zA0, z1: Ap.zA1 }, { name: "古道转折（下：起步平台）", x0: Ap.xB0, x1: Ap.xB1 + 2.6, z0: Ap.zC0, z1: Ap.zC1 },
    ...LEVELS.map((L, i) => ({ name: `第${"一二三"[i]}层台地的大台阶`, x0: -L.stair / 2 - CHEEK, x1: L.stair / 2 + CHEEK, z0: L.zS, z1: L.zS + stairProfile(L.y - (i ? LEVELS[i - 1].y : 0)).run })),
    ...LEVELS.map((L, i) => ({ name: `第${"一二三"[i]}层台地南缘护墙`, x0: -L.x, x1: L.x, z0: L.zS - 0.26, z1: L.zS })),
  ];
  // Where each point lies: the thing in the table whose ground it is on, the smallest where two overlap.
  let itemAt = (x, z) => -1;
  { const GI = 0.5, ix = Math.ceil((X1 - X0) / GI), iz = Math.ceil((Z1 - Z0) / GI), grid = new Int8Array(ix * iz).fill(-1), area = new Float32Array(ix * iz).fill(Infinity);
    items.forEach((it, n) => { const a = (it.x1 - it.x0) * (it.z1 - it.z0), e = 1.2;   // a thing's ground reaches as far round it as the sides of the table look
      for (let j = Math.max(0, Math.floor((it.z0 - e - Z0) / GI)); j <= Math.min(iz - 1, Math.floor((it.z1 + e - Z0) / GI)); j++) for (let i = Math.max(0, Math.floor((it.x0 - e - X0) / GI)); i <= Math.min(ix - 1, Math.floor((it.x1 + e - X0) / GI)); i++) if (a < area[j * ix + i]) { area[j * ix + i] = a; grid[j * ix + i] = n; } });
    itemAt = (x, z) => { const i = Math.floor((x - X0) / GI), j = Math.floor((z - Z0) / GI); return i < 0 || j < 0 || i >= ix || j >= iz ? -1 : grid[j * ix + i]; }; }
  // ---- Go over the surface of what is built ----
  // `by[c]` is set where some place to stand lies within his reach of cell c: most points fail this at once.
  const R = Math.ceil((RMAX + MARGIN) / G) + 1, by = new Uint8Array(nx * nz), row = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) { let last = -1e9; for (let i = 0; i < nx; i++) { if (reach[j * nx + i]) last = i; if (i - last <= R) row[j * nx + i] = 1; } last = 1e9; for (let i = nx - 1; i >= 0; i--) { if (reach[j * nx + i]) last = i; if (last - i <= R) row[j * nx + i] = 1; } }
  for (let i = 0; i < nx; i++) { let last = -1e9; for (let j = 0; j < nz; j++) { if (row[j * nx + i]) last = j; if (j - last <= R) by[j * nx + i] = 1; } last = 1e9; for (let j = nz - 1; j >= 0; j--) { if (row[j * nx + i]) last = j; if (last - j <= R) by[j * nx + i] = 1; } }
  const RR = Math.ceil((RMAX + MARGIN) / G) + 1, list = []; for (let dj = -RR; dj <= RR; dj++) for (let di = -RR; di <= RR; di++) if (Math.hypot(Math.max(0, Math.abs(di) - 1), Math.max(0, Math.abs(dj) - 1)) * G < RMAX + MARGIN) list.push(di, dj);
  const offs = Int32Array.from(list), nOff = offs.length / 2;
  const deep = new Float32Array(nx * nz), what = new Uint16Array(nx * nz), names = [""], hit = new Float32Array(nx * nz * 3);
  const lowProf = prof.low, strictProf = prof, strictLow = new Float32Array(nx * nz), deepLow = new Float32Array(nx * nz), lowWhat = new Uint8Array(nx * nz), lowHit = new Float32Array(nx * nz * 3);
  // On a stair his feet are the stair tests' business (see above): the cells over a flight are left out below the knee.
  const stairs = new Uint8Array(nx * nz); for (let c = 0; c < reach.length; c++) if (reach[c] && walker.onStairs(cx(c % nx), cz((c / nx) | 0))) stairs[c] = 1;
  // What part of a building a point of it is, from what it is made of and what the plan says stands there.
  const rounds = site.walk.posts.filter((p) => p.r !== undefined), pg = new Map(), pk = (x, z) => Math.floor(x) * 4096 + Math.floor(z);
  for (const p of rounds) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = pk(p.x + a, p.z + b); (pg.get(k) || pg.set(k, []).get(k)).push(p); }
  const postAt = (x, z, k) => { for (const p of pg.get(pk(x, z)) || []) if (Math.hypot(x - p.x, z - p.z) < p.r * k + 0.05) return p; return null; };
  const ends = []; site.root.updateMatrixWorld(true); site.root.traverse((o) => { for (const e of o.userData.railEnds || []) ends.push(new THREE.Vector3(...e).applyMatrix4(o.matrixWorld)); });
  const flights = site.walk.ramps.map((r) => { const across = r.low && r.high && Math.abs(r.high[0] - r.low[0]) > Math.abs(r.high[1] - r.low[1]) ? "z" : "x", e = 0.35;   // a flight's treads run the full width out to its cheeks
    return across === "x" ? { x0: r.x0 - e, x1: r.x1 + e, z0: r.z0, z1: r.z1 } : { x0: r.x0, x1: r.x1, z0: r.z0 - e, z1: r.z1 + e }; });
  const props = site.walk.posts.filter((q) => q.r === undefined && !(q.cheek));
  const WALL = new Set(["plaster", "__plaster", "rubble", "gable", "seep", "dark"]), WOOD = new Set(["woodX", "woodZ", "woodV", "lattice", "fascia", "iron", "lacquer"]);
  const partOf = (x, y, z, mat) => {
    if (mat === "bark") return P["树"];
    if (mat === "steps") return flights.some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) ? P["踏步鼻口"] : P["踏步侧沿"];
    if (props.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1)) return P["摆设"];   // what stands about: a table, a stool, a sutra pillar, a lamp
    if (mat === "woodV" && postAt(x, z, 1.25)) return P["外檐柱"];
    if (mat === "monolith" && postAt(x, z, 1.7)) return P["柱础"];
    if ((mat === "monolith" || mat === "woodX") && ends.some((e) => Math.hypot(x - e.x, z - e.z) < 0.3 && y > e.y - 0.05 && y < e.y + 1.35)) return P["栏杆端头"];
    if (mat === "stone" || mat === "monolith") return P["台基外缘"];
    if (WOOD.has(mat)) return P["门槛"];   // wood low by his feet is a sill or a ground beam (below); higher up it is the building's body
    if (WALL.has(mat)) return P["墙地接缝"];
    return P["其他"];
  };
  const NI = 64, NP = PARTS.length, best = [new Float32Array(NI * NP).fill(-Infinity), new Float32Array(NI * NP).fill(-Infinity)], close = [new Uint32Array(NI * NP), new Uint32Array(NI * NP)], exists = new Uint32Array(NI * NP), bestAt = [new Float32Array(NI * NP * 3), new Float32Array(NI * NP * 3)];
  let label = 0, samples = 0, mname = "";
  const point = (x, y, z) => {
    const i = Math.floor((x - X0) / G), j = Math.floor((z - Z0) / G); if (i < 0 || j < 0 || i >= nx || j >= nz || !by[j * nx + i]) return;
    samples++;
    const it = itemAt(x, z), part = partOf(x, y, z, mname); if (it >= 0) exists[it * NP + part]++;
    // A point under a floor he can stand on is the face of a step: his shoes are put on top of it, not into it.
    // (Asked of the floor his shoe is put on, `heightAt`, which holds there even where a column keeps his centre off.)
    let under = null;
    for (let k = 0; k < nOff; k++) {
      const a = i + offs[k * 2], b = j + offs[k * 2 + 1]; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const c = b * nx + a; if (!reach[c]) continue;
      const h = y - foot[c]; if (h < 0.02 || h >= top) continue;
      const low = h < KNEE; if (low && (stairs[c] || LOW_SKIP.has(part) || (under ??= walker.heightAt(x, z) >= y - 0.01))) continue;
      const ddx = x - (X0 + (a + 0.5) * G), ddz = z - (Z0 + (b + 0.5) * G), dist = Math.sqrt(ddx * ddx + ddz * ddz), hb = (h / BIN) | 0;
      // Below the knee a thing lower than his foot can go into it is not deeper than its height above his sole.
      const d = low ? Math.min(lowProf[hb] - dist, h) : prof[hb] - dist; if (d <= -MARGIN) continue;
      if (low && strictProf[hb] - dist > strictLow[c]) strictLow[c] = Math.min(strictProf[hb] - dist, h);
      // A sill is wood by his feet; the foot of a wall is a wall by his feet. Higher up they are the building's body.
      const pp = part === P["门槛"] && h > 0.3 ? P["墙与屋身"] : part === P["墙地接缝"] && h > 0.3 ? P["墙与屋身"] : part, pass = low ? 1 : 0;
      if (it >= 0) { const q = it * NP + pp; if (d > -0.1) close[pass][q]++; if (d > best[pass][q]) { best[pass][q] = d; bestAt[pass][q * 3] = cx(a); bestAt[pass][q * 3 + 1] = foot[c]; bestAt[pass][q * 3 + 2] = cz(b); } }
      if (low) { if (d > deepLow[c]) { deepLow[c] = d; lowWhat[c] = pp; lowHit[c * 3] = x; lowHit[c * 3 + 1] = y; lowHit[c * 3 + 2] = z; } continue; }
      if (d <= deep[c]) continue;
      deep[c] = d; what[c] = label; hit[c * 3] = x; hit[c * 3 + 1] = y; hit[c * 3 + 2] = z;
    }
  };
  lap("masks");
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  // A triangle is halved across its longest side until no side is longer than the grid, then its middle is asked.
  // (Halving, not quartering: a hundred-metre sliver of coping quartered down to a twentieth of a metre is four million pieces.)
  const tri = (ax, ay, az, bx, by, bz, qx, qy, qz, depth) => {
    const RM = RMAX + MARGIN, xa = Math.min(ax, bx, qx) - RM, xb = Math.max(ax, bx, qx) + RM, za = Math.min(az, bz, qz) - RM, zb = Math.max(az, bz, qz) + RM;
    if (!near(xa, xb, za, zb, Math.min(ay, by, qy), Math.max(ay, by, qy))) return;
    const ab = Math.hypot(ax - bx, ay - by, az - bz), bq = Math.hypot(bx - qx, by - qy, bz - qz), qa = Math.hypot(qx - ax, qy - ay, qz - az), e = Math.max(ab, bq, qa);
    if (e <= 0.06 || depth > 40) { point((ax + bx + qx) / 3, (ay + by + qy) / 3, (az + bz + qz) / 3); return; }
    if (e === ab) { const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2; tri(ax, ay, az, mx, my, mz, qx, qy, qz, depth + 1); tri(mx, my, mz, bx, by, bz, qx, qy, qz, depth + 1); }
    else if (e === bq) { const mx = (bx + qx) / 2, my = (by + qy) / 2, mz = (bz + qz) / 2; tri(ax, ay, az, bx, by, bz, mx, my, mz, depth + 1); tri(ax, ay, az, mx, my, mz, qx, qy, qz, depth + 1); }
    else { const mx = (qx + ax) / 2, my = (qy + ay) / 2, mz = (qz + az) / 2; tri(ax, ay, az, bx, by, bz, mx, my, mz, depth + 1); tri(mx, my, mz, bx, by, bz, qx, qy, qz, depth + 1); }
  };
  const mesh = (o, world) => {
    const g = o.geometry, p = g.attributes.position, ix = g.index; if (!p) return;
    const n = ix ? ix.count : p.count;
    for (let k = 0; k < n; k += 3) {
      A.fromBufferAttribute(p, ix ? ix.getX(k) : k).applyMatrix4(world); B.fromBufferAttribute(p, ix ? ix.getX(k + 1) : k + 1).applyMatrix4(world); C.fromBufferAttribute(p, ix ? ix.getX(k + 2) : k + 2).applyMatrix4(world);
      tri(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z, 0);
    }
  };
  const m4 = new THREE.Matrix4(), w4 = new THREE.Matrix4();
  // The trees are grown by their own module, not by the plan: their trunks and boughs are gone over too (their
  // leaves are not: he may brush through a spray of maple).
  const grove = new THREE.Scene(); createTrees(grove, M, site.trees.filter((t) => !t[5]), {}); grove.updateMatrixWorld(true);
  const built = new THREE.Group(); built.add(site.root); grove.traverse((o) => { if (o.isMesh && o.material?.name !== "bark") o.visible = false; }); built.add(grove);
  // And the censer on the axis of the first court, which props.js draws (censer.js), not the plan.
  { const c = new THREE.Mesh(censerGeometry().translate(site.censer.x, site.censer.y, site.censer.z), new THREE.MeshBasicMaterial({ name: "censer" })); built.add(c); }
  built.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData.soft) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material, name = mat?.name || o.name || "?";
    label = names.indexOf(name); if (label < 0) label = names.push(name) - 1; mname = name;
    if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); mesh(o, w4.multiplyMatrices(o.matrixWorld, m4)); }
    else mesh(o, o.matrixWorld);
  });

  lap("swept " + samples);
  // ---- Say what was found ----
  const where = (x, z) => { let best = "the grounds"; for (const b of site.buildings) if (b.name && x > b.x0 - 1.5 && x < b.x1 + 1.5 && z > b.z0 - 1.5 && z < b.z1 + 1.5) best = b.name; return best; };
  const rows = new Map(); let cells = 0, worst = 0, worstLow = 0, worstStrict = 0; const low = [];
  for (let c = 0; c < reach.length; c++) if (reach[c] && strictLow[c] > worstStrict) worstStrict = strictLow[c];
  for (let c = 0; c < reach.length; c++) if (reach[c] && deepLow[c] > 0) { if (deepLow[c] > worstLow) worstLow = deepLow[c]; if (deepLow[c] > tol) low.push({ at: [cx(c % nx), foot[c], cz((c / nx) | 0)].map((v) => +v.toFixed(2)), into: [lowHit[c * 3], lowHit[c * 3 + 1], lowHit[c * 3 + 2]].map((v) => +v.toFixed(2)), part: PARTS[lowWhat[c]], place: "", cm: +(deepLow[c] * 100).toFixed(1) }); }
  for (let c = 0; c < reach.length; c++) {
    if (!reach[c]) continue; cells++;
    const x = cx(c % nx), z = cz((c / nx) | 0), place = where(x, z), d = deep[c], thing = d > 0 ? names[what[c]] : null;
    const pr = rows.get(place) || rows.set(place, { place, cells: 0, touching: 0, over: 0, worst: 0, at: null, things: {} }).get(place);
    pr.cells++; if (d > 0) pr.touching++;
    if (d > tol) { pr.over++; const t = (pr.things[thing] ||= { cells: 0, worst: 0, at: null, into: null }); t.cells++; if (d > t.worst) { t.worst = +d.toFixed(3); t.at = [+x.toFixed(2), +foot[c].toFixed(2), +z.toFixed(2)]; t.into = [hit[c * 3], hit[c * 3 + 1], hit[c * 3 + 2]].map((v) => +v.toFixed(2)); } }
    if (d > pr.worst) { pr.worst = +d.toFixed(3); pr.at = [+x.toFixed(2), +foot[c].toFixed(2), +z.toFixed(2)]; }
    if (d > worst) worst = d;
  }
  // The same findings as separate spots: places over the tolerance that lie within a metre of one another.
  const coarse = new Map();
  for (let c = 0; c < reach.length; c++) if (reach[c] && deep[c] > tol) { const x = cx(c % nx), z = cz((c / nx) | 0), k = Math.floor(x) + "," + Math.floor(z); const q = coarse.get(k) || coarse.set(k, { cells: 0, worst: 0, at: null, into: null, thing: "", x0: x, x1: x, z0: z, z1: z }).get(k);
    q.cells++; q.x0 = Math.min(q.x0, x); q.x1 = Math.max(q.x1, x); q.z0 = Math.min(q.z0, z); q.z1 = Math.max(q.z1, z); if (deep[c] > q.worst) { q.worst = deep[c]; q.at = [x, foot[c], z]; q.into = [hit[c * 3], hit[c * 3 + 1], hit[c * 3 + 2]]; q.thing = names[what[c]]; } }
  const spots = [], seenK = new Set();
  for (const k of coarse.keys()) { if (seenK.has(k)) continue; const todo = [k], sp = { cells: 0, worst: 0, at: null, into: null, thing: "", x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; seenK.add(k);
    while (todo.length) { const kk = todo.pop(), q = coarse.get(kk), [i, j] = kk.split(",").map(Number); sp.cells += q.cells; sp.x0 = Math.min(sp.x0, q.x0); sp.x1 = Math.max(sp.x1, q.x1); sp.z0 = Math.min(sp.z0, q.z0); sp.z1 = Math.max(sp.z1, q.z1); if (q.worst > sp.worst) { sp.worst = q.worst; sp.at = q.at; sp.into = q.into; sp.thing = q.thing; }
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const n = (i + a) + "," + (j + b); if (coarse.has(n) && !seenK.has(n)) { seenK.add(n); todo.push(n); } } }
    const r = (v) => +v.toFixed(2); spots.push({ place: where(sp.at[0], sp.at[2]), thing: sp.thing, worst: +sp.worst.toFixed(3), cells: sp.cells, at: sp.at.map(r), into: sp.into.map(r), box: [sp.x0, sp.x1, sp.z0, sp.z1].map(r) }); }
  spots.sort((a, b) => b.worst - a.worst);
  const why = (x, z) => {   // what keeps him from standing there
    if (Math.abs(x) > SITE.x - 0.6 || z < SITE.zN + 0.6) return "围墙之外";
    const other = site.buildings.find((b) => b.name && x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6); if (other) return `是${NAME[other.name] || other.name}的台基或屋身`;
    if (z > SITE.fore + 0.3 && walker.onGround(x, z)) return "路外的竹林与山坡，没有可走的地面";
    for (const L of LEVELS) if (Math.abs(z - L.zS) < 1.2) return "台地边缘的挡土墙与护墙";
    return "实体（墙、坡或台基），没有可走的地面";
  };
  const band = (x0, x1, z0, z1) => { let n = 0, d = 0, touch = 0; const i0 = Math.max(0, Math.floor((x0 - X0) / G)), i1 = Math.min(nx - 1, Math.floor((x1 - X0) / G)), j0 = Math.max(0, Math.floor((z0 - Z0) / G)), j1 = Math.min(nz - 1, Math.floor((z1 - Z0) / G));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = j * nx + i; if (!reach[c]) continue; n++; if (deep[c] > 0) touch++; if (deep[c] > d) d = deep[c]; } return { places: n, touching: touch, deepest_cm: +(d * 100).toFixed(1) }; };
  const R1 = 1.2, coverage = items.map((it) => {
    const sides = { 南: band(it.x0, it.x1, it.z1, it.z1 + R1), 北: band(it.x0, it.x1, it.z0 - R1, it.z0), 东: band(it.x1, it.x1 + R1, it.z0, it.z1), 西: band(it.x0 - R1, it.x0, it.z0, it.z1) };
    const mid = { 南: [(it.x0 + it.x1) / 2, it.z1 + 0.7], 北: [(it.x0 + it.x1) / 2, it.z0 - 0.7], 东: [it.x1 + 0.7, (it.z0 + it.z1) / 2], 西: [it.x0 - 0.7, (it.z0 + it.z1) / 2] };
    for (const k in sides) if (!sides[k].places) sides[k].unreachable = why(...mid[k]);
    const corners = [[it.x0, it.z0], [it.x1, it.z0], [it.x0, it.z1], [it.x1, it.z1]].map(([x, z]) => band(x - R1, x + R1, z - R1, z + R1));
    const posts = site.walk.posts.filter((p) => p.r !== undefined && p.x > it.x0 - 0.1 && p.x < it.x1 + 0.1 && p.z > it.z0 - 0.1 && p.z < it.z1 + 0.1).length;
    const hall = site.halls.find((h) => (NAME[h.name] || h.name) === it.name);
    return { name: it.name, box: [it.x0, it.x1, it.z0, it.z1].map((v) => +v.toFixed(2)), on_it: band(it.x0, it.x1, it.z0, it.z1), sides, corners_reached: corners.filter((c) => c.places).length, corners_deepest_cm: Math.max(...corners.map((c) => c.deepest_cm)),
      round_columns: posts, door: hall ? "可入殿" : "",
      parts: PARTS.map((name, k) => { const n = items.indexOf(it), q = n * NP + k, one = (pass) => best[pass][q] === -Infinity ? null : { cm: +(best[pass][q] * 100).toFixed(1), within10: close[pass][q], at: [0, 1, 2].map((m) => +bestAt[pass][q * 3 + m].toFixed(2)) };
        return { name, points: exists[q], above: one(0), below: one(1) }; }), deepest_cm: Math.max(...Object.values(sides).map((q) => q.deepest_cm), band(it.x0, it.x1, it.z0, it.z1).deepest_cm, ...corners.map((c) => c.deepest_cm)) };
  });
  return { tolerance: tol, grid: G, knee: KNEE, outline: [...prof].map((r, i) => [+(i * BIN).toFixed(2), +r.toFixed(3)]).filter(([, r]) => r > 0), reach: RMAX, cells, samples, worst: +worst.toFixed(3), worstLow: +worstLow.toFixed(3), worstLowStrict: +worstStrict.toFixed(3), outlineLow: [...prof.low].map((r, i) => [+(i * BIN).toFixed(2), +r.toFixed(3)]).filter(([h, r]) => r > 0 && h < KNEE), low: low.map((q) => ({ ...q, place: where(q.at[0], q.at[2]) })), places: [...rows.values()], spots, coverage, site, walker };
}

// The same things, part by part: how near he comes to each part of each, above the knee and below it.
const COLS = ["台基外缘", "踏步鼻口", "踏步侧沿", "门槛", "柱础", "外檐柱", "栏杆端头", "墙地接缝"];
export function partTables(r) {
  const cell = (c, name, pass) => {
    const q = c.parts.find((p) => p.name === name), v = q[pass];
    if (!q.points) return "此处没有";
    if (pass === "below" && name === "踏步鼻口") return "台阶测试管（踏级上的脚）";
    if (pass === "above" && (name === "门槛" || name === "墙地接缝" || name === "柱础")) return "见膝下表";   // they stand within a knee's height of the floor he is on
    if (!v) return `近不了：离可站处都在 ${MARGIN * 100} cm 外`;
    return v.cm > 0 ? `**进 ${v.cm} cm**（站在 ${v.at[0]}, ${v.at[2]}）` : `离 ${(-v.cm).toFixed(1)} cm${v.within10 ? `，${v.within10} 处在 10 cm 内` : ""}`;
  };
  const head = `| 名称 | ${COLS.join(" | ")} |`, rule = `|---|${COLS.map(() => "---").join("|")}|`;
  return [`## 逐个构件`, ``,
    `下面两张表按构件分列：他身体的任何一部分离这个构件最近的距离（「离 n cm」），或进入它的深度（「进 n cm」，超过 1 厘米即不合格）。`,
    `「n 处在 10 cm 内」是离它不到 10 厘米的站位数，说明那里确实走得到跟前。构件按材料和总平面归类：柱础是外檐柱脚下的石鼓，外檐柱是柱身，`,
    `踏步鼻口是踏级（台阶可走的那一段，含首末级的前沿），踏步侧沿是垂带石和踏级两端，门槛是贴地 30 厘米内的木构（门槛、地栿、格扇下槛），`,
    `墙地接缝是贴地 30 厘米内的墙身，栏杆端头是一段栏杆两头（转角与台阶断开处）的望柱。「此处没有」：这座建筑没有这个构件。`,
    `「近不了」：有这个构件，但他能站的地方都离它 ${MARGIN * 100} 厘米以上：它在台基里、墙后或屋内（原因见上表各侧），或者就是他脚下台面的侧面。`, ``,
    `### 膝上（身体、袖、行走时的手、背上的笠；转身按整圈算）`, ``, head, rule,
    ...r.coverage.map((c) => `| ${c.name} | ${COLS.map((n) => cell(c, n, "above")).join(" | ")} |`), ``,
    `### 膝下（鞋、袍脚，离脚底 2 厘米到 ${KNEE * 100} 厘米）`, ``,
    `膝下的外廓：站立、合掌、腾空按整圈算；走动时迈出的脚只朝前，所以步幅只按左右算（向前 31 厘米，左右 18 厘米）——正对着走向一物时，`,
    `他在离它一个身位处被挡住、停步收脚。按整圈连步幅也算，最深 ${(r.worstLowStrict * 100).toFixed(1)} cm（记在 sweep.json 的 \`worstLowStrict\`）。`,
    `比脚底高出不到它自身高度的东西，进入深度不超过它的高度。站在台阶上的位置、以及他脚下那层地面（能站上去的台面的侧面，鞋会被放到台面上）不计，`,
    `那是台阶测试和腿的解算管的。全场最深：**${(r.worstLow * 100).toFixed(1)} cm**。`, ``, head, rule,
    ...r.coverage.map((c) => `| ${c.name} | ${COLS.map((n) => cell(c, n, "below")).join(" | ")} |`), ``];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now(), r = sweep(), { site, walker, ...report } = r;
  console.log(`he reaches ${r.reach.toFixed(3)} m from his centre above the knee; ${r.cells} places to stand, ${r.samples} points of what is built, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const p of r.places.sort((a, b) => b.worst - a.worst)) {
    console.log(`${p.worst > r.tolerance ? "✗" : "✓"} ${p.place.padEnd(8, "　")} ${String(p.cells).padStart(7)} places  ${String(p.over).padStart(6)} over  deepest ${(p.worst * 100).toFixed(1)} cm${p.at && p.worst > r.tolerance ? ` standing at (${p.at[0]}, ${p.at[2]})` : ""}`);
    for (const [k, t] of Object.entries(p.things).sort((a, b) => b[1].worst - a[1].worst).slice(0, TOP)) console.log(`      ${k.padEnd(12)} ${String(t.cells).padStart(6)} places  ${(t.worst * 100).toFixed(1)} cm  standing at (${t.at[0]}, ${t.at[2]}) into (${t.into.join(", ")})`);
  }
  if (process.argv.includes("--spots")) for (const q of r.spots) console.log(`  ${(q.worst * 100).toFixed(1).padStart(5)} cm ${q.place}　${q.thing.padEnd(9)} ${String(q.cells).padStart(5)} places  x ${q.box[0]}…${q.box[1]}  z ${q.box[2]}…${q.box[3]}  into (${q.into.join(", ")}) foot ${q.at[1]}`);
  const table = arg("table", "");
  if (table) {   // the coverage as a page a reviewer can read: every thing, each side, each corner
    const side = (q) => q.places ? `可达 ${q.places} 处，最深 ${q.deepest_cm} cm` : `不可达：${q.unreachable}`;
    const md = [`# T00 建筑边缘覆盖表`, ``, `由 \`node tools/edges.mjs --table docs/t00/edge-coverage.md\` 生成，勿手改。几何出自提交时的实际总平面与沙弥模型。`, ``,
      `方法：把沙弥中心能到的每一处（${G * 100} 厘米一格，共 ${r.cells} 处）都站一遍，用模型在站立、行走、快走、合掌、腾空各姿态下绕身一周的实际外廓（膝上最宽 ${(r.reach * 100).toFixed(1)} 厘米），`,
      `去比对场景里每一个面（取样 ${r.samples} 点）。「最深」是身体任何一部分进入该物的最大深度；容差 ${(r.tolerance * 100).toFixed(0)} 厘米。上表只看膝盖以上（${KNEE} 米起）；膝下另算，见「逐个构件」。`,
      `「可达 n 处」指该侧外 1.2 米内他能站的位置数。全场最深：**${(r.worst * 100).toFixed(1)} cm**。`, ``,
      `这是几何扫查，不是真人走查，也不看镜头；殿内房间不在其内。它回答的是「身体会不会进到东西里」，不回答「看起来是否自然」。`, ``,
      `| 名称 | 台基上/其上 | 南侧 | 东侧 | 北侧 | 西侧 | 四角 | 外檐圆柱 | 入口 | 最深 |`, `|---|---|---|---|---|---|---|---|---|---|`,
      ...r.coverage.map((c) => `| ${c.name} | ${c.on_it.places ? `可站 ${c.on_it.places} 处，最深 ${c.on_it.deepest_cm} cm` : "不可站（实体或屋内）"} | ${side(c.sides.南)} | ${side(c.sides.东)} | ${side(c.sides.北)} | ${side(c.sides.西)} | ${c.corners_reached}/4 可达，最深 ${c.corners_deepest_cm} cm | ${c.round_columns || "—"} | ${c.door || "—"} | ${c.deepest_cm} cm |`), ``,
      ...partTables(r)];
    fs.writeFileSync(table, md.join("\n")); console.log("wrote", table);
  }
  fs.mkdirSync(OUT.replace(/\/[^/]*$/, ""), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  console.log(`below the knee (his shoes and hem, ${r.outlineLow.map(([, v]) => v).reduce((a, b) => Math.max(a, b), 0).toFixed(3)} m out at most): deepest ${(r.worstLow * 100).toFixed(1)} cm; turned through a whole circle even while striding, ${(r.worstLowStrict * 100).toFixed(1)} cm`);
  for (const q of r.low.slice(0, TOP)) console.log(`  ✗ ${q.cm} cm ${q.place}　${q.part}　standing at (${q.at[0]}, ${q.at[2]}) into (${q.into.join(", ")})`);
  if (r.worst > r.tolerance || r.worstLow > r.tolerance) { console.log(`\nthe deepest is ${(Math.max(r.worst, r.worstLow) * 100).toFixed(1)} cm; the tolerance is ${(r.tolerance * 100).toFixed(1)} cm`); process.exit(1); }
}
