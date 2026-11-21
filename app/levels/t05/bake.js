// What the floor's bake needs to know of T05 beyond what it builds (#405, #409; read only by tools/walk/scene.mjs, in Node:
// the page never imports this file). The outdoor grid covers the compound and the way from the outer gate's place; a
// change of walkable floor under no building is counted against the court, the terrace or the way.
import { COMPOUND, WAY, TERRACE, PLATFORM } from "./site.js";

/** @type {import("../t00/bake.js").LevelBake} */
export default {
  outdoors: { x0: -COMPOUND.x - 2, x1: COMPOUND.x + 2, z0: COMPOUND.zN - 2, z1: WAY.zS + 2 },
  bands: [
    ["来路", COMPOUND.zS, 1e9], ["院子", TERRACE.zS, COMPOUND.zS], ["月台", PLATFORM.zS, TERRACE.zS], ["台基", -1e9, PLATFORM.zS],
  ],
};
