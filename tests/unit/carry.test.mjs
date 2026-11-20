// Taking the save to another place (#338, src/carry.js): the link carries every key the game keeps, comes back the same,
// and refuses whole anything damaged, cut short or written by a newer format.
import test from "node:test"; import assert from "node:assert/strict";
import { gather, check, apply, summary, encode, decode, linkFor, saveIn, SAVE_KEYS, SAVE_VERSION, HASH, Refused } from "../../app/src/carry.js";

const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const T = 1_790_000_000_000;
const kept = () => store({
  "yunjing.journey.v1": JSON.stringify({ v: 1, born: T, seals: { bell: T + 1000, tea: T + 2000 }, strikes: 3, verse: { text: "行到水穷处，坐看云起时。", from: "王维《终南别业》" }, done: null, opened: null, told: false, closed: null, closedSeason: null, stamped: null }),
  "yunjing.place.v1": JSON.stringify({ x: 0.5, z: -6.25, yaw: 3.1, label: "大雄宝殿", at: T + 5000 }),
  "yunjing.settings.v1": JSON.stringify({ quality: "high", sens: 1.4, invertY: true, thirds: false, volume: 0.5, rev: 2 }),   // thirds put away, which only rev 2 may keep
  "yunjing.lang.v1": "ja",
  "yunjing.visit.v1": JSON.stringify({ metres: 412, seconds: 380 }),
  "yunjing.prologue.v1": "1",
  "yunjing.incense.v1": JSON.stringify({ main: T + 3000 }),
  "yunjing.debug.v1": "{}",   // not the visitor's: not carried
});
const refusal = async (fn, reason) => { await assert.rejects(async () => fn(), (e) => e instanceof Refused && e.reason === reason, `expected a refusal: ${reason}`); };

test("every key the game keeps for the visitor is carried, and comes back the same through the link", async () => {
  const from = kept(), save = gather(from);
  assert.deepEqual(Object.keys(save.keys).sort(), Object.keys(SAVE_KEYS).sort(), "all seven keys");
  const text = await encode(save), back = check(await decode(text)), to = store({ "yunjing.journey.v1": "old", "yunjing.place.v1": "old" });
  apply(to, back);
  for (const k of Object.values(SAVE_KEYS)) assert.deepEqual(JSON.parse(JSON.stringify(to.getItem(k))), from.getItem(k), k);
  assert.equal(to.getItem("yunjing.debug.v1"), null, "only the visitor's keys");
  assert.match(text, /^[A-Za-z0-9_-]+$/, "a link's letters only");
  console.log(`  a save of two seals: ${text.length} characters after ${HASH}`);
  assert.ok(text.length < 1200, "short enough for a chat message or a QR code: " + text.length);
});

test("the page says what it is about to write: the seals and where he was", () => {
  assert.deepEqual(summary(check(gather(kept()))), { seals: 2, of: 7, label: "大雄宝殿" });
});

test("what a save does not hold is cleared, so two pilgrimages are never mixed", () => {
  const to = kept(), only = check({ v: 1, game: "yunjing", keys: { place: { x: 1, z: 2, yaw: 0, label: "", at: T } } });
  apply(to, only);
  assert.equal(to.getItem("yunjing.journey.v1"), null); assert.equal(to.getItem("yunjing.incense.v1"), null); assert.ok(to.getItem("yunjing.place.v1"));
});

test("a damaged value anywhere refuses the whole save, and nothing is written", async () => {
  const good = gather(kept());
  const spoil = [
    (s) => { s.keys.journey.seals.bell = "yesterday"; }, (s) => { s.keys.journey.strikes = 9; }, (s) => { s.keys.place.x = "far"; },
    (s) => { s.keys.place.label = "x".repeat(40); }, (s) => { s.keys.settings.sens = 99; }, (s) => { s.keys.settings.quality = "ultra"; },
    (s) => { s.keys.lang = "fr"; }, (s) => { s.keys.visit.metres = -5; }, (s) => { s.keys.prologue = "yes"; }, (s) => { s.keys.incense.main = 0; },
    (s) => { s.game = "other"; }, (s) => { s.keys = []; },
  ];
  for (const f of spoil) {
    const s = structuredClone(good); f(s);
    const to = kept(), before = [...to.m.entries()];
    assert.throws(() => apply(to, check(s)), (e) => e instanceof Refused && e.reason === "damaged", f.toString());
    assert.deepEqual([...to.m.entries()], before, "nothing written: " + f.toString());
  }
});

test("a link cut short or garbled is refused", async () => {
  const text = await encode(gather(kept()));
  await refusal(() => decode(text.slice(0, Math.floor(text.length / 2))), "damaged");
  await refusal(() => decode(text.replace(/[a-m]/g, "z")), "damaged");
  await refusal(() => decode("not a save!"), "damaged");
  await refusal(() => decode(""), "damaged");
});

test("a save written by a newer format is refused, and says so; keys this version does not know are ignored", async () => {
  const s = gather(kept());
  assert.throws(() => check({ ...s, v: SAVE_VERSION + 1 }), (e) => e.reason === "newer");
  const extra = check({ ...s, keys: { ...s.keys, garden: { roses: 3 } } });
  assert.ok(!Object.keys(extra).some((k) => k.includes("garden")));
  assert.throws(() => check({ v: 1, game: "yunjing", keys: { lang: "en" } }), (e) => e.reason === "empty", "a save with neither a book nor a place is nothing to go on");
});

test("the link: a site's address with the save after the hash, never in the query", async () => {
  const link = await linkFor(kept(), "https://temple-walk-canary.bole-chen.workers.dev/#old");
  assert.ok(link.startsWith("https://temple-walk-canary.bole-chen.workers.dev/#save="));
  assert.equal(new URL(link).search, ""); assert.equal(saveIn(new URL(link).hash), link.split(HASH)[1]); assert.equal(saveIn("#other"), null);
});
