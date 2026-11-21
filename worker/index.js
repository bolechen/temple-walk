// The Worker behind 同修留痕 (#340). Static files never reach it: wrangler.*.jsonc sends only /api/* here
// (`assets.run_worker_first`), so the page itself is served, and billed, as before. The one Durable Object is the
// day's counter; its storage is SQLite, so its increments are single statements (trace-core.js `sqliteStore`).
// The Worker reads nothing of the request but its method, path, `day` and body (trace-core.js `respond`).
import { DurableObject } from "cloudflare:workers";
import { createCounter, respond, sqliteStore } from "./trace-core.js";
import { SHARDS, createRingCounter, ringSqliteStore, respondJoya } from "./joya-core.js";

export class TraceCounter extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.counter = createCounter(sqliteStore(ctx.storage.sql)); }
  add(place, kind) { return this.counter.add(place, kind); }
  read(day) { return this.counter.read(day); }
}

// 除夕撞钟 (#341): one of SHARDS objects holding a part of the year-end bell's count (joya-core.js says why there are many).
export class JoyaShard extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.counter = createRingCounter(ringSqliteStore(ctx.storage.sql)); }
  add(year, n) { return this.counter.add(year, n); }
  read(year) { return this.counter.read(year); }
}

// The year-end bell's route: a report goes to a shard picked at random; the mountain's count is the shards' sum, read
// through the edge's cache for 10 s, so a busy night asks the sixteen objects for it a few times a minute in each place.
async function joya(request, env, ctx, cache) {
  const shard = (i) => env.JOYA.get(env.JOYA.idFromName("joya:" + i));
  const all = () => Array.from({ length: SHARDS }, (_, i) => shard(i));
  const sum = async (year) => {
    const key = new Request(new URL(request.url).origin + "/api/joya/sum?year=" + year);
    const hit = cache && (await cache.match(key)); if (hit) return Number(await hit.text());
    const n = (await Promise.all(all().map((s) => s.read(year)))).reduce((a, b) => a + b, 0);
    if (cache) ctx.waitUntil(cache.put(key, new Response(String(n), { headers: { "cache-control": "public, max-age=10" } })));
    return n;
  };
  // JOYA_TEST_NOW (ms) sets the night's clock for tools/worker-smoke.mjs alone (`wrangler dev --var`); no wrangler config
  // defines it (tests/unit/joya-worker.test.mjs holds that), so the published Workers always ask the real time.
  const now = env.JOYA_TEST_NOW ? () => Number(env.JOYA_TEST_NOW) : Date.now;
  return respondJoya(request, { shards: { all, pick: () => shard(Math.floor(Math.random() * SHARDS)) }, sum, now });
}

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/api/joya") return joya(request, env, ctx, typeof caches !== "undefined" ? caches.default : null);
    // One object for the whole temple: a Worker's Durable Object namespace is its own, so the canary's counts and the
    // public site's never meet (they are different Workers).
    const counter = env.TRACES.get(env.TRACES.idFromName("temple"));
    const url = new URL(request.url), cache = typeof caches !== "undefined" ? caches.default : null;
    // Today's page is read from the edge's cache for 30 s, so a busy day asks the object for it twice a minute, not once a visit.
    const key = cache && request.method === "GET" && url.pathname === "/api/traces" ? new Request(url.origin + "/api/traces?day=" + (url.searchParams.get("day") ?? "today")) : null;
    if (key) { const hit = await cache.match(key); if (hit) return hit; }
    const res = await respond(request, counter);
    if (key && res.status === 200) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};
