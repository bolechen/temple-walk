// Taking the visit to another place (#338): the public page and the testers' canary are two origins, and a browser
// keeps each one's storage to itself, so a pilgrimage begun on one is not found on the other, nor on another device.
// The whole save is written into a link, after the `#` so that no server is sent it and no log keeps it: the page
// that opens the link asks first, then writes it and takes it out of the address. Nothing goes through a server.
//
// What is carried is every key the game keeps for the visitor, each checked here as strictly as it can be: a value
// that is not what the game itself would have written refuses the whole save, so a damaged or tampered link never
// leaves half a pilgrimage behind. Keys a later version adds are ignored by an earlier one; a save written by a newer
// format (`v` above SAVE_VERSION) is refused, with the reason said. docs/t00/SAVE.md sets it out.
import { SEALS, SEAL, KEY as JOURNEY_KEY } from "./journey.js";
import { PLACE_KEY } from "./resume.js";
import { SETTINGS_KEY, sanitize as sanitizeSettings, DEFAULTS } from "./settings.js";
import { LANG_KEY, LANGS } from "./i18n.js";
import { INCENSE_HALLS } from "./incense.js";
import { SEASONS } from "./mood.js";

/** The format of the link's contents. Raised when a key's shape changes in a way an older page cannot read. */
export const SAVE_VERSION = 1;
/** Where the save rides in the address. */
export const HASH = "#save=";
export const VISIT_KEY = "yunjing.visit.v1", PROLOGUE_KEY = "yunjing.prologue.v1", INCENSE_KEY = "yunjing.incense.v1";
/** The two public addresses a save may be taken between (the canary is the testers', #308). */
export const SITES = { production: "https://temple.rushiwowen.co/", canary: "https://temple-walk-canary.bole-chen.workers.dev/" };

class Refused extends Error { constructor(reason, detail = "") { super(`${reason}${detail ? ": " + detail : ""}`); this.reason = reason; } }
const fail = (detail) => { throw new Refused("damaged", detail); };
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const pos = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const posOrNull = (v, what) => { if (v === null || v === undefined) return null; if (!pos(v)) fail(what); return v; };
const str = (v, max, what) => { if (typeof v !== "string" || v.length > max) fail(what); return v; };

// One checker for each key the game keeps: it is handed the stored value (parsed where the game stores JSON) and
// returns the text to write back, the same as the game would write it, or throws.
const KEYS = {
  // The book of seals (journey.js): which seals and when, the bell's strokes, the line drawn in the library, and when
  // the book was filled, the seasons opened, the close shown and its own seal stamped.
  journey: { key: JOURNEY_KEY, json: true, check(v) {
    if (!isObj(v) || v.v !== 1 || !isObj(v.seals)) fail("journey");
    const seals = {};
    for (const [id, at] of Object.entries(v.seals)) { if (!SEAL[id]) continue; if (!pos(at)) fail("journey.seals"); seals[id] = at; }
    const strikes = v.strikes ?? 0;
    if (!Number.isInteger(strikes) || strikes < 0 || strikes > SEAL.bell.need) fail("journey.strikes");
    let verse = null;
    if (v.verse != null) { if (!isObj(v.verse)) fail("journey.verse"); verse = { text: str(v.verse.text, 200, "journey.verse"), from: str(v.verse.from ?? "", 200, "journey.verse") }; }
    if (v.told != null && typeof v.told !== "boolean") fail("journey.told");
    if (v.closedSeason != null && !SEASONS.includes(v.closedSeason)) fail("journey.closedSeason");
    const out = { v: 1, born: posOrNull(v.born, "journey.born"), seals, strikes, verse, done: posOrNull(v.done, "journey.done"), opened: posOrNull(v.opened, "journey.opened"), told: v.told === true, closed: posOrNull(v.closed, "journey.closed"), closedSeason: v.closedSeason ?? null, stamped: posOrNull(v.stamped, "journey.stamped") };
    return JSON.stringify(out);
  } },
  // Where he stood when the visit was left (resume.js).
  place: { key: PLACE_KEY, json: true, check(v) {
    if (!isObj(v) || ![v.x, v.z].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 5000)) fail("place");
    if (v.yaw != null && !(typeof v.yaw === "number" && Number.isFinite(v.yaw))) fail("place.yaw");
    const label = v.label == null ? "" : str(v.label, 12, "place.label");
    if (v.up != null && !(typeof v.up === "string" && /^[a-z]{1,24}$/.test(v.up))) fail("place.up");
    return JSON.stringify({ x: v.x, z: v.z, yaw: v.yaw ?? 0, label, at: posOrNull(v.at, "place.at") ?? 0, ...(v.up ? { up: v.up } : {}) });
  } },
  // What the visitor set in the pause menu (settings.js): each field must be what settings.js would keep as it is.
  settings: { key: SETTINGS_KEY, json: true, check(v) {
    if (!isObj(v)) fail("settings");
    const clean = sanitizeSettings(v);
    // (`rev` says which defaults the save was written under: only a save that knows the thirds are on by default may keep them off)
    if (v.rev != null && !(Number.isInteger(v.rev) && v.rev >= 1 && v.rev <= 9)) fail("settings.rev");
    for (const k of Object.keys(DEFAULTS)) if (k in v && v[k] !== clean[k]) fail("settings." + k);
    return JSON.stringify({ ...Object.fromEntries(Object.keys(DEFAULTS).filter((k) => k in v).map((k) => [k, clean[k]])), ...(v.rev != null ? { rev: v.rev } : {}) });
  } },
  // The language the visitor chose (i18n.js).
  lang: { key: LANG_KEY, json: false, check(v) { if (!LANGS.includes(v)) fail("lang"); return v; } },
  // How far and how long the visit has walked (game.js).
  visit: { key: VISIT_KEY, json: true, check(v) {
    if (!isObj(v) || ![v.metres, v.seconds].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e9)) fail("visit");
    return JSON.stringify({ metres: Math.round(v.metres), seconds: Math.round(v.seconds) });
  } },
  // Whether the prologue's title has risen at the gate this pilgrimage (game.js).
  prologue: { key: PROLOGUE_KEY, json: false, check(v) { if (v !== "1") fail("prologue"); return v; } },
  // When incense was last set in each hall, so that it is found as far burnt (incense.js).
  incense: { key: INCENSE_KEY, json: true, check(v) {
    if (!isObj(v)) fail("incense");
    const out = {};
    for (const [h, at] of Object.entries(v)) { if (!INCENSE_HALLS.includes(h)) continue; if (!pos(at)) fail("incense." + h); out[h] = at; }
    return JSON.stringify(out);
  } },
};
/** The keys carried, by their short name in the link and their name in storage. */
export const SAVE_KEYS = Object.fromEntries(Object.entries(KEYS).map(([n, d]) => [n, d.key]));

