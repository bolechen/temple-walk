// The timber inside a hall: the columns, what they carry, and what is seen overhead.
//
// The room's bays are the building's own. The column lines a visitor counted outside (`hall.xs`, `hall.zs` from the
// plan) are scaled into the room, which is drawn a little larger than the building so that its altar and frames fit;
// the outermost lines stand in the walls. On the inner lines stand the free columns, except where one would stand on
// the dais, in the way to the altar or before a frame: those are left out, as the builders of the Song and Jin left
// out columns to open the floor before a figure (jianzhu). Front to back along every inner line runs a crescent beam
// (yueliang), resting on each column's cap block (ludou) and at the walls on a short bracket (dingtou gong) set into the wall.
// Across the rows the column heads are tied by architraves (lan'e).
//
// Overhead, each kind of hall has what its rank calls for:
// - the great hall, the figure halls and the summit pavilion a coffered ceiling (pingqi) of painted panels on a grid
//   of ribs, opened over the figure into a stepped caisson (zaojing): a square well, its corners cut to an octagon, a
//   ring of small brackets, eight ribs rising to a gilt mirror;
// - the library, which has a storey above it, a plain small-squared ceiling (ping'an);
// - the meditation hall, the tea house and the patriarchs' hall no ceiling at all (cheshang mingzao): the roof is open to
//   the rafters, its purlins carried on the beam by a camel's-hump block, posts, a short upper beam and two raking
//   struts under the ridge (chashou), and the gable walls rise to meet it.
import * as THREE from "three";
import { box, merge, footAt } from "./geo.js";

export const CEILING = { buddha: "coffer", figure: "coffer", pavilion: "coffer", library: "plain", chan: "open", tea: "open", patriarch: "open" };
// The width of a panel of the coffered ceiling; the caisson is four panels across.
const CELL = { buddha: 0.9, figure: 0.7, pavilion: 0.7 };

// The building's column lines, scaled into a room `K` wide and deep. Across: west to east; front to back: south first.
export function bays(hall, K) {
  const wx = K.w / 2 + 0.3, wz = K.d / 2 + 0.3;
  const sx = wx / Math.max(...hall.xs.map(Math.abs)), sz = wz / Math.max(...hall.zs.map(Math.abs));
  const xs = [...hall.xs].sort((a, b) => a - b).map((x) => +(x * sx).toFixed(3)), zs = [...hall.zs].sort((a, b) => b - a).map((z) => +(z * sz).toFixed(3));
  return { wx, wz, xs, zs, inX: xs.slice(1, -1), inZ: zs.slice(1, -1) };
}

// A box from one point to another, `w` wide and `h` deep, its depth kept upright.
function strut(a, b, w, h) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length(), g = new THREE.BoxGeometry(w, h, len);
  const z = d.clone().normalize(), x = new THREE.Vector3(0, 1, 0).cross(z); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z)); return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
// A crescent beam along z from `z0` to `z1`: its belly rises toward the middle of the span, as a Song beam's does.
function moonBeam(x, z0, z1, top, h, w) {
  const len = Math.abs(z1 - z0), g = new THREE.BoxGeometry(w, h, len, 1, 2, 16), p = g.attributes.position, camber = Math.min(0.2 * h, 0.14);
  for (let i = 0; i < p.count; i++) {
    const t = p.getZ(i) / len + 0.5, y = p.getY(i), lift = camber * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.6);   // never below nought at the ends, where a power would give no number
    if (y < -h / 4) p.setY(i, y + lift); else if (y < h / 4) p.setY(i, y + lift * 0.5);
  }
  g.computeVertexNormals(); return g.translate(x, top - h / 2, (z0 + z1) / 2);
}
// Every triangle turned to face the other way: the inside of a well is what is seen from below.
function inward(g) {
  g = g.toNonIndexed(); const p = g.attributes.position.array, uv = g.attributes.uv.array;
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + k]; p[i + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  for (let i = 0; i < uv.length; i += 6) for (let k = 0; k < 2; k++) { const t = uv[i + k]; uv[i + k] = uv[i + 4 + k]; uv[i + 4 + k] = t; }
  g.computeVertexNormals(); return g;
}
// An eight-sided band whose flats face the axes, from apothem `a0` at `y0` to `a1` at `y1`, seen from inside.
const octa = (a0, a1, y0, y1) => inward(new THREE.CylinderGeometry(a1 / Math.cos(Math.PI / 8), a0 / Math.cos(Math.PI / 8), y1 - y0, 8, 1, true).rotateY(Math.PI / 8).translate(0, (y0 + y1) / 2, 0));
// A flat face looking down over the rectangle, cut every metre or so (for its occlusion), its uv in panels from (gx, gz).
function ceilingQuad(x0, x1, z0, z1, y, cell, gx, gz, plainPanel = false) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.max(1, Math.round(x1 - x0)), Math.max(1, Math.round(z1 - z0))).rotateX(Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - gx) / cell, plainPanel ? 2000 : (p.getZ(i) - gz) / cell);
  return g;
}
// A face spanning four corners, cut `n` times across (a roof board seen from below), turned to face down.
function quad(a, b, c, d, n) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = a.clone().lerp(b, t), q = d.clone().lerp(c, t);
    pos.push(p.x, p.y, p.z, q.x, q.y, q.z); uv.push(t * 6, 0, t * 6, 1);
    if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (g.attributes.normal.getY(0) > 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}

