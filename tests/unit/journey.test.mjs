import test from "node:test"; import assert from "node:assert/strict";
import { SEALS, SEAL, VERSES, pickVerse, createJourney, placeAt, KEY } from "../../app/src/journey.js";

// A store that remembers in memory, as the browser's would.
const memory = (initial = null) => { let v = initial; return { get: () => v, set: (x) => { v = x; }, peek: () => v }; };

test("there are seven seals, each with everything the page shows", () => {
  assert.equal(SEALS.length, 7);
  assert.equal(new Set(SEALS.map((s) => s.id)).size, 7);
  for (const s of SEALS) {
    assert.equal([...s.seal].length, 2, `${s.id}: a seal is cut with two characters`);
    for (const k of ["place", "act", "line", "hint"]) assert.ok(typeof s[k] === "string" && s[k].length >= 2, `${s.id}.${k}`);
    assert.ok(s.need >= 1);
    assert.equal(SEAL[s.id], s);
  }
  assert.match(KEY, /\.v1$/, "the stored book carries a version");
});

test("a new visitor's book is empty and points at the bell", () => {
  const j = createJourney(memory());
  assert.equal(j.count(), 0); assert.equal(j.done(), false); assert.equal(j.next().id, "bell");
  assert.equal(j.finished, null); assert.equal(j.verse, null);
  assert.deepEqual(j.list().map((s) => s.got), [null, null, null, null, null, null, null]);
});

test("the bell must be struck three times", () => {
  const j = createJourney(memory());
  assert.deepEqual(j.strike(), { strikes: 1, earned: false });
  assert.deepEqual(j.strike(), { strikes: 2, earned: false });
  assert.equal(j.has("bell"), false);
  assert.deepEqual(j.strike(), { strikes: 3, earned: true });
  assert.equal(j.has("bell"), true);
  assert.deepEqual(j.strike(), { strikes: 3, earned: false }, "a fourth stroke earns nothing more");
  assert.equal(j.next().id, "incense");
});

test("a seal is earned once, in any order, and unknown seals are refused", () => {
  let t = 1000; const j = createJourney(memory(), () => t++);
  assert.equal(j.earn("sit"), true); assert.equal(j.earn("sit"), false);
  assert.equal(j.earn("nothing"), false); assert.equal(j.count(), 1);
  assert.equal(j.next().id, "bell", "the hint still starts from the foot of the mountain");
  assert.ok(j.list().find((s) => s.id === "sit").got >= 1000);
});

test("the library's line is kept with its seal", () => {
  const j = createJourney(memory()), v = pickVerse(3);
  assert.equal(j.earn("sutra", { verse: v }), true);
  assert.deepEqual(j.verse, v);
});

test("the book is full when all seven are earned, and remembers when", () => {
  let t = 5000; const j = createJourney(memory(), () => t++);
  for (const s of SEALS) { assert.equal(j.done(), false); if (s.id === "bell") { j.strike(); j.strike(); j.strike(); } else j.earn(s.id, { verse: pickVerse(0) }); }
  assert.equal(j.done(), true); assert.equal(j.count(), 7); assert.equal(j.next(), null);
  const when = j.finished; assert.ok(when >= 5000);
  j.earn("tea"); assert.equal(j.finished, when, "the day it was completed does not move");
});

test("the book survives leaving and coming back", () => {
  const store = memory(); let j = createJourney(store, () => 42);
  j.strike(); j.earn("tea"); j.earn("sutra", { verse: pickVerse(5) });
  j = createJourney(store, () => 99);
  assert.equal(j.strikes, 1); assert.equal(j.has("tea"), true); assert.equal(j.has("bell"), false);
  assert.deepEqual(j.verse, pickVerse(5)); assert.equal(j.born, 42);
  j.reset(); assert.equal(createJourney(store).count(), 0);
});

test("a damaged or foreign book is replaced by a fresh one rather than breaking the visit", () => {
  for (const bad of ["{not json", "null", "[]", '{"v":2,"seals":{"bell":1}}', '{"v":1}', '{"v":1,"seals":"x"}', "12"]) {
    const j = createJourney(memory(bad)); assert.equal(j.count(), 0, bad); assert.equal(j.next().id, "bell");
  }
  const j = createJourney(memory('{"v":1,"born":7,"seals":{"tea":5,"ghost":9,"well":"x"},"strikes":99,"verse":{"text":"看脚下。"}}'));
  assert.equal(j.count(), 1); assert.equal(j.has("tea"), true); assert.equal(j.strikes, 3); assert.equal(j.verse.from, "");
});

test("a store that refuses to remember does not stop the visit", () => {
  const j = createJourney({ get() { throw new Error("blocked"); }, set() { throw new Error("blocked"); } });
  assert.equal(j.earn("tea"), true); assert.equal(j.count(), 1);
});

test("every line the library can give has a text and a source, and the choice is steady", () => {
  assert.ok(VERSES.length >= 12);
  for (const [text, from] of VERSES) { assert.ok(text.length >= 3 && /[。]$/.test(text), text); assert.ok(from.length >= 2, text); }
  assert.equal(new Set(VERSES.map((v) => v[0])).size, VERSES.length);
  assert.deepEqual(pickVerse(4), pickVerse(4)); assert.deepEqual(pickVerse(4 + VERSES.length), pickVerse(4));
  assert.ok(pickVerse(-1).text && pickVerse(1e12 + 0.7).text);
  assert.equal(new Set(VERSES.map((_, i) => pickVerse(i).text)).size, VERSES.length);
});

