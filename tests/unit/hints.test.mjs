// What is said about the controls on a touch screen, and when (#185): how to walk on arriving, two fingers once the
// view has first been dragged (or after a long walk without a drag), his own eyes once the eye is first drawn all the way in.
import test from "node:test"; import assert from "node:assert/strict";

// Just enough of a page: the one line at the foot of the view, a coarse pointer, and timers that never fire on their own.
const el = () => ({ innerHTML: "", querySelectorAll: () => [], getClientRects: () => [], classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } } });
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

test("a drag made while the first line still shows is kept: two fingers are told once that line has gone", () => {
  const h = createHints();
  h.say.entered(); h.say.dragged(); assert.equal(h.state().tip, "walk", "the first line is not cut short");
  rest(h); h.step(0.1, 0.5, false, true); assert.equal(h.state().tip, "pinch", "told as soon as the line is free, not after 60 m");
  assert.deepEqual(h.state().said, ["walk", "pinch"]);
});

// The real phone (Pixel 8a, #185, 2026-11-19): the first drag passed over the opening, before the line about walking had
// been said, and two fingers were never told. Then the stick, then two fingers, then his own eyes, in that order.
test("a drag made before the first line, as one that passes over the opening, still brings two fingers after it", () => {
  const h = createHints();
  h.say.dragged(); assert.equal(h.state().tip, null, "nothing is said before the walk is his");
  h.say.entered(); assert.equal(h.state().tip, "walk");
  rest(h); h.step(0.1, 0.2, false, true); assert.equal(h.state().tip, "pinch");
  rest(h); h.say.nearest(); assert.deepEqual(h.state().said, ["walk", "pinch", "eyes"]);
});

test("a visitor whose two fingers have already moved the eye is not told of two fingers", () => {
  const h = createHints();
  h.say.dragged(); h.say.pinched(); h.say.entered(); rest(h); h.step(0.1, 80, false, true);
  assert.ok(!h.state().said.includes("pinch"), "they know: " + JSON.stringify(h.state().said));
});

// The far view's line stays until it is released (#147): no other tip takes the line while it is held, and none is lost —
// a tip refused is not marked said, so it is told when its moment comes again.
test("the line held at the foot of the far view is not taken by another tip, and the tip is not lost", () => {
  const h = createHints();
  h.say.entered(); rest(h);
  h.hold("far line"); assert.equal(h.state().tip, "hold");
  h.say.seal(); h.say.held(); h.say.upView(); h.say.nearest(); h.say.dragged(); h.step(0.1, 50, false, true);
  assert.equal(h.state().tip, "hold", "a tip took the held line");
  assert.ok(page.hint.innerHTML.includes("far line") && !page.hint.innerHTML.includes("小印"), "the held words were replaced: " + page.hint.innerHTML);
  assert.ok(["book", "held", "upView", "eyes", "pinch", "jump"].every((id) => !h.state().said.includes(id)), "a tip refused was counted as said: " + h.state().said);
  h.release(); h.say.seal(); assert.equal(h.state().tip, "book", "after the line is released the tip is told");
});

test("a first visitor is told once, after the line about walking has gone, that a small thing done at a place is stamped (#445)", () => {
  const h = createHints();
  h.say.entered(); h.step(0.1, 3, false, true); assert.equal(h.state().tip, "walk", "the line about walking is up first");
  h.step(0.1, 4, false, true); assert.equal(h.state().tip, "stamp", "once it has gone, the line about the seals");
  assert.ok(/朱印/.test(page.hint.innerHTML) && !/七/.test(page.hint.innerHTML), "it names the seal and no number: " + page.hint.innerHTML);
  rest(h); h.step(0.1, 1, false, true); assert.notEqual(h.state().tip, "stamp", "said once");
});

test("a visitor who already holds a seal is not told what they know", () => {
  const h = createHints();
  h.say.stamped(); h.say.entered(); rest(h); h.step(0.1, 10, false, true);
  assert.ok(!h.state().said.includes("stamp") || h.state().tip !== "stamp", "no line about stamps");
  assert.notEqual(h.state().tip, "stamp");
});

// #770 items 1 and 2: a level with no book of seals (T05's first edition) is told nothing about stamps or the book; the prologue still is.
test("with no book of seals, the line about a stamp and the line about the book are never said; with one, they are", () => {
  const h = createHints({ book: false });
  h.say.entered(); rest(h); h.step(0.1, 5, false, true);
  assert.ok(!h.state().said.includes("book") && page.hint.innerHTML.indexOf("朱印") < 0, "no stamp line after 5 m: " + page.hint.innerHTML);
  h.say.seal(); assert.notEqual(h.state().tip, "book", "no line about the book");
  const t00 = createHints(); t00.say.entered(); rest(t00); t00.step(0.1, 5, false, true);
  assert.equal(t00.state().tip, "stamp", "the prologue says it as before"); assert.ok(page.hint.innerHTML.includes("朱印"));
});
