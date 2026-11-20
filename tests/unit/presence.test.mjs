// 同修留痕 (#340), the page's half: who takes part, what is said and in which language, reporting once a page, and
// silence when anything fails; and the stubs in the censer, with their ceiling and their triangles.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { presenceOn, approx, lineFor, createPresence } = await import("../../app/src/presence.js");
const { traceStubCount, traceStubsGeometry, TRACE_STUBS } = await import("../../app/src/censer.js");
const { PLACES } = await import("../../worker/trace-core.js");
const ok = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test("who takes part: the public page and the canary; a preview only when asked at the workbench; never a storefront build; ?presence=0 always leaves it out", () => {
  assert.equal(presenceOn("", "production", true), true); assert.equal(presenceOn("", "canary", true), true);
  assert.equal(presenceOn("", "preview", true), false, "a pull request's preview has no Worker and writes nothing");
  assert.equal(presenceOn("?presence=1", "preview", true), true, "the tests, with a stub of the API");
  assert.equal(presenceOn("?presence=0", "production", true), false);
  for (const d of ["production", "canary", "preview"]) assert.equal(presenceOn("?presence=1", d, false), false, `a storefront build (${d})`);
});

test("a count is whole to 999 and then about, in each language's own units", () => {
  assert.equal(approx(7, "zh"), "7"); assert.equal(approx(999, "en"), "999");
  assert.equal(approx(1234, "en"), "about 1.2K"); assert.equal(approx(15399, "zh"), "约1.5万"); assert.equal(approx(15399, "ja"), "約1.5万"); assert.equal(approx(15399, "ko"), "약 1.5만");
});

test("each place's line is said in all four languages, with the number, and not at all where no one has been", () => {
  for (const place of PLACES) {
    const seen = new Set();
    for (const lang of ["zh", "ja", "en", "ko"]) { const s = lineFor(place, 12, lang); assert.ok(s && s.includes("12") && !s.includes("{n}"), `${place} ${lang}: ${s}`); seen.add(s); }
    assert.equal(seen.size, 4, `${place}: a language fell back to another's words`);
    assert.equal(lineFor(place, 0, "zh"), null); assert.equal(lineFor(place, NaN, "zh"), null);
  }
  assert.equal(lineFor("bell", 3, "zh"), "当日已有3人在此敲钟"); assert.equal(lineFor("nowhere", 3, "zh"), null);
});

test("it reads the day once, reports each place once a page and answers with the new count, and a page that is off never asks", async () => {
  const calls = []; let n = 4;
  const f = async (url, init) => { calls.push([init.method, url, init.body]); return url.startsWith("/api/traces") ? ok({ day: "2026-11-20", traces: { bell: { rite: 4, seal: 1 } } }) : ok({ day: "2026-11-20", place: "bell", kind: "rite", n: ++n }); };
  const p = createPresence({ on: true, doFetch: f });
  assert.equal(await p.load(), true); assert.equal(p.count("bell"), 4); assert.equal(p.line("bell"), "当日已有4人在此敲钟"); assert.equal(p.line("tea"), null);
  await p.load(); assert.equal(calls.filter((c) => c[0] === "GET").length, 1, "read again within the ttl: no second request");
  assert.equal(await p.report("bell", "rite"), true); assert.equal(await p.report("bell", "rite"), false, "once a page"); assert.equal(await p.report("bell", "rite"), false);
  assert.equal(p.count("bell"), 5); assert.deepEqual(calls.filter((c) => c[0] === "POST").map((c) => JSON.parse(c[2])), [{ place: "bell", kind: "rite" }]);
  assert.equal(await p.report("bell", "seal"), true, "a seal is its own report");
  const off = createPresence({ on: false, doFetch: async () => { throw new Error("asked"); } });
  assert.equal(await off.load(), false); assert.equal(await off.report("bell"), false); assert.equal(off.line("bell"), null);
  const quiet = createPresence({ on: true, quiet: true, doFetch: f }); calls.length = 0;
  assert.equal(await quiet.load(), true); assert.equal(await quiet.report("bell"), false, "asked not to be counted: read, never sent"); assert.equal(calls.filter((c) => c[0] === "POST").length, 0);
});

test("when anything fails it is silent: a network error, 404, 429, 500, a page that is not JSON, nonsense in the JSON, a request that never answers", async () => {
  const cases = { throws: async () => { throw new TypeError("Failed to fetch"); }, 404: async () => ok({}, 404), 429: async () => ok({ error: "slow down" }, 429), 500: async () => ok({}, 500), html: async () => ({ ok: true, json: async () => { throw new SyntaxError("<"); } }), junk: async () => ok({ traces: "no" }), junk2: async () => ok({ day: 1, traces: { bell: { rite: "x", seal: null } } }), never: (url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted")))) };
  for (const [name, f] of Object.entries(cases)) {
    const p = createPresence({ on: true, doFetch: f, timeout: 20 });
    assert.equal(await p.load(), name === "junk2", name + (name === "junk2" ? " (a well-formed answer with nothing usable in it: read, empty)" : "")); assert.equal(await p.report("bell"), false, name);
    assert.equal(p.line("bell"), null, name); assert.equal(p.count("bell"), 0, name);
  }
});

test("a read that fails is not kept as a read: the next ask tries again", async () => {
  let up = false, calls = 0; const f = async () => { calls++; return up ? ok({ day: "d", traces: { tea: { rite: 2, seal: 0 } } }) : ok({}, 503); };
  const p = createPresence({ on: true, doFetch: f }); assert.equal(await p.load(), false); up = true; assert.equal(await p.load(), true); assert.equal(p.count("tea"), 2); assert.equal(calls, 2);
});

test("the censer's stubs: none for none, a few for the first, never over the ceiling; the same ones stay put as more come; the triangles are 12 each", () => {
  assert.equal(traceStubCount(0), 0); assert.equal(traceStubCount(NaN), 0); assert.ok(traceStubCount(1) >= 1);
  let last = 0; for (const n of [1, 2, 5, 10, 50, 100, 1000, 1e4, 1e5, 1e7]) { const k = traceStubCount(n); assert.ok(k >= last && k <= TRACE_STUBS, `${n} -> ${k}`); last = k; }
  assert.equal(traceStubCount(1e5), TRACE_STUBS, "100 000 a day reaches the ceiling and no more");
  assert.equal(traceStubsGeometry(0), null);
  const tris = (k) => { const g = traceStubsGeometry(k); return (g.index ? g.index.count : g.attributes.position.count) / 3; };
  assert.equal(tris(1), 12); assert.equal(tris(TRACE_STUBS), 12 * TRACE_STUBS); assert.equal(tris(TRACE_STUBS + 50), 12 * TRACE_STUBS, "asked for more, it still stops");
  const a = traceStubsGeometry(10).attributes.position.array, b = traceStubsGeometry(30).attributes.position.array;
  for (let i = 0; i < a.length; i++) assert.equal(a[i], b[i], "the first stubs did not move when more were added");
  const g = traceStubsGeometry(TRACE_STUBS); g.computeBoundingSphere(); assert.ok(g.boundingSphere.radius < 0.36, "all of them within the ash");
});
