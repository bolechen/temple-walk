// Levels still being made, which only the workbench's builds list (#409; the owner's rule of 2026-11-20: T05's white box is
// opened on the dev server and a pull request's preview, never on the canary or the public page). app/src/level.js lists
// them behind a test of the build's target that the bundler folds, so their code is not in a canary or production
// build; vite.config.mjs leaves their baked floor and doorway pictures out of those builds too, and
// tools/bake-doorways.mjs does not write them there. tests/unit/level-bench.test.mjs builds each target and looks.
// This file imports nothing, so that the build's configuration can read it.

/** The levels only the workbench lists. */
export const BENCH_LEVELS = Object.freeze(["t05"]);

/** Whether a build for this target (app/src/deploy.js) is the workbench's, and lists them. @param {string} deploy */
export const benchBuild = (deploy) => deploy === "preview";
