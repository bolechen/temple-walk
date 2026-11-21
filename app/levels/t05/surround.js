// What stands outside the walls of 奉明寺 (T05, docs/t05/PLAN.md item 11, issue #548, step one): the trees of the temple's own ground and
// of the town beside it, and the first row of the town's low roofs. From the court and the way the walls take everything under
// two or three degrees; above them there used to be only sky (the T4 survey of 2026-11-21), so that the temple read as standing in
// a field. The art director's choice is "the county town's low houses and trees" (#548, her comment 7068262688; docs/t05/DECISIONS.md):
// the temple sits inside an old town, and the town stays against its walls (docs/t05/RESEARCH.md §2.2).
//
// The place is flat, so what can show over a wall 3.2 m high from a visitor 20–45 m inside it is only what stands close outside it and
// is tall: a tree, and the ridge of the first house. Seen from the platform (4.3 m up) the horizon lies open and these read as a band
// of trees and roofs along it. (The farther roofs and the tower of the old town are the second step, not built here.)
//
// All of it is white-box geometry in this level's own build: nothing here goes through trees.js (the prologue's trees), nothing is
// walked on or into (`userData.walk = false`: the bake leaves it out, and it stands outside the walls where nothing is walked),
// and nothing is a place held for anything. The row nearest each wall is drawn as real trees that cast shadows into the sun's map:
// the base light is a morning at 17° with its shadows lying to the north-north-west, so that a tree 10 m high just outside the east or
// the south wall lays its shadow 30 m across the court, which is what makes the low sun read (the art director's third point).
//
// Sizes: a pine or cypress 7–11 m, a bare broadleaf 6–10 m (the base season is winter: branches and no leaves), a house one storey with eaves at about
// 3 m and a ridge of 4.2–5 m for the first two rows. Every number is ours (SOURCES.md §15): there is no outline of the town round the
// temple and nothing was measured. Seeded, so that every build and every picture is the same.
import * as THREE from "three";
import { box, merge, mesh } from "../../src/geo.js";
import { SECOND, LANE, AXIS } from "./axis.js";
import { HALL } from "./hall.js";

/** The eave line of the great hall (above the court's paving) and the ceilings the art director set (#548, her comment on the plan). */
export const LIMITS = Object.freeze({
  eave: HALL.eave,          // nothing outside rises over the great hall's eaves
  nearHall: 10,             // outside the east and west walls south of z = +15 ... the whole stretch beside the hall, the trees stand no higher than this
  nearHallZ: 15,
  firstRows: 5,             // the ridges of the first two rows of houses
  tower: { bearing: 241, from: [0, 8], wide: 4, max: 5 },   // on the line from the platform to the pagoda of the old town, nothing over 5 m (the tower is the second step; the gap is kept for it)
});

const seeded = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ground = 0.06;
/**
 * The two pictures the great hall's roof is kept clean in (cam01 and cam07, #548: nothing outside rises over its eave line): where the eye stands, how high it is over the
 * court's paving, and how wide the picture is (the page's first-person lens, 52° over 16:9, is 41° each side).
 */
export const EAVE_EYES = Object.freeze([Object.freeze({ id: "cam01", x: 0, z: 44, y: 1.3 }), Object.freeze({ id: "cam07", x: 0, z: AXIS.innerZ + 1, y: SECOND.y + 1.6 })]);
/**
 * The tallest a thing may be at (x, z) so that, seen from either of those eyes, its top is no higher in the picture than the eave line (the front eave's line
 * carried across the picture): the elevation of its top no more than the eave's at the same bearing. Only where it is in front of the eye and inside the picture.
 */
export const eaveCap = (x, z, margin = 0.1) => {
  let cap = Infinity;
  for (const e of EAVE_EYES) {
    const ahead = e.z - z; if (ahead < 2 || Math.abs(Math.atan2(x - e.x, ahead)) > (44 * Math.PI) / 180) continue;
    cap = Math.min(cap, e.y + (ahead * (HALL.eave - e.y)) / (e.z - HALL.overhang) - margin - ground);
  }
  return cap;
};   // the plain is laid a little above y = 0 (site.js `lift`)

/** Is the line from the platform to the old town's pagoda (bearing 241°, west-south-west) through here? */
const onTowerLine = (x, z, pad = 0) => {
  const T = LIMITS.tower, dx = x - T.from[0], dz = z - T.from[1], d = Math.hypot(dx, dz);
  if (d < 1) return false;
  let b = (Math.atan2(dx, -dz) * 180) / Math.PI; if (b < 0) b += 360;   // a bearing from north, clockwise (north is -z)
  return Math.abs(b - T.bearing) * (Math.PI / 180) * d < pad + d * Math.tan((T.wide * Math.PI) / 180);
};

