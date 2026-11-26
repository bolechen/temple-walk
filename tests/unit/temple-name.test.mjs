// A temple's own name on what a visitor takes away (#703, S3a): the photograph's card, the saved file's name, the share
// sheet's title and the book's. T05 must carry none of the prologue's name; the prologue reads as it always did.
import "./dom-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { said, templeOf, sealOf, stemOf } from "../../app/src/temple.js";
import { loadLevel } from "../../app/src/level.js";
import { t } from "../../app/src/i18n.js";

const LANGS = ["zh", "ja", "en", "ko"];
const LINES = ["云径禅寺", "云径禅寺-点灯.jpg", "云径禅寺 · 点灯", "云径禅寺 · 七印圆满", "云径禅寺-朱印.jpg", "云径禅寺 · 朱印", "云径禅寺-{mood}.jpg", "云径禅寺-除夕撞钟.jpg", "云径禅寺 · 除夕撞钟", "云径禅寺 v{v}"];
const vars = { mood: "x", v: "1" };
const FORMS = ["云径", "雲径", "运径", "Yunjing", "yunjing", "운경"];

test("T05 names itself, T00 names itself as before", async () => {
  const t00 = await loadLevel("t00"), t05 = await loadLevel("t05");
  assert.equal(t00.name, "云径禅寺"); assert.equal(t00.seal, "云径");
  assert.equal(t05.name, "奉明寺"); assert.equal(t05.seal, "奉明");
});

test("no line T05 says of its temple holds the prologue's name, in any language", async () => {
  const t05 = await loadLevel("t05");
  for (const lang of LANGS) {
    for (const zh of [...LINES, "云径禅寺"]) {
      const out = said(t05, zh, vars, lang);
      for (const f of FORMS) assert.ok(!out.includes(f), `${lang}: ${zh} → ${out}`);
    }
    assert.ok(!sealOf(t05, lang).includes("云径") && !sealOf(t05, lang).includes("雲径"), lang);
    assert.ok(!stemOf(t05, lang).includes("yunjing"), lang);
  }
  assert.equal(templeOf(t05, "en"), "Fengming Temple"); assert.equal(said(t05, "云径禅寺-点灯.jpg", undefined, "en"), "fengming-temple-lamp.jpg");
  assert.equal(templeOf(t05, "zh"), "奉明寺"); assert.equal(said(t05, "云径禅寺-{mood}.jpg", vars, "zh"), "奉明寺-x.jpg");
  assert.equal(templeOf(t05, "ja"), "奉明寺"); assert.equal(templeOf(t05, "ko"), "봉명사");
});

test("the prologue's lines are exactly the tables' own", async () => {
  const t00 = await loadLevel("t00");
  for (const lang of LANGS)
    for (const zh of LINES) for (const L of [t00, null, {}]) assert.equal(said(L, zh, vars, lang), t(zh, vars, lang));
  assert.equal(templeOf(t00, "en"), "Yunjing Temple"); assert.equal(stemOf(t00, "en"), "yunjing");
});

test("nothing a visitor takes away is written with the prologue's name outside temple.js's own call", () => {
  // The places that make a card, a file name or a share title go through temple.js, not through a literal name.
  for (const f of ["app/yard.js", "app/src/game.js", "app/src/goshuin.js", "app/src/joya-card.js", "app/src/joya-ui.js", "app/src/lampcard.js", "app/src/carry-page.js", "app/src/version.js"]) {
    const src = fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
    const lines = src.split("\n").filter((l) => /(?:t|tr)\("云径|glyphs\("云径/.test(l) && !l.trim().startsWith("//") && !l.includes("序章"));
    assert.deepEqual(lines, [], f);
  }
});

test("only the prologue keeps the book of seals; a level that says nothing hides it", async () => {
  assert.equal((await loadLevel("t00")).book, true);
  assert.equal((await loadLevel("t05")).book, undefined);
  const css = fs.readFileSync(new URL("../../app/src/ui.css", import.meta.url), "utf8");
  for (const sel of ["#bookBtn", "#goal", "#way", ".need-book"]) assert.ok(new RegExp(`body\\.nobook :is\\([^)]*${sel.replace(".", "\\.")}`).test(css), sel);
});

test("T05's card prints its own verse or none, carries no address or code; the prologue's card is as it was", async () => {
  const { verseOf } = await import("../../app/src/temple.js");
  const { moodOf } = await import("../../app/src/mood.js");
  const t00 = await loadLevel("t00"), t05 = await loadLevel("t05");
  assert.equal(t05.cardLink, false); assert.equal(t05.ownVerse, true);
  assert.equal(t00.cardLink, undefined); assert.equal(t00.ownVerse, undefined);
  for (const s of ["spring", "summer", "autumn", "winter"]) for (const h of ["dawn", "day", "dusk", "night"]) {
    const line = moodOf(s, h, t00.moodFor).line;
    assert.equal(verseOf(t00, s, h, line), line, `${s}-${h}: the prologue's verse is the hours' own`);
    const own = verseOf(t05, s, h, moodOf(s, h).line);
    if (s === "winter" && h === "day") assert.equal(own, "寒霜清晨，钟声独远");
    else assert.equal(own, "", `${s}-${h}: T05 has no verse of its own here, so it prints none`);
  }
  assert.equal(verseOf(null, "summer", "day", "雨过竹声凉"), "雨过竹声凉");
});
