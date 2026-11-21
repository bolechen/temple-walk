// The axis of 奉明寺 before the court (T05, docs/t05/PLAN.md item 8, issue #435): the way in from the outer gate's place, the
// raised terrace that the inner gate, the archway and the Wuliang hall share, the walls round both, and the two places
// held for what comes later (the monument pavilion west of the terrace before the great hall, the lamp table inside its
// door). The order along the axis is the real temple's; where each stands is our proposal, since OSM outlines only the
// great hall and the Wuliang hall (docs/t05/SCOPE-OPTIONS.md §二 B, docs/t05/SITE.md §1.1, §4.2). Every number here, and
// how far it is a published measurement, a summary or our own, is in docs/t05/SOURCES.md §13.
//
// What this file draws is ground and stone, and, from ./gates.js, the three buildings on it: the outer gate, the inner gate
// and the Wuliang hall (item 9). The archway between the inner gate and the hall is item 10's: its place is held.
//
// Heights are from the court's paving (y = 0), as site.js has them; x east, z south, the great hall's front column line
// is z = 0 and the court's paving stops at the court's south wall, z = +62.
import * as THREE from "three";
import { box, merge, mesh, BODY } from "../../src/geo.js";
import { buildShells } from "./gates.js";

/** Where each of the axis's buildings stands along it (z, x = 0). Proposals but for the Wuliang hall's z, which is OSM's (S26, an inference). */
/**
 * How far the inner gate (and cam07 in its passage) stands south of where the first white box put it (z = +120). From cam07 the Wuliang hall's
 * ridge hides the Great Hall's roof; the farther the eye from the hall, the lower the hall's ridge looks against the Great Hall's (#482). The
 * hall's ridge cannot come down much (docs/t05/DECISIONS.md: the roof's rise is the Yingzao Fashi's lowest ratio, 1:4, and the columns stay), so the gate
 * moves instead: the way between the gates is shorter by this much and the second terrace longer. 13 or 20 m are the two tried; `docs/t05/SOURCES.md` §13.1.
 */
export const INNER_SHIFT = 13;
export const AXIS = Object.freeze({ outerZ: 208, innerZ: 120 + INNER_SHIFT, paifangZ: 100, hallZ: 67.2 });

/** The second terrace (SITE.md §4.2: +1.0 m, a proposal; S22, a summary: the front gate, the archway and the Wuliang hall are one group on a higher terrace than the great hall's). */
export const SECOND = Object.freeze({ y: 1.0, hw: 14, zN: 62, wallT: 0.8, wallH: 3.2 });
/** The way between the gates: the walls' centres, how thick and how high they are (a proposal: SITE.md has no outline for them). */
export const LANE = Object.freeze({ hw: 8, t: 0.8, h: 3.2 });
/** The Wuliang hall (S03: 16.14 × 12.22 m; S26: OSM 17.2 × 13.0 m, centre z = +67.2, x = +2.6, which is put on the axis): five bays, columns on a 16.14 × 12.22 m plan. Bays and platform are a proposal. */
export const HALL = Object.freeze({
  xs: Object.freeze([-8.07, -5.57, -2.07, 2.07, 5.57, 8.07]),
  zs: Object.freeze([6.11, 2.04, -2.04, -6.11]),
  // The roof's rise is a quarter of the distance between the front and back eave purlins (`juzhe`, the Yingzao Fashi's lowest ratio, for a two-rafter house, which
  // the Liao halls come near: Fengguosi's 0.245; the structure review of #482), not a third as for a hall; the ornaments and the corners are smaller (the art director).
  platOut: 1.2, platH: SECOND.y, stepsBack: 4.0, colTop: 4.0, liftLen: 2.7, lift: 0.15, crest: 1.7, juzhe: 0.25,
});
/** One gate house, as the outer and the inner gate are laid out: three bays, the platform's flanks meet the walls of the way. A proposal. */
export const GATE = Object.freeze({ xs: Object.freeze([-6.4, -2.2, 2.2, 6.4]), zs: Object.freeze([3, -3]), platOut: 1.2, steps: 3.8, lift: 0.2, liftLen: 2.7, crest: 1.5 });

