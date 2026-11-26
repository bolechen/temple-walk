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
const { BAYS, HALL, FRONT, XS, ZS, OUTER, buildHall, HALL_DOORS } = await import("../../app/levels/t05/hall.js");
// While the great hall's doors are shut (the first release, DECISIONS.md 先行版关殿门) the views inside it cannot be walked to: `site.closedViews`. One constant, hall.js `HALL_DOORS.shut`, brings them back.
const SHUT = HALL_DOORS.shut;
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const level = await loadLevel("t05"), site = buildSite(M), CLOSED = new Set(site.closedViews);
const file = ensure(prepare(level)), decoded = decode(file.bytes, (b) => inflateRawSync(b));
const old = createWalker(site), walker = createGridWalker(createWalker(site), gridsByPlace(decoded), { doors: site.halls });

test("the platform, the terrace and the flight are SITE.md's sizes, the court's paving at 0 and the floors at +3", () => {
  assert.deepEqual([PLATFORM.w, PLATFORM.d, PLATFORM.h, PLATFORM.zS], [55.8, 26.21, 3.0, 0.5]);      // SITE.md §1.1, §3.1 (S03, S10: 25.91 deep, south edge +0.4), 0.2 m out behind to hold the back wall and 0.1 m out in front under the corner columns (#493)
  assert.deepEqual([TERRACE.w, TERRACE.d, TERRACE.zN, TERRACE.zS], [37, 14.9, 0.5, 15.4]);           // SITE.md §1.1, §3.1 (a summary), its north edge on the platform's (#493)
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
  for (const [id, v] of Object.entries(site.views)) if (!CLOSED.has(id)) assert.ok(!walker.blocked(v[0], v[1]), `${id} (${v[0]}, ${v[1]}) is open floor`);
  assert.deepEqual([...CLOSED].sort(), SHUT ? ["cam04", "cam05", "cam06", "d", "e", "f", "sakya"] : [], "the views closed are the ones inside the hall, and none once it is open");
});

test("the seven fixed views of the handoff (PRD.md §3, §9 item 4) stand on the baked floor, are reached from where he arrives, and the manifest says what the plan says", async () => {
  const fs = await import("node:fs"), targets = file.header.targets;
  const manifest = JSON.parse(fs.readFileSync(new URL("../../docs/t05/camera-manifest.json", import.meta.url), "utf8"));
  const { default: checks } = await import("../../app/levels/t05/checks.js");
  assert.deepEqual(Object.keys(checks.cameras.what), ["cam01", "cam02", "cam03", "cam04", "cam05", "cam06", "cam07"]);
  for (const [i, id] of ["cam01", "cam02", "cam03", "cam04", "cam05", "cam06", "cam07"].entries()) {
    const v = site.views[id]; assert.ok(v, id);
    const c0 = manifest.cameras[i]; assert.equal(!!c0.closed, CLOSED.has(id), `${id}: the manifest says closed exactly when the plan does`);
    if (CLOSED.has(id)) { assert.ok(!targets.some((x) => x.kind === "view" && x.id === id), `${id}: a closed view is not asked to be walked to`); assert.deepEqual([c0.position.length, c0.view], [3, id]); continue; }
    assert.ok(!walker.blocked(v[0], v[1]), `${id} (${v[0]}, ${v[1]}) is open on the baked floor`);
    const t = targets.find((x) => x.kind === "view" && x.id === id);
    assert.ok(t && t.new, `${id}: reached from the arrival on the floor baked from what is drawn`);
    const c = manifest.cameras[i], at = c.stands_at || c.position; assert.equal(c.view, id);   // (cam03's still is taken from the following eye behind him: stands_at is where he stands)
    assert.deepEqual([at[0], at[2], c.yaw_rad, c.pitch_rad], [+v[0].toFixed(2), +v[1].toFixed(2), +v[2].toFixed(2), +v[3].toFixed(2)], `${id}: the manifest is the plan's`);
  }
});

