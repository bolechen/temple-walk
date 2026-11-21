// What the floor's bake needs to know of the probe level beyond what it builds (#405; read only by tools/walk/scene.mjs, in
// Node: the page never imports this file). The outdoor grid covers the plot; the whole of it is one part of the place.
import { PLOT } from "./site.js";

/** @type {import("../t00/bake.js").LevelBake} */
export default {
  outdoors: { x0: -PLOT.x - 2, x1: PLOT.x + 2, z0: PLOT.zN - 2, z1: PLOT.zS + 2 },
  bands: [["plot", -1e9, 1e9]],
};