// Build the frame and ceiling of one room. `add(geo, mat, ao)` puts a mesh in the room (in its own x, the floor at
// `Y`); `clear(x, z, r)` says whether a column of reach `r` standing there would be in the way of something.
// Returns where the columns stand (for the walker and the tests), the members as data, and how high the ceiling or
// roof is over a point, for whatever hangs from it.
export function frameRoom(M, add, { K, hall, Y, focus, clear }) {
  const kind = CEILING[hall.kind] || "open", B = bays(hall, K), { wx, wz, inX, inZ } = B, H = Y + K.h;
  const cols = [], beams = [], ties = [], members = { cols, beams, ties, kind, wx, wz };
  // Which columns stand: every crossing of an inner line across and an inner line front to back that is clear.
  // In the great hall only the rows before and behind the floor keep their columns: the middle row is left out so that
  // the floor before the Buddha is one open room (the Song and Jin builders' jianzhu).
  const rows = hall.kind === "buddha" && inZ.length > 2 ? [inZ[0], inZ[inZ.length - 1]] : inZ;
  for (const z of rows) for (const x of inX) if (!clear(x, z, 0.5)) cols.push({ x, z });
  // The crescent beams, one along every inner line across, each span from one support to the next.
  const spans = inX.map((x) => { const sup = [wz, ...cols.filter((c) => c.x === x).map((c) => c.z).sort((a, b) => b - a), -wz]; return sup.slice(1).map((z, i) => [sup[i], z]); });
  const longest = Math.max(...spans.flat().map(([a, b]) => a - b), 4);
  const bd = THREE.MathUtils.clamp(0.055 * longest + 0.12, 0.42, 0.95), bw = Math.min(0.62 * bd, 0.5);
  const top = kind === "open" ? H - 0.06 : H - 0.12, colTop = top - bd - 0.3;
  const wood = [], caps = [], shafts = [], bases = [];
  inX.forEach((x, i) => spans[i].forEach(([za, zb]) => {
    const atWall = (z) => Math.abs(Math.abs(z) - wz) < 1e-6, a = atWall(za) ? za + 0.15 : za, b = atWall(zb) ? zb - 0.15 : zb;
    wood.push(moonBeam(x, a, b, top, bd, bw)); beams.push({ x, z0: za, z1: zb, top, bottom: top - bd, ends: [atWall(za) ? "wall" : "column", atWall(zb) ? "wall" : "column"] });
    for (const z of [za, zb]) if (atWall(z)) { const s = Math.sign(z), u = top - bd; wood.push(box(bw * 0.8, 0.26, 0.6, x, u - 0.13, s * (wz - 0.3)), box(bw + 0.1, 0.14, 0.34, x, u - 0.33, s * (wz - 0.5)), box(bw * 0.8, 0.22, 0.34, x, u - 0.51, s * (wz - 0.36))); }   // the bracket in the wall under the beam's end
  }));
  // The columns: a slight swell and a rounded head (juansha), a stone base, and on the head its cap block.
  for (const { x, z } of cols) {
    const h = colTop - Y;
    shafts.push(new THREE.LatheGeometry([[0, 0], [0.29, 0], [0.285, h * 0.35], [0.27, h * 0.75], [0.25, h - 0.18], [0.215, h - 0.02], [0, h]].map(([r, y]) => new THREE.Vector2(r, y)), 20).translate(x, Y, z));
    bases.push(new THREE.LatheGeometry([[0, 0], [0.5, 0], [0.5, 0.05], [0.4, 0.14], [0.34, 0.22], [0, 0.22]].map(([r, y]) => new THREE.Vector2(r, y)), 20).translate(x, Y, z));
    caps.push(box(0.46, 0.13, 0.46, x, colTop + 0.065, z), box(0.62, 0.17, 0.62, x, colTop + 0.215, z));
  }
  // The architraves across each row of columns, from column to column and from the end ones into the side walls;
  // where the columns before the altar were left out, the beams carry the ceiling alone and the row has a gap.
  for (const z of inZ) {
    const sup = [-wx, ...cols.filter((c) => c.z === z).map((c) => c.x).sort((a, b) => a - b), wx];
    if (sup.length < 3) continue;
    for (let i = 1; i < sup.length; i++) { const [a, b] = [sup[i - 1], sup[i]]; if (b - a > 8) continue; wood.push(box(b - a, 0.42, 0.2, (a + b) / 2, colTop - 0.21, z)); ties.push({ z, x0: a, x1: b, top: colTop }); }
  }
  const lowAO = (base) => (x, y, z) => base * (0.75 + 0.25 * Math.min(1, (Math.min(wx - Math.abs(x - focus.ox), wz - Math.abs(z)) + 0.3) / 2.5));
  const some = (list, mat, ao) => list.length && add(merge(list), mat, ao);   // a hall of one bay's depth has no free columns
  some(shafts, M.pillar); some(bases, M.monolith); some(caps, M.beamX, lowAO(0.55)); some(wood, M.beamX, lowAO(0.5));

  /** @type {(x?: number, z?: number) => number} */
  let roofAt = () => H;
  if (kind === "open") { const o = openRoof(M, add, B, H, top, lowAO); roofAt = o.roofAt; members.gable = o.gable; members.boards = o.boards; }
  else flatCeiling(M, add, B, H, kind, CELL[hall.kind] || 0.4, kind === "coffer" ? focus : null, inX, bw, lowAO);
  members.colTop = colTop; members.ceiling = H; members.spans = spans;
  return { cols, members, roofAt };
}

