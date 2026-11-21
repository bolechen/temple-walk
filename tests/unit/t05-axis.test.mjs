// T05's axis before the court (docs/t05/PLAN.md item 8, issue #435): the way in from the outer gate's place, the second
// terrace (+1.0 m) that the inner gate, the archway and the Wuliang hall share, the walls round both, and the two places
// held (the monument pavilion, the lamp table). On the floor baked from what is drawn (shared/walk/t05.bin) and on the
// written plan's walker alike: where he can stand, how high, what stops him, and what he can walk to from where he arrives.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
const T05 = await import("../../app/levels/t05/site.js");
const AX = await import("../../app/levels/t05/axis.js");
const { buildSite, createWalker, COMPOUND, WAY, ARRIVE, TERRACE, PLATFORM } = T05;
const { AXIS, SECOND, LANE, HALL, GATE, FOOT, HALL_HALF, MONUMENT, LAMP } = AX;
const { loadLevel } = await import("../../app/src/level.js");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { stairProfile } = await import("../../app/src/geo.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const level = await loadLevel("t05"), site = buildSite(M);
const file = ensure(prepare(level)), decoded = decode(file.bytes, (b) => inflateRawSync(b));
const old = createWalker(site), grid = createGridWalker(createWalker(site), gridsByPlace(decoded), { doors: site.halls });
const both = [["plan", old], ["grid", grid]];
const near = (a, b, tol = 0.03) => Math.abs(a - b) <= tol;

test("the platforms' footprints are the axis table's, and the hall's platform ties the court's south wall", () => {
  // Wuliang hall: 16.14 × 12.22 m between column lines (S03), platform a metre and a fifth beyond, centred on the axis at OSM's z.
  assert.ok(near(HALL.xs[HALL.xs.length - 1] * 2, 16.14, 1e-9) && near(HALL.zs[0] * 2, 12.22, 1e-9));
  assert.ok(near((FOOT.hall.z0 + FOOT.hall.z1) / 2, AXIS.hallZ, 1e-9) && near(FOOT.hall.x1, 9.27, 1e-9) && near(FOOT.hall.z0, 59.89, 1e-9) && near(FOOT.hall.z1, 74.51, 1e-9));
  assert.equal(COMPOUND.gate, HALL_HALF); assert.equal(HALL_HALF, FOOT.hall.x1);
  // The gate's platform flanks meet the way's walls' inner faces: no slot between them for him to be in.
  assert.ok(near(FOOT.inner.x1, LANE.hw - LANE.t / 2, 1e-9), "the gate platform's flank is the way's wall's inner face");
  assert.equal(WAY.x, LANE.hw);
  // The axis runs outer gate, inner gate, archway, hall from south to north, and the arrival is south of the outer gate.
  assert.ok(ARRIVE[1] > AXIS.outerZ && AXIS.outerZ > AXIS.innerZ && AXIS.innerZ > AXIS.paifangZ && AXIS.paifangZ > FOOT.hall.z1 && FOOT.hall.z0 > COMPOUND.zN);
  assert.ok(ARRIVE[1] < WAY.zS);
});

test("he arrives where he did: (0, 215), facing north", () => {
  assert.deepEqual(site.start, [0, 215, 0, 0.05]); assert.deepEqual(site.views.arrive, [0, 215, 0, 0.05]);
});

test("the way and the forecourt lie at 0, the second terrace and the hall's and the gate's platforms at +1.0, the court at 0, on both floors", () => {
  for (const [name, w] of both) {
    for (const [x, z] of [[0, 215], [0, 165], [0, 130], [3, 125.5], [0, 55], [0, 30]]) assert.ok(near(w.heightAt(x, z), 0), `${name}: (${x}, ${z}) at 0, not ${w.heightAt(x, z)}`);
    for (const [x, z] of [[0, 120], [0, 100], [0, 80], [12, 66], [-12, 66], [11, 100], [0, 67.2], [0, 61], [10, 116]]) assert.ok(near(w.heightAt(x, z), SECOND.y), `${name}: (${x}, ${z}) at +1.0, not ${w.heightAt(x, z)}`);
  }
});

test("each of the two flights has even treads: six steps from the way up to the inner gate, six from the hall down into the court", () => {
  const { count, height, tread, run } = stairProfile(SECOND.y);
  assert.equal(count, 6);
  const heads = [["gate", FOOT.inner.z1, +1], ["hall", FOOT.hall.z0, -1]];
  for (const [name, w] of both) for (const [which, zEdge, dir] of heads) {
    const seen = [];
    for (let i = 0; i < count; i++) seen.push(w.heightAt(0, zEdge + dir * tread * (i + 0.5)));
    for (let i = 1; i < count; i++) assert.ok(Math.abs(seen[i - 1] - seen[i] - height) < 0.03, `${name} ${which}: tread ${i}: ${seen[i - 1].toFixed(3)} → ${seen[i].toFixed(3)}`);
    assert.ok(near(w.heightAt(0, zEdge + dir * (run + 0.5)), 0), `${name} ${which}: the flight's foot is on the ground`);
    assert.ok(near(w.heightAt(0, zEdge - dir * 0.5), SECOND.y), `${name} ${which}: its head is on the platform`);
  }
});

test("nothing outside the walls of the way or of the terrace can be stood on; the walls themselves stop him", () => {
  for (const [name, w] of both) {
    for (const [x, z] of [[LANE.hw + 3, 165], [-LANE.hw - 3, 165], [LANE.hw + 3, 215], [SECOND.hw + 3, 90], [-SECOND.hw - 3, 90], [25, 62.1 + 3], [0, WAY.zS + 3]]) assert.ok(w.blocked(x, z), `${name}: outside, (${x}, ${z})`);
    for (const [x, z] of [[LANE.hw, 165], [-LANE.hw, 165], [LANE.hw, 215], [SECOND.hw, 90], [-SECOND.hw, 90], [SECOND.hw - 0.2, 119.9], [10, 120]]) assert.ok(w.blocked(x, z), `${name}: in the wall, (${x}, ${z})`);
    for (const [x, z] of [[LANE.hw - 1.2, 165], [-LANE.hw + 1.2, 165], [LANE.hw - 1.2, 215], [SECOND.hw - 1.2, 90], [-SECOND.hw + 1.2, 90], [0, 130], [0, 90], [0, 55]]) assert.ok(!w.blocked(x, z), `${name}: inside, (${x}, ${z}) is open floor`);
  }
});

test("between the court and the terrace the only way across is over the hall's platform; between the terrace and the way, over the gate's", () => {
  const open = (w, z, lo, hi) => { const xs = []; for (let x = lo; x <= hi + 1e-9; x += 0.1) if (!w.blocked(x, z)) xs.push(+x.toFixed(1)); return xs; };
  for (const [name, w] of both) {
    const a = open(w, COMPOUND.zS, -COMPOUND.x - 1, COMPOUND.x + 1);
    assert.ok(a.length > 50 && a.every((x) => Math.abs(x) < FOOT.hall.x1), `${name}: along the court's south wall only the hall's platform is open: ${a[0]} … ${a[a.length - 1]}`);
    const b = open(w, AXIS.innerZ + 0.2, -SECOND.hw - 1, SECOND.hw + 1);
    assert.ok(b.length > 50 && b.every((x) => Math.abs(x) < FOOT.inner.x1), `${name}: along the terrace's south end only the gate's platform is open: ${b[0]} … ${b[b.length - 1]}`);
  }
});

test("from where he arrives, the outer gate's, the inner gate's, the archway's, the Wuliang hall's and the court's mouth are all walked to, on both floors", () => {
  const targets = file.header.targets;
  for (const id of ["outer", "inner", "paifang", "passage", "mouth"]) {
    const t = targets.find((x) => x.kind === "view" && x.id === id);
    assert.ok(t, `${id} is a named view`); assert.ok(t.new, `${id}: reached on the floor baked from what is drawn`); assert.ok(t.old, `${id}: reached by the written plan's walker`);
    const v = site.views[id]; assert.ok(!grid.blocked(v[0], v[1]) && !old.blocked(v[0], v[1]), `${id} stands on open floor`);
  }
  assert.ok(near(grid.heightAt(...site.views.outer), 0) && near(grid.heightAt(...site.views.inner), SECOND.y) && near(grid.heightAt(...site.views.mouth), 0));
  assert.equal(file.header.targets.filter((t) => !t.new || !t.old).length, 0, "every named place is reached on both floors");
  assert.ok(site.views.mouth[1] < FOOT.hall.z0 - stairProfile(SECOND.y).run, "the court's mouth is beyond the foot of the hall's back steps");
});

test("the middle way across the terrace before the great hall is 20 m wide and open, and the monument pavilion's place is held at its west edge", () => {
  for (const [name, w] of both) {
    for (let x = -10; x <= 10; x += 0.5) for (let z = 1; z <= 14; z += 0.5) assert.ok(!w.blocked(x, z), `${name}: (${x}, ${z}) of the middle way is open`);
    const M0 = MONUMENT, mx = (M0.x0 + M0.x1) / 2, mz = (M0.z0 + M0.z1) / 2;
    for (const [x, z] of [[mx, mz], [M0.x0 + 0.3, M0.z0 + 0.3], [M0.x1 - 0.3, M0.z1 - 0.3]]) assert.ok(w.blocked(x, z), `${name}: the pavilion's block, (${x}, ${z})`);
  }
  // 4–5 m square (ARCHITECTURE.md §3.2), clear of the 20 m middle way, against the west parapet (SITE.md §6.1: pavilions stand to either side of the way).
  assert.ok(MONUMENT.x1 - MONUMENT.x0 >= 4 && MONUMENT.x1 - MONUMENT.x0 <= 5 && MONUMENT.z1 - MONUMENT.z0 >= 4 && MONUMENT.z1 - MONUMENT.z0 <= 5);
  assert.ok(MONUMENT.x1 <= -10 && MONUMENT.x0 >= -TERRACE.w / 2 && MONUMENT.z0 >= TERRACE.zN && MONUMENT.z1 <= TERRACE.zS && MONUMENT.y === PLATFORM.h);
});

test("the lamp table is held inside the great hall's front, off the way from the door to the centre", () => {
  // The great hall's front wall is at z = 0.3 (outside) to −0.6 (inside) and the three doors are the middle three of nine bays, 2.9 m either side of the axis to 8.7 m (SITE.md §3.2, ARCHITECTURE.md §2.1).
  assert.ok(LAMP.z + LAMP.d / 2 < -0.6 && LAMP.z - LAMP.d / 2 > -3, "inside the front wall, within a few metres of it");
  assert.ok(LAMP.x - LAMP.w / 2 > 8.7 && LAMP.x + LAMP.w / 2 < 23, "in a bay beyond the three doors, east of them");
  assert.equal(LAMP.y, PLATFORM.h); assert.ok(LAMP.h > 0.7 && LAMP.h < 1.0, "a table's height");
  for (const [name, w] of both) assert.ok(w.blocked(LAMP.x, LAMP.z), `${name}: the table's block is in the way`);
});

test("every size on the axis has a row in docs/t05/SOURCES.md §13, with how far it is sourced", () => {
  const doc = readFileSync(new URL("../../docs/t05/SOURCES.md", import.meta.url), "utf8"), at = doc.indexOf("## 13.");
  assert.ok(at > 0, "SOURCES.md has a §13");
  const part = doc.slice(at, doc.indexOf("\n## ", at + 5) < 0 ? undefined : doc.indexOf("\n## ", at + 5));
  for (const name of ["外山门", "内山门", "牌坊", "无量殿", "二层高台", "甬道", "围墙", "碑亭", "灯案", "到达点"]) assert.ok(part.includes(name), `§13 has a row for ${name}`);
  for (const word of ["提案", "自拟"]) assert.ok(part.includes(word), `§13 says what is a ${word}`);
});

test("what he walks round is the same on both floors: points just off each wall, each platform and each block agree", () => {
  const probes = [];
  for (const sx of [-1, 1]) {
    for (const z of [130, 170, 205, 215]) probes.push([sx * (LANE.hw - 0.4 - 0.6), z], [sx * (LANE.hw + 0.4 + 0.6), z]);
    for (const z of [70, 90, 110]) probes.push([sx * (SECOND.hw - 0.4 - 0.6), z], [sx * (SECOND.hw + 0.4 + 0.6), z]);
    probes.push([sx * (FOOT.hall.x1 + 0.9), 60.4], [sx * (FOOT.hall.x1 + 0.9), 64], [sx * (FOOT.inner.x1 + 0.9), 117.5], [sx * (FOOT.inner.x1 + 0.9), 123]);
  }
  for (const [x, z] of probes) assert.equal(old.blocked(x, z), grid.blocked(x, z), `(${x}, ${z}): the plan says ${old.blocked(x, z)}, the grid ${grid.blocked(x, z)}`);
});
