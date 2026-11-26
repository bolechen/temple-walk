// The language the page speaks: Chinese, Japanese or English. The temple was written in Chinese, and Chinese stays the
// text of record: every line in the code is the Chinese, and `t()` hands back its Japanese or English where the visitor
// reads that and a translation exists (locales/ja.js, locales/en.js, locales/ko.js, keyed by the Chinese itself). Anything not yet translated is shown as written, so a missing line
// never leaves a blank. The name boards, the gallery's museum notes and the debug panel are not translated: the boards
// are carved in the temple's own characters (a Japanese visitor reads them as kanji; to anyone else they are the
// temple's calligraphy, as the seals are), and the notes are the museums'
// records as published (a line on the card says so).
//
// Which language: `?lang=zh|ja|en` for this visit and kept, else what the visitor chose before (`yunjing.lang.v1`), else the
// browser's first language that is one of ours, else Chinese. Changing it reloads the page, so nothing drawn already
// (the title, the plaques, the slips on a canvas) has to be drawn again.
import JA from "../locales/ja.js";
import EN from "../locales/en.js";
import KO from "../locales/ko.js";

export const LANGS = ["zh", "ja", "en", "ko"];
export const LANG_KEY = "yunjing.lang.v1";

/**
 * Which language, and how it was come by: `url` (asked for in the address), `saved` (chosen before), `browser` (the
 * browser's own language, or English where it speaks none of ours) or `default` (Chinese, nothing to go on). The page's
 * analytics reports the source, so that what was chosen by hand can be told from what was recognised.
 * @param {{ search?: string, stored?: string | null, languages?: readonly string[] }} from
 * @returns {{ lang: string, source: "url" | "saved" | "browser" | "default" }}
 */
export function choose({ search = "", stored = null, languages = [] } = {}) {
  const asked = new URLSearchParams(search).get("lang");
  if (asked && LANGS.includes(asked)) return { lang: asked, source: "url" };
  if (stored && LANGS.includes(stored)) return { lang: stored, source: "saved" };
  for (const l of languages) {
    const base = String(l).toLowerCase().split("-")[0];
    if (LANGS.includes(base)) return { lang: base, source: "browser" };
  }
  // A visitor whose browser speaks none of ours reads English sooner than Chinese.
  return languages.length && languages.some((l) => /^[a-z]/i.test(String(l))) ? { lang: "en", source: "browser" } : { lang: "zh", source: "default" };
}
/** @param {Parameters<typeof choose>[0]} from */
export const pickLang = (from) => choose(from).lang;

const read = () => { try { return globalThis.localStorage?.getItem(LANG_KEY) ?? null; } catch { return null; } };
const keep = (l) => { try { globalThis.localStorage?.setItem(LANG_KEY, l); } catch {} };

const SWITCHED = "yunjing.lang.from";
/** The language of this visit and how it was come by. In Node (the unit tests, the tools) there is no page, and it is Chinese. */
const picked = (() => {
  if (typeof globalThis.location === "undefined" || typeof globalThis.navigator === "undefined") return { lang: "zh", source: "default" };
  const c = choose({ search: globalThis.location.search, stored: read(), languages: globalThis.navigator.languages || [globalThis.navigator.language || ""] });
  if (c.source === "url") keep(c.lang);
  return c;
})();
export const lang = picked.lang, langSource = picked.source;

/** The language this page was opened from, if it was opened by choosing another one (once: it is forgotten as it is read). */
export function takeSwitch() {
  try { const from = globalThis.sessionStorage?.getItem(SWITCHED) || ""; globalThis.sessionStorage?.removeItem(SWITCHED); return LANGS.includes(from) ? from : ""; } catch { return ""; }
}

/** @type {Record<string, Record<string, string>>} */
const TABLES = { ja: JA, en: EN, ko: KO };

/** A line in the visitor's language. `{name}` in it is filled from `vars`.
 * @param {string} zh @param {Record<string, string | number>=} vars @param {string=} to */
export function t(zh, vars, to = lang) {
  const table = TABLES[to];
  let s = table && Object.prototype.hasOwnProperty.call(table, zh) ? table[zh] : zh;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}
/** What is drawn as calligraphy (a seal, the book's page, the temple's name): in Japanese it is written in Japanese
 * forms, in Chinese and in English it stays as the temple wrote it.
 * @param {string} zh */
export const glyphs = (zh) => (lang === "ja" ? t(zh) : zh);
/** How a small count is written on the picture, by language: ink numerals where the page writes in characters, digits
 * elsewhere (the owner's choice, 2026-11-26, #651; this table is the one place to change them).
 * @type {Record<string, string>} */
export const NUMERALS = { zh: "〇一二三四五六七", ja: "〇一二三四五六七", en: "01234567", ko: "01234567" };
/** One number from 0 to 7 in a language's own numerals.
 * @param {number} n @param {string=} to */
export const numeral = (n, to = lang) => { const k = NUMERALS[to] || NUMERALS.zh; return k[Math.max(0, Math.min(k.length - 1, Math.floor(n)))]; };
/** The seals held out of the seals there are, as "三 / 七", for the small line beside the book's seal.
 * @param {number} n @param {number} total @param {string=} to */
