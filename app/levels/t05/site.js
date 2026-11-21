// 奉明寺 (T05, the first chapter after the prologue), as a white box (#409, docs/t05/PLAN.md item 5): the court between the
// Wuliang hall and the great hall, the great hall's 3 m platform, the terrace before it and the flight up, walled round,
// and a paved way from the outer gate's place far to the south. The great hall itself, its seven Buddhas and the axis of
// gates and halls come in later items (6 to 10). Every size here, and whether it is a published measurement, a summary
// or our own proposal, is in docs/t05/SITE.md and docs/t05/SOURCES.md.
//
// Heights are taken from the court's paving (y = 0; SITE.md §4.2), so the platform, the terrace and the hall's floor are
// at +3.0. x runs east, z south; the great hall's front column line is z = 0.
import * as THREE from "three";
import { box, merge, mesh, stairGeo, stairProfile, BODY, CHEEK } from "../../src/geo.js";
import { createPlanWalker } from "../../src/plan-walker.js";
import { buildAxis, HALL_HALF, LANE } from "./axis.js";

/** The great hall's platform (SITE.md §3.1, S03/S10: 55.80 × 25.91 m, about 3 m high), its south edge just before the front columns. */
export const PLATFORM = Object.freeze({ w: 55.8, d: 25.91, h: 3.0, zS: 0.4 });
/** The terrace before it (SITE.md §3.1, S10/S22, a summary: about 37 × 15 m), from the platform's south edge. */
export const TERRACE = Object.freeze({ w: 37, d: 15, zN: 0.4, zS: 15.4 });
/** The flight up the terrace's middle (SITE.md §6: proposed 8–10 m wide, about 18 steps; stairGeo lays 0.18 m steps, so 17). */
export const FLIGHT = Object.freeze({ w: 9, rise: PLATFORM.h });
/** The compound's walls (our proposal: OSM gives no outline for them, SITE.md §2); the south one stops at the Wuliang hall's platform, `gate` either side of the axis (./axis.js). */
export const COMPOUND = Object.freeze({ x: 42, zN: -40, zS: 62, h: 3.2, t: 0.8, gate: HALL_HALF });
/** The way from the outer gate's place (PLAN item 5: the arrival stays where it is, 0, +215), between the walls of ./axis.js: x is the walls' centre, wallH the forecourt's, south of the outer gate. */
export const WAY = Object.freeze({ x: LANE.hw, zS: 221, wallH: 1.2, t: LANE.t });
/** Where he arrives, and the two stations of SITE.md §5 this item reaches: A in the court, B on the terrace. */
export const ARRIVE = [0, 215];
export const STATION = Object.freeze({ A: [0, 55], B: [0, TERRACE.zS - 1] });   // SITE.md puts B at z = +17, past the terrace's 15 m; it stands 1 m inside the edge
/** The parapet round the platform and the terrace (SITE.md §6: a railing or a low wall; a low wall here). */
const PARAPET = Object.freeze({ h: 0.85, t: 0.25 });