// Ribs on a square grid, with painted (or, for the plain kind, bare) panels between, and over the figure a caisson.
function flatCeiling(M, add, { wx, wz }, H, kind, cell, focus, inX, bw, lowAO) {
  const rib = [], frame = [], gilt = [], panels = [], ribD = 0.09, ribW = kind === "plain" ? 0.05 : 0.07;
  // The caisson: four panels across, its middle over the figure, between the two beams either side of it.
  let hole = null;
  if (focus) {
    const near = Math.min(...inX.map(Math.abs)); cell = Math.min(cell, (near - bw / 2 - 0.06) / 2); const S = 4 * cell;   // narrower panels where the beams stand close
    hole = { x0: -S / 2, x1: S / 2, z0: focus.z - S / 2, z1: focus.z + S / 2 };
  }
  const gx = 0, gz = hole ? hole.z0 : 0;
  // The panels, as four pieces round the opening when there is one.
  const pieces = hole ? [[-wx, wx, hole.z1, wz], [-wx, wx, -wz, hole.z0], [-wx, hole.x0, hole.z0, hole.z1], [hole.x1, wx, hole.z0, hole.z1]] : [[-wx, wx, -wz, wz]];
  for (const [x0, x1, z0, z1] of pieces) if (x1 - x0 > 0.01 && z1 - z0 > 0.01) panels.push(ceilingQuad(x0, x1, z0, z1, H, cell, gx, gz, kind === "plain"));
  // The ribs, on the lines of the grid, broken round the opening.
  for (let x = gx + Math.ceil((-wx - gx) / cell) * cell; x < wx - 0.05; x += cell) {
    if (x < -wx + 0.05) continue;   // (a rib on the wall's own line is inside the frame, and only shared the wall's top, #688)
    if (hole && x > hole.x0 - 1e-6 && x < hole.x1 + 1e-6) { rib.push(box(ribW, ribD, hole.z0 + wz, x, H - ribD / 2, (hole.z0 - wz) / 2), box(ribW, ribD, wz - hole.z1, x, H - ribD / 2, (hole.z1 + wz) / 2)); }
    else rib.push(box(ribW, ribD, 2 * wz - 0.006, x, H - ribD / 2, 0));   // (stopping a hair short of the walls, whose plane their ends shared, #688)
  }
  for (let z = gz + Math.ceil((-wz - gz) / cell) * cell; z < wz - 0.05; z += cell) {
    if (z < -wz + 0.05) continue;
    if (hole && z > hole.z0 - 1e-6 && z < hole.z1 + 1e-6) { rib.push(box(hole.x0 + wx, ribD, ribW, (hole.x0 - wx) / 2, H - ribD / 2, z), box(wx - hole.x1, ribD, ribW, (hole.x1 + wx) / 2, H - ribD / 2, z)); }
    else rib.push(box(2 * wx - 0.006, ribD, ribW, 0, H - ribD / 2, z));
  }
  // The frame round the edge of the ceiling, where it meets the walls (suantingfang).
  frame.push(box(2 * wx, 0.14, 0.22, 0, H - 0.07, wz - 0.11), box(2 * wx, 0.14, 0.22, 0, H - 0.07, -wz + 0.11), box(0.22, 0.14, 2 * wz, wx - 0.11, H - 0.07, 0), box(0.22, 0.14, 2 * wz, -wx + 0.11, H - 0.07, 0));
  if (hole) caisson(M, add, hole, H, frame, gilt, rib);
  // Far from the lamps and close to the walls the panels darken; over the open floor they keep the light.
  const ao = lowAO(kind === "plain" ? 0.62 : 0.7);
  add(merge(panels), kind === "plain" ? M.pingan : M.coffer, ao); add(merge(rib), M.beamX, lowAO(0.5)); add(merge(frame), M.beamX, lowAO(0.48));
  if (gilt.length) add(merge(gilt), M.gilt, () => 0.8);
}

