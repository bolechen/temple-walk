// node --import ./tools/walk/swap.mjs …: every import of app/src/site.js gets tools/walk/site-grid.mjs instead, whose
// createWalker is the walker over the baked grid (app/src/gridwalker.js) in the mode WALKER names: "court" (the
// default, as the page has it), "mesh" (the grid wherever it has one) or "old" (the written plan, as site.js's own).
// So the project's tests and tools run unchanged on either walker (#265): `pnpm run test:grid`, `pnpm run edges:grid`.
import { register } from "node:module";
register(new URL("./swap-hook.mjs", import.meta.url));
