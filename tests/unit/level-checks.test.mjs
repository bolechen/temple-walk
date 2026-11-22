// A level's checks.js (docs/t05/LEVEL-SPLIT.md S6) is read in Node by the unit tests and the tools and never by the page: nothing
// the page loads imports it, so that what it names (labels, routes, parts of the place) is not in a visitor's bundle.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS } from "../../app/src/level.js";

const app = fileURLToPath(new URL("../../app/", import.meta.url));
const scripts = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (["vendor", "node_modules"].includes(e.name) ? [] : scripts(path.join(d, e.name))) : e.name.endsWith(".js") ? [path.join(d, e.name)] : []));

test("no script of the app imports a level's checks.js", () => {
  const bad = scripts(app).filter((f) => !/[\\/]checks\.js$/.test(f) && /checks\.js["'`]/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(bad.map((f) => path.relative(app, f)), []);
});

test("a level's checks.js, where it has one, says which checks it serves", async () => {
  for (const id of Object.keys(LEVELS)) {
    const f = new URL(`../../app/levels/${id}/checks.js`, import.meta.url);
    if (!fs.existsSync(f)) continue;
    const c = (await import(f.href)).default;
    for (const k of Object.keys(c)) assert.ok(["cameras", "horizon", "follow", "springArm", "nearplane", "edges", "grove"].includes(k), `${id}: checks.js has an unknown table "${k}"`);
  }
});
