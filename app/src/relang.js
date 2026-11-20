// A change of language in the pause menu opens the page again, since the words, the faces and everything drawn in
// them are fixed as the page is built (#140, route A). What the visitor was doing is handed across that reload in
// sessionStorage, read once and forgotten: where he stood, the way he faced and looked, how he saw, how near the eye
// was, the hall or the balcony he was in, and the season and hour of this visit. The page that opens finds it, skips
// the title and the opening, stands him there and opens the menu again on the language just chosen. A reload of any
// other kind, a new tab or an address that names its own place finds nothing (or ignores what it finds).
export const RELANG_KEY = "yunjing.relang.v1";
/** How long a handover keeps: long enough for a slow phone to load the page again, not so long that a later reload takes it. */
export const RELANG_FRESH = 3 * 60 * 1000;
const SEASONS = ["spring", "summer", "autumn", "winter"], TIMES = ["dawn", "day", "dusk", "night"], LANGS = ["zh", "ja", "en", "ko"];
const num = (v, lim) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim;
const word = (v) => (typeof v === "string" && /^[a-z]{1,24}$/.test(v) ? v : null);

/** What was handed over, checked field by field; null if it is not usable, stale, or meant for another language. */
export function sanitizeRelang(o, { now = Date.now(), lang = null } = {}) {
  if (!o || typeof o !== "object") return null;
  if (!num(o.x, 5000) || !num(o.z, 5000) || !num(o.at, 1e14) || now - o.at > RELANG_FRESH || o.at - now > 60000) return null;
  if (!LANGS.includes(o.to) || (lang && o.to !== lang)) return null;
  return {
    x: o.x, z: o.z, yaw: num(o.yaw, 100) ? o.yaw : 0, pitch: num(o.pitch, 2) ? o.pitch : 0,
    view: o.view === "first" ? "first" : "third", reach: num(o.reach, 20) && o.reach > 0 ? o.reach : null,
    dist: num(o.dist, 20) && o.dist >= 0 ? o.dist : null,   // how far behind him the eye stood, as against how far it would like to (#368)
    hall: word(o.hall), up: word(o.up),
    season: SEASONS.includes(o.season) ? o.season : null, time: TIMES.includes(o.time) ? o.time : null, follow: o.follow === true,
    from: LANGS.includes(o.from) ? o.from : null, to: o.to, at: o.at,
  };
}
/** Hand the visit over to the page about to open. @param {Storage} storage */
export function keepRelang(storage, s) { try { storage.setItem(RELANG_KEY, JSON.stringify({ ...s, at: s.at ?? Date.now() })); return true; } catch { return false; } }
/** Whether a handover is waiting (it is not taken): the first script uses it to cover the title before it is painted. @param {Storage} storage */
export function peekRelang(storage, opts = {}) { try { return sanitizeRelang(JSON.parse(storage.getItem(RELANG_KEY) || "null"), opts); } catch { return null; } }
/** Take the handover, once: it is forgotten as it is read, whether or not it is usable. @param {Storage} storage */
export function takeRelang(storage, opts = {}) {
  let raw = null;
  try { raw = storage.getItem(RELANG_KEY); storage.removeItem(RELANG_KEY); } catch {}
  try { return sanitizeRelang(JSON.parse(raw || "null"), opts); } catch { return null; }
}
