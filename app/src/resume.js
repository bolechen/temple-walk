// Where he was when the visitor left: kept from moment to moment, so that coming back offers to go on from there.
// Book-keeping only (the seals are journey.js's, the settings settings.js's): one key, every value checked on the
// way in, a damaged save ignored. game.js decides what the title offers; yard.js puts him there.
export const PLACE_KEY = "yunjing.place.v1";

/** What was saved, or null if there is nothing usable: a place on the ground, the way he faced, what to call it. */
export function sanitizePlace(saved) {
  if (!saved || typeof saved !== "object") return null;
  const { x, z, yaw, label, at } = saved;
  if (![x, z].every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 5000)) return null;
  return { x, z, yaw: typeof yaw === "number" && Number.isFinite(yaw) ? yaw : 0, label: typeof label === "string" ? label.slice(0, 12) : "", at: typeof at === "number" && Number.isFinite(at) ? at : 0 };
}
export function readPlace(storage) { try { return sanitizePlace(JSON.parse(storage.getItem(PLACE_KEY) || "null")); } catch { return null; } }
export function writePlace(storage, p) { try { storage.setItem(PLACE_KEY, JSON.stringify({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +(p.yaw || 0).toFixed(3), label: p.label || "", at: p.at || Date.now() })); return true; } catch { return false; } }
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

/** What the title says and offers. `n` seals of `of`; the words are the page's own, kept here so they are tested with the rule. */
export function titleOffer(n, of, place, start) {
  const going = hasProgress(n, place, start), digits = "〇一二三四五六七八九";
  const seals = n >= of ? "七印圆满" : n ? `已得${digits[n]}印` : "";
  const where = going && place && place.label ? (place.label === "山路上" ? "上回停在山路上" : `上回走到${place.label}`) : "";
  return { going, enter: going ? "接着走" : "入山", again: going ? "从头走起" : "", confirm: n ? "再点一次：朱印清空，从竹径走起" : "再点一次：回到竹径，从头走起", line: [seals, where].filter(Boolean).join(" · ") };
}
