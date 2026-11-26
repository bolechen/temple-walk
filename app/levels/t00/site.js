// The temple as a plan. It takes its spirit from Jingshan, the mountain-top Zen monastery above the bamboo
// sea, without copying it. What is kept is the order in which that place is met (docs/JINGSHAN.md):
// a stair climbing out of the bamboo; a screen wall where two paths meet; a two-storey gate with its bell
// and drum; a double-eaved hall across a wet court, a meditation hall and a tea house facing each other;
// a library and a dragon well on the terrace behind; and a last stair between rows of tea to a pavilion
// at the summit, from which every roof lies below. 1 unit = 1 m. North is -z and uphill; you arrive from the south.
import * as THREE from "three";
import { box, merge, mesh, smooth, stairGeo, stairProfile, cheekProfile, footAt, BODY, CHEEK, STOOL, CUSHION } from "../../src/geo.js";
import { PURLIN, PING, buildHall, DOOR } from "../../src/building.js";
export { BODY };
import { makePlaque, makeWallPanel } from "../../src/plaque.js";
import { CENSER } from "../../src/censer.js";
import { LIT } from "./windows.js";
import { buildStele } from "./stele.js";

export const SITE = { x: 22, zS: 40, zN: -142, fore: 64, apron: 112, wallH: 3.0, GROVE_IN: 20.5 };   // GROVE_IN: where the bamboo closes in on the forecourt
export const SCREEN = { z: 55, w: 11, h: 4.2 };   // the screen wall before the gate, where the two old paths meet
// Terraces above the entrance court, as on the mountain: each hall stands higher than the one before.
// zS is the front edge, where the stairs arrive.
export const LEVELS = [
  { y: 2.4, x: 22, zS: -34, zN: -67.9, stair: 6 },      // the library
  { y: 5.2, x: 22, zS: -67.9, zN: -90.5, stair: 5 },    // the Guanyin hall
  { y: 20, x: 14, zS: -118.4, zN: -142, stair: 4 },     // the summit: high enough to look back over every roof
];
const [T1, T2, TOP] = LEVELS;
// The top storey of the summit pavilion is walked round (issue #101): how far its balcony reaches past the columns
// and how far its eave reaches over that. 1.6 m leaves a child room between wall and rail and is recorded as a
// departure from the Yingzao Fashi (docs/t00/decisions.md, 登凌霄阁); the structure review prefers the balcony's edge
// over the second storey's columns (2.0 m) under an eave of about 2.8 m, for the owner to decide. Change it here only.
export const LOFT = Object.freeze({ out: 2.4, overhang: 3.2 });
/** How far from a young evergreen's trunk the floor is shut, metres (#531): the eye at 1.6 m is in its boughs inside 0.95 m, and the following eye, drawn in by the sprays, fills the picture with them at 1.0 m and is clear of them at 1.25. */
const CEDAR_SHUT = 1.25;
const HILL = { zS: T2.zN, zN: TOP.zS };   // the slope below the summit, crossed only by the stair between the tea rows
// The way in: the last of the old path up the mountain, a zigzag through the grove. You start at the
// river-view pavilion, climb north past the ink-stone pool, turn west and climb to the half-way pavilion,
// turn again and climb north to the forecourt in front of the gate.
const steps = (rise) => 0.34 * Math.round(rise / 0.18);
export const APPROACH = { top: SITE.fore, w: 4, rise: 6, rise2: 4.5, run: steps(6), run2: steps(4.5), zA0: SITE.fore + steps(6), zA1: SITE.fore + steps(6) + 4.6, xTurn: 10, rise3: 4, run3: steps(4) };
APPROACH.zMid = (APPROACH.zA0 + APPROACH.zA1) / 2; APPROACH.xB0 = APPROACH.xTurn + APPROACH.run2; APPROACH.xB1 = APPROACH.xB0 + 5.6;
APPROACH.xC = (APPROACH.xB0 + APPROACH.xB1) / 2; APPROACH.zC0 = APPROACH.zA1 + APPROACH.run3; APPROACH.zC1 = APPROACH.zC0 + 5.4; APPROACH.end = APPROACH.zC1 + 0.4;

// Where the near bamboo grows (bamboo.js): all round the zigzag you arrive by and the forecourt, and beyond the tea; and
// where it is kept clear, the path and the half-way pavilion. Culms stand 9 to 15 m over the land (`top`). Shared with the
// opening (opening.js), whose way down keeps over their tops except where it comes down the clear way of the path.
const nearRect = (x, z, x0, x1, z0, z1, m) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
/** The strip behind the start of the walk, along the eye's line to him at the first picture after 入山, the title's picture and
 *  the opening's last frame (#454): half its width, and how far back from the path's last step it reaches (the eye stands six
 *  metres back). No culm stands in it, so that none crosses him or the stair's middle; the eye is not kept out of it either
 *  (`eyeKeepOut` in level.js). */
export const START_SIGHT = { hw: 0.95, back: 6.5 };
/** The one near culm left in that strip to frame the first picture (#454, the art review): 2.8 m in front of the eye and 0.65 m to the
 *  left, which on a phone held upright stands a tenth of the picture's width from its left edge, and on a wide screen beside the
 *  stair, clear of him and of the stair's middle. */
export const START_CULM = [APPROACH.xC - 0.65, APPROACH.zC1 + 2.0];   // (he stands at zC1 - 1.2, the eye 6 m behind him at zC1 + 4.8)
export const GROVE = {
  top: 15,
  areas: [
    { x0: -28, x1: 44, z0: SITE.fore + 0.8, z1: APPROACH.zC1 + 12, n: 1150 },
    { x0: -36, x1: -23.2, z0: SITE.zS + 1, z1: SITE.fore + 0.8, n: 130 }, { x0: 23.2, x1: 36, z0: SITE.zS + 1, z1: SITE.fore + 0.8, n: 130 },
    { x0: -40, x1: -26.5, z0: LEVELS[2].zN - 5, z1: HILL.zS, n: 190 }, { x0: 26.5, x1: 40, z0: LEVELS[2].zN - 5, z1: HILL.zS, n: 190 },
  ],
  /** May bamboo grow here? */
  keep(x, z) {
    const A = APPROACH;
    if (z > SITE.fore - 0.5) return !(nearRect(x, z, -A.w / 2, A.w / 2, SITE.fore, A.zA0, 0.9) || nearRect(x, z, -A.w / 2, A.xB1 + 4.6, A.zA0, A.zA1, 0.8) || nearRect(x, z, 2.4, 8.0, A.zA1, A.zA1 + 5.8, 0.6) || nearRect(x, z, A.xC - A.w / 2, A.xC + A.w / 2, A.zA1, A.zC0, 0.9) || nearRect(x, z, A.xB0, A.xB1 + 6, A.zC0, A.zC1, 0.7));   // clear of the path and the half-way pavilion
    if (z > SITE.zS) return !(x < -7.5 && x > -17.5 && z > 45.5 && z < 55.5);                 // clear of the stele pavilion
    return true;
  },
  /** Is a knee-high clump of the undergrowth taken out here? Round the ink-stone pool the eye that follows him stands up
   *  to `EYE_EDGE` (0.5 m) into the grove's edge (#518), and the clumps there, a metre or two wide, stood between it and him
   *  and across the pool and its stele. Only that stretch of the edge is cleared, of clumps whose middle is within 1.4 m of
   *  it; everywhere else, the start included, the undergrowth is as it was, thickest near the path. */
  underClear(x, z) {
    const A = APPROACH; if (x < A.xB1 - 7.1 || x > A.xB1 + 5.9 || z < A.zMid - 9.5 || z > A.zMid + 4.5) return false;
    for (let k = 0; k < 8; k++) if (!GROVE.grows(x + Math.cos((k * Math.PI) / 4) * 1.4, z + Math.sin((k * Math.PI) / 4) * 1.4)) return true;
    return false;
  },
  /** Is a culm taken out here? Those in the strip behind the start (`START_SIGHT`), which would stand 1 to 6 m from the eye and
   *  split the stair (#454). Taken out after it has drawn its numbers: the rest of the grove is as it was. */
  cullSight(x, z) { return Math.abs(x - APPROACH.xC) < START_SIGHT.hw && z > APPROACH.zC1 && z < APPROACH.zC1 + START_SIGHT.back; },
  /** Is there bamboo at (x, z) (within an area, and not kept clear)? */
  grows(x, z) { return GROVE.areas.some((a) => x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1) && GROVE.keep(x, z); },
};

// Height of the land outside the walls, under the approach, and on the hill.
export function terrain(x, z) {
  const ax = Math.abs(x), A = APPROACH;
  if (z > A.top - 0.5) {
    const down = A.rise * Math.min(1, Math.max(0, (z - A.top) / A.run)) + A.rise2 * Math.min(1, Math.max(0, (x - A.xTurn) / A.run2)) * smooth(A.top + 3, A.zA0, z);
    return -down - 0.14 - A.rise3 * Math.min(1, Math.max(0, (z - A.zA1) / A.run3)) - Math.max(0, z - A.zC1 - 1) * 0.35 + Math.max(0, -x - 3) * 0.05 * smooth(A.top + 0.6, A.top + 3, z);   // west of the path the land rises, but not into the forecourt
  }
  if (ax < SITE.x + 0.2 && z > HILL.zS + 0.05 && z < SITE.zS) return -0.8;                 // inside: the courts cover it
  if (ax < TOP.x && z < HILL.zN && z > SITE.zN) return TOP.y - 0.4;                          // under the summit terrace
  const climb = Math.min(1, Math.max(0, (HILL.zS - z) / (HILL.zS - HILL.zN)));
  return T1.y * smooth(T1.zS + 7, T1.zS - 2, z) + (T2.y - T1.y) * smooth(T2.zS + 7, T2.zS - 2, z) + (TOP.y - T2.y) * climb - 0.12
    + Math.max(0, HILL.zN - z) * 0.3 + Math.max(0, ax - (z < HILL.zN ? TOP.x : SITE.x)) * 0.09;
}

// Turn a local point / rect by a quarter-turn count and move it to its place.
const turn = (x, z, q) => (q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x]);
function place(r, at, q) {
  if (r.r !== undefined) { const [x, z] = turn(r.x, r.z, q); return { ...r, x: x + at[0], z: z + at[1] }; }   // a round post: only its centre moves
  const [ax, az] = turn(r.x0, r.z0, q), [bx, bz] = turn(r.x1, r.z1, q);
  const out = { ...r, x0: Math.min(ax, bx) + at[0], x1: Math.max(ax, bx) + at[0], z0: Math.min(az, bz) + at[1], z1: Math.max(az, bz) + at[1] };
  for (const k of ["low", "high"]) if (r[k]) { const [x, z] = turn(r[k][0], r[k][1], q); out[k] = [x + at[0], z + at[1]]; }
  return out;
}
const tiles = (pos, uv, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };

/**
 * How this level's outdoor timber reads (WOOD_STYLE in src/materials.js lists what can be changed and what it starts as). Under
 * J01's overcast the prologue's columns, doors and brackets came out far darker than the picture the place is judged by: the gate's
 * leaves at L* 12 with no colour left, where the reference's doors are 21 and its columns 34 (refs/t00-atlas/T00.lossless.webp, Lab
 * as tools/look.py measures it), and the palette's faded vermilion for posts and doors is 28 (docs/ART-SPEC.md). The light is right
 * (the white walls and the paving already read as the reference's), so it is the timber's own colour: 1.65 times as light brings the
 * gate to about 20 and back to a red-brown (#758). In sunlight (autumn by day) the same timber would then be a bright rust: a tenth of
 * its colour is taken back toward its grey, which keeps the sunlit leaves under L* 40 and C* 16 (the art director's lines on art2). The damp the shader lays at a column's foot reached 2.2 m above the world's zero,
 * over the lower leaf of every door at the foot of the courts; rain splashes a column's foot, not a leaf at shoulder height under the
 * eaves, so here it fades out between 1.4 m and 0.1 m.
 */
export const WOOD_STYLE = Object.freeze({ gain: 1.65, sat: 0.9, dampTop: 1.4 });
/**
 * The bare earth outdoors (EARTH_STYLE in src/materials.js): the litter under the bamboo at the start read L* 13 where the target picture
 * the art director named for J01 (#757's first version of cam01) reads 17 (#758). A third lighter brings it to 16, its hue as it was.
 * Snow lies over it as before; the far hills are not this earth.
 */
export const EARTH_STYLE = Object.freeze({ gain: 1.35 });

