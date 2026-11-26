// The floor baked from the drawn meshes (#194, tools/bake-walk.mjs): the grid is had (from the cache or baked) for the
// meshes and the plan as they are now, every named place can be walked to on both walkers, a bake is the same byte for byte
// each time, the trees grow the same each time (their trunks are in what is baked), and a wall across the way is seen.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { readFileSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
const { prepare, staleness, bake, ensure, keyOf, CACHE, FILE } = await import("../../tools/bake-walk.mjs");
const { gather, bakeGrid, cellsOf, oldReach } = await import("../../tools/walk/bake.mjs");
const { buildDrawn, namedMaterials } = await import("../../tools/walk/scene.mjs");
const { compare } = await import("../../tools/walk-diff.mjs");
const { encode, decode, readHeader, cellOf } = await import("../../app/src/walkgrid.js");
const { createTrees } = await import("../../app/src/trees.js");

const prep = prepare(), had = ensure(prep);   // from the cache, or baked here the first time (about a minute)

test("the grid for the place as it is now is had by its fingerprint, and records what it was baked from", () => {
  assert.equal(had.key, keyOf(prep));
  assert.ok(readFileSync(`${CACHE}/t00-${had.key}.bin`).equals(readFileSync(FILE)), "the file built from is the one kept under its fingerprint");
  const st = staleness(prep);
  assert.deepEqual(st.stale, [], st.why); assert.ok(!st.planStale, st.why); assert.ok(!st.gone, st.why);
  const { header } = readHeader(readFileSync(FILE));
  assert.deepEqual(header.grids.map((g) => g.id).sort(), prep.grids.map((g) => g.id).sort(), "the courts and the path, the pavilion's top storey and every room");
  assert.ok(header.grids.some((g) => g.kind === "loft") && header.grids.filter((g) => g.kind === "room").length === prep.drawn.site.halls.length, "a grid for the top storey and one for each hall's room");
});

test("every named place, seat, door and view can be walked to from where he comes in, on the drawn floor and on the written plan", () => {
  const { header } = readHeader(readFileSync(FILE)), kinds = new Set(header.targets.map((t) => t.kind));
  for (const k of ["place", "seat", "door", "view"]) assert.ok(kinds.has(k), `the check asks after every ${k}`);
  assert.equal(header.targets.filter((t) => t.kind === "place").length, Object.keys({ ...prep.drawn.site.places, ...prep.drawn.rooms.places }).length);
  assert.equal(header.targets.filter((t) => t.kind === "view").length, Object.entries(prep.drawn.site.views).filter(([id, v]) => Array.isArray(v) && !(prep.drawn.site.closedViews || []).includes(id)).length);
  const lost = header.targets.filter((t) => !t.new || !t.old);
  assert.deepEqual(lost.map((t) => `${t.kind} ${t.id}: drawn ${t.new}, plan ${t.old}`), []);
});

test("a bake is the same byte for byte each time (the rooms and the pavilion's top storey, baked twice)", () => {
  const small = { ...prep, grids: prep.grids.filter((g) => g.kind !== "outdoors") };
  const a = bake(small, { force: true }).bytes, b = bake(small, { force: true }).bytes;
  assert.equal(Buffer.compare(Buffer.from(a), Buffer.from(b)), 0);
  const back = decode(a, (x) => inflateRawSync(x));
  assert.equal(back.grids.length, small.grids.length);
  for (const g of back.grids) assert.ok(g.state.some((s) => s === 0), `${g.id} has floor he can stand on`);
});

test("the trees grow the same, point for point, each time they are made in Node", () => {
  const grow = () => { const s = new THREE.Scene(); createTrees(s, namedMaterials(), prep.drawn.site.trees, { a2c: false }); s.updateMatrixWorld(true); const out = []; s.traverse((o) => { if (o.isMesh) { out.push(o.geometry.attributes.position.array); if (o.isInstancedMesh) out.push(o.instanceMatrix.array); out.push(o.matrixWorld.elements); } }); return out; };
  const a = grow(), b = grow();
  assert.ok(a.length > 4, "trees are made");
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.deepEqual(Array.from(a[i]), Array.from(b[i]), `part ${i} of the trees differs between two growths`);
  // and so the triangles gathered round them, as the fingerprint sees them
  assert.equal(prepare().grids[0].S.print, prep.grids[0].S.print);
});

