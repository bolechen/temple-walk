// The great hall of 奉明寺 as a white box (#422, docs/t05/PLAN.md item 6): its nine bays and twenty-eight eave columns,
// the two end walls and the back wall, three doors and four barred windows across the front, the band of the bracket
// sets, and one hipped roof with four slopes and five ridges. It is massing to walk through, not the Liao hall's own
// vocabulary: building.js draws a Song hall (three doors and six windows on nine bays, white sill walls, the dashes on
// its tie-beams; docs/t05/ARCHITECTURE.md §0 says it cannot be put to this hall as it is), and the hall's proper
// generator comes with the art. Nothing here is built in a room under the court: the hall stands on its platform, and
// he walks in across the threshold on the same floor as the court (docs/t05/PRD.md §2.1).
//
// Heights are from the court's paving: the hall's floor is the platform's top, +3.0. x east, z south, the front column
// line at z = 0 (docs/t05/SITE.md §1). Sizes and how far each is sourced: docs/t05/SOURCES.md §11.
import * as THREE from "three";
import { box, BODY } from "../../src/geo.js";

/** The nine bays across, west to east (ARCHITECTURE.md §2.1, S04, read): 4.98, 4.98, 5.26, the three middle ones 5.80, 5.26, 4.98, 4.98 m. */
export const BAYS = Object.freeze([4.98, 4.98, 5.26, 5.8, 5.8, 5.8, 5.26, 4.98, 4.98]);
/** The hall's numbers: depth to the back column line, column height, floor, eave and ridge (SITE.md §4.2, ARCHITECTURE.md §2.1, §4.1). */
export const HALL = Object.freeze({
  depth: 25.13,          // front to back column line (S04, read)
  rows: 5,               // five bays deep; laid out equal here, which the sources do not give (proposal)
  floor: 3.0,            // the platform's top
  column: 6.06,          // column height (S04, 234 small cun, converted)
  colR: 0.32,            // a white-box column's radius (proposal)
  wall: 0.9,             // the walls' thickness, their outer face 0.3 m outside the column line (ARCHITECTURE.md §4.2: 1.0–1.5 m, a proposal; thinner here so the platform's back edge holds it)
  eave: 11.81,           // the eave's edge above the court: platform 3 + column 6.06 + bracket sets 2.75 (SITE.md §4.2)
  ridge: 21.0,           // the ridge above the court (SITE.md §1, about +21)
  overhang: 3.75,        // the eave beyond the column line (ARCHITECTURE.md §4.1: about 3.5–4 m)
  door: { w: 4.0, h: 4.2, sill: 0.24 },    // SITE.md: a 4 m doorway (proposal); the sill pressed to 0.24 m so he steps over it (PRD.md §2)
  window: { w: 3.0, sill: 1.1, h: 2.4, bars: 11 },   // upright bars over a sill wall 1.0–1.2 m (ARCHITECTURE.md §4.2, not measured)
  roof: 0.6,             // how thick the roof's mass is, from its tiles to the dark of its underside
});
/** Which bays of the front are doors, which windows, which wall (ARCHITECTURE.md §4.2: three doors, four windows, the end bays walls). */
export const FRONT = Object.freeze(["wall", "window", "window", "door", "door", "door", "window", "window", "wall"]);

/** The column lines across (x, west to east) and front to back (z, front first). */
export const XS = Object.freeze(BAYS.reduce((a, w) => [...a, a[a.length - 1] + w], [-BAYS.reduce((s, w) => s + w, 0) / 2]));
export const ZS = Object.freeze(Array.from({ length: HALL.rows + 1 }, (_, i) => -(HALL.depth * i) / HALL.rows));
/** The hall's outer faces: the walls' outside, 0.3 m beyond the column lines. */
export const OUTER = Object.freeze({ x: XS[XS.length - 1] + 0.3, zF: 0.3, zB: -HALL.depth - 0.3 });