/**
 * The trees and houses, as data: { kind: "pine" | "bare", x, z, h, r, row } and { x, z, w, d, alongX, eave, ridge, row }.
 * Each zone is a strip outside a wall laid out as a few rows at uneven spacing, not a line of poles (#464, #482: a row of the same
 * thing is read as a fence). `row` 0 is the one against the wall: real, shadow-casting geometry.
 */
function plan(C) {
  let rnd = seeded(548), side = 0; const trees = [], houses = [], cx = C.x + C.t / 2, cs = C.zS + C.t / 2, lx = LANE.hw + LANE.t / 2;
  const pick = (a, b) => a + rnd() * (b - a);
  // a tree's height by kind and by where it stands (the stretch beside the hall is capped, the line to the pagoda kept low)
  const tree = (x, z, row, opts = {}) => {
    const kind = opts.kind || (rnd() < (opts.pine ?? 0.55) ? "pine" : "bare");
    let h = opts.h ?? (kind === "pine" ? pick(8, 11) : pick(7, 10));
    if (Math.abs(x) > cx && z < LIMITS.nearHallZ + 1 && z > C.zN - 8) h = Math.min(h, LIMITS.nearHall - 0.5 * rnd());
    if (onTowerLine(x, z, 2)) h = Math.min(h, LIMITS.tower.max - 0.2 - 0.3 * rnd());
    h = Math.min(h, LIMITS.eave - 0.8, eaveCap(x, z));
    if (opts.full) h *= 0.95 + 0.05 * rnd();   // (the cypresses of the rows kept low stand at 95-100% of what is allowed, not along a ruled line)
    trees.push(Object.freeze({ kind, x: +x.toFixed(2), z: +z.toFixed(2), h: +h.toFixed(2), r: +(h * pick(0.032, 0.042)).toFixed(2), row, yaw: +(rnd() * Math.PI * 2).toFixed(2), full: !!opts.full }));
  };
  // a house: eaves at 3 m, a gable roof, the ridge along x or along z
  const house = (x, z, row) => {
    const w = pick(6, 10), d = pick(5, 7.5), ridge = Math.min(pick(4.2, LIMITS.firstRows), eaveCap(x, z)), alongX = rnd() < 0.5;
    const hw = alongX ? w : d, hd = alongX ? d : w;
    for (let k = 0; k < 30 && withinWalls(C, x, z, 2 + hw / 2, 2 + hd / 2); k++) x += Math.sign(x || 1) * 0.5;   // (moved out until its eaves are two metres clear of every wall)
    houses.push(Object.freeze({ x: +x.toFixed(2), z: +z.toFixed(2), w: +(alongX ? w : d).toFixed(2), d: +(alongX ? d : w).toFixed(2), alongX, eave: 3, ridge: +ridge.toFixed(2), row }));
  };
  const run = (from, to, gap, place) => { rnd = seeded(548 + Math.round(from * 13 + to * 7 + gap * 101 + side * 977));   // (each strip has its own stream, from where it lies, so that tuning one does not move the others)
    for (let s = from + rnd() * gap * 0.5; s < to; s += gap * (0.7 + rnd() * 0.6)) place(s); };
  for (const sx of [-1, 1]) {
    side = sx;
    // east and west of the court, along its whole side
    run(C.zN - 2, cs + 2, sx < 0 ? 4.0 : 4.8, (z) => tree(sx * (cx + 1.6 + rnd() * 3), z, 0, { pine: 0.8 }));
    run(C.zN, cs + 4, sx < 0 ? 4.8 : 6.2, (z) => tree(sx * (cx + 8 + rnd() * 5), z, 1, { pine: 0.7 }));
    run(C.zN, cs, 9, (z) => house(sx * (cx + 20 + rnd() * 4), z, 0));
    run(C.zN, cs, 13, (z) => house(sx * (cx + 32 + rnd() * 6), z, 1));
    // south of the court's south wall, beside the terrace
    run(SECOND.hw + 2.5, cx + 18, 2.9, (a) => tree(sx * a, cs + 1.6 + rnd() * 3, 0, { pine: 0.9, full: true }));
    run(SECOND.hw + 4, cx + 22, 3.3, (a) => tree(sx * a, cs + 8 + rnd() * 5, 1, { pine: 0.9, full: true }));
    run(SECOND.hw + 6, cx + 26, 3.7, (a) => tree(sx * a, cs + 15 + rnd() * 5, 1, { pine: 0.9, full: true }));
    run(SECOND.hw + 4, cx + 18, 11, (a) => house(sx * a, cs + 16 + rnd() * 4, 0));
    // beside the terrace and the way (the arrival looks east and west along these)
    run(cs + 12, 224, sx > 0 ? 13 : 9, (z) => tree(sx * (Math.max(SECOND.hw, lx) + 1.8 + rnd() * 3), z, z < 140 ? 1 : 0, { pine: 0.5 }));
    run(cs + 22, 224, sx > 0 ? 17 : 12, (z) => tree(sx * (lx + 8 + rnd() * 6), z, 1, { pine: 0.4 }));
    run(cs + 24, 222, sx > 0 ? 16 : 12, (z) => house(sx * (lx + 14 + rnd() * 5), z, 0));
    run(cs + 30, 222, 14, (z) => house(sx * (lx + 27 + rnd() * 6), z, 1));
  }
  // beyond the way's end, to the south of the arrival
  run(-40, 40, 26, (x) => tree(x, 226 + rnd() * 4, 0, { pine: 0.4 }));
  run(-44, 44, 28, (x) => tree(x, 236 + rnd() * 6, 1, { pine: 0.3 }));
  run(-40, 40, 26, (x) => house(x, 246 + rnd() * 4, 0));
  run(-46, 46, 22, (x) => house(x, 258 + rnd() * 6, 1));
  // no tree grows through a house: those within a metre and a half of a footprint are dropped
  const free = trees.filter((t) => !houses.some((h) => Math.abs(t.x - h.x) < h.w / 2 + 1.5 && Math.abs(t.z - h.z) < h.d / 2 + 1.5));
  return { trees: free, houses };
}
/**
 * Is (x, z), with room `pad` across and `pz` along, inside the walls or against them: the court's, the terrace's (to the inner gate), the way's (to its end)?
 * Nothing of the surround may stand there.
 */
