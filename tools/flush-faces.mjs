// Faces that lie on one plane, face the same way and share area (z-fighting). A depth buffer cannot tell which of two such
// faces is nearer, so where they overlap the picture flickers between them as the eye moves: a beam's end that shimmers
// against a wall, a mat that blinks through the floor it lies on. It is a fault of the geometry, not of a renderer, so it
// can be measured in Node from the meshes as built, without drawing anything.
//
// The idea is Kiln's FLUSH_FACES check (github.com/instruktlabs/kiln, src/qa/flush-faces.ts, MIT); this is our own
// implementation of it, fitted to how this place is built (materials worked out from world position, many separate meshes
// batched later by mergeStatic). What counts:
//
// - Same facing: the faces' normals within one degree, as they are drawn (a BackSide material shows the back of a face).
//   Two faces that face each other (a mat on a floor seen from below) are contact, not a fight, unless one of the two is
//   drawn on both sides.
// - One plane: every corner of each triangle within `gap` (1 mm) of the other's plane. With the page's near plane at
//   0.1 m and a 24-bit depth buffer, faces closer than that cannot be ordered a few tens of metres away.
// - Shared area: the triangles' overlap in that plane, summed over each pair of parts (a part is one mesh drawn with one
//   material), at least `minArea` (a 5 cm square).
// - Drawn: a mesh that is not visible, a material that is see-through, does not write depth, is not drawn or is pushed
//   off its plane on purpose (polygonOffset) is left out; those are overlays, and their order is chosen.
// - Something to see: two faces drawn with the same material and facing one way take the colour of the same place in the
//   world whichever wins (procMat works the pattern out from world position), so their tie shows little; such triangle
//   pairs are not measured.
//
// What is not done here, as in Kiln: no test of whether something else hides the pair. A face behind a wall still counts.
//
// `node tools/flush-faces.mjs [--level=<id>]` prints the pairs found on a level (largest first) as the unit test
// tests/unit/flush-faces.test.mjs finds them; `--known` prints them in the shape of that test's allowance
// (tests/unit/flush-faces.known.json), for a pair that is to be let pass on purpose.
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";

export const FLUSH = {
  gap: 0.001,          // m: corners closer than this to the other face's plane are on it
  sameFacing: Math.cos((1 * Math.PI) / 180),
  minArea: 0.0025,     // m²: shared area under which a pair of parts is not reported
  band: 0.25,          // m: the planes' offsets are bucketed this coarsely, so faces a little off parallel far from the origin still meet
};

/** The level `id` (the prologue when left out) as the page builds it, with its real materials: courts, ground, land, censer, trees, rooms. */
export async function drawnScene(id) {
  const { createMaterials } = await import("../app/src/materials.js");
  const { loadLevel, DEFAULT_LEVEL } = await import("../app/src/level.js");
  const { buildInteriors } = await import("../app/src/interior.js");
  const { createTrees } = await import("../app/src/trees.js");
  const { createProps } = await import("../app/src/props.js");
  const { createGround } = await import("../app/src/ground.js");
  const { createBackdrop } = await import("../app/src/backdrop.js");
  const L = await loadLevel(id || DEFAULT_LEVEL);
  const M = createMaterials(), site = L.build(M), scene = new THREE.Scene();
  for (const [k, m] of Object.entries(M)) if (m && m.isMaterial && !m.name) KEY.set(m, k);
  if (typeof M.plaster === "function") KEY.set(M.plaster(), "plaster");   // the lime wash is handed out by a call
  // Each part is named by what it belongs to: a building by its board (or its place in the plan), a room by its hall.
  site.root.children.forEach((g, i) => { let t = ""; g.traverse((o) => { t ||= o.userData?.plaque?.text || ""; }); void i; const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()); g.userData.flushWhere = t ? `楼「${t}」` : `场地(${c.x.toFixed(0)},${c.z.toFixed(0)})`; });
  scene.add(site.root);
  const part = (where, fn) => { const s = new THREE.Scene(); fn(s); s.userData.flushWhere = where; scene.add(s); };
  part("地面", (s) => createGround(s, site.shade, site.censer, site.paving));
  if (L.backdrop) part("远景", (s) => createBackdrop(s, M, L.backdrop.site, L.backdrop.terraces, L.land));
  part("香炉等", (s) => { try { createProps(s, M, site.censer, L.propsAt); } catch { /* the censer is in; the mist and the shafts of light need a canvas */ } });
  part("树", (s) => createTrees(s, M, site.trees, { a2c: false }));
  const rooms = buildInteriors(M, site.halls);
  for (const [id, r] of Object.entries(rooms.rooms)) r.group.userData.flushWhere = `殿内「${id}」`;
  rooms.group.visible = true; scene.add(rooms.group);
  scene.updateMatrixWorld(true);
  return { level: L, site, scene, rooms };
}

