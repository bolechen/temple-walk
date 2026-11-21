// T05's three buildings on the axis, as shells (docs/t05/PLAN.md item 9, issue #446): the outer gate, the inner gate and the Wuliang
// hall, each `buildHall` with its parameters. What is asked: that each stands on its platform where axis.js says, that he walks
// through each by its passage (on the floor baked from what is drawn and on the written plan, to the same heights, over steps with
// even treads), that the rooms either side of a passage are shut, that the passage is wide enough for his body and the eye behind him, and
// that the shells are not heavy.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { inflateRawSync } from "node:zlib";
const T05 = await import("../../app/levels/t05/site.js");
const AX = await import("../../app/levels/t05/axis.js");
const { buildSite, createWalker } = T05;
const { AXIS, GATE, HALL, FOOT, SECOND } = AX;
const { loadLevel } = await import("../../app/src/level.js");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { stairProfile, BODY } = await import("../../app/src/geo.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const level = await loadLevel("t05"), site = buildSite(M);
const file = ensure(prepare(level)), decoded = decode(file.bytes, (b) => inflateRawSync(b));
const old = createWalker(site), grid = createGridWalker(createWalker(site), gridsByPlace(decoded), { doors: site.halls });
const both = [["plan", old], ["grid", grid]];
const near = (a, b, tol = 0.03) => Math.abs(a - b) <= tol;
const thing = (name) => site.buildings.find((b) => b.name === name);

test("each building is registered where the axis table puts it, and none of them is a hall he goes into", () => {
  const outer = thing("外山门"), inner = thing("内山门"), hall = thing("无量殿");
  assert.ok(outer && inner && hall);
  assert.ok(near((outer.z0 + outer.z1) / 2, AXIS.outerZ, 1e-6) && near((inner.z0 + inner.z1) / 2, AXIS.innerZ, 1e-6) && near((hall.z0 + hall.z1) / 2, AXIS.hallZ, 1e-6));
  assert.ok(near(inner.x1, FOOT.inner.x1, 1e-6) && near(hall.x1, FOOT.hall.x1, 1e-6) && near(inner.z0, FOOT.inner.z0, 1e-6) && near(hall.z0, FOOT.hall.z0, 1e-6));
  assert.ok(near(outer.x1, GATE.xs[3] + GATE.platOut, 1e-6), "the outer gate's platform is as wide as the inner one's");
  assert.deepEqual(site.halls, [], "no room under the court: he walks through, he does not go in");
  assert.equal(site.walk.roofs.length, 3, "each building's roof is told to the eye and to the snow");
});

test("he walks through each by its passage, on both floors, to the same heights: 0 → +0.5 → 0, 0 → +1.0 and on along the terrace, +1.0 → 0", () => {
  // [what, middle z, height 12 m south of the middle, height at the middle, height 12 m north of it]
  const runs = [["the outer gate", AXIS.outerZ, 0, 0.5, 0], ["the inner gate", AXIS.innerZ, 0, SECOND.y, SECOND.y], ["the Wuliang hall", AXIS.hallZ, SECOND.y, SECOND.y, 0]];
  const tread = stairProfile(SECOND.y).height + 0.02;
  for (const [name, w] of both) for (const [what, cz, south, middle, north] of runs) {
    // From 12 m south of its middle to 12 m north of it, in 0.1 m steps along the axis: nothing shuts him out, and no step is higher than a tread.
    let last = null;
    for (let z = cz + 12; z >= cz - 12 - 1e-9; z -= 0.1) {
      assert.ok(!w.blocked(0, z), `${name}: ${what}, (0, ${z.toFixed(1)}) is open`);
      const h = w.heightAt(0, z); if (last !== null) assert.ok(Math.abs(h - last) <= tread, `${name}: ${what}: a step of ${(h - last).toFixed(3)} m at z = ${z.toFixed(1)}`);
      last = h;
    }
    assert.ok(near(w.heightAt(0, cz + 12), south) && near(w.heightAt(0, cz), middle) && near(w.heightAt(0, cz - 12), north), `${name}: ${what}: ${[12, 0, -12].map((d) => w.heightAt(0, cz + d).toFixed(2))} against ${south}, ${middle}, ${north}`);
  }
});

test("the rooms either side of each passage are shut, on both floors, and the passage is wide enough for his body", () => {
  const ROOMS = [["the outer gate", AXIS.outerZ, 4.3], ["the inner gate", AXIS.innerZ, 4.3], ["the Wuliang hall", AXIS.hallZ, 4.0]];
  for (const [name, w] of both) for (const [what, cz, x] of ROOMS) for (const sx of [-1, 1]) for (const dz of [-1.5, 0, 1.5]) assert.ok(w.blocked(sx * x, cz + dz), `${name}: ${what}: (${sx * x}, ${cz + dz}) is in a shut room`);
  // How wide the open floor is across the passage, at the middle of each building and a metre inside each face: his body (two BODYs) and half a metre to spare.
  for (const [name, w] of both) for (const [what, cz] of [["the outer gate", AXIS.outerZ], ["the inner gate", AXIS.innerZ], ["the Wuliang hall", AXIS.hallZ]]) for (const dz of [-2, 0, 2]) {
    let lo = 0, hi = 0; for (let x = 0; x > -6 && !w.blocked(x, cz + dz); x -= 0.05) lo = x; for (let x = 0; x < 6 && !w.blocked(x, cz + dz); x += 0.05) hi = x;
    assert.ok(hi - lo >= 2 * BODY + 0.5, `${name}: ${what} at ${dz}: only ${(hi - lo).toFixed(2)} m of open floor across the passage`);
  }
});

test("the shells are light: the three together are under 400 000 triangles", () => {
  let tris = 0; site.root.traverse((o) => { if (o.isMesh) { const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  assert.ok(tris < 400000, `${tris} triangles in the whole of T05 so far`);
  console.log(`# T05 so far: ${Math.round(tris)} triangles`);
});

test("the way's walls meet the outer gate's platform, and the gate shuts the way's width but for its passage", () => {
  for (const [name, w] of both) {
    const open = []; for (let x = -9; x <= 9; x += 0.1) if (!w.blocked(x, AXIS.outerZ)) open.push(+x.toFixed(1));
    assert.ok(open.every((x) => Math.abs(x) < 2.6 || Math.abs(x) > GATE.xs[3]), `${name}: across the outer gate: ${open.join(" ")}`);
  }
});

test("every parameter of the three shells has a row in docs/t05/SOURCES.md §13.1", async () => {
  const { readFileSync } = await import("node:fs");
  const doc = readFileSync(new URL("../../docs/t05/SOURCES.md", import.meta.url), "utf8"), at = doc.indexOf("### 13.1");
  assert.ok(at > 0, "SOURCES.md has a §13.1");
  for (const name of ["外山门", "内山门", "便门", "无量殿", "隔墙", "三角形", "自拟"]) assert.ok(doc.slice(at).includes(name), `§13.1 has a row for ${name}`);
});
