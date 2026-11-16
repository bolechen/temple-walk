// The page in three languages: which one a visitor gets, how a line is found and filled, and that every line the page
// may show has its Japanese and its English, with the same blanks to fill.
import test from "node:test"; import assert from "node:assert/strict";
import { pickLang, choose, setLang, t, has, lang, langSource, takeSwitch, LANGS, fontsFor, glyphs } from "../../app/src/i18n.js";
import JA from "../../app/locales/ja.js";
import EN from "../../app/locales/en.js";
import KO from "../../app/locales/ko.js";
import { allKeys, calledKeys } from "./i18n-keys.mjs";
import { titleOffer } from "../../app/src/resume.js";

test("the language: asked for in the address, else chosen before, else the browser's own, else Chinese", () => {
  assert.equal(pickLang({}), "zh");
  assert.equal(pickLang({ languages: ["ja-JP", "en-US"] }), "ja");
  assert.equal(pickLang({ languages: ["en-GB"] }), "en");
  assert.equal(pickLang({ languages: ["zh-TW", "ja"] }), "zh", "traditional Chinese reads the Chinese page");
  assert.equal(pickLang({ languages: ["fr-FR", "ja"] }), "ja", "the first of the browser's languages that is one of ours");
  assert.equal(pickLang({ languages: ["fr-FR", "de"] }), "en", "a browser that speaks none of ours is given English");
  assert.equal(pickLang({ stored: "en", languages: ["ja"] }), "en", "a choice made before outlasts the browser");
  assert.equal(pickLang({ search: "?lang=ja", stored: "en", languages: ["zh"] }), "ja", "the address outlasts everything");
  assert.equal(pickLang({ search: "?lang=xx", stored: "fr", languages: ["ja"] }), "ja", "an unknown language is ignored");
  assert.equal(lang, "zh", "in Node there is no visitor: Chinese");
  assert.equal(pickLang({ languages: ["ko-KR", "en"] }), "ko");
  assert.deepEqual(LANGS, ["zh", "ja", "en", "ko"]);
});

test("how the language was come by is told apart: asked for, kept from before, recognised, or nothing to go on", () => {
  assert.deepEqual(choose({ search: "?lang=ko", stored: "ja" }), { lang: "ko", source: "url" });
  assert.deepEqual(choose({ stored: "en", languages: ["ja"] }), { lang: "en", source: "saved" });
  assert.deepEqual(choose({ languages: ["ja-JP"] }), { lang: "ja", source: "browser" });
  assert.deepEqual(choose({ languages: ["fr-FR"] }), { lang: "en", source: "browser" }, "English for a browser that speaks none of ours counts as recognised");
  assert.deepEqual(choose({}), { lang: "zh", source: "default" });
  assert.deepEqual(choose({ search: "?lang=xx" }), { lang: "zh", source: "default" }, "an unknown language is ignored");
  assert.equal(langSource, "default", "in Node there is no visitor");
  assert.equal(takeSwitch(), "", "no storage, no switch");
});

test("a language chosen by hand is kept, and the page that opens next learns where it came from, once", () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const was = { l: globalThis.localStorage, s: globalThis.sessionStorage, loc: globalThis.location };
  const local = mem(), session = mem(), loc = { href: "https://temple.example/?lang=zh&q=low", went: "", replace(u) { this.went = u; } };
  Object.assign(globalThis, { localStorage: local, sessionStorage: session, location: loc });
  try {
    assert.equal(setLang("ja"), true);
    assert.equal(local.getItem("yunjing.lang.v1"), "ja", "the choice is kept");
    assert.equal(loc.went, "https://temple.example/?q=low", "the page opens again without ?lang= overriding the choice");
    assert.equal(takeSwitch(), "zh", "the next page is told the language it came from");
    assert.equal(takeSwitch(), "", "and only once");
    assert.equal(setLang("zh"), false, "the language already in use is not a choice");
    session.setItem("yunjing.lang.from", "klingon"); assert.equal(takeSwitch(), "", "an unknown language is not reported");
  } finally { for (const [k, v] of [["localStorage", was.l], ["sessionStorage", was.s], ["location", was.loc]]) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } }
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
  for (const [name, table] of [["ja", JA], ["en", EN], ["ko", KO]]) {
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
  for (const [name, table] of [["ja", JA], ["en", EN], ["ko", KO]]) {
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
  for (const [zh, out] of Object.entries(KO)) if (!calligraphy.has(zh)) assert.ok(!/[\u3400-\u9fff\u3040-\u30ff]/.test(out), `ko: ${zh} → ${out}`);
  for (const k of calledKeys().keys()) assert.ok(!/[぀-ヿ]/.test(k), `the Chinese of record has kana in it: ${k}`);
});

test("each language draws first in its own faces and falls back to the Chinese ones", () => {
  assert.match(fontsFor("ja").kai, /^"Yunjing Kai JA", "Yunjing Serif JA", "Yunjing Kai"/);
  assert.match(fontsFor("ko").brush, /^"Yunjing Brush KO", "Yunjing Serif KO", "Yunjing Brush"/, "a heading face short of a letter falls back to the reading face first");
  assert.match(fontsFor("en").xing, /^"Yunjing Hand EN", "Yunjing Serif EN", "Yunjing Xing"/);
  assert.match(fontsFor("zh").brush, /^"Yunjing Brush"/);
});

test("every work in the halls has its Japanese and English card, field for field, and the record shows through where none is", async () => {
  const { WORKS } = await import("../../app/levels/t00/works.js");
  const { workIn, workTables, FIELDS } = await import("../../app/levels/t00/works-local.js");
  for (const [name, table] of Object.entries(workTables)) {
    assert.deepEqual(Object.keys(table).sort(), Object.keys(WORKS).sort(), `levels/t00/locales/${name}.js should hold exactly the works in works.js`);
    for (const [slug, w] of Object.entries(WORKS)) {
      const tr = table[slug];
      assert.deepEqual(Object.keys(tr).sort(), [...FIELDS].sort(), `${name}/${slug}: the fields`);
      // Blank where the record is blank (no rank, no dates), written where it is not.
      for (const f of FIELDS) assert.equal(!!tr[f].trim(), !!String(w[f] || "").trim(), `${name}/${slug}.${f}`);
      if (name === "en") for (const f of FIELDS) assert.ok(!/[㐀-鿿぀-ヿ]/.test(tr[f]), `en/${slug}.${f} has characters in it: ${tr[f].slice(0, 40)}`);
      if (name === "ja") assert.ok(/[぀-ヿ]/.test(tr.note), `ja/${slug}: the note should be written in Japanese, not left in Chinese`);
      if (name === "ko") for (const f of FIELDS) assert.ok(!/[\u3400-\u9fff\u3040-\u30ff]/.test(tr[f]), `ko/${slug}.${f} is not in Hangul: ${tr[f].slice(0, 40)}`);
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
