// The page's test hooks (`window.__name = …`) are one namespace shared by yard.js and every module in src/: a second
// definition of a name replaces the first without a word, whichever script runs later, and the scenario or tool that
// asked for the first one gets the second's answer. #509 gave the lamps' strength `__lamp`, which game.js had held
// since #357 for the lamp lit for someone; the `lamp` scenario then read `0` where it wanted `{ sheet }` and went red
// ("the sheet did not open", while it had), a day before anyone looked.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const app = new URL("../../app/", import.meta.url).pathname;
const files = ["yard.js", ...readdirSync(join(app, "src")).filter((f) => f.endsWith(".js")).map((f) => "src/" + f)];

test("no test hook is defined by two scripts", () => {
  /** @type {Map<string, string[]>} */ const where = new Map();
  for (const f of files) {
    const text = readFileSync(join(app, f), "utf8");
    // `window.__x = …` at the start of a statement; `window.__x ||= …` and reads are not definitions.
    for (const m of text.matchAll(/(?:^|[;{}\s])window\.(__[A-Za-z0-9_]+)\s*=(?!=)/g)) { if (!where.has(m[1])) where.set(m[1], []); where.get(m[1]).push(f); }
  }
  const twice = [...where].filter(([, fs]) => fs.length > 1).map(([name, fs]) => `${name}: ${fs.join(", ")}`);
  assert.deepEqual(twice, [], "a hook is defined twice, in one script or two, so the later one hides the first");
});