/** Whether a material draws a face that holds its place in the depth buffer and is meant to be seen. */
function solid(m) {
  return m && m.visible !== false && m.colorWrite !== false && m.depthWrite !== false && m.depthTest !== false && !m.transparent && !m.polygonOffset && m.blending !== THREE.AdditiveBlending;
}

/** The materials' own keys in createMaterials (they carry no names). */
const KEY = new WeakMap();
/** A readable name for a part: what it belongs to, the mesh's own name if it has one, and the material's key. */
function nameOf(o, m) {
  let p = o, where = "";
  while (p && !where) { where = p.userData?.flushWhere || ""; p = p.parent; }
  const mat = m.name || KEY.get(m) || `${m.type.replace("Material", "")}${m.map ? "(贴图)" : m.color ? "#" + m.color.getHexString() : ""}`;
  return [where, o.name, mat].filter(Boolean).join("/");
}

/** Every drawn triangle under `root`, flattened: corners, drawn normal, plane offset, which part, how its material shows it. */
export function gatherTriangles(root) {
  const parts = [], corner = [], normal = [], owner = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible) return;
    const g = o.geometry, p = g.attributes.position; if (!p) return;
    const idx = g.index, cnt = idx ? idx.count : p.count, mats = Array.isArray(o.material) ? o.material : null;
    const groups = mats && g.groups.length ? g.groups : [{ start: 0, count: cnt, materialIndex: 0 }];
    for (const gr of groups) {
      const m = mats ? mats[gr.materialIndex] : o.material;
      if (!solid(m)) continue;
      const side = m.side === THREE.DoubleSide ? 2 : m.side === THREE.BackSide ? -1 : 1;
      const part = parts.length;
      parts.push({ ref: nameOf(o, m), mesh: o, material: m, double: side === 2 });
      const end = Math.min(cnt, gr.start + gr.count);
      for (let i = gr.start; i + 2 < end; i += 3) {
        const at = (k) => (idx ? idx.getX(i + k) : i + k);
        a.fromBufferAttribute(p, at(0)).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(p, at(1)).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(p, at(2)).applyMatrix4(o.matrixWorld);
        u.subVectors(b, a); v.subVectors(c, a); u.cross(v);
        const len = u.length(); if (!(len > 1e-10)) continue;
        u.multiplyScalar((side === -1 ? -1 : 1) / len);
        corner.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); normal.push(u.x, u.y, u.z); owner.push(part);
      }
    }
  });
  return { parts, corner: Float64Array.from(corner), normal: Float64Array.from(normal), owner: Int32Array.from(owner), count: owner.length };
}

// Clipping one triangle by another in a plane: Sutherland–Hodgman against the clip triangle's three edges, both given as
// six numbers, the clip one counter-clockwise. Returns the area left and its centre.
const bufA = new Float64Array(24), bufB = new Float64Array(24);
function clipArea(s, c, centre) {
  let pts = bufA, nxt = bufB, len = 6;
  for (let k = 0; k < 6; k++) pts[k] = s[k];
  for (let e = 0; e < 6 && len; e += 2) {
    const ax = c[e], ay = c[e + 1], bx = c[(e + 2) % 6], by = c[(e + 3) % 6];
    let kept = 0;
    for (let i = 0; i < len; i += 2) {
      const j = (i + 2) % len, px = pts[i], py = pts[i + 1], qx = pts[j], qy = pts[j + 1];
      const sp = (bx - ax) * (py - ay) - (by - ay) * (px - ax), sq = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
      if (sp >= 0) { nxt[kept++] = px; nxt[kept++] = py; }
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); nxt[kept++] = px + (qx - px) * t; nxt[kept++] = py + (qy - py) * t; }
    }
    const sw = pts; pts = nxt; nxt = sw; len = kept;
  }
  if (len < 6) return 0;
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < len; i += 2) { const j = (i + 2) % len; A += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]; cx += pts[i]; cy += pts[i + 1]; }
  centre[0] = cx / (len / 2); centre[1] = cy / (len / 2);
  return Math.abs(A) / 2;
}

