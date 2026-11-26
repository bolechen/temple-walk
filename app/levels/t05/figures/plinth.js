// The course of stone the seven sit on, between their lotuses and the altar's top (the statue session's stage stood each figure on a slab 0.4 m
// high: the figure brings its own lotus, not the course under it). It is one course over the whole altar, 5 cm in from the edge of the altar's cap
// all round as an upper step of it, and it is made as the hall's other stone is, with the light a surface takes baked into every corner (`ao`,
// ../../../src/geo.js), which that material reads. The first slabs were seven, one to a figure (5.39 × 4.12 m), bare boxes with no such number:
// out of the lamps' reach they were drawn black; they were shallower than the lotuses on them, whose feet reached 0.1 to 0.4 m past them and past
// the altar's own front; and between two neighbours a slot 0.14 to 0.41 m wide and four metres deep stood open. On the T4 of 2026-11-26 that was
// a black band under each lotus and a black stub beside it, and the seats read as hanging over the altar (the art director, #763).
import { box, mesh } from "../../../src/geo.js";
import { ALTAR } from "../altar.js";
import { PLINTH } from "./registry.js";

/** The course: the altar's cap less 5 cm all round (the cap stands 0.15 m out from the altar), as high as the stage's slab, on the altar's middle. */
export const TIER = Object.freeze({ w: ALTAR.w + 0.2, h: PLINTH.h, d: ALTAR.d + 0.2, z: (ALTAR.zF + ALTAR.zB) / 2 });

/** The course, standing on the altar's top at `top`, in the hall's stone. */
export function tierMesh(stone, top) {
  const m = mesh(box(TIER.w, TIER.h, TIER.d, 0, top + TIER.h / 2, TIER.z), stone);
  m.name = "plinth-tier";
  // it stays itself beside the figures, and the baked floor leaves it out as it leaves them out
  m.userData.keep = true; m.userData.bake = false;
  return m;
}