/** The inner gate's wickets: a door leaf set in a niche in the terrace's south wall, between jambs and under a lintel. A proposal. */
export const WICKET = Object.freeze({ w: 1.5, h: 2.4, jamb: 0.2, lintel: 0.22, depth: 0.25 });
const half = (xs, out) => xs[xs.length - 1] + out;
/** The platforms' footprints, from the numbers above. */
export const FOOT = Object.freeze({
  hall: Object.freeze({ x0: -half(HALL.xs, HALL.platOut), x1: half(HALL.xs, HALL.platOut), z0: AXIS.hallZ - HALL.zs[0] - HALL.platOut, z1: AXIS.hallZ + HALL.zs[0] + HALL.platOut }),
  inner: Object.freeze({ x0: -half(GATE.xs, GATE.platOut), x1: half(GATE.xs, GATE.platOut), z0: AXIS.innerZ - GATE.zs[0] - GATE.platOut, z1: AXIS.innerZ + GATE.zs[0] + GATE.platOut }),
  outer: Object.freeze({ x0: -half(GATE.xs, GATE.platOut), x1: half(GATE.xs, GATE.platOut), z0: AXIS.outerZ - GATE.zs[0] - GATE.platOut, z1: AXIS.outerZ + GATE.zs[0] + GATE.platOut }),
});
/** The paved way down the middle of the way and of the terrace (art director's review of #457: a path, not wall-to-wall slabs; the target picture's is about 6 m) and the tree trunks that stand beside it. A proposal. */
export const PATH = Object.freeze({ hw: 3 });
/** Where the trunks would stand in even pairs: x either side of the path, z along the way (and, on the terrace, clear of the archway's place by 8 m and of the gate's eave). */
const GRID = (() => {
  const lane = [], terrace = [81, 89];
  for (let z = FOOT.inner.z1 + 7.8; z <= FOOT.outer.z0 - 8; z += 9) lane.push(+z.toFixed(1));
  for (let z = 109; z < FOOT.inner.z0 - 6.5; z += 9) terrace.push(z);
  return Object.freeze({ x: 5.5, lane: Object.freeze(lane), terrace: Object.freeze(terrace) });
})();
// A trunk is moved off its grid place by up to 0.8 m along the way and 0.5 m across, takes a radius of 0.25 to 0.5 m, and carries a canopy
// (an ellipsoid, a placeholder for the trees to come); three of them are left out, so that they do not read as a row of telegraph poles
// (art director's review of #464). Seeded, so that every build and every picture is the same.
const seeded = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const OMIT = new Set(["lane|1|2", "lane|-1|4", "terrace|-1|1"]);   // by place along each run
const grow = () => {
  const rnd = seeded(482), out = [];
  for (const [kind, y] of [["lane", 0], ["terrace", SECOND.y]]) for (const [n, z] of GRID[kind].entries()) for (const sx of [-1, 1]) {
    const dz = (rnd() * 2 - 1) * 0.8, dx = (rnd() * 2 - 1) * 0.5, r = 0.25 + rnd() * 0.25, rx = 2.7 + rnd() * 0.9, ry = 2.1 + rnd() * 0.7;
    if (OMIT.has(`${kind}|${sx}|${n}`)) continue;
    // (the two pairs before the hall stand farther out: from cam07 the lines to the Great Hall's ridge ends cross the terrace there at 3 to 4 m off the axis, at the height of a crown)
    const out0 = kind === "terrace" && z < 95 ? 8.5 : GRID.x;
    out.push(Object.freeze({ x: +(sx * (out0 + dx)).toFixed(2), z: +(z + dz).toFixed(2), y, r: +r.toFixed(2), rx: +rx.toFixed(2), ry: +ry.toFixed(2) }));
  }
  return Object.freeze(out);
};
export const TRUNKS = Object.freeze({ h: 11, canopyBase: 7.6, grid: GRID, list: grow() });
/** Half the hall's platform: where the court's south wall meets the hall. */
export const HALL_HALF = FOOT.hall.x1;