/**
 * The pairs of parts whose faces fight, from `gatherTriangles`' soup. Each pair: the two parts' names, the area they share
 * (m²), the triangle pairs, the plane's normal and a point on the largest shared patch.
 */
export function flushFaces(soup, opt = {}) {
  const { gap, sameFacing, minArea, band } = { ...FLUSH, ...opt };
  const { corner: C, normal: N, owner: O, parts, count } = soup;
  // Buckets by the normal (to a twentieth in each component) and the plane's offset (to `band`); a triangle is filed once
  // and looked for in the neighbouring buckets of both, so nothing near a bucket's edge is missed.
  const Q = 5, buckets = new Map(), key = (qx, qy, qz, qd) => ((qx + 21) * 43 + qy + 21) * 43 + qz + 21 + 79507 * (qd + 1e6);
  const offset = new Float64Array(count);
  for (let t = 0; t < count; t++) {
    const nx = N[t * 3], ny = N[t * 3 + 1], nz = N[t * 3 + 2];
    offset[t] = nx * C[t * 9] + ny * C[t * 9 + 1] + nz * C[t * 9 + 2];
    const k = key(Math.round(nx * Q), Math.round(ny * Q), Math.round(nz * Q), Math.floor(offset[t] / band));
    let list = buckets.get(k); if (!list) buckets.set(k, (list = [])); list.push(t);
  }
  // Triangles facing exactly the other way are found too (for a face drawn on both sides): a bucket also meets the one
  // whose normal and offset are its own negated.
  const tol = 0.0175, near = (x) => { const lo = Math.round((x - tol) * Q), hi = Math.round((x + tol) * Q); return lo === hi ? [lo] : [lo, hi]; };
  const B = new Float64Array(count * 6), P = parts.map((p) => p.material);
  for (let t = 0; t < count; t++) for (let k = 0; k < 3; k++) {
    const a = C[t * 9 + k], b = C[t * 9 + 3 + k], c = C[t * 9 + 6 + k];
    B[t * 6 + k] = Math.min(a, b, c); B[t * 6 + 3 + k] = Math.max(a, b, c);
  }
  const found = new Map(), flatI = new Float64Array(6), flatJ = new Float64Array(6), ctr = [0, 0], seen = new Map();
  let tests = 0;
  const fights = [], contact = new Float64Array(count);
  for (const [k, list] of buckets) {
    const qd = Math.floor(k / 79507) - 1e6;
    const t0 = list[0], nx = N[t0 * 3], ny = N[t0 * 3 + 1], nz = N[t0 * 3 + 2];
    const others = new Set();
    for (const sgn of [1, -1]) for (const ax of near(sgn * nx)) for (const ay of near(sgn * ny)) for (const az of near(sgn * nz)) for (const dd of [-1, 0, 1]) {
      const k2 = key(ax, ay, az, (sgn === 1 ? qd : Math.floor(-offset[t0] / band)) + dd);
      if (buckets.has(k2)) others.add(k2);
    }
    for (const k2 of others) {
      const lo = Math.min(k, k2), hi = Math.max(k, k2); let met = seen.get(lo); if (!met) seen.set(lo, (met = new Set())); if (met.has(hi)) continue; met.add(hi);
      const same = k === k2, L2 = buckets.get(k2);
      // A grid laid in the plane (over the two axes the normal leans on least): each triangle is filed in the cells its
      // box covers, and a pair is measured in the one cell that holds the low corner of where their boxes overlap.
      const A = Math.abs(nx) >= Math.abs(ny) && Math.abs(nx) >= Math.abs(nz) ? 0 : Math.abs(ny) >= Math.abs(nz) ? 1 : 2, U = (A + 1) % 3, V = (A + 2) % 3;
      const members = same ? list : list.concat(L2);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const t of members) { u0 = Math.min(u0, B[t * 6 + U]); u1 = Math.max(u1, B[t * 6 + 3 + U]); v0 = Math.min(v0, B[t * 6 + V]); v1 = Math.max(v1, B[t * 6 + 3 + V]); }
      const cell = Math.min(50, Math.max(0.1, 2 * Math.sqrt(((u1 - u0) * (v1 - v0)) / members.length) || 1));
      const cu = (x) => Math.floor((x - u0 + gap) / cell), cv = (x) => Math.floor((x - v0 + gap) / cell), nu = cu(u1 + gap) + 2;
      const grid = new Map(), mine = same ? null : new Set(list);
      for (const t of members) {
        const a1 = cu(B[t * 6 + 3 + U] + gap), b1 = cv(B[t * 6 + 3 + V] + gap);
        for (let i = cu(B[t * 6 + U] - gap); i <= a1; i++) for (let j = cv(B[t * 6 + V] - gap); j <= b1; j++) { const c = j * nu + i; let l = grid.get(c); if (!l) grid.set(c, (l = [])); l.push(t); }
      }
      for (const [c, all] of grid) {
        // Within one bucket every pair in a cell; between two, only a triangle of each.
        const l = same ? all : all.filter((t) => mine.has(t)), r = same ? all : all.filter((t) => !mine.has(t));
        if (!l.length || !r.length) continue;
        for (let p = 0; p < l.length; p++) for (let q = same ? p + 1 : 0; q < r.length; q++) {
          const ti = l[p], tj = r[q];
          // Two faces of one material facing one way are not measured: they take the colour of the same place in the world
          // whichever wins. (Facing each other they are still measured, for whether a face is buried.)
          if (P[O[ti]] === P[O[tj]] && N[ti * 3] * N[tj * 3] + N[ti * 3 + 1] * N[tj * 3 + 1] + N[ti * 3 + 2] * N[tj * 3 + 2] > 0) continue;
          if (B[ti * 6] > B[tj * 6 + 3] + gap || B[tj * 6] > B[ti * 6 + 3] + gap || B[ti * 6 + 1] > B[tj * 6 + 4] + gap || B[tj * 6 + 1] > B[ti * 6 + 4] + gap || B[ti * 6 + 2] > B[tj * 6 + 5] + gap || B[tj * 6 + 2] > B[ti * 6 + 5] + gap) continue;
          if (cv(Math.max(B[ti * 6 + V], B[tj * 6 + V]) - gap) * nu + cu(Math.max(B[ti * 6 + U], B[tj * 6 + U]) - gap) !== c) continue;
          tests++;
          fight(ti, tj);
        }
      }
    }
  }
  // Triangle pairs that fight, kept until every contact is known; and for each triangle, how much of it lies against a
  // face pointing the other way (a base on the paving, a beam's end against a wall): such a face is buried.
  function fight(i, j) {
    const ni = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]], nj = [N[j * 3], N[j * 3 + 1], N[j * 3 + 2]];
    const dot = ni[0] * nj[0] + ni[1] * nj[1] + ni[2] * nj[2];
    const pi = parts[O[i]], pj = parts[O[j]];
    let facing;
    if (dot >= sameFacing) facing = "same";
    else if (dot <= -sameFacing) facing = pi.double || pj.double ? "opposite" : "contact";
    else return;
    let worst = 0;
    for (const [t, n, d] of [[j, ni, offset[i]], [i, nj, offset[j]]]) for (let k = 0; k < 3; k++) {
      const e = Math.abs(n[0] * C[t * 9 + k * 3] + n[1] * C[t * 9 + k * 3 + 1] + n[2] * C[t * 9 + k * 3 + 2] - d);
      if (e > gap) return; if (e > worst) worst = e;
    }
    // Lay both in the plane by dropping the normal's largest axis; area in the plane is the flat area over that component.
    const ax = Math.abs(ni[0]) >= Math.abs(ni[1]) && Math.abs(ni[0]) >= Math.abs(ni[2]) ? 0 : Math.abs(ni[1]) >= Math.abs(ni[2]) ? 1 : 2;
    const u = (ax + 1) % 3, v = (ax + 2) % 3;
    for (let k = 0; k < 3; k++) { flatI[k * 2] = C[i * 9 + k * 3 + u]; flatI[k * 2 + 1] = C[i * 9 + k * 3 + v]; flatJ[k * 2] = C[j * 9 + k * 3 + u]; flatJ[k * 2 + 1] = C[j * 9 + k * 3 + v]; }
    const turn = (f) => (f[2] - f[0]) * (f[5] - f[1]) - (f[3] - f[1]) * (f[4] - f[0]);
    if (turn(flatJ) < 0) { let s = flatJ[2]; flatJ[2] = flatJ[4]; flatJ[4] = s; s = flatJ[3]; flatJ[3] = flatJ[5]; flatJ[5] = s; }
    const flat = clipArea(flatI, flatJ, ctr); if (!(flat > 1e-9)) return;
    const area = flat / Math.abs(ni[ax]);
    if (facing === "contact") { contact[i] += area; contact[j] += area; return; }
    const at = [0, 0, 0]; at[u] = ctr[0]; at[v] = ctr[1]; at[ax] = (offset[i] - ni[u] * at[u] - ni[v] * at[v]) / ni[ax];
    fights.push({ i, j, area, at, normal: ni, facing, worst });
  }
  // Each triangle's own area, for how much of it is buried.
  const own = (t) => { const ux = C[t * 9 + 3] - C[t * 9], uy = C[t * 9 + 4] - C[t * 9 + 1], uz = C[t * 9 + 5] - C[t * 9 + 2], vx = C[t * 9 + 6] - C[t * 9], vy = C[t * 9 + 7] - C[t * 9 + 1], vz = C[t * 9 + 8] - C[t * 9 + 2]; return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; };
  const buried = (t) => contact[t] >= 0.5 * own(t);
  let hidden = 0;
  for (const f of fights) {
    if (buried(f.i) && buried(f.j)) { hidden += f.area; continue; }
    const [a, b] = O[f.i] <= O[f.j] ? [O[f.i], O[f.j]] : [O[f.j], O[f.i]], pk = a * 1e6 + b;
    let rec = found.get(pk);
    if (!rec) found.set(pk, (rec = { a, b, area: 0, tris: 0, largest: 0, at: f.at, normal: f.normal, facing: f.facing, gap: 0 }));
    if (opt.detail) (rec.fights ||= []).push(f);
    rec.area += f.area; rec.tris++; if (f.worst > rec.gap) rec.gap = f.worst;
    if (f.area > rec.largest + 1e-9 || (Math.abs(f.area - rec.largest) <= 1e-9 && f.at.join() < rec.at.join())) { rec.largest = f.area; rec.at = f.at; rec.normal = f.normal; rec.facing = f.facing; }
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  const pairs = [...found.values()].filter((r) => r.area >= minArea).map((r) => ({
    parts: [parts[r.a].ref, parts[r.b].ref].sort(), facing: r.facing,
    area: Math.round(r.area * 1e4) / 1e4, trianglePairs: r.tris, gap: Math.round(r.gap * 1e5) / 1e5,
    normal: r.normal.map((x) => Math.round(x * 1000) / 1000), at: r.at.map(r2),
    ...(opt.detail ? { boxes: r.fights.map((f) => [f.i, f.j].map((t) => [0, 1, 2].map((k) => [B[t * 6 + k], B[t * 6 + 3 + k]].map(r2)))) } : {}),
  })).sort((p, q) => q.area - p.area || (label(p) < label(q) ? -1 : 1));
  return { triangles: count, tests, pairs, hidden: Math.round(hidden * 100) / 100 };
}

