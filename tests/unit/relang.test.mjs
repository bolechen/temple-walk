// A change of language in the pause menu hands the visit across the reload (#140, src/relang.js): read once, kept only
// a few minutes, for the language it was meant for, and every field checked on the way in.
import test from "node:test"; import assert from "node:assert/strict";
import { RELANG_KEY, RELANG_FRESH, sanitizeRelang, keepRelang, peekRelang, takeRelang } from "../../app/src/relang.js";

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const NOW = 1_800_000_000_000;
const visit = { x: 1.25, z: -6.5, yaw: 0.4, pitch: -0.1, view: "first", reach: 4.2, dist: 3.6, hall: "main", up: null, season: "autumn", time: "dusk", follow: false, from: "zh", to: "en", at: NOW };

test("what is handed over comes back field for field, for the language it was meant for", () => {
  assert.deepEqual(sanitizeRelang(visit, { now: NOW + 5000, lang: "en" }), { ...visit });
  assert.equal(sanitizeRelang(visit, { now: NOW, lang: "ja" }), null, "another language's page does not take it");
});

test("a handover keeps a few minutes, not longer", () => {
  assert.ok(sanitizeRelang(visit, { now: NOW + RELANG_FRESH - 1, lang: "en" }));
  assert.equal(sanitizeRelang(visit, { now: NOW + RELANG_FRESH + 1, lang: "en" }), null);
});

test("a damaged handover is not taken, and a damaged field falls back", () => {
  for (const bad of [null, 7, "x", { ...visit, x: NaN }, { ...visit, z: 1e9 }, { ...visit, to: "fr" }, { ...visit, at: "now" }]) assert.equal(sanitizeRelang(bad, { now: NOW }), null, JSON.stringify(bad));
  const s = sanitizeRelang({ ...visit, view: "sideways", hall: "../x", up: 3, season: "monsoon", time: 9, reach: -1, pitch: 9 }, { now: NOW });
  assert.deepEqual([s.view, s.hall, s.up, s.season, s.time, s.reach, s.pitch], ["third", null, null, null, null, null, 0]);
});

test("it is read once: taken and forgotten; a look does not take it", () => {
  const st = store();
  assert.ok(keepRelang(st, visit));
  assert.ok(peekRelang(st, { now: NOW, lang: "en" }), "the first script only looks");
  assert.ok(st.m.has(RELANG_KEY));
  assert.deepEqual(takeRelang(st, { now: NOW, lang: "en" })?.hall, "main");
  assert.equal(st.m.has(RELANG_KEY), false, "taken, it is gone");
  assert.equal(takeRelang(st, { now: NOW, lang: "en" }), null, "a second reload finds nothing");
  keepRelang(st, visit); assert.equal(takeRelang(st, { now: NOW, lang: "ko" }), null); assert.equal(st.m.has(RELANG_KEY), false, "a handover not meant for this page is still forgotten");
});

test("a storage that refuses (a private window) is no handover and no error", () => {
  const no = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(keepRelang(no, visit), false); assert.equal(peekRelang(no), null); assert.equal(takeRelang(no), null);
});

// #368: how far behind him the eye actually stood is handed over too (the page holds the eye there until the eye's
// hierarchy can answer), separately from how far it would like to stand (`reach`); a bad one is dropped, not guessed.
test("the eye's own distance is handed over, and a bad one is dropped", () => {
  assert.equal(sanitizeRelang({ ...visit, dist: 6.03 }, { now: NOW, lang: "en" }).dist, 6.03);
  for (const bad of [-1, "far", Infinity, 99, null, undefined]) assert.equal(sanitizeRelang({ ...visit, dist: bad }, { now: NOW, lang: "en" }).dist, null, String(bad));
  assert.equal(sanitizeRelang({ ...visit, dist: 0 }, { now: NOW, lang: "en" }).dist, 0, "against a wall the eye stands at his shoulder: that is a distance too");
});
