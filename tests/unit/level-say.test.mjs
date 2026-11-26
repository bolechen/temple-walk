// A level's own words (src/levelsay.js): T05's one line about having no seals yet, in all four languages, kept out of the shared tables.
import fs from "node:fs"; import test from "node:test"; import assert from "node:assert/strict";
import { levelSay } from "../../app/src/levelsay.js";
import t00 from "../../app/levels/t00/level.js";
import t05 from "../../app/levels/t05/level.js";

test("T05 says once, in each language, that the temple is still being built and has no seals or book yet", () => {
  assert.equal(t00.intro, undefined, "the prologue says nothing of the kind");
  assert.match(t05.intro, /修建/); assert.match(t05.intro, /朱印/);
  for (const l of ["ja", "en", "ko"]) { const s = levelSay(t05, t05.intro, l); assert.notEqual(s, t05.intro, l); assert.ok(s.length > 10, l); }
  assert.equal(levelSay(t05, t05.intro, "zh"), t05.intro);
  assert.equal(levelSay(null, "入山", "en"), "Enter the mountain", "a level with no table falls back to the page's own");
  assert.equal(levelSay(t05, "没有译文", "ja"), "没有译文", "a line nobody has translated is shown as written");
});
test("the line carries no key of the prologue's, no temple's name, and none of it is in the shared tables", () => {
  assert.ok(!/云径|奉明|奉国/.test(t05.intro));
  for (const l of ["ja", "en", "ko"]) assert.ok(!fs.readFileSync(new URL(`../../app/locales/${l}.js`, import.meta.url), "utf8").includes("修建"), `${l} shared table`);
});
