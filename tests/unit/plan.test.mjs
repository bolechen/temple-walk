import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker, SITE, LEVELS, APPROACH, terrain, BODY } = await import("../../app/src/site.js");

// Materials are only handed on to meshes; any object will do, but they must be distinct and cloneable.
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site);

test("the terraces rise one above another, going north", () => {
  for (let i = 1; i < LEVELS.length; i++) { assert.ok(LEVELS[i].y > LEVELS[i - 1].y); assert.ok(LEVELS[i].zS <= LEVELS[i - 1].zN + 1e-6); }
  assert.ok(SITE.zN < SITE.zS && SITE.fore > SITE.zS);
});
test("the land is defined everywhere and has no cliffs where the bamboo stands", () => {
  for (let x = -60; x <= 60; x += 3) for (let z = -160; z <= 110; z += 3) assert.ok(Number.isFinite(terrain(x, z)), `terrain(${x}, ${z})`);
  for (let z = SITE.fore + 1; z < APPROACH.zC1; z += 0.5) assert.ok(Math.abs(terrain(-20, z + 0.5) - terrain(-20, z)) < 1.2, `a cliff beside the approach at z=${z}`);
});
test("the half-way pavilion can be stepped into from the landing, a hand's width at a time", () => {
  for (let z = APPROACH.zMid; z <= APPROACH.zA1 + 2.75; z += 0.03) assert.ok(!walker.blocked(5.2, z), `blocked on the way into the pavilion at z=${z.toFixed(2)}`);
});
test("the eye climbs a stair as a slope, never more than half a tread from the feet", () => {
  for (let z = SITE.fore + 0.2; z < APPROACH.zA0; z += 0.05) {
    const e = walker.eyeAt(0, z), f = walker.heightAt(0, z);
    assert.ok(Math.abs(e - f) < 0.2, `eye ${e} and feet ${f} part company at z=${z}`); assert.ok(Math.abs(walker.eyeAt(0, z + 0.05) - e) < 0.06, `the eye jumps at z=${z}`);
  }
});
test("the enclosure is closed either side of the gate: wall meets the gate's end, and wraps the towers", () => {
  // At a child's eye height, a line of sight from the forecourt toward the court meets something built (wall, gate
  // or tower base) at every point from the gate's end to the corner of the enclosure.
  site.root.updateMatrixWorld(true); const ray = new THREE.Raycaster(); ray.far = 9.5;
  for (const sx of [-1, 1]) for (let x = 9.3; x <= 21.9; x += 0.15) {
    ray.set(new THREE.Vector3(sx * x, 1.3, SITE.zS + 6), new THREE.Vector3(0, 0, -1));
    assert.ok(ray.intersectObject(site.root, true).length > 0, `a gap in the enclosure beside the gate at x=${(sx * x).toFixed(2)}: one can see straight into the court`);
  }
  // and nobody can walk from the forecourt into the court except through the gate
  for (const sx of [-1, 1]) for (let x = 2.8; x <= 21.9; x += 0.1) { let through = true; for (let z = SITE.zS + 4; z >= SITE.zS - 4 && through; z -= 0.1) if (walker.blocked(sx * x, z)) through = false; assert.ok(!through, `one can walk straight through beside the gate at x=${(sx * x).toFixed(1)}`); }
});
test("every named view stands somewhere a visitor could stand", () => {
  for (const [name, [x, z, yaw, pitch]] of Object.entries(site.views)) {
    assert.ok([x, z, yaw, pitch].every(Number.isFinite), name);
    assert.ok(!walker.blocked(x, z), `view "${name}" is inside something at (${x}, ${z})`);
  }
});
test("the plan registers what the rest of the page reads", () => {
  assert.ok(site.walk.solids.length > 20 && site.walk.decks.length > 5 && site.walk.ramps.length >= 6);
  for (const k of ["solids", "decks", "ramps"]) for (const r of site.walk[k]) assert.ok(r.x1 > r.x0 && r.z1 > r.z0, `${k}: an empty rectangle`);
  for (const r of site.walk.ramps) assert.ok(r.h > 0 && r.low && r.high);
  assert.equal(site.shade.length, LEVELS.length + 1);
  for (const list of site.shade) assert.ok(list.length <= 40, "ground.js shades at most 40 rectangles per level, found " + list.length);
  assert.equal(site.strikers.length, 2); assert.deepEqual(site.strikers.map((s) => s.kind).sort(), ["bell", "drum"]);
  assert.ok(site.hall.inside(site.hall.door.x, site.hall.door.z), "the walk to the door ends inside the threshold");
  assert.ok(!site.hall.inside(...site.hall.out), "leaving the hall must not re-enter it");
});

