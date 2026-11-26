// T05's part of the debug panel's 「物件」 group (#684): the houses outside the walls and the seven figures, each rebuildable alone. What it holds: that
// a page with the panel open draws the same geometry as one without (only in more parts), that a rebuild replaces only the one it names, that the
// snippets round-trip through the real schemas, and that a snippet pasted back into the plan's own writing gives the geometry the panel drew.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { buildSurround, house, TILE_TONES, WALL_TONES } = await import("../../app/levels/t05/surround.js");
const { buildAltar, buildFigure, benchFigures, FIGURES } = await import("../../app/levels/t05/altar.js");
const { COMPOUND } = await import("../../app/levels/t05/site.js");
const { OBJECT_KINDS, HOUSE_SCHEMA, FIGURE_SCHEMA } = await import("../../app/levels/t05/debug-objects.js");
const { merge } = await import("../../app/src/geo.js");
const { toSnippet, parseSnippet, createObjectsModel, normalizeAll } = await import("../../app/src/objects-debug.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const C = COMPOUND;
const verts = (root, pick) => { let n = 0; root.traverse((o) => { if (o.isMesh && pick(o)) n += o.geometry.attributes.position.count; }); return n; };
const isHouse = (o) => /roofs$|walls$/.test(o.name);
const sum = (g) => g.attributes.position.array.reduce((a, v) => a + v, 0);

test("with the panel open every house is a part of its own, with the same geometry as the merged draw", () => {
  const plain = buildSurround(M, C), bench = buildSurround(M, C, { bench: true }), list = bench.userData.houses.list;
  assert.equal(plain.userData.houses, undefined, "a page without the panel carries no hooks");
  assert.ok(list.length > 20, `${list.length} houses`);
  assert.equal(verts(bench, (o) => o.userData.house !== undefined), verts(plain, isHouse), "the same vertices in all the walls and roofs");
  assert.equal(verts(bench, (o) => o.userData.house === undefined), verts(plain, (o) => !isHouse(o)), "the trees are as they were");
  for (const o of bench.children) if (o.userData.house !== undefined) assert.equal(o.userData.keep, true, "kept out of the static merge");
  assert.equal(bench.children.filter((o) => o.userData.house !== undefined && o.castShadow).length, 2 * list.filter((e) => e.h.cast).length, "the near row casts into the sun's map, as it does merged");
});

test("rebuilding a house draws it again and touches no other", () => {
  const bench = buildSurround(M, C, { bench: true }), hook = bench.userData.houses, before = new Map(hook.list.map((e) => [e.id, e.parts.map((m) => m.geometry)]));
  const e = hook.list[3], was = sum(e.parts[0].geometry), wasId = e.h.roof;
  hook.rebuild(e.id, { ridge: e.h.ridge - 0.5, roof: wasId === "hip" ? "gable" : "hip", wall: 2, tone: 0 });
  assert.notEqual(sum(hook.list[3].parts[0].geometry) + sum(hook.list[3].parts[1].geometry), was + sum(before.get(e.id)[1]), "this one changed");
  assert.equal(hook.list[3].parts[0].material, bench.children.find((o) => o.name === `surround-house-${e.id}-walls`).material, "and carries the wall tier asked for");
  for (const o of hook.list) if (o.id !== e.id) o.parts.forEach((m, k) => assert.equal(m.geometry, before.get(o.id)[k], `house ${o.id} left alone`));
  assert.equal(bench.children.filter((o) => o.name === `surround-house-${e.id}-walls`).length, 1, "the old part is gone");
  assert.throws(() => hook.rebuild("nope", {}));
});

test("a house's snippet round-trips through the schema and, written as the plan writes it, draws what the panel drew", () => {
  const hook = buildSurround(M, C, { bench: true }).userData.houses;
  for (const e of hook.list) {
    const { x, z, w, d, alongX, eave, ridge, roof, tone, wall } = e.h, p = { x, z, w, d, alongX, eave, ridge, roof, tone, wall }, text = toSnippet(HOUSE_SCHEMA, p);
    assert.deepEqual(parseSnippet(HOUSE_SCHEMA, text), normalizeAll(HOUSE_SCHEMA, p), text);
    assert.deepEqual(normalizeAll(HOUSE_SCHEMA, p), p, `house ${e.id}: the plan's own numbers are inside the panel's ranges and steps (else a copy would move it)`);
  }
  const e = hook.list[5], m = createObjectsModel(OBJECT_KINDS({ W: { __t05Objects: { houses: hook }, __yard: () => ({ season: "winter", time: "day" }), __mood() {} } }));
  m.select("house", e.id); m.set("w", 8.25); m.set("roof", "hip");
  const text = m.snippet(), pasted = parseSnippet(HOUSE_SCHEMA, text), drawn = { walls: [], roofs: [] }, again = { walls: [], roofs: [] };
  house({ ...e.h }, drawn.walls, drawn.roofs); house({ ...e.h, ...pasted }, again.walls, again.roofs);
  assert.equal(sum(again.roofs[0]), sum(drawn.roofs[0]), "the snippet pasted into the plan draws the panel's house");
  assert.equal(again.roofs[0].attributes.position.count, drawn.roofs[0].attributes.position.count);
});

test("the figures: buildAltar is buildFigure seven times, and the panel's parts hold the same geometry", () => {
  const altar = buildAltar(), flat = FIGURES.map((f) => buildFigure(f));
  assert.equal(altar.parts.clay.length, flat.reduce((n, o) => n + o.clay.length, 0) + altar.kingClay.length);
  assert.equal(altar.parts.halo.length, 7);
  const fg = benchFigures(M, altar, {}), left = fg.group.children.length;
  assert.equal(left, 21, "three meshes to each: the seated mass, the attendants, the halo (the figures of ./figures/ replace the first)"); assert.equal(fg.rest, altar.kingClay);
  assert.equal(fg.list.reduce((n, e) => n + e.parts[0].geometry.attributes.position.count + e.parts[1].geometry.attributes.position.count, 0), flat.reduce((n, o) => n + merge(o.clay).attributes.position.count, 0));
  const other = fg.list.filter((e) => e.id !== "sikhin").map((e) => e.parts.map((m) => m.geometry));
  fg.rebuild("sikhin", { x: 6.4, h: 9, yaw: 0.1 });
  assert.equal(altar.tops.find((t) => t.id === "sikhin").x, 6.4); assert.ok(Math.abs(altar.tops.find((t) => t.id === "sikhin").top - (altar.tops.find((t) => t.id === "vipasyin").top - 9.28 + 9)) < 1e-6);
  assert.equal(altar.attendants.length, 14); assert.equal(fg.group.children.length, 21);
  assert.deepEqual(fg.list.filter((e) => e.id !== "sikhin").map((e) => e.parts.map((m) => m.geometry)), other, "the other six are left alone");
  assert.equal(FIGURES[2].x, 5.8, "the plan's own table is not written to");
  assert.throws(() => fg.rebuild("nobody", {}));
});

test("the figure's turn is written as altar.js writes it, and every figure of the plan is inside the panel's ranges", () => {
  const sak = FIGURES[6], p = { x: sak.x, h: sak.h, yaw: +((sak.yaw / Math.PI) * 180).toFixed(1) };
  assert.equal(toSnippet(FIGURE_SCHEMA, p), "{ x: -16.45, h: 8.6, yaw: (-7 * Math.PI) / 180 }");
  assert.deepEqual(parseSnippet(FIGURE_SCHEMA, toSnippet(FIGURE_SCHEMA, p)), p);
  for (const f of FIGURES) { const q = { x: f.x, h: f.h, yaw: +(((f.yaw || 0) / Math.PI) * 180).toFixed(1) }; assert.deepEqual(normalizeAll(FIGURE_SCHEMA, q), q, f.id); }
});

test("a page without the hooks registers nothing", () => assert.deepEqual(OBJECT_KINDS({ W: {} }), []));