/** The monument pavilion's place (月台西; ARCHITECTURE.md §3.2: 4–5 m square, off the 20 m middle way), against the terrace's west parapet. Held, not built. */
export const MONUMENT = Object.freeze({ x0: -18.25, x1: -13.75, z0: 5.65, z1: 10.15, y: 3.0 });
/** The lamp table's place inside the great hall's door (SCOPE-OPTIONS.md (b)): a low table on the floor against the front wall, in the bay east of the three doors. Held, not built. */
export const LAMP = Object.freeze({ x: 11.3, z: -1.2, y: 3.0, w: 1.4, d: 0.6, h: 0.85 });

const FAR = 3000;

/**
 * The slab of a terrace with the platforms of buildings cut out of it: boxes of a given top, whose faces never share a
 * plane with a platform's own.
 */
export function slabAround(rect, holes, top) {
  const zs = [...new Set([rect.z0, rect.z1, ...holes.flatMap((h) => [h.z0, h.z1]).filter((z) => z > rect.z0 && z < rect.z1)])].sort((a, b) => a - b), out = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const za = zs[i], zb = zs[i + 1], zm = (za + zb) / 2;
    let open = [[rect.x0, rect.x1]];
    for (const h of holes) if (zm > h.z0 && zm < h.z1) open = open.flatMap(([a, b]) => (h.x1 <= a || h.x0 >= b ? [[a, b]] : [[a, Math.min(b, h.x0)], [Math.max(a, h.x1), b]])).filter(([a, b]) => b - a > 1e-6);
    for (const [a, b] of open) out.push(box(b - a, top, zb - za, (a + b) / 2, top / 2, zm));
  }
  return out;
}

/**
 * The axis as the site takes it: geometry by material (stone, plaster, steps), the written plan's rectangles, the paving
 * strip of the way, the plain outside the walls, named views, and a group for the two places held.
 * @param {*} M the level's materials
 * @param {{ C: { x: number, zN: number, zS: number, t: number }, W: { x: number, zS: number, wallH: number, t: number } }} at the court's walls and the way's end, which site.js owns
 */
