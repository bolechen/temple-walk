// 同修留痕 (#340): who has been where today, as three things only: a day, a place and a count. Nothing in here ever sees
// an address, a header, a cookie or a user agent: `parseTrace` reads one small JSON body, `respond` reads a method and a
// path, and what is stored is `(day, place, kind) -> n`. This file is plain JavaScript with no Cloudflare import, so the
// unit tests (tests/unit/trace.test.mjs) run all of it in Node, the storage on node:sqlite with the very SQL the Durable
// Object runs; worker/index.js is only the glue (the Durable Object and the Worker's entry).

/** Every place a trace may name: the seven observances' ids (site.places) and the two side halls' incense stands (incense.js). tests/unit/trace.test.mjs holds this equal to the plan. */
export const PLACES = Object.freeze(["bell", "incense", "incense-yaoshi", "incense-guanyin", "tea", "sutra", "well", "lamp", "sit"]);
/** `rite`: it was done here; `seal`: the seal for it was earned here. */
export const KINDS = Object.freeze(["rite", "seal"]);

/**
 * What keeps a flood from running away without knowing who sends it. There is no per-visitor limit because there is no
 * visitor: the page reports each place once, and the server holds, for each place, a bucket that refills `perSecond` a
 * second up to `burst` (about ten times what a very good day asks, below), and a ceiling for one day. A flood therefore
 * costs the count some real visits' worth of honesty for a minute, never a runaway number. Per-address limiting, if wanted,
 * is a Cloudflare rate-limiting rule at the edge (docs/RELEASING.md), which keeps its own short-lived counters.
 */
export const LIMITS = Object.freeze({ burst: 120, perSecond: 12, dayCap: 250_000, keepDays: 90 });

const pad = (n) => String(n).padStart(2, "0");
/** The day a moment belongs to: UTC, `YYYY-MM-DD`. */
export const dayOf = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A request body checked: exactly `{ place, kind }`, both on the lists. Anything else is null. @param {unknown} body */
export function parseTrace(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 2 || !keys.includes("place") || !keys.includes("kind")) return null;
  const { place, kind } = /** @type {any} */ (body);
  if (typeof place !== "string" || typeof kind !== "string" || !PLACES.includes(place) || !KINDS.includes(kind)) return null;
  return { place, kind };
}

/** A token bucket for each key, in memory (and so gone with the object that holds it). @param {{burst: number, perSecond: number}} lim */
export function createLimiter(lim = LIMITS) {
  const buckets = new Map();
  return {
    /** Whether one more may pass for `key` at `ms`. */
    take(key, ms) {
      const b = buckets.get(key) || { n: lim.burst, at: ms };
      b.n = Math.min(lim.burst, b.n + Math.max(0, ms - b.at) / 1000 * lim.perSecond); b.at = ms;
      buckets.set(key, b);
      if (b.n < 1) return false;
      b.n -= 1; return true;
    },
  };
}

/**
 * The counter over a store `{ bump(day, place, kind, cap) -> n | null, rows(day) -> [{place, kind, n}], prune(oldestDay) }`.
 * `bump` is atomic and answers null at the cap. @param {any} db
 */
export function createCounter(db, { now = Date.now, limits = LIMITS } = {}) {
  const limiter = createLimiter(limits); let pruned = "";
  return {
    /** One more at a place today: `{ ok, n }`, or `{ ok: false, why }` where `why` is `limited` (the bucket) or `full` (the day's ceiling). */
    add(place, kind) {
      const t = now(), day = dayOf(t);
      if (!PLACES.includes(place) || !KINDS.includes(kind)) return { ok: false, why: "unknown" };
      if (!limiter.take(place + "/" + kind, t)) return { ok: false, why: "limited" };
      if (pruned !== day) { pruned = day; db.prune(dayOf(t - limits.keepDays * 864e5)); }
      const n = db.bump(day, place, kind, limits.dayCap);
      return n == null ? { ok: false, why: "full" } : { ok: true, n };
    },
    /** What a day holds: `{ day, traces: { place: { rite, seal } } }`, only where something is. */
    read(day) {
      const traces = {};
      for (const { place, kind, n } of db.rows(day)) if (PLACES.includes(place) && KINDS.includes(kind)) (traces[place] ||= { rite: 0, seal: 0 })[kind] = n;
      return { day, traces };
    },
  };
}

