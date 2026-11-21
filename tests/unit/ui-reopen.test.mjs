// Esc puts the book away and B opens it again a few milliseconds later: the browser's own "close" event for the first
// shutting, which a <dialog> sends a task after close(), must not put away the book that was opened in between (#379, the
// `layers` scenario on a card that draws sixty frames a second: Esc, B and the event all fell inside one hundred milliseconds).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";

const fakeDialog = (id) => {
  const on = {}, el = { id, tagName: "DIALOG", open: false, hidden: true, tabIndex: -1, isConnected: true, offsetParent: {},
    hasAttribute: () => true, contains: () => false, focus() {}, blur() {},
    addEventListener(k, fn) { (on[k] ||= []).push(fn); }, removeEventListener() {},
    showModal() { el.open = true; },
    // close() shuts it now and tells it later, as a browser does
    close() { if (!el.open) return; el.open = false; setTimeout(() => (on.close || []).forEach((fn) => fn({ target: el })), 5); } };
  return el;
};

test("a sheet opened again before the browser's close event for its last shutting stays open", async () => {
  const book = fakeDialog("book"), els = { book };
  globalThis.document = { getElementById: (id) => els[id] || null, activeElement: null, exitPointerLock() {}, body: {} };
  const { createUI } = await import("../../app/src/ui.js");
  const ui = createUI(); ui.layer("book");
  ui.open("book"); assert.deepEqual(ui.state(), ["book"]);
  ui.close("book"); assert.deepEqual(ui.state(), []);
  ui.open("book"); assert.deepEqual(ui.state(), ["book"], "opened again at once");
  await new Promise((r) => setTimeout(r, 30));   // the event for the first shutting arrives
  assert.deepEqual(ui.state(), ["book"], "the late close event put the new opening away");
  assert.equal(book.open, true);
});

test("a sheet the browser shut by itself is still taken off the stack", async () => {
  const book = fakeDialog("book"), els = { book };
  globalThis.document = { getElementById: (id) => els[id] || null, activeElement: null, exitPointerLock() {}, body: {} };
  const { createUI } = await import("../../app/src/ui.js?second");
  const ui = createUI(); ui.layer("book");
  ui.open("book"); book.close();   // not through ui.close()
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(ui.state(), [], "a close the browser made on its own must still close the layer");
});
