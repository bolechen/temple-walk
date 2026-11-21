// The Worker behind 同修留痕 (#340). Static files never reach it: wrangler.*.jsonc sends only /api/* here
// (`assets.run_worker_first`), so the page itself is served, and billed, as before. The one Durable Object is the
// day's counter; its storage is SQLite, so its increments are single statements (trace-core.js `sqliteStore`).
// The Worker reads nothing of the request but its method, path, `day` and body (trace-core.js `respond`).
import { DurableObject } from "cloudflare:workers";
import { createCounter, respond, sqliteStore } from "./trace-core.js";

export class TraceCounter extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.counter = createCounter(sqliteStore(ctx.storage.sql)); }
  add(place, kind) { return this.counter.add(place, kind); }
  read(day) { return this.counter.read(day); }
}

export default {
  async fetch(request, env, ctx) {
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