test("a wall across the only way makes a place beyond it unreachable, and the comparison says so", () => {
  // A floor 12 m by 4 m, the way in at one end; a wall across it, then without the wall.
  const mat = Object.assign(new THREE.MeshBasicMaterial(), { name: "stone" }), floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 4).rotateX(-Math.PI / 2).translate(6, 0, 2), mat);
  floorMesh.userData.ground = true;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 4.2).translate(6, 1, 2), mat);
  const box = { x0: -0.5, x1: 12.5, z0: -0.5, z1: 4.5, top: 10, bottom: -1 }, seeds = [[1, 2, 0]];
  const make = (roots) => { const s = new THREE.Scene(); for (const r of roots) s.add(r); s.updateMatrixWorld(true); const S = gather([s], box); const g = bakeGrid(S, box, seeds); return { S, g }; };
  const open = make([floorMesh]), shut = make([floorMesh.clone(), wall]);
  const at = (g, x, z) => g.state[cellOf(g, x, z)] === 0;
  assert.ok(at(open.g, 11, 2) && at(open.g, 1, 2), "without the wall the far end is reached");
  assert.ok(at(shut.g, 1, 2) && !at(shut.g, 11, 2), "with it the far end is not");
  assert.ok(!at(shut.g, 6 - 0.2 - 0.2, 2), "and he keeps his reach off the wall");
  // As files, with a place at the far end: the comparison lists it as lost and counts the floor lost beyond the wall.
  const walker = { blocked: () => false, heightAt: () => 0 };
  const file = (g) => { const header = { grids: [{ id: "outdoors", kind: "outdoors", name: "试", x0: g.x0, z0: g.z0, nx: g.nx, nz: g.nz, step: g.step, base: 0, open: 0, oldOpen: 0 }], parts: [{ name: "墙那边", x0: 6, x1: 13, z0: -1, z1: 5 }], targets: [{ kind: "place", id: "far", grid: "outdoors", at: [11, 2], r: 0.5, new: at(g, 11, 2), old: true }] };
    return decode(encode(header, [cellsOf(g, 0, oldReach(walker, g, seeds))], (b) => deflateRawSync(b)), (b) => inflateRawSync(b)); };
  const c = compare(file(open.g), file(shut.g));
  assert.deepEqual(c.lost.map((t) => t.id), ["far"]);
  const row = c.rows.find((r) => r.layer === "画的" && r.part === "墙那边");
  assert.ok(row && row.lost > 15 && row.lost < 24, `6 m by 4 m beyond the wall, less his reach round its edges, is lost (${row && row.lost.toFixed(1)} m²)`);
  assert.deepEqual(compare(file(open.g), file(open.g)).rows, [], "nothing changed, nothing listed");
});

test("his outline the bake keeps the floor off things by is the one measured from his models now", async () => {
  const { outline } = await import("../../tools/edges.mjs"), o = outline();
  const kept = JSON.parse(readFileSync(new URL("../../tools/walk/outline.json", import.meta.url), "utf8"));
  assert.deepEqual(kept.reach, Array.from(o, (v) => +v.toFixed(3)), "run node tools/walk/outline.mjs, then node tools/bake-walk.mjs");
  assert.deepEqual(kept.low, Array.from(o.low, (v) => +v.toFixed(3)));
});

// A bake made under the swap hook (pnpm run test:grid, where a bare import of site.js is the grid's walker) once recorded the
// grid's reach as the written plan's, and walk-diff then reported every hall's floor as changed (#278).
test("the bake asks the written plan's own walker, whatever loader it runs under", async () => {
  const { writtenWalker } = await import("../../tools/bake-walk.mjs"), { createWalker: real } = await import("../../app/src/site.js?real");
  assert.equal(writtenWalker, real);
});
