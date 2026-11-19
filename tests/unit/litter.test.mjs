// The ground keeps what comes down on it (#267): a leaf that touches the paving is handed to the ground's record
// (litter.js) where it touched and stays there; it goes only when the breeze slides it on toward the foot of a wall or a
// step, or his feet scuff it aside. Here the real plan, the real cloud (drift.js) and the real record run in Node.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker, GROVE } = await import("../../app/src/site.js");
const { bakeShelter } = await import("../../app/src/shelter.js");
const { createDrift } = await import("../../app/src/drift.js");
const { createMemory, MEM } = await import("../../app/src/litter.js");
const { WIND_DIR, windAt, gust } = await import("../../app/src/wind.js");
const { groundAt, bakeFall } = await import("../../app/src/fall.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site), shelter = bakeShelter(site.walk.roofs);

// The same cloud every run.
const seeded = (fn) => { const r = Math.random; let a = 7; Math.random = () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296; try { return fn(); } finally { Math.random = r; } };
const MAPLE = [-9.5, 28];   // the first court's maple
const cloud = (season = "leaf", wind = 0, count = 1400) => {
  const d = seeded(() => createDrift(new THREE.Scene(), count, site.trees, { areas: GROVE.areas, land: walker.landAt, shelter, litter: true, keep: 32 }));
  d.setMood({ drift: season, wind }, new THREE.Color(1, 1, 1));
  return d;
};
const eye = new THREE.Vector3(MAPLE[0] + 2, 1.6, MAPLE[1] + 3);
// Runs the cloud frame by frame (30 a second) with the breeze `wind(t)`, reporting every leaf handed over.
function run(d, secs, wind = () => [0, 0], t0 = 100, onLand = null) {
  const mem = d.memory, land = mem.land.bind(mem);
  if (onLand) mem.land = (x, z, id) => { const ok = land(x, z, id); if (ok) onLand(x, z, t); return ok; };
  let t = t0;
  for (let k = 0; k <= secs * 30; k++) { t = t0 + k / 30; d.update(t, eye, 800); const w = wind(t); d.keep(eye.x, eye.z, 1 / 30, w[0], w[1]); }
  mem.land = land; return t;
}

test("a leaf that touches the ground is kept there: 200 tracked, the leaves within 10 cm of where each came down never fewer for a minute after", () => {
  // An autumn day's gusts bring them down (wind.js, shedAt); the breeze no longer moves what lies. Each is watched for the
  // minute after it came down.
  const d = cloud("leaf", 1.05), mem = d.memory, spots = []; let t = 100;
  for (let s = 0; s < 210; s++) {
    t = run(d, 1, () => [0, 0], t, (x, z, at) => { if (spots.length < 200 && Math.hypot(x - MAPLE[0], z - MAPLE[1]) < 8) spots.push({ x, z, t: at, n: null }); });
    for (const p of spots) {
      if (t - p.t > 60) continue;
      const n = mem.amountAt(p.x, p.z, 0.1);
      if (p.n === null) assert.ok(n >= 1, "a leaf that came down is not on the ground");
      else assert.ok(n >= p.n - 1e-9, `the leaves round ${p.x.toFixed(2)}, ${p.z.toFixed(2)} went from ${p.n} to ${n}`);
      p.n = n;
    }
  }
  assert.ok(spots.length >= 200, `only ${spots.length} leaves came down under the maple in 150 s`);
});

test("standing under the maple the leaves on the ground grow, then hold where the old ones sink away as fast as new ones come", () => {
  const d = cloud("leaf", 1.05), mem = d.memory, wind = (t) => { const w = windAt(1.05, t); return [WIND_DIR[0] * w, WIND_DIR[1] * w]; };   // autumn by day (mood.js)
  const under = () => { let n = 0; for (let x = -3; x <= 3; x += 0.5) for (let z = -3; z <= 3; z += 0.5) n += mem.amountAt(MAPLE[0] + x, MAPLE[1] + z, 0.25); return n; };
  const at = {}; let t = 100;
  for (const s of [60, 180, 600, 900]) { t = run(d, s - (at.last || 0), wind, t); at[s] = under(); at.last = s; }
  console.log("under the maple:", JSON.stringify(at), JSON.stringify(mem.stats()));
  assert.ok(at[60] > 0 && at[180] > at[60] * 1.3, "the leaves under the tree do not grow");
  assert.ok(Math.abs(at[900] - at[600]) < 0.15 * at[600], "they keep growing: nothing takes them away");
});

test("the pool keeps a fixed number of leaves each in its place; the oldest gives up its place to the heap, and the heaps sink away", () => {
  const mem = createMemory({ span: 32, pool: 100 }); mem.follow(0, 0);
  for (let i = 0; i < 250; i++) { mem.land(-5 + (i % 50) * 0.2, -3 + Math.floor(i / 50) * 0.3, 1 + (i % 250)); mem.tick(0.05); }
  assert.equal(mem.leaves().length, 100, "the pool is not of a fixed size");
  const last = mem.leaves().some((l) => Math.abs(l[0] - (-5 + 49 * 0.2)) < 1e-6 && Math.abs(l[1] - (-3 + 4 * 0.3)) < 1e-6);
  assert.ok(last, "the newest leaf is not among those kept");
  assert.equal(mem.stats().heaped, 150, "the 150 oldest did not go onto the heaps");
  for (let k = 0; k < 10 * 60 * 12; k++) mem.tick(0.1);   // twelve minutes: four FADEs
  assert.ok(mem.heap() < 5, "the heaps did not sink away: " + mem.heap());
  assert.equal(mem.leaves().length, 100, "the kept leaves went with the heaps");
});

test("his feet scuff the leaves aside, a little", () => {
  const mem = createMemory({ span: 32 }); mem.follow(0, 0);
  for (let i = 0; i < 60; i++) mem.land(-0.3 + (i % 8) * 0.08, -0.3 + Math.floor(i / 8) * 0.08, 1 + i);
  const total = () => mem.leaves().length + mem.heap(), all0 = total(), n0 = mem.amountAt(0, 0, 0.1); mem.kick(0, 0, 0);
  const n1 = mem.amountAt(0, 0, 0.1);
  assert.ok(n1 < n0, `nothing moved under the shoe: ${n0} → ${n1}`);
  assert.ok(Math.abs(total() - all0) < 1e-6, `a scuffed leaf was lost: ${all0} → ${total()}`);
});

test("a tree's leaf does not lie on the ground in the air's cloud: it settles over SETTLE; a bamboo leaf still lies", async () => {
  const { leafAt, LAND } = await import("../../app/src/fall.js");
  const s = [0.3, 0.6, 0.2, 0.5], a = leafAt(null, s, 50, { fall: 0.75, sway: 1 }), b = leafAt(null, s, 50, { fall: 0.4, sway: 1.3, bamboo: true });
  assert.ok(Math.abs(a.P - a.Tf - LAND.SETTLE) < 1e-9 && a.Tr === 0);
  assert.ok(b.Tr >= 3);
});

test("the record follows him and forgets what it leaves behind, as the prints do", () => {
  const mem = createMemory({ span: 32 }); mem.follow(0, 0); mem.land(5, 5, 9);
  assert.equal(mem.leaves().length, 1);
  mem.follow(40, 0); assert.equal(mem.leaves().length, 0);
  assert.equal(mem.land(-20, 0, 3), false, "a leaf outside the square was kept");
});

test("the paving's texture says where each kept leaf lies, to a sixteenth of its cell", () => {
  const mem = createMemory({ span: 8 }); mem.follow(0, 0); mem.land(1.3, -0.7, 77);
  const out = new Uint16Array(2 * mem.N * mem.N * 4); assert.ok(mem.pack(out));
  const ix = Math.floor(1.3 * 4), iz = Math.floor(-0.7 * 4), ci = ((ix % mem.N) + mem.N) % mem.N, cj = ((iz % mem.N) + mem.N) % mem.N, o = (cj * 2 * mem.N + ci * 2) * 4;
  assert.equal(out[o + 1] & 255, 77); const q = out[o + 1] >> 8;
  assert.ok(Math.abs((ix + (Math.floor(q / 16) + 0.5) / 16) / 4 - 1.3) < 1 / 64 && Math.abs((iz + ((q % 16) + 0.5) / 16) / 4 + 0.7) < 1 / 64);
});

test("the trees let go with the gusts: over ten minutes most leaves come down in the gustiest third of the time, few in the stillest", () => {
  const d = cloud("leaf", 1.05), times = [];
  run(d, 600, () => [0, 0], 100, (x, z, at) => times.push(at));
  const g = [], step = 0.25; for (let t = 100; t < 700; t += step) g.push(gust(t));
  const sorted = [...g].sort((a, b) => a - b), lo = sorted[Math.floor(g.length / 3)], hi = sorted[Math.floor((2 * g.length) / 3)];
  const top = times.filter((t) => gust(t) >= hi).length / times.length, low = times.filter((t) => gust(t) <= lo).length / times.length;
  console.log("landings", times.length, "in the gustiest third", top.toFixed(2), "in the stillest", low.toFixed(2));
  assert.ok(top > 0.5, "the gustiest third of the time brings down only " + top.toFixed(2));
  assert.ok(low < 0.1, "the stillest third of the time still brings down " + low.toFixed(2));
});
