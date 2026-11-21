// 行脚图, phase one (#449): the temples whose close has been played, and how a visitor crosses from one temple's page
// to another's. This file is only the book-keeping and the small machines the page drives; it knows nothing of the DOM
// or the scene (pilgrimage-ui.js puts it on the page, ink.js draws the curtain).
//
// Three things live here:
//  - the record, `yunjing.pilgrimage.v1`: for each temple the time its close was first played and the season it was
//    last played in. It is a visitor's, not a temple's: each temple's own book (journey.js) is emptied by 从头走起 and
//    this is not, and nothing a visitor does empties it;
//  - when the entrances to the map appear, and what the map holds (a temple closed is a place to go, the one he is in is
//    marked, one not yet visited is a fog that carries no name);
//  - what a crossing hands to the page that opens (sessionStorage, read once, as src/relang.js hands a change of language
//    across), and the address of that page.

export const PILGRIMAGE_KEY = "yunjing.pilgrimage.v1";
export const SEASONS = ["spring", "summer", "autumn", "winter"], TIMES = ["dawn", "day", "dusk", "night"];
/** No more temples than this are read from a record, whatever it says. */
export const MAX_TEMPLES = 32;
/** A record is a few dozen bytes a temple: a stored text longer than this is not a record. */
const MAX_TEXT = 4096;
/** A clock this far ahead of ours is a clock a little fast, not a close that has not happened. */
const SKEW = 60_000;

const word = (v) => (typeof v === "string" && /^[a-z][a-z0-9]{0,23}$/.test(v) ? v : null);
const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * A record as stored, checked entry by entry. Only the temples in `known` are looked for, and only as the record's own
 * keys, so that a name an object merely inherits is never a temple; the rest of the record is dropped. A temple whose
 * time is not a time is not closed; a season that is not a season is not known.
 * @param {any} raw @param {{ now?: number, known?: string[] }} [o]
 * @returns {Record<string, { closed: number, season: string | null }>}
 */
export function sanitizeRecord(raw, { now = Date.now(), known = [] } = {}) {
  /** @type {Record<string, { closed: number, season: string | null }>} */
  const out = {};
  if (!isObject(raw)) return out;
  for (const id of known.slice(0, MAX_TEMPLES)) {
    if (!word(id) || !Object.hasOwn(raw, id)) continue;
    const e = raw[id];
    if (!isObject(e) || typeof e.closed !== "number" || !Number.isFinite(e.closed) || e.closed <= 0 || e.closed > now + SKEW) continue;
    out[id] = { closed: e.closed, season: SEASONS.includes(e.season) ? e.season : null };
  }
  return out;
}

/**
 * The record over a store (anything with get() → text|null and set(text); the page passes localStorage's). Nothing is held
 * in memory that the store does not say, so two readers of one store always agree. `known` is the ids of the temples this
 * build lists.
 * @param {{ get: () => string | null, set: (v: string) => void }} store
 * @param {{ now?: () => number, known?: string[] }} [o]
 */
export function createPilgrimage(store, { now = () => Date.now(), known = [] } = {}) {
  const read = () => {
    try { const text = store.get(); if (typeof text !== "string" || text.length > MAX_TEXT) return {}; return sanitizeRecord(JSON.parse(text), { now: now(), known }); } catch { return {}; }
  };
  const write = (rec) => { try { store.set(JSON.stringify(rec)); return true; } catch { return false; } };
  return {
    read,
    has: (id) => Object.hasOwn(read(), id),
    get: (id) => read()[id] || null,
    count: () => Object.keys(read()).length,
    list: () => Object.entries(read()).map(([id, e]) => ({ id, ...e })).sort((a, b) => a.closed - b.closed),
    /**
     * A close was played. The first time for a temple is when it was closed (`at` carries over a close an older book kept);
     * after that only the season moves on, to the one last played in. Returns true the first time only.
     * @param {string} id @param {{ season?: string | null, at?: number }} [o]
     */
    mark(id, { season = null, at } = {}) {
      if (!known.includes(id) || !word(id)) return false;
      const rec = read(), had = Object.hasOwn(rec, id), t = now();
      const when = Number.isFinite(at) && /** @type {number} */ (at) > 0 && /** @type {number} */ (at) <= t + SKEW ? /** @type {number} */ (at) : t;
      const s = SEASONS.includes(/** @type {string} */ (season)) ? /** @type {string} */ (season) : null;
      if (had) { if (!s || rec[id].season === s) return false; rec[id] = { ...rec[id], season: s }; write(rec); return false; }
      rec[id] = { closed: when, season: s }; write(rec); return true;
    },
    /** For the debug panel and the test hooks only: no way a visitor takes calls it. */
    wipe() { return write({}); },
  };
}

/**
 * Whether the entrances to the map (the pause menu's row, the book's, a hold on Q) are there: some temple this build lists
 * has been closed, and the build lists another to go to. The public page lists one temple and so has none.
 * @param {any} record @param {string[]} listed
 */
