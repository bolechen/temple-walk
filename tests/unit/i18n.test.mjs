// The page in three languages: which one a visitor gets, how a line is found and filled, and that every line the page
// may show has its Japanese and its English, with the same blanks to fill.
import test from "node:test"; import assert from "node:assert/strict";
import { pickLang, t, has, lang, LANGS, fontsFor, glyphs } from "../../app/src/i18n.js";
import JA from "../../app/src/i18n-ja.js";
import EN from "../../app/src/i18n-en.js";
import { allKeys, calledKeys } from "./i18n-keys.mjs";
import { titleOffer } from "../../app/src/resume.js";

test("the language: asked for in the address, else chosen before, else the browser's own, else Chinese", () => {
  assert.equal(pickLang({}), "zh");
  assert.equal(pickLang({ languages: ["ja-JP", "en-US"] }), "ja");
  assert.equal(pickLang({ languages: ["en-GB"] }), "en");
  assert.equal(pickLang({ languages: ["zh-TW", "ja"] }), "zh", "traditional Chinese reads the Chinese page");
  assert.equal(pickLang({ languages: ["ko-KR", "ja"] }), "ja", "the first of the browser's languages that is one of ours");
  assert.equal(pickLang({ languages: ["ko-KR", "fr"] }), "en", "a browser that speaks none of the three is given English");
  assert.equal(pickLang({ stored: "en", languages: ["ja"] }), "en", "a choice made before outlasts the browser");
  assert.equal(pickLang({ search: "?lang=ja", stored: "en", languages: ["zh"] }), "ja", "the address outlasts everything");
  assert.equal(pickLang({ search: "?lang=xx", stored: "fr", languages: ["ja"] }), "ja", "an unknown language is ignored");
  assert.equal(lang, "zh", "in Node there is no visitor: Chinese");
  assert.deepEqual(LANGS, ["zh", "ja", "en"]);
});

test("a line is the Chinese as written unless another language is asked for; its blanks are filled in any language", () => {
  assert.equal(t("入山"), "入山");
  assert.equal(t("入山", undefined, "ja"), "山に入る");
  assert.equal(t("入山", undefined, "en"), "Enter the mountain");
  assert.equal(t("{n} 步", { n: 12 }), "12 步");
  assert.equal(t("{n} 步", { n: 12 }, "en"), "12 steps");
  assert.equal(t("没有译文的话", undefined, "ja"), "没有译文的话", "a line not yet translated is shown as written, never blank");
  assert.equal(glyphs("闻钟"), "闻钟", "calligraphy stays in the temple's characters outside Japanese");
  assert.equal(t("闻钟", undefined, "ja"), "聞鐘");
  assert.equal(titleOffer(3, 7, { x: 0, z: 0, label: "钟楼" }, [0, 96], "en").line, "Seals earned: 3 · Last time you reached the Bell Tower");
  assert.equal(titleOffer(3, 7, { x: 0, z: 0, label: "钟楼" }, [0, 96], "ja").line, "三印を授かった · 前回は鐘楼まで歩いた");
  assert.equal(titleOffer(0, 7, null, [0, 96], "ja").enter, "山に入る");
});

test("every line the page may show has its Japanese and its English", async () => {
  const keys = await allKeys();
  assert.ok(keys.size > 250, `found only ${keys.size} lines: the reader of the sources has lost its way`);
  for (const [name, table] of [["ja", JA], ["en", EN]]) {
    const missing = [...keys].filter((k) => !has(k, name));
    assert.deepEqual(missing, [], `src/i18n-${name}.js lacks these lines`);
    // A table may not keep lines the page no longer has: they would be read by no one and mended by no one.
    const stale = Object.keys(table).filter((k) => !keys.has(k));
    assert.deepEqual(stale, [], `src/i18n-${name}.js holds lines the page does not show`);
  }
});

test("each translation keeps the blanks of its Chinese, and the markup in it", () => {
  const blanks = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((b) => b !== "k" && b !== "n").sort();
  const tags = (s) => [...s.matchAll(/<\/?(\w+)/g)].map((m) => m[0]).sort();
  for (const [name, table] of [["ja", JA], ["en", EN]]) {
    for (const [zh, out] of Object.entries(table)) {
      assert.ok(out.trim(), `${name}: an empty line for ${zh}`);
      assert.deepEqual(blanks(out), blanks(zh), `${name}: the blanks of ${zh}`);
      assert.deepEqual(tags(out), tags(zh), `${name}: the markup of ${zh}`);
      // {n} is the count in Chinese numerals and {k} the same count in figures: a translation takes one or the other.
      if (/\{n\}/.test(zh)) assert.ok(/\{[nk]\}/.test(out), `${name}: ${zh} lost its count`);
    }
  }
});

test("the lines are written for their language: no Chinese-only characters left in the English, kana nowhere but the Japanese", () => {
  const calligraphy = new Set(["山门之外", "朝<br>山", "印", "云径", "圆", "奉拜"]);
  for (const [zh, out] of Object.entries(EN)) if (!calligraphy.has(zh)) assert.ok(!/[㐀-鿿぀-ヿ]/.test(out), `en: ${zh} → ${out}`);
  for (const k of calledKeys().keys()) assert.ok(!/[぀-ヿ]/.test(k), `the Chinese of record has kana in it: ${k}`);
});

test("each language draws first in its own faces and falls back to the Chinese ones", () => {
  assert.match(fontsFor("ja").kai, /^"Yunjing Kai JA", "Yunjing Kai"/);
  assert.match(fontsFor("en").xing, /^"Yunjing Hand EN", "Yunjing Xing"/);
  assert.match(fontsFor("zh").brush, /^"Yunjing Brush"/);
});

test("every work in the halls has its Japanese and English card, field for field, and the record shows through where none is", async () => {
  const { WORKS } = await import("../../app/src/works.js");
  const { workIn, workTables, FIELDS } = await import("../../app/src/works-local.js");
  for (const [name, table] of Object.entries(workTables)) {
    assert.deepEqual(Object.keys(table).sort(), Object.keys(WORKS).sort(), `works-${name}.js should hold exactly the works in works.js`);
    for (const [slug, w] of Object.entries(WORKS)) {
      const tr = table[slug];
      assert.deepEqual(Object.keys(tr).sort(), [...FIELDS].sort(), `${name}/${slug}: the fields`);
      // Blank where the record is blank (no rank, no dates), written where it is not.
      for (const f of FIELDS) assert.equal(!!tr[f].trim(), !!String(w[f] || "").trim(), `${name}/${slug}.${f}`);
      if (name === "en") for (const f of FIELDS) assert.ok(!/[㐀-鿿぀-ヿ]/.test(tr[f]), `en/${slug}.${f} has characters in it: ${tr[f].slice(0, 40)}`);
      if (name === "ja") assert.ok(/[぀-ヿ]/.test(tr.note), `ja/${slug}: the note should be written in Japanese, not left in Chinese`);
      const shown = workIn(slug, name);
      assert.equal(shown.credit, w.credit, "the museum's source line stays as published");
      assert.equal(shown.size, w.size);
      assert.equal(shown.note, tr.note);
    }
  }
  const any = Object.keys(WORKS)[0];
  assert.equal(workIn(any, "zh"), WORKS[any], "in Chinese the record itself");
  assert.equal(workIn("no-such-work", "ja"), null);
});
