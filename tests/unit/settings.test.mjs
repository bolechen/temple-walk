// What a visitor sets is kept, and nothing a save can hold is able to break the walk.
import test from "node:test"; import assert from "node:assert/strict";
import { createSettings, sanitize, DEFAULTS } from "../../app/src/settings.js";

const mem = (text = null) => { const m = { text, get: () => m.text, set: (t) => { m.text = t; } }; return m; };
test("a new visitor gets the defaults", () => { assert.deepEqual(createSettings(mem()).get(), { ...DEFAULTS }); });
test("what is set is kept for next time", () => {
  const m = mem(), a = createSettings(m); a.set("sens", 1.6); a.set("invertY", true); a.set("quality", "low"); a.set("volume", 0.25);
  assert.deepEqual(createSettings(m).get(), { quality: "low", sens: 1.6, invertY: true, volume: 0.25 });
});
test("values out of range are brought back into it", () => {
  const s = createSettings(mem()); assert.equal(s.set("sens", 99), 2.5); assert.equal(s.set("sens", -3), 0.3); assert.equal(s.set("volume", 7), 1); assert.equal(s.set("volume", -1), 0);
  assert.equal(s.set("quality", "ultra"), "auto", "an unknown tier falls back to the default"); assert.equal(s.set("nonsense", 1), undefined);
});
test("a damaged save is ignored, not thrown on", () => {
  for (const bad of ["{", "null", "[1,2]", '"text"', '{"sens":"fast","volume":null,"quality":7,"invertY":"yes"}']) assert.deepEqual(createSettings(mem(bad)).get(), { ...DEFAULTS }, bad);
  assert.deepEqual(sanitize({ sens: NaN, volume: Infinity }), { ...DEFAULTS });
});
test("storage that refuses to write does not stop a change", () => {
  const s = createSettings({ get: () => null, set() { throw new Error("full"); } }); assert.equal(s.set("volume", 0.5), 0.5); assert.equal(s.get().volume, 0.5);
});
test("a change is announced", () => { const s = createSettings(mem()), seen = []; s.onChange((all, key) => seen.push([key, all[key]])); s.set("sens", 2); s.set("invertY", true); assert.deepEqual(seen, [["sens", 2], ["invertY", true]]); });
