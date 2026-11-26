// T05's own page (docs/t05/CHECKPOINTS.md §2.2, PRD.md §1.3 (a), §6): what may be put on it and where, as data for
// src/levelpage.js. Two marks for the first release, both outside the great hall (the hall and its two pages, the figures
// and the timber, come when it opens):
//   p1     整体: standing in the court and looking at the whole front for three seconds (C01), and under the eaves looking up
//          at them for two (C02), in either order; then one stroke of ink across the top of the page and a line under it.
//   stele  the line copied from the Yuan stele in the monument pavilion (./stele.js), pressing E before it.
// Nothing is counted, nothing is said to be missing, and walking past both leaves the page empty (CHECKPOINTS.md §0, §2.2).
import { STATION, TERRACE } from "./site.js";
import { STELE_TEXT } from "./stele.js";
import { HALL, ZS, XS, HALL_DOORS } from "./hall.js";

/** The edge of the front eave over the middle bay: what C02 asks to be seen. */
const EAVE = Object.freeze([0, HALL.eave, ZS[0] + HALL.overhang]);

export const PAGE = Object.freeze({
  // The observation's two looks. `at`/`r`: where he stands (within r of it, or within the box); `yaw`: which way the view
  // looks (0 is north, up the axis to the hall) and how far off it may be; `pitch`: the least the view is raised; `hold`:
  // seconds held without a break. C01's three seconds and C02's two and 25° are CHECKPOINTS.md §2.2's.
  p1: Object.freeze({
    looks: Object.freeze([
      Object.freeze({ id: "c01", at: STATION.A, r: 6, yaw: 0, off: (25 * Math.PI) / 180, pitch: -Infinity, hold: 3, place: "p1a" }),
      // Under the eaves: the flight's foot up to the platform's front, where the eaves are over him (the court within 8 m of the flight's foot, the flight, the terrace).
      // CHECKPOINTS.md asks for the view raised 25°. From behind him the eye is aimed at him (yard.js, aimAt), so the picture itself is never
      // tilted that far whatever the visitor does; what is asked instead, in either view, is what 25° was for: the front eave's edge over the
      // middle bay in the upper part of the picture (`see`, `band`: from 3% to 55% of its height down, and within its width), with the
      // view raised at all (7°). From his own eyes the view can be raised 25°, and that alone counts too (`raised`), as CHECKPOINTS.md has it.
      // (SOURCES.md §17 says so.)
      Object.freeze({ id: "c02", box: Object.freeze({ x0: -14, x1: 14, z0: 1, z1: STATION.B[1] + 3 }), yaw: 0, off: (40 * Math.PI) / 180, pitch: (7 * Math.PI) / 180, raised: (25 * Math.PI) / 180, see: EAVE, band: Object.freeze([0.03, 0.55]), hold: 2, place: "p1b" }),
    ]),
    // The line under the stroke: CHECKPOINTS.md §2.2's, word for word (our own sentence, written by the research pack; its facts: nine bays and a single-eaved hip
    // roof, SOURCES.md S03/S04; grey-blue tiles, ART.md; the platform 3 m against his 1.18 m).
    note: "九间，单檐庑殿，青灰瓦。台基比人高。",
    act: "记下",   // what the button says once both looks are met (it is offered, never done for him: the eye is not taken while he only looks)
  }),
  stele: Object.freeze({ place: "copy", lines: STELE_TEXT.lines, from: "元大德七年碑" }),
  // Where the stroke is written: he takes a step or two to the place of the look met last and writes there. Each shot is low at his
  // left shoulder from behind, three-quarters, looking up past him to the hall's front: the leaf in his left hand shows past the hat on
  // his back, and the eaves (kept in the picture) are over him.
  places: Object.freeze({
    p1a: Object.freeze({ at: STATION.A, face: Math.PI,
      shot: Object.freeze({ at: [0.8, 0.9, -1.1], look: [0.05, 1.5, 2.0], fov: 52, in: 2.0, out: 1.0, drift: Object.freeze({ push: 0.012, for: 12 }), keep: [[0, 0.7, 0], [0, 1.1, 0], [0, 0.8, 0.25], [0, 12, 38]] }) }),
    p1b: Object.freeze({ at: STATION.B, face: Math.PI,
      shot: Object.freeze({ at: [0.8, 0.9, -1.1], look: [0.05, 1.5, 2.0], fov: 56, in: 2.2, out: 1.0, drift: Object.freeze({ rise: 0.01, for: 12 }), keep: [[0, 0.7, 0], [0, 1.1, 0], [0, 0.8, 0.25], [0, 11, 22]] }) }),
  }),
  terraceZ: TERRACE.zS,
  // Two short lines at the foot of the picture, the owner's choice of 2026-11-26 (#770; CHECKPOINTS.md §2.2 and DECISIONS.md record that this
  // overrides "no hint"): nothing counted and nothing said of what is missing.
  //   door  before the shut great hall's doors (the three middle bays, up to 3 m out from the front wall): said once each time he comes up
  //         to them afresh (he must go 3 m clear again to be told again). Only while HALL_DOORS.shut: an open door has nothing to explain.
  //   eave  once the whole front has been looked at (C01) and the eaves not yet (C02): that they can be looked up at. Said once in a visit.
  hints: Object.freeze({
    door: HALL_DOORS.shut ? Object.freeze({ box: Object.freeze({ x0: XS[3], x1: XS[6], z0: ZS[0] + HALL.front, z1: ZS[0] + HALL.front + 3 }), text: "门还关着。" }) : null,
    eave: Object.freeze({ text: "走到檐下，抬头看看。" }),
  }),
});
