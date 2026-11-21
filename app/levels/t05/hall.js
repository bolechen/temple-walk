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
import { box, BODY, footAt } from "../../src/geo.js";

/** The nine bays across, west to east (ARCHITECTURE.md §2.1, S04, read): 4.98, 4.98, 5.26, the three middle ones 5.80, 5.26, 4.98, 4.98 m. */
export const BAYS = Object.freeze([4.98, 4.98, 5.26, 5.8, 5.8, 5.8, 5.26, 4.98, 4.98]);
/** The hall's numbers: depth to the back column line, column height, floor, eave and ridge (SITE.md §4.2, ARCHITECTURE.md §2.1, §4.1). */
export const HALL = Object.freeze({
  depth: 25.13,          // front to back column line (S04, read)
  rows: 5,               // five bays deep; laid out equal here, which the sources do not give (proposal)
  floor: 3.0,            // the platform's top
  column: 6.06,          // column height (S04, 234 small cun, converted)
  colR: 0.405,           // an eave column's radius at its foot, 0.81 m across, a little less at its head (the structural review of #432: the Yingzao Fashi's hall columns are two cai two zhi to three cai across, chapter 5, read; a first-grade cai, chapter 4, is 28 or 29 cm by two second-hand readings, and 0.81 sits in the band at either: the T05 lead's choice)
  innerR: 0.42,          // an inner column's, 0.84 m (three cai, 45 fen: it is 2.7 m taller than the eave columns; the review's choice)
  wall: 0.9,             // the walls' thickness, their outer face 0.3 m outside the column line (ARCHITECTURE.md §4.2: 1.0–1.5 m, a proposal; thinner here so the platform's back edge holds it)
  front: -0.05,          // but the front wall's outer face lies just behind its column line, so that the ten front columns stand out of it more than half round and the nine bays read (the review of #425); the end and back walls keep the columns in, as this hall's thick walls do
  eave: 11.81,           // the eave's edge above the court: platform 3 + column 6.06 + bracket sets 2.75 (SITE.md §4.2)
  ridge: 21.0,           // the ridge above the court (SITE.md §1, about +21)
  overhang: 3.75,        // the eave beyond the column line (ARCHITECTURE.md §4.1: about 3.5–4 m)
  door: { w: 5.0, h: 5.0, sill: 0.24 },    // a square door filling its 5.8 m bay but for the jambs (the Yingzao Fashi's plank door is as wide as it is tall: SOURCES.md §14); the sill pressed to 0.24 m so he steps over it (PRD.md §2)
  window: { sill: 1.1, bars: 13 },   // upright bars over a sill wall 1.0–1.2 m (ARCHITECTURE.md §4.2, not measured); as wide as its bay less the jambs, and its head on the doors' line (the review of #425)
  inside: 0.2,          // the share of the sky's light a surface inside the walls takes (white box, a proposal)
  jamb: 0.4,             // the wooden jambs each side of a door or window, and the head over it
  roof: 0.6,             // how thick the roof's mass is, from its tiles to the dark of its underside
  lintel: 0.55,          // the tie-beam between column heads, and the cap board on them 0.2 thick
  bracket: { tiers: 3, h: 0.7, w: 1.0, out: [0.9, 1.7, 2.5], inn: [0.7, 1.3] },   // a bracket set as three stepped blocks out under the eave and two in (white box)
  beams: [11.8, 13.6, 15.4, 17.2],   // the bottoms of the four tiers of each frame above the court (the roof left open to the timber, ARCHITECTURE.md §2.2: eight frames). The lowest lies on the bracket sets' heads (3 + 6.06 + 2.75), so that from the threshold the figures' heads and faces are all under it (the lead's call and the structural review of #425; DECISIONS.md)
  beam: { w: 0.6, d: 0.9 },
  rafter: 2.88,          // a rafter's run, between purlins: ten rafters front to back (the structural review of #425, from the depth between the eave purlins)
});
/**
 * The fill under the roof while he is inside (white box): the level it reaches (a little over the 10 the round before
 * #481 had always on, so that station E's middle tone is over L* 10 in first person); over how many metres in from the front wall it comes up; and how fast the eye takes it (seconds to cover about
 * two thirds of a change), so that walking in it comes up over two or three seconds and never jumps (#481's art review).
 */