export function entriesOpen(record, listed) {
  if (!isObject(record) || !Array.isArray(listed) || listed.length < 2) return false;
  return listed.some((id) => Object.hasOwn(record, id));
}

/**
 * What the map shows, one entry for each temple the build lists, in the order the build lists them. A temple closed is a
 * place to go; the one he is in is marked (and says when it was last closed, if it was); one not yet visited is a fog
 * whose entry carries neither an id nor a region nor a seal, so that nothing of it can reach the page.
 * @param {any} record @param {string[]} listed @param {string} current
 * @param {Record<string, { region: string, seal: string }>} places
 */
export function mapEntries(record, listed, current, places) {
  return listed.map((id) => {
    const e = isObject(record) && Object.hasOwn(record, id) ? record[id] : null, p = places[id];
    if (id === current) return { id, state: "here", go: false, region: p.region, seal: p.seal, season: e ? e.season : null };
    if (e) return { id, state: "closed", go: true, region: p.region, seal: p.seal, season: e.season };
    return { state: "fog", go: false };
  });
}

/** A hold on Q fills in this many milliseconds. */
export const HOLD_MS = 1000;
/**
 * A key held until a ring is full (the owner's rule of 2026-11-21: a ring of ink from empty to full, opening when full,
 * cancelled by letting go). The page calls `tick()` every frame while it is held; the clock is the caller's, so that a test
 * can hold it still.
 * @param {{ ms?: number, now?: () => number, onProgress?: (p: number) => void, onFull?: () => void, onCancel?: () => void }} [o]
 */
export function createHold({ ms = HOLD_MS, now = () => performance.now(), onProgress = () => {}, onFull = () => {}, onCancel = () => {} } = {}) {
  let active = false, t0 = 0, p = 0;
  return {
    down() { if (active) return false; active = true; t0 = now(); p = 0; onProgress(0); return true; },
    tick() { if (!active) return; p = Math.min(1, Math.max(0, (now() - t0) / ms)); onProgress(p); if (p >= 1) { active = false; onFull(); } },
    up() { if (!active) return false; active = false; onCancel(); return true; },
    state: () => ({ active, progress: p }),
  };
}

// ---- what a crossing hands across ----
// Going to another temple opens the page again (one page builds one temple, #449): what the visit was is handed across in
// sessionStorage, read once and forgotten, a few minutes at most, for the temple it names. The page that opens finds it,
// skips the title and the opening, stands him at that temple's start, and opens the ink curtain it came up behind once the
// temple can be drawn.
export const CROSSING_KEY = "yunjing.crossing.v1";
export const CROSSING_FRESH = 3 * 60 * 1000;
/** The parts of an address that say where to stand, or begin a moment on the workbench: a crossing names its own, so they leave the address. */
export const CROSSING_DROPS = ["cam", "show", "shot", "in", "up", "season", "time", "view", "devpose", "enter", "tour", "at", "play", "seals"];

/** @param {any} o @param {{ now?: number, level?: string | null }} [opts] */
export function sanitizeCrossing(o, { now = Date.now(), level = null } = {}) {
  if (!isObject(o)) return null;
  const to = word(o.to);
  if (!to || (level && to !== level)) return null;
  if (typeof o.at !== "number" || !Number.isFinite(o.at) || o.at <= 0 || now - o.at > CROSSING_FRESH || o.at - now > SKEW) return null;
  return { from: word(o.from), to, season: SEASONS.includes(o.season) ? o.season : null, time: TIMES.includes(o.time) ? o.time : null, follow: o.follow === true, at: o.at };
}
/** Hand the visit across to the page about to open. @param {Storage} storage */
export function keepCrossing(storage, c) { try { storage.setItem(CROSSING_KEY, JSON.stringify({ ...c, at: c.at ?? Date.now() })); return true; } catch { return false; } }
/** Whether a crossing is waiting (it is not taken): the page's first script uses it to keep the curtain shut before anything is painted. @param {Storage} storage */
export function peekCrossing(storage, opts = {}) { try { return sanitizeCrossing(JSON.parse(storage.getItem(CROSSING_KEY) || "null"), opts); } catch { return null; } }
/** Take it, once: it is forgotten as it is read, whether or not it was usable. @param {Storage} storage */
export function takeCrossing(storage, opts = {}) {
  let raw = null;
  try { raw = storage.getItem(CROSSING_KEY); storage.removeItem(CROSSING_KEY); } catch {}
  try { return sanitizeCrossing(JSON.parse(raw || "null"), opts); } catch { return null; }
}

/**
 * The address of the temple's page: this one's own, with the places a link or a tool named taken out, and `level` naming
 * the temple (the prologue is the page's default and is not named). The language, tier, `?off=` and the hash stay.
 * @param {string} href @param {string} to @param {string} defaultLevel
 */
export function crossingURL(href, to, defaultLevel) {
  const u = new URL(href);
  for (const k of CROSSING_DROPS) u.searchParams.delete(k);
  u.searchParams.delete("level");
  if (to !== defaultLevel) u.searchParams.set("level", to);
  return u.href;
}
