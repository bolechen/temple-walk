// Incense in the halls that keep a Buddha (#146): which halls, what a place is called, and how what was set in each one's
// ash is kept between visits. Pure book-keeping with no DOM, so that it is unit-tested in Node; rites.js burns the sticks,
// game.js stores them.

/** The halls where a visitor's incense may be offered: the three that keep a Buddha (JINGSHAN.md). The great hall's offering earns the seal; the others earn none. */
export const INCENSE_HALLS = ["main", "yaoshi", "guanyin"];
/** The hall whose offering earns the 上香 seal and whose place the book's way-sign points to. */
export const SEALED_HALL = "main";
/** The place id of a hall's incense stand: the great hall's is `incense` (the seal's own id), the others `incense-<hall>`. */
export const incenseId = (/** @type {string} */ hall) => (hall === SEALED_HALL ? "incense" : `incense-${hall}`);
/** The hall an incense place id belongs to, or null if it is not one. */
export const incenseHall = (/** @type {string} */ id) => (id === "incense" ? SEALED_HALL : id.startsWith("incense-") && INCENSE_HALLS.includes(id.slice(8)) ? id.slice(8) : null);

/**
 * What a saved offering says: `{ hall: time the sticks were set }`. The first version of the store held one number, the
 * time the great hall's were set; that is read as the great hall's. Anything damaged is left out, never thrown.
 * @param {string | null | undefined} raw @returns {Record<string, number>}
 */
export function readIncense(raw) {
  const out = /** @type {Record<string, number>} */ ({});
  if (raw == null || raw === "") return out;
  let v; try { v = JSON.parse(raw); } catch { return out; }
  if (typeof v === "number") { if (Number.isFinite(v) && v > 0) out[SEALED_HALL] = v; return out; }
  if (v && typeof v === "object" && !Array.isArray(v)) for (const h of INCENSE_HALLS) { const at = v[h]; if (typeof at === "number" && Number.isFinite(at) && at > 0) out[h] = at; }
  return out;
}
/** The store's text after `hall`'s sticks were set at `at`, the other halls' kept as they were. */
export const writeIncense = (/** @type {string | null | undefined} */ raw, /** @type {string} */ hall, /** @type {number} */ at) => JSON.stringify({ ...readIncense(raw), [hall]: at });

/**
 * How far sticks set at `at` have burnt by `now`, in the seconds `burn` they last: k from 0 (whole) to 1 (cold stubs).
 * @param {number} at @param {number} now @param {number} burn
 */
export const burnt = (at, now, burn) => Math.min(1, Math.max(0, (now - at) / (burn * 1000)));
