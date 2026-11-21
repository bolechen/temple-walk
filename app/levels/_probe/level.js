// A level made only to show that the engine stands alone (docs/t05/LEVEL-SPLIT.md, S7): a flat plot, one open pavilion,
// one place and one view, no art. The page asks the level for everything and finds no temple under it: no far hills, no
// bamboo, no censer, no well or bell, no screen wall, no opening, no title, no kept place. Known only to the workbench (app/src/bench.js).
import { buildSite, PLOT } from "./site.js";
import { createPlanWalker } from "../../src/plan-walker.js";

/** @type {import("../../src/level.js").Level} */
export default {
  id: "_probe",
  build: buildSite,
  createWalker: createPlanWalker,
  land: () => 0,                       // a flat plot
  // Every part the engine draws for a level but this one has no use for is simply left out.
  backdrop: null,
  grove: null,
  propsAt: 0,
  zones: null,                         // no music zones: the prologue's is not played here
  groveSound: () => 0,
  eyeBox: { x0: -PLOT.x - 10, x1: PLOT.x + 10, y0: -20, y1: 40, z0: PLOT.zN - 10, z1: PLOT.zS + 10 },
  hallTapZ: -1e9,
  // keepsPlace, opening and title are left unsaid: a level that says nothing keeps no place, plays no opening, raises no title (#385).
};
