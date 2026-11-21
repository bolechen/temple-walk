// Incense in every hall that keeps a Buddha (#146): each hall's sticks are kept and burn on their own clock, an older save of
// one number is the great hall's, and a hall's stand is where the visitor can come to and reach the ash from.
import test from "node:test"; import assert from "node:assert/strict";
import { INCENSE_HALLS, incenseId, incenseHall, readIncense, writeIncense, burnt } from "../../app/src/incense.js";

test("three halls offer incense, the great hall's place keeps the seal's own id", () => {
  assert.deepEqual(INCENSE_HALLS, ["main", "yaoshi", "guanyin"]);
  assert.deepEqual(INCENSE_HALLS.map(incenseId), ["incense", "incense-yaoshi", "incense-guanyin"]);
  for (const h of INCENSE_HALLS) assert.equal(incenseHall(incenseId(h)), h);
  assert.equal(incenseHall("incense-dahui"), null, "the founder's hall keeps a patriarch, not a Buddha"); assert.equal(incenseHall("tea"), null);
});
test("an older save, one number, is the great hall's; nothing is lost and nothing throws", () => {
  assert.deepEqual(readIncense("1763500000000"), { main: 1763500000000 });
  assert.deepEqual(readIncense(null), {}); assert.deepEqual(readIncense(""), {}); assert.deepEqual(readIncense("0"), {}); assert.deepEqual(readIncense("not json"), {});
  assert.deepEqual(readIncense('{"main":5,"yaoshi":"x","guanyin":-1,"dahui":9,"tea":3}'), { main: 5 }, "only valid halls with valid times");
  const raw = writeIncense("1763500000000", "guanyin", 1763500100000);   // migrated by the first write after it
  assert.deepEqual(readIncense(raw), { main: 1763500000000, guanyin: 1763500100000 });
  assert.deepEqual(readIncense(writeIncense(raw, "main", 7)), { main: 7, guanyin: 1763500100000 }, "setting one hall again leaves the others");
});
test("each hall's sticks burn from the time they were set, on a clock that is the wall's", () => {
  const BURN = 300, t0 = 1_000_000, set = { main: t0, yaoshi: t0 + 60_000, guanyin: t0 + 200_000 };
  const k = (h, now) => burnt(set[h], now, BURN);
  assert.equal(k("main", t0), 0); assert.ok(Math.abs(k("main", t0 + 150_000) - 0.5) < 1e-9);
  assert.equal(k("main", t0 + 300_000), 1, "the great hall's are out five minutes after they were set");
  assert.ok(k("yaoshi", t0 + 300_000) < 1 && k("yaoshi", t0 + 360_000) === 1, "the Medicine hall's are out five minutes after its own");
  assert.ok(k("guanyin", t0 + 360_000) < 1 && k("guanyin", t0 + 500_000) === 1, "and the Guanyin hall's after its own");
  assert.equal(burnt(t0 + 10, t0, BURN), 0, "a clock set back never burns less than whole");
  assert.equal(burnt(t0, t0 + 5_000, 5), 1, "?burn=5 burns out in five seconds");
});
