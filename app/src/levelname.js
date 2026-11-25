// How the temple is named where the page says its name in words: the title page's second line, the browser's tab, the
// small seal on the pause menu and on a slip, and the photograph's card. The prologue's names are what the page is
// written with (index.html, the photograph's card), so a level that gives none (Level.name) is left exactly as it was;
// a level that does gives each in Chinese, the record, and the page finds the other languages by it (t(), locales/*.js).
// Name boards on the buildings are not here: they are painted, not translated.
import { t, glyphs } from "./i18n.js";

/** The prologue's own, which the photograph's card was written with. */
export const PROLOGUE_NAME = { temple: "云径禅寺", seal: "云径" };

/** What the photograph's card and the share sheet call the temple the page walks, in Chinese. */
export function templeOf(level) {
  const n = level?.name;
  return n ? { temple: n.temple, seal: n.seal } : PROLOGUE_NAME;
}
/** The card's two names, in the language of the page. */
export function cardNames(level, say = t, calli = glyphs) { const n = templeOf(level); return { temple: say(n.temple), seal: calli(n.seal) }; }

/**
 * Put the level's name on the page's own words, once the level is known. A level with no name changes nothing.
 * @param {{ name?: { temple: string, seal: string, sub: string, page: string } } | null | undefined} level @param {Document} doc
 */
export function applyLevelName(level, doc) {
  const n = level?.name; if (!n) return false;
  const sub = doc.querySelector("#title .title-name .sub"); if (sub) sub.textContent = t(n.sub);
  doc.title = t(n.page);
  for (const m of doc.querySelectorAll("#menu h2 .seal-mark, #slip .seal-mark")) m.textContent = glyphs(n.seal);
  return true;
}
