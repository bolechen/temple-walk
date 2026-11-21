// 行脚图, phase one (#449): the record of temples whose close has been played, when the entrances to the map appear, which
// temples on the map may be gone to, and what is handed across the reload that a crossing makes (src/pilgrimage.js).
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PILGRIMAGE_KEY, sanitizeRecord, createPilgrimage, entriesOpen, mapEntries, createHold, HOLD_MS,
  CROSSING_KEY, CROSSING_FRESH, sanitizeCrossing, keepCrossing, peekCrossing, takeCrossing, crossingURL, CROSSING_DROPS,
} from "../../app/src/pilgrimage.js";
import { createJourney, KEY as JOURNEY_KEY } from "../../app/src/journey.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NOW = 1_800_000_000_000;
const KNOWN = ["t00", "t05"];
const mem = (init = null) => { let v = init; return { get: () => v, set: (x) => { v = x; }, raw: () => v }; };
const session = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

// ---- the record ----
test("the record is kept under a key of its own, apart from every temple's book", () => {
  assert.equal(PILGRIMAGE_KEY, "yunjing.pilgrimage.v1");
  assert.notEqual(PILGRIMAGE_KEY, JOURNEY_KEY);
});

test("a record reads back as written: a time and a season for each temple", () => {
  const raw = { t00: { closed: NOW - 1000, season: "autumn" }, t05: { closed: NOW - 5, season: "winter" } };
  assert.deepEqual(sanitizeRecord(raw, { now: NOW, known: KNOWN }), raw);
});

test("bad data is cleaned, not believed: damaged entries go, damaged fields fall back", () => {
  for (const bad of [null, undefined, 7, "x", true, [], [1, 2], () => {}]) assert.deepEqual(sanitizeRecord(bad, { now: NOW, known: KNOWN }), {}, String(bad));
  const r = sanitizeRecord({
    t00: { closed: NOW - 10, season: "monsoon" },   // a season that does not exist: the entry stays, the season is not known
    t05: { closed: "yesterday", season: "winter" },   // no time: not a close
  }, { now: NOW, known: KNOWN });
  assert.deepEqual(r, { t00: { closed: NOW - 10, season: null } });
  for (const closed of [0, -1, NaN, Infinity, NOW + 3 * 864e5, 1e300, null, {}, [NOW]]) assert.deepEqual(sanitizeRecord({ t00: { closed, season: "spring" } }, { now: NOW, known: KNOWN }), {}, `closed: ${String(closed)}`);
  assert.deepEqual(sanitizeRecord({ t00: { closed: NOW + 60_000, season: "spring" } }, { now: NOW, known: KNOWN }), { t00: { closed: NOW + 60_000, season: "spring" } }, "a clock a minute fast is not a bad clock");
  assert.deepEqual(sanitizeRecord({ t00: 5, t05: null }, { now: NOW, known: KNOWN }), {}, "an entry that is not an object");
});

test("a level this build does not list is dropped, and names the object only inherits are not levels", () => {
  const raw = { t00: { closed: NOW - 1, season: "summer" }, t99: { closed: NOW - 1, season: "summer" }, toString: { closed: NOW - 1 }, constructor: { closed: NOW - 1 }, __proto__: { t05: { closed: NOW - 1 } } };
  assert.deepEqual(Object.keys(sanitizeRecord(raw, { now: NOW, known: ["t00"] })), ["t00"]);
  assert.deepEqual(Object.keys(sanitizeRecord(JSON.parse('{"__proto__":{"closed":1},"t00":{"closed":1700000000000}}'), { now: NOW, known: ["t00"] })), ["t00"]);
  assert.equal({}.closed, undefined, "nothing was written onto Object.prototype");
});

