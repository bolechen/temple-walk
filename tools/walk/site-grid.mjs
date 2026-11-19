// The plan's module with one thing changed: createWalker answers from the baked grid (app/shared/walk/t00.bin) in the
// mode WALKER names (#265). Loaded in place of app/src/site.js by tools/walk/swap.mjs.
export * from "../../app/src/site.js?real";
import { createWalker as written } from "../../app/src/site.js?real";
import { gridWalkerFor } from "./grid-node.mjs";
export const SWAPPED = true;
export function createWalker(site) {
  const mode = process.env.WALKER || "court";
  if (!site.root || mode === "old") return written(site);
  return gridWalkerFor(site, written(site), mode);
}
