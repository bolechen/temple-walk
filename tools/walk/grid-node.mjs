// The walker over the baked grid, in Node (#265): the file app/shared/walk/t00.bin read once per process, as the page
// reads it, and handed to app/src/gridwalker.js. The file is baked (or taken from the cache) by tools/bake-walk.mjs,
// which `pnpm build` and the unit tests run; a stale file is the bake's to catch (tests/unit/walk-bake.test.mjs).
import { readFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { decode } from "../../app/src/walkgrid.js";
import { createGridWalker, gridsByPlace } from "../../app/src/gridwalker.js";

export const FILE = fileURLToPath(new URL("../../app/shared/walk/t00.bin", import.meta.url));
let decoded = null;
export function bakedGrid() {
  if (decoded) return decoded;
  if (!existsSync(FILE)) throw new Error(`${FILE} is missing: run node tools/bake-walk.mjs`);
  return (decoded = decode(readFileSync(FILE), (b) => inflateRawSync(b)));
}
/** createGridWalker for this site, holding `old`. */
export function gridWalkerFor(site, old) {
  return createGridWalker(old, gridsByPlace(bakedGrid()));
}