test("from views.sakya nothing stands between his eye and Shakyamuni's lotus seat or his lap (#547: the west aisle hides them)", async () => {
  const { FIGURES, ALTAR, SEAT } = await import("../../app/levels/t05/altar.js");
  const named = (k) => Object.assign(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), { name: String(k) });
  const M2 = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
  const s2 = buildSite(M2); s2.root.updateMatrixWorld(true);
  const f = FIGURES.find((x) => x.id === "sakyamuni"), top = PLATFORM.h + ALTAR.h, [x, z] = site.views.sakya;
  const eye = new THREE.Vector3(x, walker.heightAt(x, z) + 1.3, z), ray = new THREE.Raycaster();
  // (the lotus's front face at its middle, and a point in his lap: what the first thing met along the line must be is the figure's own seat or body)
  for (const [name, p] of [["lotus", [f.x, top + SEAT.sumeru + SEAT.lotus / 2, SEAT.z + SEAT.d / 2]], ["lap", [f.x + 0.3, top + SEAT.sumeru + SEAT.lotus + 1.3, SEAT.z + 0.9]]]) {
    const t = new THREE.Vector3(...p), d = t.clone().sub(eye), L = d.length(); ray.set(eye, d.normalize()); ray.far = L + 1;
    const hit = ray.intersectObject(s2.root, true)[0];
    assert.ok(hit && hit.distance > L - 0.8, `${name}: the first thing met is ${hit ? `${(L - hit.distance).toFixed(2)} m short of it` : "nothing"}`);
  }
  assert.ok(x > f.x, "east of his middle, so that his left side is turned to the eye");
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
  assert.ok(HALL.wall >= 1.0, "the walls 1.0 m thick at least (ARCHITECTURE.md §4.2)");
  // Every column of the end and back walls has its outer face inside the wall's outer face, and every column stands on the
  // platform, its outer face inside the platform's edges (the structural review of #493).
  const h0 = buildHall(M), pX = PLATFORM.w / 2, pN = PLATFORM.zS - PLATFORM.d;
  for (const [x, z] of h0.columns) {
    if (z < -0.01) assert.ok(Math.abs(x) + HALL.colR <= OUTER.x + 1e-9 && z - HALL.colR >= OUTER.zB - 1e-9, `the column at (${x.toFixed(2)}, ${z.toFixed(2)}) is inside its wall`);   // (the front ones stand proud of the front wall, as #425 has them)
    assert.ok(Math.abs(x) + HALL.colR <= pX && z - HALL.colR >= pN && z + HALL.colR <= PLATFORM.zS, `the column at (${x.toFixed(2)}, ${z.toFixed(2)}) stands on the platform`);
  }
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
  const { EF, EB, EX } = h.roof, under = h.roof.underAt;   // (the folded roof's underside, roof.js)
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
    // (a gongyan board, 3.7 cm thick, closes up to the underside over its own line: it is the one leaf between the cap board and the roof)
    const thin = Math.min(b.max.x - b.min.x, b.max.z - b.min.z) < 0.1;
    const innerX = inX ? (thin ? cx : cx > 0 ? b.min.x : b.max.x) : 0, innerZ = inX ? (EF + EB) / 2 : (thin ? cz : cz > (EF + EB) / 2 ? b.min.z : b.max.z);
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
  for (const id of SHUT ? ["c"] : ["c", "d", "e", "f"]) { const t = targets.find((x) => x.kind === "view" && x.id === id); assert.ok(t && t.new && t.old, `${id} reached on both floors`); }
  for (const k of ["C", "D", "E", "F"]) assert.ok(Math.abs(walker.heightAt(...STATION[k]) - 3) < 0.03, `${k} is on the hall's floor`);
  // (the sill lies under the frame, in the wall's outer third: hall.js)
  const zWall = ZS[0] + HALL.front - HALL.wall / 2, zSill = ZS[0] + HALL.front - HALL.wall / 6, mid = (i) => (XS[i] + XS[i + 1]) / 2;
  FRONT.forEach((kind, i) => {
    if (kind === "door" && SHUT) assert.ok(walker.blocked(mid(i), zWall) && old.blocked(mid(i), zWall), `door ${i} is shut: on both floors`);
    if (kind === "door") { if (!SHUT) assert.ok(!walker.blocked(mid(i), zWall), `door ${i} is open`); assert.ok(Math.abs(walker.heightAt(mid(i), zSill) - (3 + HALL.door.sill)) < 0.03, `door ${i}'s sill`); }
    else assert.ok(walker.blocked(mid(i), zWall), `the ${kind} in bay ${i} is not walked through`);
  });
  for (const [x, z] of [[XS[0] + HALL.out - HALL.wall / 2 - 0.3, -12], [0, ZS[ZS.length - 1]], [XS[3], 0]]) assert.ok(walker.blocked(x, z), `wall or column at (${x}, ${z})`);
});

