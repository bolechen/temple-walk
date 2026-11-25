// A level's own words, said in the visitor's language: the level's table (`Level.tr`, kept with the level) first, then the
// page's own (t()), and the Chinese as written when neither has it. Kept apart from app/locales/ so that a build which
// holds no such level carries none of its words (the public page carries nothing of T05).
import { t, lang } from "./i18n.js";

/** @param {{ tr?: Record<string, Record<string, string>> } | null | undefined} level @param {string} line @param {string} [to] */
export function levelSay(level, line, to = lang) { return level?.tr?.[to]?.[line] ?? t(line, undefined, to); }
