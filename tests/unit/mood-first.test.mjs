// The season and hour a page opens in (startMood, app/src/mood.js; #573 step 7). A level may say how it looks the first time (Level.firstMood):
// T05 opens in early winter by day (J01; the owner, 2026-11-25: 「同意，T05 首次默认初冬白天」). The prologue says nothing, and every season, hour
// and "follow the clock" it had before comes out exactly as the old inline code in yard.js made it.
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./dom-stub.mjs";
const { startMood, SEASONS, TIMES } = await import("../../app/src/mood.js");
const t00 = (await import("../../app/levels/t00/level.js")).default, t05 = (await import("../../app/levels/t05/level.js")).default;
const q = (s) => new URLSearchParams(s);

// What yard.js did before startMood, written out as it was.
function was(Q, nowMood, prologueDay) {
  return {
    season: SEASONS.includes(Q.get("season")) ? Q.get("season") : Q.has("shot") || Q.has("show") || Q.has("cam") ? "summer" : nowMood.season,
    time: TIMES.includes(Q.get("time")) ? Q.get("time") : Q.has("shot") || Q.has("show") || Q.has("cam") || prologueDay ? "day" : nowMood.time,
    follow: !TIMES.includes(Q.get("time")) && !(Q.has("shot") || Q.has("show") || Q.has("cam")) && !prologueDay,
  };
}
const ADDRESSES = ["", "season=winter", "season=autumn&time=dusk", "time=night", "time=bogus", "season=bogus", "shot=1", "show=cam01", "cam=0,215,0,0", "shot=1&season=spring&time=dawn", "seals=all", "level=t05"];
const NOWS = [{ season: "spring", time: "dawn" }, { season: "summer", time: "day" }, { season: "autumn", time: "dusk" }, { season: "winter", time: "night" }];

test("the prologue (no firstMood) opens exactly as it did, for every address, clock and state of the book", () => {
  assert.equal(t00.firstMood, undefined, "the prologue says nothing about a first look");
  for (const a of ADDRESSES) for (const now of NOWS) for (const prologueDay of [true, false]) for (const keepsPlace of [true, false])
    assert.deepEqual(startMood({ query: q(a), now, prologueDay, firstMood: t00.firstMood, keepsPlace }), was(q(a), now, prologueDay), `${a || "(none)"} · ${now.season} ${now.time} · day ${prologueDay} · keeps ${keepsPlace}`);
});

test("T05 opens in early winter by day, whatever the clock or the prologue's book", () => {
  assert.deepEqual(t05.firstMood, { season: "winter", time: "day" });
  assert.ok(!t05.keepsPlace, "T05 keeps no book of its own yet, so it is always on its first look");
  for (const now of NOWS) for (const prologueDay of [true, false]) {
    const m = startMood({ query: q("level=t05"), now, prologueDay, firstMood: t05.firstMood, keepsPlace: !!t05.keepsPlace });
    assert.deepEqual(m, { season: "winter", time: "day", follow: false }, `${now.season} ${now.time}, prologue day ${prologueDay}`);
  }
});

test("an address, a fixed view or a hand still comes before the first look; a level that keeps a book is first only until it is filled", () => {
  const go = (a, extra = {}) => startMood({ query: q(a), now: NOWS[0], prologueDay: false, firstMood: t05.firstMood, keepsPlace: false, ...extra });
  assert.deepEqual(go("level=t05&season=autumn"), { season: "autumn", time: "day", follow: false }, "?season= keeps the first look's hour");
  assert.deepEqual(go("level=t05&time=dusk"), { season: "winter", time: "dusk", follow: false });
  assert.deepEqual(go("level=t05&season=spring&time=dawn"), { season: "spring", time: "dawn", follow: false });
  for (const fixed of ["shot=1", "show=cam01", "cam=0,215,0,0"]) assert.deepEqual(go(`level=t05&${fixed}`), { season: "summer", time: "day", follow: false }, `${fixed} keeps the old default: a summer day`);
  // A level with a book of its own, once the book has been filled, follows the clock again.
  assert.deepEqual(startMood({ query: q(""), now: NOWS[2], prologueDay: false, firstMood: { season: "winter", time: "day" }, keepsPlace: true }), { season: "autumn", time: "dusk", follow: true });
  assert.deepEqual(startMood({ query: q(""), now: NOWS[2], prologueDay: true, firstMood: { season: "winter", time: "day" }, keepsPlace: true }), { season: "winter", time: "day", follow: false });
});

test("firstMood is an optional field of the level's type, and yard.js reads it through startMood", () => {
  assert.match(readFileSync(new URL("../../app/src/level.js", import.meta.url), "utf8"), /@property \{\{ season: string, time: string \}\} \[firstMood\]/);
  const yard = readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
  assert.ok(/startMood\(\{ query: Q, now: nowMood, prologueDay, firstMood: L\.firstMood, keepsPlace: !!L\.keepsPlace \}\)/.test(yard));
});
