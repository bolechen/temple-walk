// The name of the temple the page walks, as a visitor reads it on a photograph, a saved file, a share sheet or the book.
// Each level says its own (Level.name, the two characters of Level.seal); the strings the page has always shown for the
// prologue stay as they are in the locale tables, written with that temple's name, and are turned into another temple's
// here, so a level needs one entry for its name in each language and not one for every line that holds it (#703, S3a).
import { t, lang } from "./i18n.js";
import { levelSay } from "./levelsay.js";

/** The prologue's own name and seal: the words the locale tables' lines are written with. */
export const T00_NAME = "云径禅寺", T00_SEAL = "云径";
/** @typedef {{ name?: string, seal?: string, tr?: Record<string, Record<string, string>> }} Named */
/** The level's name in a language: its own, or the locale tables' line for it. @param {Named} level @param {string} [to] */
const nameIn = (level, to = lang) => levelSay(level, /** @type {string} */ (level.name), to);

let current = /** @type {Named | null} */ (null);
/** The page says which level it walks, once, after loading it. @param {Named | null | undefined} level */
export function setTemple(level) { current = level || null; }

/** A name as a file name's stem: "Yunjing Temple" → "yunjing-temple". @param {string} s */
const slug = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

/**
 * A line the prologue's tables hold, said of `level`'s temple: translated as ever, then its temple's name put where the
 * prologue's stood (also as the lowercase stem of a file's name). For the prologue, or a level that names nothing, the
 * line is exactly what `t` gives.
 * @param {Named | null | undefined} level @param {string} zh @param {Record<string, string | number>} [vars] @param {string} [to]
 */
export function said(level, zh, vars, to) {
  const out = t(zh, vars, to);
  const name = level?.name;
  if (!name || name === T00_NAME) return out;
  const was = t(T00_NAME, undefined, to), now = nameIn(level, to);
  // A file's name in English is the temple's lowercase stem: "yunjing-temple-lamp.jpg", "yunjing-year-end-bell.jpg".
  const stem = slug(nameIn(level, "en")).replace(/-temple$/, "");
  return out.replaceAll(was, now).replaceAll(slug(was), slug(now)).replaceAll("yunjing", stem);
}
/** The temple's name for a card or a share sheet. @param {Named | null | undefined} level @param {string} [to] */
export const templeOf = (level, to) => said(level, T00_NAME, undefined, to);
/** The two characters its seal is cut with, in the forms the language writes (Japanese where its table has them, otherwise as cut). @param {Named | null | undefined} level @param {string} [to] */
export const sealOf = (level, to) => (to ?? lang) === "ja" ? t(level?.seal || T00_SEAL, undefined, to) : level?.seal || T00_SEAL;
/** A file's stem named for the temple: "yunjing" for the prologue. @param {Named | null | undefined} level @param {string} [to] */
export const stemOf = (level, to) => (level?.name && level.name !== T00_NAME ? slug(nameIn(level, "en")).replace(/-temple$/, "") : "yunjing");

// What the page walks (set once by yard.js), for the parts that are handed no level.
/** @param {string} zh @param {Record<string, string | number>} [vars] @param {string} [to] */
export const saidNow = (zh, vars, to) => said(current, zh, vars, to);
export const templeNow = () => templeOf(current);
export const sealNow = () => sealOf(current);
export const stemNow = () => stemOf(current);
/** The temple's name in Chinese, for what is drawn as calligraphy (the book's page): `glyphs` then writes it in the forms the language uses. */
/**
 * The verse a photograph prints: the hours' own for a level that says nothing, or only what the level itself gives this
 * season and hour (none, when it gives none). @param {{ ownVerse?: boolean, moodFor?: (s: string, t: string, m: any) => any } | null | undefined} level
 * @param {string} season @param {string} time @param {string} line the hours' own verse
 */
export const verseOf = (level, season, time, line) => (level?.ownVerse ? level.moodFor?.(season, time, {})?.line || "" : line);
export const nameNow = () => current?.name || T00_NAME;

/**
 * What index.html says of the prologue in its markup (the tab's title, the link previews' titles, the small seals on the menu
 * and the slip, the title page's second line), put right for another level's temple. The prologue is left exactly as written.
 * @param {Document} doc @param {Named | null | undefined} level
 */
export function paintTemple(doc, level) {
  if (!level?.name || level.name === T00_NAME) return;
  const name = templeOf(level), title = `${t("山门之外")} · ${name}`;
  doc.title = title;
  for (const sel of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) doc.querySelector(sel)?.setAttribute("content", title);
  for (const el of doc.querySelectorAll(".seal-mark[aria-hidden]")) el.textContent = sealOf(level);
  const sub = doc.querySelector("#title .sub"); if (sub) sub.textContent = name;   // no 序章: the prologue's chapter mark is not this temple's
}
