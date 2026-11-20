// A lamp lit for someone (#343). Only a number goes into the link: which of these lines, and the season and hour it was
// lit in. What the page shows of a link is one of these lines, looked up by number, so nothing a stranger writes can appear
// (there is nowhere to write it, and a number outside the list is ignored).
//
// The order is the link's meaning: a line may be reworded or translated, never moved or removed, and a new one goes at
// the end. THE LINES BELOW ARE PLACEHOLDERS until the owner settles the wording (#343).
import { pack, unpack } from "./fragment.js";
import { MAIN } from "./goshuin.js";
import { SEASONS, TIMES } from "./mood.js";

export const WISHES = [
  "愿你一路平安。",
  "愿你身心安宁。",
  "愿你所求，慢慢如愿。",
  "愿你夜夜安眠，晨起有光。",
  "愿你被善意相待。",
  "愿你放下心头的重。",
  "愿你近来诸事顺利。",
  "愿你常有灯，也常有人同行。",
];
/** The kind in the address's fragment. */
export const KIND = "lamp";

/** @typedef {{ wish: number, season: string, time: string }} Lamp */
/** The text after `#` for a lamp, or null if it names none of the lines, seasons or hours. @param {Lamp} lamp */
export function encodeLamp({ wish, season, time }) {
  const s = SEASONS.indexOf(season), h = TIMES.indexOf(time);
  if (!Number.isInteger(wish) || wish < 0 || wish >= WISHES.length || s < 0 || h < 0) return null;
  return pack(KIND, [wish, (s << 2) | h]);
}
/** The lamp a fragment names, or null for anything else (damaged, too new, another kind, a number not in the list). @param {string} hash @returns {Lamp | null} */
export function decodeLamp(hash) {
  const u = unpack(hash);
  if (!u.ok || u.kind !== KIND || u.bytes.length !== 2) return null;
  const wish = u.bytes[0], s = u.bytes[1] >> 2, h = u.bytes[1] & 3;
  if (wish >= WISHES.length || u.bytes[1] > 15) return null;
  return { wish, season: SEASONS[s], time: TIMES[h] };
}
/** The address to hand someone: the main site, whichever address drew the card, told apart by its source, and the lamp after `#`. @param {Lamp} lamp @param {string} lang */
export function lampLink(lamp, lang) {
  const frag = encodeLamp(lamp); if (!frag) return null;
  return `${MAIN.url}?utm_source=lamp&utm_medium=share&utm_content=${lang}#${frag}`;
}
