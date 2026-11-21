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
