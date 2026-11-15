// The temple as a plan. It takes its spirit from Jingshan, the mountain-top Zen monastery above the bamboo
// sea, without copying it. What is kept is the order in which that place is met (docs/JINGSHAN.md):
// a stair climbing out of the bamboo; a screen wall where two paths meet; a two-storey gate with its bell
// and drum; a double-eaved hall across a wet court, a meditation hall and a tea house facing each other;
// a library and a dragon well on the terrace behind; and a last stair between rows of tea to a pavilion
// at the summit, from which every roof lies below. 1 unit = 1 m. North is -z and uphill; you arrive from the south.
import * as THREE from "three";
import { box, merge, mesh, smooth, stairGeo, stairProfile, footAt, BODY, CHEEK } from "./geo.js";
import { buildHall, DOOR } from "./building.js";
export { BODY };
import { makePlaque, makeWallPanel } from "./plaque.js";

export const SITE = { x: 22, zS: 40, zN: -142, fore: 64, apron: 112, wallH: 3.0 };
export const SCREEN = { z: 55, w: 11, h: 4.2 };   // the screen wall before the gate, where the two old paths meet
// Terraces above the entrance court, as on the mountain: each hall stands higher than the one before.
// zS is the front edge, where the stairs arrive.
export const LEVELS = [
  { y: 2.4, x: 22, zS: -34, zN: -67.9, stair: 6 },      // the library
  { y: 5.2, x: 22, zS: -67.9, zN: -90.5, stair: 5 },    // the Guanyin hall
  { y: 20, x: 14, zS: -118.4, zN: -142, stair: 4 },     // the summit: high enough to look back over every roof
];
const [T1, T2, TOP] = LEVELS;
const HILL = { zS: T2.zN, zN: TOP.zS };   // the slope below the summit, crossed only by the stair between the tea rows
// The way in: the last of the old path up the mountain, a zigzag through the grove. You start at the
// river-view pavilion, climb north past the ink-stone pool, turn west and climb to the half-way pavilion,
// turn again and climb north to the forecourt in front of the gate.
const steps = (rise) => 0.34 * Math.round(rise / 0.18);
export const APPROACH = { top: SITE.fore, w: 4, rise: 6, rise2: 4.5, run: steps(6), run2: steps(4.5), zA0: SITE.fore + steps(6), zA1: SITE.fore + steps(6) + 4.6, xTurn: 10, rise3: 4, run3: steps(4) };
APPROACH.zMid = (APPROACH.zA0 + APPROACH.zA1) / 2; APPROACH.xB0 = APPROACH.xTurn + APPROACH.run2; APPROACH.xB1 = APPROACH.xB0 + 5.6;
APPROACH.xC = (APPROACH.xB0 + APPROACH.xB1) / 2; APPROACH.zC0 = APPROACH.zA1 + APPROACH.run3; APPROACH.zC1 = APPROACH.zC0 + 5.4; APPROACH.end = APPROACH.zC1 + 0.4;

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

