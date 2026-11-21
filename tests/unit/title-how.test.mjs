// The line at the foot of the title page (#445) is each level's own data: a level that gives one shows it, a level
// that gives none shows nothing, and never borrows the prologue's.
import "./dom-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLevel } from "../../app/src/level.js";
import { titleHow } from "../../app/src/titlehow.js";

test("the prologue says where it is and what kind of road, in a region's words and no real city", async () => {
  const how = titleHow(await loadLevel("t00"));
  assert.ok(how && how.place && how.line);
  assert.match(how.place, / · /, "region · road");
  assert.doesNotMatch(how.place + how.line, /七|朱印|小事/, "no count of seals on the title");
});

test("a level that gives no line has none, and borrows nothing from the prologue", async () => {
  assert.equal(titleHow({ id: "other" }), null);
  assert.equal(titleHow(null), null);
  assert.equal(titleHow(await loadLevel("t05")), null);
  assert.equal(titleHow({ id: "x", how: { place: "", line: "" } }), null);
});

test("what a level gives is shown as it gave it", () => {
  assert.deepEqual(titleHow({ id: "x", how: { place: "辽西 · 路", line: "一句。" } }), { place: "辽西 · 路", line: "一句。" });
});
