// 除夕撞钟 (#341): the mountain's count of the year-end bell, kept beside 同修留痕 (#340, trace-core.js) in the same Worker.
// What is stored is `(year) -> n` in each of SHARDS objects, and nothing else: no address, header, cookie or agent is read.
// One object cannot take New Year's midnight (10,000 visitors reporting every 15 s is about 670 requests a second, and a
// Durable Object does some 500-1,000 simple requests a second), so a report goes to one of SHARDS objects picked at
// random (not by visitor: there is no visitor), and the count read is their sum, kept in the edge's cache for 10 s.
// Plain JavaScript with no Cloudflare import, so tests/unit/joya-worker.test.mjs runs all of it in Node; the window is
// asked of the same code the page asks (app/src/joya.js), so the page and the Worker cannot disagree on it.
import { JOYA, serverWindow, yearNear } from "../app/src/joya.js";

export const SHARDS = 16;
/** Each shard's bucket counts strokes, not requests: about 1,000 strokes a second for the whole mountain at the worst, so
 * some 60 a shard; it refills at 4x that and holds a minute's worth. A year's ceiling keeps a flood from a runaway number. */
export const RING_LIMITS = Object.freeze({ burst: 15_000, perSecond: 250, yearCap: 50_000_000 });

/** A report checked: exactly `{ n, tz }`, `n` a whole number from 1 to JOYA.batch, `tz` a whole offset some zone has.
 * @param {unknown} body */
export function parseRing(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 2 || !keys.includes("n") || !keys.includes("tz")) return null;
  const { n, tz } = /** @type {any} */ (body);
  if (!Number.isInteger(n) || n < 1 || n > JOYA.batch || !Number.isInteger(tz) || tz < JOYA.minTz || tz > JOYA.maxTz) return null;
  return { n, tz };
}

/** A shard's counter over a store `{ bump(year, n, cap) -> total | null, get(year) -> n }`, with its own bucket in memory.
 * @param {any} db */
export function createRingCounter(db, { now = Date.now, limits = RING_LIMITS } = {}) {
  let b = { n: limits.burst, at: now() };
  return {
    /** `n` more strokes in `year`: `{ ok, n }` (this shard's count), or `{ ok: false, why }`: `limited`, `full`. */
    add(year, n) {
      const t = now(); b.n = Math.min(limits.burst, b.n + Math.max(0, t - b.at) / 1000 * limits.perSecond); b.at = t;
      if (b.n < n) return { ok: false, why: "limited" };
      b.n -= n;
      const total = db.bump(year, n, limits.yearCap);
      return total == null ? { ok: false, why: "full" } : { ok: true, n: total };
    },
    read(year) { return db.get(year); },
  };
}

/** A shard's store on SQLite (a Durable Object's `ctx.storage.sql`): one row a year, raised in one statement. */
export function ringSqliteStore(sql) {
  sql.exec("CREATE TABLE IF NOT EXISTS joya (year INTEGER PRIMARY KEY, n INTEGER NOT NULL)");
  return {
    bump: (year, n, cap) => sql.exec("INSERT INTO joya (year, n) VALUES (?, ?) ON CONFLICT (year) DO UPDATE SET n = n + excluded.n WHERE n + excluded.n <= ? RETURNING n", year, n, cap).toArray()[0]?.n ?? null,
    get: (year) => sql.exec("SELECT n FROM joya WHERE year = ?", year).toArray()[0]?.n ?? 0,
  };
}

/** The same in memory, for the tests. */
export function ringMemoryStore() {
  const m = new Map();
  return { bump(year, n, cap) { const v = (m.get(year) || 0) + n; if (v > cap) return null; m.set(year, v); return v; }, get: (year) => m.get(year) || 0 };
}

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", ...extra } });
const reply = (year, total, now) => ({ year, total, rounds: Math.floor(total / JOYA.round), at: now });

/**
 * The route `/api/joya`. `shards` is `{ pick() -> counter, all() -> counter[] }` (Durable Object stubs, or createRingCounter
 * itself); `sum(year)` reads the mountain's count (the Worker puts a cache in front of it); `random` picks the shard.
 * Only the method, the path, `year` in the query and the body are looked at.
 * @param {Request} request
 * @param {{ shards: { pick(): any, all(): any[] }, sum?: (year: number) => Promise<number>, now?: () => number }} o
 */
export async function respondJoya(request, { shards, sum, now = Date.now }) {
  const total = sum || (async (year) => (await Promise.all(shards.all().map((s) => s.read(year)))).reduce((a, b) => a + b, 0));
  const url = new URL(request.url), t = now();
  if (url.pathname !== "/api/joya") return json({ error: "not found" }, 404);
  if (request.method === "GET") {
    const year = Number(url.searchParams.get("year") ?? yearNear(t)), near = yearNear(t);
    // This night's year, or last year's (a page left open across the year's turn of a long night): never a range.
    if (!Number.isInteger(year) || year < near - 1 || year > near) return json({ error: "year" }, 400);
    return json(reply(year, await total(year), t), 200, { "cache-control": "public, max-age=10" });
  }
  if (request.method !== "POST") return json({ error: "method" }, 405, { allow: "GET, POST" });
  const type = request.headers.get("content-type") || "";
  if (!/^application\/json\b|^text\/plain\b/i.test(type)) return json({ error: "type" }, 415);   // a beacon may send text/plain
  const text = await request.text(); if (text.length > 100) return json({ error: "size" }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: "json" }, 400); }
  const r = parseRing(body); if (!r) return json({ error: "n or tz" }, 400);
  const w = serverWindow(t, r.tz); if (!w.open) return json({ error: "not tonight" }, 403);
  const year = w.year;
  const got = await shards.pick().add(year, r.n);
  if (!got.ok) return json({ error: got.why === "limited" ? "slow down" : "full" }, 429, got.why === "limited" ? { "retry-after": "10" } : {});
  return json(reply(year, await total(year), t));
}