test("T05 builds no censer, no trees, no bell and no seat of its own yet, and its hall is no room under the court: he walks in, with no veil; its one place of its own is the stele's (stele.js)", () => {
  assert.equal(site.censer, null); assert.deepEqual(site.trees, []); assert.deepEqual(site.halls, []); assert.deepEqual(site.strikers, []);
  assert.deepEqual(Object.keys(site.places), ["copy"]); assert.deepEqual(site.seats, []);
  assert.equal(level.backdrop, null); assert.equal(level.grove, null);
  assert.deepEqual(Object.keys(level.zones), ["layers"], "sound layers only, no music zones: it has no melody yet (t05-sound.test.mjs)");
});

test("the hall's fill is out while the eye is in the court and comes up as he walks in, over seconds, never at a jump (#481)", async () => {
  const { FILL } = await import("../../app/levels/t05/hall.js");
  const h = buildHall(M), s = buildSite(M), eye = (x, z, y = 4.6) => ({ x, y, z });
  for (const [x, z] of [STATION.A, STATION.B, [0, 9.5]]) assert.equal(h.within(x, 4.6, z), 0, `no fill seen from (${x}, ${z})`);
  if (SHUT) {   // the doors are shut (HALL_DOORS): the hall's light stays out wherever the eye is, a window's bars included (the art director's call on the first pictures), and comes back with `shut: false`
    for (const [x, z] of [STATION.C, [0, 1], [-16.4, 1], STATION.F, STATION.E]) assert.equal(h.within(x, 4.6, z), 0, `no fill at (${x}, ${z}) while the doors are shut`);
    for (let i = 0; i < 20; i++) assert.equal(s.tick(0.05, eye(-16.4, 1), false), 0);
    return;
  }
  for (const k of ["E", "D"]) assert.equal(h.within(STATION[k][0], 4.6, STATION[k][1]), 1, `the whole fill at ${k}`);
  assert.ok(h.within(...[STATION.F[0], 4.6, STATION.F[1]]) > 0.9, "nearly all of it at F, 2 m in");
  // from 9 m out to 3 m in it rises without a step: never more than 2% of it over 5 cm walked
  for (let z = 9.1, prev = 0; z > -3.1; z -= 0.05) { const k = h.within(0, 4.6, z); assert.ok(k >= prev && k - prev <= 0.02, `at z ${z.toFixed(2)}`); prev = k; }
  // the court's picture is drawn with the fill out, however long he stands there
  for (let i = 0; i < 50; i++) assert.equal(s.tick(0.05, eye(0, 9.5), false), 0);
  // walking in at his pace (2.1 m/s, 20 frames a second) from the threshold to E: it rises steadily, never more than 5% a frame
  let last = 0, rise = 0, frames = 0;
  for (let z = 9.5; z > STATION.E[1]; z -= 2.1 * 0.05) { const k = s.tick(0.05, eye(0, z), false); assert.ok(k >= last - 1e-9, "it only rises walking in"); rise = Math.max(rise, k - last); last = k; frames++; }
  assert.ok(rise <= 0.05, `the most in one frame ${rise.toFixed(3)}`);
  for (let i = 0; i < 80; i++) last = s.tick(0.05, eye(...STATION.E), false);
  assert.equal(last, 1, "settled once he stands inside");
  assert.equal(s.tick(0.05, eye(...STATION.A), false), 0, "a jump of the eye takes the light of where it lands");
  assert.ok(FILL.door > 0 && FILL.up > 0 && FILL.depth > 0 && frames > 0);
});

