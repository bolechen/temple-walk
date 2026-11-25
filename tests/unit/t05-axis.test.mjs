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
const { AXIS, SECOND, LANE, HALL, GATE, FOOT, HALL_HALF, MONUMENT, LAMP, PATH, TRUNKS, SIGHTS, treeBlocks } = AX;
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
    for (const [x, z] of [[0, 215], [0, 195], [0, AXIS.innerZ + 10], [3, FOOT.inner.z1 + 1.3], [0, 55], [0, 30]]) assert.ok(near(w.heightAt(x, z), 0), `${name}: (${x}, ${z}) at 0, not ${w.heightAt(x, z)}`);
    for (const [x, z] of [[0, AXIS.innerZ], [0, AXIS.paifangZ], [0, 80], [12, 66], [-12, 66], [11, AXIS.paifangZ], [0, 67.2], [0, 61], [10, AXIS.innerZ - 4]]) assert.ok(near(w.heightAt(x, z), SECOND.y), `${name}: (${x}, ${z}) at +1.0, not ${w.heightAt(x, z)}`);
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
    for (const [x, z] of [[LANE.hw, 165], [-LANE.hw, 165], [LANE.hw, 215], [SECOND.hw, 90], [-SECOND.hw, 90], [SECOND.hw - 0.2, AXIS.innerZ - 0.1], [10, AXIS.innerZ]]) assert.ok(w.blocked(x, z), `${name}: in the wall, (${x}, ${z})`);
    for (const [x, z] of [[LANE.hw - 1.2, 165], [-LANE.hw + 1.2, 165], [LANE.hw - 1.2, 215], [SECOND.hw - 1.2, 90], [-SECOND.hw + 1.2, 90], [0, AXIS.innerZ + 10], [0, 90], [0, 55]]) assert.ok(!w.blocked(x, z), `${name}: inside, (${x}, ${z}) is open floor`);
  }
});

test("between the court and the terrace the only way across is the Wuliang hall's passage; between the terrace and the way, the inner gate's", () => {
  const open = (w, z, lo, hi) => { const xs = []; for (let x = lo; x <= hi + 1e-9; x += 0.1) if (!w.blocked(x, z)) xs.push(+x.toFixed(1)); return xs; };
  const mid = HALL.xs[3], gmid = GATE.xs[2];
  for (const [name, w] of both) {
    // z = 62 lies inside the hall, behind its back wall: open in the passage and on the porch outside the side walls, not in the rooms either side of the passage.
    const a = open(w, COMPOUND.zS, -COMPOUND.x - 1, COMPOUND.x + 1);
    assert.ok(a.some((x) => Math.abs(x) < 0.5) && a.every((x) => Math.abs(x) < mid - 0.3 || Math.abs(x) > HALL.xs[5] - 0.2) && a.every((x) => Math.abs(x) < FOOT.hall.x1), `${name}: along the court's south wall, across the hall: ${a.join(" ")}`);
    const b = open(w, AXIS.innerZ + 0.2, -SECOND.hw - 1, SECOND.hw + 1);
    assert.ok(b.some((x) => Math.abs(x) < 0.5) && b.every((x) => Math.abs(x) < gmid + 0.3 || Math.abs(x) > GATE.xs[3] - 0.2) && b.every((x) => Math.abs(x) < FOOT.inner.x1), `${name}: along the terrace's south end, across the gate: ${b.join(" ")}`);
  }
});

test("from where he arrives, the outer gate's, the inner gate's, the archway's, the Wuliang hall's and the court's mouth are all walked to, on both floors", () => {
  const targets = file.header.targets;
  for (const id of ["outer", "inner", "paifang", "passage", "mouth"]) {
    const t = targets.find((x) => x.kind === "view" && x.id === id);
    assert.ok(t, `${id} is a named view`); assert.ok(t.new, `${id}: reached on the floor baked from what is drawn`); assert.ok(t.old, `${id}: reached by the written plan's walker`);
    const v = site.views[id]; assert.ok(!grid.blocked(v[0], v[1]) && !old.blocked(v[0], v[1]), `${id} stands on open floor`);
  }
  assert.ok(near(grid.heightAt(...site.views.outer), 0.5) && near(grid.heightAt(...site.views.inner), SECOND.y) && near(grid.heightAt(...site.views.mouth), 0));   // (the outer gate's platform is 0.5 m)
  assert.equal(file.header.targets.filter((t) => !t.new || !t.old).length, 0, "every named place is reached on both floors");
  assert.ok(site.views.mouth[1] < FOOT.hall.z0 - stairProfile(SECOND.y).run, "the court's mouth is beyond the foot of the hall's back steps");
});

