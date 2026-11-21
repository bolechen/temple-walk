// Two lists of levels that are not the prologue, apart on purpose. BENCH_LEVELS are levels still being made that testers are meant to
// see: a preview and the canary list them, the public page does not. WORKBENCH_LEVELS are for the people building the game alone, the
// dev server and a preview, and not even the canary (the probe level proves the engine stands without the prologue; nobody is sent to it).
// To open a level to everyone, take its id out of its list; to give testers a level, move it from the second to the first.
//
// Levels still being made, which the testers' builds list and the public page does not (#409). The owner's rule of
// 2026-11-20 opened T05's white box on the dev server and a pull request's preview only; on 2026-11-21 the owner changed
// it: 「t05 改成 canary 可以测」, so the canary lists it too, and only production leaves it out. app/src/level.js lists
// them behind a test of the build's target that the bundler folds, so their code is not in a production build;
// vite.config.mjs leaves their baked floor and doorway pictures out of that build too, and tools/bake-doorways.mjs does
// not write them there. tests/unit/level-bench.test.mjs builds each target and looks.
// This file imports nothing, so that the build's configuration can read it.

/** The levels only the testers' builds list (the name is the workbench's, from before the canary had them). */
export const BENCH_LEVELS = Object.freeze(["t05"]);

/** Whether a build for this target (app/src/deploy.js) is one testers see, and lists them: a preview or the canary. @param {string} deploy */
export const benchBuild = (deploy) => deploy === "preview" || deploy === "canary";

/** The levels only the workbench lists: the dev server and a pull request's preview, never the canary nor the public page. The probe level that shows the engine stands without the prologue (app/levels/_probe, docs/t05/LEVEL-SPLIT.md S7) is one: it is not for testers to walk. */
export const WORKBENCH_LEVELS = Object.freeze(["_probe"]);

/** Whether a build for this target is the workbench's: a preview. @param {string} deploy */
export const workbenchBuild = (deploy) => deploy === "preview";

/** Whether a build for this target carries level `id` (its code is bundled, its floor and doorway pictures are copied): the prologue always. @param {string} id @param {string} deploy */
export const levelShipped = (id, deploy) => (BENCH_LEVELS.includes(id) ? benchBuild(deploy) : WORKBENCH_LEVELS.includes(id) ? workbenchBuild(deploy) : true);
