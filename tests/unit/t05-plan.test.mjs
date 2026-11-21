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
  for (const [x, z] of [[0, 30], [0, 60], [0, 200]]) assert.equal(old.heightAt(x, z), 0, `the court and the way at 0 (${x}, ${z})`);
  for (const [x, z] of [[0, -12], [20, -20], [0, 8], [15, 12]]) assert.equal(old.heightAt(x, z), 3, `the platform and the terrace at +3 (${x}, ${z})`);
});

test("he arrives at the outer gate's place, and every named view stands where he can walk", () => {
  assert.deepEqual(site.start.slice(0, 2), ARRIVE); assert.deepEqual(ARRIVE, [0, 215]);
  assert.ok(ARRIVE[1] < WAY.zS && ARRIVE[1] > COMPOUND.zS);
  for (const [id, v] of Object.entries(site.views)) assert.ok(!walker.blocked(v[0], v[1]), `${id} (${v[0]}, ${v[1]}) is open floor`);
});

test("from where he arrives he can walk to station A in the court and up the flight to station B on the terrace", () => {
  const targets = file.header.targets;
  for (const id of ["arrive", "a", "b"]) {
    const t = targets.find((x) => x.kind === "view" && x.id === id);
    assert.ok(t, id); assert.ok(t.new, `${id}: reached on the floor baked from what is drawn`); assert.ok(t.old, `${id}: reached by the written plan's walker`);
  }
  assert.ok(Math.abs(walker.heightAt(...STATION.A)) < 0.02, "A is on the court's paving");
  assert.ok(Math.abs(walker.heightAt(...STATION.B) - 3) < 0.02, "B is on the terrace, 3 m up");
  assert.ok(TERRACE.zS - STATION.B[1] >= 1, "B stands at least a metre inside the terrace's edge");
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
  assert.ok(Math.abs(h.roof.eave - 11.81) < 0.01 && Math.abs(h.roof.ridge - 21) < 0.01, "eave about +11.8, ridge about +21 from the court");
  assert.ok(Math.abs(h.roof.EX - h.roof.rx - (h.roof.EF - h.roof.EB) / 2) < 1e-9, "the ends are hipped at 45°: one roof of four slopes and five ridges");
  assert.ok(OUTER.zB > PLATFORM.zS - PLATFORM.d, "the back wall stands on the platform");
});

test("he walks into the hall across the threshold, to stations C, D, E and F, all on the hall's floor, and nowhere through its walls (#422)", () => {
  const targets = file.header.targets;
  for (const id of ["c", "d", "e", "f"]) { const t = targets.find((x) => x.kind === "view" && x.id === id); assert.ok(t && t.new && t.old, `${id} reached on both floors`); }
  for (const k of ["C", "D", "E", "F"]) assert.ok(Math.abs(walker.heightAt(...STATION[k]) - 3) < 0.03, `${k} is on the hall's floor`);
  const zWall = ZS[0] + 0.3 - HALL.wall / 2, mid = (i) => (XS[i] + XS[i + 1]) / 2;
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