test("the fill comes from the doors and from under the floor: the openings' light from before the hall and above, none in the air under the roof (#493, #549, #754)", async () => {
  const { FILL } = await import("../../app/levels/t05/hall.js"), { ALTAR, FIGURES, SEAT } = await import("../../app/levels/t05/altar.js");
  const h = buildHall(M), y0 = HALL.floor, zf = ZS[0] + HALL.front - HALL.wall, zb = ZS[ZS.length - 1] - HALL.out + HALL.wall, X = XS[XS.length - 1] + HALL.out - HALL.wall;
  assert.ok(h.fill.length <= 5, "no more lights than the five of #549 (each is in every shader, outdoors too)");
  assert.ok(h.fill.every((f) => f[6]), "every one a spot, turned somewhere: no lamp lights the whole room");
  const doors = h.fill.filter((f) => f[1] > y0), up = h.fill.filter((f) => f[1] < y0);
  assert.equal(doors.length, 2, "two wide spots for the openings' light (four cost 1.4 ms more on a T4's high tier, #493)");
  // The openings' light (#754): it stands for the daylight the doors and windows let in, so it comes from before the hall and a little above
  // the faces (y0 + 10.5 to 11.5 m), turned down onto the figures; from inside the hall the front wall's inner face looks away from it.
  for (const [x, y, z, , , , aim] of doors) {
    assert.ok(z > zf && z < zf + 12 && Math.abs(x) < X, `a door's light stands before the hall (${x}, ${z.toFixed(2)})`);
    assert.ok(aim[2] < ALTAR.zF && aim[2] > zb, "and is turned to the altar");
    assert.ok(y > aim[1] && y > y0 + 11, "above the faces and turned down at them, so the light comes from in front and above, not from below");
  }
  // The timber's light comes from under the floor over the worship band, narrow and turned up: a light hung in the air under this roof is close to
  // the beams (9–10 m) or the boards (15–19 m) wherever it hangs, and laid a bright spot on one of them (#549: 30 L* at 13 m, the beams at 9 m).
  assert.equal(up.length, 3);
  for (const [x, y, z, , , , aim, angle] of up) {
    assert.ok(y < y0 && y > y0 - 1 && z > ALTAR.zF + 3 && z < zf - 3 && Math.abs(x) < X - 3, `under the floor, over the worship band (${x}, ${z})`);
    assert.ok(aim[1] > y0 + 10 && Math.hypot(aim[0] - x, aim[2] - z) < 0.3 * (aim[1] - y), "turned up into the roof, leaning no more than a few degrees");
    assert.ok(angle <= 1, "a narrow spot, so that the walls stand outside it");
    // and the seven stand outside it (#754): lit from under the floor their faces read upside down, chin and nose bright, and the lotus glared
    const axis = [aim[0] - x, aim[1] - y, aim[2] - z], n = Math.hypot(...axis);
    for (const f of FIGURES) for (const fy of [y0 + ALTAR.h + 2.5, y0 + 10.5]) {
      const v = [f.x - x, fy - y, SEAT.z - z], c = (v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2]) / (n * Math.hypot(...v));
      assert.ok(Math.acos(c) > angle, `the figure at x ${f.x} stands outside the timber's light from (${x}, ${z})`);
    }
  }
  for (const [, , , i, d] of h.fill) assert.ok(i > 0 && d > 0);
  assert.ok(FILL.door > 0 && FILL.up > 0);
});

test("the timber overhead takes more of the inside's light than the walls, from over the doors' middle up; the walls keep theirs (#493)", async () => {
  const { TIMBER } = await import("../../app/levels/t05/hall.js");
  const h = buildHall(M), y0 = HALL.floor;
  assert.equal(h.timberShut(0, y0 + 1, -10), h.shut(0, y0 + 1, -10), "low in the hall, as the walls");
  assert.ok(Math.abs(h.timberShut(0, y0 + 9, -10) - Math.min(3, HALL.inside * TIMBER.lift)) < 1e-9, "high up, TIMBER.lift times the walls'");
  assert.equal(h.timberShut(0, y0 + 9, 30), 1, "outside the hall the sky is not shut out, timber or not");
  for (let y = y0; y < y0 + 10; y += 0.05) { const a = h.timberShut(0, y, -10), b = h.timberShut(0, y + 0.05, -10); assert.ok(b >= a && b - a < 0.15, `no step at ${y.toFixed(2)}`); }
});

