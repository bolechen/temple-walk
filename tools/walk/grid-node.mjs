// The walker over the baked grid, in Node (#265): the file app/shared/walk/<level>.bin read once per process, as the page
// reads it, and handed to app/src/gridwalker.js. The file is baked (or taken from the cache) by tools/bake-walk.mjs,
// which `pnpm build` and the unit tests run; a stale file is the bake's to catch (tests/unit/walk-bake.test.mjs).
import { readFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { decode } from "../../app/src/walkgrid.js";
import { createGridWalker, gridsByPlace } from "../../app/src/gridwalker.js";

// Which level's floor (#405): WALK_LEVEL names it, the prologue when it is unset. This module stands in for site.js under
// tools/walk/swap.mjs, so it cannot ask app/src/level.js (which imports site.js); it asks whether the level's folder is there.
export const LEVEL = process.env.WALK_LEVEL || "t00";
if (!existsSync(new URL(`../../app/levels/${LEVEL}/level.js`, import.meta.url))) throw new Error(`WALK_LEVEL=${LEVEL}: no app/levels/${LEVEL}/level.js`);
export const FILE = fileURLToPath(new URL(`../../app/shared/walk/${LEVEL}.bin`, import.meta.url));
let decoded = null;
export function bakedGrid() {
  if (decoded) return decoded;
  if (!existsSync(FILE)) throw new Error(`${FILE} is missing: run node tools/bake-walk.mjs --level=${LEVEL}`);
  return (decoded = decode(readFileSync(FILE), (b) => inflateRawSync(b)));
}
/** createGridWalker for this site, holding `old`. */
export function gridWalkerFor(site, old) {
  return createGridWalker(old, gridsByPlace(bakedGrid()), { doors: site.halls });
}
