// 同修留痕 (#340), the server's half: the whitelist, the day's bucket, the limit, the ceiling, and what is (not) stored.
// The storage is the very SQL the Durable Object runs, on node:sqlite; the routes are worker/trace-core.js `respond`.
import test from "node:test"; import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import "./dom-stub.mjs";
import * as THREE from "three";
import { PLACES, KINDS, LIMITS, dayOf, parseTrace, createLimiter, createCounter, sqliteStore, memoryStore, respond } from "../../worker/trace-core.js";
const { buildSite } = await import("../../app/src/site.js");
const { INCENSE_HALLS, incenseId } = await import("../../app/src/incense.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });

const sqlite = () => { const db = new DatabaseSync(":memory:"); return { db, sql: { exec: (q, ...b) => { const st = db.prepare(q); return /^\s*(select|insert[\s\S]*returning)/i.test(q) ? { toArray: () => st.all(...b) } : (st.run(...b), { toArray: () => [] }); } } }; };
const clock = (start = Date.UTC(2026, 10, 20, 12)) => { const c = { t: start, now: () => c.t }; return c; };
const post = (body, type = "application/json") => new Request("https://x/api/trace", { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });
const get = (q = "") => new Request("https://x/api/traces" + q);

test("the places a trace may name are the plan's observances and the side halls' incense stands, and nothing else", () => {
  const site = buildSite(M);
  const want = [...Object.keys(site.places), ...INCENSE_HALLS.map(incenseId)].filter((v, i, a) => a.indexOf(v) === i).sort();
  assert.deepEqual([...PLACES].sort(), want, "worker/trace-core.js PLACES and the plan have parted");
  assert.deepEqual([...KINDS], ["rite", "seal"]);
});

test("a body is exactly { place, kind } from the lists: unknown places and kinds, extra fields and wrong shapes are refused", () => {
  assert.deepEqual(parseTrace({ place: "bell", kind: "rite" }), { place: "bell", kind: "rite" });
  for (const bad of [null, [], "bell", 7, {}, { place: "bell" }, { kind: "rite" }, { place: "bell", kind: "rite", ip: "1.2.3.4" }, { place: "nowhere", kind: "rite" }, { place: "bell", kind: "gift" }, { place: ["bell"], kind: "rite" }, { place: "__proto__", kind: "rite" }, { place: "bell", kind: "constructor" }, { place: "Bell", kind: "rite" }]) assert.equal(parseTrace(bad), null, JSON.stringify(bad));
});

test("POST /api/trace: 200 with the new count; unknown place or kind 400; bad JSON 400; wrong method 405; wrong type 415; too large 413", async () => {
  const c = clock(), counter = createCounter(memoryStore(), { now: c.now });
  let r = await respond(post({ place: "bell", kind: "rite" }), counter, { now: c.now });
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { day: "2026-11-20", place: "bell", kind: "rite", n: 1 });
  assert.equal((await (await respond(post({ place: "bell", kind: "rite" }), counter, { now: c.now })).json()).n, 2);
  for (const [req, status] of [[post({ place: "nowhere", kind: "rite" }), 400], [post({ place: "bell", kind: "x" }), 400], [post("{nope"), 400], [post("[]"), 400], [new Request("https://x/api/trace"), 405], [post({ place: "bell", kind: "rite" }, "text/html"), 415], [post(JSON.stringify({ place: "bell", kind: "rite", pad: "x".repeat(300) })), 413]]) assert.equal((await respond(req, counter, { now: c.now })).status, status);
  assert.equal((await respond(post(JSON.stringify({ place: "tea", kind: "seal" }), "text/plain;charset=UTF-8"), counter, { now: c.now })).status, 200, "a beacon's text/plain is taken");
  assert.equal((await respond(new Request("https://x/api/other"), counter, { now: c.now })).status, 404);
  assert.equal((await respond(new Request("https://x/api/traces", { method: "POST" }), counter, { now: c.now })).status, 405);
});

