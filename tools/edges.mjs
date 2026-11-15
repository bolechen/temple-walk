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
// What it prints: for each building and each kind of thing (by material), the deepest any part of him can get into
// it and where he stands when it happens. It exits with an error if anything is deeper than the tolerance.
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import fs from "node:fs";
const { buildSite, createWalker, SITE, APPROACH, LEVELS } = await import("../app/src/site.js");
const { CHEEK, stairProfile } = await import("../app/src/geo.js");
const { createMonk } = await import("../app/src/monk.js");
const { createTrees } = await import("../app/src/trees.js");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const TOL = +arg("tol", 0.01), TOP = +arg("top", 12), OUT = arg("json", "tools/out/edge-audit/sweep.json");
const G = 0.05, KNEE = 0.32, BIN = 0.05;   // below the knee is the business of the stair tests: a tread ahead is always near a foot

// ---- How far he reaches from his centre, at each height, over every pose ----
export function outline() {
  const bins = new Float32Array(40), v = new THREE.Vector3();
  for (const [speed, pray] of [[0, false], [2.1, false], [4.2, false], [0, true], [0, "hop"], [2.1, "hop"]]) {   // standing, walking, hurrying, hands together, in the air
    const monk = createMonk();
    for (let k = 0; k < 150; k++) {
      monk.update(1 / 30, speed, pray, k / 30, () => 0, { heightAt: () => 0, stairs: false }); monk.group.updateMatrixWorld(true); monk.skeleton?.update?.();   // he is a skinned figure: his surface is where his bones put it, not where it was modelled
      monk.group.traverse((o) => {
        if (!o.isMesh || !o.visible || o.userData.shadow || o.material?.transparent) return;
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { (o.isSkinnedMesh ? o.getVertexPosition(i, v) : v.fromBufferAttribute(a, i)).applyMatrix4(o.matrixWorld); const b = Math.floor(v.y / BIN); if (b >= 0 && b < 40 && v.y > 0.02) bins[b] = Math.max(bins[b], Math.hypot(v.x, v.z)); }
      });
    }
  }
  return bins;
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
  while (todo.length) {
    const c = todo.pop(), i = c % nx, j = (c / nx) | 0, h = foot[c];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const n = b * nx + a; if (reach[n]) continue;
      const x = cx(a), z = cz(b); if (walker.blocked(x, z)) continue; const nh = walker.heightAt(x, z); if (Math.abs(nh - h) > 0.45) continue;
      reach[n] = 1; foot[n] = nh; todo.push(n);
    }
  }
  lap("flooded");
  // Coarse tiles: the lowest and highest feet anywhere near, so that most of what is built can be passed over at once.
  const T = 0.8, tx = Math.ceil((X1 - X0) / T), tz = Math.ceil((Z1 - Z0) / T), lo = new Float32Array(tx * tz).fill(Infinity), hi = new Float32Array(tx * tz).fill(-Infinity);
  for (let c = 0; c < reach.length; c++) if (reach[c]) {
    const i = Math.floor(((c % nx) * G) / T), j = Math.floor((((c / nx) | 0) * G) / T);
    for (let a = Math.max(0, i - 1); a <= Math.min(tx - 1, i + 1); a++) for (let b = Math.max(0, j - 1); b <= Math.min(tz - 1, j + 1); b++) { const t = b * tx + a; if (foot[c] < lo[t]) lo[t] = foot[c]; if (foot[c] > hi[t]) hi[t] = foot[c]; }
  }
  const near = (xa, xb, za, zb, ya, yb) => {
    const i0 = Math.max(0, Math.floor((xa - X0) / T)), i1 = Math.min(tx - 1, Math.floor((xb - X0) / T)), j0 = Math.max(0, Math.floor((za - Z0) / T)), j1 = Math.min(tz - 1, Math.floor((zb - Z0) / T));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const t = j * tx + i; if (yb > lo[t] + KNEE && ya < hi[t] + top) return true; }
    return false;
  };

  // ---- Go over the surface of what is built ----
  // `by[c]` is set where some place to stand lies within his reach of cell c: most points fail this at once.
  const R = Math.ceil(RMAX / G) + 1, by = new Uint8Array(nx * nz), row = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) { let last = -1e9; for (let i = 0; i < nx; i++) { if (reach[j * nx + i]) last = i; if (i - last <= R) row[j * nx + i] = 1; } last = 1e9; for (let i = nx - 1; i >= 0; i--) { if (reach[j * nx + i]) last = i; if (last - i <= R) row[j * nx + i] = 1; } }
  for (let i = 0; i < nx; i++) { let last = -1e9; for (let j = 0; j < nz; j++) { if (row[j * nx + i]) last = j; if (j - last <= R) by[j * nx + i] = 1; } last = 1e9; for (let j = nz - 1; j >= 0; j--) { if (row[j * nx + i]) last = j; if (last - j <= R) by[j * nx + i] = 1; } }
  const list = []; for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) if (Math.hypot(Math.max(0, Math.abs(di) - 1), Math.max(0, Math.abs(dj) - 1)) * G < RMAX) list.push(di, dj);
  const offs = Int32Array.from(list), nOff = offs.length / 2;
  const deep = new Float32Array(nx * nz), what = new Uint16Array(nx * nz), names = [""], hit = new Float32Array(nx * nz * 3);
  let label = 0, samples = 0;
  const point = (x, y, z) => {
    const i = Math.floor((x - X0) / G), j = Math.floor((z - Z0) / G); if (i < 0 || j < 0 || i >= nx || j >= nz || !by[j * nx + i]) return;
    samples++;
    for (let k = 0; k < nOff; k++) {
      const a = i + offs[k * 2], b = j + offs[k * 2 + 1]; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const c = b * nx + a; if (!reach[c]) continue;
      const h = y - foot[c]; if (h < KNEE || h >= top) continue;
      const ddx = x - (X0 + (a + 0.5) * G), ddz = z - (Z0 + (b + 0.5) * G), d = prof[(h / BIN) | 0] - Math.sqrt(ddx * ddx + ddz * ddz); if (d <= deep[c]) continue;
      deep[c] = d; what[c] = label; hit[c * 3] = x; hit[c * 3 + 1] = y; hit[c * 3 + 2] = z;
    }
  };
  lap("masks");
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  // A triangle is halved across its longest side until no side is longer than the grid, then its middle is asked.
  // (Halving, not quartering: a hundred-metre sliver of coping quartered down to a twentieth of a metre is four million pieces.)
  const tri = (ax, ay, az, bx, by, bz, qx, qy, qz, depth) => {
    const xa = Math.min(ax, bx, qx) - RMAX, xb = Math.max(ax, bx, qx) + RMAX, za = Math.min(az, bz, qz) - RMAX, zb = Math.max(az, bz, qz) + RMAX;
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
  built.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData.soft) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material, name = mat?.name || o.name || "?";
    label = names.indexOf(name); if (label < 0) label = names.push(name) - 1;
    if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); mesh(o, w4.multiplyMatrices(o.matrixWorld, m4)); }
    else mesh(o, o.matrixWorld);
  });

  lap("swept " + samples);
  // ---- Say what was found ----
  const where = (x, z) => { let best = "the grounds"; for (const b of site.buildings) if (b.name && x > b.x0 - 1.5 && x < b.x1 + 1.5 && z > b.z0 - 1.5 && z < b.z1 + 1.5) best = b.name; return best; };
  const rows = new Map(); let cells = 0, worst = 0;
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
      round_columns: posts, door: hall ? "可入殿" : "", deepest_cm: Math.max(...Object.values(sides).map((q) => q.deepest_cm), band(it.x0, it.x1, it.z0, it.z1).deepest_cm, ...corners.map((c) => c.deepest_cm)) };
  });
  return { tolerance: tol, grid: G, knee: KNEE, outline: [...prof].map((r, i) => [+(i * BIN).toFixed(2), +r.toFixed(3)]).filter(([, r]) => r > 0), reach: RMAX, cells, samples, worst: +worst.toFixed(3), places: [...rows.values()], spots, coverage, site, walker };
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
      `去比对场景里每一个面（取样 ${r.samples} 点）。「最深」是身体任何一部分进入该物的最大深度；容差 ${(r.tolerance * 100).toFixed(0)} 厘米。膝盖以下（${KNEE} 米）不计，那是台阶测试管的。`,
      `「可达 n 处」指该侧外 1.2 米内他能站的位置数。全场最深：**${(r.worst * 100).toFixed(1)} cm**。`, ``,
      `这是几何扫查，不是真人走查，也不看镜头；殿内房间不在其内。它回答的是「身体会不会进到东西里」，不回答「看起来是否自然」。`, ``,
      `| 名称 | 台基上/其上 | 南侧 | 东侧 | 北侧 | 西侧 | 四角 | 外檐圆柱 | 入口 | 最深 |`, `|---|---|---|---|---|---|---|---|---|---|`,
      ...r.coverage.map((c) => `| ${c.name} | ${c.on_it.places ? `可站 ${c.on_it.places} 处，最深 ${c.on_it.deepest_cm} cm` : "不可站（实体或屋内）"} | ${side(c.sides.南)} | ${side(c.sides.东)} | ${side(c.sides.北)} | ${side(c.sides.西)} | ${c.corners_reached}/4 可达，最深 ${c.corners_deepest_cm} cm | ${c.round_columns || "—"} | ${c.door || "—"} | ${c.deepest_cm} cm |`), ``];
    fs.writeFileSync(table, md.join("\n")); console.log("wrote", table);
  }
  fs.mkdirSync(OUT.replace(/\/[^/]*$/, ""), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  if (r.worst > r.tolerance) { console.log(`\nthe deepest is ${(r.worst * 100).toFixed(1)} cm; the tolerance is ${(r.tolerance * 100).toFixed(1)} cm`); process.exit(1); }
}