test("too much is not read: a long text, a crowd of keys, a long season", () => {
  assert.deepEqual(sanitizeRecord({ t00: { closed: NOW - 1, season: "autumn".repeat(4000) } }, { now: NOW, known: KNOWN }), { t00: { closed: NOW - 1, season: null } });
  const crowd = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`t${i}`, { closed: NOW - 1, season: "spring" }]));
  assert.ok(Object.keys(sanitizeRecord(crowd, { now: NOW, known: Array.from({ length: 5000 }, (_, i) => `t${i}`) })).length <= 32);
  const st = mem("x".repeat(200_000));
  assert.deepEqual(createPilgrimage(st, { now: () => NOW, known: KNOWN }).list(), [], "a store the size of a book is not read");
  const long = mem(JSON.stringify({ t00: { closed: NOW - 1, season: "autumn", note: "z".repeat(100_000) } }));
  assert.deepEqual(createPilgrimage(long, { now: () => NOW, known: KNOWN }).list(), [], "nor is a text far longer than any record");
});

test("a store of unreadable text reads as an empty record, and writing it mends it", () => {
  for (const text of [null, "", "{", "null", "[]", "42", '"x"']) assert.equal(createPilgrimage(mem(text), { now: () => NOW, known: KNOWN }).count(), 0, String(text));
  const st = mem("{"); const p = createPilgrimage(st, { now: () => NOW, known: KNOWN });
  assert.equal(p.mark("t00", { season: "spring" }), true); assert.deepEqual(JSON.parse(st.raw()), { t00: { closed: NOW, season: "spring" } });
});

test("marking a temple: the first close is when it was closed, a later close in another season is the season last", () => {
  const st = mem(); let now = NOW; const p = createPilgrimage(st, { now: () => now, known: KNOWN });
  assert.equal(p.has("t00"), false); assert.equal(p.count(), 0);
  assert.equal(p.mark("t00", { season: "summer" }), true, "the first time");
  now += 5000;
  assert.equal(p.mark("t00", { season: "autumn" }), false, "the second time is not a new temple");
  assert.deepEqual(p.get("t00"), { closed: NOW, season: "autumn" }, "the time stays, the season is the last");
  assert.equal(p.mark("t77", { season: "autumn" }), false, "a level this build does not know is not marked");
  assert.equal(p.mark("t00", { season: "monsoon" }), false); assert.equal(p.get("t00").season, "autumn", "a bad season changes nothing");
  assert.deepEqual(p.list().map((e) => e.id), ["t00"]);
  // A second reader of the same store sees it at once: nothing is held in memory that the store does not say.
  assert.deepEqual(createPilgrimage(st, { now: () => now, known: KNOWN }).get("t00"), { closed: NOW, season: "autumn" });
});

test("a close kept in an old book can be carried over, at the time it was, without moving a later one", () => {
  const p = createPilgrimage(mem(), { now: () => NOW, known: KNOWN });
  assert.equal(p.mark("t00", { season: null, at: NOW - 40 * 864e5 }), true);
  assert.deepEqual(p.get("t00"), { closed: NOW - 40 * 864e5, season: null });
  assert.equal(p.mark("t00", { season: "winter" }), false); assert.deepEqual(p.get("t00"), { closed: NOW - 40 * 864e5, season: "winter" });
});

test("a storage that refuses (a private window) is no error: nothing is kept, nothing is thrown", () => {
  const no = { get() { throw new Error("denied"); }, set() { throw new Error("denied"); } };
  const p = createPilgrimage(no, { now: () => NOW, known: KNOWN });
  assert.equal(p.count(), 0); assert.doesNotThrow(() => p.mark("t00", { season: "spring" }));
});

test("beginning a temple's book again does not empty the record of temples closed", () => {
  const book = mem(), keep = mem(); let now = NOW;
  const journey = createJourney(book, () => now), p = createPilgrimage(keep, { now: () => now, known: KNOWN });
  journey.earn("bell"); journey.close("autumn"); p.mark("t00", { season: "autumn" });
  journey.reset();   // 从头走起 / 重新朝山
  assert.equal(journey.closed, null, "the book is empty again");
  assert.equal(p.has("t00"), true, "and the pilgrimage still remembers the temple closed");
  assert.deepEqual(p.get("t00"), { closed: NOW, season: "autumn" });
});

