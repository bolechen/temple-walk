// The real works' cards in the visitor's language (src/i18n.js): the Chinese record written by tools/gallery.py
// (works.js), with the Japanese, English or Korean of each field laid over it where there is one (locales/ja.js, en.js, ko.js beside it).
// The museums' source lines, the sizes and the pictures are the record's own, in every language.
import { WORKS } from "./works.js";
import JA from "./locales/ja.js";
import EN from "./locales/en.js";
import KO from "./locales/ko.js";
import { lang } from "../../src/i18n.js";

/** @type {Record<string, Record<string, Record<string, string>>>} */
const TABLES = { ja: JA, en: EN, ko: KO };
export const FIELDS = ["title", "by", "dates", "period", "medium", "holder", "rank", "note", "link"];

/** One work as the visitor reads it, or null. @param {string} slug @param {string=} to */
export function workIn(slug, to = lang) {
  const w = WORKS[slug]; if (!w) return null;
  const tr = TABLES[to] && TABLES[to][slug]; if (!tr) return w;
  const out = { ...w };
  for (const f of FIELDS) if (typeof tr[f] === "string" && (tr[f] || !w[f])) out[f] = tr[f];
  return out;
}
export const workTables = TABLES;
