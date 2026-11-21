// The plan's module with one thing changed: createWalker answers from the baked grid (app/shared/walk/<level>.bin, grid-node.mjs), unless
// WALKER=old (#265, #274). Loaded in place of app/src/site.js by tools/walk/swap.mjs.
export * from "../../app/src/site.js?real";
import { createWalker as written } from "../../app/src/site.js?real";
import { gridWalkerFor } from "./grid-node.mjs";
export const SWAPPED = true;
export function createWalker(site) {
  if (!site.root || process.env.WALKER === "old") return written(site);
  return gridWalkerFor(site, written(site));
}