// The caisson over the figure: a square well, its corners cut across to an octagon, a ring of small brackets, a
// steeper eight-sided dome on eight ribs, and at its crown a round gilt mirror.
function caisson(M, add, hole, H, frame, gilt, rib) {
  const S = hole.x1 - hole.x0, a = S / 2, cx = (hole.x0 + hole.x1) / 2, cz = (hole.z0 + hole.z1) / 2, s = S / 3.6;
  const y1 = H + 0.5 * s, y2 = y1 + 0.55 * s, y3 = y2 + 0.85 * s, top = a * 0.34, painted = [];
  const at = (g) => g.translate(cx, 0, cz);
  // The square well: four boards standing on the rim of the opening, with a moulding at their foot.
  // (The boards stand inside the opening, on its edge and not across it: across it their feet lay in the plane of the ceiling's own
  // panels and fought them, #655. They are 3 and 6 cm nearer the middle than they were.)
  for (const [w, d, x, z] of [[S, 0.06, 0, a], [S, 0.06, 0, -a], [0.06, S, a, 0], [0.06, S, -a, 0]]) {
    const sx = Math.sign(x), sz = Math.sign(z);
    frame.push(at(box(w === S ? S : 0.12, y1 - H, w === S ? 0.06 : S, x - sx * 0.06, (H + y1) / 2, z - sz * 0.03)), at(box(w + 0.18, 0.1, d + 0.12, x - sx * 0.06, H - 0.03, z - sz * 0.03)));
  }
  // The corners cut across: four triangles looking down, leaving an octagon whose flats lie on the square's sides.
  const k = a * Math.tan(Math.PI / 8), tri = [];
  // Wound so that each looks down: the three points go clockwise seen from below whichever corner it is.
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) { const p = [[sx * a, sz * a], [sx * k, sz * a], [sx * a, sz * k]]; if (sx * sz < 0) p.reverse(); for (const [x, z] of p) tri.push(x, y1, z); }
  const corners = new THREE.BufferGeometry(); corners.setAttribute("position", new THREE.Float32BufferAttribute(tri, 3)); corners.setAttribute("uv", new THREE.Float32BufferAttribute(Array.from({ length: tri.length / 3 }, () => [0.0625, 2000]).flat(), 2)); corners.computeVertexNormals();
  if (corners.attributes.normal.getY(0) > 0) { const p = corners.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { const t = p[i + j]; p[i + j] = p[i + 6 + j]; p[i + 6 + j] = t; } corners.computeVertexNormals(); }
  for (let i = 0; i < corners.attributes.normal.count; i++) if (corners.attributes.normal.getY(i) > -0.99) throw new Error("a corner of the caisson looks up");
  painted.push(at(corners));
  // The octagonal band, with a ring of small bracket blocks round its foot, and above it the dome.
  const plain = (g) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 2000); return g; };
  painted.push(at(plain(octa(a, a, y1, y2))), at(plain(octa(a, top, y2, y3))));
  const blocks = [], n = Math.round((2 * k) / 0.2);
  for (let f = 0; f < 8; f++) {
    const ang = (f * Math.PI) / 4, ux = Math.sin(ang), uz = Math.cos(ang), tx = Math.cos(ang), tz = -Math.sin(ang);
    for (let i = 0; i < n; i++) { const t = -k + (i + 0.5) * (2 * k / n), x = ux * (a - 0.06) + tx * t, z = uz * (a - 0.06) + tz * t; blocks.push(at(box(0.09, 0.1, 0.09, x, y2 - 0.07, z)), at(box(0.12, 0.05, 0.12, x, y2 - 0.005, z))); }
    // The ribs of the dome, up its eight edges.
    const c0 = (ang + Math.PI / 8), r0 = a / Math.cos(Math.PI / 8), r1 = top / Math.cos(Math.PI / 8);
    rib.push(at(strut(new THREE.Vector3(Math.sin(c0) * r0 * 0.97, y2, Math.cos(c0) * r0 * 0.97), new THREE.Vector3(Math.sin(c0) * r1 * 0.97, y3, Math.cos(c0) * r1 * 0.97), 0.07, 0.08)));
  }
  frame.push(...blocks, at(octa(a + 0.02, a + 0.02, y2 - 0.02, y2 + 0.04)));
  // The mirror at the crown: a gilt disc with a raised rim.
  gilt.push(at(new THREE.CircleGeometry((top / Math.cos(Math.PI / 8)) * 1.05, 32).rotateX(Math.PI / 2).translate(0, y3 - 0.004, 0)),   // wide enough to close the octagon's corners
     at(new THREE.TorusGeometry(top * 0.92, 0.035, 6, 32).rotateX(Math.PI / 2).translate(0, y3 - 0.04, 0)));
  add(merge(painted), M.coffer, (x, y) => 0.55 - 0.25 * THREE.MathUtils.clamp((y - H) / (y3 - H), 0, 1));
}

