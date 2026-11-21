// T05's white box (#409, docs/t05/PLAN.md item 5): the court, the great hall's platform, the terrace before it and the
// flight up, walled round, and the way in from the outer gate's place. Its sizes are SITE.md's; on the floor baked from
// what is drawn (shared/walk/t05.bin) he walks from where he arrives into the court, to station A, up the flight and to
// station B on the terrace, every tread the same height, and the written plan's walker reaches the same places.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { inflateRawSync } from "node:zlib";
const T05 = await import("../../app/levels/t05/site.js");
const { buildSite, createWalker, PLATFORM, TERRACE, FLIGHT, COMPOUND, WAY, ARRIVE, STATION } = T05;
const { loadLevel } = await import("../../app/src/level.js");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { stairProfile, STAIR } = await import("../../app/src/geo.js");
const { BAYS, HALL, FRONT, XS, ZS, OUTER, buildHall } = await import("../../app/levels/t05/hall.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const level = await loadLevel("t05"), site = buildSite(M);
const file = ensure(prepare(level)), decoded = decode(file.bytes, (b) => inflateRawSync(b));
const old = createWalker(site), walker = createGridWalker(createWalker(site), gridsByPlace(decoded), { doors: site.halls });

test("the platform, the terrace and the flight are SITE.md's sizes, the court's paving at 0 and the floors at +3", () => {
  assert.deepEqual([PLATFORM.w, PLATFORM.d, PLATFORM.h, PLATFORM.zS], [55.8, 25.91, 3.0, 0.4]);      // SITE.md §1.1, §3.1 (S03, S10)
  assert.deepEqual([TERRACE.w, TERRACE.d, TERRACE.zN, TERRACE.zS], [37, 15, 0.4, 15.4]);             // SITE.md §1.1, §3.1 (a summary)
  assert.equal(FLIGHT.rise, PLATFORM.h); assert.ok(FLIGHT.w >= 8 && FLIGHT.w <= 10, "SITE.md §8: 8–10 m wide");
  const { count, height } = stairProfile(FLIGHT.rise);
  // SITE.md §6 proposes about 18 steps of 0.16–0.17 m; every flight in the game is laid by the one profile (0.18 m), which gives 17 here.
  assert.equal(count, Math.round(3 / STAIR.rise)); assert.ok(height > 0.16 && height < 0.18, `${height}`);
  // (z = 60 was the court once; it is the Wuliang hall's platform now, +1.0: docs/t05/SOURCES.md §13)
  for (const [x, z] of [[0, 30], [0, 55], [0, 200]]) assert.equal(old.heightAt(x, z), 0, `the court and the way at 0 (${x}, ${z})`);
  for (const [x, z] of [[0, -12], [20, -20], [0, 8], [15, 12]]) assert.equal(old.heightAt(x, z), 3, `the platform and the terrace at +3 (${x}, ${z})`);
});

test("he arrives at the outer gate's place, and every named view stands where he can walk", () => {
  assert.deepEqual(site.start.slice(0, 2), ARRIVE); assert.deepEqual(ARRIVE, [0, 215]);
  assert.ok(ARRIVE[1] < WAY.zS && ARRIVE[1] > COMPOUND.zS);
  for (const [id, v] of Object.entries(site.views)) assert.ok(!walker.blocked(v[0], v[1]), `${id} (${v[0]}, ${v[1]}) is open floor`);
});

test("from where he arrives he can walk to station A in the court and to station B at the foot of the flight", () => {
  const targets = file.header.targets;
  for (const id of ["arrive", "a", "b"]) {
    const t = targets.find((x) => x.kind === "view" && x.id === id);
    assert.ok(t, id); assert.ok(t.new, `${id}: reached on the floor baked from what is drawn`); assert.ok(t.old, `${id}: reached by the written plan's walker`);
  }
  assert.ok(Math.abs(walker.heightAt(...STATION.A)) < 0.02, "A is on the court's paving");
  assert.ok(Math.abs(walker.heightAt(...STATION.B)) < 0.02, "B is on the court's paving, the platform over his head");
  const { count, tread } = stairProfile(FLIGHT.rise);
  assert.ok(STATION.B[1] - (TERRACE.zS + count * tread) >= 1, "B stands at least a metre out from the flight's foot");
});

test("up the flight every tread is the same height, on the baked floor as on the written plan", () => {
  const { count, height, tread } = stairProfile(FLIGHT.rise), z0 = TERRACE.zS;
  for (const w of [walker, old]) {
    const seen = [];
    for (let i = 0; i < count; i++) seen.push(w.heightAt(0, z0 + tread * (i + 0.5)));
    for (let i = 1; i < count; i++) assert.ok(Math.abs(seen[i - 1] - seen[i] - height) < 0.03, `${w === old ? "plan" : "grid"}: tread ${i}: ${seen[i - 1].toFixed(3)} → ${seen[i].toFixed(3)}`);
  }
});

test("nothing outside the compound and the way can be stood on, and the parapet keeps him off the platform's edge", () => {
  for (const [x, z] of [[COMPOUND.x + 3, 0], [0, COMPOUND.zN - 3], [WAY.x + 3, 150], [0, WAY.zS + 3]]) assert.ok(walker.blocked(x, z) && old.blocked(x, z), `(${x}, ${z})`);
  // Along the platform's back, its ends, the terrace's sides and its front either side of the flight: no open floor within 0.1 m of the edge.
  for (const [x, z] of [[0, PLATFORM.zS - PLATFORM.d + 0.05], [PLATFORM.w / 2 - 0.05, -10], [TERRACE.w / 2 - 0.05, 8], [12, TERRACE.zS - 0.05]]) assert.ok(walker.blocked(x, z), `(${x}, ${z})`);
});

test("the great hall: nine bays at ARCHITECTURE.md's widths, 28 eave columns, three doors and four windows, eave and ridge where SITE.md has them (#422)", () => {
  assert.deepEqual([...BAYS], [4.98, 4.98, 5.26, 5.8, 5.8, 5.8, 5.26, 4.98, 4.98]);
  assert.ok(Math.abs(XS[XS.length - 1] - XS[0] - 47.84) < 1e-9, "47.84 m across the column heads");
  assert.ok(Math.abs(ZS[0] - ZS[ZS.length - 1] - 25.13) < 1e-9, "25.13 m deep");
  assert.equal(HALL.column, 6.06); assert.equal(HALL.floor, PLATFORM.h);
  assert.deepEqual([...FRONT], ["wall", "window", "window", "door", "door", "door", "window", "window", "wall"]);
  const h = buildHall(M);
  assert.equal(h.columns.length, 28, "ten across the front and the back, four more up each end");
  assert.equal(HALL.door.w, HALL.door.h, "a square door: 《营造法式》 版门「廣與高方」"); assert.equal(HALL.door.sill, 0.24);
  for (const i of [3, 4, 5]) assert.ok(BAYS[i] - HALL.door.w >= 0.6 && HALL.door.h < HALL.column - HALL.lintel, "the door fills its bay but for the jambs, and stands under the tie-beam");
  const back = h.parts.dark.map((g) => (g.computeBoundingBox(), g.boundingBox));
  assert.ok(back.some((bb) => Math.abs(bb.max.x - bb.min.x - HALL.door.w) < 0.01 && bb.min.z < OUTER.zB + 1 && Math.abs(bb.min.x + bb.max.x) < 0.01), "a shut door in the back wall's middle bay");
  assert.ok(Math.abs(h.roof.eave - 11.81) < 0.01 && Math.abs(h.roof.ridge - 21) < 0.01, "eave about +11.8, ridge about +21 from the court");
  assert.ok(Math.abs(h.roof.EX - h.roof.rx - (h.roof.EF - h.roof.EB) / 2) < 1e-9, "the ends are hipped at 45°: one roof of four slopes and five ridges");
  assert.ok(OUTER.zB > PLATFORM.zS - PLATFORM.d, "the back wall stands on the platform");
  // The front columns stand out of the front wall more than half round, so that the nine bays read (#425's review).
  assert.ok(HALL.front < 0 && HALL.front > -HALL.colR, "the front wall's face lies behind the column line");
  // The doors and windows share one head line, and the ridge is a narrow, tall course with its end ornaments.
  const heads = h.parts.wood.map((g) => (g.computeBoundingBox(), g.boundingBox)).filter((b) => Math.abs(b.min.y - (HALL.floor + HALL.door.h)) < 0.01 && b.max.z > ZS[0] + HALL.front - HALL.wall - 0.1 && b.min.z < ZS[0]);
  assert.equal(heads.length, 7, "a wooden head over each of the three doors and four windows, all at the doors' height");
  const r = h.parts.ridge[0]; r.computeBoundingBox(); assert.ok(r.boundingBox.max.z - r.boundingBox.min.z < 0.6 && r.boundingBox.max.y - r.boundingBox.min.y >= 0.9, "a narrow, tall ridge");
});

test("inside, the open roof: eight frames on the inner column lines, each tier under the roof's slopes, and inner columns behind the altar's place (#422)", () => {
  const h = buildHall(M);
  assert.equal(h.inner.length, 10, "eight in the back row, one under each frame, and the two end bays' front inner columns");
  for (const [, z] of h.inner.filter(([x]) => Math.abs(x) < 15)) assert.equal(z, ZS[4], "in front of the altar the inner columns are left out");
  const xs = new Set(h.parts.frame.map((g) => (g.computeBoundingBox(), g.boundingBox.getCenter(new THREE.Vector3()).x.toFixed(2))));
  assert.deepEqual([...xs].sort((a, b) => a - b), XS.slice(1, -1).map((x) => x.toFixed(2)).sort((a, b) => a - b), "a frame on each of the eight inner column lines");
  const { EF, EB, EX, slope } = h.roof, under = (x, z) => Math.min(HALL.ridge, HALL.eave + slope * Math.min(EF - z, z - EB, EX - Math.abs(x))) - HALL.roof;
  for (const g of h.parts.frame) { const b = g.boundingBox; for (const z of [b.min.z, b.max.z]) assert.ok(b.max.y <= under(b.min.x, z) + 0.05, `a beam at x ${b.min.x.toFixed(1)} rises through the roof at z ${z.toFixed(1)}: ${b.max.y.toFixed(2)} > ${under(b.min.x, z).toFixed(2)}`); }
  assert.ok(h.fill.length > 0, "a neutral fill under the roof");
  // The murals' ground stands off the wall's inner face, never on it: on it, the two faces fought for the same pixels and
  // the lit plaster showed through the dark ground in stripes and slanting bands (the art review's "diagonal line").
  const faces = h.parts.plaster.map((g) => (g.computeBoundingBox(), g.boundingBox));
  for (const g of h.parts.mural) { const m = (g.computeBoundingBox(), g.boundingBox), alongX = m.max.x - m.min.x > m.max.z - m.min.z;
    for (const w of faces) { const near = alongX ? [w.min.z, w.max.z].some((z) => Math.abs(z - m.min.z) < 0.01 || Math.abs(z - m.max.z) < 0.01) && w.max.x - w.min.x > 2 : [w.min.x, w.max.x].some((x) => Math.abs(x - m.min.x) < 0.01 || Math.abs(x - m.max.x) < 0.01) && w.max.z - w.min.z > 2;
      assert.ok(!near, "a face of the murals' ground lies on a wall's face"); } }
  // The hall's floor lies all within the walls, so the inside's shut-out sky reaches every corner of it.
  for (const g of h.parts.floor) { const b = (g.computeBoundingBox(), g.boundingBox); for (const [x, z] of [[b.min.x, b.min.z], [b.max.x, b.max.z]]) assert.ok(h.shut(x * 0.999, HALL.floor, z + (z > -12 ? -0.001 : 0.001)) < 1, `the floor's corner (${x}, ${z}) is outside the shut inside`); }
  // Every wall closes up to the roof's underside over its inner face: no slit along a wall's top lets the sun in.
  for (const g of h.parts.plaster) { const b = (g.computeBoundingBox(), g.boundingBox); if (b.min.y < HALL.floor + HALL.column + 0.15) continue;
    const inX = b.max.x - b.min.x < 2, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const innerX = inX ? (cx > 0 ? b.min.x : b.max.x) : 0, innerZ = inX ? (EF + EB) / 2 : (cz > (EF + EB) / 2 ? b.min.z : b.max.z);
    assert.ok(b.max.y >= under(innerX, innerZ) - 0.01, `a wall's top at ${b.max.y.toFixed(2)} leaves a slit under the roof's underside ${under(innerX, innerZ).toFixed(2)} over its inner face`); }
  // The structural review of #425: eleven purlins, one at each rafter's joint, 2.88 m apart about the ridge.
  const zm = (EF + EB) / 2, along = h.parts.wood.map((g) => (g.computeBoundingBox(), g.boundingBox)).filter((b) => b.max.x - b.min.x > 10 && Math.abs(b.max.y - b.min.y - 0.36) < 0.01 && Math.abs(b.max.z - b.min.z - 0.36) < 0.01);
  const zs = [...new Set(along.map((b) => ((b.min.z + b.max.z) / 2).toFixed(2)))].map(Number).sort((a, b) => b - a);
  assert.equal(zs.length, 11, `eleven purlins: ${zs.join(", ")}`);
  zs.forEach((z, i) => assert.ok(Math.abs(z - (zm + HALL.rafter * (5 - i))) < 0.01, `purlin ${i} at ${z}`));
  // The inner columns rise to the lowest tier, under the beam they carry, as the eave columns' bracket sets do.
  for (const g of h.parts.columns.slice(28)) { g.computeBoundingBox(); assert.ok(Math.abs(g.boundingBox.max.y - HALL.beams[0]) < 0.01, "an inner column's head at the lowest tier"); }
  // (From the threshold every head is under the lowest beam: t05-altar.test.mjs holds it with the figures as altar.js stands them.)
  // Nothing of the timber or the walls passes out through the roof, the hipped ends included (#425's review: two purlins did).
  for (const [part, list] of Object.entries({ wood: h.parts.wood, woodZ: h.parts.woodZ, frame: h.parts.frame, plaster: h.parts.plaster })) for (const g of list) {
    g.computeBoundingBox(); const b = g.boundingBox;
    // (a wall may rise into the roof's own thickness over its outer face, to close the roof's underside off; timber may not)
    const lid = part === "plaster" ? HALL.roof - 0.02 : 0.05;
    for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) if (Math.abs(x) <= EX && z <= EF && z >= EB) assert.ok(b.max.y <= under(x, z) + lid, `${part}: a piece up to ${b.max.y.toFixed(2)} passes out through the roof at (${x.toFixed(2)}, ${z.toFixed(2)}), under ${under(x, z).toFixed(2)}`);
  }
});