export function withinWalls(C, x, z, pad, pz = pad) {
  const lx = LANE.hw + LANE.t / 2, cx = C.x + C.t / 2, cs = C.zS + C.t / 2;
  return (Math.abs(x) < cx + pad && z > C.zN - C.t / 2 - pz && z < cs + pz) || (z >= cs && z < 144.2 + pz && Math.abs(x) < SECOND.hw + 0.4 + pad) || (z >= 144 && z < 222 + pz && Math.abs(x) < lx + pad);
}

const memo = new WeakMap();
/** The plan for the compound `C` (site.js COMPOUND: x, zN, zS, t), made once. */
export const planSurround = (C) => memo.get(C) || memo.set(C, (() => { const p = plan(C); return Object.freeze({ trees: Object.freeze(p.trees), houses: Object.freeze(p.houses) }); })()).get(C);

// ---- geometry ----
const cone = (r, h, y, x, z, seg = 9) => new THREE.ConeGeometry(r, h, seg).translate(x, y + h / 2, z);
/** A pine or cypress: a trunk and four layers of needles with sky between them (the layers overlap little, so that a ray through a crown meets two or three of them, not a solid). */
function pine(t, trunk, crown) {
  const { x, z, h, r } = t, y0 = ground, tr = h * 0.6;
  trunk.push(new THREE.CylinderGeometry(r * 0.7, r, tr, 7).translate(x, y0 + tr / 2, z));
  if (t.full) {
    // a columnar cypress (the old cypresses of a temple court): one long narrowing drum with a tip, not the pine's stacked cones. It stays low (the great hall's eave
    // line is the ceiling in the pictures that keep the roof clean) and it fills the band that a pine would leave to its thin tip; seen against the sky it is a dark pencil.
    const R = h * (0.28 + 0.04 * ((Math.abs(Math.round(x * 7 + z * 3)) % 7) / 6)), hd = h * 0.8;   // (the girth changes a little from tree to tree, from where it stands)
    crown.push(new THREE.CylinderGeometry(R * 0.72, R, hd, 8).translate(x, y0 + h * 0.12 + hd / 2, z), cone(R * 0.72, h * 0.08, y0 + h * 0.12 + hd, x, z, 8));
    return;
  }
  const layers = 4, R = h * 0.2;
  for (let i = 0; i < layers; i++) {
    const y = y0 + h * (0.28 + 0.2 * i), hl = h * 0.27 * (1 - 0.1 * i), rl = R * (1 - 0.22 * i) * (0.9 + 0.2 * ((i * 7 + Math.round(x)) % 3) / 3);
    crown.push(cone(rl, hl, y, x, z));
  }
}
/** A bare broadleaf, in winter: a trunk, a crown of branches that fork twice, no leaves. Rays between the branches meet nothing. */
function bare(t, trunk) {
  const { x, z, h, r, yaw } = t, y0 = ground, tr = h * 0.45;
  trunk.push(new THREE.CylinderGeometry(r * 0.6, r, tr, 7).translate(x, y0 + tr / 2, z));
  const spread = (a, b, k) => ((Math.sin((x + 3) * 12.9 + (z + 1) * 7.3 + k * 4.1) * 43758.5453) % 1 + 1) % 1 * (b - a) + a;
  const limb = (px, py, pz, len, ax, ay, rr, depth, k) => {   // from (px, py, pz) outward and upward at angle ax from vertical, around ay
    const dx = Math.sin(ax) * Math.cos(ay), dy = Math.cos(ax), dz = Math.sin(ax) * Math.sin(ay), ex = px + dx * len, ey = py + dy * len, ez = pz + dz * len;
    const g = new THREE.CylinderGeometry(rr * 0.55, rr, len, 3, 1, true); g.translate(0, len / 2, 0);   // (a three-sided limb, open at its ends: a branch is seen from far off)
    g.rotateZ(-ax); g.rotateY(-ay); g.translate(px, py, pz); trunk.push(g);
    if (depth > 0) for (let j = 0; j < 2; j++) limb(ex, ey, ez, len * 0.68, ax + spread(0.25, 0.7, k + j), ay + (j ? 1 : -1) * spread(0.6, 1.5, k * 3 + j), rr * 0.62, depth - 1, k + 7 + j);
  };
  const top = y0 + tr, n = 5;   // (the row against the wall forks twice, the rest once)
  for (let i = 0; i < n; i++) limb(x, top - (i % 2) * 0.6, z, h * 0.3, spread(0.35, 0.7, i), yaw + (i / n) * Math.PI * 2, r * 0.55, t.row === 0 ? 2 : 1, i * 11);
}
/** A house of one storey: plaster walls to the eaves, a gable roof of grey tile with its ridge along x or z; the eaves stand 0.5 m out. */
function house(hs, walls, roofs) {
  const { x, z, w, d, eave, ridge, alongX } = hs, y0 = ground, over = 0.5;
  walls.push(box(w - 0.4, eave, d - 0.4, x, y0 + eave / 2, z));
  const rise = ridge - eave, run = (alongX ? d : w) / 2 + over, len = (alongX ? w : d) + 2 * over;
  const shape = new THREE.Shape(); shape.moveTo(-run, 0); shape.lineTo(run, 0); shape.lineTo(0, rise); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
  if (alongX) g.rotateY(Math.PI / 2);   // the extrusion's length now along x, the gable's section across z
  g.translate(x, y0 + eave, z); roofs.push(g);
}