export function buildSite(M) {
  const root = new THREE.Group();
  if (typeof M.woodStyle === "function") M.woodStyle(WOOD_STYLE);
  if (typeof M.earthStyle === "function") M.earthStyle(EARTH_STYLE);   // (one page walks one level, so the timber is this level's for good; a test's stand-in materials have none)
  // carve: floors and stairs you can stand on, which override what would block. shade[i]: what darkens the paving of level i.
  const litWindows = [], walk = { solids: [], decks: [], ramps: [], posts: [], drops: [], roofs: [], rails: [] }, shade = [[], [], [], []], halls = [], buildings = [], lofts = {}, doorways = {}, benchSeats = [];
  // How high a roof's ridge stands over its eave purlins (Yingzao Fashi, juan 5): a third of the distance between the
  // front and back purlins on a hall or a storeyed building; on a lesser hall (`lodge`) a quarter and eight parts in a
  // hundred more, 0.27. A pointed (tent) roof rises half its span.
  const ju = (o) => { const deep = o.zs[0] - o.zs[o.zs.length - 1], tent = !o.skirt && (o.G ?? 3.3) >= o.zs[0] + (o.overhang ?? 2.4);
    if (tent) return (deep + (o.brackets === false ? 0 : (2 * PURLIN * (o.cai || 0.21)) / 0.21)) / 2;   // a pointed roof: half its span
    return (deep + (2 * PURLIN * (o.cai || 0.21)) / 0.21) * (o.lodge ? 0.27 : 1 / 3); };
  const put = (opts, at, q = 0, lvl = 0, base) => {
    const y = base !== undefined ? base : lvl ? LEVELS[lvl - 1].y : 0, key = (opts.hall?.id ?? opts.plaque?.text ?? "?") + (opts.storey ? "#" + opts.storey : "");
    const b = buildHall(M, { ...opts, rise: opts.rise ?? ju(opts), ground: y, lit: LIT[key] });
    for (const w of b.windows) {   // where each bay stands in the world, for the measuring tools and the tests
      const [ax, az] = turn(w.x0, w.z, q), [bx, bz] = turn(w.x1, w.z, q);
      litWindows.push({ ...w, building: key, n: turn(0, w.face === "front" ? 1 : -1, q), a: [ax + at[0], az + at[1]], b: [bx + at[0], bz + at[1]], y0: w.y0 + y, y1: w.y1 + y });
    }
    b.group.position.set(at[0], y, at[1]); b.group.rotation.y = (q * Math.PI) / 2; root.add(b.group);
    for (const r of b.walk.solids) walk.solids.push(r.h === undefined ? place(r, at, q) : { ...place(r, at, q), top: r.h + y });
    for (const r of b.walk.decks) walk.decks.push({ ...place(r, at, q), h: r.h + y });
    for (const r of b.walk.ramps) walk.ramps.push({ ...place(r, at, q), base: y });
    for (const r of b.walk.posts) walk.posts.push(r.h === undefined ? place(r, at, q) : { ...place(r, at, q), eyeTop: r.h + y });   // (a stair's cheek: as high as its platform)
    for (const r of b.walk.rails || []) walk.rails.push({ ...place(r, at, q), bottom: r.bottom + y, top: r.top + y });
    for (const r of b.walk.roofs) walk.roofs.push({ ...place(r, at, q), bottom: r.bottom + y, inner: r.inner + y, top: r.top + y, floor: r.floor + y, edge: r.edge + y, body: r.body && place(r.body, at, q), core: place(r.core, at, q),
      crest: r.crest && r.crest.map(([cx, cy, cz]) => { const [x, z] = turn(cx, cz, q); return [x + at[0], cy + y, z + at[1]]; }) });
    for (const edge of b.walk.drops) {
      const world = point => { const [x, z] = turn(point[0], point[1], q); return [x + at[0], z + at[1]]; };
      walk.drops.push({ a: world(edge.a), b: world(edge.b), normal: turn(...edge.normal, q), top: edge.top + y });
    }
    if (base === undefined) shade[lvl].push(place(b.plat, at, q));
    // A bench between the columns (#479): each seat where it stands in the world, facing out over the view.
    for (const s of b.seats) { const [x, z] = turn(s.at[0], s.at[1], q), [fx, fz] = turn(s.out[0], s.out[1], q); benchSeats.push({ at: [x + at[0], z + at[1]], top: s.top + y, face: Math.atan2(-fx, -fz), room: null, kind: "stool", pavilion: opts.plaque?.text || opts.plaque }); }
    // What stands where, by name: the edge sweep and the tests go round each building by this list.
    buildings.push({ name: opts.hall?.name || opts.plaque?.text || opts.plaque || opts.name || "", ...place(b.plat, at, q), y, rail: b.rail,
      frame: { xs: [...(opts.xs || [])], zs: [...(opts.zs || [])], sets: b.sets, cai: b.cai, parts: b.parts, corners: b.corners, cols: b.cols, ping: b.ping || null, roof: b.roof, storey: opts.storey || 0, under: !!opts.under, at: [...at], q, brackets: opts.brackets !== false } });   // its timber frame as built, in its own space: the structure tests read it
    // A hall that can be entered: where its door is, out in the world, and where to stand on coming out again.
    if (opts.hall) {
      // What is seen through its open door from outside: the dark box behind the leaves, and how the building stands (doorway.js).
      const box = b.group.children.find((o) => o.userData.doorway); if (box) doorways[opts.hall.id] = { mesh: box, flames: b.group.children.filter((o) => o.userData.doorFlame), group: b.group, Z: b.frontZ, platH: b.platH };
      const Z = b.frontZ, out = (x, z) => { const [a, c] = turn(x, z, q); return [a + at[0], c + at[1]]; }, f = turn(0, 1, q);
      // He is inside as soon as he has stepped between the leaves up to the sill: his robe at the door, not through it.
      halls.push({ ...opts.hall, xs: [...opts.xs], zs: [...opts.zs], door: out(0, Z + DOOR.reach + 0.01), out: out(0, Math.min(Z + 0.66, b.zF - 0.4)), outYaw: Math.atan2(f[0], -f[1]),
        inside: (x, z) => { const [lx, lz] = turn(x - at[0], z - at[1], (4 - q) % 4); return Math.abs(lx) < DOOR.half + 0.02 && lz < Z + DOOR.reach + 0.035 && lz > Z - 0.3; },
        // The doorway beyond the place where the door takes him in: drawn open, but walked no further (the floor baked
        // from the drawn meshes closes it, #265; the written plan's platform stops at the door already).
        stop: (() => { const [ax, az] = out(-DOOR.half - 0.1, Z - 0.6), [bx, bz] = out(DOOR.half + 0.1, Z + DOOR.reach); return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz) }; })() });
    }
    return b;
  };
  // A building of several storeys: each lower roof is a skirt whose ridge hides inside the storey above,
  // and each upper storey starts where that skirt meets its walls.
  const putStack = (storeys, at, q = 0, lvl = 0) => {
    let first, foot = 0, below = null;
    const y = lvl ? LEVELS[lvl - 1].y : 0;
    storeys.forEach((st, i) => {
      const next = storeys[i + 1], o = i ? { platOut: 0.05, dark: false, steps: 0, ...st, platH: foot - 0.08, platBase: foot - 0.4 } : { ...st };
      // A balcony walked round whose floor reaches past the columns of the storey below stands on their heads (#101).
      if (st.loft && i && st.xs[st.xs.length - 1] + st.platOut > storeys[i - 1].xs[storeys[i - 1].xs.length - 1]) o.pingRing = [...storeys[i - 1].xs];
      o.storey = i; o.under = o.skirt = !!next;   // which storey, and whether another stands on its roof
      if (next) { o.overhang = o.overhang ?? 2.4; o.G = o.xs[o.xs.length - 1] + o.overhang - next.xs[next.xs.length - 1] + 0.4; }
      const r0 = walk.roofs.length, b = put(o, at, q, lvl); first = first || b;
      // The skirt roof below goes up into this storey's floor and no higher: over the balcony the eye is in the air,
      // not in its tiles.
      if (below) for (const r of below) r.top = Math.min(r.top, b.platH + y);
      below = walk.roofs.slice(r0);
      if (next) foot = b.roofAt(b.EZ - next.zs[0]) + (!next.ping ? 0 : next.loft ? PING.lift : PING.floor + (PING.sets * (next.cai || 0.21)) / 0.21);   // a balcony's sets, their plate and its floor stand between the skirt and the storey (a walked balcony on the ring below keeps its own lift)
      if (b.loft) {   // a balcony walked round: where it is, its floor, where its door lets him out and which way he faces there
        const L = b.loft, f = turn(0, 1, q), [dx, dz] = turn(L.door[0], L.door[1], q);
        lofts[L.id] = { id: L.id, at: [...at], floor: L.floor + y, ceil: L.ceil + y, half: { wall: L.wall, edge: L.edge }, door: [dx + at[0], dz + at[1]], face: Math.atan2(f[0], -f[1]),
          inner: place(L.inner, at, q), outer: place(L.outer, at, q), hall: storeys[0].hall?.id || null };
      }
    });
    return first;
  };
  const putTwo = (lower, upper, at, q = 0, lvl = 0) => putStack([lower, upper], at, q, lvl);

  // What is drawn as floor but is not to be walked (#265): an intent the meshes cannot say, written once here and read by the
  // written plan's walker and by the floor baked from the drawn meshes alike. Each is a rectangle and why.
  const closed = [];
  // ---- Buildings, from the gate uphill ----
  const GATE = { xs: [-9.6, -6.2, -2.5, 2.5, 6.2, 9.6], zs: [3, -3] };
  // You pass through the gate's middle bay; the bays either side are shut behind planked doors, front and back, and are not
  // walked into from the passage (the bake sees their floor as the passage's own).
  for (const sx of [-1, 1]) { const inner = GATE.xs[3] + 0.25, outer = GATE.xs[5] + 0.3; closed.push({ x0: sx < 0 ? -outer : inner, x1: sx < 0 ? -inner : outer, z0: SITE.zS + GATE.zs[1] + 0.05, z1: SITE.zS + GATE.zs[0] - 0.05, why: "the gate's shut side bays" }); }
  // The bamboo closes in on both sides of the forecourt (the near grove, bamboo.js; it is not in the bake).
  for (const sx of [-1, 1]) closed.push({ x0: sx < 0 ? -SITE.x - 1 : SITE.GROVE_IN, x1: sx < 0 ? -SITE.GROVE_IN : SITE.x + 1, z0: SITE.zS + 0.05, z1: SITE.fore, why: "the bamboo either side of the forecourt" });
  putTwo({   // the gate: you pass through its middle bay, under an upper storey
    cai: 0.232, ...GATE, platH: 0.5, platOut: 1.2, colTop: 4.3, overhang: 2.0,
    front: "pass", back: "pass", dark: false, timber: true, steps: 4.0, stepsBack: 4.0, plaque: { text: "万年正续", gold: true },
  }, { cai: 0.232, timber: true, ping: true, platOut: 0.85, rail: true, xs: [-6.2, -2.5, 2.5, 6.2], zs: [3, -3], colTop: 3.0, overhang: 1.8, crest: 3.9, G: 2.6, plaque: { text: "云径禅寺", vertical: true } }, [0, SITE.zS]);

  const strikers = [];
  for (const sx of [-1, 1]) {   // at either end of the gate, completing its five roofs: the bell (east) and the drum (west)
    const t = put({
      cai: 0.186, xs: [-1.7, 1.7], zs: [1.7, -1.7], platH: 0.6, platOut: 0.9, colTop: 4.4, overhang: 1.5, crest: 3.0, G: 9, lift: 0.6, liftLen: 2.6,
      front: "open", back: "open", sides: "open", dark: false, steps: 0, plaque: { text: sx > 0 ? "钟楼" : "鼓楼", style: "wood" },
    }, [sx * 15.5, SITE.zS], 2);
    const thing = sx > 0 ? bell(M, t) : drum(M, t);
    t.group.add(thing.group); strikers.push({ kind: sx > 0 ? "bell" : "drum", mesh: thing.hit, swing: thing.swing, rope: thing.rope || null, gap: LOG.gap });
    // The log that strikes the bell is slung out past the columns toward the gate: the eye keeps out of it too.
    if (sx > 0) { const r = walk.roofs[walk.roofs.length - 1]; r.core = { ...r.core, z0: Math.min(r.core.z0, SITE.zS - LOG.near - LOG.len - 0.1) }; }
  }
  // Facing each other across the court: the meditation hall, and the tea house.
  const side = { cai: 0.223, xs: [-8, -5.1, -2.2, 2.2, 5.1, 8], zs: [2.4, -2.4], platH: 0.45, platOut: 1.0, colTop: 3.6, overhang: 1.7, lodge: true, crest: 3.0, G: 2.2, lamps: false, steps: 3.0 };
  put({ ...side, plaque: { text: "禅堂", style: "wood" }, hall: { id: "chan", kind: "chan", name: "禅堂" } }, [16.6, 14], 3);
  // The tea house's porch is deeper than its neighbour's: wide enough to walk round the two tables set under its eave.
  const tea = put({ ...side, platOut: 1.6, plaque: { text: "吃茶去", style: "wood" }, hall: { id: "tea", kind: "tea", name: "茶寮" } }, [-16.6, 14], 1);
  const teaMats = [], drawnSeats = [];   // the tea house's four cushions; every place a cushion or stool is drawn (a test holds each to a seat)
  {   // a low table set for tea under its eave, against the wall: an iron kettle, a whisk, bowls of black glaze, a straw cushion at either end
    const y = tea.platH, z = tea.frontZ + 0.37, parts = { wood: [], glaze: [], iron: [], straw: [] };
    for (const x of [-4.9, 4.9]) {
      parts.wood.push(box(1.5, 0.06, 0.52, x, y + 0.34, z), box(0.07, 0.31, 0.44, x - 0.62, y + 0.155, z), box(0.07, 0.31, 0.44, x + 0.62, y + 0.155, z));
      for (const dx of [-0.42, 0, 0.42]) parts.glaze.push(lathe([[0, 0.012], [0.035, 0], [0.04, 0.012], [0.075, 0.05], [0.082, 0.062], [0.076, 0.062], [0.03, 0.02], [0, 0.02]], 14).translate(x + dx, y + 0.37, z + 0.05));
      parts.iron.push(lathe([[0, 0], [0.09, 0], [0.13, 0.05], [0.13, 0.11], [0.07, 0.16], [0.03, 0.17], [0, 0.19]], 12).translate(x + 0.55, y + 0.37, z - 0.12), new THREE.TorusGeometry(0.09, 0.008, 5, 12, Math.PI).translate(x + 0.55, y + 0.53, z - 0.12));
      parts.wood.push(new THREE.CylinderGeometry(0.012, 0.03, 0.11, 8).translate(x - 0.6, y + 0.425, z - 0.12));
      // (the cushions lie a hand's breadth off the wall: sat on cross-legged, his robe spreads 0.36 m from the middle, #664)
      for (const dx of [-1.12, 1.12]) { parts.straw.push(lathe(CUSHION, 28).translate(x + dx, y, z + 0.07));
        const [cx, cz] = turn(x + dx, z + 0.07, 1), [tx, tz] = turn(x, z + 0.07, 1);
        walk.posts.push({ x: cx - 16.6, z: cz + 14, r: 0.292 });   // a cushion is walked round, as the stools are: his shoes do not sink into the straw
        // and it is a seat, sat on cross-legged facing the table it lies beside
        const at = [cx - 16.6, cz + 14]; teaMats.push({ at, top: y + 0.104, face: Math.atan2(tx - cx, tz - cz), room: null, kind: "cushion" }); drawnSeats.push(at); }
      // The table and what stands on it are in the way, with his own width round them; the way past is outside it.
      const [ax, az] = turn(x - 0.75 - BODY, z - 0.26, 1), [bx, bz] = turn(x + 0.75 + BODY, z + 0.26 + BODY, 1);
      walk.posts.push({ x0: Math.min(ax, bx) - 16.6, x1: Math.max(ax, bx) - 16.6, z0: Math.min(az, bz) + 14, z1: Math.max(az, bz) + 14 });
    }
    // All of it is walked round, not stood on (#265: the floor baked from the drawn meshes looks through it to the porch).
    for (const m of [mesh(merge(parts.wood), M.woodX), mesh(merge(parts.glaze), M.glaze), mesh(merge(parts.iron), M.iron), mesh(merge(parts.straw), M.hide)]) { m.userData.walk = "post"; tea.group.add(m); }
  }
  // Tall cryptomerias, as old as the walls: a pair before the gate, others in the courts; and the pair of young
  // evergreens that stand clear of everything in the corners before the great hall. trees.js grows them; the plan
  // only says where they stand, how tall, and that they are in the way: a trunk is a round thing as wide as it
  // is grown at the knee, where its roots still spread it.
  const cedars = [], girth = (kind, h) => (kind === "cedar" ? (h < 8 ? h * 0.2 : (0.2 + h * 0.012) * 1.9) : (0.09 + h * 0.019) * 1.8 + (kind === "maple" ? 0.1 : 0));   // a young evergreen is clothed to the knee, so it is in the way as far as its boughs reach; a maple forks low and crooked
  for (const [x, z, h, lvl] of [[-13.6, 54.4, 21, 0], [13.4, 53.8, 23, 0], [-19, 29, 19, 0], [19.6, 1.5, 20, 0], [-19.6, 0.5, 22, 0], [-15.5, 1.8, 5.2, 0], [15.5, 1.8, 5.6, 0], [-17, T1.zS - 27, 20, 1], [-17.5, T2.zS - 15, 18, 2]]) {
    cedars.push([x, lvl ? LEVELS[lvl - 1].y : 0, z, "cedar", h]);
    walk.posts.push({ x, z, r: girth("cedar", h) }); shade[lvl].push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 });
    // The baked floor sees a young evergreen's wood only, and its boughs start at 1.35 m: it let him stand 0.9 m from the trunk with
    // the eye inside the foliage (#288). The floor is shut round the trunk as a circle of `CEDAR_SHUT` (#531: it was a square 1.5 m out from the written plan's post, 3 m across,
    // which kept him a corner's width from a tree he could see round; the eye, 1.6 m up, is among the boughs at 0.95 m and clear of them at 1.0).
    if (h < 8) closed.push({ x, z, r: CEDAR_SHUT, x0: x - CEDAR_SHUT, x1: x + CEDAR_SHUT, z0: z - CEDAR_SHUT, z1: z + CEDAR_SHUT, why: "a young evergreen is clothed to the knee: the eye stays out of its boughs" });
  }
  // The trees that show the season: ginkgo and maple in the courts and on the terraces. They are in the way too.
  const seasonal = [[14.5, 0, 60.5, "ginkgo", 11], [-9.5, 0, 28, "maple", 7.5], [9.5, 0, 28, "ginkgo", 9.5], [-11.5, 0, 3.5, "maple", 7], [11.5, 0, 3.5, "maple", 7.5],
    [9, T1.y, T1.zS - 5.5, "maple", 7], [-9.5, T1.y, T1.zS - 6, "ginkgo", 9], [-10.2, TOP.y, TOP.zS - 3.0, "maple", 6.5], [9.8, TOP.y, TOP.zS - 4.5, "ginkgo", 8, false, "soft"]];   // ("soft": no stone pit, an earth ring with moss instead, the pavilion's platform being 0.6 m off; #611)   // (the summit ginkgo kept 0.6 m off the pavilion's platform as it widened, #278)
  for (const [x, , z, kind, h] of seasonal) walk.posts.push({ x, z, r: girth(kind, h) });
  // And outside the walls, on the hill, the old wood the temple was cut out of: a dark mass behind every roof.
  for (const [x, z, h] of [[-29, 60, 24], [30, 66, 22], [-34, 47, 26], [29, 44, 25], [-28, 30, 23], [30, 26, 26], [-31, 12, 25], [29, 6, 23], [-29, -8, 27], [32, -12, 24], [-36, 72, 22], [37, 54, 24],
    [-27, -30, 24], [28, -34, 26], [-40, 22, 28], [41, 34, 27], [-25, 76, 20], [-25.5, -17, 31], [25.5, -20, 32], [-26, 3, 29], [26, -3, 30], [-30, -44, 30], [31, -48, 31], [-24.5, -60, 28], [25, -64, 29]]) cedars.push([x, terrain(x, z) - 0.3, z, "cedar", h, true]);   // `true`: seen only from afar, so grown without the branches inside its boughs

  const mz = -14.6;   // the main hall: double-eaved, seven bays, the largest roof in the temple
  const main = putTwo({
    cai: 0.232, xs: [-14.4, -10.8, -6.9, -2.7, 2.7, 6.9, 10.8, 14.4], zs: [8.6, 4.3, 0, -4.3, -8.6], platH: 1.5, platOut: 2.4, colTop: 4.8, overhang: 2.6, steps: 6.4, rail: true, plaque: { text: "正法眼藏", gold: true }, hall: { id: "main", kind: "buddha", name: "大雄宝殿" },
    // Two flights down from the back of its platform, in the east and west bays next to the middle (#148, #272): not on the
    // axis, where the foot of the library terrace's stair comes too near.
    stepsBack: 3.9, stepsBackAt: [-8.85, 8.85],
  }, { cai: 0.256, xs: [-10.8, -6.9, -2.7, 2.7, 6.9, 10.8], zs: [4.3, 0, -4.3], colTop: 1.45, front: "wall", overhang: 2.8, crest: 5.4, G: 3.6, plaque: { text: "释迦宝殿", vertical: true, band: true, hand: "shijia", style: "navy", notes: ["淳祐丁未重陽", "徑山佛鑑圓照"] } }, [0, mz]);

  putTwo({   // on the first terrace: the sutra library
    cai: 0.232, xs: [-9.4, -6.1, -2.5, 2.5, 6.1, 9.4], zs: [4.2, 0, -4.2], platH: 1.26, platOut: 1.7, colTop: 5.0, overhang: 2.6, steps: 5.2, lamps: false, hall: { id: "library", kind: "library", name: "藏经楼" },
  }, { cai: 0.232, ping: true, platOut: 0.9, rail: true, xs: [-6.1, -2.5, 2.5, 6.1], zs: [4.2, 0, -4.2], colTop: 3.1, overhang: 2.3, crest: 4.4, G: 2.9, plaque: "藏经楼" }, [0, T1.zS - 15], 0, 1);
  {   // the dragon well: a vaulted niche of rough stone in the wall of the next terrace, water standing in the dark.
    // The whole arch stands in front of the wall and below the terrace above it (2.8 m): the crown comes up to the
    // coping and no higher, so nothing of it shows over the parapet or through it from the terrace behind.
    const g = new THREE.Group(), w = 0.95, R = w + 0.3, t = 0.28, deep = 2.6, mid = 0.75, jamb = 1.15, crown = jamb + R;   // `deep`: the barrel stretched out of the wall about `mid`, its back just touching the face and its front proud of the sill
    const niche = mesh(merge([
      box(0.6, jamb, 1.1, -w - 0.3, jamb / 2, 0.55), box(0.6, jamb, 1.1, w + 0.3, jamb / 2, 0.55),
      new THREE.TorusGeometry(R, t, 8, 18, Math.PI).scale(1, 1, deep).translate(0, jamb, mid),
      box(2.6, 0.24, 0.3, 0, 0.12, 1.25),
    ]), M.rubble); niche.name = "well-niche"; g.add(niche);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(2.0, crown).translate(0, crown / 2, 0.06), M.dark.clone()); dark.material.side = THREE.FrontSide;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.15).rotateX(-Math.PI / 2).translate(0, 0.2, 0.62), new THREE.MeshStandardMaterial({ color: 0x0a1210, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.4 }));
    const board = makePlaque("龙井", { style: "wood", back: M.woodV }); board.name = "well-board"; board.scale.setScalar(0.65); board.position.set(0, crown, mid + t * deep + 0.06);   // hung on the face of the arch's crown
    // Water seeping down the jambs, inside and out, with moss where it gathers (the pool is fed by the rock, not a spout).
    g.add(mesh(merge([-1, 1].flatMap((sx) => [new THREE.PlaneGeometry(0.5, jamb).translate(sx * R, jamb / 2, 1.103), new THREE.PlaneGeometry(0.9, jamb - 0.1).rotateY(-sx * Math.PI / 2).translate(sx * (w - 0.003), (jamb - 0.1) / 2, 0.6)])), M.seep, { ao: () => 0.6 }));
    g.add(dark, pool, board); g.position.set(13.2, T1.y, T2.zS); root.add(g);
    // Drawn as floor, but it is water: inside the sill the niche is the pool, which he looks into and does not wade (#274).
    closed.push({ x0: 13.2 - w, x1: 13.2 + w, z0: T2.zS, z1: T2.zS + 1.1, why: "the dragon well's pool, inside its sill" });
    walk.solids.push({ x0: 11.2, x1: 15.2, z0: T2.zS, z1: T2.zS + 1.8 + BODY });
  }

  // Flanking halls on the terraces, small and plain, as the real temple has them beside the axis.
  const wing = { cai: 0.205, xs: [-5.4, -2.2, 2.2, 5.4], zs: [2.4, -2.4], platH: 0.45, platOut: 1.0, colTop: 3.5, overhang: 1.7, lodge: true, crest: 2.9, G: 2.1, lamps: false, steps: 3.0 };
  put({ ...wing, plaque: { text: "药师殿", style: "navy" }, hall: { id: "yaoshi", kind: "figure", name: "药师殿" } }, [-17.0, T1.zS - 13], 1, 1);   // set back from the library's platform, so that the foot of its stair is not a slot a child must squeeze through
  put({ ...wing, plaque: { text: "大慧院", style: "wood" }, hall: { id: "dahui", kind: "patriarch", name: "大慧院" } }, [16.4, T2.zS - 12], 3, 2);

  put({   // on the second terrace: the Guanyin hall, single-eaved and quieter
    cai: 0.232, xs: [-9, -5.9, -2.4, 2.4, 5.9, 9], zs: [5, 1.7, -1.7, -5], platH: 0.9, platOut: 1.6, colTop: 4.2, overhang: 2.4, crest: 5.0, G: 3.2, steps: 4.6, plaque: { text: "观音殿", style: "wood" }, hall: { id: "guanyin", kind: "figure", name: "观音殿" },
  }, [0, T2.zS - 12.2], 0, 2);

  const topZ = TOP.zS - 12.9;   // at the summit: the pavilion that looks back over everything below
  putStack([
    // The ground storey's platform reaches 1.7 m past its columns (#278, the structure review): a gallery he walks round between
    // the columns and the railing, its drip still 0.3 m outside the platform under the 2.0 m eave.
    { cai: 0.205, xs: [-7.5, -5.4, -2.3, 2.3, 5.4, 7.5], zs: [7.5, 5.4, 2.3, -2.3, -5.4, -7.5], platH: 0.9, platOut: 1.7, colTop: 3.9, overhang: 2.0, steps: 3.6, lamps: false, rail: true, hall: { id: "lingxiao", kind: "pavilion", name: "凌霄阁", up: "lingxiao" } },
    { cai: 0.186, ping: true, xs: [-5.4, -3.4, -1.2, 1.2, 3.4, 5.4], zs: [5.4, 3.4, 1.2, -1.2, -3.4, -5.4], colTop: 3.0, overhang: 2.0, platOut: 1.0, rail: true },
    { cai: 0.186, ping: true, xs: [-3.4, -1.2, 1.2, 3.4], zs: [3.4, 1.2, -1.2, -3.4], colTop: 3.0, overhang: LOFT.overhang, crest: 4.0, G: 2.4, platOut: LOFT.out, rail: true, loft: "lingxiao", plaque: { text: "凌霄阁", vertical: true, band: true, cols: 1 } },
  ], [0, topZ], 0, 3);

  // The stele pavilion beside the approach, at the end of the old path up the mountain.
  const sp = putStack([
    { cai: 0.186, xs: [-2.0, 2.0], zs: [2.0, -2.0], platH: 0.45, platOut: 0.8, colTop: 3.3, overhang: 1.5, front: "open", back: "open", sides: "open", dark: false, steps: 2.6, walkAll: true },   // (three treads up from the path, #478: it had none, and 0.45 m is more than he steps; open floor like the path's other pavilions, #274)
    { cai: 0.186, xs: [-2.0, 2.0], zs: [2.0, -2.0], colTop: 1.5, overhang: 1.5, crest: 2.5, G: 9, lift: 0.5, liftLen: 2.4, front: "wall", platOut: -0.02, plaque: { text: "御碑亭", style: "wood" } },   // (platOut -0.02: its floor slab ends 2 cm inside the column line, and so inside the lower storey's white band, whose outer face it had shared and fought, #655)
  ], [-12.5, 50.5], 1);
  // The stele itself: a Song imperial stele with a notched head on a stepped base (stele.js, #520).
  const stele = buildStele(M);
  stele.group.position.y = 0.45;   // (the platform's floor)
  sp.group.add(stele.group);
  if (typeof window === "object") window.__stele = (on) => { for (const m of Object.values(stele.parts)) { m.userData.paint ??= m.material; m.material = on === "black" ? (m.userData.black ??= new THREE.MeshBasicMaterial({ color: 0x000000 })) : m.userData.paint; } return { height: stele.height }; };   // (a view of its shape alone, black: tools/stele-views.cjs)
  if (typeof window === "object") window.__steleInk = (on) => { const u = M.steleStone?.userData.inkUniforms; if (u) u.uInkOn.value = on ? 1 : 0; return !!u; };   // (the writing off and on, to see what it adds: tools/stele-views.cjs)
  if (typeof window === "object") window.__steleAlone = () => { let r = /** @type {THREE.Object3D} */ (stele.group); while (r.parent) r = r.parent; r.attach(stele.group); stele.group.userData.part = "stele"; return true; };   // (taken out of the pavilion, so that the pavilion can be switched off with __part and the stone seen whole)
  // Open floor on the written plan (`walkAll`) leaves no solid round the platform, so that his shoes could come down on its lip from the
  // ground beside it (`edges`): the platform's own solid is put back, as a hall's is; the floor laid over it, the stair, is unchanged.
  walk.solids.push({ ...place({ x0: -3.3, x1: 3.3, z0: -3.3, z1: 3.3 }, [-12.5, 50.5], 1), own: true });
  // The open floor reaches the platform's lip, where the stair's cheek stones stand level with it: a post along the lip on each side of the stair keeps his shoes off them.
  for (const sx of [-1, 1]) walk.posts.push(place({ x0: sx > 0 ? 0.9 : -1.9, x1: sx > 0 ? 1.9 : -0.9, z0: 2.6, z1: 2.84 }, [-12.5, 50.5], 1));
  // The written plan walks round the stele's foot (the baked floor takes it from the mesh): the base's footprint, turned a quarter, and his own width.
  walk.posts.push({ x0: -12.5 - stele.foot.hx - BODY, x1: -12.5 + stele.foot.hx + BODY, z0: 50.5 - stele.foot.hz - BODY, z1: 50.5 + stele.foot.hz + BODY, eyeTop: 3.45 });   // (the base: 0.77 by 1.24 m, turned a quarter, so that its depth lies along x, #520; `eyeTop`: the stele's top is 3.43 m up, and the following eye stays out of it all the way up)

  // ---- Terraces: a stone mass, paving on top, a parapet along the front, stairs on the axis ----
  const stone = [], flights = [], paving = [];   // `flights`: the stairs, which are dressed stone and not the terraces' rubble
  // Each flight is also kept as where it stands (`root.userData.flights`), so that its cheeks' feet can be looked under (#272).
  const flightAt = (w, rise, m) => { (root.userData.flights ||= []).push({ w, rise, sides: [-1, 1], m }); return stairGeo(w, rise, { place: m }).geo; };
  const placed = (x, y, z, turn = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(turn));
  LEVELS.forEach((L, i) => {
    const y0 = i ? LEVELS[i - 1].y : 0, rise = L.y - y0, st = stairGeo(L.stair, rise);
    const bottom = i === 2 ? 4 : y0 - 0.2 < 0 ? 0 : y0 - 0.2;
    stone.push(box(L.x * 2, L.y - bottom, L.zS - L.zN + 0.003, 0, (L.y + bottom) / 2, (L.zS + L.zN - 0.003) / 2)); flights.push(flightAt(L.stair, rise, placed(0, y0, L.zS)));
    // The summit's edge is the low plaster wall built below (the same line), not a second, stone one under its tiles.
    // (The parapet stops at the side wall's inner face: carried on into the wall, its front shared the plane of the wall's end, #688.)
    if (i < 2) for (const sx of [-1, 1]) { const w = L.x - L.stair / 2 - 0.42 - 0.21; stone.push(box(w, 0.95, 0.26, sx * (L.x - 0.21 - w / 2), L.y + 0.475, L.zS - 0.13)); }
    paving.push({ level: i + 1, y: L.y + 0.012, x: L.x, zS: L.zS, zN: L.zN });
    const pad = BODY + 0.02;   // the treads are walked clear of the cheek stones by his own width
    walk.ramps.push({ x0: -L.stair / 2 + pad, x1: L.stair / 2 - pad, z0: L.zS - 0.8, z1: L.zS + st.run + 0.3, base: y0,   // a little past its foot, so no sliver of ground is left without a height; and past its head, through the parapet's keep
       h: rise, low: [0, L.zS + st.run], high: [0, L.zS] });
    walk.solids.push({ x0: -60, x1: 60, z0: L.zS - 0.26 - BODY, z1: L.zS + 0.5 });   // the parapet along the terrace's edge, and his width behind it
    // The cheek stones and the masonry under them, either side of every flight, with his width round their feet.
    for (const sx of [-1, 1]) walk.posts.push({ x0: sx > 0 ? L.stair / 2 - BODY - 0.021 : -L.stair / 2 - CHEEK - BODY, x1: sx > 0 ? L.stair / 2 + CHEEK + BODY : -L.stair / 2 + BODY + 0.021, z0: L.zS + 0.02, z1: L.zS + st.run + BODY + 0.06 });
    shade[i].push({ x0: -L.x, x1: L.x, z0: L.zN, z1: L.zS });
  });
  // Where the summit flight leaves the Guanyin terrace for the hill, the earth is cut back for the stair: a block of the
  // terrace's own stone fills under its lowest two metres, so its cheeks stand on stone and not over a slot (#272).
  { const hw = TOP.stair / 2 + cheekProfile(TOP.y - T2.y).width - 0.003; stone.push(box(hw * 2, 1.4, 2.6, 0, T2.y - 0.7, T2.zN - 1.3)); }   // (a hair inside the cheeks' outer faces, whose plane it shared, #688)
  walk.solids.push({ x0: -60, x1: 60, z0: HILL.zN, z1: HILL.zS - 0.05, open: true });   // the hillside itself: not to be walked on, but open air above it
  {   // the approach: lower landing, a flight west to the half-way pavilion, a turn, a flight north to the forecourt
    const A = APPROACH, yA = -A.rise, yB = -A.rise - A.rise2, pad = 0.3, clear = BODY + 0.02;   // `clear`: the treads are walked this far inside the cheek stones
    flights.push(flightAt(A.w, A.rise, placed(0, yA, A.top)), flightAt(A.zA1 - A.zA0 - 0.6, A.rise2, placed(A.xTurn, yB, A.zMid, Math.PI / 2)));
    // (The upper landing stops where the next flight's head begins: carried on under its top tread and cheeks, its top and side
    // shared their planes, #688. Both are a hair shallower than the cheeks' feet beside them, whose underside they shared.)
    stone.push(box(A.xTurn + A.w / 2 + 0.4 - 0.2, 0.397, A.zA1 - A.zA0, (A.xTurn - A.w / 2 - 0.4) / 2 + 0.1, yA - 0.1985, A.zMid),
      box(A.xB1 - A.xB0, 0.397, A.zA1 - A.zA0, (A.xB0 + A.xB1) / 2, yB - 0.1985, A.zMid));
    walk.ramps.push({ x0: -A.w / 2 + clear, x1: A.w / 2 - clear, z0: A.top - 0.4, z1: A.zA0 + 0.2, base: yA, h: A.rise, low: [0, A.zA0], high: [0, A.top] },
      { x0: A.xTurn - 0.2, x1: A.xB0 + 0.2, z0: A.zA0 + 0.3 + clear, z1: A.zA1 - 0.3 - clear, base: yB, h: A.rise2, low: [A.xB0, A.zMid], high: [A.xTurn, A.zMid] });
    // The cheeks of the three flights, closed to him where they stand on a landing or beside a tread.
    const w2 = (A.zA1 - A.zA0 - 0.6) / 2;
    for (const s of [-1, 1]) walk.posts.push(
      { x0: s > 0 ? A.w / 2 - BODY - 0.021 : -A.w / 2 - CHEEK - BODY, x1: s > 0 ? A.w / 2 + CHEEK + BODY : -A.w / 2 + BODY + 0.021, z0: A.top + 0.02, z1: A.zA0 + BODY + 0.06 },
      { x0: A.xTurn + 0.02, x1: A.xB0 + BODY + 0.06, z0: s > 0 ? A.zMid + w2 - BODY - 0.021 : A.zMid - w2 - CHEEK - BODY, z1: s > 0 ? A.zMid + w2 + CHEEK + BODY : A.zMid - w2 + BODY + 0.021 },
      { x0: s > 0 ? A.xC + A.w / 2 - BODY - 0.021 : A.xC - A.w / 2 - CHEEK - BODY, x1: s > 0 ? A.xC + A.w / 2 + CHEEK + BODY : A.xC - A.w / 2 + BODY + 0.021, z0: A.zA1 - 0.2, z1: A.zC0 + BODY + 0.06 });   // (from a little behind its head: the stone stands a finger proud of the landing there)
    // Landings overlap the flights that reach them by a hand's width, so there is never a seam to fall into.
    walk.decks.push({ x0: -A.w / 2 + pad, x1: A.xTurn + 0.2, z0: A.zA0 - 0.05, z1: A.zA1 - pad, h: yA }, { x0: A.xB0, x1: A.xB1 - pad, z0: A.zA0 + pad, z1: A.zA1 + 0.2, h: yB });
    // Below that, a third flight coming up from the south, from the landing where the walk begins.
    const yC = yB - A.rise3;
    flights.push(flightAt(A.w, A.rise3, placed(A.xC, yC, A.zA1))); stone.push(box(A.xB1 + 5.2 - A.xB0, 0.397, A.zC1 - A.zC0, (A.xB0 + A.xB1 + 5.2) / 2, yC - 0.1985, (A.zC0 + A.zC1) / 2));   // (a hair shallower than the cheeks' feet, as above)
    walk.ramps.push({ x0: A.xC - A.w / 2 + clear, x1: A.xC + A.w / 2 - clear, z0: A.zA1 - 0.4, z1: A.zC0 + 0.2, base: yC, h: A.rise3, low: [A.xC, A.zC0], high: [A.xC, A.zA1] });
    walk.decks.push({ x0: A.xB0 + pad, x1: A.xB1 + 2.9 - 2.3 - stairGeo(1, 0.3).run - 0.02, z0: A.zC0, z1: A.zC1 - pad, h: yC });   // (as far as the foot of the river-view pavilion's steps)
    walk.solids.push({ x0: -80, x1: 80, z0: A.top + 0.3, z1: A.end + 8, open: true });   // the grove either side of the path: no way through, but nothing solid
    // Three open pavilions mark the climb, as pavilions mark the old path: somewhere to stop and look back.
    const rest = { cai: 0.186, xs: [-1.5, 1.5], zs: [1.5, -1.5], platH: 0.3, platOut: 0.8, colTop: 3.0, overhang: 1.3, crest: 2.3, G: 9, lift: 0.5, liftLen: 2.2,
      brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 2.6, walkAll: true };   // (two treads up from the landing, #274: the floor stands 0.3 m over it, more than he steps; nearly the middle bay wide)
    // The half-way pavilion stands on the downhill side of the landing, on a podium built out over the slope:
    // level ground under every column, and the valley to look at.
    put({ ...rest, bench: ["b"], plaque: { text: "半山亭", style: "wood" } }, [5.2, A.zA1 + 2.75], 2, 0, yA);
    stone.push(box(5.0, 4.0, 5.7, 5.2, yA - 2.0, A.zA1 + 2.65));
    put({ ...rest, bench: ["f"], steps: 0, stepsBack: 2.6, plaque: { text: "望江亭", style: "wood" } }, [A.xB1 + 2.9, (A.zC0 + A.zC1) / 2 + 0.2], 1, 0, yC);
    // The pool where Su Shi, climbing to the temple, washed his ink-stone (the county gazetteer: outside the gate, its
    // water clear, the ripples glinting on a still moonlit night as though there were ink in them), beside the second
    // landing: clear water in a tank of dressed stone, and behind it, facing the stair, a small stele with its name cut
    // and inked in the stone.
    const px = A.xB1 + 2.2, pz = A.zMid, sx = px + 1.95;
    stone.push(box(3.3, 3.0, 2.6, px, yB - 1.55, pz), box(1.1, 3.2, 0.9, sx, yB - 1.6, pz));   // the tank standing out of the slope, and the stele's footing behind it
    stone.push(box(3.3, 0.2, 0.3, px, yB + 0.05, pz + 1.15), box(3.3, 0.2, 0.3, px, yB + 0.05, pz - 1.15), box(0.3, 0.2, 2.0, px + 1.5, yB + 0.05, pz), box(0.3, 0.2, 2.0, px - 1.5, yB + 0.05, pz));   // its rim, the water standing a hand below it
    stone.push(box(0.5, 0.3, 0.9, sx, yB + 0.15, pz), box(0.24, 1.42, 0.62, sx, yB + 1.01, pz), box(0.32, 0.1, 0.74, sx, yB + 1.77, pz));   // plinth, slab and a thin cap
    const ink = mesh(new THREE.PlaneGeometry(2.7, 2.0, 8, 6).rotateX(-Math.PI / 2).translate(px, yB + 0.02, pz), M.inkpool, { ao: () => 0.7 }); ink.name = "inkpool"; ink.userData.keep = true;
    const tag = makePlaque("洗砚池", { vertical: true, style: "stone", back: M.woodV }); tag.name = "inkpool-stele"; tag.scale.setScalar(0.55); tag.position.set(sx - 0.14, yB + 1.0, pz); tag.rotation.y = -Math.PI / 2;
    root.add(ink, tag);
  }
  root.add(mesh(merge(stone), M.stone), mesh(merge(flights), M.steps));

  // Rows of tea across the last slope, following the hill, as they do beside the highest hall.
  {
    const rows = [], w = 21; let s = 31; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let z = HILL.zS - 2.0; z > HILL.zN + 0.8; z -= 1.45) for (const sx of [-1, 1]) {
      const x = sx * (TOP.stair / 2 + 1.6 + w / 2);
      const g = new THREE.CapsuleGeometry(0.5, w, 4, 10, 40).rotateZ(Math.PI / 2).scale(1, 0.82, 1.1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), p.getY(i) + (rnd() - 0.5) * 0.12, p.getZ(i) + (rnd() - 0.5) * 0.12);   // clipped by hand, not by machine
      rows.push(g.translate(x, terrain(x, z) + 0.33, z));
    }
    root.add(mesh(merge(rows), M.tea, { cast: false }));
  }

  // ---- Walls ----
  const body = [[], [], [], []], ridge = [], capPos = [], capUv = [], capIdx = [], T = 0.42, SHY = 0.003;
  function wall(x0, z0, x1, z1, lvl = 0, H = SITE.wallH) {
    const y = lvl ? LEVELS[lvl - 1].y : 0, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    // The tiles sit on the wall: at the wall's two faces their underside is H + 0.338 above its foot, so the plaster is
    // carried up to there and no sky shows between the two. The eaves stay where they were (out of his reach).
    const Hb = H + 0.33;
    body[lvl].push(box(alongX ? len : T, Hb, alongX ? T : len, (x0 + x1) / 2, y + Hb / 2, (z0 + z1) / 2));
    ridge.push(box(alongX ? len : 0.16, 0.14, alongX ? 0.16 : len, (x0 + x1) / 2, y + H + 0.5, (z0 + z1) / 2));
    for (const s of [-1, 1]) {   // two tiled slopes
      const b = capPos.length / 3;
      for (const [l, yy, o] of [[-SHY, H + 0.46, 0], [len + SHY, H + 0.46, 0], [len + SHY, H + 0.1, s * 0.62], [-SHY, H + 0.1, s * 0.62]]) {
        capPos.push(alongX ? Math.min(x0, x1) + l : x0 + o, y + yy, alongX ? z0 + o : Math.min(z0, z1) + l); capUv.push(l, o === 0 ? 0.72 : 0);
      }
      capIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    // The two ends of the tiled roof are shut with a gable, as every wall's end is in life (#288): without it the hollow under
    // the slopes shows as a black triangle to anyone who stands level with the end, as he now may at the summit's stair head.
    for (const l of [0, len]) {
      const b = capPos.length / 3, e = l + (l ? SHY : -SHY);   // (the tiles reach a hair past the wall's end, so that the gable is not on the plane of the plaster under it, #688)
      for (const [yy, o] of [[H + 0.46, 0], [H + 0.1, 0.62], [H + 0.1, -0.62]]) {
        capPos.push(alongX ? Math.min(x0, x1) + e : x0 + o, y + yy, alongX ? z0 + o : Math.min(z0, z1) + e); capUv.push(o + 0.625, o === 0 ? 0.72 : 0);   // (its tile rows run across it, not along the wall: a constant u would sit in the gutter between two rows, and be black)
      }
      // Wound to face out along the wall's line: the tile shader paints a back face dark, so a gable that faced inward would look no better than the gap.
      if (alongX === (l === len)) capIdx.push(b, b + 1, b + 2); else capIdx.push(b, b + 2, b + 1);
      // The tile shader is dark and the face looks sideways, so the shut end read as black from the stair head: over it goes the wall's own
      // lime plaster, a finger proud and stopping a hand under the tiles, so that their edge still shows, as the wall under it is finished.
      const out = l === len ? 1 : -1, off = out * 0.015, pts = [[H + 0.4, 0], [H + 0.1, 0.517], [H + 0.1, -0.517]].map(([yy, o]) => (alongX ? [Math.min(x0, x1) + l + off, y + yy, z0 + o] : [x0 + o, y + yy, Math.min(z0, z1) + l + off]));
      if (alongX !== (l === len)) pts.push(pts.splice(1, 1)[0]);   // (wound to face out, as above)
      const gable = new THREE.BufferGeometry();
      gable.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
      gable.setAttribute("normal", new THREE.Float32BufferAttribute(pts.flatMap(() => (alongX ? [out, 0, 0] : [0, 0, out])), 3));
      gable.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(6).fill(0), 2));
      body[lvl].push(gable);
    }
    const r = { x0: Math.min(x0, x1) - (alongX ? 0 : T / 2), x1: Math.max(x0, x1) + (alongX ? 0 : T / 2), z0: Math.min(z0, z1) - (alongX ? T / 2 : 0), z1: Math.max(z0, z1) + (alongX ? T / 2 : 0) };
    shade[lvl].push(r);
    walk.solids.push({ x0: r.x0 - 0.45, x1: r.x1 + 0.45, z0: r.z0 - 0.45, z1: r.z1 + 0.45 });
  }
  const X = SITE.x;
  for (const sx of [-1, 1]) { wall(sx * 9.72, SITE.zS, sx * 12.8, SITE.zS); wall(sx * 18.2, SITE.zS, sx * X, SITE.zS); }   // the wall runs right up to the gate's end wall: no slit to see through beside it
  // The bell and drum towers stand inside the enclosure: the wall steps out round each of them, so that from the
  // forecourt the temple is closed from end to end and the two small roofs rise behind it.
  for (const sx of [-1, 1]) { const zo = SITE.zS + 3.0; wall(sx * 12.8, SITE.zS, sx * 12.8, zo); wall(sx * 12.8, zo, sx * 18.2, zo); wall(sx * 18.2, zo, sx * 18.2, SITE.zS); }
  for (const sx of [-1, 1]) {
    wall(sx * X, T1.zS, sx * X, SITE.zS); wall(sx * X, T1.zN, sx * X, T1.zS, 1); wall(sx * X, T2.zN, sx * X, T2.zS, 2);
    wall(sx * X, T2.zN, sx * (TOP.stair / 2 + 0.6), T2.zN, 2);                      // the back of the terrace, open where the stair climbs
    wall(sx * TOP.x, TOP.zN, sx * TOP.x, TOP.zS, 3, 1.15); wall(sx * TOP.x, TOP.zS, sx * (TOP.stair / 2 + 0.5), TOP.zS, 3, 1.15);   // a low wall round the summit
  }
  wall(-TOP.x, TOP.zN, TOP.x, TOP.zN, 3, 1.15);
  body.forEach((b, i) => { if (b.length) root.add(mesh(footAt(merge(b), i ? LEVELS[i - 1].y : 0), M.plaster())); });
  root.add(mesh(tiles(capPos, capUv, capIdx), M.tile), mesh(merge(ridge), M.stone));

  // The screen wall facing the gate, where the two old paths up the mountain meet.
  {
    const { z, w, h } = SCREEN;
    root.add(mesh(footAt(merge([box(w, h, 0.7, 0, h / 2, z)]), 0), M.plaster()), mesh(merge([box(w + 0.5, 0.5, 1.0, 0, 0.25, z), box(w + 1.0, 0.2, 0.24, 0, h + 0.62, z)]), M.stone));   // a plinth, and the ridge of its little roof
    const cp = [], cu = [], ci = [];
    for (const s of [-1, 1]) { const b = cp.length / 3; for (const [l, yy, o] of [[0, h + 0.56, 0], [w + 0.8, h + 0.56, 0], [w + 0.8, h - 0.02, s * 0.8], [0, h - 0.02, s * 0.8]]) { cp.push(-w / 2 - 0.4 + l, yy, z + o); cu.push(l, o === 0 ? 0.95 : 0); } ci.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    // Its roof's two ends are shut, as the walls' are (#288).
    for (const e of [0, w + 0.8]) { const b = cp.length / 3; for (const [yy, o] of [[h + 0.56, 0], [h - 0.02, 0.8], [h - 0.02, -0.8]]) { cp.push(-w / 2 - 0.4 + e, yy, z + o); cu.push(o + 0.8, o === 0 ? 0.95 : 0); } if (e) ci.push(b, b + 1, b + 2); else ci.push(b, b + 2, b + 1); }
    root.add(mesh(tiles(cp, cu, ci), M.tile));
    // Both faces: a panel of diamond-laid grey brick in a frame of pale stone, the four characters gilt upon it, as on the real wall.
    for (const s of [-1, 1]) { const p = makeWallPanel("双径归堂", w - 1.3, h - 1.05, M.stone); p.position.set(0, 0.5 + (h - 0.5) / 2 - 0.02, z + s * 0.36); if (s < 0) p.rotation.y = Math.PI; root.add(p); }
    walk.solids.push({ x0: -w / 2 - 0.7, x1: w / 2 + 0.7, z0: z - 0.9, z1: z + 0.9 });
    shade[0].push({ x0: -w / 2, x1: w / 2, z0: z - 0.35, z1: z + 0.35 });
  }

  // A pair of sutra pillars at the foot of the great hall's stair, as before the halls of Lingyin: eight-sided
  // shafts cut with a dharani, under layered caps. They carry no light.
  const lanternStone = [];
  for (const [lx, lz, lvl] of [[5.0, 1.2, 0]]) for (const sx of [-1, 1]) {
    const y = lvl ? LEVELS[lvl - 1].y : 0;
    lanternStone.push(lantern().translate(sx * lx, y, lz));
    { const r = 0.6 * 1.08 + BODY; walk.solids.push({ x0: sx * lx - r, x1: sx * lx + r, z0: lz - r, z1: lz + r }); }   // the widest tier of its base, and his own width
    shade[lvl].push({ x0: sx * lx - 0.3, x1: sx * lx + 0.3, z0: lz - 0.3, z1: lz + 0.3 });
  }
  root.add(mesh(merge(lanternStone), M.monolith));

  // ---- The main hall can be entered ----
  const mainHall = halls.find((h) => h.id === "main"), doorZ = mainHall.door[1];
  const hall = {
    box: new THREE.Box3(new THREE.Vector3(-main.plat.x1, 0, mz + main.zB), new THREE.Vector3(main.plat.x1, 16, mz + main.zF + main.run)),
    foot: new THREE.Vector3(0, 0, mz + main.zF + main.run + 0.4),
    door: new THREE.Vector3(0, 0, doorZ),
    inside: mainHall.inside,
    out: mainHall.out,
  };

  // ---- The small observances of a visit (journey.js): the things they are made with, and where to stand ----
  const flame = (x, y, z, glow) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8).scale(1, 2.1, 1), M.flame); f.position.set(x, y, z); f.userData.glow = glow; root.add(f); return f; };
  const cushion = () => lathe(CUSHION, 28);
  // A tea table on the court before the tea house, as tea was taken in these monasteries: a table and stools, a ewer
  // of hot water, black bowls on stands. Whoever sits at it looks across the wet stone to the great hall.
  const TEA_T = 0.78, TEA_BOWL = 0.11;   // the table's height; how far from its middle, toward him, his bowl stands
  const teaSeat = [-10.3, 22.6], teaDir = [0 - teaSeat[0], mz + main.zF - teaSeat[1]], teaTurn = Math.atan2(-teaDir[0], -teaDir[1]);
  const teaFrom = (lx, lz) => [teaSeat[0] + lx * Math.cos(teaTurn) + (lz - 0.62) * Math.sin(teaTurn), teaSeat[1] - lx * Math.sin(teaTurn) + (lz - 0.62) * Math.cos(teaTurn)];   // the mat's own frame: he sits at (0, 0.62) and looks toward -z
  {
    const P = { straw: [], wood: [], glaze: [], iron: [], lacquer: [] }, y = 0;
    const bowl = () => lathe([[0, 0.012], [0.03, 0], [0.036, 0.012], [0.07, 0.048], [0.078, 0.06], [0.072, 0.06], [0.028, 0.02], [0, 0.02]], 24);
    const T = TEA_T, stool = () => lathe(STOOL, 20);
    // The table: a thick top on four legs joined by stretchers.
    P.wood.push(box(1.3, 0.05, 0.7, 0, T - 0.025, -0.12), box(1.2, 0.06, 0.04, 0, T - 0.09, 0.19), box(1.2, 0.06, 0.04, 0, T - 0.09, -0.43));
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.wood.push(box(0.06, T - 0.05, 0.06, a * 0.58, (T - 0.05) / 2, -0.12 + c * 0.29));
    for (const a of [-1, 1]) P.wood.push(box(0.04, 0.04, 0.58, a * 0.58, 0.2, -0.12));
    // His bowl and one for whoever comes, each on its lacquer stand; the whisk; the ewer of hot water.
    // (His own bowl is lifted and drunk from, so it is made apart, in rites.js; only its stand is here.)
    for (const [bx2, bz2] of [[0, TEA_BOWL], [0.38, -0.26]]) { if (bx2) P.glaze.push(bowl().translate(bx2, T + 0.03, bz2)); P.lacquer.push(lathe([[0, 0], [0.05, 0], [0.04, 0.012], [0.1, 0.02], [0.105, 0.03], [0.04, 0.03], [0, 0.03]], 20).translate(bx2, T, bz2)); }
    P.straw.push(new THREE.CylinderGeometry(0.012, 0.03, 0.1, 12).translate(-0.2, T + 0.05, -0.3));
    P.iron.push(lathe([[0, 0], [0.07, 0], [0.1, 0.05], [0.105, 0.12], [0.07, 0.19], [0.035, 0.22], [0.03, 0.27], [0.045, 0.29], [0, 0.29]], 22).translate(-0.42, T, -0.2),
      new THREE.TorusGeometry(0.075, 0.009, 6, 16, Math.PI).rotateZ(-Math.PI / 2).translate(-0.53, T + 0.15, -0.2), new THREE.CylinderGeometry(0.008, 0.016, 0.2, 8).rotateZ(-0.7).translate(-0.28, T + 0.17, -0.2));
    // Stools: his own, and two for company.
    P.wood.push(stool().translate(0, 0, 0.62), stool().translate(0.95, 0, -0.12), stool().translate(0, 0, -0.86));
    // One branch in a bottle, on the table: at the corner by his left hand, beside the ewer, out of the way of the eye that
    // looks across the table at him while he drinks (src/director.js; it stood at the near corner and filled a fifth of that picture).
    const BX = -0.52, BZ = 0.1;
    P.glaze.push(lathe([[0, 0], [0.034, 0], [0.05, 0.05], [0.04, 0.12], [0.014, 0.17], [0.017, 0.2], [0.012, 0.2], [0, 0.17]], 18).translate(BX, 0.78, BZ));
    P.wood.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0.17, 0], [0.01, 0.34, 0.01], [-0.05, 0.5, 0.03], [-0.02, 0.66, -0.04], [-0.12, 0.8, -0.02]].map((v) => new THREE.Vector3(v[0] + BX, v[1] + 0.78, v[2] + BZ))), 18, 0.006, 6),
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.05, 0.5, 0.03], [0.04, 0.58, 0.1], [0.1, 0.7, 0.13]].map((v) => new THREE.Vector3(v[0] + BX, v[1] + 0.78, v[2] + BZ))), 10, 0.004, 5));
    const o = teaFrom(0, 0), mats = { straw: M.straw, wood: M.woodX, glaze: M.glaze, iron: M.iron, lacquer: M.lacquer };
    for (const k in P) { const m = mesh(merge(P[k]).rotateY(teaTurn).translate(o[0], 0, o[1]), mats[k]); m.userData.walk = "post"; root.add(m); }   // walked round, not stood on (#265)
    // The table stands askew to the court, so it is closed off as three round things along its length; each stool as one.
    // (He does not walk into his own stool: he comes to stand behind it, and is seated on it. See `seat` below.)
    for (const lx of [-0.42, 0, 0.42]) { const t = teaFrom(lx, -0.12); walk.posts.push({ x: t[0], z: t[1], r: 0.42 }); }
    for (const [lx, lz] of [[0, 0.62], [0.95, -0.12], [0, -0.86]]) { const t = teaFrom(lx, lz); walk.posts.push({ x: t[0], z: t[1], r: 0.2 }); }
  }
  // A stand of small lamps before the Guanyin hall. A few are always burning; one in the middle waits for the visitor.
  // It stands far enough out from the porch that the eave's lip is a walk between them, and that one who hops down
  // from the porch lands clear of it.
  const lampAt = [-6.2, T2.zS - 3.4], lampMine = [lampAt[0], T2.y + 0.5 + 0.26 + 0.088, lampAt[1] + 0.02];
  {
    const P = { stone: [], wood: [], bronze: [] }, y = T2.y;
    P.stone.push(box(1.7, 0.42, 0.66, lampAt[0], y + 0.21, lampAt[1]), box(1.86, 0.08, 0.8, lampAt[0], y + 0.46, lampAt[1]));
    const cup = () => lathe([[0, 0], [0.03, 0], [0.022, 0.012], [0.018, 0.03], [0.044, 0.055], [0.05, 0.062], [0.043, 0.062], [0.012, 0.036], [0, 0.036]], 16);
    for (let r = 0; r < 3; r++) {   // three wooden steps, the highest at the back
      const top = y + 0.5 + 0.13 * (r + 1), z = lampAt[1] + 0.22 - r * 0.2;
      P.wood.push(box(1.6, 0.13 * (r + 1), 0.2, lampAt[0], y + 0.5 + 0.065 * (r + 1), z));
      for (let i = 0; i < 5; i++) {
        const x = lampAt[0] + (i - 2) * 0.3; P.bronze.push(cup().translate(x, top, z));
        if ([[0, 1], [0, 4], [1, 0], [2, 3]].some(([a, c]) => a === r && c === i)) flame(x, top + 0.088, z, 0.8);
      }
    }
    root.add(mesh(merge(P.stone), M.stone), mesh(merge(P.wood), M.woodX), mesh(merge(P.bronze), M.bronze));
    walk.solids.push({ x0: lampAt[0] - 0.93 - BODY, x1: lampAt[0] + 0.93 + BODY, z0: lampAt[1] - 0.4 - BODY, z1: lampAt[1] + 0.4 + BODY });
    shade[2].push({ x0: lampAt[0] - 0.85, x1: lampAt[0] + 0.85, z0: lampAt[1] - 0.33, z1: lampAt[1] + 0.33 });
  }
  // On the library's porch, a narrow desk with a holder of bamboo slips and an open book.
  const deskAt = [2.9, T1.zS - 15 + 4.86];
  walk.posts.push({ x0: deskAt[0] - 0.47 - BODY, x1: deskAt[0] + 0.47 + BODY, z0: deskAt[1] - 0.2 - BODY, z1: deskAt[1] + 0.2 + BODY });   // the desk stands on the porch and is walked round, on the outside
  {
    const y = T1.y + 1.26, [x, z] = deskAt, slips = [];
    for (let i = 0; i < 11; i++) { const a = (i / 11) * 6.283, t = 0.12 + ((i * 7) % 5) * 0.03; slips.push(box(0.012, 0.25, 0.004, 0, 0.125, 0).rotateZ(Math.sin(a) * t).rotateX(Math.cos(a) * t).translate(x + 0.24 + Math.sin(a) * 0.022, y + 0.72, z + Math.cos(a) * 0.022)); }
    root.add(mesh(merge([box(0.9, 0.04, 0.36, x, y + 0.66, z), box(0.94, 0.012, 0.4, x, y + 0.686, z), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => box(0.04, 0.64, 0.04, x + a * 0.4, y + 0.32, z + c * 0.14)), box(0.8, 0.03, 0.03, x, y + 0.2, z)]), M.woodX),
      mesh(merge([new THREE.CylinderGeometry(0.062, 0.058, 0.17, 18, 1, true).translate(x + 0.24, y + 0.777, z), new THREE.CircleGeometry(0.058, 18).rotateX(Math.PI / 2).translate(x + 0.24, y + 0.693, z), ...slips]), M.hide),
      mesh(merge([box(0.17, 0.012, 0.25, -0.088, 0, 0).rotateZ(-0.1).translate(x - 0.14, y + 0.708, z + 0.02), box(0.17, 0.012, 0.25, 0.088, 0, 0).rotateZ(0.1).translate(x - 0.14, y + 0.708, z + 0.02)]), M.marble));
  }
  // A straw cushion at the top of the summit pavilion's steps, facing back down the mountain.
  const porchY = TOP.y + 0.9, porchZ = topZ + 7.5 + 0.8;
  { const mat = mesh(cushion().translate(0, porchY, porchZ), M.straw); mat.userData.walk = "floor"; root.add(mat); }   // a floor his shoes come down on, rounded rim and all (#265: the baked floor takes a face to 15° unless told)
  // It is where he comes out of the pavilion and where he sits: walked onto, not into. Its top is a floor, its own height.
  walk.decks.push({ x: 0, z: porchZ, r: 0.292, x0: -0.292, x1: 0.292, z0: porchZ - 0.292, z1: porchZ + 0.292, h: porchY + 0.1, floor: "wood" });
  // Whatever can be sat on out of doors: the three stools at the tea table (each turned to the table) and the mat on
  // the summit porch. `top` is the height of the seat; `kind` says how one sits on it: on a stool as on a chair, on a
  // cushion cross-legged. The rooms add their own (interior.js); game.js offers them.
  const seats = [[0, 0.62], [0.95, -0.12], [0, -0.86]].map(([lx, lz]) => { const p = teaFrom(lx, lz), c = teaFrom(0, -0.12); return { at: p, top: 0.44, face: Math.atan2(c[0] - p[0], c[1] - p[1]), room: null, kind: "stool" }; });
  seats.push({ at: [0, porchZ], top: porchY + 0.104, face: 0, room: null, kind: "cushion" });
  seats.push(...benchSeats);   // the benches of the path's pavilions (#479)
  drawnSeats.push([0, porchZ], ...seats.slice(0, 3).map((q) => q.at)); seats.push(...teaMats);
  // Where each observance is made: a spot to stand (and the radius within which it is offered), the way to face
  // (0 looks downhill, toward +z), and whatever the scene needs to know to stage it.
  const places = {
    bell:    { at: [15.5, SITE.zS - LOG.near - LOG.len - 0.34], r: 1.9, face: 0 },   // before the rope, an arm's length from it
    incense: { at: [hall.foot.x, hall.foot.z + 0.9], r: 1.9, face: Math.PI },
    tea:     { at: teaFrom(0, 0.62 + 0.2 + BODY + 0.04), seat: teaSeat, r: 1.5, face: Math.atan2(teaDir[0], teaDir[1]), sit: true, lift: 0.44, steam: [...teaFrom(-0.42, -0.2), TEA_T + 0.3], bowl: [teaFrom(0, TEA_BOWL)[0], TEA_T + 0.03, teaFrom(0, TEA_BOWL)[1]] },
    sutra:   { at: [deskAt[0], deskAt[1] + 0.2 + BODY + 0.04], r: 1.3, face: Math.PI },   // before the desk, his robe clear of it
    well:    { at: [13.2, T2.zS + 3.0], r: 1.8, face: Math.PI, pool: [13.2, T1.y + 0.2, T2.zS + 0.62] },
    lamp:    { at: [lampAt[0], lampAt[1] + 1.4], r: 1.5, face: Math.PI, flame: lampMine },
    sit:     { at: [0, porchZ], r: 1.2, face: 0, sit: true },
  };
  // The shot each observance is seen from while it is made (src/director.js): where the eye stands (`at`) and what it
  // looks at (`look`), in the place's own frame (x to his left, z the way he faces, y up from the floor there), its angle
  // of view for a wide picture (`fov`), how long it takes to come and to go (`in`, `out`, seconds), and how it drifts
  // while it rests (`drift`: `push`, `side`, `rise` in metres a second, `turn`, `tilt` in degrees a second, `for` seconds).
  // `keep` lists what must stay inside the picture, in the same frame: him, and what his hands are at.
  // First drafts, written here to be judged from the pictures (`shot-<id>` below); docs/t00/SOURCES.md records them as our own drafts.
  const SHOTS = {
    // From behind him to his right and low, between the tower's columns: the rope, his hands and the whole bell, little wall.
    bell: { at: [-2.6, 0.5, -3.0], look: [0, 1.52, 1.31], fov: 40, in: 2.0, out: 1.0, drift: { side: 0.02, for: 8 }, keep: [[0, 0.1, 0], [0, 1.25, 0], [0, 1.0, 0.34], [0, 1.75, 3.1], [0, 3.5, 3.1]] },
    // Across the table from his right, low: his bowl near on its stand, him beyond, the ewer at the edge; sitting on, it draws back.
    tea: { at: [-0.45, 0.98, 2.05], look: [0, 0.85, 0.8], fov: 42, in: 2.2, out: 1.0, drift: { push: -0.03, side: -0.015, for: 30 }, keep: [[0, 0.6, 0.62], [0, 1.15, 0.62], [0, 0.82, 1.13]] },
    // Under the eaves, from before him to his left, three-quarters: his face, his hands, the book and the holder of slips.
    sutra: { at: [1.2, 1.3, 0.5], look: [-0.06, 1.0, 0.28], fov: 42, in: 1.8, out: 1.0, drift: { push: 0.015, for: 8 }, keep: [[0, 0.85, 0], [0, 1.2, 0], [0, 0.95, 0.3], [-0.24, 1.0, 0.82]] },   // a near shot: from his waist up
    // From behind and above his shoulder, down into the niche where the pool lies; the 龍井 board above it kept out of the picture.
    // (Not gone to for now, `off`: the niche is unlit and its arch is to be rebuilt (#76), so the picture shows a black hole;
    // the eye stays with him until #99 brings the shot back. The data stays, tested like the rest.)
    well: { off: "#99", at: [-0.8, 2.4, -1.6], look: [0.05, 0.3, 2.2], fov: 40, in: 2.0, out: 1.0, drift: { push: 0.015, for: 10 }, keep: [[0, 1.0, 0], [0, 1.2, 0], [0, 0.2, 2.38]] },   // over his shoulder: his head and shoulders, and the pool
    // From before the lamp, his face lit by it; as it is lit the eye steps back half a pace.
    lamp: { at: [0.75, 1.3, 2.45], look: [-0.05, 1.0, 0.3], fov: 42, in: 1.8, out: 1.0, drift: { push: -0.05, for: 6 }, keep: [[0, 0.1, 0], [0, 1.2, 0], [0, 0.88, 1.38]] },
    // Low, before him and to his right at about 35° (wider would stand the eye over the stair's cheek), clear of the
    // columns: the pavilion behind him as he breathes.
    sit: { at: [-1.0, 0.55, 1.4], look: [0, 0.53, 0], fov: 44, in: 2.4, out: 1.2, drift: { push: 0.012, for: 30 }, keep: [[0, 0.1, 0], [0, 0.95, 0]] },
  };
  for (const id in SHOTS) places[id].shot = SHOTS[id];
  // The half-way pavilion's bench (#479): sitting on it, the eye turns slowly to the valley and stays there. Not an observance, so
  // these are no places the game offers (`restPlaces`, one for each seat, asked for by the seat itself); each shot is worked out
  // from its seat, since he sits facing in and the valley is behind him: the eye comes round to the middle of the pavilion, two
  // metres in front of him, and looks back past him over the rail, down the slope.
  const restPlaces = {};
  for (const s of benchSeats) {
    if (s.pavilion !== "半山亭") continue;
    const id = `rest-banshan-${Object.keys(restPlaces).length}`, b = buildings.find((k) => k.name === s.pavilion), mid = [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
    const left = [Math.cos(s.face), -Math.sin(s.face)], toMid = (mid[0] - s.at[0]) * left[0] + (mid[1] - s.at[1]) * left[1];
    restPlaces[id] = { at: s.at, r: 1.2, face: s.face, shot: { at: [toMid, 1.35, 2.9], look: [toMid * 0.3, 0.5, -3.0], fov: 52, in: 2.4, out: 1.2, drift: { push: 0.01, for: 30 }, keep: [[0, 0.1, 0], [0, 0.95, 0]] } };
    s.place = id;
  }

  // ---- Named views: one per thing worth looking at. The screenshot tool renders each of them. ----
  const A = APPROACH;
  const views = {
    arrive: [A.xC, A.zC1 - 1.2, 0, 0.3], pool: [A.xC - 0.5, A.zA1 - 1.2, 0.9, -0.12], second: [A.xB1 - 1.6, A.zMid, -Math.PI / 2, 0.2], halfway: [9.4, A.zMid - 1.2, -2.2, 0.1], stair: [0, A.zA0 - 0.6, 0, 0.3],
    forecourt: [10.5, 60, -0.42, 0.07], front: [0, 62.5, 0, 0.3], fiveroofs: [9.5, 61.5, -0.4, 0.2], screen: [3, 47.5, Math.PI - 0.3, 0.1], stele: [-4, 52, -1.25, 0.12], gate: [0, 49.5, 0, 0.2],
    eavecorner: [13, 2, 0.6, 0.62],   // up under the main hall's south-east corner: the corner beams, the rafters fanned along them
    court: [0, 29, 0, 0.1], bell: [10.5, 33.5, 2.5, 0.22], drum: [-10.5, 33.5, -2.5, 0.22], teatable: [-10.5, 17.5, -1.9, -0.12], hall: [9.5, 17, -0.5, 0.14], plaque: [0, 6, 0, 0.5],
    teahouse: [-5, 16, -1.35, 0.1], chan: [5, 16, 1.35, 0.1], behind: [19, -22, 0.4, 0.14], terrace: [0, T1.zS + 5.6, 0, 0.25],
    library: [0, T1.zS - 2.5, 0, 0.22], well: [11.6, T2.zS + 5.5, 0.28, 0.1], guanyin: [0, T2.zS + 5, 0, 0.22], yaoshi: [-4, T1.zS - 5.5, -1.0, 0.12], dahui: [4, T2.zS - 3.6, 1.0, 0.12], climb: [0, T2.zN + 1, 0, 0.45],
    tea: [0, HILL.zS - 12, 0.6, 0.12], summit: [0, TOP.zS + 9, 0, 0.42], lookback: [0, topZ + 7.5 + 0.8, Math.PI, -0.2],
    // The six fixed views the T00 handoff is judged by (docs/t00/camera-manifest.json): bamboo start, stair turn,
    // before the screen wall, the gate once round it, back through the gate, the first court.
    cam01: [A.xC, A.zC1 - 1.2, 0, 0.3], cam02: [A.xB0 + 1.6, A.zMid + 0.9, -1.35, 0.16], cam03: [0, 63.8, 0, 0.14], cam04: [6.6, 53.4, -0.42, 0.3], cam05: [0.6, 37.6, Math.PI, 0.08], cam06: [0, 29, 0, 0.1],
    // The observances' own shots (src/director.js): ?show=shot-<id> stands him at the place, begins the observance and
    // puts the eye on its shot at once. The incense is made indoors; its view is added with the hall's room (yard.js).
    ...Object.fromEntries(Object.entries(places).filter(([, p]) => p.shot).map(([id, p]) => [`shot-${id}`, [p.at[0], p.at[1], Math.PI - p.face, 0.05]])),
    // The bench's own: he stands a step in front of it (the seat itself is inside the bench) looking toward it.
    ...Object.fromEntries(Object.entries(restPlaces).map(([id, p]) => [`shot-${id}`, [p.at[0] + Math.sin(p.face) * 0.85, p.at[1] + Math.cos(p.face) * 0.85, -p.face, 0.05]])),
    teamat: [-7.6, 25.6, -0.72, -0.2], lamps: [-5.4, T2.zS - 1.0, -0.25, -0.22], desk: [1.2, deskAt[1] + 0.62, 1.25, -0.25], cushion: [2.6, TOP.zS - 1.2, 0.5, 0.2],
    // The six views of the art prototype (docs/t00/art-targets.md, A1 to A6), framed to match its pictures at 2.39:1:
    // the bamboo stair with the half-way pavilion at its head, the gate between the screen wall and its steps, the first
    // court behind the novice, the tea table before the tea house, the Guanyin hall up its stair, and the look back from
    // the summit. Each is drawn in the season and hour its picture shows, which the address gives, not the view.
    // art3 stands a little off the axis, under the north-west maple, so that its trunk and the shade of its crown frame the
    // left of the picture as the prototype's near cedars do (#467, ART-REVIEW A4; the owner chose this over planting two trees
    // at the court's south end, 2026-11-21): it is no longer cam06's pose, which stays on the axis.
    art1: [21.4, 78.7, -1.4, 0.2], art2: [2.5, 53.8, -0.18, 0.3], art3: [-5.2, 31, 0.16, 0.1], art4: [-9.6, 25.0, -0.6, 0.08],
    art5: [0, T2.zS + 5, 0, 0.22], art6: [0, topZ + 7.5 + 0.8, Math.PI, -0.2],
    // Up on the pavilion's top storey, at its door on the axis (the railing's middle bay is open there), looking back
    // south over every roof below (issue #101). A view up on a balcony is named in `viewUp`.
    loft: [0, topZ + 3.4 + (0.51 + LOFT.out - 0.64) / 2, Math.PI, -0.22],
  };
  const viewUp = { loft: "lingxiao" };
  // The iron censer on the axis of the first court (censer.js, drawn by props.js): round, and in his way as a column is.
  const censer = new THREE.Vector3(0, 0, 13);
  walk.posts.push({ x: censer.x, z: censer.z, r: CENSER.reach, eyeR: CENSER.ears + 0.1, top: censer.y + CENSER.height + 0.05 });   // the eye kept off its ears too

  return { root, walk, litWindows, shade, closed, paving, hall, halls, buildings, lofts, doorways, views, viewUp, places, restPlaces, seats, drawnSeats, cedars, trees: [...seasonal, ...cedars], strikers, start: views.arrive, censer, sunFocus: [0, -25], summitPorch: [0, topZ + 7.5 + 0.8] };
}