test("the wall ring's timber (frames, tie-beams, brackets) keeps the walls' share while the roof's timber rises: the roof's beams and purlins above it, its boards below (#608)", async () => {
  const { TIMBER } = await import("../../app/levels/t05/hall.js");
  const h = buildHall(M), y0 = HALL.floor, at = [0, y0 + 9, -10];
  // (the bracket sets, their beams and the eave purlin are the ring's too, in lists of their own that the page keeps out of the floor's mirror: #741)
  assert.ok(h.parts.ring.size > 20 && h.parts.bracketsX.length + h.parts.bracketsZ.length > 60, "the ring's boxes and the bracket sets are recorded");
  const brackets = h.parts.wood.filter((g) => h.parts.ring.has(g)), purlins = h.parts.wood.filter((g) => !h.parts.ring.has(g));
  assert.ok(brackets.length > 0 && purlins.length > 0 && purlins.length < 30, "the purlins stand apart from the ring");
  assert.ok(Math.abs(h.ringShut(...at) - Math.min(3, HALL.inside * TIMBER.ring)) < 1e-9, "the ring takes TIMBER.ring times the walls'");
  assert.ok(h.beamShut(...at) > h.ringShut(...at) && h.timberShut(...at) > h.ringShut(...at) && h.ringShut(...at) > h.boardShut(...at), "the beams' and purlins' share over the ring's over the boards'");
  assert.ok(TIMBER.ring < TIMBER.lift && TIMBER.ring < TIMBER.beam && TIMBER.board < TIMBER.ring, "in the numbers too");
});

test("a wall's inner face is inside all the way to its corners, its outer face outside, and the murals stay within the inner faces (#481)", () => {
  const h = buildHall(M), X = XS[XS.length - 1], xi = X + HALL.out - HALL.wall, zf = ZS[0] + HALL.front - HALL.wall, zb = ZS[ZS.length - 1] - HALL.out + HALL.wall;
  // the east end wall's inner face at its front corner, inside the front wall's thickness: looking in, so inside
  assert.equal(h.shut(xi, 6, ZS[0] + HALL.front - 0.01, -1, 0, 0), HALL.inside);
  assert.equal(h.shut(-xi, 6, zb - 0.2, 1, 0, 0), HALL.inside, "the west wall's inner face where it runs into the back wall");
  assert.equal(h.shut(X - 1, 6, zf, 0, 0, -1), HALL.inside, "the front wall's inner face over the east end bay");
  // the outer faces, and a face looking along the wall, are not
  assert.equal(h.shut(X + HALL.out, 6, -10, 1, 0, 0), 1); assert.equal(h.shut(0, 6, ZS[0] + HALL.front, 0, 0, 1), 1);
  assert.equal(h.shut(xi + 0.4, 6, -0.5, 0, 0, 1), 1, "the end of a wall seen from the court");
  for (const g of h.parts.mural) { g.computeBoundingBox(); const b = g.boundingBox; assert.ok(Math.max(-b.min.x, b.max.x) <= xi + 1e-6 && b.max.z <= zf + 1e-6 && b.min.z >= zb - 1e-6, "a mural's ground within the inner faces"); }
});

test("while the doors are shut each of the four windows has an unseen sheet that casts the sun's shadow, so that no striped patch of sun lies on the floor inside (the first review, winter day)", () => {
  const h = buildHall(M), windows = FRONT.filter((k) => k === "window").length;
  assert.equal(windows, 4);
  assert.equal(h.parts.windowShade.length, SHUT ? windows : 0, SHUT ? "one sheet to each window" : "no sheet once the hall is open");
  for (const g of h.parts.windowShade) { g.computeBoundingBox(); const b = g.boundingBox; assert.ok(b.max.x - b.min.x > 4 && b.max.y - b.min.y > 3.5 && b.max.z - b.min.z < 0.05, "a thin sheet over the window's opening"); }
});