/**
 * The surround as a group for the site's root. Every mesh carries `userData.surround` ("near": the row drawn as real, shadow-casting trees and houses;
 * "far": the rest) and `userData.walk = false`.
 * @param {*} M the level's materials @param {{ x: number, zN: number, zS: number, t: number }} C the compound's walls
 */
export function buildSurround(M, C) {
  const PLAN = planSurround(C), group = new THREE.Group(), near = { trunk: [], crown: [], walls: [], roofs: [] }, far = { trunk: [], crown: [], walls: [], roofs: [] };
  for (const t of PLAN.trees) { const into = t.row === 0 ? near : far; t.kind === "pine" ? pine(t, into.trunk, into.crown) : bare(t, into.trunk); }
  for (const h of PLAN.houses) house(h, (h.row === 0 ? near : far).walls, (h.row === 0 ? near : far).roofs);
  const add = (set, name, cast) => {
    for (const [key, material] of [["trunk", M.bark], ["crown", M.cedar], ["walls", M.plaster()], ["roofs", M.tile]]) {
      if (!set[key].length) continue;
      const m = mesh(merge(set[key]), material, { cast: cast && key !== "walls" ? true : cast }); m.userData.surround = name; m.userData.walk = false; m.name = `surround-${name}-${key}`; group.add(m);
    }
  };
  add(near, "near", true); add(far, "far", false);
  return group;
}
