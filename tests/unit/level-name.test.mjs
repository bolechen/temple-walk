// How a level names its temple in words (src/levelname.js): the prologue as it was, T05 in all four languages.
import test from "node:test"; import assert from "node:assert/strict";
import { templeOf, cardNames, applyLevelName, PROLOGUE_NAME } from "../../app/src/levelname.js";
import { t } from "../../app/src/i18n.js";
import t00 from "../../app/levels/t00/level.js";
import t05 from "../../app/levels/t05/level.js";

test("a level that names nothing is the prologue, and its page is not touched", () => {
  assert.equal(t00.name, undefined);
  assert.deepEqual(templeOf(t00), PROLOGUE_NAME); assert.deepEqual(templeOf(null), PROLOGUE_NAME);
  let touched = false; const doc = { querySelector: () => (touched = true, null), querySelectorAll: () => (touched = true, []), title: "山门之外 · 云径禅寺" };
  assert.equal(applyLevelName(t00, doc), false); assert.equal(touched, false); assert.equal(doc.title, "山门之外 · 云径禅寺");
});
test("T05 is called 奉明寺 and never wears the prologue's name, in every language", () => {
  const n = t05.name; assert.equal(n.temple, "奉明寺");
  assert.deepEqual(cardNames(t05, (k) => k, (k) => k), { temple: "奉明寺", seal: "奉明" });
  for (const [lang, temple] of [["zh", "奉明寺"], ["ja", "奉明寺"], ["en", "Fengming Temple"], ["ko", "봉명사"]]) {
    for (const k of [n.temple, n.sub, n.page]) { const s = t(k, undefined, lang); assert.ok(!/云径|雲径|Yunjing|운경/.test(s), `${lang}: ${s}`); assert.ok(s.includes(temple), `${lang}: ${s} should hold ${temple}`); }
  }
});
test("applied, it sets the title page's second line, the tab and the small seals", () => {
  const sub = { textContent: "序章 · 云径禅寺" }, seals = [{ textContent: "云径" }, { textContent: "云径" }], doc = { title: "", querySelector: () => sub, querySelectorAll: () => seals };
  assert.equal(applyLevelName(t05, doc), true);
  assert.equal(sub.textContent, "奉明寺"); assert.equal(doc.title, "山门之外 · 奉明寺"); assert.deepEqual(seals.map((s) => s.textContent), ["奉明", "奉明"]);
});
