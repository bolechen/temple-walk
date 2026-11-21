// The probe level (app/levels/_probe, docs/t05/LEVEL-SPLIT.md S7) is one open pavilion on a flat plot, and shows that the
// engine asks a level for what it needs and a temple for nothing: the plan is walked, flooded, closed at its edges, and the
// level says no to everything that is the prologue's (a kept place, an opening, a title, music zones).
import "./dom-stub.mjs";
import test from "node:test"; import assert from "node:assert/strict";
import * as THREE from "three";
import { loadLevel } from "../../app/src/level.js";
import { zoneOf } from "../../app/src/score.js";
import { placeKept } from "../../app/src/resume.js";
import { openingFor } from "../../app/src/opening.js";
import { PLOT } from "../../app/levels/_probe/site.js";

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const L = await loadLevel("_probe"), site = L.build(M), walker = L.createWalker(site);

test("the level says nothing of the prologue's things", () => {
  assert.equal(L.id, "_probe");
  for (const k of ["keepsPlace", "opening", "title"]) assert.ok(!L[k], k);
  assert.equal(L.backdrop, null); assert.equal(L.grove, null);
  assert.equal(placeKept(new URLSearchParams(""), false, L), false);
  assert.deepEqual(openingFor({ seals: 0, place: null, start: site.start, params: new URLSearchParams(""), level: L }), { eye: "none", bell: false });
});

test("the plot has no music zones of its own, and the bamboo's sound is silent", () => {
  assert.equal(L.zones, null);
  for (let x = -PLOT.x; x <= PLOT.x; x += 5) for (let z = PLOT.zN; z <= PLOT.zS; z += 5) assert.equal(zoneOf(x, z, false, L.zones), "none", `(${x}, ${z})`);
  assert.equal(L.groveSound(0, 30), 0);
});

test("the place named can be walked to from the first step, and the pavilion's floor is stood on", () => {
  const STEP = 0.25, key = (i, j) => i + "," + j, seen = new Set(), todo = [[Math.round(site.start[0] / STEP), Math.round(site.start[1] / STEP)]];
  while (todo.length) {
    const [i, j] = todo.pop(), k = key(i, j); if (seen.has(k) || walker.blocked(i * STEP, j * STEP)) continue; seen.add(k);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) todo.push([i + a, j + b]);
  }
  const reached = (x, z) => seen.has(key(Math.round(x / STEP), Math.round(z / STEP)));
  assert.ok(!walker.blocked(...site.start), "the start is open");
  const p = site.places.pavilion; assert.ok(reached(p.at[0], p.at[1]), "the named place is reached");
  assert.ok(reached(0, -8), "the pavilion's middle is reached over its steps");
  assert.ok(walker.heightAt(0, -8) > 0.25, "its floor is raised");
  for (const [name, [x, z]] of Object.entries(site.views)) assert.ok(reached(x, z), `view ${name} stands on walkable ground`);
});

test("the plot is closed on every side, and the columns stop him", () => {
  for (let x = -PLOT.x - 2; x <= PLOT.x + 2; x += 2) for (const z of [PLOT.zN - 0.5, PLOT.zS + 0.5]) assert.ok(walker.blocked(x, z), `open at (${x}, ${z})`);
  for (let z = PLOT.zN; z <= PLOT.zS; z += 2) for (const x of [-PLOT.x - 0.5, PLOT.x + 0.5]) assert.ok(walker.blocked(x, z), `open at (${x}, ${z})`);
  const col = site.walk.posts[0];
  assert.ok(col && walker.blocked((col.x0 + col.x1) / 2, (col.z0 + col.z1) / 2), "a column stands in his way");
});

test("one pavilion and one named place", () => {
  assert.equal(site.buildings.length, 1); assert.deepEqual(Object.keys(site.places), ["pavilion"]);
  assert.equal(site.halls.length, 0); assert.equal(Object.keys(site.lofts).length, 0);
});
