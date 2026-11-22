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

/** The ceilings the art director set (#548: her comments 7068262688 and 7069444907) and the great hall's eave line. */
export const LIMITS = Object.freeze({
  eave: HALL.eave,          // the great hall's eave line: kept in cam01's picture, and in cam07's within `axisBearing` of the axis
  axisBearing: 12,          // degrees: in cam07 the hall's roof stands within this either side of the axis; outside it the trees are free of the eave line (the art director, 2nd round)
  treeMax: 13,              // and no tree is higher than this
  nearHall: 10,             // outside the east and west walls south of z = +15 ... the whole stretch beside the hall, the trees stand no higher than this
  nearHallZ: 15,
  ridgeMax: 6.3,            // a house's ridge (5 to 6.3 m; eaves at 3 m)
  firstRows: 5,             // but on the line to the pagoda the ridges of the first two rows stand no higher than this
  houseGap: [3, 6],         // the first row of houses stands 3 to 6 m outside the wall's outer face (the art director: at 4 m a 3 m eave is just at the wall top, 2.2° up, and the roof's slope shows over it)
  tower: { bearing: 241, from: [0, 8], wide: 4, max: 5 },   // on the line from the platform to the pagoda of the old town, trees and ridges stay at 5 m or lower (the tower is the second step; the gap is kept for it)
  spacing: [4, 14],         // between neighbouring trees of a row, metres; heights differ by 20% or more; no more than three of a kind in a row
});

/** One number for the whole layout: a different one lays out the same rules differently (picked once, by trying, until every limit in tests/unit/t05-surround.test.mjs held with room to spare). */
const SEED = 0;
const SSEED = 7;   // the south side's own seed: the one the art director passed (docs/t05/DECISIONS.md); it was first chosen among 12 for the A and B roof-slope numbers, and the ceiling on the houses' share has since been widened to 65%, so a seed can now be chosen by the picture
const seeded = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ground = 0.06;   // the plain is laid a little above y = 0 (site.js `lift`)
/**
 * The two pictures the great hall's roof is kept clean in: where the eye stands, how high it is over the court's paving. In cam01 nothing seen rises over the eave line; in
 * cam07 the same within `within` degrees of the axis (the hall's roof stands inside 11° there; the rows beside the terrace and the south wall are outside it and free).
 */
export const EAVE_EYES = Object.freeze([Object.freeze({ id: "cam01", x: 0, z: 44, y: 1.3, within: 44 }), Object.freeze({ id: "cam07", x: 0, z: AXIS.innerZ + 1, y: SECOND.y + 1.6, within: LIMITS.axisBearing })]);
/**
 * The tallest a thing may be at (x, z) so that, seen from either of those eyes, its top is no higher in the picture than the eave line (the front eave's line carried across
 * the picture): the elevation of its top no more than the eave's at the same bearing. Only where it is in front of the eye and within that eye's `within`.
 */
export const eaveCap = (x, z, margin = 0.1) => {
  let cap = Infinity;
  for (const e of EAVE_EYES) {
    const ahead = e.z - z; if (ahead < 2 || Math.abs(Math.atan2(x - e.x, ahead)) > (e.within * Math.PI) / 180) continue;
    cap = Math.min(cap, e.y + (ahead * (HALL.eave - e.y)) / (e.z - HALL.overhang) - margin - ground);
  }
  return cap;
};

/** Is the line from the platform to the old town's pagoda (bearing 241°, west-south-west) through here? */
export const onTowerLine = (x, z, pad = 0) => {
  const T = LIMITS.tower, dx = x - T.from[0], dz = z - T.from[1], d = Math.hypot(dx, dz);
  if (d < 1) return false;
  let b = (Math.atan2(dx, -dz) * 180) / Math.PI; if (b < 0) b += 360;   // a bearing from north, clockwise (north is -z)
  return Math.abs(b - T.bearing) * (Math.PI / 180) * d < pad + d * Math.tan((T.wide * Math.PI) / 180);
};

/**
 * A number in [0, 1) from where a house stands (a hash, not the seeded stream: taking numbers from the stream would move every house the art director passed).
 * `salt` keeps the two uses (which shape, which tile) apart.
 */
