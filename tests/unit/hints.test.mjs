// What is said about the controls on a touch screen, and when (#185): how to walk on arriving, two fingers once the
// view has first been dragged (or after a long walk without a drag), his own eyes once the eye is first drawn all the way in.
import test from "node:test"; import assert from "node:assert/strict";

// Just enough of a page: the one line at the foot of the view, a coarse pointer, and timers that never fire on their own.
const el = () => ({ innerHTML: "", classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } } });
const page = { hint: el(), moodTag: el(), goal: el(), keys: el() };
globalThis.document = { getElementById: (id) => page[id] || null, body: el() };
globalThis.matchMedia = (q) => ({ matches: q.includes("coarse") });
globalThis.addEventListener = () => {};
const { createHints } = await import("../../app/src/hints.js");
const rest = (h) => h.drop();   // the line in sight has faded

test("on a touch screen the controls are told one at a time, as the hand comes to them", () => {
  const h = createHints();
  h.say.entered(); assert.equal(h.state().tip, "walk", "arriving says how to walk");
  assert.ok(!page.hint.innerHTML.includes("双指"), "arriving does not yet speak of two fingers: " + page.hint.innerHTML);
  rest(h); h.say.dragged(); assert.equal(h.state().tip, "pinch", "the first drag brings two fingers");
  rest(h); h.say.nearest(); assert.equal(h.state().tip, "eyes", "the eye drawn all the way in brings his own eyes");
  assert.deepEqual(h.state().said, ["walk", "pinch", "eyes"]);
});

test("a visitor who never drags is told of two fingers after a good stretch of the path", () => {
  const h = createHints();
  h.say.entered(); rest(h);
  h.step(0.1, 30, false, true); assert.ok(!h.state().said.includes("pinch"), "not after 30 m");
  h.step(0.1, 35, false, true); assert.equal(h.state().tip, "jump", "the jump ring is told first, at 40 m");
  h.step(0.1, 1, false, true); assert.equal(h.state().tip, "jump", "two fingers wait while another line speaks");
  rest(h); h.step(0.1, 1, false, true); assert.equal(h.state().tip, "pinch", "then, past 60 m without a drag, two fingers");
});

test("a visitor who has dragged is not told again on the path", () => {
  const h = createHints();
  h.say.entered(); h.say.dragged();   // dragged while the first line still showed: two fingers wait
  rest(h); h.step(0.1, 80, false, true); assert.ok(!h.state().said.includes("pinch"), "a drag means the fallback is not needed");
});
