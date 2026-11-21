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
  door: { w: 5.0, h: 5.0, sill: 0.24 },    // a square door filling its 5.8 m bay but for the jambs (the Yingzao Fashi's plank door is as wide as it is tall: SOURCES.md §12); the sill pressed to 0.24 m so he steps over it (PRD.md §2)
  window: { w: 3.0, sill: 1.1, h: 2.4, bars: 11 },   // upright bars over a sill wall 1.0–1.2 m (ARCHITECTURE.md §4.2, not measured)
  roof: 0.6,             // how thick the roof's mass is, from its tiles to the dark of its underside
  lintel: 0.55,          // the tie-beam between column heads, and the cap board on them 0.2 thick
  bracket: { tiers: 3, h: 0.7, w: 1.0, out: [0.9, 1.7, 2.5], inn: [0.7, 1.3] },   // a bracket set as three stepped blocks out under the eave and two in (white box)
  beams: [10.2, 12.6, 15.0, 17.4],   // the bottoms of the four tiers of each frame above the court (the roof left open to the timber, ARCHITECTURE.md §2.2: eight frames)
  beam: { w: 0.6, d: 0.9 },
});
/** Where the inner columns stand: the back row on the fourth column line, one under each of the eight frames (ARCHITECTURE.md §2.2's proposal, and the statue session's stage); in front of the altar the inner columns are left out, but for the two end bays. */
export const INNER = Object.freeze({ back: 4, front: 1, frontAt: [1, 8] });
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
  // The underside's height above a point (x, z) under the roof: the lowest of its four slopes there.
  const underAt = (x, z) => under(Math.min(H.ridge, H.eave + slope * Math.min(EF - z, z - EB, EX - Math.abs(x))));

  // Over the walls, all round: the tie-beams between the column heads and the cap board on them; above, up to the
  // underside, the wall between the bracket sets; and the bracket sets themselves, one on each column and one in the
  // middle of each bay, stepping out under the eave and in over the floor, so that from the terrace the eave reads as
  // columns, beam and brackets, not one dark band.
  const BR = H.bracket, lt = H.lintel, cap = top + 0.2, wallUp = underAt(0, ZS[0] + 0.3);
  /** @type {[boolean, number, number, readonly number[]][]} */
  const sides = [   // [along x?, the column line's z or x, outward sign, the column positions along it]
    [true, ZS[0], 1, XS], [true, zB, -1, XS], [false, XS[0], -1, ZS], [false, X, 1, ZS],
  ];
  for (const [ax, at, out, pos] of sides) {
    const a = pos[0], b = pos[pos.length - 1], len = Math.abs(b - a), mid = (a + b) / 2, face = at + out * 0.3;
    const put = (list, w, h, d, u, y, v) => list.push(ax ? box(w, h, d, u, y, v) : box(d, h, w, v, y, u));
    const list = ax ? wood : woodZ;
    put(list, len, lt, 0.4, mid, top - lt / 2, face + out * 0.1);                       // the tie-beam, proud of the wall
    put(list, len + 0.8, 0.2, H.wall + 0.3, mid, top + 0.1, at + out * (0.3 - H.wall / 2 + 0.15));   // the cap board
    put(plaster, len, wallUp - cap, H.wall, mid, (cap + wallUp) / 2, at + out * (0.3 - H.wall / 2));  // the wall between the brackets, up to the roof
    const sets = []; pos.forEach((p, i) => { sets.push(p); if (i < pos.length - 1) sets.push((p + pos[i + 1]) / 2); });
    for (const u of sets) {
      for (let k = 0; k < BR.tiers; k++) {                                               // out under the eave
        const o = BR.out[k], w = BR.w + 0.3 * k;
        put(list, w, BR.h * 0.85, o, u, cap + BR.h * (k + 0.5), face + out * (o / 2 - 0.3 + 0.3));
      }
      BR.inn.forEach((o, k) => put(list, BR.w, BR.h * 0.85, o, u, cap + BR.h * (k + 0.5), face - out * (H.wall + o / 2)));   // and in over the floor
    }
    const eaveBeamOut = BR.out[BR.tiers - 1] + 0.15, yE = cap + BR.h * BR.tiers + 0.15;
    put(list, len + 2 * eaveBeamOut, 0.3, 0.35, mid, yE, face + out * eaveBeamOut);        // the eave purlin the outermost tier carries
  }

  // Inside, the roof open to its timber: the inner columns, and on each of the eight inner column lines a frame of four
  // tiers of beams, each shorter than the one below and standing on it on short posts, up to a post under the ridge; and
  // the purlins along the hall at each tier's ends. The white box's frame: its spans and heights follow the roof's slopes,
  // not a measured section (ARCHITECTURE.md §2.2: positions to be measured).
  const inner = [...XS.slice(1, -1).map((x) => [x, ZS[INNER.back]]), ...INNER.frontAt.map((i) => [XS[i], ZS[INNER.front]])];
  const yb = H.beams, bw = H.beam.w, bd = H.beam.d, innerTop = yb[0];
  const innerGeo = inner.map(([x, z]) => new THREE.CylinderGeometry(H.colR * 1.1, H.colR * 1.15, innerTop - y0, 16).translate(x, (y0 + innerTop) / 2, z));
  for (const [x, z] of inner) walk.posts.push({ x0: x - H.colR * 1.1 - BODY, x1: x + H.colR * 1.1 + BODY, z0: z - H.colR * 1.1 - BODY, z1: z + H.colR * 1.1 + BODY });
  const frame = [], purlins = [];
  // How far a tier on the frame at x may run, front and back, before it meets the slopes (the hipped ends lower them).
  const reach = (x, yTop) => { let f = null, k = null; for (let z = ZS[0]; z >= zB; z -= 0.05) if (underAt(x, z) >= yTop) { f ??= z; k = z; } return [f ?? zm, k ?? zm]; };
  for (const x of XS.slice(1, -1)) {
    let prev = null;
    yb.forEach((y, j) => {
      const [z1, z0] = reach(x + Math.sign(x) * bw / 2, y + bd + 0.35);
      if (z1 - z0 < 1.5) return;
      frame.push(box(bw, bd, z1 - z0, x, y + bd / 2, (z0 + z1) / 2));
      if (prev) for (const z of [z0 + 0.4, z1 - 0.4]) frame.push(box(bw * 0.9, y - prev, 0.7, x, (prev + y) / 2, z));   // the short posts on the tier below
      prev = y + bd;
      for (const z of [z0 + 0.2, z1 - 0.2]) purlins.push([z, y + bd + 0.18]);
    });
    const crown = underAt(x + Math.sign(x) * bw / 2, zm + 0.3) - 0.4;   // up to the ridge purlin
    if (prev && crown - prev > 0.3) frame.push(box(bw * 0.8, crown - prev, 0.6, x, (prev + crown) / 2, zm));   // the post up to the roof
  }
  const seen = new Set();
  for (const [z, y] of purlins) { const k = z.toFixed(2); if (seen.has(k)) continue; seen.add(k); wood.push(box(XS[XS.length - 2] - XS[1] + 1.2, 0.36, 0.36, 0, y, z)); }
  wood.push(box(XS[XS.length - 2] - XS[1] + 1.2, 0.4, 0.4, 0, underAt(0, zm) - 0.2, zm));   // the ridge purlin

  return {
    parts: { plaster, wood, woodZ, dark, frame, columns: [...columnGeo, ...innerGeo], tiles: [geoOf(topTris)], underside: [geoOf(underTris), geoOf(fascia)], ridge: [ridgeBox] },
    walk,
    columns,
    inner,
    // A neutral fill under the roof, so that the white box's frame and floor can be seen from the door and from below
    // (the hall's own light, from its door and its lamps, is phase two: docs/t05/PLAN.md, PRD.md §2.1). [x, y, z, intensity, distance]
    fill: [[-12, y0 + 10, -6], [12, y0 + 10, -6], [-12, y0 + 10, -14], [12, y0 + 10, -14], [0, y0 + 13, -10]].map(([x, y, z]) => [x, y, z, 45, 30]),
    roof: { EX, EF, EB, rx, zm, slope, eave: H.eave, ridge: H.ridge },
    box: { x0: -OUTER.x, x1: OUTER.x, z0: OUTER.zB, z1: OUTER.zF },
  };
}