test("GET /api/traces?day=today returns each place's day count; days are separate buckets; an old or malformed day is refused", async () => {
  const c = clock(), counter = createCounter(memoryStore(), { now: c.now });
  const add = async (p, k = "rite") => respond(post({ place: p, kind: k }), counter, { now: c.now });
  await add("bell"); await add("bell"); await add("bell", "seal"); await add("incense");
  let r = await (await respond(get("?day=today"), counter, { now: c.now })).json();
  assert.deepEqual(r, { day: "2026-11-20", traces: { bell: { rite: 2, seal: 1 }, incense: { rite: 1, seal: 0 } } });
  assert.deepEqual(await (await respond(get(), counter, { now: c.now })).json(), r, "today is the default");
  c.t += 864e5;   // the next day, UTC
  r = await (await respond(get("?day=today"), counter, { now: c.now })).json(); assert.deepEqual(r, { day: "2026-11-21", traces: {} });
  await add("bell"); assert.equal((await (await respond(get("?day=2026-11-20"), counter, { now: c.now })).json()).traces.bell.rite, 2, "yesterday is kept apart");
  assert.equal((await (await respond(get("?day=2026-11-21"), counter, { now: c.now })).json()).traces.bell.rite, 1);
  for (const q of ["?day=2026-11-22", "?day=2020-01-01", "?day=yesterday", "?day=2026-1-2", "?day=%27%3B--"]) assert.equal((await respond(get(q), counter, { now: c.now })).status, 400, q);
  assert.match((await respond(get("?day=today"), counter, { now: c.now })).headers.get("cache-control"), /max-age=30/);
});

test("the real SQL: increments are atomic upserts, the ceiling stops a row at its cap, old days are pruned, and only day, place, kind, n are stored", () => {
  const { db, sql } = sqlite(), store = sqliteStore(sql);
  assert.equal(store.bump("2026-11-20", "bell", "rite", 3), 1); assert.equal(store.bump("2026-11-20", "bell", "rite", 3), 2); assert.equal(store.bump("2026-11-20", "bell", "rite", 3), 3);
  assert.equal(store.bump("2026-11-20", "bell", "rite", 3), null, "at the cap nothing more is added");
  assert.equal(store.bump("2026-11-20", "bell", "seal", 3), 1, "another kind has its own row");
  assert.equal(store.bump("2026-11-19", "bell", "rite", 3), 1, "another day has its own row");
  assert.deepEqual(store.rows("2026-11-20").map((r) => `${r.place}/${r.kind}=${r.n}`).sort(), ["bell/rite=3", "bell/seal=1"]);
  store.prune("2026-11-20"); assert.deepEqual(store.rows("2026-11-19"), []); assert.equal(store.rows("2026-11-20").length, 2);
  const cols = db.prepare("PRAGMA table_info(counts)").all().map((c) => c.name); assert.deepEqual(cols, ["day", "place", "kind", "n"], "nothing but day × place × kind × count is a column");
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name), ["counts"]);
});