// The roof open to the rafters (cheshang mingzao): purlins on the beams by way of a camel's hump, two posts and a short upper
// beam, the ridge purlin on a post braced by two raking struts; rafters over the purlins, boards over the rafters,
// and the gable walls closing each end. The slope steepens toward the ridge, as Song roofs do (juzhe).
function openRoof(M, add, { wx, wz, inX }, H, top, lowAO) {
  const n = 3, R = 0.27 * 2 * wz, rp = 0.13, zk = (k) => wz * (1 - k / n), yk = (k) => H + rp + R * Math.pow(k / n, 1.6);
  const purl = [], wood = [], raft = [], boards = [], gable = [];
  const purlin = (z, y) => purl.push(new THREE.CylinderGeometry(rp, rp, 2 * wx + 0.3, 10).rotateZ(Math.PI / 2).translate(0, y, z));
  for (let k = 0; k < n; k++) for (const s of [1, -1]) purlin(s * zk(k), yk(k));
  purlin(0, yk(n));
  const pingTop = yk(2) - rp, pingH = 0.34, ridgeY = yk(n);
  for (const x of inX) {
    for (const s of [1, -1]) {
      // The first purlin in from the wall sits on a camel's hump on the beam, a bolster under it.
      const h1 = yk(1) - rp - 0.08 - top; if (h1 > 0.05) wood.push(box(0.32, h1, 0.55, x, top + h1 / 2, s * zk(1)));
      wood.push(box(0.9, 0.08, 0.16, x, yk(1) - rp - 0.04, s * zk(1)));
      // A post on the beam at the second purlin, a hump at its foot, carrying the upper beam's end.
      const ph = pingTop - pingH - top; wood.push(box(0.22, ph, 0.22, x, top + ph / 2, s * zk(2)), box(0.3, 0.2, 0.6, x, top + 0.1, s * zk(2)));
      wood.push(box(0.9, 0.08, 0.16, x, pingTop + 0.04 - 0.08, s * zk(2)));
      // The raking struts from the upper beam's ends to the ridge.
      wood.push(strut(new THREE.Vector3(x, pingTop + 0.05, s * zk(2) * 0.85), new THREE.Vector3(x, ridgeY - rp * 0.6, s * 0.12), 0.12, 0.18));
    }
    wood.push(moonBeam(x, zk(2) + 0.32, -zk(2) - 0.32, pingTop, pingH, 0.26));
    const rh = ridgeY - rp - pingTop; wood.push(box(0.2, rh, 0.2, x, pingTop + rh / 2, 0), box(0.9, 0.08, 0.16, x, ridgeY - rp - 0.04, 0));
  }
  // Rafters at a third of a metre, each run from purlin to purlin, and over them the boards.
  const rr = 0.06, lift = (k) => yk(k) + rp + rr;
  for (const s of [1, -1]) for (let k = 0; k < n; k++) {
    const za = s * (k ? zk(k) : wz + 0.2), zb = s * zk(k + 1) - s * 0.04, ya = k ? lift(k) : lift(0) + (lift(0) - lift(1)) / (zk(0) - zk(1)) * 0.2;
    for (let x = -wx + 0.16; x < wx - 0.05; x += 0.33) raft.push(strut(new THREE.Vector3(x, ya, za), new THREE.Vector3(x, lift(k + 1), zb + s * 0.04), 0.09, 0.12));
    const ba = lift(k) + rr + 0.01, bb = lift(k + 1) + rr + 0.01, z0 = s * (k ? zk(k) : wz), z1 = s * zk(k + 1);
    boards.push(quad(new THREE.Vector3(-wx, ba, z0), new THREE.Vector3(wx, ba, z0), new THREE.Vector3(wx, bb, z1), new THREE.Vector3(-wx, bb, z1), Math.max(2, Math.round(2 * wx))));
  }
  // The gables: the side walls rise to the boards, a little above them so that no light shows at the join.
  const pts = [[-wz - 0.3, H]]; for (let k = 0; k <= 2 * n; k++) { const kk = n - Math.abs(n - k), z = (k < n ? -1 : 1) * zk(kk); pts.push([k === 0 ? -wz - 0.3 : k === 2 * n ? wz + 0.3 : z, lift(kk) + rr + 0.16]); } pts.push([wz + 0.3, H]);
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const s of [1, -1]) gable.push(footAt(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(s > 0 ? wx + 0.3 : -wx, 0, 0), H - 30));
  const high = (x, y) => THREE.MathUtils.clamp(1 - (y - H) / (R + 0.5), 0, 1);
  add(merge(purl), M.beamX, (x, y, z) => lowAO(0.5)(x, y, z) * (0.7 + 0.3 * high(x, y)));
  add(merge(wood), M.beamX, lowAO(0.5)); add(merge(raft), M.beamX, (x, y, z) => 0.42 + 0.18 * high(x, y));
  add(merge(boards), M.beamZ, (x, y, z) => lowAO(0.36)(x, y, z) * (0.65 + 0.35 * high(x, y))); add(merge(gable), M.plaster(), (x, y) => 0.5 + 0.3 * high(x, y));
  // How high the boards are over a point: what a lamp's chain hangs from. And, as data, the gables' outline and the
  // boards' line from wall to ridge to wall (front to back, in z), for the tests.
  const boardsLine = []; for (let k = 0; k <= 2 * n; k++) { const kk = n - Math.abs(n - k); boardsLine.push([(k < n ? -1 : 1) * zk(kk), lift(kk) + rr + 0.01]); }
  return { roofAt: (x, z) => { const t = THREE.MathUtils.clamp((wz - Math.abs(z)) / wz, 0, 1); return H + rp + R * Math.pow(t, 1.6) + 2 * rr + rp; }, gable: pts, boards: boardsLine };
}
