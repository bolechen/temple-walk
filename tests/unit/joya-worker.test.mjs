// The year-end bell's count in the Worker (#341, worker/joya-core.js): what a report may carry, the window asked in UTC,
// the shards and their sum, each shard's bucket and the year's ceiling, and the SQL the Durable Object runs (on node:sqlite).
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { SHARDS, RING_LIMITS, parseRing, createRingCounter, ringSqliteStore, ringMemoryStore, respondJoya } from "../../worker/joya-core.js";

const night = Date.UTC(2026, 11, 31, 14, 30);   // 23:30 in Tokyo, 09:30 in New York
const shardsOf = (n, now, store = ringMemoryStore, limits) => { const all = Array.from({ length: n }, () => createRingCounter(store(), { now, limits })); let i = 0; return { all: () => all, pick: () => all[i++ % n] }; };
const post = (body, type = "application/json") => new Request("https://temple.example/api/joya", { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });
const get = (q = "") => new Request("https://temple.example/api/joya" + q);

test("a report is exactly { n, tz } within bounds", () => {
  assert.deepEqual(parseRing({ n: 3, tz: -540 }), { n: 3, tz: -540 });
  for (const b of [null, [], {}, { n: 0, tz: 0 }, { n: 7, tz: 0 }, { n: 1.5, tz: 0 }, { n: "1", tz: 0 }, { n: 1, tz: 900 }, { n: 1, tz: -841 }, { n: 1, tz: 0, who: "me" }, { n: 1 }]) assert.equal(parseRing(b), null, JSON.stringify(b));
});

test("POST counts in the window by the visitor's clock, refuses outside it, and answers the mountain's sum", async () => {
  const now = () => night, shards = shardsOf(SHARDS, now);
  let r = await respondJoya(post({ n: 2, tz: -540 }), { shards, now }), b = await r.json();
  assert.equal(r.status, 200); assert.deepEqual(b, { year: 2027, total: 2, rounds: 0, at: night });
  assert.equal(r.headers.get("cache-control"), "no-store");
  for (let i = 0; i < 60; i++) await respondJoya(post({ n: 2, tz: -540 }), { shards, now });
  b = await (await respondJoya(get("?year=2027"), { shards, now })).json();
  assert.deepEqual([b.total, b.rounds], [122, 1]);
  assert.equal(shards.all().filter((s) => s.read(2027) > 0).length, SHARDS, "the reports are spread over every shard");
  assert.equal((await respondJoya(post({ n: 1, tz: 300 }), { shards, now })).status, 403, "09:30 in New York is not the night");
  assert.equal((await respondJoya(post({ n: 1, tz: -540 }), { shards, now: () => Date.UTC(2026, 10, 20) })).status, 403, "nor is November anywhere");
  assert.equal((await respondJoya(post({ n: 9, tz: -540 }), { shards, now })).status, 400);
  assert.equal((await respondJoya(post("{", "application/json"), { shards, now })).status, 400);
  assert.equal((await respondJoya(post({ n: 1, tz: -540 }, "text/html"), { shards, now })).status, 415);
  assert.equal((await respondJoya(post({ n: 1, tz: -540 }, "text/plain;charset=UTF-8"), { shards, now })).status, 200, "a beacon is taken");
  assert.equal((await respondJoya(post("x".repeat(200)), { shards, now })).status, 413);
});

test("GET reads this night's year or last year's, cached for ten seconds, never a range", async () => {
  const now = () => night, shards = shardsOf(4, now);
  const r = await respondJoya(get(), { shards, now }); assert.equal(r.status, 200); assert.equal((await r.json()).year, 2027);
  assert.equal(r.headers.get("cache-control"), "public, max-age=10");
  assert.equal((await respondJoya(get("?year=2026"), { shards, now })).status, 200);
  for (const q of ["?year=2025", "?year=2028", "?year=x", "?year=2027.5"]) assert.equal((await respondJoya(get(q), { shards, now })).status, 400, q);
  assert.equal((await respondJoya(new Request("https://temple.example/api/joya", { method: "PUT" }), { shards, now })).status, 405);
  assert.equal((await respondJoya(new Request("https://temple.example/api/joyas"), { shards, now })).status, 404);
});

test("a shard's bucket drops a flood and refills; the year's ceiling holds", () => {
  let clock = night; const now = () => clock;
  const c = createRingCounter(ringMemoryStore(), { now, limits: { burst: 10, perSecond: 5, yearCap: 1e9 } });
  let ok = 0; for (let i = 0; i < 20; i++) if (c.add(2027, 1).ok) ok++;
  assert.equal(ok, 10); assert.deepEqual(c.add(2027, 1), { ok: false, why: "limited" });
  clock += 1000; assert.equal(c.add(2027, 5).ok, true); assert.equal(c.add(2027, 1).ok, false);
  const capped = createRingCounter(ringMemoryStore(), { now, limits: { burst: 100, perSecond: 0, yearCap: 4 } });
  assert.equal(capped.add(2027, 3).ok, true); assert.deepEqual(capped.add(2027, 2), { ok: false, why: "full" }); assert.equal(capped.read(2027), 3);
  assert.ok(RING_LIMITS.perSecond * SHARDS >= 1000 * 2, "the shards together take twice the worst night's strokes");
});

test("the SQL the Durable Object runs: one row a year, raised atomically, held at the ceiling", () => {
  const db = new DatabaseSync(":memory:"), sql = { exec: (q, ...a) => { const st = db.prepare(q), rows = /^\s*SELECT|RETURNING/i.test(q) ? st.all(...a) : (st.run(...a), []); return { toArray: () => rows }; } };   // as ctx.storage.sql runs a statement at once
  const store = ringSqliteStore(sql);
  assert.equal(store.get(2027), 0);
  assert.equal(store.bump(2027, 3, 10), 3); assert.equal(store.bump(2027, 6, 10), 9);
  assert.equal(store.bump(2027, 2, 10), null, "past the ceiling nothing is added"); assert.equal(store.get(2027), 9);
  assert.equal(store.bump(2028, 1, 10), 1); assert.equal(store.get(2027), 9);
  assert.deepEqual(db.prepare("SELECT * FROM joya ORDER BY year").all().map((r) => ({ ...r })), [{ year: 2027, n: 9 }, { year: 2028, n: 1 }], "a year and a count, nothing else");
});

