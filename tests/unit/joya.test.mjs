// The year-end bell (#341): the window by the visitor's clock and by the Worker's UTC, the visitor's limit, the count
// as the page keeps it, the fake counter the workbench uses. app/src/joya.js.
import test from "node:test";
import assert from "node:assert/strict";
import { JOYA, windowAt, serverWindow, yearNear, eventFor, createLimiter, roundsPassed, readReply, createTally, fakeCounter, httpCounter, countText } from "../../app/src/joya.js";

const at = (y, mo, d, h, mi = 0) => ({ year: y, month: mo, day: d, hour: h, minute: mi });

test("the window is 20:00 on 31 December to 02:00 on 1 January by the visitor's own clock", () => {
  assert.equal(windowAt(at(2026, 11, 31, 19)).open, false);
  assert.deepEqual(windowAt(at(2026, 11, 31, 20)), { open: true, year: 2027 });
  assert.deepEqual(windowAt(at(2026, 11, 31, 23)), { open: true, year: 2027 });
  assert.deepEqual(windowAt(at(2027, 0, 1, 0)), { open: true, year: 2027 });
  assert.deepEqual(windowAt(at(2027, 0, 1, 1)), { open: true, year: 2027 });
  assert.equal(windowAt(at(2027, 0, 1, 2)).open, false);
  assert.equal(windowAt(at(2026, 11, 30, 23)).open, false);
  assert.equal(windowAt(at(2026, 10, 20, 22)).open, false);
});

test("the Worker asks the same window in UTC, with the visitor's offset, and refuses a night no zone could be in", () => {
  const ms = (y, mo, d, h, mi = 0) => Date.UTC(y, mo, d, h, mi);
  // Tokyo (UTC+9, offset −540): 23:30 local on the 31st is 14:30 UTC.
  assert.deepEqual(serverWindow(ms(2026, 11, 31, 14, 30), -540), { open: true, year: 2027, anywhere: true, tzOk: true });
  // The same moment from New York (UTC−5, 300) is 09:30 on the 31st there: not open.
  assert.equal(serverWindow(ms(2026, 11, 31, 14, 30), 300).open, false);
  // A clock claiming UTC+9 at 10:00 UTC on 1 January (19:00 local) is past its window.
  assert.equal(serverWindow(ms(2027, 0, 1, 10), -540).open, false);
  // Kiribati (UTC+14) opens first, at 06:00 UTC; Baker Island (UTC−12) closes last, at 14:00 UTC on the 1st.
  assert.equal(serverWindow(ms(2026, 11, 31, 5, 59), -840).anywhere, false);
  assert.equal(serverWindow(ms(2026, 11, 31, 6, 0), -840).open, true);
  assert.equal(serverWindow(ms(2027, 0, 1, 13, 59), 720).open, true);
  assert.equal(serverWindow(ms(2027, 0, 1, 14, 0), 720).anywhere, false);
  // An offset no zone has is refused, whatever it would make the time.
  for (const tz of [-900, 780, 1.5, "0", null, undefined]) assert.equal(serverWindow(ms(2026, 11, 31, 20), /** @type {any} */ (tz)).open, false, String(tz));
  // Half-hour zones count: India (UTC+5:30, −330) at 23:00 local is 17:30 UTC.
  assert.equal(serverWindow(ms(2026, 11, 31, 17, 30), -330).open, true);
  // Out of the season altogether.
  assert.equal(serverWindow(ms(2026, 6, 1, 12), 0).anywhere, false);
  assert.equal(yearNear(ms(2026, 11, 20, 12)), 2027);
  assert.equal(yearNear(ms(2027, 0, 1, 3)), 2027);
});

test("only the workbench opens the night early, and only by ?event=joya", () => {
  const noon = new Date(2026, 10, 20, 12), eve = new Date(2026, 11, 31, 21);
  assert.deepEqual(eventFor({ query: new URLSearchParams("event=joya"), bench: true, now: noon }), { open: true, year: 2027, forced: true });
  assert.equal(eventFor({ query: new URLSearchParams("event=joya"), bench: false, now: noon }).open, false, "the published site ignores ?event=");
  assert.deepEqual(eventFor({ query: new URLSearchParams(""), bench: false, now: eve }), { open: true, year: 2027, forced: false });
  assert.equal(eventFor({ query: new URLSearchParams("event=none"), bench: true, now: eve }).open, false);
  assert.equal(eventFor({ query: new URLSearchParams("event=none"), bench: false, now: eve }).open, true);
});

