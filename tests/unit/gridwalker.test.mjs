// The walker over the floor baked from the drawn meshes (#265, the third step of #161): over the first court it answers
// from the grid, elsewhere from the written plan, and the two meet at the flights between terraces. Every position here
// is read from the plan (site.walk.ramps, site.places, site.seats, site.halls, site.views) or from the grid itself.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { inflateRawSync } from "node:zlib";
const { buildSite, createWalker, SITE, LEVELS } = await import("../../app/src/site.js?real");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createGridWalker, gridsByPlace, courtRegion, walkerMode, ledgesOf, settle, cropGrid, gridBytes } = await import("../../app/src/gridwalker.js");
const { decode, cellOf } = await import("../../app/src/walkgrid.js");
const { stride } = await import("../../app/src/stride.js");
const { CUSHION, STOOL } = await import("../../app/src/geo.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls);
const file = ensure(prepare()), decoded = decode(file.bytes, (b) => inflateRawSync(b));
const region = courtRegion(site, SITE, LEVELS[0]);
const make = (mode) => createGridWalker(createWalker(site), gridsByPlace(decoded, mode, mode === "court" ? region : null), { mode, region: mode === "court" ? region : null, drops: site.walk.drops });
const walker = make("court"), old = createWalker(site);
const inRegion = (x, z) => x > region.x0 && x < region.x1 && z > region.z0 && z < region.z1;

test("the address chooses the walker: the grid over the first court by default, the written plan with ?walker=old, the grid everywhere with ?walker=mesh", () => {
  assert.equal(walkerMode(null), "court"); assert.equal(walkerMode("old"), "old"); assert.equal(walkerMode("mesh"), "mesh"); assert.equal(walkerMode("nonsense"), "court");
  // The region is the first court's terrace, gate and forecourt: from the top of the path's flight to the foot of the library's stair.
  assert.ok(region.z1 <= SITE.fore && region.z1 > SITE.zS && region.z0 > LEVELS[0].zS && region.z0 < LEVELS[0].zS + 8, JSON.stringify(region));
  assert.ok(walker.answers(0, 20) && walker.answers(...site.halls.find((h) => h.id === "tea").out), "the first court is the grid's");
  for (const [x, z] of [[0, LEVELS[0].zS - 5], [0, LEVELS[1].zS - 5], site.start.slice(0, 2)]) {
    assert.ok(!walker.answers(x, z), `(${x}, ${z}) is outside the first court`);
    assert.equal(walker.blocked(x, z), old.blocked(x, z)); assert.equal(walker.heightAt(x, z), old.heightAt(x, z));
  }
  // Indoors and up on the balcony the written plan answers by default; ?walker=mesh asks the grid there too.
  const main = rooms.rooms.main.room, mesh = make("mesh");
  walker.setRoom(main); mesh.setRoom(main);
  try { assert.ok(!walker.answers(main.door[0], main.door[1])); assert.ok(mesh.answers(main.door[0], main.door[1] - 1)); } finally { walker.setRoom(null); mesh.setRoom(null); }
  assert.ok(mesh.answers(0, LEVELS[0].zS - 5), "with ?walker=mesh the terraces are the grid's too");
  // The default page keeps only the court's cells; the whole grid is kept for ?walker=mesh.
  const court = gridBytes(gridsByPlace(decoded, "court", region)), all = gridBytes(gridsByPlace(decoded, "mesh", null));
  assert.ok(court < all / 2, `the court's cells take ${court} bytes of ${all}`);
});

test("the two walkers meet at every flight between the first court and the next terrace or the path: up and down, the floor never jumps and he is never stuck", () => {
  const crossing = site.walk.ramps.filter((r) => [r.low, r.high].some((p) => inRegion(p[0], p[1])) !== [r.low, r.high].every((p) => inRegion(p[0], p[1])) || (r.z1 >= region.z0 - 0.05 && r.z1 <= region.z0 + 0.05) || (r.z0 >= region.z1 - 0.05 && r.z0 <= region.z1 + 0.05));
  assert.ok(crossing.length >= 2, `the library's stair and the path's last flight meet the court, not ${crossing.length} flights`);
  for (const r of crossing) {
    const dx = r.high[0] - r.low[0], dz = r.high[1] - r.low[1], run = Math.hypot(dx, dz), ux = dx / run, uz = dz / run;
    const a = { x: r.low[0] - ux * 2, z: r.low[1] - uz * 2 }, b = { x: r.high[0] + ux * 1, z: r.high[1] + uz * 1 };
    for (const [from, to] of [[a, b], [b, a]]) {
      const pos = { ...from }; let last = walker.heightAt(pos.x, pos.z), worst = 0, sides = new Set();
      assert.ok(!walker.blocked(pos.x, pos.z), `the walk at the flight to ${r.high} starts on open ground`);
      for (let n = 0; n < 2000 && Math.hypot(to.x - pos.x, to.z - pos.z) > 0.03; n++) {
        const d = Math.hypot(to.x - pos.x, to.z - pos.z), s = Math.min(d, 0.04);
        assert.ok(stride(walker, pos, ((to.x - pos.x) / d) * s, ((to.z - pos.z) / d) * s), `stuck at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) on the flight to ${r.high}`);
        const h = walker.heightAt(pos.x, pos.z); worst = Math.max(worst, Math.abs(h - last)); last = h; sides.add(walker.answers(pos.x, pos.z));
      }
      assert.ok(Math.hypot(to.x - pos.x, to.z - pos.z) <= 0.03, `did not get along the flight to ${r.high}`);
      assert.ok(worst < 0.2, `the floor jumped ${worst.toFixed(3)} m on the flight to ${r.high}`);
      assert.equal(sides.size, 2, "the walk crossed from one walker to the other");
    }
  }
});

// The named places of the first court, by a flood over the walker from where he arrives (as plan.test floods).
function flood(w, S = 0.1) {
  const key = (i, j) => i * 100000 + j, seen = new Set(), todo = [[Math.round(site.start[0] / S), Math.round(site.start[1] / S)]];
  seen.add(key(...todo[0]));
  while (todo.length) { const [i, j] = todo.pop(), h = w.heightAt(i * S, j * S); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, k = key(a, b); if (seen.has(k) || w.blocked(a * S, b * S) || Math.abs(w.heightAt(a * S, b * S) - h) > 0.3) continue; seen.add(k); todo.push([a, b]); } }
  return (x, z, r) => { const R = Math.ceil(r / S); for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) if (Math.hypot(a * S, b * S) <= r && seen.has(key(Math.round(x / S) + a, Math.round(z / S) + b))) return true; return false; };
}
test("every named place, seat, door and view of the first court can be walked to on the grid from where he arrives", () => {
  const can = flood(walker), named = [];
  for (const [id, p] of Object.entries(site.places)) if (p.at && !p.room) named.push([`place ${id}`, p.at, p.r ?? 1.0]);
  for (const s of site.seats) if (s.room === null) named.push([`seat ${s.kind}`, s.at, 1.5]);
  for (const h of site.halls) named.push([`door ${h.id}`, h.out, 0.5]);
  for (const [id, v] of Object.entries(site.views)) if (Array.isArray(v) && !site.viewUp?.[id]) named.push([`view ${id}`, [v[0], v[1]], 0.5]);
  const here = named.filter(([, at]) => inRegion(at[0], at[1]));
  assert.ok(here.length >= 20, `only ${here.length} named things in the first court`);
  const lost = here.filter(([, at, r]) => !can(at[0], at[1], r)).map(([n, at]) => `${n} (${at.map((v) => v.toFixed(2))})`);
  assert.deepEqual(lost, [], "not reached on the grid");
});