// ---- Furnishings ----
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// A lamp pillar of the old kind, eight-sided, some two and a half metres tall: a lotus pedestal, a shaft, an upturned
// lotus plate, an open chamber for the flame, a tiled cap and a jewel.
function lantern() {
  const parts = [
    // a sumeru base, the long inscribed shaft, a canopy, a short second shaft, a smaller canopy, a jewel
    lathe([[0, 0], [0.6, 0], [0.6, 0.12], [0.48, 0.18], [0.4, 0.34], [0.52, 0.44], [0.54, 0.54], [0.24, 0.6], [0.21, 0.64], [0.2, 1.9], [0.24, 1.96], [0.44, 2.04], [0.48, 2.1], [0.46, 2.16], [0.2, 2.24],
      [0.16, 2.28], [0.155, 2.74], [0.19, 2.8], [0.34, 2.87], [0.36, 2.93], [0.2, 3.04], [0.08, 3.1], [0.06, 3.16], [0.11, 3.24], [0.06, 3.34], [0, 3.38]], 8),
  ];
  return merge(parts).scale(1.08, 1.34, 1.08);   // taller than a man, as they stand before the old halls
}

// A bronze bell hung from a cross beam, with the log that strikes it slung beside it.
// The mouth of a great temple bell is not a plain circle: its lip rises and falls in eight waves.
function waved(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0.32) p.setY(i, y + 0.055 * (1 - y / 0.32) * (0.5 + 0.5 * Math.cos(Math.atan2(p.getX(i), p.getZ(i)) * 8))); }
  geo.computeVertexNormals(); return geo;
}
// The striking log: how near its head hangs to the bell's side, how long it is, and how far it must swing to touch.
const LOG = { near: 0.7, len: 2.08, gap: 0.18 };
function bell(M, t) {
  const g = new THREE.Group(), y0 = t.platH + 1.1, beamY = t.colTop - 0.55;
  const body = mesh(merge([
    waved(lathe([[0.64, 0], [0.61, 0.07], [0.53, 0.3], [0.48, 0.8], [0.46, 1.25], [0.41, 1.5], [0.26, 1.68], [0.08, 1.75], [0, 1.75]], 48)).translate(0, y0, 0),
    new THREE.TorusGeometry(0.12, 0.035, 8, 14).translate(0, y0 + 1.83, 0),
    new THREE.CylinderGeometry(0.025, 0.025, beamY - y0 - 1.9, 6).translate(0, (beamY + y0 + 1.9) / 2, 0),
  ]), M.bronze);
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20).rotateX(Math.PI / 2).translate(0, y0 + 0.03, 0), M.dark.clone());
  inside.material.side = THREE.DoubleSide;
  const frame = mesh(merge([box(3.6, 0.24, 0.24, 0, beamY, 0), box(0.24, 0.24, 3.6, 0, beamY - 0.02, 0)]), M.woodX);
  const log = mesh(merge([
    // It reaches out over the edge of the platform, where a rope hangs from its end for whoever rings (rites.js).
    new THREE.CylinderGeometry(0.09, 0.09, LOG.len, 10).rotateX(Math.PI / 2).translate(0, y0 + 0.35, LOG.near + LOG.len / 2),
    new THREE.CylinderGeometry(0.012, 0.012, beamY - y0 - 0.4, 5).translate(0, (beamY + y0 + 0.4) / 2, 1.05),
    new THREE.CylinderGeometry(0.012, 0.012, beamY - y0 - 0.4, 5).translate(0, (beamY + y0 + 0.4) / 2, 2.3),
  ]), M.woodZ);
  body.userData.keep = log.userData.keep = true;   // the bell is struck and the log swings
  g.add(body, inside, frame, log);
  return { group: g, hit: body, swing: log, rope: [0, y0 + 0.26, LOG.near + LOG.len] };
}