/** The hall's meshes (by material) and what the written plan's walker is told of it. */
export function buildHall(M) {
  const H = HALL, y0 = H.floor, top = y0 + H.column, X = XS[XS.length - 1], zB = ZS[ZS.length - 1];
  const wallIn = H.wall - 0.3;   // how far the wall's inner face lies inside the column line
  const plaster = [], wood = [], woodZ = [], dark = [], walk = { solids: [], decks: [], posts: [] };
  // Columns: every crossing of the outer lines, ten across the front and the back and four more up each end.
  const columns = [];
  for (const x of XS) for (const z of [ZS[0], zB]) columns.push([x, z]);
  for (const z of ZS.slice(1, -1)) for (const x of [XS[0], X]) columns.push([x, z]);
  const cyl = (x, z) => new THREE.CylinderGeometry(H.colR, H.colR * 1.06, H.column, 16).translate(x, y0 + H.column / 2, z);
  const columnGeo = columns.map(([x, z]) => cyl(x, z));
  // A run of wall along x (front or back) or z (an end), between two points, from height a to b above the floor.
  const along = (x0, x1, zc, a, b) => { if (x1 - x0 > 0.01 && b - a > 0.01) plaster.push(box(x1 - x0, b - a, H.wall, (x0 + x1) / 2, y0 + (a + b) / 2, zc)); };
  const across = (z0, z1, xc, a, b) => plaster.push(box(H.wall, b - a, z1 - z0, xc, y0 + (a + b) / 2, (z0 + z1) / 2));
  const solid = (x0, x1, z0, z1) => walk.solids.push({ x0: x0 - BODY, x1: x1 + BODY, z0: z0 - BODY, z1: z1 + BODY, eyeTop: top + 0.3 });
  const zcF = ZS[0] + 0.3 - H.wall / 2, zcB = zB - 0.3 + H.wall / 2, xc = X + 0.3 - H.wall / 2;
  const fz0 = zcF - H.wall / 2, fz1 = zcF + H.wall / 2;
  // The front, bay by bay: a door is an opening with a sill to step over; a window an opening over a sill wall, barred;
  // the end bays are wall. Between openings the wall closes on each column.
  FRONT.forEach((kind, i) => {
    const a = XS[i], b = XS[i + 1], mid = (a + b) / 2;
    if (kind === "wall") { along(a, b, zcF, 0, H.column); solid(a, b, fz0, fz1); return; }
    const w = kind === "door" ? H.door.w : H.window.w, l = mid - w / 2, r = mid + w / 2;
    along(a, l, zcF, 0, H.column); along(r, b, zcF, 0, H.column); solid(a, l, fz0, fz1); solid(r, b, fz0, fz1);
    if (kind === "door") {
      along(l, r, zcF, H.door.h, H.column);
      wood.push(box(w, H.door.sill, H.wall, mid, y0 + H.door.sill / 2, zcF));                       // the sill
      walk.decks.push({ x0: l, x1: r, z0: fz0, z1: fz1, h: y0 + H.door.sill, floor: "wood" });
    } else {
      const s = H.window.sill, h = s + H.window.h;
      along(l, r, zcF, 0, s); along(l, r, zcF, h, H.column); solid(l, r, fz0, fz1);
      for (let k = 0; k < H.window.bars; k++) wood.push(box(0.08, H.window.h, 0.08, l + ((k + 0.5) * w) / H.window.bars, y0 + s + H.window.h / 2, zcF));
    }
  });
  // The back wall, its middle bay a door kept shut (the way round behind the altar is not opened, PRD.md §1.5); the two end walls.
  along(XS[0], X, zcB, 0, H.column); solid(XS[0], X, zcB - H.wall / 2, zcB + H.wall / 2);
  dark.push(box(H.door.w, H.door.h, 0.06, 0, y0 + H.door.h / 2, zcB + H.wall / 2 + 0.03));
  for (const s of [-1, 1]) { across(zB - 0.3, ZS[0] + 0.3, s * xc, 0, H.column); solid(s * xc - H.wall / 2, s * xc + H.wall / 2, zB - 0.3, ZS[0] + 0.3); }
  for (const [x, z] of columns) walk.posts.push({ x0: x - H.colR - BODY, x1: x + H.colR + BODY, z0: z - H.colR - BODY, z1: z + H.colR + BODY });

  // The roof: four slopes from the eave's edge to the ridge, the ends hipped at 45°, with the dark of its underside
  // below them (from inside the hall that is what the eye meets looking up: the open roof, not the sky) and a fascia
  // round the edge. Between the column heads and that underside, all round, the band where the bracket sets stand.
  const EX = X + H.overhang, EF = ZS[0] + H.overhang, EB = zB - H.overhang, D = EF - EB, half = D / 2, zm = (EF + EB) / 2, rx = EX - half;
  const slope = (H.ridge - H.eave) / half, under = (y) => y - H.roof;
  const tri = (out, a, b, c) => out.push(...a, ...b, ...c);
  const topTris = [], underTris = [], fascia = [];
  const P = (x, z, y) => [x, y, z];
  const A = P(-EX, EF, H.eave), B = P(EX, EF, H.eave), C = P(EX, EB, H.eave), Dd = P(-EX, EB, H.eave), R1 = P(-rx, zm, H.ridge), R2 = P(rx, zm, H.ridge);
  tri(topTris, A, B, R2); tri(topTris, A, R2, R1);      // the front slope
  tri(topTris, C, Dd, R1); tri(topTris, C, R1, R2);     // the back slope
  tri(topTris, B, C, R2); tri(topTris, Dd, A, R1);      // the two hipped ends
  const low = (p) => [p[0], under(p[1]), p[2]];
  for (let i = 0; i < topTris.length; i += 9) {          // the underside: the same slopes lowered, turned to face down
    const a = low(topTris.slice(i, i + 3)), b = low(topTris.slice(i + 3, i + 6)), c = low(topTris.slice(i + 6, i + 9));
    tri(underTris, a, c, b);
  }
  const edge = [A, B, C, Dd, A];
  for (let i = 0; i < 4; i++) { const p = edge[i], q = edge[i + 1]; tri(fascia, p, low(p), low(q)); tri(fascia, p, low(q), q); }
  const geoOf = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  const ridgeBox = box(2 * rx + 0.8, 0.7, 0.8, 0, H.ridge + 0.2, zm);
  // The band of bracket sets: from the column heads up to the underside where it passes over the wall's outer face.
  const bandTop = under(H.eave + slope * (H.overhang - 0.3)), bandH = bandTop - top, bw = H.wall + 0.7;
  wood.push(box(2 * X + 0.6 + 1.4, bandH, bw, 0, top + bandH / 2, ZS[0] + 0.3 + 0.7 - bw / 2), box(2 * X + 0.6 + 1.4, bandH, bw, 0, top + bandH / 2, zB - 0.3 - 0.7 + bw / 2));
  for (const s of [-1, 1]) woodZ.push(box(bw, bandH, zB - ZS[0] - 2, s * (X + 0.3 + 0.7 - bw / 2), top + bandH / 2, (ZS[0] + zB) / 2));

  return {
    parts: { plaster, wood, woodZ, dark, columns: columnGeo, tiles: [geoOf(topTris)], underside: [geoOf(underTris), geoOf(fascia)], ridge: [ridgeBox] },
    walk,
    columns,
    roof: { EX, EF, EB, rx, zm, slope, eave: H.eave, ridge: H.ridge },
    box: { x0: -OUTER.x, x1: OUTER.x, z0: OUTER.zB, z1: OUTER.zF },
  };
}
