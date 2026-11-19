// The walker over the baked grid, in Node (#265): the file app/shared/walk/t00.bin read once per process, as the page
// reads it, and handed to app/src/gridwalker.js. The file is baked (or taken from the cache) by tools/bake-walk.mjs,
// which `pnpm build` and the unit tests run; a stale file is the bake's to catch (tests/unit/walk-bake.test.mjs).
import { readFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { decode } from "../../app/src/walkgrid.js";
import { createGridWalker, gridsByPlace, courtRegion } from "../../app/src/gridwalker.js";
import { SITE, LEVELS } from "../../app/src/site.js?real";

export const FILE = fileURLToPath(new URL("../../app/shared/walk/t00.bin", import.meta.url));
let decoded = null;
export function bakedGrid() {
  if (decoded) return decoded;
  if (!existsSync(FILE)) throw new Error(`${FILE} is missing: run node tools/bake-walk.mjs`);
  return (decoded = decode(readFileSync(FILE), (b) => inflateRawSync(b)));
}
/** createGridWalker for this site, in `mode` ("court" or "mesh"), holding `old`. */
export function gridWalkerFor(site, old, mode = "court") {
  const region = mode === "court" ? courtRegion(site, SITE, LEVELS[0]) : null;
  return createGridWalker(old, gridsByPlace(bakedGrid(), mode, region), { mode, region, drops: site.walk.drops });
}
