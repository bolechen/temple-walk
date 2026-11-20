// 同修留痕 (#340): that others have been here today, said quietly. The page reports each place it has done something at
// once per page, and reads back what the day holds; nothing here knows who anyone is, and whatever goes wrong (offline,
// a Worker that is not there, a refusal, a slow answer) is swallowed whole: no line, no error, no retry storm.
// The server is worker/ (docs/RELEASING.md); what a visitor is told is docs/t00/SOURCES.md's 同修留痕 row.
import { t, lang } from "./i18n.js";
import { WEB } from "./channel.js";
import { DEPLOY } from "./deploy.js";

/**
 * Whether this page takes part. The public page and the canary do (each has its own Worker and its own counts); a pull
 * request's preview never does, because it has no Worker to ask; the tests and a person at the workbench may ask for it
 * on a preview build with `?presence=1`, beside a stub of the API. The storefront builds, which are not served from a Worker
 * of ours, never do. `?presence=0` leaves it out anywhere.
 * @param {string} search @param {string} deploy @param {boolean} web
 */
export function presenceOn(search = globalThis.location?.search || "", deploy = DEPLOY, web = WEB) {
  const q = new URLSearchParams(search).get("presence");
  if (!web || q === "0") return false;
  return deploy === "production" || deploy === "canary" || q === "1";
}

/** A count for a line: whole up to 999, then to the hundred below and in the language's own units (1.5万, 1.2K), marked as about. @param {number} n @param {string} to */
export function approx(n, to = lang) {
  if (n < 1000) return String(n);
  return t("约{n}", { n: new Intl.NumberFormat(to, { notation: "compact", maximumFractionDigits: 1 }).format(Math.floor(n / 100) * 100) }, to);
}

/** The line for a place, or null: nothing is said where no one has been yet. @param {string} place @param {number} n @param {string} to */
export function lineFor(place, n, to = lang) {
  if (!(n >= 1)) return null;
  const v = { n: approx(n, to) };
  switch (place) {
    case "bell": return t("当日已有{n}人在此敲钟", v, to);
    case "incense": case "incense-yaoshi": case "incense-guanyin": return t("当日已有{n}人在此上香", v, to);
    case "tea": return t("当日已有{n}人在此吃茶", v, to);
    case "sutra": return t("当日已有{n}人在此请了一句", v, to);
    case "well": return t("当日已有{n}人在此观水", v, to);
    case "lamp": return t("当日已有{n}人在此燃灯", v, to);
    case "sit": return t("当日已有{n}人在此静坐", v, to);
    default: return null;
  }
}

/**
 * @param {{ on?: boolean, base?: string, doFetch?: typeof fetch, quiet?: boolean, ttl?: number, now?: () => number, timeout?: number }} [o]
 * `quiet`: the visitor has asked not to be counted (Do Not Track, Global Privacy Control): the day is still read, nothing is sent.
 */
export function createPresence({ on = false, base = "", doFetch = globalThis.fetch?.bind(globalThis), quiet = false, ttl = 60000, now = Date.now, timeout = 6000 } = {}) {
  /** @type {Record<string, {rite: number, seal: number}>} */ let traces = {};
  /** @type {string | null} */ let day = null;
  /** @type {Promise<boolean> | null} */ let loading = null;
  let at = -Infinity, sent = 0, failed = 0, read = 0;
  const reported = new Set();
  const live = () => !!(on && doFetch);
  /** @param {string} path @param {RequestInit} init */
  async function call(path, init) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null, timer = ctl ? setTimeout(() => ctl.abort(), timeout) : 0;
    try { const r = await /** @type {typeof fetch} */ (doFetch)(base + path, { ...init, signal: ctl?.signal, credentials: "omit", cache: "no-store" }); if (!r.ok) return null; return await r.json(); }
    catch { return null; } finally { clearTimeout(timer); }
  }
  /** Reads the day's counts (at most once a `ttl`, unless forced). Resolves true if there are fresh counts, false if not; never rejects. */
  function load(force = false) {
    if (!live()) return Promise.resolve(false);
    if (loading) return loading;
    if (!force && now() - at < ttl) return Promise.resolve(true);
    return (loading = (async () => {
      const r = await call("/api/traces?day=today", { method: "GET" });
      loading = null;
      if (!r || typeof r !== "object" || !r.traces || typeof r.traces !== "object") { failed++; return false; }
      const next = /** @type {typeof traces} */ ({});
      for (const [place, v] of Object.entries(r.traces)) { const o = /** @type {any} */ (v); if (o && Number.isFinite(o.rite) && Number.isFinite(o.seal)) next[place] = { rite: Math.max(0, o.rite | 0), seal: Math.max(0, o.seal | 0) }; }
      traces = next; day = typeof r.day === "string" ? r.day : null; at = now(); read++; return true;
    })().catch(() => { loading = null; failed++; return false; }));
  }
  /** What the day holds for a place, as last read (0 where unknown). @param {string} place @param {"rite" | "seal"} [kind] */
  const count = (place, kind = "rite") => traces[place]?.[kind] || 0;
  /** Reported once for each place and kind in a page; the counts it answers with replace the ones read. Resolves true if counted; never rejects. @param {string} place @param {"rite" | "seal"} [kind] */
  async function report(place, kind = "rite") {
    const k = place + "/" + kind;
    if (!live() || quiet || reported.has(k)) return false;
    reported.add(k);
    const r = await call("/api/trace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ place, kind }), keepalive: true });
    if (!r || !Number.isFinite(r.n)) { failed++; return false; }
    sent++; (traces[place] ||= { rite: 0, seal: 0 })[kind] = Math.max(count(place, kind), r.n | 0); return true;
  }
  /** The line for a place now, or null. @param {string} place */
  const line = (place) => (live() ? lineFor(place, count(place)) : null);
  return { on: live(), load, count, report, line, state: () => ({ on: live(), quiet, day, traces, sent, failed, read, reported: [...reported] }) };
}

/**
 * Reads the day, and again after a pause if the first read did not come back: the page is at its busiest when the game is made, and on a slow
 * machine the answer can arrive after `call`'s own limit (a read once came back at 6.9 s against 6 s, #367), which left the censer without its
 * stubs for the whole visit. `then` is told each time a read succeeds; it stops after the first success or after `tries` reads. The limit itself
 * is not lengthened: a page that is slow to answer is asked again, not waited for.
 * @param {{ load: (force?: boolean) => Promise<boolean> }} presence
 * @param {() => void} then
 * @param {{ tries?: number, gap?: number, later?: (fn: () => void, ms: number) => unknown }} [o]
 */
export function readDay(presence, then, { tries = 3, gap = 8000, later = (fn, ms) => setTimeout(fn, ms) } = {}) {
  return presence.load(true).then((ok) => {
    if (ok) { then(); return true; }
    if (tries > 1) later(() => { readDay(presence, then, { tries: tries - 1, gap, later }); }, gap);
    return false;
  });
}