test("he walks into the hall across the threshold, to stations C, D, E and F, all on the hall's floor, and nowhere through its walls (#422)", () => {
  const targets = file.header.targets;
  for (const id of ["c", "d", "e", "f"]) { const t = targets.find((x) => x.kind === "view" && x.id === id); assert.ok(t && t.new && t.old, `${id} reached on both floors`); }
  for (const k of ["C", "D", "E", "F"]) assert.ok(Math.abs(walker.heightAt(...STATION[k]) - 3) < 0.03, `${k} is on the hall's floor`);
  const zWall = ZS[0] + HALL.front - HALL.wall / 2, mid = (i) => (XS[i] + XS[i + 1]) / 2;
  FRONT.forEach((kind, i) => {
    if (kind === "door") { assert.ok(!walker.blocked(mid(i), zWall), `door ${i} is open`); assert.ok(Math.abs(walker.heightAt(mid(i), zWall) - (3 + HALL.door.sill)) < 0.03, `door ${i}'s sill`); }
    else assert.ok(walker.blocked(mid(i), zWall), `the ${kind} in bay ${i} is not walked through`);
  });
  for (const [x, z] of [[XS[0] + 0.3 - HALL.wall / 2 - 0.3, -12], [0, ZS[ZS.length - 1]], [XS[3], 0]]) assert.ok(walker.blocked(x, z), `wall or column at (${x}, ${z})`);
});

test("T05 builds no censer, no trees, no bell and no seat of its own yet, and its hall is no room under the court: he walks in, with no veil", () => {
  assert.equal(site.censer, null); assert.deepEqual(site.trees, []); assert.deepEqual(site.halls, []); assert.deepEqual(site.strikers, []);
  assert.deepEqual(site.places, {}); assert.deepEqual(site.seats, []);
  assert.equal(level.backdrop, null); assert.equal(level.grove, null); assert.equal(level.zones, null);
});
