// What the floor's bake needs to know of the prologue beyond what it builds (#405; read only by tools/walk/scene.mjs, in
// Node: the page never imports this file, so none of it is in a visitor's bundle). How far the courts and the path up
// reach, and the parts of the place, from the foot of the path to the summit, that a change of walkable floor is counted
// against in the floor's report (tools/walk-diff.mjs) when it lies under no building. These are the numbers the bake
// worked out from the plan before levels had a file of their own, so the prologue's floor is the same to the byte.
import { SITE, LEVELS, APPROACH } from "../../src/site.js";

/**
 * @typedef {object} LevelBake
 * @property {{ x0: number, x1: number, z0: number, z1: number }} outdoors the box the outdoor grid is baked over
 * @property {[string, number, number][]} bands each part of the place by z: its name, its north edge, its south edge
 */

/** @type {LevelBake} */
export default {
  outdoors: { x0: -(SITE.x + 10), x1: SITE.x + 10, z0: SITE.zN - 1, z1: Math.ceil(APPROACH.end) + 2 },
  bands: [
    ["山路", SITE.fore, 1e9], ["山门前", SITE.zS, SITE.fore], ["首院", LEVELS[0].zS, SITE.zS], ["藏经楼院", LEVELS[1].zS, LEVELS[0].zS],
    ["观音殿院", LEVELS[1].zN, LEVELS[1].zS], ["茶园坡", LEVELS[2].zS, LEVELS[1].zN], ["山顶", -1e9, LEVELS[2].zS],
  ],
};
