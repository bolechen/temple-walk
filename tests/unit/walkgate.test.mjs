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
