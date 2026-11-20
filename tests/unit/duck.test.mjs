// The music steps back for the bell (0.18, 14 s), the drum (0.5, 2.5 s), the far bell (0.3, 12 s), a seal's chime and
// so on. A lighter step back inside a deeper one must not lift the music in the middle of the bell, and a deeper one inside
// a lighter must go deeper; the return is wherever the later of them ends (found on #341's review: the year-end night rings
// the near bell all night and the far bell answers every round, always inside the near bell's 14 s).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { duckPlan } = await import("../../app/src/audio.js");
const none = { until: 0, depth: 1 };
test("with nothing held, a step back is what it asks for", () => {
  assert.deepEqual(duckPlan(none, 0.18, 14, 100), { depth: 0.18, until: 114 });
  assert.deepEqual(duckPlan({ until: 50, depth: 0.18 }, 0.5, 2.5, 60), { depth: 0.5, until: 62.5 });   // the old one has ended
});
test("the far bell inside the near bell's stepping back leaves it at 0.18 and the return at the later end", () => {
  const near = duckPlan(none, 0.18, 14, 100), far = duckPlan(near, 0.3, 12, 105);
  assert.equal(far.depth, 0.18); assert.equal(far.until, 117);   // 105 + 12 is later than 114
});
test("the drum inside the near bell's stepping back does not lift it, and does not shorten it", () => {
  const near = duckPlan(none, 0.18, 14, 100), drum = duckPlan(near, 0.5, 2.5, 101);
  assert.equal(drum.depth, 0.18); assert.equal(drum.until, 114);
});
test("a deeper step back inside a lighter one goes deeper", () => {
  const far = duckPlan(none, 0.3, 12, 100), near = duckPlan(far, 0.18, 14, 103);
  assert.equal(near.depth, 0.18); assert.equal(near.until, 117);
});