test("the middle way across the terrace before the great hall is 20 m wide and open, and the monument pavilion stands at its west edge: its stele, plinth and columns in the way, the place before the stele open (stele.js)", () => {
  for (const [name, w] of both) {
    for (let x = -10; x <= 10; x += 0.5) for (let z = 1; z <= 14; z += 0.5) assert.ok(!w.blocked(x, z), `${name}: (${x}, ${z}) of the middle way is open`);
    const M0 = MONUMENT, mx = (M0.x0 + M0.x1) / 2, mz = (M0.z0 + M0.z1) / 2, c = AX.MONUMENT_FORM.span / 2;
    for (const [x, z] of [[mx, mz], [mx - 0.7, mz + 0.4], [mx + 0.7, mz - 0.4], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [mx + a * c, mz + b * c])]) assert.ok(w.blocked(x, z), `${name}: the stele, its plinth or a column, (${x}, ${z})`);
    assert.ok(!w.blocked(site.places.copy.at[0], site.places.copy.at[1]), `${name}: the place before the stele is open`);
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
    for (const z of [AXIS.innerZ + 10, 170, 195, 215]) probes.push([sx * (LANE.hw - 0.4 - 0.6), z], [sx * (LANE.hw + 0.4 + 0.6), z]);
    for (const z of [70, 90, 110]) probes.push([sx * (SECOND.hw - 0.4 - 0.6), z], [sx * (SECOND.hw + 0.4 + 0.6), z]);
    probes.push([sx * (FOOT.hall.x1 + 0.9), 60.4], [sx * (FOOT.hall.x1 + 0.9), 64], [sx * (FOOT.inner.x1 + 0.9), 117.5], [sx * (FOOT.inner.x1 + 0.9), 123]);
  }
  for (const [x, z] of probes) assert.equal(old.blocked(x, z), grid.blocked(x, z), `(${x}, ${z}): the plan says ${old.blocked(x, z)}, the grid ${grid.blocked(x, z)}`);
});