export function buildSite(M) {
  const root = new THREE.Group();
  const walk = { solids: [], decks: [], ramps: [], posts: [], drops: [], roofs: [], rails: [] }, shade = [[], []];
  const stone = [], plaster = [], steps = [], earth = [];
  const P = PLATFORM, T = TERRACE, F = FLIGHT, C = COMPOUND, W = WAY, top = P.h;
  const pX = P.w / 2, pN = P.zS - P.d, tX = T.w / 2;

  // The platform and the terrace: two masses of stone, their tops one floor.
  stone.push(box(P.w, top, P.d, 0, top / 2, P.zS - P.d / 2), box(T.w, top, T.d, 0, top / 2, (T.zN + T.zS) / 2));
  walk.decks.push({ x0: -pX, x1: pX, z0: pN, z1: P.zS, h: top, floor: "stone" }, { x0: -tX, x1: tX, z0: T.zN - 0.01, z1: T.zS, h: top, floor: "stone" });
  shade[0].push({ x0: -pX, x1: pX, z0: pN, z1: P.zS }, { x0: -tX, x1: tX, z0: T.zN, z1: T.zS });

  // The flight down the terrace's south face, its head at the terrace's edge.
  const flight = stairGeo(F.w, F.rise), run = flight.run ?? stairProfile(F.rise).run;
  const at = new THREE.Matrix4().makeTranslation(0, 0, T.zS);
  steps.push(flight.geo.applyMatrix4(at)); (root.userData.flights ||= []).push({ w: F.w, rise: F.rise, sides: [-1, 1], m: at });
  const pad = BODY + 0.02;   // the treads are walked clear of the cheek stones by his own width
  walk.ramps.push({ x0: -F.w / 2 + pad, x1: F.w / 2 - pad, z0: T.zS - 0.8, z1: T.zS + run + 0.3, base: 0, h: F.rise, low: [0, T.zS + run], high: [0, T.zS], floor: "stone" });
  for (const sx of [-1, 1]) walk.posts.push({ x0: sx > 0 ? F.w / 2 - BODY - 0.021 : -F.w / 2 - CHEEK - BODY, x1: sx > 0 ? F.w / 2 + CHEEK + BODY : -F.w / 2 + BODY + 0.021, z0: T.zS + 0.02, z1: T.zS + run + BODY + 0.06, h: top });

  // The parapet along every outer edge of the platform and the terrace, open where the flight comes up.
  const open = F.w / 2 + CHEEK;
  const runs = [
    [-pX, pN, pX, pN], [-pX, pN, -pX, P.zS], [pX, pN, pX, P.zS],          // the platform's back and its two ends
    [-pX, P.zS, -tX, P.zS], [tX, P.zS, pX, P.zS],                         // its front either side of the terrace
    [-tX, T.zN, -tX, T.zS], [tX, T.zN, tX, T.zS],                         // the terrace's sides
    [-tX, T.zS, -open, T.zS], [open, T.zS, tX, T.zS],                     // its front either side of the flight
  ];
  for (const [x0, z0, x1, z1] of runs) {
    const along = x0 === x1 ? "z" : "x", len = along === "x" ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const inX = along === "z" ? -Math.sign(x0) * PARAPET.t / 2 : 0, inZ = along === "x" ? (z0 === pN ? PARAPET.t / 2 : -PARAPET.t / 2) : 0;
    const cx = (x0 + x1) / 2 + inX, cz = (z0 + z1) / 2 + inZ;
    stone.push(along === "x" ? box(len, PARAPET.h, PARAPET.t, cx, top + PARAPET.h / 2, cz) : box(PARAPET.t, PARAPET.h, len, cx, top + PARAPET.h / 2, cz));
    const r = along === "x" ? { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: cz - PARAPET.t / 2, z1: cz + PARAPET.t / 2 } : { x0: cx - PARAPET.t / 2, x1: cx + PARAPET.t / 2, z0: Math.min(z0, z1), z1: Math.max(z0, z1) };
    walk.posts.push({ x0: r.x0 - BODY, x1: r.x1 + BODY, z0: r.z0 - BODY, z1: r.z1 + BODY, h: top });   // drawn wider by his width
    walk.rails.push({ ...r, bottom: top, top: top + PARAPET.h });
  }
  // Below the platform's edge the court is not walked into the stone: the mass itself, with his width round it.
  walk.solids.push({ x0: -pX - BODY, x1: pX + BODY, z0: pN - BODY, z1: P.zS + BODY, top }, { x0: -tX - BODY, x1: tX + BODY, z0: T.zN, z1: T.zS + BODY, top });

  // The compound's walls: plaster on a stone plinth, with the gap of a gate in the south one.
  const wall = (x0, z0, x1, z1, h, t) => {
    const along = z0 === z1 ? "x" : "z", len = along === "x" ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    plaster.push(along === "x" ? box(len, h, t, cx, h / 2, cz) : box(t, h, len, cx, h / 2, cz));
    stone.push(along === "x" ? box(len + 0.2, 0.35, t + 0.2, cx, 0.175, cz) : box(t + 0.2, 0.35, len + 0.2, cx, 0.175, cz));
    const r = along === "x" ? { x0, x1, z0: cz - t / 2, z1: cz + t / 2 } : { x0: cx - t / 2, x1: cx + t / 2, z0, z1 };
    walk.solids.push({ x0: r.x0 - BODY, x1: r.x1 + BODY, z0: r.z0 - BODY, z1: r.z1 + BODY, eyeTop: h + 0.3 });
    shade[along === "z" || z0 < 62 ? 0 : 1].push(r);
  };
  wall(-C.x, C.zN, C.x, C.zN, C.h, C.t); wall(-C.x, C.zN, -C.x, C.zS, C.h, C.t); wall(C.x, C.zN, C.x, C.zS, C.h, C.t);
  wall(-C.x, C.zS, -C.gate, C.zS, C.h, C.t); wall(C.gate, C.zS, C.x, C.zS, C.h, C.t);
  walk.decks.push({ x0: -C.x, x1: C.x, z0: C.zN, z1: C.zS + 0.2, h: 0, floor: "paving" });

  // The axis before the court (./axis.js): the way from the outer gate's place, the second terrace that the inner gate, the
  // archway and the Wuliang hall stand on, the walls round both, and the places held for the monument pavilion and the lamp.
  const ax = buildAxis(M, { C, W });
  stone.push(...ax.stone); plaster.push(...ax.plaster);
  for (const k of ["solids", "decks", "ramps", "posts", "roofs"]) walk[k].push(...ax.walk[k]);
  shade[0].push(...ax.shade[0]); shade[1].push(...ax.shade[1]);
  const paving = ax.paving;

  // The town's plain round the walls (the county is flat, SITE.md §4.1), laid outside the walls only: inside them is the paving.
  const lift = 0.06, flat = (x0, x1, z0, z1) => earth.push(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, lift, (z0 + z1) / 2));
  for (const r of ax.outside) flat(...r);

  root.add(ax.group);
  root.add(mesh(merge(stone), M.stone), mesh(merge(steps), M.steps), mesh(merge(plaster), M.plaster()));
  const land = mesh(merge(earth), M.earth, { cast: false }); land.userData.walk = false; root.add(land);

  const buildings = [{ name: "台基", x0: -pX, x1: pX, z0: pN, z1: P.zS, y: 0 }, { name: "月台", x0: -tX, x1: tX, z0: T.zN, z1: T.zS, y: 0 }, ...ax.buildings];
  // Named views (shots.js draws each): the arrival, the two stations, and the court seen from the terrace.
  const views = {
    arrive: [ARRIVE[0], ARRIVE[1], 0, 0.05],
    a: [STATION.A[0], STATION.A[1], 0, 0.19],          // SITE.md §5.1: a 50° lens raised 11° holds the platform to the ridge
    b: [STATION.B[0], STATION.B[1], 0, 0.3],
    ...ax.views,
    gateway: [0, C.zS + 6, 0, 0.08],
    terrace: [12, 8, -0.6, 0.05],
    back: [0, 6, Math.PI, -0.08],
  };
  return {
    root, walk, shade, closed: ax.closed, paving, hall: null, halls: [], buildings, lofts: {}, doorways: {}, views, viewUp: {},
    places: {}, seats: [], drawnSeats: [], cedars: [], trees: [], strikers: [], start: views.arrive, censer: null, sunFocus: [0, 10],
  };
}

/** The walker of the written plan: the one that knows no level, over this plan's rectangles (app/src/plan-walker.js). */
export const createWalker = createPlanWalker;
