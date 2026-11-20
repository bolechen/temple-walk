// A lamp lit for someone (#343). Only a number goes into the link: which of these lines, and the season and hour it was
// lit in. What the page shows of a link is one of these lines, looked up by number, so nothing a stranger writes can appear
// (there is nowhere to write it, and a number outside the list is ignored).
//
// The order is the link's meaning: a line may be reworded or translated, never moved or removed, and a new one goes at
// the end. Settled by the owner on 2026-11-20 (#343); the Japanese, English and Korean are by meaning, not word for word, in
// the same quiet voice (locales/*.js). The second is for the sick (the Medicine Buddha's lamps were first lit for them) and the
// seventh for those who are gone or far away.
import { pack, unpack } from "./fragment.js";
import { MAIN } from "./goshuin.js";
import { SEASONS, TIMES } from "./mood.js";

export const WISHES = [
  "一灯为你，愿你平安。",
  "愿你病苦渐轻，身心安稳。",
  "愿你今夜好眠。",
  "愿你前路有光，不必着急。",
  "愿你放下，也被放过。",
  "山中一灯，替你照着。",
  "愿所念之人，皆得安住。",
  "灯不大，够照见你脚下的路。",
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