const hash01 = (x, z, salt) => { const v = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453; return v - Math.floor(v); };
/** The roof's shape: the gable roof is the town's common one; a few of the middling houses are hipped (four slopes), a few of the narrow ones lean (one slope). Ours (SOURCES.md §15), not read from anywhere. */
export const ROOF_SHARE = Object.freeze({ hip: 0.22, shed: 0.8 });   // by the hash: under `hip` and the house at least 6 m each way, hipped; a narrow house (7 m or less across, ridge 5.3 or lower) with the other hash over `shed`, one slope
const roofOf = (x, z, w, d, ridge, where) => {
  const u = hash01(x, z, 1);
  if (u < ROOF_SHARE.hip && Math.min(w, d) >= 6) return "hip";
  if (where !== "end" && ridge <= 5.3 && Math.min(w, d) <= 7 && hash01(x, z, 3) > ROOF_SHARE.shed) return "shed";
  return "gable";
};
/** Three tones of tile: the old, dark one, the grey one (the base), and the newer, paler one. By the hash, about three in ten, five in ten, two in ten. */
export const TILE_TONES = Object.freeze([{ name: "old", mul: 0.66, share: 0.3 }, { name: "grey", mul: 1, share: 0.5 }, { name: "pale", mul: 1.8, share: 0.2 }]);
const toneOf = (x, z) => { const u = hash01(x, z, 2); return u < TILE_TONES[0].share ? 0 : u < TILE_TONES[0].share + TILE_TONES[1].share ? 1 : 2; };
/**
 * The trees and houses, as data: { kind: "pine" | "cypress" | "bare", x, z, h, r, row, cast, strip, along } and { x, z, w, d, alongX, eave, ridge, row, cast }.
 * `strip` names the row of trees a tree belongs to and `along` where on it (what the tests of its spacing, heights and kinds sort by). Seeded per strip from where it lies, so that tuning one does not move the others.
 * Trees of a kind: the pine (油松) has a bare lower trunk and two to four flat layers with a flat top; the cypress is a narrow flame; the broadleaf is bare in winter.
 */