export function buildAxis(M, { C, W }) {
  const stone = [], plaster = [], shade = [[], []];
  const walk = { solids: [], decks: [], ramps: [], posts: [], roofs: [] };
  const top = SECOND.y;

  // A wall between two points, from the ground to h. Plaster on a stone plinth, with the written plan's rectangle (drawn wider by his width).
  const wall = (x0, z0, x1, z1, h, t, into, niches = []) => {
    const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (alongX && niches.length) {
      // A recess in the north face (the terrace's side) for each niche: the wall in full thickness either side and over it, the back part below.
      let a = x0;
      for (const n of [...niches].sort((p, q) => p.x - q.x)) {
        plaster.push(box(n.x - n.w / 2 - a, h, t, (a + n.x - n.w / 2) / 2, h / 2, cz), box(n.w, h - n.top, t, n.x, (n.top + h) / 2, cz), box(n.w, n.top, t - n.depth, n.x, n.top / 2, cz + n.depth / 2));
        a = n.x + n.w / 2;
      }
      plaster.push(box(x1 - a, h, t, (a + x1) / 2, h / 2, cz));
    } else plaster.push(alongX ? box(len, h, t, cx, h / 2, cz) : box(t, h, len, cx, h / 2, cz));
    stone.push(alongX ? box(len + 0.2, 0.35, t + 0.2, cx, 0.175, cz) : box(t + 0.2, 0.35, len + 0.2, cx, 0.175, cz));
    // a coping on the wall's top (art director's review of #457: the wall takes a cap, not bays)
    stone.push(alongX ? box(len + 0.1, 0.16, t + 0.24, cx, h + 0.08, cz) : box(t + 0.24, 0.16, len + 0.1, cx, h + 0.08, cz));
    const r = alongX ? { x0, x1, z0: cz - t / 2, z1: cz + t / 2 } : { x0: cx - t / 2, x1: cx + t / 2, z0, z1 };
    walk.solids.push({ x0: r.x0 - BODY, x1: r.x1 + BODY, z0: r.z0 - BODY, z1: r.z1 + BODY, eyeTop: h + 0.3 });
    shade[into].push(r);
  };
  // ---- The second terrace: the slab, the two platforms cut out of it, and their steps ----
  const T = { x0: -SECOND.hw, x1: SECOND.hw, z0: SECOND.zN, z1: AXIS.innerZ + SECOND.wallT / 2 };
  stone.push(...slabAround(T, [FOOT.hall, FOOT.inner], top));
  walk.decks.push({ ...T, h: top, floor: "stone" });
  // The three buildings (./gates.js): each on its own platform, which the slab is cut round; the hall's back steps lead down into
  // the court, the inner gate's front steps down into the way.
  const sh = buildShells(M, { AXIS, GATE, HALL, FOOT, SECOND, WICKET });
  for (const k of Object.keys(walk)) walk[k].push(...sh.walk[k]);
  shade[0].push(...sh.shade[0]); shade[1].push(...sh.shade[1]);

  // ---- Walls: the terrace's two sides and the stub either side of the gate; the way's two sides; the forecourt's, low, and the wall that closes it ----
  const wt = SECOND.wallT, wh = top + SECOND.wallH, gx = FOOT.inner.x1;
  wall(-SECOND.hw, SECOND.zN, -SECOND.hw, AXIS.innerZ, wh, wt, 0); wall(SECOND.hw, SECOND.zN, SECOND.hw, AXIS.innerZ, wh, wt, 0);
  // (the wickets of the inner gate are niches in these two stubs, ./gates.js fits their doors)
  const wx = (gx + SECOND.hw) / 2, niche = (x) => ({ x, w: WICKET.w + 2 * WICKET.jamb, top: SECOND.y + WICKET.h + WICKET.lintel, depth: WICKET.depth });
  wall(-SECOND.hw - wt / 2, AXIS.innerZ, -gx, AXIS.innerZ, wh, wt, 0, [niche(-wx)]); wall(gx, AXIS.innerZ, SECOND.hw + wt / 2, AXIS.innerZ, wh, wt, 0, [niche(wx)]);
  for (const sx of [-1, 1]) {
    wall(sx * LANE.hw, AXIS.innerZ + wt / 2, sx * LANE.hw, AXIS.outerZ, LANE.h, LANE.t, 1);
    wall(sx * LANE.hw, AXIS.outerZ, sx * LANE.hw, W.zS, W.wallH, W.t, 1);
  }
  wall(-LANE.hw, W.zS, LANE.hw, W.zS, W.wallH, W.t, 1);
  walk.decks.push({ x0: -LANE.hw, x1: LANE.hw, z0: AXIS.innerZ, z1: W.zS, h: 0, floor: "paving" });
  // Only the middle is paved, a path PATH.hw either side of the axis; either side of it the ground is earth (below).
  const paving = [{ level: 1, y: 0.012, x: PATH.hw, zS: W.zS, zN: FOOT.inner.z1 }, { level: 1, y: top + 0.012, x: PATH.hw, zS: FOOT.inner.z0, zN: FOOT.hall.z1 }];
  const earthSides = [], earthAt = (x0, x1, z0, z1, y) => { for (const [a, b] of [[x0, x1], [-x1, -x0]]) earthSides.push(new THREE.PlaneGeometry(b - a, z1 - z0).rotateX(-Math.PI / 2).translate((a + b) / 2, y, (z0 + z1) / 2)); };
  {
    const lx = LANE.hw - LANE.t / 2, tx = SECOND.hw - wt / 2;
    earthAt(PATH.hw, lx, FOOT.inner.z1, FOOT.outer.z0, 0); earthAt(PATH.hw, lx, FOOT.outer.z1, W.zS, 0);
    earthAt(PATH.hw, tx, FOOT.hall.z1, FOOT.inner.z0, top + 0.01);
    earthAt(FOOT.hall.x1, tx, SECOND.zN, FOOT.hall.z1, top + 0.01); earthAt(FOOT.inner.x1, tx, FOOT.inner.z0, AXIS.innerZ - wt / 2, top + 0.01);
  }
  // Trunks stand in the earth either side of the path, for the trees to come: plain posts, in the way, with their written-plan rectangles, and an
  // ellipsoid for each to say how big the tree will be (not in the way: its underside is over six metres up, well above the eye).
  const trunk = [], crown = [];
  for (const t of TRUNKS.list) {
    trunk.push(new THREE.CylinderGeometry(t.r * 0.8, t.r, TRUNKS.h, 8).translate(t.x, t.y + TRUNKS.h / 2, t.z));
    crown.push(new THREE.SphereGeometry(1, 14, 9).scale(t.rx, t.ry, t.rx).translate(t.x, t.y + TRUNKS.canopyBase + t.ry, t.z));
    walk.solids.push({ x0: t.x - t.r - BODY, x1: t.x + t.r + BODY, z0: t.z - t.r - BODY, z1: t.z + t.r + BODY, eyeTop: t.y + TRUNKS.h });
  }

  // ---- The plain outside the walls (the county is flat, SITE.md §4.1): everything but what lies inside them ----
  const cx = C.x + C.t / 2, cn = C.zN - C.t / 2, cs = C.zS + C.t / 2, tx = SECOND.hw + wt / 2, lx = LANE.hw + LANE.t / 2, zT = AXIS.innerZ + wt / 2, ze = W.zS + W.t / 2;
  /** @type {number[][]} x0, x1, z0, z1 */
  const outside = [[-FAR, FAR, -FAR, cn], [-FAR, -cx, cn, cs], [cx, FAR, cn, cs], [-FAR, -tx, cs, zT], [tx, FAR, cs, zT], [-FAR, -lx, zT, ze], [lx, FAR, zT, ze], [-FAR, FAR, ze, FAR]];

  // ---- The two places held: the monument pavilion and the lamp table ----
  const group = new THREE.Group(), M0 = MONUMENT, mx = (M0.x0 + M0.x1) / 2, mz = (M0.z0 + M0.z1) / 2, mw = M0.x1 - M0.x0;
  group.add(sh.group, mesh(merge(earthSides), M.earth, { cast: false }), mesh(merge(trunk), M.bark), mesh(merge(crown), M.cedar, { cast: false }));
  group.add(
    mesh(merge([box(mw, 0.45, mw, mx, M0.y + 0.225, mz)]), M.stone),
    mesh(merge([box(mw - 0.7, 3.4, mw - 0.7, mx, M0.y + 0.45 + 1.7, mz)]), M.plaster()),
    mesh(merge([new THREE.ConeGeometry((mw + 0.5) / Math.SQRT2, 1.9, 4, 1).rotateY(Math.PI / 4).translate(mx, M0.y + 0.45 + 3.4 + 0.95, mz)]), M.tile),
  );
  walk.solids.push({ x0: M0.x0 - BODY, x1: M0.x1 + BODY, z0: M0.z0 - BODY, z1: M0.z1 + BODY, eyeTop: M0.y + 0.45 + 3.4 + 1.9 });
  const L = LAMP, table = mesh(merge([box(L.w, L.h, L.d, L.x, L.y + L.h / 2, L.z)]), M.woodX);
  group.add(table);
  walk.solids.push({ x0: L.x - L.w / 2 - BODY, x1: L.x + L.w / 2 + BODY, z0: L.z - L.d / 2 - BODY, z1: L.z + L.d / 2 + BODY, eyeTop: L.y + L.h });

  // ---- Named places on the axis (shots.js draws each; the floor's bake checks that each can be walked to) ----
  const views = {
    outer: [0, AXIS.outerZ, 0, 0.05],
    inner: [0, AXIS.innerZ, 0, 0.06],
    // cam07, 内山门望殿 (docs/t05/PRD.md §3): in the inner gate's passage, four metres behind its north face (the opening then fills about seven tenths of a wide picture, as the target's does), looking up the axis: the gate's frame round the picture,
    // the archway, the Wuliang hall and over its ridge the Great Hall's roof (the target is refs/t05-concept-2026-11-20/03-axis-from-inner-gate.webp)
    cam07: [0, AXIS.innerZ + 1, 0, 0.15],
    paifang: [0, AXIS.paifangZ, 0, 0.1],
    passage: [0, AXIS.hallZ, 0, 0.08],
    // (mouth: just beyond the foot of the hall's back steps, where its north door lets out on the court)
    mouth: [0, FOOT.hall.z0 - 2.9, 0, 0.12],
  };
  const buildings = [
    ...sh.buildings,
    { name: "碑亭位", x0: M0.x0, x1: M0.x1, z0: M0.z0, z1: M0.z1, y: M0.y },
    { name: "二层高台", ...T, y: 0 },
  ];
  return { stone, plaster, walk, shade, paving, outside, group, views, buildings, closed: sh.closed };
}