export const sealCount = (n, total = 7, to = lang) => `${numeral(Math.min(n, total), to)}\u2009/\u2009${numeral(total, to)}`;
/** Whether a line has its own translation (the tests ask). */
export const has = (zh, to = "ja") => !!TABLES[to] && Object.prototype.hasOwnProperty.call(TABLES[to], zh);

// The typefaces each language writes in. Chinese keeps the six cut for it (app/shared/fonts/); Japanese writes in the
// Japanese faces cut for it (`*-ja.woff2`: Klee One, from which the kai was drawn, Noto Serif JP, Yuji Boku and Yuji
// Syuku), English in EB Garamond (`*-en.woff2`, upright for what is read, italic for what is written by hand), and
// each falls back to the Chinese faces for anything it lacks: the untranslated text, and in English the characters of
// the seals, the book and the boards, which stay the temple's calligraphy. A browser only fetches a face it is asked
// to draw with, and only for the characters it draws, so a Chinese visitor never downloads the others.
const ZH = {
  brush: '"Yunjing Brush", "STKaiti", "KaiTi", "Kaiti SC", serif',
  serif: '"Yunjing Serif", "Songti SC", "STSong", serif',
  kai: '"Yunjing Kai", "STKaiti", "KaiTi", "Yunjing Serif", serif',
  xing: '"Yunjing Xing", "Yunjing Kai", "STXingkai", "STKaiti", serif',
  seal: '"Yunjing Seal", "Yunjing Serif", "Songti SC", serif',
};
/** @type {Record<string, Record<string, string>>} */
const FACES = {
  ja: { brush: "Yunjing Brush JA", serif: "Yunjing Serif JA", kai: "Yunjing Kai JA", xing: "Yunjing Xing JA", seal: "Yunjing Seal JA" },
  en: { brush: "Yunjing Hand EN", serif: "Yunjing Serif EN", kai: "Yunjing Serif EN", xing: "Yunjing Hand EN", seal: "Yunjing Serif EN" },
  // Korean: Gowun Batang to read, Song Myung for headings, Nanum Brush Script for what is written by hand. A seal stays in
  // the temple's characters, as Korean temples keep hanja on their seals.
  ko: { brush: "Yunjing Brush KO", serif: "Yunjing Serif KO", kai: "Yunjing Serif KO", xing: "Yunjing Hand KO", seal: "Yunjing Seal" },
};
/** Font stacks for a canvas, by role, in the given language. */
// Each role's own face, then the language's reading face (a heading face may hold fewer letters), then the Chinese faces.
export const fontsFor = (to) => /** @type {Record<keyof typeof ZH, string>} */ (Object.fromEntries(Object.entries(ZH).map(([k, v]) => [k, FACES[to] ? [...new Set([FACES[to][k], FACES[to].serif])].map((f) => `"${f}"`).join(", ") + ", " + v : v])));
export const FONT = fontsFor(lang);
/** The first face of each role's stack, for document.fonts.load (which loads only the first face that matches). */
export const FACE = /** @type {Record<keyof typeof ZH, string>} */ (Object.fromEntries(Object.entries(FONT).map(([k, v]) => [k, v.split(",")[0]])));

// The page as written (index.html) is Chinese. In another language every text node, and the attributes a reader or a
// screen reader sees, whose whole text has a translation, is replaced; an element whose whole inner HTML is a key (a
// word broken by <br>) is replaced as one.
const ATTRS = ["aria-label", "alt", "title", "content"];
/** @param {ParentNode & Node=} root */
export function localize(root = globalThis.document, to = lang) {
  const doc = globalThis.document; if (!doc || to === "zh") return 0;
  const table = TABLES[to]; if (!table) return 0;
  let n = 0;
  const swap = (s) => { const k = s.trim(); return k && Object.prototype.hasOwnProperty.call(table, k) ? s.replace(k, table[k]) : null; };
  /** @param {Node} node */
  const walk = (node) => {
    if (node.nodeType === 3) { const v = swap(node.nodeValue || ""); if (v !== null) { node.nodeValue = v; n++; } return; }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    const el = /** @type {Element} */ (node);
    if (el.nodeType === 1) {
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
      for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const w = swap(v); if (w !== null) { el.setAttribute(a, w); n++; } } }
      const html = el.innerHTML.trim();
      if (html.includes("<") && Object.prototype.hasOwnProperty.call(table, html)) { el.innerHTML = table[html]; n++; return; }
    }
    for (const c of [...node.childNodes]) walk(c);
  };
  walk(root);
  if (root === doc) {
    doc.documentElement.lang = to;
    const og = doc.querySelector('meta[property="og:locale"]'); if (og) og.setAttribute("content", { ja: "ja_JP", en: "en_US", ko: "ko_KR" }[to] || "zh_CN");
  }
  return n;
}

/** Choose a language: kept, and the page is opened again in it, without `?lang=` overriding the choice. */
export function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return false;
  keep(l);
  // The page is opened again at once, and a message sent now may never leave it: the next page tells where it came from.
  try { globalThis.sessionStorage?.setItem(SWITCHED, lang); } catch {}
  const u = new URL(globalThis.location.href); u.searchParams.delete("lang");
  globalThis.location.replace(u.href);
  return true;
}
