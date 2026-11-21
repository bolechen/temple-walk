// Taking the save to another place (#338, src/carry.js): the link carries every key the game keeps, comes back the same,
// and refuses whole anything damaged, cut short or written by a newer format.
import test from "node:test"; import assert from "node:assert/strict";
import { gather, check, apply, summary, encode, decode, linkFor, saveIn, SAVE_KEYS, SAVE_VERSION, SAVE_MOST, KIND, HASH, Refused } from "../../app/src/carry.js";
import { pack, deflate, MOST, ENVELOPE, b64u, crc8 } from "../../app/src/fragment.js";
import { DEFAULTS } from "../../app/src/settings.js";
import { SEALS } from "../../app/src/journey.js";
import { INCENSE_HALLS } from "../../app/src/incense.js";

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
  assert.match(text, /^save=[A-Za-z0-9_-]+$/, "the shared envelope, a link's letters only");
  console.log(`  a save of two seals: ${text.length} characters after #`);
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
  assert.equal(new URL(link).search, ""); assert.equal(saveIn(new URL(link).hash), link.split("#")[1]); assert.equal(saveIn("#other"), null); assert.equal(saveIn("#lamp=AQMJaw"), null);
});

// The largest save the checks let through: every seal, the longest verse and source, every setting, all three halls'
// incense, a hall's place with the longest name. Its JSON must stay well inside what decode inflates (SAVE_MOST), and
// its link inside what any fragment may be (fragment.js MOST), with room for keys a later version adds.
const largest = () => store({
  "yunjing.journey.v1": JSON.stringify({ v: 1, born: T, seals: Object.fromEntries(SEALS.map((s, i) => [s.id, T + i * 1000 + 0.123456789])), strikes: 3, verse: { text: "云".repeat(200), from: "径".repeat(200) }, done: T + 1e7 + 0.5, opened: T + 2e7 + 0.5, told: true, closed: T + 3e7 + 0.5, closedSeason: "winter", stamped: T + 4e7 + 0.5 }),
  "yunjing.place.v1": JSON.stringify({ x: -4999.99, z: 4999.99, yaw: -3.141592653589793, label: "凌霄阁上凌霄阁上凌霄阁上", at: T + 0.123456789, hall: "a".repeat(24) }),
  "yunjing.settings.v1": JSON.stringify({ ...DEFAULTS, rev: 9 }),
  "yunjing.lang.v1": "ko",
  "yunjing.visit.v1": JSON.stringify({ metres: 999999999, seconds: 999999999 }),
  "yunjing.prologue.v1": "1",
  "yunjing.incense.v1": JSON.stringify(Object.fromEntries(INCENSE_HALLS.map((h, i) => [h, T + i + 0.123456789]))),
});
test("the largest save the checks allow fits inside its own limit four times over, and its link inside a fragment's", async () => {
  const save = gather(largest()); assert.deepEqual(Object.keys(save.keys).sort(), Object.keys(SAVE_KEYS).sort(), "every key passed its check");
  const bytes = new TextEncoder().encode(JSON.stringify(save)).length, text = await encode(save);
  console.log(`  the largest save: ${bytes} bytes of JSON, ${text.length} characters after # (limits ${SAVE_MOST} and ${MOST})`);
  assert.ok(bytes * 4 <= SAVE_MOST, `${bytes} bytes leaves less than four times room under ${SAVE_MOST}`);
  assert.ok(text.length * 2 <= MOST, `the link's fragment, ${text.length}, should be half of ${MOST} at most`);
  assert.deepEqual(check(await decode(text)), check(save), "and it comes back whole");
});

test("a save rides in the envelope every link fragment shares: a newer envelope is newer, another kind or a small link that unpacks to a great deal is damaged (#357's fragment.js)", async () => {
  const s = gather(kept()), deflated = await deflate(new TextEncoder().encode(JSON.stringify(s)));
  const body = new Uint8Array(deflated.length + 2); body[0] = ENVELOPE + 1; body.set(deflated, 1); body[body.length - 1] = crc8(body.subarray(0, body.length - 1));
  await refusal(() => decode(`${KIND}=${b64u(body)}`), "newer");
  await refusal(() => decode(pack("lamp", deflated)), "damaged");
  const bomb = await deflate(new TextEncoder().encode(JSON.stringify({ ...s, pad: " ".repeat(SAVE_MOST * 4) })));
  assert.ok(pack(KIND, bomb).length < MOST, "the bomb itself is a short link");
  await refusal(() => decode(pack(KIND, bomb)), "damaged");
  await refusal(() => decode(pack(KIND, new Uint8Array([1, 2, 3]))), "damaged");
});

test("a place kept in a hall (#375) is carried with its hall, and a bad hall refuses the save", async () => {
  const from = kept(); from.setItem("yunjing.place.v1", JSON.stringify({ x: 120.8, z: 4.3, yaw: 0.3, label: "大雄宝殿", at: T, hall: "main" }));
  const back = check(await decode(await encode(gather(from))));
  assert.equal(JSON.parse(back["yunjing.place.v1"]).hall, "main");
  const s = gather(from); s.keys.place.hall = "../x"; assert.throws(() => check(s), (e) => e.reason === "damaged");
});