test("no way a visitor takes empties the record: nothing in the page calls for it but the debug panel and the test hooks", () => {
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const files = fs.readdirSync(path.join(ROOT, "app/src")).filter((f) => f.endsWith(".js") && f !== "debug.js" && f !== "pilgrimage.js").map((f) => `app/src/${f}`).concat(["app/yard.js"]);
  for (const f of files) assert.doesNotMatch(src(f), /\bpilgrim\w*\.(clear|reset|forget)\s*\(/, `${f} must not empty the record`);
  assert.doesNotMatch(src("app/src/pilgrimage.js"), /removeItem\(\s*PILGRIMAGE_KEY/, "the record's own module never removes its key");
});

// ---- when the entrances appear ----
test("the entrances appear only once a temple has been closed, and only where there is somewhere to go", () => {
  const none = {}, one = { t00: { closed: NOW, season: "summer" } };
  assert.equal(entriesOpen(none, ["t00", "t05"]), false, "nothing closed: no entrance");
  assert.equal(entriesOpen(one, ["t00", "t05"]), true, "one closed: the three entrances open");
  assert.equal(entriesOpen(one, ["t00"]), false, "a build that lists one temple (the public page) has no map to open");
  assert.equal(entriesOpen({ t05: { closed: NOW, season: "spring" } }, ["t00"]), false, "a close of a temple this build does not list is not one");
  assert.equal(entriesOpen(one, []), false);
  assert.equal(entriesOpen(null, ["t00", "t05"]), false);
});

// ---- what the map holds ----
const PLACES = { t00: { region: "江南", seal: "云径" }, t05: { region: "关外", seal: "奉明" } };
test("on the map a temple closed is a place to go, the one he is in is marked, one not yet visited is a fog with no name", () => {
  const rec = { t00: { closed: NOW, season: "autumn" } };
  const from05 = mapEntries(rec, ["t00", "t05"], "t05", PLACES);
  assert.deepEqual(from05.map((e) => [e.id, e.state]), [["t00", "closed"], ["t05", "here"]]);
  assert.deepEqual(from05[0], { id: "t00", state: "closed", go: true, region: "江南", seal: "云径", season: "autumn" });
  assert.equal(from05[1].go, false, "the temple he stands in is not a place to go to");
  assert.equal(from05[1].region, "关外", "it is marked, with its region, though it has not been closed");
  const from00 = mapEntries(rec, ["t00", "t05"], "t00", PLACES);
  assert.deepEqual(from00.map((e) => [e.id, e.state, e.go]), [["t00", "here", false], [undefined, "fog", false]]);
  assert.equal(from00[0].season, "autumn", "the one he is in, closed, still says when");
  // The fog says nothing that could name it: not its id, its region, its seal.
  assert.deepEqual(Object.keys(from00[1]).sort(), ["go", "state"], "a fog carries no id, no region, no seal");
  assert.doesNotMatch(JSON.stringify(from00[1]), /t05|关外|奉明/);
});

test("a temple not closed can never be gone to, whatever else is true", () => {
  for (const current of ["t00", "t05"]) for (const rec of [{}, { t00: { closed: NOW, season: null } }, { t05: { closed: NOW, season: null } }, { t00: { closed: NOW, season: null }, t05: { closed: NOW, season: null } }]) {
    for (const e of mapEntries(rec, ["t00", "t05"], current, PLACES)) assert.equal(e.go, e.state === "closed", `${current} ${JSON.stringify(rec)} ${e.state}`);
  }
});

// ---- the hold on Q ----
test("a hold of Q fills over a second and opens the map; let go on the way, it opens nothing", () => {
  let t = 0; const log = [];
  const h = createHold({ now: () => t, onProgress: (p) => log.push(+p.toFixed(2)), onFull: () => log.push("full"), onCancel: () => log.push("cancel") });
  assert.equal(HOLD_MS, 1000);
  assert.equal(h.down(), true); h.tick(); t = 250; h.tick(); t = 600; h.tick();
  assert.equal(h.up(), true); t = 1500; h.tick();
  assert.deepEqual(log, [0, 0, 0.25, 0.6, "cancel"], "released at 0.6: cancelled, and never opened after");
  assert.equal(h.state().active, false);
  log.length = 0; t = 2000;
  h.down(); t = 2999; h.tick(); assert.ok(!log.includes("full"), "not full a millisecond short"); t = 3000; h.tick();
  assert.deepEqual(log.slice(-2), [1, "full"]); assert.equal(h.state().active, false, "once open it is over");
  assert.equal(h.up(), false, "and the key coming up afterwards cancels nothing");
  t = 4000; h.tick(); assert.equal(log.filter((x) => x === "full").length, 1, "full only once");
});

test("a second press while one is held changes nothing; a hold begun with no clock moving does not open early", () => {
  let t = 0; let full = 0; const h = createHold({ now: () => t, onFull: () => full++ });
  h.down(); t = 400; assert.equal(h.down(), false, "pressed again while held"); t = 999; h.tick(); assert.equal(full, 0);
  t = 1000; h.tick(); assert.equal(full, 1);
});

// ---- what a crossing hands to the page that opens ----
const cross = { from: "t00", to: "t05", season: "autumn", time: "dusk", follow: false, at: NOW };
test("a crossing hands over where it came from, where it goes, and the visit's season and hour; only for the temple it names", () => {
  assert.deepEqual(sanitizeCrossing(cross, { now: NOW + 4000, level: "t05" }), { ...cross });
  assert.equal(sanitizeCrossing(cross, { now: NOW, level: "t00" }), null, "another temple's page does not take it");
  assert.ok(sanitizeCrossing(cross, { now: NOW }), "asked of no page in particular it is read as written");
});

test("a crossing keeps a few minutes, not longer, and is not read from the future", () => {
  assert.ok(sanitizeCrossing(cross, { now: NOW + CROSSING_FRESH - 1, level: "t05" }));
  assert.equal(sanitizeCrossing(cross, { now: NOW + CROSSING_FRESH + 1, level: "t05" }), null);
  assert.equal(sanitizeCrossing({ ...cross, at: NOW + 3_600_000 }, { now: NOW, level: "t05" }), null);
});

test("a damaged crossing is no crossing, and a damaged field falls back", () => {
  for (const bad of [null, 7, "x", [], { ...cross, to: "../x" }, { ...cross, to: 5 }, { ...cross, at: "now" }, { ...cross, at: NaN }, { ...cross, to: "t".repeat(80) }]) assert.equal(sanitizeCrossing(bad, { now: NOW }), null, JSON.stringify(bad));
  const s = sanitizeCrossing({ ...cross, season: "monsoon", time: 9, follow: "yes", from: "T 00" }, { now: NOW });
  assert.deepEqual([s.season, s.time, s.follow, s.from], [null, null, false, null]);
});

test("it is read once: taken and forgotten, whether or not it was for this page; a look does not take it", () => {
  const st = session();
  assert.ok(keepCrossing(st, cross)); assert.ok(peekCrossing(st, { now: NOW, level: "t05" }), "the first script only looks");
  assert.ok(st.m.has(CROSSING_KEY));
  assert.equal(takeCrossing(st, { now: NOW, level: "t05" })?.to, "t05"); assert.equal(st.m.has(CROSSING_KEY), false);
  assert.equal(takeCrossing(st, { now: NOW, level: "t05" }), null, "a second reload finds nothing");
  keepCrossing(st, cross); assert.equal(takeCrossing(st, { now: NOW, level: "t00" }), null); assert.equal(st.m.has(CROSSING_KEY), false, "one for another temple is still forgotten");
  keepCrossing(st, cross); assert.equal(takeCrossing(st, { now: NOW + CROSSING_FRESH + 5, level: "t05" }), null); assert.equal(st.m.has(CROSSING_KEY), false, "a stale one is forgotten too");
});

test("a storage that refuses is no crossing and no error", () => {
  const no = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(keepCrossing(no, cross), false); assert.equal(peekCrossing(no), null); assert.equal(takeCrossing(no), null);
});

test("the address of the page that opens: the level, the visitor's own settings, and none of the places a link or a tool names", () => {
  const href = "https://x.test/p/?level=t00&cam=21.3,87.37,0,0.04&view=third&season=autumn&time=day&lang=zh&q=low&off=drift&devpose=1&in=main&up=lingxiao&enter=1&tour=120x3&at=bell&play=ending&seals=all&debug=1#h";
  assert.equal(crossingURL(href, "t05", "t00"), "https://x.test/p/?lang=zh&q=low&off=drift&debug=1&level=t05#h");
  assert.equal(crossingURL(href, "t00", "t00"), "https://x.test/p/?lang=zh&q=low&off=drift&debug=1#h", "the prologue is the page's own default and needs no name");
  assert.equal(crossingURL("https://x.test/?q=low", "t05", "t00"), "https://x.test/?q=low&level=t05");
  for (const k of CROSSING_DROPS) assert.ok(!crossingURL(`https://x.test/?${k}=1`, "t05", "t00").includes(`${k}=`), k);
});

// ---- the curtain kept shut from the first paint: index.html's first script says what takeCrossing says ----
import vm from "node:vm";
test("index.html's first script shuts the curtain exactly when a usable crossing is waiting for this page's level", () => {
  const html = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((c) => c.includes(CROSSING_KEY));
  assert.ok(code, "the first script is in index.html and names the crossing's key");
  assert.ok(html.indexOf(code) < html.indexOf("<canvas") && html.indexOf(code) < html.indexOf('<script type="module"'), "it comes before anything is built or painted");
  // Vite puts the page's entry script before the first "<body" or "</head" it finds in the text, comments included: a comment that
  // writes one of them swallows the entry script (the page then never starts: every check on #455's first pushes failed on it).
  assert.ok(!/<body\b|<\/?head\b/i.test(html), "index.html has no <body> or <head> in its text, not even in a comment");
  assert.ok(html.indexOf(code) < html.indexOf('<link rel="stylesheet"'), "above the stylesheet: a script placed after it waits for the sheet and holds back <body>, which the tests read the moment the page commits (quick (stairs) failed on it in CI)");
  const run = (stored, search, now = NOW) => {
    const added = [];
    const sessionStorage = { getItem: (k) => { if (stored === "throw") throw new Error("denied"); return k === CROSSING_KEY ? stored : null; } };
    vm.runInNewContext(code, { sessionStorage, location: { search }, document: { documentElement: { classList: { add: (c) => added.push(c) } } }, URLSearchParams, JSON, Date: { now: () => now } });
    return added;
  };
  const put = (o) => JSON.stringify({ ...cross, ...o });
  assert.deepEqual(run(put({}), "?level=t05"), ["crossing"], "waiting for this level: shut");
  assert.deepEqual(run(put({ to: "t00" }), ""), ["crossing"], "the prologue is the page's default level");
  assert.deepEqual(run(put({ to: "t00" }), "?q=low&level=t00"), ["crossing"]);
  assert.deepEqual(run(put({}), ""), [], "waiting for another level's page: open");
  assert.deepEqual(run(put({}), "?level=t00"), []);
  assert.deepEqual(run(put({}), "?level=nope"), []);
  assert.deepEqual(run(put({ at: NOW - CROSSING_FRESH - 1 }), "?level=t05"), [], "stale: open");
  assert.deepEqual(run(put({ at: NOW - CROSSING_FRESH + 1 }), "?level=t05"), ["crossing"], "a few minutes is still fresh");
  assert.deepEqual(run(put({ at: NOW + 3_600_000 }), "?level=t05"), [], "from the future: open");
  assert.deepEqual(run(null, "?level=t05"), [], "nothing waiting");
  assert.deepEqual(run("{", "?level=t05"), [], "damaged text");
  assert.deepEqual(run(put({ at: "now" }), "?level=t05"), []);
  assert.deepEqual(run("throw", "?level=t05"), [], "a storage that refuses is no crossing and no error");
  // …and it agrees with the page that reads it, for every case above
  for (const [stored, search, level] of [[put({}), "?level=t05", "t05"], [put({}), "", "t00"], [put({ to: "t00" }), "", "t00"], [put({ at: NOW - CROSSING_FRESH - 1 }), "?level=t05", "t05"]]) {
    const st = session(); st.setItem(CROSSING_KEY, stored);
    assert.equal(!!peekCrossing(st, { now: NOW, level }), run(stored, search).length === 1, `${stored} on ${search || "/"}`);
  }
});