test("a visitor counts at most perMin strokes in any minute", () => {
  const l = createLimiter(6);
  for (let i = 0; i < 6; i++) assert.equal(l.take(i * 1000), true);
  assert.equal(l.take(10000), false, "the seventh in the same minute");
  assert.equal(l.take(59999), false);
  assert.equal(l.take(60000), true, "the first has left the minute");
  assert.equal(l.take(60001), false);
  assert.equal(JOYA.batch >= JOYA.perMin * JOYA.flushSecs / 60, true, "a report carries everything one interval can count");
});

test("rounds of 108 are counted between replies, never on the first", () => {
  assert.equal(roundsPassed(null, 500), 0);
  assert.equal(roundsPassed(100, 107), 0);
  assert.equal(roundsPassed(107, 108), 1);
  assert.equal(roundsPassed(100, 330), 3);
  assert.equal(roundsPassed(330, 300), 0);
  assert.deepEqual(readReply({ year: 2027, total: 216, at: 5 }), { year: 2027, total: 216, rounds: 2, at: 5 });
  for (const r of [null, {}, { year: 2027, total: -1 }, { year: 2027, total: 1.5 }, { year: "2027", total: 3 }, "x"]) assert.equal(readReply(r), null);
});

test("the tally: a stroke shows at once, is sent in a batch, survives a failure, and the 108th is told once", async () => {
  let clock = Date.UTC(2026, 11, 31, 14, 0);   // 23:00 in Tokyo
  const now = () => clock, srv = fakeCounter({ start: 100, now });
  const totals = [], rounds = [];
  let down = false;
  const t = createTally({ year: 2027, tz: -540, now, send: (n, tz) => (down ? Promise.reject(new Error("offline")) : srv.send(n, tz)), ask: (y) => (down ? Promise.resolve(null) : srv.ask(y)), onTotal: (n) => totals.push(n), onRound: (k, n) => rounds.push([k, n]) });
  assert.equal(t.shown, null, "nothing is shown before the counter has answered");
  assert.equal(await t.poll(), true); assert.equal(t.shown, 100); assert.deepEqual(rounds, [], "the first reply passes no round");
  for (let i = 0; i < 8; i++) { t.strike(); clock += 1000; }
  assert.equal(t.snapshot().mine, 6, "the visitor's minute holds six"); assert.equal(t.shown, 106);
  // The first report goes; a second within 15 s does not.
  assert.equal(await t.flush(), true); assert.equal(srv.total, 106); assert.equal(await t.flush(), false);
  // Someone else rings two: the poll passes 108, and the far bell is told once.
  await srv.send(2, -540); await t.poll();
  assert.deepEqual(rounds, [[1, 108]]); assert.equal(t.shown, 108);
  // Offline: the stroke is kept and tried again; nothing is thrown, the shown number stays.
  clock += 61000; down = true; t.strike(); clock += 16000;
  assert.equal(await t.flush(), false); assert.equal(t.snapshot().pending, 1); assert.equal(await t.poll(), false); assert.equal(t.shown, 109);
  down = false; clock += 16000; assert.equal(await t.flush(), true); assert.equal(srv.total, 109); assert.equal(t.snapshot().pending, 0);
  assert.equal(totals.at(-1), 109);
});

test("the fake counter refuses what the Worker refuses", async () => {
  const noon = () => Date.UTC(2026, 10, 20, 4);
  assert.equal(await fakeCounter({ now: noon }).send(1, -480), null, "not the night");
  const any = fakeCounter({ now: noon, anyHour: true });
  assert.equal((await any.send(1, -480)).total, 1);
  for (const n of [0, 7, 1.5, -1]) assert.equal(await any.send(n, -480), null, String(n));
  const crowd = fakeCounter({ now: noon, anyHour: true, crowd: 2 });
  assert.equal(crowd.total, 0);
});

test("over the network: one address, its replies read, every failure null", async () => {
  const seen = [];
  const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  const f = /** @type {any} */ ((url, init) => { seen.push([url, init?.method || "GET", init?.body]); return url.includes("fail") ? Promise.reject(new Error("x")) : ok({ year: 2027, total: 9 }); });
  const c = httpCounter("https://temple.example/sub/", f);
  assert.deepEqual(await c.ask(2027), { year: 2027, total: 9 });
  await c.send(2, -480);
  assert.deepEqual(seen, [["https://temple.example/sub/api/joya?year=2027", "GET", undefined], ["https://temple.example/sub/api/joya", "POST", JSON.stringify({ n: 2, tz: -480 })]]);
  assert.equal(await httpCounter("https://fail.example/", f).ask(2027), null);
  assert.equal(await httpCounter("https://x.example/", /** @type {any} */ (() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }))).send(1, 0), null);
  assert.equal(countText(12345, "zh"), "12,345");
});
