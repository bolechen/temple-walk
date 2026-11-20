// What a visitor sets is kept, and nothing a save can hold is able to break the walk.
import test from "node:test"; import assert from "node:assert/strict";
import { createSettings, sanitize, DEFAULTS } from "../../app/src/settings.js";

const mem = (text = null) => { const m = { text, get: () => m.text, set: (t) => { m.text = t; } }; return m; };
test("a new visitor gets the defaults", () => { assert.deepEqual(createSettings(mem()).get(), { ...DEFAULTS }); });
test("what is set is kept for next time", () => {
  const m = mem(), a = createSettings(m); a.set("sens", 1.6); a.set("invertY", true); a.set("quality", "low"); a.set("volume", 0.25);
  assert.deepEqual(createSettings(m).get(), { quality: "low", sens: 1.6, invertY: true, lock: false, autocam: true, fov: 0, thirds: true, blur: false, qr: true, volume: 0.25, music: 0.7, ambience: 0.8, effects: 1 });
});
test("values out of range are brought back into it", () => {
  const s = createSettings(mem()); assert.equal(s.set("sens", 99), 2.5); assert.equal(s.set("sens", -3), 0.3); assert.equal(s.set("volume", 7), 1); assert.equal(s.set("volume", -1), 0);
  for (const k of ["music", "ambience", "effects"]) { assert.equal(s.set(k, 3), 1, k); assert.equal(s.set(k, -2), 0, k); assert.equal(s.set(k, "loud"), DEFAULTS[k], k + ": a word is not a level; the default stands"); }
  assert.equal(s.set("fov", 40), 16); assert.equal(s.set("fov", -40), -6); assert.equal(s.set("fov", 4.4), 4, "the angle moves by whole degrees");
  assert.equal(s.set("quality", "ultra"), "auto", "an unknown tier falls back to the default"); assert.equal(s.set("nonsense", 1), undefined);
});
test("a damaged save is ignored, not thrown on", () => {
  for (const bad of ["{", "null", "[1,2]", '"text"', '{"sens":"fast","volume":null,"quality":7,"invertY":"yes","thirds":"on"}']) assert.deepEqual(createSettings(mem(bad)).get(), { ...DEFAULTS }, bad);
  assert.deepEqual(sanitize({ sens: NaN, volume: Infinity }), { ...DEFAULTS });
});
test("storage that refuses to write does not stop a change", () => {
  const s = createSettings({ get: () => null, set() { throw new Error("full"); } }); assert.equal(s.set("volume", 0.5), 0.5); assert.equal(s.get().volume, 0.5);
});
test("a change is announced", () => { const s = createSettings(mem()), seen = []; s.onChange((all, key) => seen.push([key, all[key]])); s.set("sens", 2); s.set("invertY", true); assert.deepEqual(seen, [["sens", 2], ["invertY", true]]); });

test("the viewfinder's thirds are on until put away, and kept off once put away", () => {
  const m = mem(), a = createSettings(m); assert.equal(a.get().thirds, true);
  a.set("thirds", false); assert.equal(createSettings(m).get().thirds, false);
  a.set("thirds", true); assert.equal(createSettings(m).get().thirds, true);
  // a save from before the thirds were the default carried false without its being chosen: they come on
  assert.equal(createSettings(mem('{"thirds":false,"sens":1.2}')).get().thirds, true);
});

test("the eye goes to each place's own shot unless asked not to, and that is kept", () => {
  const m = mem(), a = createSettings(m); assert.equal(a.get().autocam, true);
  a.set("autocam", false); assert.equal(createSettings(m).get().autocam, false);
  assert.equal(sanitize({ autocam: "no" }).autocam, true, "only a yes or a no is taken");
});

test("the photograph's blur is off until switched on, kept once on, and off for anything damaged (#275)", () => {
  const m = mem(), a = createSettings(m); assert.equal(a.get().blur, false);
  a.set("blur", true); assert.equal(createSettings(m).get().blur, true);
  assert.equal(createSettings(mem('{"sens":1.2}')).get().blur, false);
  assert.equal(createSettings(mem('{"blur":"yes"}')).get().blur, false);
});

test("the QR code on a photograph's card is on until put away, and kept off once put away; a damaged value is on (#319)", () => {
  const m = mem(), a = createSettings(m); assert.equal(a.get().qr, true);
  a.set("qr", false); assert.equal(createSettings(m).get().qr, false);
  a.set("qr", true); assert.equal(createSettings(m).get().qr, true);
  assert.equal(createSettings(mem('{"qr":"no"}')).get().qr, true); assert.equal(createSettings(mem('{"qr":null,"sens":1.2}')).get().qr, true);
});