export function buildSite(M) {
  const root = new THREE.Group();
  // carve: floors and stairs you can stand on, which override what would block. shade[i]: what darkens the paving of level i.
  const walk = { solids: [], decks: [], ramps: [], posts: [], drops: [], roofs: [] }, shade = [[], [], [], []], halls = [], buildings = [];
  const put = (opts, at, q = 0, lvl = 0, base) => {
    const y = base !== undefined ? base : lvl ? LEVELS[lvl - 1].y : 0, b = buildHall(M, { ...opts, ground: y });
    b.group.position.set(at[0], y, at[1]); b.group.rotation.y = (q * Math.PI) / 2; root.add(b.group);
    for (const r of b.walk.solids) walk.solids.push(place(r, at, q));
    for (const r of b.walk.decks) walk.decks.push({ ...place(r, at, q), h: r.h + y });
    for (const r of b.walk.ramps) walk.ramps.push({ ...place(r, at, q), base: y });
    for (const r of b.walk.posts) walk.posts.push(place(r, at, q));
    for (const r of b.walk.roofs) walk.roofs.push({ ...place(r, at, q), bottom: r.bottom + y, inner: r.inner + y, top: r.top + y, floor: r.floor + y, edge: r.edge + y, body: r.body && place(r.body, at, q), core: place(r.core, at, q) });
    for (const edge of b.walk.drops) {
      const world = point => { const [x, z] = turn(point[0], point[1], q); return [x + at[0], z + at[1]]; };
      walk.drops.push({ a: world(edge.a), b: world(edge.b), normal: turn(...edge.normal, q), top: edge.top + y });
    }
    if (base === undefined) shade[lvl].push(place(b.plat, at, q));
    // What stands where, by name: the edge sweep and the tests go round each building by this list.
    buildings.push({ name: opts.hall?.name || opts.plaque?.text || opts.plaque || opts.name || "", ...place(b.plat, at, q), y });
    // A hall that can be entered: where its door is, out in the world, and where to stand on coming out again.
    if (opts.hall) {
      const Z = b.frontZ, out = (x, z) => { const [a, c] = turn(x, z, q); return [a + at[0], c + at[1]]; }, f = turn(0, 1, q);
      // He is inside as soon as he has stepped between the leaves up to the sill: his robe at the door, not through it.
      halls.push({ ...opts.hall, xs: [...opts.xs], zs: [...opts.zs], door: out(0, Z + DOOR.reach + 0.01), out: out(0, Math.min(Z + 0.66, b.zF - 0.4)), outYaw: Math.atan2(f[0], -f[1]),
        inside: (x, z) => { const [lx, lz] = turn(x - at[0], z - at[1], (4 - q) % 4); return Math.abs(lx) < DOOR.half + 0.02 && lz < Z + DOOR.reach + 0.035 && lz > Z - 0.3; } });
    }
    return b;
  };
  // A building of several storeys: each lower roof is a skirt whose ridge hides inside the storey above,
  // and each upper storey starts where that skirt meets its walls.
  const putStack = (storeys, at, q = 0, lvl = 0) => {
    let first, foot = 0;
    storeys.forEach((st, i) => {
      const next = storeys[i + 1], o = i ? { platOut: 0.05, dark: false, steps: 0, ...st, platH: foot - 0.08, platBase: foot - 0.4 } : { ...st };
      if (next) { o.overhang = o.overhang ?? 2.4; o.G = o.xs[o.xs.length - 1] + o.overhang - next.xs[next.xs.length - 1] + 0.4; }
      const b = put(o, at, q, lvl); first = first || b;
      if (next) foot = b.roofAt(b.EZ - next.zs[0]);
    });
    return first;
  };
  const putTwo = (lower, upper, at, q = 0, lvl = 0) => putStack([lower, upper], at, q, lvl);

  // ---- Buildings, from the gate uphill ----
  putTwo({   // the gate: you pass through its middle bay, under an upper storey
    xs: [-9.6, -6.0, -2.2, 2.2, 6.0, 9.6], zs: [3, -3], platH: 0.5, platOut: 1.2, colTop: 4.3, overhang: 2.0, rise: 2.2,
    front: "pass", back: "pass", dark: false, timber: true, steps: 4.0, stepsBack: 4.0, plaque: { text: "万年正续", gold: true },
  }, { timber: true, platOut: 0.85, rail: true, xs: [-7.0, -2.2, 2.2, 7.0], zs: [1.8, -1.8], colTop: 3.0, overhang: 2.1, rise: 3.9, G: 2.6, plaque: { text: "云径禅寺", vertical: true } }, [0, SITE.zS]);

  const strikers = [];
  for (const sx of [-1, 1]) {   // at either end of the gate, completing its five roofs: the bell (east) and the drum (west)
    const t = put({
      xs: [-1.7, 1.7], zs: [1.7, -1.7], platH: 0.6, platOut: 0.9, colTop: 4.4, overhang: 1.5, rise: 3.0, G: 9, lift: 0.6, liftLen: 2.6,
      front: "open", back: "open", sides: "open", dark: false, steps: 0, plaque: { text: sx > 0 ? "钟楼" : "鼓楼", style: "wood" },
    }, [sx * 15.5, SITE.zS], 2);
    const thing = sx > 0 ? bell(M, t) : drum(M, t);
    t.group.add(thing.group); strikers.push({ kind: sx > 0 ? "bell" : "drum", mesh: thing.hit, swing: thing.swing, rope: thing.rope || null, gap: LOG.gap });
    // The log that strikes the bell is slung out past the columns toward the gate: the eye keeps out of it too.
    if (sx > 0) { const r = walk.roofs[walk.roofs.length - 1]; r.core = { ...r.core, z0: Math.min(r.core.z0, SITE.zS - LOG.near - LOG.len - 0.1) }; }
  }
  // Facing each other across the court: the meditation hall, and the tea house.
  const side = { xs: [-8, -4.8, -1.6, 1.6, 4.8, 8], zs: [2.4, -2.4], platH: 0.45, platOut: 1.0, colTop: 3.6, overhang: 1.7, rise: 3.0, G: 2.2, lamps: false, steps: 3.0 };
  put({ ...side, plaque: { text: "禅堂", style: "wood" }, hall: { id: "chan", kind: "chan", name: "禅堂" } }, [16.6, 14], 3);
  // The tea house's porch is deeper than its neighbour's: wide enough to walk round the two tables set under its eave.
  const tea = put({ ...side, platOut: 1.6, plaque: { text: "吃茶去", style: "wood" }, hall: { id: "tea", kind: "tea", name: "茶寮" } }, [-16.6, 14], 1);
  {   // a low table set for tea under its eave, against the wall: an iron kettle, a whisk, bowls of black glaze, a straw cushion at either end
    const y = tea.platH, z = tea.frontZ + 0.37, parts = { wood: [], glaze: [], iron: [], straw: [] };
    for (const x of [-4.9, 4.9]) {
      parts.wood.push(box(1.5, 0.06, 0.52, x, y + 0.34, z), box(0.07, 0.31, 0.44, x - 0.62, y + 0.155, z), box(0.07, 0.31, 0.44, x + 0.62, y + 0.155, z));
      for (const dx of [-0.42, 0, 0.42]) parts.glaze.push(lathe([[0, 0.012], [0.035, 0], [0.04, 0.012], [0.075, 0.05], [0.082, 0.062], [0.076, 0.062], [0.03, 0.02], [0, 0.02]], 14).translate(x + dx, y + 0.37, z + 0.05));
      parts.iron.push(lathe([[0, 0], [0.09, 0], [0.13, 0.05], [0.13, 0.11], [0.07, 0.16], [0.03, 0.17], [0, 0.19]], 12).translate(x + 0.55, y + 0.37, z - 0.12), new THREE.TorusGeometry(0.09, 0.008, 5, 12, Math.PI).translate(x + 0.55, y + 0.53, z - 0.12));
      parts.wood.push(new THREE.CylinderGeometry(0.012, 0.03, 0.11, 8).translate(x - 0.6, y + 0.425, z - 0.12));
      for (const dx of [-1.12, 1.12]) parts.straw.push(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 14).translate(x + dx, y + 0.04, z + 0.02));
      // The table and what stands on it are in the way, with his own width round them; the way past is outside it.
      const [ax, az] = turn(x - 0.75 - BODY, z - 0.26, 1), [bx, bz] = turn(x + 0.75 + BODY, z + 0.26 + BODY, 1);
      walk.posts.push({ x0: Math.min(ax, bx) - 16.6, x1: Math.max(ax, bx) - 16.6, z0: Math.min(az, bz) + 14, z1: Math.max(az, bz) + 14 });
    }
    tea.group.add(mesh(merge(parts.wood), M.woodX), mesh(merge(parts.glaze), M.glaze), mesh(merge(parts.iron), M.iron), mesh(merge(parts.straw), M.hide));
  }
  // Tall cryptomerias, as old as the walls: a pair before the gate, others in the courts; and the pair of young
  // evergreens that stand clear of everything in the corners before the great hall. trees.js grows them; the plan
  // only says where they stand, how tall, and that they are in the way: a trunk is a round thing as wide as it
  // is grown at the knee, where its roots still spread it.
  const cedars = [], girth = (kind, h) => (kind === "cedar" ? (h < 8 ? h * 0.2 : (0.2 + h * 0.012) * 1.75) : (0.09 + h * 0.019) * 1.8 + (kind === "maple" ? 0.1 : 0));   // a young evergreen is clothed to the knee, so it is in the way as far as its boughs reach; a maple forks low and crooked
  for (const [x, z, h, lvl] of [[-13.6, 54.4, 21, 0], [13.4, 53.8, 23, 0], [-19, 29, 19, 0], [19.6, 1.5, 20, 0], [-19.6, 0.5, 22, 0], [-15.5, 1.8, 5.2, 0], [15.5, 1.8, 5.6, 0], [-17, T1.zS - 27, 20, 1], [-17.5, T2.zS - 15, 18, 2]]) {
    cedars.push([x, lvl ? LEVELS[lvl - 1].y : 0, z, "cedar", h]);
    walk.posts.push({ x, z, r: girth("cedar", h) }); shade[lvl].push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 });
  }
  // The trees that show the season: ginkgo and maple in the courts and on the terraces. They are in the way too.
  const seasonal = [[11.5, 0, 52.5, "ginkgo", 11], [-9.5, 0, 28, "maple", 7.5], [9.5, 0, 28, "ginkgo", 9.5], [-11.5, 0, 3.5, "maple", 7], [11.5, 0, 3.5, "maple", 7.5],
    [9, T1.y, T1.zS - 5.5, "maple", 7], [-9.5, T1.y, T1.zS - 6, "ginkgo", 9], [-10.2, TOP.y, TOP.zS - 3.0, "maple", 6.5], [9.5, TOP.y, TOP.zS - 4.5, "ginkgo", 8]];
  for (const [x, , z, kind, h] of seasonal) walk.posts.push({ x, z, r: girth(kind, h) });
  // And outside the walls, on the hill, the old wood the temple was cut out of: a dark mass behind every roof.
  for (const [x, z, h] of [[-29, 60, 24], [30, 66, 22], [-34, 47, 26], [29, 44, 25], [-28, 30, 23], [30, 26, 26], [-31, 12, 25], [29, 6, 23], [-29, -8, 27], [32, -12, 24], [-36, 72, 22], [37, 54, 24],
    [-27, -30, 24], [28, -34, 26], [-40, 22, 28], [41, 34, 27], [-25, 76, 20], [-25.5, -17, 31], [25.5, -20, 32], [-26, 3, 29], [26, -3, 30], [-30, -44, 30], [31, -48, 31], [-24.5, -60, 28], [25, -64, 29]]) cedars.push([x, terrain(x, z) - 0.3, z, "cedar", h, true]);   // `true`: seen only from afar, so grown without the branches inside its boughs

  const mz = -14.6;   // the main hall: double-eaved, seven bays, the largest roof in the temple
  const main = putTwo({
    xs: [-14.4, -10.2, -6.2, -2.3, 2.3, 6.2, 10.2, 14.4], zs: [8.6, 4.3, 0, -4.3, -8.6], platH: 1.5, platOut: 2.4, colTop: 4.8, overhang: 2.6, rise: 4.6, steps: 6.4, rail: true, plaque: { text: "正法眼藏", gold: true }, hall: { id: "main", kind: "buddha", name: "大雄宝殿" },
  }, { xs: [-10.2, -6.2, -2.3, 2.3, 6.2, 10.2], zs: [5.0, 0, -5.0], colTop: 1.45, front: "wall", overhang: 2.8, rise: 5.4, G: 3.6, plaque: { text: "释迦宝殿", vertical: true, band: true, hand: "shijia", style: "navy", notes: ["淳祐丁未重陽", "徑山佛鑑圓照"] } }, [0, mz]);

  putTwo({   // on the first terrace: the sutra library
    xs: [-9.4, -5.4, -1.9, 1.9, 5.4, 9.4], zs: [4.2, 0, -4.2], platH: 1.26, platOut: 1.7, colTop: 5.0, overhang: 2.6, rise: 3.0, steps: 5.2, lamps: false, hall: { id: "library", kind: "library", name: "藏经楼" },
  }, { xs: [-6.4, -2.2, 2.2, 6.4], zs: [2.6, -2.6], colTop: 3.1, overhang: 2.3, rise: 4.4, G: 2.9, plaque: "藏经楼" }, [0, T1.zS - 15], 0, 1);
  {   // the dragon well: a vaulted niche of rough stone in the wall of the next terrace, water standing in the dark
    const g = new THREE.Group(), w = 0.95;
    const niche = mesh(merge([
      box(0.6, 2.0, 1.1, -w - 0.3, 1.0, 0.55), box(0.6, 2.0, 1.1, w + 0.3, 1.0, 0.55),
      new THREE.TorusGeometry(w + 0.3, 0.32, 8, 18, Math.PI).scale(1, 1, 3.2).translate(0, 2.0, 0.55),
      box(2.6, 0.24, 0.3, 0, 0.12, 1.25),
    ]), M.rubble); niche.name = "well-niche"; g.add(niche);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.0).translate(0, 1.5, 0.06), M.dark.clone()); dark.material.side = THREE.FrontSide;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.15).rotateX(-Math.PI / 2).translate(0, 0.2, 0.62), new THREE.MeshStandardMaterial({ color: 0x0a1210, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.4 }));
    const board = makePlaque("龙井", { style: "wood" }); board.name = "well-board"; board.scale.setScalar(0.75); board.position.set(0, 3.26, 0.55 + 0.32 * 3.2 + 0.06);   // hung on the face of the arch's crown, which stands two metres deep out of the wall
    // Water seeping down the jambs, inside and out, with moss where it gathers (the pool is fed by the rock, not a spout).
    g.add(mesh(merge([-1, 1].flatMap((sx) => [new THREE.PlaneGeometry(0.5, 2.0).translate(sx * (w + 0.3), 1.0, 1.103), new THREE.PlaneGeometry(0.9, 1.9).rotateY(-sx * Math.PI / 2).translate(sx * (w - 0.003), 0.95, 0.6)])), M.seep, { ao: () => 0.6 }));
    g.add(dark, pool, board); g.position.set(13.2, T1.y, T2.zS); root.add(g);
    walk.solids.push({ x0: 11.2, x1: 15.2, z0: T2.zS, z1: T2.zS + 1.8 + BODY }, { x0: 13.2 - 1.6 - BODY, x1: 13.2 + 1.6 + BODY, z0: T2.zS - 0.5 - BODY, z1: T2.zS });   // and the crown of its arch, which stands above the terrace behind
  }

  // Flanking halls on the terraces, small and plain, as the real temple has them beside the axis.
  const wing = { xs: [-5.4, -1.8, 1.8, 5.4], zs: [2.4, -2.4], platH: 0.45, platOut: 1.0, colTop: 3.5, overhang: 1.7, rise: 2.9, G: 2.1, lamps: false, steps: 3.0 };
  put({ ...wing, plaque: { text: "药师殿", style: "navy" }, hall: { id: "yaoshi", kind: "figure", name: "药师殿" } }, [-17.0, T1.zS - 13], 1, 1);   // set back from the library's platform, so that the foot of its stair is not a slot a child must squeeze through
  put({ ...wing, plaque: { text: "大慧院", style: "wood" }, hall: { id: "dahui", kind: "patriarch", name: "大慧院" } }, [16.4, T2.zS - 12], 3, 2);

  put({   // on the second terrace: the Guanyin hall, single-eaved and quieter
    xs: [-9, -5.2, -1.8, 1.8, 5.2, 9], zs: [5, 1.7, -1.7, -5], platH: 0.9, platOut: 1.6, colTop: 4.2, overhang: 2.4, rise: 5.0, G: 3.2, steps: 4.6, plaque: { text: "观音殿", style: "wood" }, hall: { id: "guanyin", kind: "figure", name: "观音殿" },
  }, [0, T2.zS - 12.2], 0, 2);

  const topZ = TOP.zS - 12.9;   // at the summit: the pavilion that looks back over everything below
  putStack([
    { xs: [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5], zs: [7.5, 4.5, 1.5, -1.5, -4.5, -7.5], platH: 0.9, platOut: 1.4, colTop: 3.9, overhang: 2.0, rise: 2.6, steps: 3.6, lamps: false, rail: true, hall: { id: "lingxiao", kind: "pavilion", name: "凌霄阁" } },
    { xs: [-5.4, -1.8, 1.8, 5.4], zs: [5.4, 1.8, -1.8, -5.4], colTop: 3.0, overhang: 2.0, rise: 2.2, platOut: 1.0, rail: true },
    { xs: [-3.4, -1.2, 1.2, 3.4], zs: [3.4, 1.2, -1.2, -3.4], colTop: 3.0, overhang: 2.2, rise: 4.0, G: 2.4, platOut: 1.0, rail: true, plaque: { text: "凌霄阁", vertical: true, band: true, cols: 1 } },
  ], [0, topZ], 0, 3);

  // The stele pavilion beside the approach, at the end of the old path up the mountain.
  const sp = putStack([
    { xs: [-2.0, 2.0], zs: [2.0, -2.0], platH: 0.45, platOut: 0.8, colTop: 3.3, overhang: 1.5, rise: 1.3, front: "open", back: "open", sides: "open", dark: false, steps: 0 },
    { xs: [-1.2, 1.2], zs: [1.2, -1.2], colTop: 1.5, overhang: 1.5, rise: 2.5, G: 9, lift: 0.5, liftLen: 2.4, front: "wall", plaque: { text: "御碑亭", style: "wood" } },
  ], [-12.5, 50.5], 1);
  sp.group.add(mesh(merge([box(1.5, 0.5, 0.9, 0, 0.7, 0), box(1.05, 2.3, 0.26, 0, 2.1, 0), box(1.25, 0.45, 0.4, 0, 3.4, 0)]), M.monolith));

  // ---- Terraces: a stone mass, paving on top, a parapet along the front, stairs on the axis ----
  const stone = [], flights = [], paving = [];   // `flights`: the stairs, which are dressed stone and not the terraces' rubble
  LEVELS.forEach((L, i) => {
    const y0 = i ? LEVELS[i - 1].y : 0, rise = L.y - y0, st = stairGeo(L.stair, rise);
    const bottom = i === 2 ? 4 : y0 - 0.2 < 0 ? 0 : y0 - 0.2;
    stone.push(box(L.x * 2, L.y - bottom, L.zS - L.zN, 0, (L.y + bottom) / 2, (L.zS + L.zN) / 2)); flights.push(st.geo.translate(0, y0, L.zS));
    // The summit's edge is the low plaster wall built below (the same line), not a second, stone one under its tiles.
    if (i < 2) for (const sx of [-1, 1]) { const w = L.x - L.stair / 2 - 0.42; stone.push(box(w, 0.95, 0.26, sx * (L.x - w / 2), L.y + 0.475, L.zS - 0.13)); }
    paving.push({ level: i + 1, y: L.y + 0.012, x: L.x, zS: L.zS, zN: L.zN });
    const pad = BODY + 0.02;   // the treads are walked clear of the cheek stones by his own width
    walk.ramps.push({ x0: -L.stair / 2 + pad, x1: L.stair / 2 - pad, z0: L.zS - 0.8, z1: L.zS + st.run + 0.3, base: y0,   // a little past its foot, so no sliver of ground is left without a height; and past its head, through the parapet's keep
       h: rise, low: [0, L.zS + st.run], high: [0, L.zS] });
    walk.solids.push({ x0: -60, x1: 60, z0: L.zS - 0.26 - BODY, z1: L.zS + 0.5 });   // the parapet along the terrace's edge, and his width behind it
    // The cheek stones and the masonry under them, either side of every flight, with his width round their feet.
    for (const sx of [-1, 1]) walk.posts.push({ x0: sx > 0 ? L.stair / 2 - BODY - 0.021 : -L.stair / 2 - CHEEK - BODY, x1: sx > 0 ? L.stair / 2 + CHEEK + BODY : -L.stair / 2 + BODY + 0.021, z0: L.zS + 0.02, z1: L.zS + st.run + BODY + 0.06 });
    shade[i].push({ x0: -L.x, x1: L.x, z0: L.zN, z1: L.zS });
  });
  walk.solids.push({ x0: -60, x1: 60, z0: HILL.zN, z1: HILL.zS - 0.05, open: true });   // the hillside itself: not to be walked on, but open air above it
  {   // the approach: lower landing, a flight west to the half-way pavilion, a turn, a flight north to the forecourt
    const A = APPROACH, yA = -A.rise, yB = -A.rise - A.rise2, pad = 0.3, clear = BODY + 0.02;   // `clear`: the treads are walked this far inside the cheek stones
    flights.push(stairGeo(A.w, A.rise).geo.translate(0, yA, A.top), stairGeo(A.zA1 - A.zA0 - 0.6, A.rise2).geo.rotateY(Math.PI / 2).translate(A.xTurn, yB, A.zMid));
    stone.push(box(A.xTurn + A.w / 2 + 0.4, 0.4, A.zA1 - A.zA0, (A.xTurn - A.w / 2 - 0.4) / 2 + 0.2, yA - 0.2, A.zMid),
      box(A.xB1 - A.xB0, 0.4, A.zA1 - A.zA0, (A.xB0 + A.xB1) / 2, yB - 0.2, A.zMid));
    walk.ramps.push({ x0: -A.w / 2 + clear, x1: A.w / 2 - clear, z0: A.top - 0.4, z1: A.zA0 + 0.2, base: yA, h: A.rise, low: [0, A.zA0], high: [0, A.top] },
      { x0: A.xTurn - 0.2, x1: A.xB0 + 0.2, z0: A.zA0 + 0.3 + clear, z1: A.zA1 - 0.3 - clear, base: yB, h: A.rise2, low: [A.xB0, A.zMid], high: [A.xTurn, A.zMid] });
    // The cheeks of the three flights, closed to him where they stand on a landing or beside a tread.
    const w2 = (A.zA1 - A.zA0 - 0.6) / 2;
    for (const s of [-1, 1]) walk.posts.push(
      { x0: s > 0 ? A.w / 2 - BODY - 0.021 : -A.w / 2 - CHEEK - BODY, x1: s > 0 ? A.w / 2 + CHEEK + BODY : -A.w / 2 + BODY + 0.021, z0: A.top + 0.02, z1: A.zA0 + BODY + 0.06 },
      { x0: A.xTurn + 0.02, x1: A.xB0 + BODY + 0.06, z0: s > 0 ? A.zMid + w2 - BODY - 0.021 : A.zMid - w2 - CHEEK - BODY, z1: s > 0 ? A.zMid + w2 + CHEEK + BODY : A.zMid - w2 + BODY + 0.021 },
      { x0: s > 0 ? A.xC + A.w / 2 - BODY - 0.021 : A.xC - A.w / 2 - CHEEK - BODY, x1: s > 0 ? A.xC + A.w / 2 + CHEEK + BODY : A.xC - A.w / 2 + BODY + 0.021, z0: A.zA1 + 0.02, z1: A.zC0 + BODY + 0.06 });
    // Landings overlap the flights that reach them by a hand's width, so there is never a seam to fall into.
    walk.decks.push({ x0: -A.w / 2 + pad, x1: A.xTurn + 0.2, z0: A.zA0 - 0.05, z1: A.zA1 - pad, h: yA }, { x0: A.xB0, x1: A.xB1 - pad, z0: A.zA0 + pad, z1: A.zA1 + 0.2, h: yB });
    // Below that, a third flight coming up from the south, from the landing where the walk begins.
    const yC = yB - A.rise3;
    flights.push(stairGeo(A.w, A.rise3).geo.translate(A.xC, yC, A.zA1)); stone.push(box(A.xB1 + 5.2 - A.xB0, 0.4, A.zC1 - A.zC0, (A.xB0 + A.xB1 + 5.2) / 2, yC - 0.2, (A.zC0 + A.zC1) / 2));
    walk.ramps.push({ x0: A.xC - A.w / 2 + clear, x1: A.xC + A.w / 2 - clear, z0: A.zA1 - 0.4, z1: A.zC0 + 0.2, base: yC, h: A.rise3, low: [A.xC, A.zC0], high: [A.xC, A.zA1] });
    walk.decks.push({ x0: A.xB0 + pad, x1: A.xB1 + 2.6, z0: A.zC0, z1: A.zC1 - pad, h: yC });
    walk.solids.push({ x0: -80, x1: 80, z0: A.top + 0.3, z1: A.end + 8, open: true });   // the grove either side of the path: no way through, but nothing solid
    // Three open pavilions mark the climb, as pavilions mark the old path: somewhere to stop and look back.
    const rest = { xs: [-1.5, 1.5], zs: [1.5, -1.5], platH: 0.3, platOut: 0.8, colTop: 3.0, overhang: 1.3, rise: 2.3, G: 9, lift: 0.5, liftLen: 2.2,
      brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 0, walkAll: true };
    // The half-way pavilion stands on the downhill side of the landing, on a podium built out over the slope:
    // level ground under every column, and the valley to look at.
    put({ ...rest, plaque: { text: "半山亭", style: "wood" } }, [5.2, A.zA1 + 2.75], 2, 0, yA);
    stone.push(box(5.0, 4.0, 5.7, 5.2, yA - 2.0, A.zA1 + 2.65));
    walk.decks.push({ x0: 3.2, x1: 7.2, z0: A.zA1 - 0.4, z1: A.zA1 + 0.6, h: yA });   // the step between its floor and the landing
    put({ ...rest, plaque: { text: "望江亭", style: "wood" } }, [A.xB1 + 2.9, (A.zC0 + A.zC1) / 2 + 0.2], 1, 0, yC);
    // The pool where Su Shi, climbing to the temple, washed his ink-stone (the county gazetteer: outside the gate, its
    // water clear, the ripples glinting on a still moonlit night as though there were ink in them), beside the second
    // landing: clear water in a tank of dressed stone, and behind it, facing the stair, a small stele with its name cut
    // and inked in the stone.
    const px = A.xB1 + 2.2, pz = A.zMid, sx = px + 1.95;
    stone.push(box(3.3, 3.0, 2.6, px, yB - 1.55, pz), box(1.1, 3.2, 0.9, sx, yB - 1.6, pz));   // the tank standing out of the slope, and the stele's footing behind it
    stone.push(box(3.3, 0.2, 0.3, px, yB + 0.05, pz + 1.15), box(3.3, 0.2, 0.3, px, yB + 0.05, pz - 1.15), box(0.3, 0.2, 2.0, px + 1.5, yB + 0.05, pz), box(0.3, 0.2, 2.0, px - 1.5, yB + 0.05, pz));   // its rim, the water standing a hand below it
    stone.push(box(0.5, 0.3, 0.9, sx, yB + 0.15, pz), box(0.24, 1.42, 0.62, sx, yB + 1.01, pz), box(0.32, 0.1, 0.74, sx, yB + 1.77, pz));   // plinth, slab and a thin cap
    const ink = mesh(new THREE.PlaneGeometry(2.7, 2.0, 8, 6).rotateX(-Math.PI / 2).translate(px, yB + 0.02, pz), M.inkpool, { ao: () => 0.7 }); ink.name = "inkpool"; ink.userData.keep = true;
    const tag = makePlaque("洗砚池", { vertical: true, style: "stone" }); tag.name = "inkpool-stele"; tag.scale.setScalar(0.55); tag.position.set(sx - 0.14, yB + 1.0, pz); tag.rotation.y = -Math.PI / 2;
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
  const body = [[], [], [], []], ridge = [], capPos = [], capUv = [], capIdx = [], T = 0.42;
  function wall(x0, z0, x1, z1, lvl = 0, H = SITE.wallH) {
    const y = lvl ? LEVELS[lvl - 1].y : 0, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    // The tiles sit on the wall: at the wall's two faces their underside is H + 0.338 above its foot, so the plaster is
    // carried up to there and no sky shows between the two. The eaves stay where they were (out of his reach).
    const Hb = H + 0.33;
    body[lvl].push(box(alongX ? len : T, Hb, alongX ? T : len, (x0 + x1) / 2, y + Hb / 2, (z0 + z1) / 2));
    ridge.push(box(alongX ? len : 0.16, 0.14, alongX ? 0.16 : len, (x0 + x1) / 2, y + H + 0.5, (z0 + z1) / 2));
    for (const s of [-1, 1]) {   // two tiled slopes
      const b = capPos.length / 3;
      for (const [l, yy, o] of [[0, H + 0.46, 0], [len, H + 0.46, 0], [len, H + 0.1, s * 0.62], [0, H + 0.1, s * 0.62]]) {
        capPos.push(alongX ? Math.min(x0, x1) + l : x0 + o, y + yy, alongX ? z0 + o : Math.min(z0, z1) + l); capUv.push(l, o === 0 ? 0.72 : 0);
      }
      capIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
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
    root.add(mesh(tiles(cp, cu, ci), M.tile));
    // Both faces: a panel of diamond-laid grey brick in a frame of pale stone, the four characters gilt upon it, as on the real wall.
    for (const s of [-1, 1]) { const p = makeWallPanel("双径归堂", w - 1.3, h - 1.05); p.position.set(0, 0.5 + (h - 0.5) / 2 - 0.02, z + s * 0.36); if (s < 0) p.rotation.y = Math.PI; root.add(p); }
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
  const cushion = () => lathe([[0, 0], [0.25, 0], [0.288, 0.028], [0.292, 0.06], [0.262, 0.092], [0.1, 0.104], [0, 0.104]], 28);
  // A tea table on the court before the tea house, as tea was taken in these monasteries: a table and stools, a ewer
  // of hot water, black bowls on stands. Whoever sits at it looks across the wet stone to the great hall.
  const TEA_T = 0.78, TEA_BOWL = 0.11;   // the table's height; how far from its middle, toward him, his bowl stands
  const teaSeat = [-10.3, 22.6], teaDir = [0 - teaSeat[0], mz + main.zF - teaSeat[1]], teaTurn = Math.atan2(-teaDir[0], -teaDir[1]);
  const teaFrom = (lx, lz) => [teaSeat[0] + lx * Math.cos(teaTurn) + (lz - 0.62) * Math.sin(teaTurn), teaSeat[1] - lx * Math.sin(teaTurn) + (lz - 0.62) * Math.cos(teaTurn)];   // the mat's own frame: he sits at (0, 0.62) and looks toward -z
  {
    const P = { straw: [], wood: [], glaze: [], iron: [], lacquer: [] }, y = 0;
    const bowl = () => lathe([[0, 0.012], [0.03, 0], [0.036, 0.012], [0.07, 0.048], [0.078, 0.06], [0.072, 0.06], [0.028, 0.02], [0, 0.02]], 24);
    const T = TEA_T, stool = () => lathe([[0, 0], [0.17, 0], [0.2, 0.06], [0.215, 0.22], [0.2, 0.38], [0.17, 0.44], [0, 0.44]], 20);
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
    // One branch in a bottle, on the table.
    P.glaze.push(lathe([[0, 0], [0.034, 0], [0.05, 0.05], [0.04, 0.12], [0.014, 0.17], [0.017, 0.2], [0.012, 0.2], [0, 0.17]], 18).translate(0.46, 0.78, -0.38));
    P.wood.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0.17, 0], [0.01, 0.34, 0.01], [-0.05, 0.5, 0.03], [-0.02, 0.66, -0.04], [-0.12, 0.8, -0.02]].map((v) => new THREE.Vector3(v[0] + 0.46, v[1] + 0.78, v[2] - 0.38))), 18, 0.006, 6),
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.05, 0.5, 0.03], [0.04, 0.58, 0.1], [0.1, 0.7, 0.13]].map((v) => new THREE.Vector3(v[0] + 0.46, v[1] + 0.78, v[2] - 0.38))), 10, 0.004, 5));
    const o = teaFrom(0, 0), mats = { straw: M.straw, wood: M.woodX, glaze: M.glaze, iron: M.iron, lacquer: M.lacquer };
    for (const k in P) root.add(mesh(merge(P[k]).rotateY(teaTurn).translate(o[0], 0, o[1]), mats[k]));
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
  root.add(mesh(cushion().translate(0, porchY, porchZ), M.straw));
  // Whatever can be sat on out of doors: the three stools at the tea table (each turned to the table) and the mat on
  // the summit porch. `top` is the height of the seat. The rooms add their own (interior.js); game.js offers them.
  const seats = [[0, 0.62], [0.95, -0.12], [0, -0.86]].map(([lx, lz]) => { const p = teaFrom(lx, lz), c = teaFrom(0, -0.12); return { at: p, top: 0.44, face: Math.atan2(c[0] - p[0], c[1] - p[1]), room: null }; });
  seats.push({ at: [0, porchZ], top: porchY + 0.104, face: 0, room: null });
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

  // ---- Named views: one per thing worth looking at. The screenshot tool renders each of them. ----
  const A = APPROACH;
  const views = {
    arrive: [A.xC, A.zC1 - 1.2, 0, 0.3], pool: [A.xC - 0.5, A.zA1 - 1.2, 0.9, -0.12], second: [A.xB1 - 1.6, A.zMid, -Math.PI / 2, 0.2], halfway: [9.4, A.zMid - 1.2, -2.2, 0.1], stair: [0, A.zA0 - 0.6, 0, 0.3],
    forecourt: [10.5, 60, -0.42, 0.07], front: [0, 62.5, 0, 0.3], fiveroofs: [9.5, 61.5, -0.4, 0.2], screen: [3, 47.5, Math.PI - 0.3, 0.1], stele: [-4, 52, -1.25, 0.12], gate: [0, 49.5, 0, 0.2],
    court: [0, 29, 0, 0.1], bell: [10.5, 33.5, 2.5, 0.22], drum: [-10.5, 33.5, -2.5, 0.22], teatable: [-10.5, 17.5, -1.9, -0.12], hall: [9.5, 17, -0.5, 0.14], plaque: [0, 6, 0, 0.5],
    teahouse: [-5, 16, -1.35, 0.1], chan: [5, 16, 1.35, 0.1], behind: [19, -22, 0.4, 0.14], terrace: [0, T1.zS + 5.6, 0, 0.25],
    library: [0, T1.zS - 2.5, 0, 0.22], well: [11.6, T2.zS + 5.5, 0.28, 0.1], guanyin: [0, T2.zS + 5, 0, 0.22], yaoshi: [-4, T1.zS - 5.5, -1.0, 0.12], dahui: [4, T2.zS - 3.6, 1.0, 0.12], climb: [0, T2.zN + 1, 0, 0.45],
    tea: [0, HILL.zS - 12, 0.6, 0.12], summit: [0, TOP.zS + 9, 0, 0.42], lookback: [0, topZ + 7.5 + 0.8, Math.PI, -0.2],
    // The six fixed views the T00 handoff is judged by (docs/t00/camera-manifest.json): bamboo start, stair turn,
    // before the screen wall, the gate once round it, back through the gate, the first court.
    cam01: [A.xC, A.zC1 - 1.2, 0, 0.3], cam02: [A.xB0 + 1.6, A.zMid + 0.9, -1.35, 0.16], cam03: [0, 63.8, 0, 0.14], cam04: [6.6, 53.4, -0.42, 0.3], cam05: [0.6, 37.6, Math.PI, 0.08], cam06: [0, 29, 0, 0.1],
    teamat: [-7.6, 25.6, -0.72, -0.2], lamps: [-5.4, T2.zS - 1.0, -0.25, -0.22], desk: [1.2, deskAt[1] + 0.62, 1.25, -0.25], cushion: [2.6, TOP.zS - 1.2, 0.5, 0.2],
  };

  return { root, walk, shade, paving, hall, halls, buildings, views, places, seats, cedars, trees: [...seasonal, ...cedars], strikers, start: views.arrive, censer: new THREE.Vector3(0, 0, 13), sunFocus: [0, -25], summitPorch: [0, topZ + 7.5 + 0.8] };
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
export function createWalker(site) {
  const { solids, decks, ramps, posts = [], roofs = [] } = site.walk;
  const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  // What stands in the way even on a floor: a round thing keeps his centre its own radius and his width away (`pad`);
  // a square one was drawn that much larger where it was put down. They are sorted into two-metre squares, so that
  // asking about one spot looks at a handful and not at every column in the temple.
  const CELL = 2, bins = new Map(), key = (i, j) => i * 4096 + j;
  for (const s of posts) {
    const x0 = s.r !== undefined ? s.x - s.r - BODY : s.x0, x1 = s.r !== undefined ? s.x + s.r + BODY : s.x1, z0 = s.r !== undefined ? s.z - s.r - BODY : s.z0, z1 = s.r !== undefined ? s.z + s.r + BODY : s.z1;
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = key(i, j); (bins.get(k) || bins.set(k, []).get(k)).push(s); }
  }
  const post = (x, z, pad) => { const list = bins.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!list) return false;
    for (const s of list) { if (s.r !== undefined) { const dx = x - s.x, dz = z - s.z, r = s.r + pad; if (dx * dx + dz * dz < r * r) return s; } else if (inRect(s, x, z)) return s; }
    return null; };
  function carved(x, z, even) {   // a floor or stair of a building or terrace, if you are on one (`even`: a stair as the slope it follows)
    let height = null;
    const take = h => { height = height === null ? h : Math.max(height, h); };
    for (const d of decks) if (inRect(d, x, z)) take(d.h);
    for (const r of ramps) if (inRect(r, x, z)) {
      const dx = r.high[0] - r.low[0], dz = r.high[1] - r.low[1];
      // A stair is steps, not a slope: he stands on the tread he is over, so his feet never sink into the stone.
      const { count: n, nosing } = stairProfile(r.h), run = Math.hypot(dx, dz);
      const f = Math.min(1, Math.max(0, ((x - r.low[0]) * dx + (z - r.low[1]) * dz) / (run * run) + nosing / run));
      take((r.base || 0) + r.h * (even ? f : Math.ceil(f * n - 1e-6) / n));
    }
    return height;
  }
  function level(x, z) { if (z > SITE.fore + 0.3) return terrainLevel(x, z); for (const L of LEVELS) if (Math.abs(x) < L.x && z < L.zS && z > L.zN) return L.y; return 0; }
  // Indoors the plan is set aside: a room is one level floor inside four walls, with its own things in the way.
  let room = null;
  const shut = (x, z) => x < room.x0 || x > room.x1 || z < room.z0 || z > room.z1 || room.solids.some((s) => inRect(s, x, z));
  const wall = (x, z) => { if (room) return shut(x, z); if (post(x, z, 0.15)) return true; if (carved(x, z) !== null) return false; for (const s of solids) if (!s.open && inRect(s, x, z)) return true; return false; };
  return {
    setRoom(r) { room = r || null; }, get room() { return room; },
    heightAt(x, z) { if (room) return room.y; const c = carved(x, z); return c === null ? level(x, z) : c; },
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
    eyeShut(x, y, z, foot) {
      if (room) return shut(x, z);
      for (const r of roofs) if (y < r.top && inRect(r, x, z) && y > (inRect(r.core, x, z) ? r.inner : r.bottom)) return true;
      // A square post is a low thing drawn wide by his body (a table, the cheek of a stair): in the way only of an eye
      // that has come down near the floor it stands on, as it does looking up.
      const p = post(x, z, 0.15);
      if (p) { if (p.r !== undefined) return p.r < 0.45 ? "post" : true; const c = carved(x, z); if (y < (c === null ? level(x, z) : c) + 1.1) return true; }
      if (carved(x, z) !== null) return false;
      // He stands on a terrace: the eye stays over it too, and does not step out past its edge to look back at him along
      // the wall's outer face. Past the front edge it may be only where the wall is open to the stair (the view back down
      // the flight); over the stair itself it has been let through above, as carved floor.
      for (const L of LEVELS) if (Math.abs(foot - L.y) < 0.6 && (Math.abs(x) > L.x || z < L.zN || (z > L.zS && Math.abs(x) > L.stair / 2 + 0.5))) return true;
      let top = -Infinity, own = false;
      for (const r of roofs) if (r.body && inRect(r.body, x, z)) top = Math.max(top, inRect(r.core, x, z) ? r.top : r.edge);
      for (const s of solids) if (!s.open && inRect(s, x, z)) { if (s.own) own = true; else top = Math.max(top, foot + 5.5); }
      if (own && top === -Infinity) top = foot + 5.5;   // the cheeks of a building's stair, beyond its platform
      return y < top;
    },
    onGround: (x, z) => !room && carved(x, z) === null,
    onStairs: (x, z) => !room && ramps.some(r => inRect(r, x, z) && carved(x, z) <= (r.base || 0) + r.h + 0.01),
    blocked(x, z) {
      if (room) return shut(x, z);
      if (post(x, z, BODY)) return true;   // a column, a table, the cheek of a stair: in the way even on a floor
      if (carved(x, z) !== null) return false;
      if (Math.abs(x) > SITE.x + 8 || z < SITE.zN || z > APPROACH.end) return true;
      if (z > SITE.zS && Math.abs(x) > 20.5) return true;                                  // the grove closes in on both sides of the forecourt
      for (const s of solids) if (inRect(s, x, z)) return true;
      return false;
    },
  };
}