// A barrel drum on a timber stand, its face toward the court.
function drum(M, t) {
  const g = new THREE.Group(), cy = t.platH + 1.75;
  const barrel = mesh(lathe([[0.8, -0.68], [0.9, -0.4], [0.95, 0], [0.9, 0.4], [0.8, 0.68]], 28).rotateX(Math.PI / 2).translate(0, cy, 0), M.lacquer);
  const skins = mesh(merge([new THREE.CircleGeometry(0.8, 28).translate(0, cy, 0.685), new THREE.CircleGeometry(0.8, 28).rotateY(Math.PI).translate(0, cy, -0.685)]), M.hide);
  const stand = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) stand.push(box(0.14, cy - t.platH - 0.3, 0.14, sx * 0.72, (cy + t.platH - 0.3) / 2, sz * 0.5));
  for (const sz of [-1, 1]) stand.push(box(1.7, 0.14, 0.14, 0, cy - 0.78, sz * 0.5), box(1.7, 0.12, 0.12, 0, t.platH + 0.35, sz * 0.5));
  for (const sx of [-1, 1]) stand.push(box(0.12, 0.12, 1.1, sx * 0.72, t.platH + 0.35, 0));
  skins.userData.keep = true;
  g.add(barrel, skins, mesh(merge(stand), M.woodX));
  return { group: g, hit: skins, swing: null };
}