test("only a path of about 6 m is paved down the way and the terrace; earth either side, with trunks standing in it", () => {
  assert.equal(PATH.hw * 2, 6);
  assert.deepEqual(site.paving.map((p) => p.x), [PATH.hw, PATH.hw], "two strips of paving, each 6 m across: the way's and the terrace's");
  assert.ok(site.paving[0].y < 0.05 && near(site.paving[1].y, SECOND.y + 0.012, 1e-9));
  // The path, the earth beside it and the gap between a trunk and the wall are all open floor; each trunk is in the way.
  for (const [name, w] of both) {
    for (const z of [AXIS.innerZ + 12, 175, 215]) for (const x of [0, PATH.hw - 0.5, PATH.hw + 0.6, -PATH.hw - 0.6]) assert.ok(!w.blocked(x, z), `${name}: (${x}, ${z}) on the way is open`);
    for (const z of [85, AXIS.paifangZ - 10]) for (const x of [0, 2, 4.2, -4.2]) assert.ok(!w.blocked(x, z), `${name}: (${x}, ${z}) on the terrace is open`);
    for (const x of [0, 4.2, -4.2]) assert.ok(!w.blocked(x, AXIS.paifangZ), `${name}: (${x}, ${AXIS.paifangZ}) between the archway's posts is open`);
    for (const t of TRUNKS.list) assert.ok(w.blocked(t.x, t.z), `${name}: a trunk at (${t.x}, ${t.z}), r ${t.r}`);
  }
  // Heights: the earth beside the path is on the floor, 0 down the way and +1.0 on the terrace.
  for (const [name, w] of both) { assert.ok(near(w.heightAt(6.8, 150), 0, 0.02), name); assert.ok(near(w.heightAt(6.8, 95), SECOND.y, 0.02), name); }
  // Trunks keep clear of the archway and of both platforms, and the crowns of the gate's eave.
  const onTerrace = TRUNKS.list.filter((t) => t.y > 0), onLane = TRUNKS.list.filter((t) => t.y === 0);
  // (the art director's lines of 2026-11-25 and #573 comment 7166589253: old arborvitae in rows only between the inner gate and the archway, eight a side in two
  // staggered lines, crown against crown; north of the archway broad pines, scattered, none of them a cypress; nothing at the Wuliang hall's steps)
  const rows = onTerrace.filter((t) => t.kind === "cypress"), pines = onTerrace.filter((t) => t.kind === "pine");
  assert.ok(rows.every((t) => t.z > AXIS.paifangZ + 4 && t.z < FOOT.inner.z0 - 0.8), `the rows keep between the archway and the gate: ${rows.map((t) => t.z)}`);
  // eight on the west, crown against crown; four on the east, the rest left out for the archway's sun (AX.SUNWARD_GAP; the sun test below)
  assert.equal(rows.filter((t) => t.x < 0).length, 8, "eight on the west (six the least, seven or eight better)"); assert.equal(rows.filter((t) => t.x > 0).length, 8 - AX.SUNWARD_GAP.length);
  { const zs = rows.filter((t) => t.x < 0).map((t) => t.z).sort((a, b) => a - b); assert.ok(zs.every((z, i) => i === 0 || z - zs[i - 1] <= 3.2), `the west, crown against crown: ${zs}`); }
  assert.ok(pines.length >= 5 && pines.every((t) => t.z < AXIS.paifangZ - 5 && t.z > FOOT.hall.z1 + 4) && onTerrace.length === rows.length + pines.length, "north of the archway broad pines only");
  assert.ok(pines.every((t) => t.rx >= 3.3) && new Set(pines.map((t) => Math.round(t.h))).size >= 4, "broad crowns, of uneven heights");
  assert.ok(onLane.every((t) => t.z > FOOT.inner.z1 + 4 && t.z < FOOT.outer.z0 - 4));
  // Scattered, not a row of poles (the art director's reviews of #464, #482): radii 0.25–0.5 m, a crown on each; the stretch between the hall and the archway (42 m) is not laid in pairs at even gaps.
  assert.ok(TRUNKS.list.every((t) => t.r >= 0.25 && t.r <= 0.5 && (t.rx > 2.5 || (t.x > 0 && t.rx >= 1.4)) && t.ry > 2 && Math.abs(t.x) >= 4.9 && Math.abs(t.x) <= 12.5))   // (an east tree by the wall may narrow its crown to keep the archway in the sun);
  assert.ok(new Set(TRUNKS.list.map((t) => t.r)).size > 6, "radii differ");
  const behind = onTerrace.filter((t) => t.z < AXIS.paifangZ), gaps = (side) => { const zs = behind.filter((t) => Math.sign(t.x) === side).map((t) => t.z).sort((p, q) => p - q); return zs.slice(1).map((z, i) => z - zs[i]); };
  for (const side of [-1, 1]) { const g = gaps(side); assert.ok(g.length >= 2 && Math.max(...g) - Math.min(...g) > 1.5, `uneven gaps on side ${side}: ${g.map((v) => v.toFixed(1))}`); }
  assert.ok(behind.some((l) => behind.every((r) => Math.sign(r.x) === Math.sign(l.x) || Math.abs(r.z - l.z) > 1.5)), "not every tree has a partner across the way");
  assert.ok(onLane.every((t) => t.y + TRUNKS.canopyBase > 6), "the way's data: a crown's underside over six metres up (the way's arborvitae are drawn as low columns behind cam07, AXIS_TREES)");
  assert.ok(onTerrace.filter((t) => t.kind === "cypress").every((t) => t.base >= 3.5 && t.base <= 4.5 && t.h >= 14 && t.h <= 18 && t.r >= 0.3 && t.r <= 0.45 && ((t.rx >= 2.5 && t.rx <= 3) || (t.x > 0 && t.rx >= 1.4 && t.rx < 2.5))), "the terrace's old arborvitae: crown from 3.5 to 4.5 m, 14 to 18 m tall, a trunk 0.6 to 0.9 m through, a crown 5 to 6 m across");
});