/** A pair's line in a report and in the test's allowance: the two parts, sorted, and where, to the decimetre. */
export function label(p) {
  return `${p.parts.join(" × ")} @ ${p.at.map((x) => x.toFixed(1)).join(",")}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lv = process.argv.find((a) => a.startsWith("--level="))?.slice(8);
  if (process.argv.includes("--known")) {
    const { scene } = await drawnScene(lv), r = flushFaces(gatherTriangles(scene));
    console.log(JSON.stringify(Object.fromEntries(r.pairs.map((p) => [label(p), p.area])), null, 2));
    process.exit(0);
  }
  const t0 = Date.now(), { scene } = await drawnScene(lv), soup = gatherTriangles(scene), t1 = Date.now(), r = flushFaces(soup), t2 = Date.now();
  console.log(`${soup.count} triangles in ${soup.parts.length} parts gathered in ${t1 - t0} ms, ${r.tests} triangle pairs measured in ${t2 - t1} ms`);
  console.log(`${r.pairs.length} pairs of parts fight; left out: ${r.hidden} m² buried against a face pointing the other way`);
  const only = process.argv.find((a) => a.startsWith("--detail="))?.slice(9), full = only && flushFaces(soup, { detail: true });
  for (const p of r.pairs) {
    console.log(`${p.area.toFixed(4).padStart(9)} m²  ${p.facing === "opposite" ? "[双面相背] " : ""}${label(p)}  n=${p.normal.join(",")}  gap=${p.gap * 1000}mm  ${p.trianglePairs} 对三角形`);
    if (only && label(p).includes(only)) for (const b of full.pairs.find((q) => label(q) === label(p)).boxes) console.log(`      ${b.map((t) => t.map((r) => r.join("..")).join(" ")).join("   |   ")}`);
  }
}
