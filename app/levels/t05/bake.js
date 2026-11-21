// What the floor's bake needs to know of T05 beyond what it builds (#405, #409; read only by tools/walk/scene.mjs, in Node:
// the page never imports this file). The outdoor grid covers the compound and the way from the outer gate's place; a
// change of walkable floor under no building is counted against the court, the terrace, the second terrace or the way.
import { COMPOUND, WAY, TERRACE, PLATFORM } from "./site.js";
import { AXIS, FOOT } from "./axis.js";

/** @type {import("../t00/bake.js").LevelBake} */
export default {
  outdoors: { x0: -COMPOUND.x - 2, x1: COMPOUND.x + 2, z0: COMPOUND.zN - 2, z1: WAY.zS + 2 },
  bands: [
    ["前院", AXIS.outerZ, 1e9], ["山门间", FOOT.inner.z1, AXIS.outerZ], ["二层高台", COMPOUND.zS, FOOT.inner.z1], ["院子", TERRACE.zS, COMPOUND.zS], ["月台", PLATFORM.zS, TERRACE.zS], ["台基", -1e9, PLATFORM.zS],
  ],
};