// ---- Walking over the plan ----
const terrainLevel = (x, z) => terrain(x, z);
// How high above the floor where he stands an observance made sitting puts him: on the top of the seat registered there
// (the tea's stool, the summit's mat), as sitting down on any seat does (game.js), less the floor under him.
export function placeLift(place, seats, heightAt) {
  const at = place.seat || place.at, seat = seats.find((s) => (s.room || null) === (place.room || null) && Math.hypot(s.at[0] - at[0], s.at[1] - at[1]) < 0.3);
  return seat ? Math.max(0, seat.top - heightAt(place.at[0], place.at[1])) : place.lift ?? 0.1;
}
export function createWalker(site) {
  const { solids, decks, ramps, posts = [], roofs = [], rails = [] } = site.walk;
  const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  // What stands in the way even on a floor: a round thing keeps his centre its own radius and his width away (`pad`);
  // a square one was drawn that much larger where it was put down. They are sorted into two-metre squares, so that
  // asking about one spot looks at a handful and not at every column in the temple.
  const CELL = 2, bins = new Map(), key = (i, j) => i * 4096 + j;
  for (const s of posts) {
    const e = s.r !== undefined ? Math.max(s.r + BODY, s.eyeR || 0) : 0, x0 = s.r !== undefined ? s.x - e : s.x0, x1 = s.r !== undefined ? s.x + e : s.x1, z0 = s.r !== undefined ? s.z - e : s.z0, z1 = s.r !== undefined ? s.z + e : s.z1;
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = key(i, j); (bins.get(k) || bins.set(k, []).get(k)).push(s); }
  }
  // (`eye`: asked for the eye, a round thing wider up high than at his height, the censer's ears, keeps it off by `eyeR`.)
  const post = (x, z, pad, eye = false) => { const list = bins.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!list) return false;
    for (const s of list) { if (s.r !== undefined) { const dx = x - s.x, dz = z - s.z, r = eye && s.eyeR ? Math.max(s.eyeR, s.r + pad) : s.r + pad; if (dx * dx + dz * dz < r * r) return s; } else if (inRect(s, x, z)) return s; }
    return null; };
  let floor = null;   // what the highest floor found by the last carved() is made of (building floors say; the rest is the path's stone)
  // The balcony of a storey that is walked round is floor only while he is up there: from below, a tap or a look aimed
  // at the building does not land on it, and the ground floor under it is still the ground floor.
  const lofts = site.lofts || {}; let loft = null;
  function carved(x, z, even) {   // a floor or stair of a building or terrace, if you are on one (`even`: a stair as the slope it follows)
    let height = null; floor = null;
    const take = (h, f) => { if (height === null || h > height) { height = h; floor = f || "path"; } };
    for (const d of decks) if ((!d.loft || d.loft === loft) && (d.r !== undefined ? (x - d.x) ** 2 + (z - d.z) ** 2 < d.r * d.r : inRect(d, x, z))) take(d.h, d.floor);   // (a round one is a mat)
    for (const r of ramps) if (inRect(r, x, z)) {
      const dx = r.high[0] - r.low[0], dz = r.high[1] - r.low[1];
      // A stair is steps, not a slope: he stands on the tread he is over, so his feet never sink into the stone.
      const { count: n, nosing } = stairProfile(r.h), run = Math.hypot(dx, dz);
      const f = Math.min(1, Math.max(0, ((x - r.low[0]) * dx + (z - r.low[1]) * dz) / (run * run) + nosing / run));
      take((r.base || 0) + r.h * (even ? f : Math.ceil(f * n - 1e-6) / n), r.floor);
    }
    return height;
  }
  function level(x, z) { if (z > SITE.fore + 0.3) return terrainLevel(x, z); for (const L of LEVELS) if (Math.abs(x) < L.x && z < L.zS && z > L.zN) return L.y; return 0; }
  // Indoors the plan is set aside: a room is one level floor inside four walls, with its own things in the way.
  let room = null;
  const shut = (x, z) => x < room.x0 || x > room.x1 || z < room.z0 || z > room.z1 || room.solids.some((s) => inRect(s, x, z));
  // Up on a balcony nothing but its own floor is to be stood on: what lies below the railing is far down.
  const upHere = (x, z) => { const c = carved(x, z); return c !== null && Math.abs(c - lofts[loft].floor) < 1e-6; };
  const wall = (x, z) => { if (room) return shut(x, z); if (post(x, z, 0.15)) return true; if (loft) return !upHere(x, z); if (carved(x, z) !== null) return false; for (const s of solids) if (!s.open && inRect(s, x, z)) return true; return false; };
  return {
    kind: "old",
    // The porch edges he may hop down from and jump up onto (drop.js), as written (#265: the grid walker finds its own).
    drops: site.walk.drops || [],
    setRoom(r) { room = r || null; }, get room() { return room; },
    setLoft(id) { loft = id && lofts[id] ? id : null; }, get loft() { return loft; },
    heightAt(x, z) { if (room) return room.y; const c = carved(x, z); return c === null ? level(x, z) : c; },
    // What a shoe comes down on: "room" (a hall's floor), "stone" or "wood" (a building's platform or gallery), "path"
    // (the stone landings and stairs of the approach and the terraces), "paving" (the courts, where water stands after
    // rain) or "earth" (the hillside below the screen wall).
    floorAt(x, z) { if (room) return "room"; if (carved(x, z) !== null) return floor; return z > SITE.fore + 0.3 ? "earth" : "paving"; },
    // Where the eye rides: over a stair it follows the slope, not each tread, so the view climbs without juddering.
    eyeAt(x, z) { if (room) return room.y; const c = carved(x, z, true); return c === null ? level(x, z) : c; },
    // The surface of whatever is there, walkable or not: floors and stairs, the courts, and the open hillside.
    landAt(x, z) { if (room) return room.y; const c = carved(x, z); return c === null ? Math.max(level(x, z), terrain(x, z)) : c; },
    // Is something solid standing here: a building, a wall, a tree? (Not the edges of the walk, which are only air.) The eye uses this,
    // and keeps a hand off a column, so that the near edge of its lens does not cut into the wood.
    wall,
    // May the eye that follows him be at this point, he standing at `foot`? Not among the bracket sets and rafters of
    // a roof, nor in its tiles, though the floor below is open to him; not against a column; over a floor he can walk
    // on, anywhere else. A building is closed within its walls up to its ridge and over its platform up to the floor;
    // any other wall or tree some way above his head (a court wall is passed over well above it). A column (or a
    // trunk: anything round and thinner than a stride) answers "post" rather than true: the eye may let one pass across the view a moment before giving way.
    // Is the point within `m` of a railing, round a platform's edge? (The eye that follows him passes over a railing as
    // over any floor; an eye sent on a swing of its own keeps clear of it, so that the near edge of its lens does not cut into the stone.)
    railNear(x, y, z, m = 0) { if (room) return false; for (const r of rails) if (x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m && y > r.bottom - m && y < r.top + m) return true; return false; },
    eyeShut(x, y, z, foot) {
      if (room) return shut(x, z);
      // On a balcony the eye keeps inside the railing and out of the wall, below the beams of the eave above.
      if (loft) { const L = lofts[loft]; if (!inRect(L.outer, x, z) || inRect(L.inner, x, z) || y < L.floor + 0.05 || y > L.ceil) return true; const p = post(x, z, 0.15); return p ? "post" : false; }
      for (const r of roofs) if (y < r.top && inRect(r, x, z) && y > (inRect(r.core, x, z) ? r.inner : r.bottom)) return true;
      // A square post is a low thing drawn wide by his body (a table, the cheek of a stair): in the way only of an eye
      // that has come down near the floor it stands on, as it does looking up.
      const p = post(x, z, 0.15, true);
      // (A round thing that stops short of the roofs, the censer, keeps the eye out only up to its own top.)
      if (p) { if (p.r !== undefined) { if (p.top === undefined || y < p.top) return p.r < 0.45 ? "post" : true; } else { const c = carved(x, z); if (y < (p.eyeTop !== undefined ? p.eyeTop + 0.3 : (c === null ? level(x, z) : c) + 1.1)) return true; } }
      if (carved(x, z) !== null) return false;
      // He stands on a terrace: the eye stays over it too, and does not step out past its edge to look back at him along
      // the wall's outer face. Past the front edge it may be only where the wall is open to the stair (the view back down
      // the flight); over the stair itself it has been let through above, as carved floor.
      for (const L of LEVELS) if (Math.abs(foot - L.y) < 0.6 && (Math.abs(x) > L.x || z < L.zN || (z > L.zS && Math.abs(x) > L.stair / 2 + 0.5))) return true;
      let top = -Infinity, own = false;
      for (const r of roofs) if (r.body && inRect(r.body, x, z)) top = Math.max(top, inRect(r.core, x, z) ? r.top : r.edge);
      let flight = -Infinity;
      for (const s of solids) if (!s.open && inRect(s, x, z)) { if (s.top !== undefined) flight = Math.max(flight, s.top + 0.3); else if (s.own) own = true; else top = Math.max(top, foot + 5.5); }
      if (own && top === -Infinity) top = foot + 5.5;
      // The cheeks of a building's stair, and the ground beside them, beyond its platform: only up to a little over the
      // platform the flight climbs (#271: they used to be shut 5.5 m up, and an eye straight behind him was brought in to
      // his back each time he walked across the foot of a hall's steps).
      else if (top === -Infinity) top = flight;
      return y < top;
    },
    onGround: (x, z) => !room && !loft && carved(x, z) === null,
    onStairs: (x, z) => !room && !loft && ramps.some(r => inRect(r, x, z) && carved(x, z) <= (r.base || 0) + r.h + 0.01),
    blocked(x, z) {
      if (room) return shut(x, z);
      if (post(x, z, BODY)) return true;   // a column, a table, the cheek of a stair: in the way even on a floor
      if (loft) return !upHere(x, z);
      if (carved(x, z) !== null) return false;
      if (Math.abs(x) > SITE.x + 8 || z < SITE.zN || z > APPROACH.end) return true;
      if (z > SITE.zS && Math.abs(x) > SITE.GROVE_IN) return true;                          // the grove closes in on both sides of the forecourt (site.closed says so too)
      for (const s of solids) if (inRect(s, x, z)) return true;
      return false;
    },
  };
}