test("standing in a place's circle finds it; standing between two finds the nearer", () => {
  const places = { a: { at: [0, 0], r: 2 }, b: { at: [3, 0], r: 2 }, c: { at: [50, 50] } };
  assert.equal(placeAt(places, 0.5, 0), "a"); assert.equal(placeAt(places, 2, 0), "b");
  assert.equal(placeAt(places, 10, 10), null); assert.equal(placeAt(places, 50.5, 50.5), "c");
});

test("the seasons open when the book is first filled, are told of once, and stay open when the book is begun again", () => {
  const mem = memory(), j = createJourney(mem);
  assert.equal(j.opened(), false, "a new visitor chooses no season");
  for (const { id } of SEALS) { if (id !== "sit") j.earn(id); }
  assert.equal(j.opened(), false, "six seals are not yet the whole book");
  j.earn("sit");
  assert.equal(j.opened(), true, "the seventh seal opens the seasons");
  assert.equal(j.told(), false); j.tell(); assert.equal(j.told(), true);
  j.reset();
  assert.equal(j.count(), 0, "重新朝山 empties the book");
  assert.equal(j.opened(), true, "but the seasons stay open for the second walk");
  assert.equal(j.told(), true, "and are not announced again");
  const again = createJourney(mem);
  assert.equal(again.opened(), true, "remembered between visits");
});

test("a book filled before the seasons were kept still opens them", () => {
  const old = memory(JSON.stringify({ v: 1, born: 1, seals: Object.fromEntries(SEALS.map((s, i) => [s.id, 10 + i])), strikes: 3, verse: null, done: 99 }));
  assert.equal(createJourney(old).opened(), true);
  const half = memory(JSON.stringify({ v: 1, born: 1, seals: { bell: 5 }, strikes: 3, verse: null, done: null, opened: "x" }));
  assert.equal(createJourney(half).opened(), false, "a damaged mark does not open them");
});

test("the prologue closes on the summit whatever else is held, once, and the book still fills afterwards", () => {
  const store = memory(); let t = 100; let j = createJourney(store, () => t++);
  j.earn("tea"); assert.equal(j.closed, null, "nothing has closed before the summit");
  assert.equal(j.earn("sit"), true, "the summit's seal is earned with only one other held");
  assert.equal(j.close(), true, "the first close is the one that plays"); assert.equal(j.close(), false, "and it plays only once");
  const when = j.closed; assert.ok(when >= 100);
  j = createJourney(store, () => t++); assert.equal(j.closed, when, "a reload remembers that the close was seen");
  for (const s of SEALS) if (s.id === "bell") { j.strike(); j.strike(); j.strike(); } else j.earn(s.id, { verse: pickVerse(1) });
  assert.equal(j.done(), true, "the seals left over can still be earned after the close"); assert.equal(j.closed, when);
});

test("an older book keeps its seals, and one whose close was seen before this version is not shown it again", () => {
  const raw = JSON.stringify({ v: 1, born: 3, seals: { bell: 4, tea: 5 }, strikes: 3, verse: null, done: null });
  let j = createJourney(memory(raw)); assert.equal(j.count(), 2); assert.equal(j.closed, null);
  j = createJourney(memory(raw), () => 9, { closedBefore: true }); assert.equal(j.closed, 9, "the old flag that the ending was seen carries over");
  const full = JSON.stringify({ v: 1, born: 3, seals: Object.fromEntries(SEALS.map((s, i) => [s.id, 10 + i])), strikes: 3, done: 30 });
  j = createJourney(memory(full)); assert.equal(j.closed, 30, "a book filled under the old rule, where the close came with the seventh seal, has seen it");
});

test("beginning the book again lets the summit close the new walk", () => {
  const j = createJourney(memory(), () => 7); j.earn("sit"); j.close(); j.reset();
  assert.equal(j.closed, null); assert.equal(j.count(), 0);
});

test("the close is shown once in each season: after a change of season the summit closes the prologue again", () => {
  const store = memory(); let t = 10; let j = createJourney(store, () => t++);
  assert.equal(j.closedIn("summer"), false);
  assert.equal(j.close("summer"), true); assert.equal(j.closedIn("summer"), true);
  assert.equal(j.close("summer"), false, "not twice in the same season");
  assert.equal(j.closedIn("winter"), false, "another season has not seen it");
  assert.equal(j.close("winter"), true); assert.equal(j.closedIn("winter"), true); assert.equal(j.closedIn("summer"), false, "only the season it was last shown in counts");
  j = createJourney(store, () => t++); assert.equal(j.closedIn("winter"), true, "the season is remembered across a reload");
});

test("a close recorded before seasons were kept belongs to the season the visitor is in when it is next read", () => {
  const j = createJourney(memory(JSON.stringify({ v: 1, born: 1, seals: { sit: 2 }, strikes: 0, closed: 5 })), () => 9);
  assert.equal(j.closedIn("autumn"), true, "an old close is not replayed on its own"); j.adopt("autumn");
  assert.equal(j.closedIn("autumn"), true); assert.equal(j.closedIn("spring"), false, "but a change of season plays it again");
});