// The highest step a child takes without thinking about it: a porch step, a kerb, a landing. Anything taller is a
// place he must not simply walk up or off (the porches he may hop down from are their own planned leap).
const STEP_UP = 0.45;
// Flood outward from where the visit begins, a quarter-metre at a time, stepping only where a child could.
function reach(from) {
  const S = 0.25, key = (i, j) => i * 100000 + j, seen = new Set(), todo = [[Math.round(from[0] / S), Math.round(from[1] / S)]];
  seen.add(key(...todo[0]));
  while (todo.length) {
    const [i, j] = todo.pop(), x = i * S, z = j * S, h = walker.heightAt(x, z);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj, k = key(a, b); if (seen.has(k)) continue;
      const nx = a * S, nz = b * S; if (walker.blocked(nx, nz) || Math.abs(walker.heightAt(nx, nz) - h) > STEP_UP) continue;
      seen.add(k); todo.push([a, b]);
    }
  }
  return (x, z, r = 0.6) => { for (let dx = -r; dx <= r; dx += S) for (let dz = -r; dz <= r; dz += S) if (seen.has(key(Math.round((x + dx) / S), Math.round((z + dz) / S)))) return true; return false; };
}
test("from the first step, every part of the temple can be walked to", () => {
  const can = reach([site.start[0], site.start[1]]), [T1, T2, TOP] = LEVELS;
  const places = {
    "the half-way pavilion": [5.2, APPROACH.zA1 + 2.75], "the forecourt": [8, 60], "the stele pavilion's side": [-6, 50.5], "inside the gate": [0, 33],
    "the censer": [1.6, 13], "the tea house porch": [-13.4, 14], "the meditation hall porch": [13.4, 14], "the main hall's door": [site.hall.door.x, site.hall.door.z],
    "behind the main hall": [0, -30], "the library terrace": [0, T1.zS - 3], "the dragon well": [13.2, T2.zS + 3], "the Guanyin terrace": [0, T2.zS - 3],
    "the foot of the last stair": [0, T2.zN + 1.5], "the summit": [0, TOP.zS - 3], "the summit pavilion's porch": site.summitPorch,
  };
  for (const [name, [x, z]] of Object.entries(places)) assert.ok(can(x, z), `cannot walk to ${name} (${x}, ${z})`);
});
test("every observance of the journey has a place that can be walked to, and they do not crowd each other", async () => {
  const { SEALS } = await import("../../app/src/journey.js"), { placeAt } = await import("../../app/src/journey.js");
  const can = reach([site.start[0], site.start[1]]);
  assert.deepEqual(Object.keys(site.places).sort(), SEALS.map((s) => s.id).sort());
  for (const [id, p] of Object.entries(site.places)) {
    assert.ok(p.at.every(Number.isFinite) && Number.isFinite(p.face) && p.r > 0.8, id);
    assert.ok(!walker.blocked(p.at[0], p.at[1]), `the place for "${id}" is inside something at (${p.at})`);
    assert.ok(can(p.at[0], p.at[1], 0.3), `cannot walk to the place for "${id}" at (${p.at})`);
    assert.equal(placeAt(site.places, p.at[0], p.at[1]), id);
    for (const [other, q] of Object.entries(site.places)) if (other !== id) assert.ok(Math.hypot(p.at[0] - q.at[0], p.at[1] - q.at[1]) > p.r + q.r, `${id} and ${other} overlap`);
  }
  assert.ok(site.places.lamp.flame.every(Number.isFinite) && site.places.tea.steam.every(Number.isFinite) && site.places.well.pool.every(Number.isFinite));
  assert.ok(walker.heightAt(...site.places.sit.at) > 20.5, "the last seal is earned on the summit pavilion's porch");
});
test("every hall with a door can be walked up to, entered at its threshold, and left onto open floor", () => {
  const can = reach([site.start[0], site.start[1]]);
  assert.deepEqual(site.halls.map((h) => h.id).sort(), ["chan", "dahui", "guanyin", "library", "lingxiao", "main", "tea", "yaoshi"]);
  for (const h of site.halls) {
    assert.ok(h.inside(h.door[0], h.door[1]), `${h.name}: its door is not its threshold`);
    assert.ok(!h.inside(h.out[0], h.out[1]), `${h.name}: coming out would go straight back in`);
    assert.ok(!walker.blocked(h.out[0], h.out[1]) && can(h.out[0], h.out[1], 0.3), `${h.name}: nowhere to stand on coming out at (${h.out})`);
    assert.ok(Number.isFinite(h.outYaw) && h.name && h.kind);
  }
});
test("the columns of the open pavilions stand in the way", () => {
  assert.ok(site.walk.posts.length >= 8, "the pavilions on the approach have columns");
  for (const r of site.walk.posts) {   // a round post is its centre and radius; a square one is its rectangle
    const x = r.r !== undefined ? r.x : (r.x0 + r.x1) / 2, z = r.r !== undefined ? r.z : (r.z0 + r.z1) / 2; assert.ok(walker.blocked(x, z) && walker.wall(x, z), `he can walk through what stands at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    if (r.r !== undefined) { assert.ok(walker.blocked(x + r.r + BODY - 0.02, z), `his sleeve can enter the column at (${x.toFixed(1)}, ${z.toFixed(1)})`); }
  }
  assert.ok(site.walk.posts.filter((r) => r.r !== undefined).length >= 100, "every outer column of every building is a post");
  assert.ok(!walker.blocked(5.2, APPROACH.zA1 + 2.75), "the middle of the half-way pavilion is open floor");
});
// The walk itself sets no limit on a step: wherever nothing blocks him, he stands at the height of what is under him.
// So the plan must never leave two open spots side by side at heights a child could not step between, or he would
// rise onto a porch or drop off a terrace in one stride. Searched on a grid no coarser than his hurried stride in one
// frame (4.2 m/s for a twentieth of a second), and in every direction, without the limit the walk-to test assumes.
// Today the tallest such step is 0.3 m, at the landings by the bamboo start.
test("nowhere he can walk is there a step taller than a child's", () => {
  const S = 0.2, key = (i, j) => i * 100000 + j, start = [Math.round(site.start[0] / S), Math.round(site.start[1] / S)], seen = new Set([key(...start)]), todo = [start];
  let worst = { d: 0 };
  while (todo.length) {
    const [i, j] = todo.pop(), x = i * S, z = j * S, h = walker.heightAt(x, z);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj, nx = a * S, nz = b * S; if (walker.blocked(nx, nz)) continue;
      const d = Math.abs(walker.heightAt(nx, nz) - h); if (d > worst.d) worst = { d, x, z, nx, nz };
      const k = key(a, b); if (!seen.has(k)) { seen.add(k); todo.push([a, b]); }
    }
  }
  assert.ok(seen.size > 50000, `the flood should cover the whole walk, not ${seen.size} spots`);
  assert.ok(worst.d <= STEP_UP, `a step of ${worst.d.toFixed(2)} m between (${worst.x?.toFixed(1)}, ${worst.z?.toFixed(1)}) and (${worst.nx?.toFixed(1)}, ${worst.nz?.toFixed(1)})`);
});
test("walls, halls and the hillside keep the visitor out", () => {
  const can = reach([site.start[0], site.start[1]]), [T1, T2] = LEVELS;
  assert.ok(!can(0, -14.6, 0.3), "inside the main hall");
  assert.ok(!can(30, 10, 0.3), "outside the east wall");
  assert.ok(!can(12, (T2.zN + LEVELS[2].zS) / 2, 0.3), "on the tea slope, off the stair");
});
test("heights: the courts are level, the stairs climb evenly", () => {
  assert.equal(walker.heightAt(0, 20), 0); assert.equal(walker.heightAt(0, LEVELS[0].zS - 5), LEVELS[0].y);
  for (const r of site.walk.ramps) {
    let last = null; const run = Math.hypot(r.high[0] - r.low[0], r.high[1] - r.low[1]);
    // A stair is treads: the height holds across a tread and rises by one step, never more, and it ends at the top.
    assert.ok(Math.abs(walker.heightAt(r.high[0] + (r.low[0] - r.high[0]) * 0.01, r.high[1] + (r.low[1] - r.high[1]) * 0.01) - ((r.base || 0) + r.h)) < 1e-6, "the top tread is the landing's height");
    for (let t = 0.005; t <= 0.995; t += 0.005) { const x = r.low[0] + (r.high[0] - r.low[0]) * t, z = r.low[1] + (r.high[1] - r.low[1]) * t; if (x <= r.x0 || x >= r.x1 || z <= r.z0 || z >= r.z1) continue; const h = walker.heightAt(x, z); if (last !== null) assert.ok(h >= last - 1e-6 && h - last < 0.2, `a stair that does not climb a step at a time near (${x.toFixed(1)}, ${z.toFixed(1)}): ${last.toFixed(2)} to ${h.toFixed(2)}`); last = h; }
  }
});
