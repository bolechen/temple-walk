import test from "node:test";
import assert from "node:assert/strict";
import { track } from "../../app/src/analytics.js";

function page(hostname, umami) {
  const previousLocation = globalThis.location, previousWindow = globalThis.window;
  globalThis.location = /** @type {Location} */ ({ hostname });
  globalThis.window = /** @type {Window & typeof globalThis} */ ({ umami });
  return () => { globalThis.location = previousLocation; globalThis.window = previousWindow; };
}

test("public milestones reach Umami as short strings", () => {
  const calls = [];
  const restore = page("temple.rushiwowen.co", { track: (...args) => calls.push(args) });
  assert.equal(track("demo.enter", { resumed: true, seals: 2, tier: "low", empty: "" }), true);
  assert.deepEqual(calls, [["demo.enter", { resumed: "1", seals: "2", tier: "low" }]]);
  restore();
});

test("previews, tests and a missing tracker stay silent", () => {
  const calls = [];
  let restore = page("127.0.0.1", { track: (...args) => calls.push(args) });
  assert.equal(track("demo.ready", { tier: "high" }), false);
  restore();
  restore = page("temple.rushiwowen.co", {});
  assert.equal(track("demo.seal", { id: "bell" }), false);
  restore();
  restore = page("temple.rushiwowen.co", { track() { throw new Error("blocked"); } });
  assert.equal(track("demo.ending", { skipped: false }), false);
  restore();
  assert.deepEqual(calls, []);
});