test("the limit: a bucket for each place and kind refills over time; a flood is dropped (429) and costs nothing but the dropped; the day has a ceiling", async () => {
  const c = clock(), lim = { burst: 5, perSecond: 1, dayCap: 8, keepDays: 90 }, counter = createCounter(memoryStore(), { now: c.now, limits: lim });
  const outs = []; for (let i = 0; i < 12; i++) outs.push((await respond(post({ place: "bell", kind: "rite" }), counter, { now: c.now })).status);
  assert.deepEqual(outs, [200, 200, 200, 200, 200, 429, 429, 429, 429, 429, 429, 429], "five get through at once, the rest are dropped");
  assert.equal((await respond(post({ place: "tea", kind: "rite" }), counter, { now: c.now })).status, 200, "another place has its own bucket");
  c.t += 3000; assert.equal((await respond(post({ place: "bell", kind: "rite" }), counter, { now: c.now })).status, 200, "three seconds refill three");
  const day = await (await respond(get(), counter, { now: c.now })).json(); assert.equal(day.traces.bell.rite, 6, "only what passed was counted");
  // the ceiling, with the bucket out of the way
  const c2 = clock(), big = createCounter(memoryStore(), { now: c2.now, limits: { burst: 1e6, perSecond: 1e6, dayCap: 8, keepDays: 90 } });
  const fin = []; for (let i = 0; i < 12; i++) fin.push(big.add("sit", "rite").ok);
  assert.deepEqual(fin, [...Array(8).fill(true), ...Array(4).fill(false)]); assert.equal(big.read(dayOf(c2.now())).traces.sit.rite, 8, "a flood cannot take a count past the ceiling");
  assert.equal(big.add("sit", "rite").why, "full");
  c2.t += 864e5; assert.equal(big.add("sit", "rite").ok, true, "the next day starts again");
});

test("the limiter never sees a request: it is keyed by place and kind alone, and with the shipped numbers one place passes the burst, then 12 a second", () => {
  const l = createLimiter(LIMITS); let ok = 0; for (let i = 0; i < 1000; i++) if (l.take("bell/rite", 0)) ok++; assert.equal(ok, LIMITS.burst);
  ok = 0; for (let i = 0; i < 100; i++) if (l.take("bell/rite", 1000)) ok++; assert.equal(ok, LIMITS.perSecond, "a second later: its refill");
  assert.ok(LIMITS.perSecond * 3600 * 24 > LIMITS.dayCap, "the ceiling, not the bucket, is what stops a day");
});

test("the Worker's source reads no address, header, cookie or user agent, and stores nothing but the count", () => {
  for (const f of ["worker/trace-core.js", "worker/index.js"]) {
    const src = fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8").replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(src, /cf-connecting-ip|x-forwarded-for|user-agent|request\.cf\b|\.cookies?\b|get\(["']cookie|get\(["']origin|get\(["']referer/i, f);
  }
  const core = fs.readFileSync(new URL("../../worker/trace-core.js", import.meta.url), "utf8");
  assert.deepEqual([...core.matchAll(/request\.headers\.get\(["']([^"']+)["']\)/g)].map((m) => m[1]), ["content-type"], "the only header read is the body's type");
});

test("the two Workers each own the API and its Durable Object; a pull request's preview has neither, so it writes nothing", () => {
  const cfg = (f) => JSON.parse(fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  const prod = cfg("wrangler.production.jsonc"), canary = cfg("wrangler.canary.jsonc"), preview = cfg("wrangler.jsonc");
  assert.notEqual(prod.name, canary.name, "different Workers: a Durable Object namespace belongs to its Worker, so their counts never meet");
  for (const c of [prod, canary]) {
    assert.equal(c.main, "worker/index.js"); assert.deepEqual(c.assets.run_worker_first, ["/api/*"], "only the API reaches the script; static files are served as before");
    assert.deepEqual(c.durable_objects.bindings, [{ name: "TRACES", class_name: "TraceCounter" }, { name: "JOYA", class_name: "JoyaShard" }]); assert.deepEqual(c.migrations, [{ tag: "v1", new_sqlite_classes: ["TraceCounter"] }, { tag: "v2", new_sqlite_classes: ["JoyaShard"] }], "the year-end bell's shards (#341) are a second migration: v1 is never edited once deployed");
    assert.ok(fs.existsSync(new URL(`../../${c.main}`, import.meta.url)));
  }
  assert.ok(!preview.main && !preview.durable_objects && !preview.migrations, "the preview Worker has no script and no counter");
  assert.match(fs.readFileSync(new URL("../../worker/index.js", import.meta.url), "utf8"), /export class TraceCounter\b/);
  assert.match(fs.readFileSync(new URL("../../worker/index.js", import.meta.url), "utf8"), /export class JoyaShard\b/);
});