function plan(C) {
  let rnd = seeded(548), side = 0, id = ""; const trees = [], houses = [], cx = C.x + C.t / 2, cs = C.zS + C.t / 2, lx = LANE.hw + LANE.t / 2, L = LIMITS;
  const pick = (a, b) => a + rnd() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const state = new Map();   // per strip: the last height, the last kind and how many of it in a row
  const nearWall = (x, z) => Math.min(Math.abs(x) - cx > -1 && z < cs + 1 ? Math.abs(x) - cx : Infinity, z - cs > -1 && Math.abs(x) < cx + 14 ? z - cs : Infinity);   // how far outside the court's walls
  const overlapsHouse = (x, z, pad) => houses.some((h) => Math.abs(x - h.x) < h.w / 2 + pad && Math.abs(z - h.z) < h.d / 2 + pad);
  /** One tree: its kind and height are chosen so that it differs from the one before it on its strip (by 20% in height; never a fourth of a kind in a row). */
  const tree = (x, z, along, mix = [0.45, 0.25], row = 1, clump = -1) => {
    const st = state.get(id) || state.set(id, { h: 0, kind: "", n: 0 }).get(id), r0 = rnd();
    let kind = r0 < mix[0] ? "pine" : r0 < mix[0] + mix[1] ? "cypress" : "bare";
    if (kind === st.kind && st.n >= 3) kind = ["pine", "cypress", "bare"].find((k) => k !== st.kind && (k !== "cypress" || mix[1] > 0)) || "bare";
    let cap = /** @type {number} */ (L.treeMax);
    if (Math.abs(x) > cx && z < L.nearHallZ + 1 && z > C.zN - 8) cap = Math.min(cap, L.nearHall - 0.4 * rnd());
    if (onTowerLine(x, z, 2)) cap = Math.min(cap, L.tower.max - 0.2 - 0.3 * rnd());
    cap = Math.min(cap, eaveCap(x, z));
    let h = Math.min(cap, kind === "pine" ? pick(8.5, 12.5) : kind === "cypress" ? pick(9, 13) : pick(7, 10.5));
    if (st.h && Math.abs(h - st.h) / Math.max(h, st.h) < 0.2) {   // too like its neighbour: lower or raise it, as the ceiling allows
      const down = st.h * 0.76, up = st.h * 1.3;
      h = up <= cap ? up : down >= 3.2 ? down : h;
    }
    h = clamp(h, 3.2, cap);
    st.n = kind === st.kind ? st.n + 1 : 1; st.kind = kind; st.h = h;
    trees.push(Object.freeze({ kind, x: +x.toFixed(2), z: +z.toFixed(2), h: +h.toFixed(2), r: +(h * pick(0.032, 0.042)).toFixed(2), row, cast: nearWall(x, z) <= 14, strip: id, clump, along: +along.toFixed(2), yaw: +(rnd() * Math.PI * 2).toFixed(2) }));
  };
  /** A house of one storey: eaves at 3 m, a gable roof, ridge 5 to 6.3 m (5 or lower in the first two rows on the line to the pagoda), the ridge along x or along z. Its centre is given. */
  const makeHouse = (cxh, czh, alongX, w, d, row, ridgeTo, where, ridgeFrom = 5) => {
    const onLine = onTowerLine(cxh, czh, Math.max(w, d) / 2), top = onLine ? L.firstRows : ridgeTo;
    const ridge = +clamp(pick(ridgeFrom, ridgeTo), 3.8, top).toFixed(2), hx = +cxh.toFixed(2), hz = +czh.toFixed(2);
    houses.push(Object.freeze({ x: hx, z: hz, w: +w.toFixed(2), d: +d.toFixed(2), alongX, eave: 3, ridge, row, cast: row === 0, where, roof: roofOf(hx, hz, w, d, ridge, where), tone: toneOf(hx, hz) }));
  };
  const dims = () => { const long = pick(6.5, 10.5), short = pick(5, 7.5), alongX = rnd() < 0.5; return { alongX, w: alongX ? long : short, d: alongX ? short : long }; };
  /** A house along a wall: 6 to 9 m deep from it, 6 to 8.5 m along it (narrow enough that four or five show in a picture), the ridge running either way. `acrossX`: the wall runs along z. */
  const wallDims = (acrossX) => { const deep = pick(6, 9), along = pick(6, 8.5), alongX = rnd() < 0.5; return acrossX ? { alongX, w: deep, d: along } : { alongX, w: along, d: deep }; };
  /** The south side's houses (the art director, step two: not a row of tents the same size): small sheds, middling houses and long ones, the ridge along the wall or across it, each class with its own ridge heights. */
  const southDims = () => {
    const r = rnd(), alongX = rnd() < 0.6; let along, deep, ridge;
    if (r < 0.28) { along = pick(4.2, 6); deep = pick(4, 5.5); ridge = [3.8, 4.7]; }
    else if (r < 0.72) { along = pick(6.5, 9.5); deep = pick(5.5, 8); ridge = [4.8, 5.8]; }
    else { along = pick(10.5, 15); deep = pick(6, 8.5); ridge = [5.5, 6.3]; }
    return alongX ? { alongX, w: along, d: deep, ridge } : { alongX, w: deep, d: along, ridge };
  };
  /** A row of houses along a wall, each its own distance (3 to 6 m) from the wall's outer face, with a gap of 2 to 8 m between: `across(g, hx, hz)` and `along(cursor, ext)` give the centre. */
  const houseRow = (from, to, place, row, gapRange, ridgeTo, where, dim = dims) => {
    const made = []; let cur = from + rnd() * 2;
    while (cur < to) {
      const { alongX, w, d, ridge } = dim(), g = pick(...L.houseGap);
      const [px, pz, ext] = place(cur, g, w, d);
      if (overlapsHouse(px, pz, 1) || (row === 0 && withinWalls(C, px, pz, 0.6 + w / 2, 0.6 + d / 2))) { cur += 3; continue; }
      makeHouse(px, pz, alongX, w, d, row, ridge ? ridge[1] : ridgeTo, where, ridge ? ridge[0] : 5); made.push(houses.at(-1));
      cur += ext + pick(...gapRange);
    }
    return made;
  };
  const stripRun = (name, from, to, step, place) => {   // trees along a strip, 4 to 14 m apart: each next one a step on from the last, moved on along the strip (up to 8 m) where a house is in the way
    id = name; rnd = seeded(548 + SEED + Math.round(from * 13 + to * 7 + step[0] * 101 + side * 977 + name.length * 31));
    for (let s = from + rnd() * step[0]; s < to;) {
      let at = s, ok = false;
      for (let k = 0; k <= 16 && !ok; k++) { at = s + k * 0.5; const [px, pz] = place(at); ok = !overlapsHouse(px, pz, 1.2); }
      if (!ok) { s += step[1]; continue; }
      const [qx, qz] = place(at); tree(qx, qz, at, undefined, 1);
      s = at + clamp(pick(...step), L.spacing[0], 6.5);
    }
  };
  for (const sx of [-1, 1]) {
    side = sx;
    // ---- east and west of the court: the first row of houses 3 to 6 m off the wall, a second row far out, then the trees: between the houses and behind them ----
    rnd = seeded(5480 + SEED + sx * 17);
    const ew0 = houseRow(C.zN - 3, cs + 3, (cur, g, hx, hz) => [sx * (cx + g + hx / 2), cur + hz / 2, hz], 0, [7, 12], L.ridgeMax, "ew", () => wallDims(true));
    rnd = seeded(5482 + SEED + sx * 17);
    houseRow(C.zN, cs + 4, (cur, g, hx, hz) => [sx * (cx + 34 + pick(0, 6) + hx / 2), cur + hz / 2, hz], 1, [14, 30], L.ridgeMax, "ew");
    // ---- south of the court's south wall, beside the terrace ----
    rnd = seeded(5483 + SEED + SSEED + sx * 17);
    const s0 = houseRow(SECOND.hw + 3.2, cx + 24, (cur, g, hx, hz) => [sx * (cur + hx / 2), cs + g + hz / 2, hx], 0, [2, 13], L.ridgeMax, "s", southDims);
    rnd = seeded(5485 + SEED + sx * 17);
    houseRow(SECOND.hw + 5, cx + 26, (cur, g, hx, hz) => [sx * (cur + hx / 2), cs + 34 + pick(0, 6) + hz / 2, hx], 1, [14, 30], L.ridgeMax, "s");
    // ---- beside the terrace and the way: the arrival looks east and west along these (kept as the art director passed them) ----
    const laneHouses = (from, to, gap, off, row) => { rnd = seeded(548 + Math.round(from * 13 + to * 7 + gap * 101 + sx * 977 + 3)); for (let z = from + rnd() * gap * 0.5; z < to; z += gap * (0.7 + rnd() * 0.6)) { const { alongX, w, d } = dims(); let x = sx * (lx + off + rnd() * 5); for (let k = 0; k < 30 && withinWalls(C, x, z, 2 + (alongX ? w : d) / 2, 2 + (alongX ? d : w) / 2); k++) x += sx * 0.5; makeHouse(x, z, alongX, w, d, row, 5, "lane"); } };
    laneHouses(cs + 24, 222, sx > 0 ? 16 : 15, 14, 0); laneHouses(cs + 30, 222, 14, 27, 1);
    // the trees between the houses, where there is room for a trunk (the front of the row, against the wall)
    id = `ew${sx}-between`; rnd = seeded(5481 + SEED + sx * 17);
    for (let k = 0; k + 1 < ew0.length; k++) { const a = ew0[k], b = ew0[k + 1], z0 = a.z + a.d / 2, z1 = b.z - b.d / 2; if (z1 - z0 >= 3.5 && rnd() < 0.7) tree(sx * (cx + pick(3.2, 5.2)), (z0 + z1) / 2, (z0 + z1) / 2, [0.4, 0.35], 0); }
    stripRun(`ew${sx}-behind1`, C.zN - 2, cs + 4, [5, 9], (z) => [sx * (cx + 17.5 + ((z * 7) % 3) * 1.2), z]);
    stripRun(`ew${sx}-behind2`, C.zN, cs + 6, [4.5, 8], (z) => [sx * (cx + 25.5 + ((z * 5) % 4) * 1.4), z]);
    // the south side's trees stand in groves of two to four, a grove two rows deep, with 15 to 25 m of roofs and no tree between one and the next (the art director, step two; docs/t05/DECISIONS.md)
    rnd = seeded(5486 + SEED + SSEED + sx * 17);
    for (let at0 = SECOND.hw + 2.5 + pick(0, 8), gid = 1; at0 < cx + 26; gid++) {
      const n = 2 + Math.floor(rnd() * 3), xs = []; let at = at0;
      for (let k = 0; k < n; k++) { xs.push(at); at += pick(3.2, 5.2); }
      for (const { name, zoff, jit } of [{ name: `s${sx}-behind1`, zoff: 17.5, jit: 1.2 }, { name: `s${sx}-behind2`, zoff: 25.5, jit: 1.4 }]) {
        id = name;
        for (const a of xs) {
          for (let k = 0; k < 5; k++) { const px = sx * (a + (k ? 0 : (name.endsWith("2") ? pick(-1.5, 1.5) : 0))), pz = cs + zoff + pick(-jit, jit) + k * 3; if (!overlapsHouse(px, pz, 1.2)) { tree(px, pz, a, undefined, 1, gid); break; } }
        }
      }
      at0 = xs.at(-1) + pick(15, 25);
    }
    const lane = (name, from, to, gap, place, mix) => { id = name; rnd = seeded(548 + Math.round(from * 13 + to * 7 + gap * 101 + sx * 977)); for (let s = from + rnd() * gap * 0.5; s < to; s += gap * (0.7 + rnd() * 0.6)) { const [px, pz, row] = place(s); if (!overlapsHouse(px, pz, 1.2)) tree(px, pz, s, mix, row); } };
    lane(`lane${sx}-a`, cs + 12, 224, sx > 0 ? 13 : 11, (z) => [sx * (Math.max(SECOND.hw, lx) + 1.8 + rnd() * 3), z, z < 140 ? 1 : 0], [0.5, 0.2]);
    lane(`lane${sx}-b`, cs + 22, 224, sx > 0 ? 17 : 15, (z) => [sx * (lx + 8 + rnd() * 6), z, 1], [0.4, 0.2]);
  }
  // ---- beyond the way's end, to the south of the arrival ----
  side = 0;
  for (const [from, to, gap, z0, zr, row] of [[-40, 40, 26, 246, 4, 0], [-46, 46, 22, 258, 6, 1]]) { rnd = seeded(548 + Math.round(from * 13 + to * 7 + gap * 101 + 3)); for (let x = from + rnd() * gap * 0.5; x < to; x += gap * (0.7 + rnd() * 0.6)) { const { alongX, w, d } = dims(); makeHouse(x, z0 + rnd() * zr, alongX, w, d, row, 5, "end"); } }
  { id = "end-a"; rnd = seeded(548 + Math.round(-40 * 13 + 40 * 7 + 26 * 101)); for (let x = -40 + rnd() * 13; x < 40; x += 26 * (0.7 + rnd() * 0.6)) { const z = 226 + rnd() * 4; if (!overlapsHouse(x, z, 1.2)) tree(x, z, x, [0.4, 0.2], 0); } }
  { id = "end-b"; rnd = seeded(548 + Math.round(-44 * 13 + 44 * 7 + 28 * 101)); for (let x = -44 + rnd() * 14; x < 44; x += 28 * (0.7 + rnd() * 0.6)) { const z = 236 + rnd() * 6; if (!overlapsHouse(x, z, 1.2)) tree(x, z, x, [0.3, 0.2], 1); } }
  return { trees, houses };
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
const squash = (rx, ry, rz, x, y, z) => new THREE.SphereGeometry(1, 8, 5).scale(rx, ry, rz).translate(x, y, z);
/**
 * A Chinese pine (油松): a bare trunk for the lower half, and above it two to four flat layers of needles, each a pressed ellipsoid a little off the last, the top one the flattest:
 * a flat-topped crown with sky between its layers, not a stack of cones (the art director, 2nd round: cones read as spruce and Christmas trees).
 */
function pine(t, trunk, crown) {
  const { x, z, h, r, yaw } = t, y0 = ground, n = 2 + (Math.abs(Math.round(x * 3 + z)) % 3);   // 2, 3 or 4 layers, by where it stands
  // The layers sit one on the next from the top down, the second the widest (an old 油松 is an umbrella with a flat top, not a tower), each pushed to one side so that the outline is not even; a bare trunk below them.
  const ry = h * 0.075, step = h * 0.105, top = h * 0.93 - ry, wide = [0.3, 0.36, 0.27, 0.2];
  trunk.push(new THREE.CylinderGeometry(r * 0.55, r * 1.3, top, 7).translate(x, y0 + top / 2, z));
  for (let i = 0; i < n; i++) {
    const y = y0 + top - i * step, rx = h * wide[i] * (0.9 + 0.2 * (((i * 5 + Math.round(z)) % 3) / 2)), a = (yaw || 0) + i * 2.4, off = i ? rx * 0.45 : rx * 0.15;
    crown.push(squash(rx, ry * (i ? 1 : 0.8), rx * 0.8, x + Math.cos(a) * off, y, z + Math.sin(a) * off));
  }
}
/** A cypress: a narrow flame, a little fuller below the middle and tapering to a tip. */
function cypress(t, trunk, crown) {
  const { x, z, h, r } = t, y0 = ground, R = h * (0.095 + 0.02 * (Math.abs(Math.round(x * 7 + z * 3)) % 3));
  trunk.push(new THREE.CylinderGeometry(r * 0.5, r * 0.7, h * 0.16, 6).translate(x, y0 + h * 0.08, z));
  const prof = [[R * 0.7, 0], [R, 0.22], [R * 1.05, 0.4], [R * 0.78, 0.66], [R * 0.36, 0.86], [0.001, 1]].map(([rr, f]) => new THREE.Vector2(rr, h * 0.12 + f * h * 0.88));
  crown.push(new THREE.LatheGeometry(prof, 8).translate(x, y0, z));
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
  const top = y0 + tr, n = 5;   // (the trees against the walls fork twice, the rest once)
  for (let i = 0; i < n; i++) limb(x, top - (i % 2) * 0.6, z, h * 0.3, spread(0.35, 0.7, i), yaw + (i / n) * Math.PI * 2, r * 0.55, t.cast ? 2 : 1, i * 11);
}
/**
 * A house of one storey: grey-brick walls to the eaves and a roof of grey tile, the eaves standing 0.5 m out: a gable roof (the ridge along x or z), a hip roof (four slopes, the ridge
 * shorter than the house), or a lean-to (one slope, its high side to the temple or away from it).
 */
/** How high a lean-to's slope rises over its low eave (m): a lean-to is a low shed, not a wall of tile. */
export const SHED_RISE = 1.5;
export function house(hs, walls, roofs) {
  const { x, z, w, d, eave, ridge, alongX } = hs, y0 = ground, over = 0.5, rise = ridge - eave;
  walls.push(box(w - 0.4, eave, d - 0.4, x, y0 + eave / 2, z));
  if (hs.roof === "hip") {
    const W = w + 2 * over, D = d + 2 * over, along = W >= D, half = Math.abs(W - D) / 2, v = [[-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, 0, D / 2], [-W / 2, 0, D / 2]];
    const r1 = along ? [-half, rise, 0] : [0, rise, -half], r2 = along ? [half, rise, 0] : [0, rise, half];
    const pos = [], quad = (a, b, c, e) => pos.push(...a, ...c, ...b, ...a, ...e, ...c), tri = (a, b, c) => pos.push(...a, ...c, ...b);   // (wound so that the faces look out and up: snow lies on them and the sun lights them)
    const [A, B, C, Dd] = v;   // the four corners; the two long slopes, then the two hipped ends
    if (along) { quad(A, B, r2, r1); quad(C, Dd, r1, r2); tri(Dd, A, r1); tri(B, C, r2); }
    else { quad(B, C, r2, r1); quad(Dd, A, r1, r2); tri(A, B, r1); tri(C, Dd, r2); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.translate(x, y0 + eave, z); roofs.push(g); return;
  }
  if (hs.roof === "shed") {   // one slope: the low side has its eave out over the wall, the high side stops at the wall's face with the brick rising to it (no tile wall hanging in the air)
    const sr = Math.min(rise, SHED_RISE), span = alongX ? d : w, a = (span - 0.4) / 2, lo = span / 2 + over, len = (alongX ? w : d) + 2 * over, lenW = (alongX ? w : d) - 0.4, at = (u) => sr * (u + lo) / (lo + a);
    const flip = hash01(x, z, 4) < 0.5, place = (g, l) => { g.translate(0, 0, -l / 2); if (flip) g.rotateY(Math.PI); if (alongX) g.rotateY(Math.PI / 2); g.translate(x, y0 + eave, z); };
    const roof = new THREE.Shape(); roof.moveTo(-lo, 0); roof.lineTo(a, 0); roof.lineTo(a, sr); roof.closePath();
    const gable = new THREE.Shape(); gable.moveTo(-a, 0); gable.lineTo(a, 0); gable.lineTo(a, sr - 0.05); gable.lineTo(-a, at(-a) - 0.05); gable.closePath();
    const r = new THREE.ExtrudeGeometry(roof, { depth: len, bevelEnabled: false }), g = new THREE.ExtrudeGeometry(gable, { depth: lenW, bevelEnabled: false });
    place(r, len); place(g, lenW); roofs.push(r); walls.push(g); return;
  }
  const run = (alongX ? d : w) / 2 + over, len = (alongX ? w : d) + 2 * over;
  const shape = new THREE.Shape(); shape.moveTo(-run, 0); shape.lineTo(run, 0); shape.lineTo(0, rise); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
  if (alongX) g.rotateY(Math.PI / 2);   // the extrusion's length now along x, the gable's section across z
  g.translate(x, y0 + eave, z); roofs.push(g);
}
/** The court wall's plaster with its colour pressed down to a grey brick (the art director, 2nd round: the houses' walls were the brightest thing at the arrival, 10 L* under the court's wall at least). */
export const BRICK_TONE = 0.4;
function brick(M) {
  const base = M.plaster(), m = base.clone(), was = base.onBeforeCompile;
  m.onBeforeCompile = (sh, rr) => { was.call(base, sh, rr); sh.fragmentShader = sh.fragmentShader.replace("diffuseColor.rgb=col;", `diffuseColor.rgb=col*vec3(${BRICK_TONE});`); };
  m.customProgramCacheKey = () => "surround-brick"; m.name = "surround-brick";
  return m;
}

/**
 * The tile in each of its tones: the base tile with its colour multiplied (TILE_TONES), a material of its own for each so that the three go in three draws. The keys are letters only,
 * so that `__pick` names them.
 */
function tiles(M) {
  return TILE_TONES.map((tone) => {
    const base = M.tile, m = base.clone(), was = base.onBeforeCompile, key = "surroundTile" + tone.name[0].toUpperCase() + tone.name.slice(1);
    m.onBeforeCompile = (sh, rr) => { was.call(base, sh, rr); if (tone.mul !== 1) sh.fragmentShader = sh.fragmentShader.replace("if(uSnow>.001){", `col*=vec3(${tone.mul});if(uSnow>.001){`); };   // (before the snow is mixed in: the snow keeps its own colour)   // (a clone does not take the original's hook: every tone is given it, or it would draw as a plain material)
    m.customProgramCacheKey = () => key; m.name = key;
    return m;
  });
}

/**
 * The surround as a group for the site's root. Every mesh carries `userData.surround` ("near": what stands against the walls, real geometry that casts shadows into the sun's map, the first row of
 * houses and the trees within 14 m of a wall; "far": the rest) and `userData.walk = false`.
 * @param {*} M the level's materials @param {{ x: number, zN: number, zS: number, t: number }} C the compound's walls
 */
export function buildSurround(M, C) {
  const PLAN = planSurround(C), group = new THREE.Group(), tone = () => TILE_TONES.map(() => []);
  const near = { trunk: [], crown: [], walls: [], roofs: tone() }, far = { trunk: [], crown: [], walls: [], roofs: tone() };
  for (const t of PLAN.trees) { const into = t.cast ? near : far; (t.kind === "pine" ? pine : t.kind === "cypress" ? cypress : bare)(t, into.trunk, into.crown); }
  for (const h of PLAN.houses) { const into = h.cast ? near : far; house(h, into.walls, into.roofs[h.tone]); }
  const wall = brick(M), tile = tiles(M);
  const put = (list, material, name, cast, mname) => {
    if (!list.length) return;
    const m = mesh(merge(list), material, { cast }); m.userData.surround = name; m.userData.walk = false; m.name = mname; group.add(m);
  };
  const add = (set, name, cast) => {
    for (const [key, material] of [["trunk", M.bark], ["crown", M.cedar], ["walls", wall]]) put(set[key], material, name, cast, `surround-${name}-${key}`);
    set.roofs.forEach((list, i) => put(list, tile[i], name, cast, `surround-${name}-${TILE_TONES[i].name}-roofs`));   // (the roofs, a draw to each tone of tile)
  };
  add(near, "near", true); add(far, "far", false);
  return group;
}
