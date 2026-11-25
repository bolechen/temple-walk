// What a level other than the prologue keeps of a visit, apart from the prologue's own keys (S4 of docs/t05/LEVEL-SPLIT.md).
// One key, `yunjing.levels.v1`, holds a record for each such level: for now only where he stood, which is all T05's first
// edition keeps (no book, no seal, no title: those come in the second step). The prologue's ten keys are not read, written
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

/** The whole record as stored, cleaned: unknown levels, bad places and a newer or damaged envelope are dropped. */
export function readLevels(storage) {
  let raw;
  try { raw = JSON.parse(storage.getItem(LEVELS_KEY) || "null"); } catch { return { v: VERSION, last: null, place: {} }; }
  const out = { v: VERSION, last: null, place: {} };
  if (!raw || typeof raw !== "object" || raw.v !== VERSION || !raw.place || typeof raw.place !== "object") return out;
  for (const id of Object.keys(raw.place)) { if (!ID.test(id)) continue; const p = sanitizeLevelPlace(raw.place[id]); if (p) out.place[id] = p; }
  if (typeof raw.last === "string" && raw.last in out.place) out.last = raw.last;
  return out;
}
export function readLevelPlace(storage, id) { return ID.test(id) ? readLevels(storage).place[id] || null : null; }
export function writeLevelPlace(storage, id, p) {
  if (!ID.test(id)) return false;
  const q = sanitizeLevelPlace(p); if (!q) return false;
  const all = readLevels(storage);
  all.place[id] = { x: +q.x.toFixed(2), z: +q.z.toFixed(2), yaw: +q.yaw.toFixed(3), at: q.at || Date.now() }; all.last = id;
  try { storage.setItem(LEVELS_KEY, JSON.stringify(all)); return true; } catch { return false; }
}
export function clearLevelPlace(storage, id) {
  const all = readLevels(storage); if (!(id in all.place)) return;
  delete all.place[id]; if (all.last === id) all.last = null;
  try { storage.setItem(LEVELS_KEY, JSON.stringify(all)); } catch {}
}
