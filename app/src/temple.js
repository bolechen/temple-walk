// The name of the temple the page walks, as a visitor reads it on a photograph, a saved file, a share sheet or the book.
// Each level says its own (Level.name, the two characters of Level.seal); the strings the page has always shown for the
// prologue stay as they are in the locale tables, written with that temple's name, and are turned into another temple's
// here, so a level needs one entry for its name in each language and not one for every line that holds it (#703, S3a).
import { t, lang } from "./i18n.js";

/** The prologue's own name and seal: the words the locale tables' lines are written with. */
export const T00_NAME = "云径禅寺", T00_SEAL = "云径";
/** @typedef {{ name?: string, seal?: string, names?: Record<string, string> }} Named */
/** The level's name in a language: its own, or the locale tables' line for it. @param {Named} level @param {string} [to] */
const nameIn = (level, to = lang) => level.names?.[to] ?? t(/** @type {string} */ (level.name), undefined, to);

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
export const nameNow = () => current?.name || T00_NAME;
