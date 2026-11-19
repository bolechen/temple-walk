import test from "node:test";
import assert from "node:assert/strict";
import { track, withLang } from "../../app/src/analytics.js";

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
  assert.deepEqual(calls, [["demo.enter", { lang: "zh", resumed: "1", seals: "2", tier: "low" }]], "every event carries the language; in Node that is Chinese");
  restore();
});

test("every event says which language it was read in, and an event's own data does not lose it", () => {
  assert.deepEqual(withLang({ id: "bell" }, "ja"), { lang: "ja", id: "bell" });
  assert.deepEqual(withLang(undefined, "ko"), { lang: "ko" });
  assert.deepEqual(withLang({ tier: "low" }, "en"), { lang: "en", tier: "low" });
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

test("an event is remembered for the tests even where it is not sent", () => {
  const restore = page("127.0.0.1", { track() { throw new Error("not reached"); } });
  assert.equal(track("demo.hall", { id: "main", count: 1 }), false);
  const last = (globalThis.__events || []).at(-1);
  assert.equal(last.name, "demo.hall");
  assert.deepEqual(last.data, { lang: "zh", id: "main", count: 1 });
  delete globalThis.__events;
  restore();
});
