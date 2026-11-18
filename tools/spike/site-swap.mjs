// The plan's module with one thing changed: createWalker answers from the drawn meshes inside the trial region (#161
// spike). Loaded in place of app/src/site.js by tools/spike/swap.mjs, so that the project's own tests and tools run
// unchanged against the new walker.
export * from "../../app/src/site.js?real";
import { createWalker as written } from "../../app/src/site.js?real";
import { drawnWalker } from "./drawn.mjs";
export const SWAPPED = true;
export function createWalker(site) {
  if (!site.root || process.env.SPIKE_WALKER === "old") return written(site);
  const w = drawnWalker(site, written(site));
  if (process.env.SPIKE_LOG) console.error(`[spike] drawn walker: ${JSON.stringify(w.cost)}`);
  return w;
}