test("from cam07, the archway's middle bay shows the hall and the middle 60% of its ridge is clear of trees (the art director, 2026-11-25; #482's whole ridge and ornaments set aside for the terrace's rows)", () => {
  const { KEPT_SIGHTS } = AX;
  const blocked = []; for (const l of KEPT_SIGHTS) for (const t of TRUNKS.list) if (treeBlocks(SIGHTS.eye, l.to, t)) blocked.push(`${l.kind} line to (${l.to.map((n) => n.toFixed(1))}) is stopped by the tree at (${t.x}, ${t.z})`);
  assert.deepEqual(blocked, [], "every kept line of sight is clear of trees");
  const ridge = SIGHTS.lines.filter((l) => l.kind === "ridge"), stopped = ridge.filter((l) => TRUNKS.list.some((t) => treeBlocks(SIGHTS.eye, l.to, t)));
  console.log(`# cam07: ${stopped.length} of ${ridge.length} lines to the ridge and its ornaments are stopped by a tree (${((stopped.length / ridge.length) * 100).toFixed(0)}%), all at its ends`);
  assert.ok(SIGHTS.lines.filter((l) => l.kind === "ridge").length >= 45 && SIGHTS.lines.filter((l) => l.kind === "door").length >= 60, "the lines are many enough to mean something");
});

test("no tree crown stands in cam07's view of the middle 60% of the Great Hall's ridge (#482, as the art director set it on 2026-11-25)", async () => {
  const { buildHall } = await import("../../app/levels/t05/hall.js"), { roof } = buildHall(M), [ex, ez] = [0, AXIS.innerZ + 1], ey = SECOND.y + 1.6;
  const pts = []; for (let x = -0.6 * roof.rx; x <= 0.6 * roof.rx + 1e-9; x += 0.5) pts.push([x, roof.ridge + 0.4, roof.zm]);   // (the middle 60% of the ridge: its ends and ornaments may be behind a tree's top, the art director, 2026-11-25)
  // a segment from the eye to a point against each crown, an ellipsoid with its centre over the trunk
  const hits = (p, t) => {
    const c = [t.x, t.y + (t.base ?? TRUNKS.canopyBase) + t.ry, t.z], d = [p[0] - ex, p[1] - ey, p[2] - ez], o = [ex - c[0], ey - c[1], ez - c[2]], k = [t.rx, t.ry, t.rx];
    const a = d.reduce((s, v, i) => s + (v / k[i]) ** 2, 0), b = 2 * d.reduce((s, v, i) => s + (v * o[i]) / k[i] ** 2, 0), cc = o.reduce((s, v, i) => s + (v / k[i]) ** 2, 0) - 1, disc = b * b - 4 * a * cc;
    if (disc < 0) return false; const s0 = (-b - Math.sqrt(disc)) / (2 * a), s1 = (-b + Math.sqrt(disc)) / (2 * a); return s1 > 0 && s0 < 1;
  };
  const blocked = []; for (const p of pts) for (const t of TRUNKS.list) if (hits(p, t)) blocked.push(`${p.map((n) => n.toFixed(1))} by the crown at (${t.x}, ${t.z})`);
  assert.deepEqual(blocked, [], "no crown is in the line of sight");
});

test("the rows between the inner gate and the archway stand close beside the path, the inner line 2 to 3 m off its edge and the outer behind it; the archway's own neighbourhood rule (#492) is set aside for them (the art director, 2026-11-25)", () => {
  const rows = TRUNKS.list.filter((t) => t.y > 0 && t.kind === "cypress"), off = (t) => Math.abs(t.x) - PATH.hw;
  const inner = rows.filter((t) => !t.back), outer = rows.filter((t) => t.back);
  assert.equal(inner.length + outer.length, 16 - AX.SUNWARD_GAP.length); assert.equal(inner.filter((t) => t.x < 0).length, 4); assert.equal(outer.filter((t) => t.x < 0).length, 4);
  assert.ok(inner.filter((t) => t.x < 0).every((t) => off(t) >= 2 && off(t) <= 3.2), inner.map((t) => off(t).toFixed(2)).join(" "));
  assert.ok(rows.filter((t) => t.x > 0).every((t) => AX.sunClear(t) || t.rx <= 1.4), "every east tree kept stops none of the sun's rays to the archway's middle bay, or has narrowed its crown as far as it may");
  assert.ok(outer.every((t) => off(t) >= 5 && off(t) <= 9.2), outer.map((t) => off(t).toFixed(2)).join(" "));
  assert.ok(TRUNKS.list.filter((t) => t.y === 0).every((t) => !AX.nearArchway(t)), "the way's trees keep #492's rule (none near the archway)");
});


