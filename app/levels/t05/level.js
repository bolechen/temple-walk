// 奉明寺 (T05), as the engine asks for a level (app/src/level.js; #409). Its plan is ./site.js, a white box for now: the
// court, the great hall's platform, the terrace and the flight, and the way in from the outer gate's place. The
// county is flat (docs/t05/SITE.md §4.1): no far hills, no bamboo, no censer. It keeps no place, plays no opening and
// raises no title of its own yet, and the prologue's music is not played here (score.js zoneOf with no zones).
import { buildSite, createWalker, COMPOUND, WAY } from "./site.js";

/** @type {import("../../src/level.js").Level} */
export default {
  id: "t05",
  build: buildSite,
  createWalker,
  land: () => 0,                       // a flat plain: the land outside the walls is the court's own level
  backdrop: null,
  grove: null,
  propsAt: 0,
  zones: null,
  groveSound: () => 0,
  // Everything built that the following eye may meet: the compound and the way, with room round them.
  eyeBox: { x0: -COMPOUND.x - 20, x1: COMPOUND.x + 20, y0: -20, y1: 60, z0: COMPOUND.zN - 20, z1: WAY.zS + 20 },
  hallTapZ: -Infinity,                 // no hall to tap yet
  // The sky's dome stands half way along the compound and the way, so that its far side is in view from either end.
  skyAt: [0, (COMPOUND.zN + WAY.zS) / 2],
};
