// Where he was when the visitor left: kept from moment to moment, so that coming back offers to go on from there.
// Book-keeping only (the seals are journey.js's, the settings settings.js's): one key, every value checked on the
// way in, a damaged save ignored. game.js decides what the title offers; yard.js puts him there.
import { t } from "./i18n.js";

export const PLACE_KEY = "yunjing.place.v1";

/** The addresses that name their own place: a tool or a test is left where it asked to be, and keeps nothing. */
const NAMED = ["cam", "show", "shot", "in", "tour", "enter"], BENCH_NAMED = ["at", "play", "seals"];
/**
 * Whether this page reads and keeps where he was. Only a level that says it keeps a place does (the prologue: the key
 * is the prologue's, and another level's ground would be read as the prologue's, #385); and never an address that names
 * its own place. No level given is the prologue, as every page was before levels.
 * @param {URLSearchParams} params @param {boolean} bench the workbench (dev server, a pull request's preview) @param {{ keepsPlace?: boolean, keepsOwnPlace?: boolean } | null} [level]
 */
export function placeKept(params, bench, level = null) {
  if (level && !level.keepsPlace && !level.keepsOwnPlace) return false;   // a level with a place of its own keeps it apart (levelsave.js, S4)
  return !(NAMED.some((k) => params.has(k)) || (bench && BENCH_NAMED.some((k) => params.has(k))));
}

/** What was saved, or null if there is nothing usable: a place on the ground, the way he faced, what to call it. */
export function sanitizePlace(saved) {
  if (!saved || typeof saved !== "object") return null;
  const { x, z, yaw, label, at, up, hall } = saved;
  if (![x, z].every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 5000)) return null;
  return { x, z, yaw: typeof yaw === "number" && Number.isFinite(yaw) ? yaw : 0, label: typeof label === "string" ? label.slice(0, 12) : "", at: typeof at === "number" && Number.isFinite(at) ? at : 0,
    up: typeof up === "string" && /^[a-z]{1,24}$/.test(up) ? up : null,   // up on a balcony (site.lofts), or on the ground
    hall: typeof hall === "string" && /^[a-z][a-z0-9-]{0,23}$/.test(hall) ? hall : null };   // in a hall's room (#375): x and z are the room's, under the courts; a place kept before this has none and is read as on the ground
}
export function readPlace(storage) { try { return sanitizePlace(JSON.parse(storage.getItem(PLACE_KEY) || "null")); } catch { return null; } }
export function writePlace(storage, p) { try { storage.setItem(PLACE_KEY, JSON.stringify({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +(p.yaw || 0).toFixed(3), label: p.label || "", at: p.at || Date.now(), ...(p.up ? { up: p.up } : {}), ...(p.hall ? { hall: p.hall } : {}) })); return true; } catch { return false; } }
export function clearPlace(storage) { try { storage.removeItem(PLACE_KEY); } catch {} }

/**
 * What to call where he stands, for the line on the title: the hall he is in, else the nearest place an observance is
 * made if one is near, else only that he was on the way.
 * @param {{ x: number, z: number }} w  @param {string | null} hall the hall's name if he is indoors
 * @param {{ place: string, at: number[] }[]} named the outdoor places and what each is called
 */
export function labelOf(w, hall, named) {
  if (hall) return hall;
  let best = 16, name = "";
  for (const p of named) { const d = Math.hypot(p.at[0] - w.x, p.at[1] - w.z); if (d < best) { best = d; name = p.place; } }
  return name || "山路上";
}

/** Whether there is anything to go on from: a seal earned, or a place saved well away from where the path begins. */
export function hasProgress(seals, place, start) { return seals > 0 || (!!place && Math.hypot(place.x - start[0], place.z - start[1]) > 8); }

/** What the title says and offers. `n` seals of `of`; the words are the page's own, kept here so they are tested with the rule.
 * The label kept is always the Chinese name (it is the key the translations are found by), so a visitor who changes
 * language finds it said in the new one. `to` is the language, the visitor's own by default. */
export function titleOffer(n, of, place, start, to = undefined) {
  const going = hasProgress(n, place, start), digits = "〇一二三四五六七八九";
  const seals = n >= of ? t("七印圆满", undefined, to) : n ? t("已得{n}印", { n: digits[n], k: n }, to) : "";
  const where = going && place && place.label ? (place.label === "山路上" ? t("上回停在山路上", undefined, to) : t("上回走到{place}", { place: t(place.label, undefined, to) }, to)) : "";
  return { going, enter: going ? t("接着走", undefined, to) : t("入山", undefined, to), again: going ? t("从头走起", undefined, to) : "", confirm: n ? t("再点一次：朱印清空，从竹径走起", undefined, to) : t("再点一次：回到竹径，从头走起", undefined, to), line: [seals, where].filter(Boolean).join(" · ") };
}