export const FILL = Object.freeze({ lux: 16, depth: 3, ease: 0.5 });
/** Where the inner columns stand: the back row on the fourth column line, one under each of the eight frames (ARCHITECTURE.md §2.2's proposal, and the statue session's stage); in front of the altar the inner columns are left out, but for the two end bays. */
export const INNER = Object.freeze({ back: 4, front: 1, frontAt: [1, 8] });
/** Which bays of the front are doors, which windows, which wall (ARCHITECTURE.md §4.2: three doors, four windows, the end bays walls). */
export const FRONT = Object.freeze(["wall", "window", "window", "door", "door", "door", "window", "window", "wall"]);

/** The column lines across (x, west to east) and front to back (z, front first). */
export const XS = Object.freeze(BAYS.reduce((a, w) => [...a, a[a.length - 1] + w], [-BAYS.reduce((s, w) => s + w, 0) / 2]));
export const ZS = Object.freeze(Array.from({ length: HALL.rows + 1 }, (_, i) => -(HALL.depth * i) / HALL.rows));
/** The hall's outer faces: the walls' outside, 0.3 m beyond the column lines. */
export const OUTER = Object.freeze({ x: XS[XS.length - 1] + 0.3, zF: HALL.front, zB: -HALL.depth - 0.3 });

/** The hall's meshes (by material) and what the written plan's walker is told of it. */
export function buildHall(M) {
  const H = HALL, y0 = H.floor, top = y0 + H.column, X = XS[XS.length - 1], zB = ZS[ZS.length - 1];
  const wallIn = H.wall - 0.3;   // how far the wall's inner face lies inside the column line
  const plaster = [], wood = [], woodZ = [], dark = [], mural = [], walk = { solids: [], decks: [], posts: [] };
  // The hall's own floor, a thin course laid over the platform's top within the walls: the platform's top is one face from
  // edge to edge, which the inside's shut-out sky (`shut` below) cannot reach at its corners; this one lies all inside.
  const inZ0 = ZS[ZS.length - 1] - 0.3 + H.wall, inZ1 = ZS[0] + H.front - H.wall, inX = XS[XS.length - 1] + 0.3 - H.wall;
  const floor = [box(2 * inX, 0.02, inZ1 - inZ0, 0, y0 + 0.01, (inZ0 + inZ1) / 2)];
  // Columns: every crossing of the outer lines, ten across the front and the back and four more up each end.
  const columns = [];
  for (const x of XS) for (const z of [ZS[0], zB]) columns.push([x, z]);
  for (const z of ZS.slice(1, -1)) for (const x of [XS[0], X]) columns.push([x, z]);
  const cyl = (x, z) => new THREE.CylinderGeometry(H.colR * 0.94, H.colR, H.column, 16).translate(x, y0 + H.column / 2, z);
  const columnGeo = columns.map(([x, z]) => cyl(x, z));
  // A run of wall along x (front or back) or z (an end), between two points, from height a to b above the floor.
  const along = (x0, x1, zc, a, b) => { if (x1 - x0 > 0.01 && b - a > 0.01) plaster.push(box(x1 - x0, b - a, H.wall, (x0 + x1) / 2, y0 + (a + b) / 2, zc)); };
  const across = (z0, z1, xc, a, b) => plaster.push(box(H.wall, b - a, z1 - z0, xc, y0 + (a + b) / 2, (z0 + z1) / 2));
  const solid = (x0, x1, z0, z1) => walk.solids.push({ x0: x0 - BODY, x1: x1 + BODY, z0: z0 - BODY, z1: z1 + BODY, eyeTop: top + 0.3 });
  const zcF = ZS[0] + H.front - H.wall / 2, zcB = zB - 0.3 + H.wall / 2, xc = X + 0.3 - H.wall / 2;
  const fz0 = zcF - H.wall / 2, fz1 = zcF + H.wall / 2;
  // The front, bay by bay: a door is an opening with a sill to step over; a window an opening over a sill wall, barred;
  // the end bays are wall. Each opening fills its bay between two wooden jambs, under a wooden head on the doors' line, so
  // that the doors and windows read as one row and the opening's sides are timber, not the white of the wall's thickness.
  const J = H.jamb, head = H.door.h;
  FRONT.forEach((kind, i) => {
    const a = XS[i], b = XS[i + 1], mid = (a + b) / 2;
    if (kind === "wall") { along(a, b, zcF, 0, H.column); solid(a, b, fz0, fz1); return; }
    const l = a + J, r = b - J, w = r - l;
    for (const [x0, x1] of [[a, l], [r, b]]) { wood.push(box(x1 - x0, head + J, H.wall + 0.04, (x0 + x1) / 2, y0 + (head + J) / 2, zcF)); solid(x0, x1, fz0, fz1); }   // the jambs
    wood.push(box(w, J, H.wall + 0.04, mid, y0 + head + J / 2, zcF));                                    // the head
    along(a, b, zcF, head + J, H.column);                                                                 // the wall over it
    if (kind === "door") {
      wood.push(box(w, H.door.sill, H.wall, mid, y0 + H.door.sill / 2, zcF));                       // the sill
      walk.decks.push({ x0: l, x1: r, z0: fz0, z1: fz1, h: y0 + H.door.sill, floor: "wood" });
    } else {
      const s = H.window.sill, wh = head - s, n = H.window.bars;
      along(l, r, zcF, 0, s); solid(l, r, fz0, fz1);
      wood.push(box(w, 0.2, H.wall + 0.04, mid, y0 + s + 0.1, zcF));                                       // the window's sill board
      for (let k = 0; k < n; k++) wood.push(box(0.1, wh, 0.1, l + ((k + 0.5) * w) / n, y0 + s + wh / 2, zcF));
    }
  });
  // The back wall, its middle bay a door kept shut (the way round behind the altar is not opened, PRD.md §1.5); the two end walls.
  along(XS[0], X, zcB, 0, H.column); solid(XS[0], X, zcB - H.wall / 2, zcB + H.wall / 2);
  dark.push(box(H.door.w, H.door.h, 0.06, 0, y0 + H.door.h / 2, zcB + H.wall / 2 + 0.03));
  for (const s of [-1, 1]) { across(zB - 0.3, ZS[0] + H.front, s * xc, 0, H.column); solid(s * xc - H.wall / 2, s * xc + H.wall / 2, zB - 0.3, ZS[0] + H.front); }
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
  // The main ridge as a narrow, tall course, with the masses of its two end ornaments standing up at its ends.
  const ridgeParts = [box(2 * rx, 1.0, 0.45, 0, H.ridge + 0.4, zm), ...[-1, 1].map((s) => box(0.7, 2.4, 1.3, s * rx, H.ridge + 1.1, zm))];
  // The underside's height above a point (x, z) under the roof: the lowest of its four slopes there.
  const underAt = (x, z) => under(Math.min(H.ridge, H.eave + slope * Math.min(EF - z, z - EB, EX - Math.abs(x))));

  // Over the walls, all round: the tie-beams between the column heads and the cap board on them; above, up to the
  // underside, the wall between the bracket sets; and the bracket sets themselves, one on each column and one in the
  // middle of each bay, stepping out under the eave and in over the floor, so that from the terrace the eave reads as
  // columns, beam and brackets, not one dark band.
  const BR = H.bracket, lt = H.lintel, cap = top + 0.2;
  /** @type {[boolean, number, number, readonly number[], number][]} */
  const sides = [   // [along x?, the column line's z or x, outward sign, the column positions along it, the wall's outer face off the line]
    [true, ZS[0], 1, XS, H.front], [true, zB, -1, XS, 0.3], [false, XS[0], -1, ZS, 0.3], [false, X, 1, ZS, 0.3],
  ];
  for (const [ax, at, out, pos, off] of sides) {
    const a = pos[0], b = pos[pos.length - 1], len = Math.abs(b - a), mid = (a + b) / 2, face = at + out * off;
    // The wall rises to the roof's underside over its inner face, which is higher than over its outer face (the roof
    // climbs inward): stopped at the outer face's height it left a slit along every wall's top that the sun came in by
    // (the hall's inside lit in diagonal bands). Its top above the outer face stays inside the roof's own thickness.
    const inside = at + out * (off - H.wall), wallUp = ax ? underAt(0, inside) : underAt(inside, zm);
    const put = (list, w, h, d, u, y, v) => list.push(ax ? box(w, h, d, u, y, v) : box(d, h, w, v, y, u));
    const list = ax ? wood : woodZ;
    put(list, len, lt, 0.4, mid, top - lt / 2, face + out * 0.1);                       // the tie-beam, proud of the wall
    put(list, len + 0.8, 0.2, H.wall + 0.3, mid, top + 0.1, at + out * (off - H.wall / 2 + 0.15));   // the cap board
    put(plaster, len, wallUp - cap, H.wall, mid, (cap + wallUp) / 2, at + out * (off - H.wall / 2));  // the wall between the brackets, up to the roof
    // Inside the back and end walls, their whole height, the dark ground the murals are painted on (ARCHITECTURE.md §7.2:
    // darker and greyer than the timber's colours), so that seen from the court through the doors the hall is dark.
    if (off > 0) put(mural, len - 2 * (H.wall - 0.3), wallUp - y0, 0.04, mid, (y0 + wallUp) / 2, at - out * (H.wall - off + 0.05));
    const sets = []; pos.forEach((p, i) => { sets.push(p); if (i < pos.length - 1) sets.push((p + pos[i + 1]) / 2); });
    for (const u of sets) {
      for (let k = 0; k < BR.tiers; k++) {                                               // out under the eave
        const o = BR.out[k], w = BR.w + 0.3 * k;
        put(list, w, BR.h * 0.85, o, u, cap + BR.h * (k + 0.5), face + out * (o / 2 - 0.3 + 0.3));
      }
      BR.inn.forEach((o, k) => put(list, BR.w, BR.h * 0.85, o, u, cap + BR.h * (k + 0.5), face - out * (H.wall + o / 2)));   // and in over the floor
    }
    const eaveBeamOut = BR.out[BR.tiers - 1] + 0.15, yE = cap + BR.h * BR.tiers - 0.05;
    put(list, len + 2 * eaveBeamOut, 0.3, 0.35, mid, yE, face + out * eaveBeamOut);        // the eave purlin the outermost tier carries
  }

  // Inside, the roof open to its timber: the inner columns, and on each of the eight inner column lines a frame of four
  // tiers of beams, each shorter than the one below, up to a post under the ridge; and the purlins along the hall, one at
  // each rafter's joint (ten rafters: eleven purlins, 2.88 m apart about the ridge), each standing on a tier's end on a
  // short post. The structural review of #425 set the purlins so. The frames stand on the column lines and the figures in
  // the middle of the bays, so the beams pass beside them; but from the threshold the line of sight to the outer figures'
  // heads crosses the frames, and the lowest tier lies on the bracket sets' heads, over it. The inner columns rise to that
  // tier, as the eave columns' brackets do. Positions and heights are the white box's (the review's own proposals) until
  // the survey's section is read (ARCHITECTURE.md §2.2).
  const inner = [...XS.slice(1, -1).map((x) => [x, ZS[INNER.back]]), ...INNER.frontAt.map((i) => [XS[i], ZS[INNER.front]])];
  const yb = H.beams, bw = H.beam.w, bd = H.beam.d, innerTop = yb[0];
  const R = H.innerR, innerGeo = inner.map(([x, z]) => new THREE.CylinderGeometry(R * 0.94, R, innerTop - y0, 16).translate(x, (y0 + innerTop) / 2, z));
  for (const [x, z] of inner) walk.posts.push({ x0: x - R - BODY, x1: x + R + BODY, z0: z - R - BODY, z1: z + R + BODY });
  const frame = [], PT = 0.36;
  // The purlins' places, front to back, and the height of each: its top just under the roof there.
  const purlinZ = (k) => [zm + H.rafter * k, zm - H.rafter * k], purlinY = (z) => Math.min(underAt(0, z - PT / 2), underAt(0, z + PT / 2)) - PT / 2 - 0.06;
  // How far a tier on the frame at x may run, front and back, before it meets the slopes (the hipped ends lower them).
  const reach = (x, yTop) => { let f = null, k = null; for (let z = ZS[0]; z >= zB; z -= 0.05) if (underAt(x, z) >= yTop) { f ??= z; k = z; } return [f ?? zm, k ?? zm]; };
  for (const x of XS.slice(1, -1)) {
    let prev = null;
    const edge = x + Math.sign(x) * bw / 2;
    yb.forEach((y, j) => {
      const [pf, pb] = purlinZ(4 - j), [rf, rb] = reach(edge, y + bd + 0.05), z1 = Math.min(pf, rf), z0 = Math.max(pb, rb);
      if (z1 - z0 < 1.5) return;
      frame.push(box(bw, bd, z1 - z0, x, y + bd / 2, (z0 + z1) / 2));
      if (prev) for (const z of [z0 + 0.4, z1 - 0.4]) frame.push(box(bw * 0.9, y - prev, 0.7, x, (prev + y) / 2, z));   // the short posts on the tier below
      prev = y + bd;
      // where the tier ends under its purlin, a short post up to it
      for (const [z, at] of [[z1, pf], [z0, pb]]) { const up = purlinY(at) - PT / 2; if (Math.abs(z - at) < 0.01 && up - prev > 0.1 && up <= underAt(edge, at) - PT) frame.push(box(bw * 0.8, up - prev, 0.5, x, (prev + up) / 2, z + Math.sign(zm - z) * 0.25)); }
    });
    const crown = purlinY(zm) - PT / 2;   // up to the ridge purlin
    if (prev && crown - prev > 0.3 && crown <= underAt(edge, zm + 0.3)) frame.push(box(bw * 0.8, crown - prev, 0.6, x, (prev + crown) / 2, zm));
  }
  // A purlin runs along the hall only as far as the hipped ends leave room over it: where the hip comes down to its top,
  // it stops, so that none passes out through the end slopes (the review of #425: two did, under the ridge).
  const within = (z, top) => { let x = XS[XS.length - 2] + 0.6; while (x > 0 && underAt(x, z) < top + 0.05) x -= 0.05; return x; };
  const purlin = (z, y, t) => { const half = Math.min(within(z - t / 2, y + t / 2), within(z + t / 2, y + t / 2)); if (half > 0.5) wood.push(box(2 * half, t, t, 0, y, z)); };
  const purlinAt = new Set([zm]);
  for (let k = 1; k <= 5; k++) for (const z of purlinZ(k)) purlinAt.add(z);
  for (const z of purlinAt) purlin(z, purlinY(z), PT);

  return {
    // The plaster finds the foot of its wall (where the damp rises from) in its first texture coordinate: the hall's floor,
    // not a box's own 0 to 1, which laid the damp line slanting across every wall (the diagonal band the art review saw).
    parts: { plaster: plaster.map((g) => footAt(g, y0)), wood, woodZ, dark, mural: mural.map((g) => footAt(g, y0)), floor, frame, columns: [...columnGeo, ...innerGeo], tiles: [geoOf(topTris)], underside: [geoOf(underTris), geoOf(fascia)], ridge: ridgeParts },
    walk,
    columns,
    inner,
    // How much of the sky reaches a point: under the roof and inside the walls, little (the white box's stand-in for the
    // occlusion a closed hall has, which a mesh's own baked occlusion does not see); outside, all of it. Handed to
    // geo.mesh's `ao`, so that from the court the doorways read darker than the wall (the review of #425).
    shut: (x, y, z) => (Math.abs(x) < X + 0.3 - H.wall + 0.02 && z < ZS[0] + H.front - H.wall + 0.02 && z > zB - 0.3 + H.wall - 0.02 && y > y0 - 0.01 ? H.inside : 1),
    // The same inside as a box the mist does not fill (fog.js, FOGSHUT): from the floor up to the ridge, within the walls.
    fogShut: { x0: -(X + 0.3 - H.wall), x1: X + 0.3 - H.wall, z0: zB - 0.3 + H.wall, z1: ZS[0] + H.front - H.wall, y0: y0, y1: H.ridge },
    // A neutral fill under the roof, so that the white box's frame and floor can be seen from inside (the hall's own
    // light, from its door and its lamps, is phase two: docs/t05/PLAN.md, PRD.md §2.1). [x, y, z, intensity, distance]:
    // the intensity is what it reaches once he is well inside; from the court it is out, so that the doorway reads dark
    // (`within` below, and the site's tick, raise it as he goes in).
    fill: [[-12, y0 + 10, -6], [12, y0 + 10, -6], [-12, y0 + 10, -14], [12, y0 + 10, -14], [0, y0 + 13, -10]].map(([x, y, z]) => [x, y, z, FILL.lux, 26]),
    // How far inside the hall an eye is, 0 to 1: nothing outside the walls' box but for the FILL.depth metres before the
    // threshold, then rising smoothly to FILL.depth metres in (PRD.md §2.1's "how far inside", its cheapest form).
    within: (x, y, z) => {
      const zF = ZS[0] + H.front, xIn = X + 0.3 - H.wall, zIn = zB - 0.3 + H.wall;
      if (Math.abs(x) > xIn || z < zIn || z > zF + FILL.depth || y < y0 - 0.5 || y > H.ridge) return 0;
      const t = Math.min(1, Math.max(0, (zF + FILL.depth - z) / (2 * FILL.depth)));
      return t * t * (3 - 2 * t);
    },
    roof: { EX, EF, EB, rx, zm, slope, eave: H.eave, ridge: H.ridge },
    box: { x0: -OUTER.x, x1: OUTER.x, z0: OUTER.zB, z1: OUTER.zF },
  };
}
