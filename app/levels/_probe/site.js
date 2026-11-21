// The probe level's plan: a flat plot and one open pavilion, with no art. It exists to show that the engine stands on
// its own, asking a level for everything and a temple for nothing (docs/t05/LEVEL-SPLIT.md S7). It is known only to the
// workbench (app/src/bench.js), and nothing in it is a temple: no screen wall, no bamboo, no summit, no seals. 1 unit = 1 m,
// north is -z, the visitor arrives from the south and the pavilion stands before him. Its written plan is walked by the
// walker that knows no level (app/src/plan-walker.js).
import * as THREE from "three";
import { BODY, box, merge, mesh } from "../../src/geo.js";
import { PURLIN, buildHall } from "../../src/building.js";

/** The plot: the walls of the walk, not drawn. */
export const PLOT = { x: 30, zN: -40, zS: 40 };

// The open pavilion on the axis, built by the same generator every hall is, on two steps and four columns.
const PAVILION = { cai: 0.186, xs: [-1.5, 1.5], zs: [1.5, -1.5], platH: 0.3, platOut: 0.8, colTop: 3.0, overhang: 1.3, crest: 2.3, G: 9, lift: 0.5, liftLen: 2.2,
  brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 2.6, walkAll: true, plaque: { text: "试亭", style: "wood" } };
const AT = [0, -8];

export function buildSite(M) {
  const root = new THREE.Group();
  const walk = { solids: [], decks: [], ramps: [], posts: [], drops: [], roofs: [], rails: [] }, shade = [[], [], [], []];
  // How high a roof's ridge stands over its eave purlins, as T00's plan works it out for an open pavilion (a quarter more than a third of the depth).
  const deep = PAVILION.zs[0] - PAVILION.zs[1], rise = (deep + (2 * PURLIN * 0.186) / 0.21) * 0.27;
  const b = buildHall(M, { ...PAVILION, rise, ground: 0 });
  b.group.position.set(AT[0], 0, AT[1]); root.add(b.group);
  // Nothing here is turned: every rectangle only moves. The plan walker takes rectangles, so a round column is the square that holds it and his width.
  const at = (r) => ({ ...r, x0: r.x0 + AT[0], x1: r.x1 + AT[0], z0: r.z0 + AT[1], z1: r.z1 + AT[1] });
  walk.decks.push({ x0: -PLOT.x, x1: PLOT.x, z0: PLOT.zN, z1: PLOT.zS, h: 0, floor: "paving" });
  for (const r of b.walk.solids) walk.solids.push(r.h === undefined ? at(r) : { ...at(r), top: r.h });
  for (const r of b.walk.decks) walk.decks.push({ ...at(r), h: r.h });
  for (const r of b.walk.ramps) walk.ramps.push({ ...at(r), base: 0 });
  for (const r of b.walk.posts) walk.posts.push(r.r !== undefined ? { x0: r.x + AT[0] - r.r - BODY, x1: r.x + AT[0] + r.r + BODY, z0: r.z + AT[1] - r.r - BODY, z1: r.z + AT[1] + r.r + BODY } : at(r));
  for (const r of b.walk.rails || []) walk.rails.push({ ...at(r), bottom: r.bottom, top: r.top });
  shade[0].push(at(b.plat));
  // The plot's ground: one slab, so that the baked floor and the eye have something to stand on.
  root.add(mesh(merge([box(PLOT.x * 2, 0.4, PLOT.zS - PLOT.zN, 0, -0.2, (PLOT.zS + PLOT.zN) / 2)]), M.monolith));
  const views = { arrive: [0, 30, 0, 0.15], pavilion: [0, 6, 0, 0.1] };
  // One place to be made for: before the pavilion's steps, facing it.
  const places = { pavilion: { at: [0, AT[1] + b.zF + b.run + 1.2], r: 1.6, face: Math.PI } };
  const buildings = [{ name: "试亭", ...at(b.plat), y: 0, rail: b.rail, frame: { xs: [...PAVILION.xs], zs: [...PAVILION.zs], sets: b.sets, cai: b.cai, parts: b.parts, corners: b.corners, cols: b.cols, ping: null, roof: b.roof, storey: 0, under: false, at: [...AT], q: 0 } }];
  return { root, walk, shade, closed: [], paving: [], halls: [], buildings, lofts: {}, doorways: {}, views, viewUp: {}, places, seats: [], drawnSeats: [], cedars: [], trees: [], strikers: [],
    start: views.arrive, censer: null, sunFocus: [0, -8], summitPorch: [0, -8] };
}
