// What a level other than the prologue keeps of a visit, apart from the prologue's own keys (S4 of docs/t05/LEVEL-SPLIT.md).
// One key, `yunjing.levels.v1`, holds a record for each such level: where he stood, and the marks on that temple's own page
// (T05: the stroke of ink for the whole seen from the court and below the eaves, and the line copied from the stele;
// docs/t05/CHECKPOINTS.md §2.2, PRD.md §1.3 (a)). No seal and no title: those come with the great hall. The prologue's ten keys are not read, written
// or cleared here, and its place stays under `yunjing.place.v1` exactly as before; this file never sees them.
// Book-keeping only, like resume.js: every value is checked on the way in, a damaged save is ignored, and a write for one
// level leaves every other level's record as it found it.

export const LEVELS_KEY = "yunjing.levels.v1";
const VERSION = 1;
/** A level's id as the folder is named (t05, t12). The prologue, t00, is never kept here, and `_probe` is not a visitor's. */
const ID = /^t(?!00$)\d{2}$/;

/** Where he stood: a point on the ground, the way he faced, when. Nothing usable is null. */
export function sanitizeLevelPlace(p) {
  if (!p || typeof p !== "object") return null;
  const { x, z, yaw, at } = p;
  if (![x, z].every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 5000)) return null;
  return { x, z, yaw: typeof yaw === "number" && Number.isFinite(yaw) ? yaw : 0, at: typeof at === "number" && Number.isFinite(at) ? at : 0 };
}

/** A mark's name on a page (p1, stele), and the most a page may hold: anything else is dropped on the way in. */
const MARK = /^[a-z][a-z0-9]{0,11}$/, MARKS = 12, WORD = /^[a-z][a-z0-9-]{0,23}$/;
const when = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e14;
/**
 * One mark on a page: when it was made, and, for a line written on it, which line (the level's own name for it, never the
 * words themselves, which the level's tables hold in every language). Nothing usable is null.
 */
export function sanitizeMark(m) {
  if (!m || typeof m !== "object" || !when(m.at)) return null;
  return typeof m.line === "string" && WORD.test(m.line) ? { at: m.at, line: m.line } : { at: m.at };
}
/** A page: its marks by name, cleaned. */
export function sanitizePage(p) {
  const out = /** @type {Record<string, { at: number, line?: string }>} */ ({});
  if (!p || typeof p !== "object" || Array.isArray(p)) return out;
  for (const k of Object.keys(p).slice(0, 64)) { if (!MARK.test(k) || Object.keys(out).length >= MARKS) continue; const m = sanitizeMark(p[k]); if (m) out[k] = m; }
  return out;
}
const empty = () => ({ v: VERSION, last: /** @type {string | null} */ (null), place: /** @type {Record<string, any>} */ ({}), page: /** @type {Record<string, Record<string, { at: number, line?: string }>>} */ ({}) });

/** The whole record as stored, cleaned: unknown levels, bad places and marks, and a newer or damaged envelope are dropped. */
export function readLevels(storage) {
  let raw;
  try { raw = JSON.parse(storage.getItem(LEVELS_KEY) || "null"); } catch { return empty(); }
  const out = empty();
  if (!raw || typeof raw !== "object" || raw.v !== VERSION) return out;
  if (raw.place && typeof raw.place === "object" && !Array.isArray(raw.place))
    for (const id of Object.keys(raw.place)) { if (!ID.test(id)) continue; const p = sanitizeLevelPlace(raw.place[id]); if (p) out.place[id] = p; }
  if (raw.page && typeof raw.page === "object" && !Array.isArray(raw.page))
    for (const id of Object.keys(raw.page)) { if (!ID.test(id)) continue; const pg = sanitizePage(raw.page[id]); if (Object.keys(pg).length) out.page[id] = pg; }
  if (typeof raw.last === "string" && raw.last in out.place) out.last = raw.last;
  return out;
}
/** What the record writes: the page left out where no level has one, so that a save made before pages reads back as it was. */
const store = (storage, all) => { const o = Object.keys(all.page).length ? all : { v: all.v, last: all.last, place: all.place }; try { storage.setItem(LEVELS_KEY, JSON.stringify(o)); return true; } catch { return false; } };
export function readLevelPlace(storage, id) { return ID.test(id) ? readLevels(storage).place[id] || null : null; }
export function writeLevelPlace(storage, id, p) {
  if (!ID.test(id)) return false;
  const q = sanitizeLevelPlace(p); if (!q) return false;
  const all = readLevels(storage);
  all.place[id] = { x: +q.x.toFixed(2), z: +q.z.toFixed(2), yaw: +q.yaw.toFixed(3), at: q.at || Date.now() }; all.last = id;
  return store(storage, all);
}
export function clearLevelPlace(storage, id) {
  const all = readLevels(storage); if (!(id in all.place)) return;
  delete all.place[id]; if (all.last === id) all.last = null;
  store(storage, all);
}

/** A level's page: its marks by name ({} where it has none). */
export function readLevelPage(storage, id) { return ID.test(id) ? readLevels(storage).page[id] || {} : {}; }
/**
 * Puts a mark on a level's page. A mark already made stays as it was first made (the page is not written over: a stroke
 * of ink is not made twice), unless `again` asks for it to be made anew (a second line copied replaces the first).
 * @returns {boolean} whether the page changed
 */
export function markLevelPage(storage, id, name, mark, again = false) {
  if (!ID.test(id) || !MARK.test(name)) return false;
  const m = sanitizeMark(mark); if (!m) return false;
  const all = readLevels(storage), pg = all.page[id] || {};
  if (pg[name] && !again) return false;
  if (!pg[name] && Object.keys(pg).length >= MARKS) return false;
  all.page[id] = { ...pg, [name]: m };
  return store(storage, all);
}
/** Empties a level's page (从头走起 in that temple: its own marks only). */
export function clearLevelPage(storage, id) {
  const all = readLevels(storage); if (!(id in all.page)) return;
  delete all.page[id]; store(storage, all);
}