/** The counter's store on SQLite (a Durable Object's `ctx.storage.sql`, or any `{ exec(query, ...bindings) -> { toArray() } }`). */
export function sqliteStore(sql) {
  sql.exec("CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, place TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, place, kind))");
  return {
    // One statement, so it is atomic: a new row at 1, or one more if the row is under the cap; at the cap no row comes back.
    bump: (day, place, kind, cap) => sql.exec("INSERT INTO counts (day, place, kind, n) VALUES (?, ?, ?, 1) ON CONFLICT (day, place, kind) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n", day, place, kind, cap).toArray()[0]?.n ?? null,
    rows: (day) => sql.exec("SELECT place, kind, n FROM counts WHERE day = ?", day).toArray(),
    prune: (oldest) => { sql.exec("DELETE FROM counts WHERE day < ?", oldest); },
  };
}

/** The same in memory, for tests and for a Worker run with no binding. */
export function memoryStore() {
  const m = new Map();
  return {
    bump(day, place, kind, cap) { const k = `${day}|${place}|${kind}`, n = m.get(k) || 0; if (n >= cap) return null; m.set(k, n + 1); return n + 1; },
    rows(day) { return [...m].filter(([k]) => k.startsWith(day + "|")).map(([k, n]) => { const [, place, kind] = k.split("|"); return { place, kind, n }; }); },
    prune(oldest) { for (const k of [...m.keys()]) if (k.split("|")[0] < oldest) m.delete(k); },
  };
}

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", ...extra } });
const bad = (status, why, extra = {}) => json({ error: why }, status, extra);

/**
 * The two routes. `counter` is anything with `add(place, kind)` and `read(day)` (a Durable Object stub, whose methods
 * answer through RPC, or `createCounter(...)` itself); `now` is the clock. Only the method, the path, `day` in the query and
 * the body are looked at.
 * @param {Request} request @param {{ add(place: string, kind: string): any, read(day: string): any }} counter
 */
export async function respond(request, counter, { now = Date.now } = {}) {
  const url = new URL(request.url);
  if (url.pathname === "/api/trace") {
    if (request.method !== "POST") return bad(405, "method", { allow: "POST" });
    const type = request.headers.get("content-type") || "";
    if (!/^application\/json\b|^text\/plain\b/i.test(type)) return bad(415, "type");   // text/plain is what a beacon sends without a preflight
    const text = await request.text();
    if (text.length > 200) return bad(413, "size");
    let body; try { body = JSON.parse(text); } catch { return bad(400, "json"); }
    const t = parseTrace(body); if (!t) return bad(400, "place or kind");
    const r = await counter.add(t.place, t.kind);
    if (r.ok) return json({ day: dayOf(now()), place: t.place, kind: t.kind, n: r.n });
    return r.why === "limited" ? json({ error: "slow down" }, 429, { "retry-after": "10" }) : json({ error: "full" }, 429);
  }
  if (url.pathname === "/api/traces") {
    if (request.method !== "GET") return bad(405, "method");
    const asked = url.searchParams.get("day") ?? "today";
    const today = dayOf(now());
    // Today, or one of the days still kept: no listing of days and no range, so one call can only read one small page.
    if (asked !== "today" && !(DAY.test(asked) && asked <= today && asked >= dayOf(now() - LIMITS.keepDays * 864e5))) return bad(400, "day");
    const out = await counter.read(asked === "today" ? today : asked);
    return json(out, 200, { "cache-control": asked === "today" ? "public, max-age=30" : "public, max-age=3600" });
  }
  return bad(404, "not found");
}