test("the monument pavilion is open on all four sides: between its columns, at the height of his eye and over the stele's foot, nothing stands in the way through it", () => {
  const M0 = MONUMENT, mx = (M0.x0 + M0.x1) / 2, mz = (M0.z0 + M0.z1) / 2, y = M0.y + 0.45 + 1.2, ray = new THREE.Raycaster();
  site.root.updateMatrixWorld(true);
  const inside = (p) => p.x > M0.x0 + 0.1 && p.x < M0.x1 - 0.1 && p.z > M0.z0 + 0.1 && p.z < M0.z1 - 0.1;
  // A line a little off the middle, clear of the stele (a slab 1.0 × 0.3 m) and of the columns (±1.55 m), along each way.
  for (const [o, d] of [[[M0.x0 - 1, y, mz + 0.7], [1, 0, 0]], [[M0.x1 + 1, y, mz - 0.7], [-1, 0, 0]], [[mx + 0.7, y, M0.z0 - 1], [0, 0, 1]], [[mx - 0.7, y, M0.z1 + 1], [0, 0, -1]]]) {
    ray.set(new THREE.Vector3(...o), new THREE.Vector3(...d));
    const hits = ray.intersectObject(site.root, true).filter((h) => inside(h.point));
    assert.equal(hits.length, 0, `a line through the pavilion along (${d}) is stopped at ${hits[0]?.point.toArray().map((v) => v.toFixed(2))}`);
  }
  // And the stele is there, on the middle, for the written plan to stop him at (the pavilion's footprint stays shut to him).
  ray.set(new THREE.Vector3(mx, y, M0.z0 - 1), new THREE.Vector3(0, 0, 1));
  assert.ok(ray.intersectObject(site.root, true).some((h) => inside(h.point)), "the stele stands in the middle");
});

test("the monument pavilion's roof stands clear of the great hall's eave: a clear band of sky between its edge and the eave's (the structure review of #573, second batch, question 2: the eaves read as touching)", async () => {
  const { HALL: H, ZS } = await import("../../app/levels/t05/hall.js");
  const M0 = MONUMENT, F = AX.MONUMENT_FORM, mz = (M0.z0 + M0.z1) / 2, mx = (M0.x0 + M0.x1) / 2;
  const hallEdgeZ = ZS[0] + H.overhang, hallUnder = H.eave - H.roof;                  // the hall's eave edge in front of its column line, and the underside of its fascia
  const ceil = M0.y + F.base + F.column + 0.3 + F.beam, top = ceil + 0.1 + F.roofH + 0.6;   // the pavilion's finial
  const horizontal = (mz - F.eave) - hallEdgeZ, vertical = hallUnder - top;
  const dist = Math.hypot(horizontal, hallUnder - (ceil + 0.1));                       // from the pavilion's eave edge to the hall's: straight line
  console.log(`monument-clearance: eave edge to eave edge ${horizontal.toFixed(2)} m across, ${(hallUnder - (ceil + 0.1)).toFixed(2)} m up (${dist.toFixed(2)} m straight); finial to the hall's fascia underside ${vertical.toFixed(2)} m up`);
  assert.ok(horizontal >= 3.5, `${horizontal.toFixed(2)} m between the two eaves' edges in plan: at least 3.5 m`);
  assert.ok(vertical >= 1.0, `${vertical.toFixed(2)} m of the pavilion's finial under the hall's fascia: at least 1 m`);
  assert.ok(M0.x0 >= -TERRACE.w / 2 && M0.x0 - -TERRACE.w / 2 < 0.5, "and it still stands against the west parapet, as before");
  assert.ok(mx < -10 && M0.z1 <= TERRACE.zS - 1.5, "clear of the middle way, and a stride in front of the terrace's south parapet");
});