/** The save as it lies in storage, gathered under the short names: only keys that are there, each as the game wrote it.
 *  A key that would not pass its own check is left out rather than carried. @param {Storage} storage */
export function gather(storage) {
  const keys = {};
  for (const [name, d] of Object.entries(KEYS)) {
    let raw = null; try { raw = storage.getItem(d.key); } catch {}
    if (raw == null) continue;
    try { const v = d.json ? JSON.parse(raw) : raw; d.check(v); keys[name] = v; } catch {}
  }
  return { v: SAVE_VERSION, game: "yunjing", keys };
}

/** Check a save read from a link, whole: what to write for each known key, or a refusal (`newer`, `damaged`, `empty`). */
export function check(save) {
  if (!isObj(save) || save.game !== "yunjing" || !Number.isInteger(save.v) || save.v < 1) throw new Refused("damaged", "envelope");
  if (save.v > SAVE_VERSION) throw new Refused("newer", `v${save.v}`);
  if (!isObj(save.keys)) throw new Refused("damaged", "keys");
  const out = {};
  for (const [name, d] of Object.entries(KEYS)) if (name in save.keys) out[d.key] = d.check(save.keys[name]);   // keys this version does not know are ignored
  if (!(JOURNEY_KEY in out) && !(PLACE_KEY in out)) throw new Refused("empty");
  return out;
}

/** Write a checked save over what is kept, wholly: every carried key the save does not hold is cleared, so nothing of
 *  the pilgrimage that was here is left mixed into the one that came. @param {Storage} storage */
export function apply(storage, writes) {
  for (const k of Object.values(SAVE_KEYS)) { if (!(k in writes)) storage.removeItem(k); }
  for (const [k, v] of Object.entries(writes)) storage.setItem(k, v);
}

/** What the page says before it writes: how many seals, and where he was. */
export function summary(writes) {
  let seals = 0, label = "";
  try { const j = JSON.parse(writes[JOURNEY_KEY] || "null"); if (j) seals = SEALS.filter((s) => j.seals[s.id] > 0).length; } catch {}
  try { const p = JSON.parse(writes[PLACE_KEY] || "null"); if (p) label = p.label || ""; } catch {}
  return { seals, of: SEALS.length, label };
}

// ---- The link: JSON, deflated, in base64url ----
const b64url = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64url = (text) => { if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Refused("damaged", "letters"); const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
async function pipe(bytes, stream) { const out = new Response(new Blob([bytes]).stream().pipeThrough(stream)); return new Uint8Array(await out.arrayBuffer()); }
/** The save written for a link. */
export async function encode(save) { return b64url(await pipe(new TextEncoder().encode(JSON.stringify(save)), new CompressionStream("deflate-raw"))); }
/** The save read back from a link's text (what follows `#save=`), not yet checked. A cut or garbled link is refused. */
export async function decode(text) {
  if (!text || text.length > 20000) throw new Refused("damaged", "length");
  let json;
  try { json = new TextDecoder().decode(await pipe(unb64url(text), new DecompressionStream("deflate-raw"))); } catch (e) { if (e instanceof Refused) throw e; throw new Refused("damaged", "inflate"); }
  try { return JSON.parse(json); } catch { throw new Refused("damaged", "json"); }
}
/** The whole link for a site (its base address). */
export async function linkFor(storage, base) { return base.replace(/#.*$/, "") + HASH + (await encode(gather(storage))); }
/** The save's text in an address's hash, or null. */
export const saveIn = (hash) => (typeof hash === "string" && hash.startsWith(HASH) ? hash.slice(HASH.length) : null);
export { Refused };
