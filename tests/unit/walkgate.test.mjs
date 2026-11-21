// The walk is the visitor's only once no layer covers the picture (#462).
import { test } from "node:test";
import assert from "node:assert/strict";
import { walkIsHis } from "../../app/src/walkgate.js";

const set = (...c) => ({ contains: (x) => c.includes(x) });
const his = (body, html = [], openingActive = false) => walkIsHis({ body: set(...body), html: set(...html), openingActive });

test("under the title the walk is not his, before he has stepped in", () => {
  assert.equal(his([]), false);
  assert.equal(his(["entered"]), true);
});

test("while the opening plays it is not his, and it is when it is over", () => {
  assert.equal(his(["entered"], [], true), false);
  assert.equal(his(["entered"], [], false), true);
});

test("under the line a change of language puts up while the page opens again it is not his", () => {
  assert.equal(his(["entered"], ["relang"]), false);
  assert.equal(his(["entered"], []), true);
});

test("under the ink of a crossing from another temple it is not his", () => {
  assert.equal(his(["entered"], ["crossing"]), false);
});

test("each layer holds it alone, and none of them lets go of the others", () => {
  assert.equal(his([], ["relang", "crossing"], true), false);
  assert.equal(his(["entered"], ["relang", "crossing"], true), false);
});

test("under a layer the keys and the stick hand the walk nothing, not even a turn (A and D)", async () => {
  const { heldUnder } = await import("../../app/src/walkgate.js");
  const keys = { f: 1, s: -1, turn: 1 };
  assert.deepEqual(heldUnder(false, keys), { f: 0, s: 0, turn: 0 });
  assert.equal(heldUnder(true, keys), keys, "open, it is the keys' own");
});

test("under a layer R and V are not heard, and every other key is the page's own business", async () => {
  const { viewKeyHeard } = await import("../../app/src/walkgate.js");
  assert.equal(viewKeyHeard(false, "r"), false);
  assert.equal(viewKeyHeard(false, "v"), false);
  assert.equal(viewKeyHeard(false, "h"), true);
  assert.equal(viewKeyHeard(true, "r"), true);
});
