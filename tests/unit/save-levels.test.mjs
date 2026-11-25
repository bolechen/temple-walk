// A level other than the prologue keeps its own place under yunjing.levels.v1 and leaves the prologue's ten keys alone (S4).
import test from "node:test"; import assert from "node:assert/strict";
import { LEVELS_KEY, readLevels, readLevelPlace, writeLevelPlace, clearLevelPlace, sanitizeLevelPlace } from "../../app/src/levelsave.js";
import { readPlace, writePlace, PLACE_KEY, placeKept } from "../../app/src/resume.js";
import { SAVE_KEYS } from "../../app/src/carry.js";

const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
// A T00 save as the page wrote it, with the oldest shapes: a place with no hall, a number alone for the incense.
const OLD = {
  "yunjing.journey.v1": '{"v":1,"born":1795000000000,"seals":{"bell":1795000100000},"strikes":3,"verse":null,"done":null,"opened":null,"told":false}',
  "yunjing.place.v1": '{"x":12.5,"z":30.1,"yaw":0.4,"label":"钟楼","at":1795233520952}',
  "yunjing.incense.v1": "1795233520952",
  "yunjing.settings.v1": '{"fov":5}', "yunjing.lang.v1": "en", "yunjing.visit.v1": '{"metres":812,"seconds":640}',
  "yunjing.prologue.v1": "1", "yunjing.pilgrimage.v1": '{"v":1,"levels":{}}', "yunjing.ending.v1": "1795233000000",
};
const snapshot = (s) => JSON.stringify([...s.m.entries()].filter(([k]) => k !== LEVELS_KEY).sort());

test("T05's place is kept under its own key; the prologue's keys do not move by a byte", () => {
  const s = store(OLD), before = snapshot(s);
  assert.equal(readLevelPlace(s, "t05"), null);
  assert.ok(writeLevelPlace(s, "t05", { x: 1.234, z: 88.8, yaw: 3.14159, at: 9 }));
  assert.deepEqual(readLevelPlace(s, "t05"), { x: 1.23, z: 88.8, yaw: 3.142, at: 9 });
  assert.equal(snapshot(s), before, "every key but yunjing.levels.v1 is exactly as it was");
  clearLevelPlace(s, "t05"); assert.equal(readLevelPlace(s, "t05"), null);
  assert.equal(snapshot(s), before);
  assert.deepEqual(readPlace(s), { x: 12.5, z: 30.1, yaw: 0.4, label: "钟楼", at: 1795233520952, up: null, hall: null }, "the prologue still reads its old place");
});
test("the levels key never carries a prologue key, and the prologue's writes never touch it", () => {
  const s = store({ [LEVELS_KEY]: "KEEP" }); writePlace(s, { x: 1, z: 2 }); assert.equal(s.getItem(LEVELS_KEY), "KEEP");
  assert.ok(!writeLevelPlace(store(), "t00", { x: 1, z: 2 }), "t00 is never kept here");
  assert.ok(!writeLevelPlace(store(), "_probe", { x: 1, z: 2 }) && !writeLevelPlace(store(), "../x", { x: 1, z: 2 }));
  assert.equal(readLevelPlace(store({ [LEVELS_KEY]: JSON.stringify({ v: 1, last: "t00", place: { t00: { x: 1, z: 2 } } }) }), "t00"), null);
});
test("one level's record does not disturb another's, and a damaged or newer save is ignored", () => {
  const s = store(); writeLevelPlace(s, "t05", { x: 1, z: 2, at: 1 }); writeLevelPlace(s, "t07", { x: 3, z: 4, at: 2 });
  assert.equal(readLevels(s).last, "t07"); clearLevelPlace(s, "t07");
  assert.deepEqual(readLevelPlace(s, "t05"), { x: 1, z: 2, yaw: 0, at: 1 }); assert.equal(readLevels(s).last, null);
  for (const bad of ["", "{", "null", "[]", '{"v":2,"place":{"t05":{"x":1,"z":2}}}', '{"v":1}', '{"v":1,"place":[]}', '{"v":1,"place":{"t05":{"x":"1","z":2}}}', '{"v":1,"place":{"t05":{"x":1e9,"z":2}}}'])
    { s.setItem(LEVELS_KEY, bad); assert.equal(readLevelPlace(s, "t05"), null, bad); assert.doesNotThrow(() => readLevels(s)); }
  assert.equal(readLevels({ getItem() { throw new Error("no storage"); } }).last, null);
  assert.equal(writeLevelPlace({ getItem: () => null, setItem() { throw new Error("full"); } }, "t05", { x: 1, z: 2 }), false);
  assert.equal(sanitizeLevelPlace({ x: 1, z: 2, yaw: "n" }).yaw, 0);
});
test("only a level that keeps a place of its own is read and written, and only at its address's say-so", () => {
  const p = new URLSearchParams("level=t05");
  assert.equal(placeKept(p, false, { keepsPlace: false }), false, "a level that keeps nothing keeps nothing");
  assert.equal(placeKept(p, false, { keepsPlace: false, keepsOwnPlace: true }), true);
  assert.equal(placeKept(new URLSearchParams("level=t05&cam=0,0,0,0"), false, { keepsOwnPlace: true }), false, "an address that names a place keeps none");
  assert.equal(placeKept(new URLSearchParams(""), false, null), true, "the prologue as before");
  assert.equal(PLACE_KEY, "yunjing.place.v1");
});
