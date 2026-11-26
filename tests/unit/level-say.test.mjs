// A level's own words (src/levelsay.js): T05's one line about having no seals yet, in all four languages, kept out of the shared tables.
import fs from "node:fs"; import test from "node:test"; import assert from "node:assert/strict";
import { levelSay } from "../../app/src/levelsay.js";
import t00 from "../../app/levels/t00/level.js";
import t05 from "../../app/levels/t05/level.js";

const doorsShut = () => /HALL_DOORS\s*=\s*Object\.freeze\(\{\s*shut:\s*true/.test(fs.readFileSync(new URL("../../app/levels/t05/hall.js", import.meta.url), "utf8"));
// #770 item 3: the shut door is explained, and the line follows HALL_DOORS.shut (read from the source: one constant to turn).
test("T05 says once, in each language, that the great hall is closed for now; it says nothing once the doors are open", () => {
  assert.equal(t00.intro, undefined, "the prologue says nothing of the kind");
  assert.equal(!!t05.intro, doorsShut(), "the line is there exactly while HALL_DOORS.shut");
  if (!t05.intro) return;
  assert.match(t05.intro, /大殿/); assert.match(t05.intro, /暂不开放/);
  assert.ok(!/朱印|修建/.test(t05.intro), "no seals to speak of, and not 'being built'");
  const words = { en: /closed/i, ja: /入れません/, ko: /들어갈 수 없/ };
  for (const l of ["ja", "en", "ko"]) { const s = levelSay(t05, t05.intro, l); assert.notEqual(s, t05.intro, l); assert.ok(s.length > 10, l); assert.match(s, words[l], `${l} says the hall is closed`); }
  assert.ok(!/아직.*아직/.test(levelSay(t05, t05.intro, "ko")), "ko: no word twice");
  assert.equal(levelSay(t05, t05.intro, "zh"), t05.intro);
  assert.equal(levelSay(null, "入山", "en"), "Enter the mountain", "a level with no table falls back to the page's own");
  assert.equal(levelSay(t05, "没有译文", "ja"), "没有译文", "a line nobody has translated is shown as written");
});
test("the line carries no key of the prologue's, no temple's name, and none of it is in the shared tables", () => {
  assert.ok(!/云径|奉明|奉国/.test(t05.intro || ""));
  for (const l of ["ja", "en", "ko"]) assert.ok(!fs.readFileSync(new URL(`../../app/locales/${l}.js`, import.meta.url), "utf8").includes("暂不开放"), `${l} shared table`);
});
