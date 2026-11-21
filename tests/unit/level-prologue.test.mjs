// A level other than the prologue leaves the prologue's own things alone (#385): it neither reads nor writes the place
// the prologue keeps (yunjing.place.v1), plays no opening, and raises no prologue title. The prologue keeps all three,
// as every page did before levels.
import "./dom-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { placeKept } from "../../app/src/resume.js";
import { openingFor } from "../../app/src/opening.js";
import { loadLevel } from "../../app/src/level.js";

const q = (s) => new URLSearchParams(s), start = [0, 96];
const other = { id: "other" };   // a level that says nothing of the three
const fresh = { seals: 0, place: null, start };

test("the prologue says it keeps a place, plays its opening and raises its title", async () => {
  const L = await loadLevel("t00");
  assert.equal(L.keepsPlace, true);
  assert.equal(L.opening, true);
  assert.equal(L.title, true);
});

test("only a level that keeps a place reads and writes it", async () => {
  const t00 = await loadLevel("t00");
  for (const level of [null, t00]) {
    assert.equal(placeKept(q(""), false, level), true);
    assert.equal(placeKept(q("level=t00"), false, level), true);
    for (const k of ["cam=1,2,0,0", "show=gate", "shot=1", "in=main", "tour=120x3", "enter"]) assert.equal(placeKept(q(k), false, level), false, k);
    assert.equal(placeKept(q("at=bell"), true, level), false, "a workbench address that names a place");
    assert.equal(placeKept(q("at=bell"), false, level), true, "the published site ignores the workbench's addresses");
  }
  assert.equal(placeKept(q(""), false, other), false, "a level that does not say so keeps nothing");
  assert.equal(placeKept(q(""), false, { ...other, keepsPlace: false }), false);
  assert.equal(placeKept(q(""), false, { ...other, keepsPlace: true }), true);
});

test("only a level that has the opening plays it", async () => {
  const t00 = await loadLevel("t00");
  const cases = [
    [fresh, ""], [{ ...fresh, seals: 1 }, ""], [{ ...fresh, place: { x: 0, z: 20 } }, ""], [fresh, "cam=1,2,0,0"],
    [{ ...fresh, again: true, seals: 3 }, ""], [{ ...fresh, autocam: false }, ""], [{ ...fresh, reduced: true }, ""],
  ];
  for (const [o, s] of cases) {
    const before = openingFor({ ...o, params: q(s) });
    assert.deepEqual(openingFor({ ...o, params: q(s), level: t00 }), before, `the prologue as before: ${JSON.stringify(o)} ${s}`);
    assert.deepEqual(openingFor({ ...o, params: q(s), level: other }), { eye: "none", bell: false }, `another level: ${JSON.stringify(o)} ${s}`);
  }
  assert.deepEqual(openingFor({ ...fresh, params: q(""), level: t00 }), { eye: "fly", bell: true }, "a first visitor to the prologue is shown the mountain");
});