test("the winter sun reaches the archway's front: over 55% of its middle bay lit through the trees (the art director's line of 2026-11-25 for #722, A)", async () => {
  // J01's sun (app/levels/t05/level.js: 152°, 17° up); each crown as its ellipsoid and each trunk as its post, as the views are cleared
  const { EAST_WALL_TREES } = await import("../../app/levels/t05/site.js");
  const el = (17 * Math.PI) / 180, az = (152 * Math.PI) / 180, s = [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
  const trees = [...TRUNKS.list.filter((t) => t.y > 0), ...EAST_WALL_TREES.map((t) => ({ ...t, ...t.env }))];
  let lit = 0, n = 0;
  for (let x = -2; x <= 2.001; x += 0.25) for (let y = 1.5; y <= 8.5; y += 0.25) { const P = [x, y, AXIS.paifangZ + 0.6], Q = P.map((v, i) => v + s[i] * 80); n++; if (!trees.some((t) => AX.treeBlocks(P, Q, t))) lit++; }
  assert.ok(lit / n >= 0.55, `${((100 * lit) / n).toFixed(1)}% of the middle bay lit`);
  assert.ok(EAST_WALL_TREES.every((t) => t.x - PATH.hw >= 7), "the east's dark ground stands 7 m and more off the path");
});

test("the monument's stele has a head: the Yingzao Fashi's proportions (chapter 3, 造赑屃鳌坐碑之制) for the shaft and the head, a head wider and thicker than the shaft, a cloud plate under it, and no tortoise", () => {
  const M0 = MONUMENT, mx = (M0.x0 + M0.x1) / 2, mz = (M0.z0 + M0.z1) / 2, S = AX.STELE, floor = M0.y + AX.MONUMENT_FORM.base + 0.45;
  // The shaft: 0.4 wide and 0.15 thick to every unit of its length (原文), the head 0.44 square-wide and 0.18 thick (原文), its cloud plate 0.15 of the shaft's width high (原文).
  assert.ok(near(S.w / S.L, 0.4, 1e-6) && near(S.t / S.L, 0.15, 1e-6), "the shaft is 4/10 wide and 1.5/10 thick of its length");
  assert.ok(near(S.headW / S.L, 0.44, 1e-6) && near(S.headT / S.L, 0.18, 1e-6) && near(S.cloud, 0.15 * S.w, 1e-6), "the head 0.44 and 0.18 of the shaft's length; the cloud plate 0.15 of its width");
  assert.ok(S.headW > S.w && S.headT > S.t, "the head is wider and thicker than the shaft");
  // Drawn so: a line at the head's height across its middle meets the head's full width; at the shaft's height, only the shaft's.
  site.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), widthAt = (y) => {
    const along = (dx) => { ray.set(new THREE.Vector3(mx + dx * 3, y, mz), new THREE.Vector3(-dx, 0, 0)); const h = ray.intersectObject(site.root, true).find((q) => Math.abs(q.point.z - mz) < 1e-6 && Math.abs(q.point.x - mx) < 1.2); return h ? Math.abs(h.point.x - mx) : 0; };
    return along(1) + along(-1);
  };
  assert.ok(near(widthAt(floor + S.L / 2), S.w, 0.01), `the shaft's width ${widthAt(floor + S.L / 2)}`);
  assert.ok(near(widthAt(floor + S.L + S.cloud + 0.1), S.headW, 0.02), `the head's width ${widthAt(floor + S.L + S.cloud + 0.1)}`);
  // It stands clear under the ceiling plate, and nothing of it is a tortoise: the plinth stays the one plain block (the owner's lead: no turtle).
  assert.ok(floor + S.L + S.headH < M0.y + AX.MONUMENT_FORM.base + AX.MONUMENT_FORM.column + 0.3 + AX.MONUMENT_FORM.beam - 0.1, "the head clears the ceiling plate");
});
