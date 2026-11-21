// Which temple a Node tool bakes or reads (#405, docs/t05/LEVEL-SPLIT.md S5): the name given with --level=<id>, or the
// prologue, checked against the levels the page itself knows (app/src/level.js). A name not in that list stops the tool
// with exit 1 and says which there are, rather than quietly baking the prologue under another name.
import { fileURLToPath } from "node:url";
import { LEVELS, DEFAULT_LEVEL, loadLevel } from "../../app/src/level.js";

export { DEFAULT_LEVEL };

/** The levels there are, by name. */
export const levelIds = () => Object.keys(LEVELS);

/** Whether `id` names a level (not a name the object only inherits). */
export const isLevel = (id) => typeof id === "string" && Object.hasOwn(LEVELS, id);

/**
 * The level named on a command line, or the prologue. Throws, saying which levels there are, for a name not among them.
 * @param {string[]} [argv] @returns {string}
 */
export function levelArg(argv = process.argv) {
  const a = argv.find((s) => s === "--level" || s.startsWith("--level="));
  if (!a) return DEFAULT_LEVEL;
  const id = a.slice("--level=".length);
  if (!isLevel(id)) throw new Error(`unknown level "${id}": the levels are ${levelIds().join(", ")}`);
  return id;
}

/** levelArg for a tool's own command line: an unknown name ends the process with exit 1. */
export function levelFromCommandLine(argv = process.argv) {
  try { return levelArg(argv); } catch (e) { console.error(String(/** @type {Error} */ (e).message)); process.exit(1); }
}

/** The level's object, as the page loads it. */
export const levelObject = (id) => loadLevel(id);

/** Where a level's baked floor lies (app/shared/walk/<id>.bin), as the page fetches shared/walk/<id>.bin. */
export const walkFile = (id) => fileURLToPath(new URL(`../../app/shared/walk/${id}.bin`, import.meta.url));

/** The name of a level's list of baked doorway pictures (app/shared/doorways/<id>.json), as app/src/doorway.js fetches it. */
export const doorwayManifest = (id) => `${id}.json`;
