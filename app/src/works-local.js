// The real works' cards in the visitor's language (src/i18n.js): the Chinese record written by tools/gallery.py
// (works.js), with the Japanese or English of each field laid over it where there is one (works-ja.js, works-en.js).
// The museums' source lines, the sizes and the pictures are the record's own, in every language.
import { WORKS } from "./works.js";
import JA from "./works-ja.js";
import EN from "./works-en.js";
import { lang } from "./i18n.js";

/** @type {Record<string, Record<string, Record<string, string>>>} */
const TABLES = { ja: JA, en: EN };
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