test("the porch edges are found in the grid (#143): every written edge of the first court has one, at its height, along its line; none on a railed platform", () => {
  const found = ledgesOf(gridsByPlace(decoded, "court", region).outdoors, region);
  const written = site.walk.drops.filter((e) => inRegion((e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2));
  assert.ok(written.length >= 6);
  for (const e of written) {
    const line = e.normal[0] ? e.a[0] : e.a[1], lo = Math.min(e.normal[0] ? e.a[1] : e.a[0], e.normal[0] ? e.b[1] : e.b[0]), hi = Math.max(e.normal[0] ? e.a[1] : e.a[0], e.normal[0] ? e.b[1] : e.b[0]);
    const match = found.filter((f) => f.normal[0] === e.normal[0] && f.normal[1] === e.normal[1] && Math.abs((f.normal[0] ? f.a[0] : f.a[1]) - line) < 0.12 && Math.abs(f.top - e.top) < 0.02);
    const covered = match.reduce((s, f) => { const a = Math.min(f.normal[0] ? f.a[1] : f.a[0], f.normal[0] ? f.b[1] : f.b[0]), b = Math.max(f.normal[0] ? f.a[1] : f.a[0], f.normal[0] ? f.b[1] : f.b[0]); return s + Math.max(0, Math.min(b, hi) - Math.max(a, lo)); }, 0);
    assert.ok(covered >= (hi - lo) * 0.7, `the written edge ${JSON.stringify(e)} is found along ${covered.toFixed(2)} of ${(hi - lo).toFixed(2)} m`);
  }
  // A railed platform (the great hall's) offers none: no open cell along its edge.
  const main = site.buildings.find((b) => b.name === "大雄宝殿") || site.halls.find((h) => h.id === "main");
  for (const f of found) assert.ok(f.top < 1.0, `an edge at ${f.top} m was found, on a railed platform (${JSON.stringify(f)}) ${main ? "" : ""}`);
  assert.ok(walker.drops.length === found.length + site.walk.drops.length - written.length, "outside the court the written edges are kept");
});

// #144: a cushion or stool drawn anywhere is a seat. The drawn meshes are taken apart into their pieces (faces that share
// corners), and every piece the size and height of a CUSHION or STOOL outline is looked for among the seats.
function drawnSeats(root) {
  const found = [], v = new THREE.Vector3(), dims = [["cushion", CUSHION], ["stool", STOOL]].map(([kind, o]) => [kind, 2 * Math.max(...o.map((p) => p[0])), Math.max(...o.map((p) => p[1]))]);
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh) return;
    const p = m.geometry.attributes.position, idx = m.geometry.index, n = p.count; if (n > 400000) return;
    const parent = new Int32Array(n).map((_, i) => i), find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
    const weld = new Map();
    for (let i = 0; i < n; i++) { const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`, j = weld.get(k); if (j === undefined) weld.set(k, i); else parent[find(i)] = find(j); }
    const tris = idx ? idx.count : n; for (let t = 0; t + 2 < tris; t += 3) { const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2; parent[find(b)] = find(a); parent[find(c)] = find(a); }
    const box = new Map();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); const r = find(i); let b = box.get(r); if (!b) box.set(r, (b = new THREE.Box3())); b.expandByPoint(v); }
    for (const b of box.values()) {
      const s = b.getSize(new THREE.Vector3());
      for (const [kind, w, h] of dims) if (Math.abs(s.x - w) < 0.012 && Math.abs(s.z - w) < 0.012 && Math.abs(s.y - h) < 0.012) found.push({ kind, at: [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2] });
    }
  });
  return found;
}
test("every cushion and stool drawn in the courts and the rooms is a seat (#144)", () => {
  const all = [...site.seats, ...rooms.seats], drawn = [...drawnSeats(site.root), ...drawnSeats(rooms.group)];
  if (process.env.SEATS_LOG) console.log(JSON.stringify({ drawn: drawn.length, stools: drawn.filter((d) => d.kind === "stool").length, seats: all.length }));
  assert.ok(drawn.filter((d) => d.kind === "stool").length >= 3 && drawn.filter((d) => d.kind === "cushion").length >= 10, `found ${drawn.length} drawn seats`);
  const none = drawn.filter((d) => !all.some((s) => Math.hypot(s.at[0] - d.at[0], s.at[1] - d.at[1]) < 0.05 && s.kind === d.kind));
  assert.deepEqual(none.map((d) => `${d.kind} at (${d.at.map((x) => x.toFixed(2))})`), [], "drawn, and nothing to sit on");
});

test("a kept place or a ?cam address that falls in a shut cell moves to the nearest open spot within half a metre, or back to the start", () => {
  const g = gridsByPlace(decoded, "court", region).outdoors;
  let tried = 0;
  // Shut cells beside open ones all over the court (by a column, a tree, the censer, a porch's foot): each settles within 0.5 m.
  for (let k = 0; k < g.nx * g.nz && tried < 400; k += 997) {
    const i = k % g.nx, j = (k - i) / g.nx, x = g.x0 + (i + 0.5) * g.step, z = g.z0 + (j + 0.5) * g.step;
    if (!inRegion(x, z) || !g.state[k] || !walker.blocked(x, z)) continue;
    const p = settle(walker, x, z); if (!p) continue; tried++;
    assert.ok(!walker.blocked(p.x, p.z) && Math.hypot(p.x - x, p.z - z) <= 0.5 + 1e-9);
    const c = cellOf(g, p.x, p.z); assert.ok(c >= 0 && g.state[c] === 0, "an open cell of the grid: flooded from where he arrives");
  }
  assert.ok(tried > 30, `only ${tried} shut cells by open ones tried`);
  const main = site.halls.find((h) => h.id === "main"); assert.equal(settle(walker, main.door[0], main.door[1] - 6), null, "deep inside a hall there is nowhere within half a metre");
  const open = site.halls.find((h) => h.id === "tea").out; assert.deepEqual(settle(walker, open[0], open[1]), { x: open[0], z: open[1] }, "an open spot is kept as it is");
});

test("the grid kept in the page is the court's: cut from the whole one cell for cell", () => {
  const whole = decoded.grids.find((g) => g.kind === "outdoors"), part = cropGrid(whole, region);
  for (let n = 0; n < 2000; n++) {
    const x = region.x0 + ((n * 7919) % 1000) / 1000 * (region.x1 - region.x0), z = region.z0 + ((n * 104729) % 1000) / 1000 * (region.z1 - region.z0);
    const a = cellOf(whole, x, z), b = cellOf(part, x, z); assert.ok(a >= 0 && b >= 0);
    assert.equal(part.state[b], whole.state[a]); assert.equal(part.height[b], whole.height[a]);
  }
});
