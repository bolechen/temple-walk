// What the unit tests that stand him somewhere need to know about the walker they were handed (#265). The same tests run
// on the walker of the written plan (`pnpm test`) and on the grid baked from the drawn meshes (`pnpm run test:grid`, which
// loads tools/walk/swap.mjs). The old one keeps him BODY off everything, drawn larger by hand; the grid keeps him his
// outline's reach at the heights a thing takes up, measured from the models (tools/walk/outline.json), to within half a
// cell's diagonal. So "here he must be stopped" is said once, and each walker is held to its own measure of his width.
import { BODY } from "../../app/src/geo.js";
import { reach, BAKE } from "../../tools/walk/bake.mjs";

export const isGrid = (/** @type {any} */ w) => w.kind === "grid";
/** Half a cell's diagonal and a centimetre: how far the grid's edge may lie from the line it stands for. */
export const GRID_TOL = BAKE.step * 0.71 + 0.01;
/**
 * How far from the face of a thing that stands from his floor up to `h` metres (a column: all of it) he must be
 * stopped, less what each walker may be out by.
 */
export function keptOff(/** @type {any} */ w, h = BAKE.CLEAR) { return isGrid(w) ? reach(0, Math.min(h, BAKE.CLEAR)) - GRID_TOL : BODY - 0.012; }
/** Where the walker answers from the grid, a floor read from it is drawn; quantised to whole centimetres. */
export const floorTol = (/** @type {any} */ w) => (isGrid(w) ? 0.006 : 1e-6);
/** Is this round `walk.posts` entry a column (not a tree, a seat or the stools and table of the court's tea, nor the censer)? */
export const isColumn = (/** @type {any} */ site, /** @type {any} */ p) => p.r !== undefined && p.top === undefined && !site.trees.some((/** @type {any} */ t) => Math.hypot(t[0] - p.x, t[2] - p.z) < 1e-6)
  && !site.seats.some((/** @type {any} */ q) => Math.hypot(q.at[0] - p.x, q.at[1] - p.z) < 0.05 || (q.room === null && q.kind === "stool" && Math.hypot(q.at[0] - p.x, q.at[1] - p.z) < 1.6));
