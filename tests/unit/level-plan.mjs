// Which level a unit test or slow check is run on (docs/t05/LEVEL-SPLIT.md S6): the one WALK_LEVEL names (the same variable
// the baked floor's walker reads, tools/walk/grid-node.mjs), the prologue when it is unset. The plan is the level's own
// `build`, and the walker over it the level's own `createWalker`, handed the baked floor under tools/walk/swap.mjs as
// everywhere else; the prologue is still reached through app/src/site.js, which is what the swap replaces. What the checks
// need that the plan cannot say (the routes walked, the places stood at) is the level's app/levels/<id>/checks.js, read
// only here and by the tools, never by the page.
import { existsSync } from "node:fs";
import { loadLevel, LEVELS, DEFAULT_LEVEL } from "../../app/src/level.js";

export const LEVEL_ID = process.env.WALK_LEVEL || DEFAULT_LEVEL;
if (!Object.hasOwn(LEVELS, LEVEL_ID)) throw new Error(`WALK_LEVEL=${LEVEL_ID}: the levels are ${Object.keys(LEVELS).join(", ")}`);
export const isPrologue = LEVEL_ID === DEFAULT_LEVEL;
export const L = await loadLevel(LEVEL_ID);

/** What this level's checks need (app/levels/<id>/checks.js); null if it has none. */
const file = new URL(`../../app/levels/${LEVEL_ID}/checks.js`, import.meta.url);
export const checks = existsSync(file) ? (await import(file.href)).default : null;
/** The checks' table `key` of this level, or a refusal naming the file that should hold it. */
export function need(key) {
  const t = checks?.[key];
  if (!t) throw new Error(`app/levels/${LEVEL_ID}/checks.js has no \`${key}\`: the checks that walk it need one (docs/LEVEL-PLAYBOOK.md)`);
  return t;
}

/**
 * The level's plan and the walker over it, for `M` (any materials). With `real`, the written plan's own module (what
 * the swap would otherwise replace) is asked; the grid's walker is handed over by the swap for the prologue, and made here for another level.
 * @param {any} M @param {{ real?: boolean }} [o]
 */
export async function levelPlan(M, { real = false } = {}) {
  if (isPrologue) {
    const S = await import(real ? "../../app/src/site.js?real" : "../../app/src/site.js"), site = S.buildSite(M);
    return { id: LEVEL_ID, L, site, walker: S.createWalker(site), checks };
  }
  const site = L.build(M), old = L.createWalker(site);
  let walker = old;
  if (!real && process.env.WALKER !== "old" && (await import("../../app/src/site.js")).SWAPPED) walker = (await import("../../tools/walk/grid-node.mjs")).gridWalkerFor(site, old);
  return { id: LEVEL_ID, L, site, walker, checks };
}
