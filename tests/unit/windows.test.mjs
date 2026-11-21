// Which windows are lit at dusk and at night is the level's data (app/levels/t00/windows.js, #459): a few at dusk, more
// at night, never all, the same every time, and no two neighbours alike.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { readFileSync } from "node:fs";
const { buildSite } = await import("../../app/src/site.js");
const { LIT, BUDGET } = await import("../../app/levels/t00/windows.js");
const { moodOf, SEASONS, TIMES } = await import("../../app/src/mood.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const windows = () => buildSite(M).litWindows;
const lit = (ws, col) => ws.filter((w) => w[col] > 0);

test("a few bays are lit at dusk, more at night, and never all of them", () => {
  const ws = windows(), dusk = lit(ws, "dusk").length, night = lit(ws, "night").length;
  assert.ok(dusk > 0 && dusk <= BUDGET.dusk, `${dusk} lit at dusk, the budget is ${BUDGET.dusk}`);
  assert.ok(night >= dusk && night <= BUDGET.night, `${night} lit at night, the budget is ${BUDGET.night}`);
  assert.ok(dusk <= ws.length / 3 && night < ws.length / 2, `${dusk} / ${night} of ${ws.length} bays`);
});
test("the great hall and the Guanyin hall are lit at dusk, and every other lit one is dark in some of its bays", () => {
  const ws = windows();
  for (const id of ["main", "guanyin"]) assert.ok(lit(ws, "dusk").some((w) => w.building === id), `${id} is dark at dusk`);
  for (const id of new Set(ws.map((w) => w.building))) { const mine = ws.filter((w) => w.building === id); assert.ok(lit(mine, "dusk").length < mine.length, `${id}: every bay lit at dusk`); }
});
test("what is lit is the data: every key names a building and every bay it names exists", () => {
  const ws = windows(), have = new Set(ws.map((w) => `${w.building}|${w.face}|${w.bay}`));
  for (const [key, faces] of Object.entries(LIT)) for (const [face, bays] of Object.entries(faces)) for (const [bay, [d, n]] of Object.entries(bays)) {
    assert.ok(have.has(`${key}|${face}|${bay}`), `${key} ${face} bay ${bay} is not a lattice bay`);
    assert.ok(Number.isInteger(d) && Number.isInteger(n) && d >= 0 && d <= 7 && n >= 0 && n <= 7, `${key} ${face} ${bay}: levels 0..7`);
  }
});
test("two lit neighbours differ by at least two levels, and the same plan gives the same windows", () => {
  const a = windows(), b = windows();
  assert.deepEqual(a.map((w) => [w.building, w.face, w.bay, w.dusk, w.night]), b.map((w) => [w.building, w.face, w.bay, w.dusk, w.night]));
  for (const col of ["dusk", "night"]) for (const w of a) { const next = a.find((v) => v.building === w.building && v.face === w.face && v.bay === w.bay + 1); if (next && w[col] && next[col]) assert.ok(Math.abs(w[col] - next[col]) >= 2, `${w.building} bays ${w.bay}, ${next.bay} at ${col}`); }
});
test("each hour says which column the lattice shows: night the night one, the rest the dusk one", () => {
  for (const s of SEASONS) for (const t of TIMES) assert.equal(moodOf(s, t).winNight, t === "night" ? 1 : 0, `${s} ${t}`);
});
test("the lamplight is a muted #C68C49, not a saturated orange", () => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), sat = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
  const pal = [0xc6, 0x8c, 0x49].map((v) => lin(v / 255)); const srgb = (c) => c.map((v) => 1.055 * v ** (1 / 2.4) - 0.055);
  for (const s of SEASONS) for (const t of ["dawn", "dusk", "night"]) { const w = moodOf(s, t).win; assert.ok(sat(srgb(w)) <= sat(srgb(pal)) + 0.03, `${s} ${t}: saturation ${sat(srgb(w)).toFixed(2)}`); assert.ok(Math.max(...w) <= 0.7, `${s} ${t}: too bright`); }
});
test("the shader reads the code the building writes: sixteen to a leaf, dusk level times eight plus night level", () => {
  const sh = readFileSync(new URL("../../app/src/materials.js", import.meta.url), "utf8"), b = readFileSync(new URL("../../app/src/building.js", import.meta.url), "utf8");
  assert.match(sh, /code=floor\(\(vUv2\.x\+4\.\)\/16\.\)/); assert.match(b, /code = lit\[0\] \* 8 \+ lit\[1\]/); assert.match(b, /\* n \+ code \* 16/);
});
