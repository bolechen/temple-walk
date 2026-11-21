// The walker over the floor baked from the drawn meshes (#265, #274: the third and fourth steps of #161): everywhere a walk
// is laid out (the courts and the path, every room, the summit pavilion's balcony) it answers from the grid. Every position
// here is read from the plan (site.walk.ramps, site.places, site.seats, site.halls, site.views, the rooms) or from the grid.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { inflateRawSync } from "node:zlib";
const { buildSite, createWalker, SITE, LEVELS } = await import("../../app/src/site.js?real");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createGridWalker, gridsByPlace, walkerMode, ledgesOf, settle, gridBytes } = await import("../../app/src/gridwalker.js");
const { findDrop } = await import("../../app/src/drop.js");
const { decode, cellOf, NO_FLOOR } = await import("../../app/src/walkgrid.js");
const { stride } = await import("../../app/src/stride.js");
const { CUSHION, STOOL } = await import("../../app/src/geo.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { reach, BAKE } = await import("../../tools/walk/bake.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls);
const file = ensure(prepare()), decoded = decode(file.bytes, (b) => inflateRawSync(b));
const grids = gridsByPlace(decoded), walker = createGridWalker(createWalker(site), grids, { doors: site.halls }), old = createWalker(site);
const G = grids.outdoors, xOf = (g, k) => g.x0 + ((k % g.nx) + 0.5) * g.step, zOf = (g, k) => g.z0 + (Math.floor(k / g.nx) + 0.5) * g.step;
/** Run `fn` with him in a room, or up on a balcony, and put him back out of doors. */
const within = (where, fn) => { try { if (where.room) walker.setRoom(where.room); if (where.loft) walker.setLoft(where.loft); return fn(); } finally { walker.setRoom(null); walker.setLoft(null); } };

test("the address chooses the walker: the baked floor everywhere by default, the written plan with ?walker=old", () => {
  assert.equal(walkerMode(null), "mesh"); assert.equal(walkerMode("old"), "old"); assert.equal(walkerMode("mesh"), "mesh"); assert.equal(walkerMode("nonsense"), "mesh");
  // Out of doors: the start of the path, the forecourt, the first court, each terrace above it, the summit.
  const outdoors = [site.start.slice(0, 2), [0, (SITE.zS + SITE.fore) / 2], [0, 20], ...LEVELS.map((L) => [0, L.zS - 2])];
  for (const [x, z] of outdoors) assert.ok(walker.answers(x, z) && !walker.blocked(x, z), `(${x}, ${z}) is open floor of the grid`);
  // In every room, and up on the balcony.
  assert.equal(Object.keys(grids.rooms).length, site.halls.length, "a grid for every hall's room");
  for (const [id, r] of Object.entries(rooms.rooms)) within({ room: r.room }, () => assert.ok(walker.answers(r.room.door[0], r.room.door[1]) && !walker.blocked(r.room.door[0], r.room.door[1]), `inside the door of ${id} is open floor of its own grid`));
  for (const [id, L] of Object.entries(site.lofts)) within({ loft: id }, () => {
    assert.ok(walker.answers(L.door[0], L.door[1]) && !walker.blocked(L.door[0], L.door[1]), `the balcony of ${id} at its door`);
    assert.ok(Math.abs(walker.heightAt(L.door[0], L.door[1]) - L.floor) < 0.02, "at the balcony's own height");
  });
  assert.ok(gridBytes(grids) > 1e6);
  // The page hands these about as plain functions (the novice is given `walker.heightAt` and `walker.eyeAt` to ask): none may lean on `this`.
  const [x, z] = site.start, r = site.walk.ramps[0], mid = [(r.low[0] + r.high[0]) / 2, (r.low[1] + r.high[1]) / 2];
  for (const name of ["heightAt", "blocked", "eyeAt", "onStairs", "onGround", "floorAt", "landAt", "wall", "answers"]) { const f = walker[name]; assert.doesNotThrow(() => { f(x, z); f(mid[0], mid[1]); }, `walker.${name} called on its own`); }
});

test("on every flight of the plan, up and down, the floor never jumps, he is never stuck, and the eye climbs it as a slope", () => {
  let walked = 0; const skipped = [];
  for (const r of site.walk.ramps) {
    const dx = r.high[0] - r.low[0], dz = r.high[1] - r.low[1], run = Math.hypot(dx, dz), ux = dx / run, uz = dz / run;
    const a = { x: r.low[0] - ux * 0.8, z: r.low[1] - uz * 0.8 }, b = { x: r.high[0] + ux * 0.25, z: r.high[1] + uz * 0.25 };
    // (A flight whose foot or head the grid does not let him stand at on its middle line: one down the middle of which
    // something stands. There is none now; were there one, it is named.)
    if (walker.blocked(a.x, a.z) || walker.blocked(b.x, b.z)) { skipped.push(`the flight to (${r.high.map((v) => v.toFixed(1))})`); continue; }
    walked++;
    for (const [from, to] of [[a, b], [b, a]]) {
      const pos = { ...from }; let last = walker.heightAt(pos.x, pos.z), worst = 0, eye = walker.eyeAt(pos.x, pos.z), eyeJump = 0, stairs = 0;
      for (let n = 0; n < 4000 && Math.hypot(to.x - pos.x, to.z - pos.z) > 0.03; n++) {
        const d = Math.hypot(to.x - pos.x, to.z - pos.z), s = Math.min(d, 0.04);
        assert.ok(stride(walker, pos, ((to.x - pos.x) / d) * s, ((to.z - pos.z) / d) * s), `stuck at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) on the flight to ${r.high}`);
        const h = walker.heightAt(pos.x, pos.z); worst = Math.max(worst, Math.abs(h - last)); last = h; if (walker.onStairs(pos.x, pos.z)) stairs++;
        const e = walker.eyeAt(pos.x, pos.z); eyeJump = Math.max(eyeJump, Math.abs(e - eye)); eye = e;
      }
      assert.ok(Math.hypot(to.x - pos.x, to.z - pos.z) <= 0.03, `did not get along the flight to ${r.high}`);
      assert.ok(worst < 0.2, `the floor jumped ${worst.toFixed(3)} m on the flight to ${r.high}`);
      assert.ok(stairs > 3, `the flight to ${r.high} is walked as a stair`);
      assert.ok(eyeJump < 0.2, `the eye jumped ${eyeJump.toFixed(3)} m in a 4 cm step on the flight to ${r.high}`);
    }
  }
  assert.ok(walked >= 16, `only ${walked} flights walked`);
  assert.deepEqual(skipped, [], "flights not walked on their middle line");
});

test("every named place can be walked to on the baked floor from where he comes in: places, seats, doors, views, each frame, the offering box, the stair's foot, the indoor cameras, the balcony's door", () => {
  const T = file.header.targets, kinds = {};
  for (const t of T) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
  for (const [kind, least] of [["place", 7], ["seat", 40], ["door", site.halls.length], ["view", 40], ["spot", 30], ["stair", 1], ["hallview", 16], ["loftdoor", 1]]) assert.ok((kinds[kind] || 0) >= least, `${kinds[kind] || 0} of kind ${kind} checked, not ${least}`);
  assert.ok(T.some((t) => t.kind === "spot" && rooms.spots[t.id]?.offering), "the offering box is among them");
  assert.deepEqual(T.filter((t) => !t.new).map((t) => `${t.kind} ${t.id} (${t.grid})`), [], "not reached on the drawn floor");
});

// #148 (the owner: 殿两边有空间但是走不过去). Round every hall, wherever its platform is drawn wide enough for him between
// the wall and the edge (or the railing), he can walk: the open floor at the platform's height runs along each of its four
// sides, and all of it is one piece with the floor before its door. A hall where that does not hold is named here with why.
const NARROW = {};   // (the summit pavilion's ground gallery was the last, until its platform was drawn wider: #278)
test("#148: round every hall the platform can be walked, on every side that is drawn wide enough for him", () => {
  const out = {};
  for (const h of site.halls) {
    const b = site.buildings.find((q) => q.frame && !q.frame.storey && h.out[0] > q.x0 - 1.5 && h.out[0] < q.x1 + 1.5 && h.out[1] > q.z0 - 1.5 && h.out[1] < q.z1 + 1.5);
    assert.ok(b, `no building for ${h.id}`);
    const f = b.frame, q = f.q || 0, xs = [Math.min(...f.xs), Math.max(...f.xs)], zs = [Math.min(...f.zs), Math.max(...f.zs)];
    const hx = q % 2 ? (zs[1] - zs[0]) / 2 : (xs[1] - xs[0]) / 2, hz = q % 2 ? (xs[1] - xs[0]) / 2 : (zs[1] - zs[0]) / 2;
    const body = { x0: f.at[0] - hx, x1: f.at[0] + hx, z0: f.at[1] - hz, z1: f.at[1] + hz };
    // The platform's floor: open cells inside its rectangle, above the court it stands on.
    const top = (x, z) => { const k = cellOf(G, x, z); return k >= 0 && !G.state[k] && G.height[k] / 100 > b.y + 0.15; };
    // One piece: a flood over the platform's open cells from the floor before the door.
    const S = G.step, key = (i, j) => j * G.nx + i, seen = new Set(), todo = [];
    for (let r = 0; r < 1.5 && !todo.length; r += S) for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const x = h.out[0] + dx, z = h.out[1] + dz; if (top(x, z)) { const k = cellOf(G, x, z); seen.add(k); todo.push(k); break; } }
    while (todo.length) { const k = todo.pop(), i = k % G.nx, j = (k - i) / G.nx; for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = key(i + a, j + c); if (seen.has(kk)) continue; if (top(xOf(G, kk), zOf(G, kk)) && xOf(G, kk) > b.x0 - 0.1 && xOf(G, kk) < b.x1 + 0.1 && zOf(G, kk) > b.z0 - 0.1 && zOf(G, kk) < b.z1 + 0.1) { seen.add(kk); todo.push(kk); } } }
    const sides = { W: [b.x0, body.x0, "x"], E: [body.x1, b.x1, "x"], N: [b.z0, body.z0, "z"], S: [body.z1, b.z1, "z"] }, row = {};
    for (const [n, [a, e, ax]] of Object.entries(sides)) {
      const [s0, s1] = ax === "x" ? [body.z0, body.z1] : [body.x0, body.x1]; let tot = 0, ok = 0;
      for (let s = s0 + 0.3; s < s1 - 0.3; s += 0.1) { tot++; for (let t = a + S / 2; t < e; t += S) { const k = ax === "x" ? cellOf(G, t, s) : cellOf(G, s, t); if (seen.has(k)) { ok++; break; } } }
      row[n] = Math.round((100 * ok) / tot);
    }
    out[h.id] = row;
    if (process.env.ROUND_LOG) console.log(JSON.stringify({ hall: h.id, name: h.name, strip: +(body.x0 - b.x0).toFixed(2), rail: !!b.rail, ...row }));
    if (NARROW[h.id]) { assert.ok(Object.values(row).some((v) => v < 50), `${h.name} is walked round now: take it out of NARROW`); continue; }
    // (Short of all of a side only where a stair's cheek, a column at a corner or a table on the porch stands in the strip.)
    for (const [n, v] of Object.entries(row)) assert.ok(v >= 90, `${h.name}: only ${v}% of its ${n} side can be walked, in one piece with its door (${JSON.stringify(row)})`);
  }
  assert.equal(Object.keys(out).length, site.halls.length);
});

test("the porch edges are found in the grid (#143): every written edge has one, at its height, along its line; none on a railed platform", () => {
  const found = walker.drops, written = site.walk.drops;
  assert.ok(written.length >= 10 && found.length >= written.length);
  for (const e of written) {
    const line = e.normal[0] ? e.a[0] : e.a[1], lo = Math.min(e.normal[0] ? e.a[1] : e.a[0], e.normal[0] ? e.b[1] : e.b[0]), hi = Math.max(e.normal[0] ? e.a[1] : e.a[0], e.normal[0] ? e.b[1] : e.b[0]);
    const match = found.filter((f) => f.normal[0] === e.normal[0] && f.normal[1] === e.normal[1] && Math.abs((f.normal[0] ? f.a[0] : f.a[1]) - line) < 0.12 && Math.abs(f.top - e.top) < 0.02);
    const covered = match.reduce((s, f) => { const a = Math.min(f.normal[0] ? f.a[1] : f.a[0], f.normal[0] ? f.b[1] : f.b[0]), b = Math.max(f.normal[0] ? f.a[1] : f.a[0], f.normal[0] ? f.b[1] : f.b[0]); return s + Math.max(0, Math.min(b, hi) - Math.max(a, lo)); }, 0);
    assert.ok(covered >= (hi - lo) * 0.7, `the written edge ${JSON.stringify(e)} is found along ${covered.toFixed(2)} of ${(hi - lo).toFixed(2)} m`);
  }
  // A railed platform offers none (no open cell along its edge), so none stands more than a man's height over the ground below it.
  for (const f of found) {
    const rail = site.buildings.find((b) => b.rail && !b.frame?.storey && (f.a[0] + f.b[0]) / 2 > b.x0 - 0.2 && (f.a[0] + f.b[0]) / 2 < b.x1 + 0.2 && (f.a[1] + f.b[1]) / 2 > b.z0 - 0.2 && (f.a[1] + f.b[1]) / 2 < b.z1 + 0.2 && Math.abs(f.top - b.y) > 0.5);
    assert.ok(!rail, `an edge at ${f.top} m was found on the railed platform of ${rail?.name} (${JSON.stringify(f)})`);
  }
  // A step he walks (no higher than the bake's CLIMB) is not an edge to hop from.
  for (const f of found) { const [nx, nz] = f.normal, mx = (f.a[0] + f.b[0]) / 2 + nx * 0.9, mz = (f.a[1] + f.b[1]) / 2 + nz * 0.9; assert.ok(f.top - walker.heightAt(mx, mz) > BAKE.CLIMB, `a ${(f.top - walker.heightAt(mx, mz)).toFixed(2)} m step at ${f.a} is walked, not hopped`); }
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

test("a kept place or a ?cam address that falls in a shut cell moves to the nearest open spot within half a metre, or back to the start: out of doors, in a room, on the balcony", () => {
  // Shut cells beside open ones all over a grid (by a column, a tree, a table, a railing): each settles within 0.5 m, onto a cell flooded from where he comes in.
  const sweep = (g, stride = 997) => {
    let tried = 0;
    for (let k = 0; k < g.nx * g.nz && tried < 400; k += stride) {
      const x = xOf(g, k), z = zOf(g, k); if (!g.state[k] || !walker.blocked(x, z)) continue;
      const p = settle(walker, x, z); if (!p) continue; tried++;
      assert.ok(!walker.blocked(p.x, p.z) && Math.hypot(p.x - x, p.z - z) <= 0.5 + 1e-9);
      const c = cellOf(g, p.x, p.z); assert.ok(c >= 0 && g.state[c] === 0, "an open cell of the grid: flooded from where he arrives");
    }
    return tried;
  };
  assert.ok(sweep(G) > 100, "out of doors");
  for (const [id, r] of Object.entries(rooms.rooms)) within({ room: r.room }, () => assert.ok(sweep(grids.rooms[id], 37) > 20, `in ${id}`));
  for (const id of Object.keys(site.lofts)) within({ loft: id }, () => assert.ok(sweep(grids.lofts[id], 13) > 20, `on the balcony of ${id}`));
  const main = site.halls.find((h) => h.id === "main"); assert.equal(settle(walker, main.door[0], main.door[1] - 6), null, "deep inside a hall's walls, out of doors, there is nowhere within half a metre");
  const open = site.halls.find((h) => h.id === "tea").out; assert.deepEqual(settle(walker, open[0], open[1]), { x: open[0], z: open[1] }, "an open spot is kept as it is");
  // In a room, inside the altar's dais: nowhere within half a metre; and a point outside the room altogether is shut.
  const R = rooms.rooms.main.room; within({ room: R }, () => { assert.ok(walker.blocked(R.x0 - 2, 0), "outside the room's walls"); assert.equal(settle(walker, R.x0 - 2, 0), null); });
});

// Going back (#274; the lead): the book's 「回到那一处」 stands him where each seal was earned (`y.travel`), and coming out of a
// hall stands him at its `out`; a kept place is wherever he last stood. Each must have somewhere to stand on the baked
// floor: open, or open within half a metre (`settle`), in the grid of the room it is in.
test("every place a seal is earned and every spot outside a hall's door has open floor within half a metre, in its own grid", () => {
  const all = { ...site.places, ...rooms.places }, bad = [];
  for (const [id, p] of Object.entries(all)) {
    if (!p.at) continue;
    const R = p.room ? rooms.rooms[p.room]?.room : null;
    within({ room: R }, () => { const s = settle(walker, p.at[0], p.at[1]); if (!s) bad.push(`place ${id}${p.room ? " in " + p.room : ""} at (${p.at.map((v) => v.toFixed(2))})`); });
  }
  for (const h of site.halls) { const s = settle(walker, h.out[0], h.out[1]); if (!s) bad.push(`out of ${h.id} at (${h.out.map((v) => v.toFixed(2))})`); }
  for (const [id, r] of Object.entries(rooms.rooms)) within({ room: r.room }, () => { const s = settle(walker, r.room.door[0], r.room.door[1]); if (!s || walker.blocked(s.x, s.z)) bad.push(`inside the door of ${id}`); });
  assert.deepEqual(bad, [], "nowhere to stand");
  assert.ok(Object.keys(all).length >= 7, `${Object.keys(all).length} places`);
});

// No pocket (#274; the lead, after the owner found the tea house's back at once open and going nowhere): on every grid,
// every open cell is walked to from where he comes in, by the same steps both ways (a neighbour no more than CLIMB higher
// or lower, never round a shut corner), so from every cell he can reach he can walk back; and every hop down a porch's
// edge comes down on an open cell, so that a hop never leaves him somewhere he cannot walk out of.
test("on every grid every open cell is walked to from where he comes in and walks back, and every hop down lands on one", () => {
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], CLIMB = BAKE.CLIMB * 100 + 1e-6, lost = [];
  for (const meta of file.header.grids) {
    const g = decoded.grids.find((q) => q.id === meta.id), seen = new Uint8Array(g.nx * g.nz), todo = [];
    for (const [sx, sz] of meta.seeds) { const k = cellOf(g, sx, sz); if (k >= 0 && !g.state[k]) { seen[k] = 1; todo.push(k); } }
    while (todo.length) {
      const k = todo.pop(), i = k % g.nx, j = (k - i) / g.nx;
      for (const [a, b] of N8) {
        const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.nz) continue; const kk = jj * g.nx + ii;
        if (seen[kk] || g.state[kk] || Math.abs(g.height[kk] - g.height[k]) > CLIMB || (a && b && (g.state[j * g.nx + ii] || g.state[jj * g.nx + i]))) continue;
        seen[kk] = 1; todo.push(kk);
      }
    }
    let open = 0, cut = 0, at = null; for (let k = 0; k < g.nx * g.nz; k++) if (!g.state[k]) { open++; if (!seen[k]) { cut++; at ||= [xOf(g, k), zOf(g, k)]; } }
    if (cut) lost.push(`${g.id}: ${cut} of ${open} open cells not walked to, e.g. (${at.map((v) => v.toFixed(2))})`);
  }
  assert.deepEqual(lost, [], "open floor he cannot walk to (or back from)");
  // Every hop down, from a spot along each edge where he would take off, comes down on an open cell.
  let hops = 0; const bad = [];
  for (const e of walker.drops) {
    const ax = e.b[0] - e.a[0], az = e.b[1] - e.a[1], span = Math.hypot(ax, az);
    for (let s = 0.3; s < span - 0.3; s += 0.5) {
      const x = e.a[0] + (ax / span) * s - e.normal[0] * 0.25, z = e.a[1] + (az / span) * s - e.normal[1] * 0.25;
      if (walker.blocked(x, z)) continue;
      const plan = findDrop(walker, [e], x, z, e.normal[0], e.normal[1]); if (!plan) continue; hops++;
      const k = cellOf(G, plan.to[0], plan.to[2]); if (k < 0 || G.state[k]) bad.push(`(${plan.to[0].toFixed(2)}, ${plan.to[2].toFixed(2)})`);
    }
  }
  assert.ok(hops > 100, `${hops} hops tried`); assert.deepEqual(bad, [], "a hop comes down where he cannot stand");
});

// The tea house's back (#274; the owner, on main, found its west side neither walked nor hopped down from): the strip on its
// platform there is walked round from the porch, the lane between the platform and the court's west wall is walked from both
// ends, and he hops from one into the other.
test("behind the tea house: its platform's back is walked, the lane behind it is walked from both ends, and he hops down into it", () => {
  const b = site.buildings.find((q) => q.name === "茶寮"), mid = (b.z0 + b.z1) / 2, top = (x, z) => !walker.blocked(x, z) && walker.heightAt(x, z) > 0.4;
  let strip = null, lane = null;
  for (let x = b.x0 + 0.05; x < b.x0 + 1.2 && !strip; x += 0.05) if (top(x, mid)) strip = x;
  for (let x = b.x0 - 0.05; x > b.x0 - 1.5 && !lane; x -= 0.05) if (!walker.blocked(x, mid) && walker.heightAt(x, mid) < 0.05) lane = x;
  assert.ok(strip !== null && lane !== null, `no strip (${strip}) or lane (${lane}) behind the tea house`);
  for (let z = b.z0 + 0.6; z < b.z1 - 0.6; z += 0.5) { assert.ok(top(strip, z), `the platform's back is shut at z=${z.toFixed(1)}`); assert.ok(!walker.blocked(lane, z), `the lane is shut at z=${z.toFixed(1)}`); }
  assert.ok(!walker.blocked(lane, b.z0 - 0.3) || !walker.blocked(lane, b.z0 - 0.6), "the lane does not open onto the court at its south end");
  assert.ok(!walker.blocked(lane, b.z1 + 0.3) || !walker.blocked(lane, b.z1 + 0.6), "the lane does not open onto the court at its north end");
  const plan = findDrop(walker, walker.drops, strip, mid, -1, 0); assert.ok(plan, "no hop down off the platform's back"); assert.ok(!walker.blocked(plan.to[0], plan.to[2]) && plan.to[1] < 0.05, "the hop comes down in the lane");
});

test("the page keeps only the rows and columns a floor was reached in, cell for cell", () => {
  const opened = decode(file.bytes, (b) => inflateRawSync(b), () => "floors");
  assert.equal(opened.grids.length, decoded.grids.length);
  for (const [n, g] of decoded.grids.entries()) {
    const o = opened.grids[n]; assert.ok(o.nx <= g.nx && o.nz <= g.nz && o.nx > 0);
    for (let k = 0; k < g.nx * g.nz; k += 61) { const x = xOf(g, k), z = zOf(g, k), c = cellOf(o, x, z); if (c < 0) assert.equal(g.height[k], NO_FLOOR, `${g.id}: a floor at (${x}, ${z}) was cut away`); else { assert.equal(o.height[c], g.height[k]); assert.equal(o.state[c], g.state[k]); } }
  }
});

// The eye rides the floor he stands on (#265, the owner on the preview: at the great hall platform's east end he ran under
// the floor, seen from his own eyes). Wherever the grid lets him stand, the height the eye follows (`eyeAt`, a stair's
// slope rather than its treads) is within a tread of the floor (`heightAt`). Listed by building, every cell that fails.
test("wherever he may stand, out of doors, in a room or on the balcony, the eye rides within a tread of the floor under him", () => {
  const bad = new Map();
  const near = (x, z) => site.buildings.find((b) => x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1)?.name || "院子";
  const look = (g, where, every) => { let n = 0;
    for (let j = 0; j < g.nz; j += every) for (let i = 0; i < g.nx; i += every) {
      const k = j * g.nx + i; if (g.state[k]) continue;
      const x = xOf(g, k), z = zOf(g, k); if (!walker.answers(x, z)) continue; n++;
      const d = Math.abs(walker.eyeAt(x, z) - walker.heightAt(x, z));
      if (d > 0.2) { const b = where || near(x, z), r = bad.get(b) || { cells: 0, worst: 0, at: null }; r.cells++; if (d > r.worst) { r.worst = +d.toFixed(2); r.at = [+x.toFixed(2), +z.toFixed(2)]; } bad.set(b, r); }
    }
    return n; };
  assert.ok(look(G, null, 3) > 100000, "open cells out of doors");
  for (const [id, r] of Object.entries(rooms.rooms)) within({ room: r.room }, () => assert.ok(look(grids.rooms[id], `room ${id}`, 2) > 1000));
  for (const id of Object.keys(site.lofts)) within({ loft: id }, () => assert.ok(look(grids.lofts[id], `loft ${id}`, 1) > 500));
  assert.deepEqual(Object.fromEntries(bad), {}, "the eye rides away from the floor");
});

// Whether he is on a stair (his pace there and his gait, #273, and the eye's slope) is asked of the same floor his feet
// stand on: nowhere does the grid show a level floor while the walker says stair, nor a tread step while it says level.
test("everywhere on the grid a stair is where the floor steps by a tread: the gait, the pace and the eye ask the floor his feet stand on", () => {
  const flat = [], step = []; let n = 0;
  for (let j = 1; j < G.nz - 1; j += 2) for (let i = 1; i < G.nx - 1; i += 2) {
    const k = j * G.nx + i; if (G.state[k]) continue; n++;
    const x = xOf(G, k), z = zOf(G, k), h = walker.heightAt(x, z), st = walker.onStairs(x, z); let rise = 0, span = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!walker.blocked(x + dx * 0.1, z + dz * 0.1)) rise = Math.max(rise, Math.abs(walker.heightAt(x + dx * 0.1, z + dz * 0.1) - h));
      for (const d of [0.2, 0.3, 0.35]) if (!walker.blocked(x + dx * d, z + dz * d)) span = Math.max(span, Math.abs(walker.heightAt(x + dx * d, z + dz * d) - h));
    }
    if (st && Math.max(span, rise) < 0.05) flat.push([+x.toFixed(2), +z.toFixed(2)]);
    if (!st && rise >= 0.09 && rise <= 0.25) step.push([+x.toFixed(2), +z.toFixed(2)]);
  }
  assert.ok(n > 400000, `${n} open cells looked at`);
  assert.deepEqual(flat.slice(0, 8), [], `${flat.length} places (${JSON.stringify(flat.filter((_, i) => i % 8 === 0).slice(0, 16))}) where the walker says stair and the floor is level`);
  assert.deepEqual(step.slice(0, 8), [], `${step.length} places where the floor steps by a tread and the walker says level`);
});

// Up on the balcony he is on the balcony and nowhere else, inside its railing; from the summit below, its floor is not there.
test("the balcony: only its own floor while he is up, inside the railing; from the ground below, never its floor", () => {
  for (const [id, L] of Object.entries(site.lofts)) {
    const g = grids.lofts[id]; let open = 0;
    within({ loft: id }, () => {
      for (let k = 0; k < g.nx * g.nz; k++) {
        if (g.state[k]) continue; open++;
        const x = xOf(g, k), z = zOf(g, k);
        assert.ok(Math.abs(g.height[k] / 100 + g.base - L.floor) < 0.02, `the balcony's floor at (${x.toFixed(2)}, ${z.toFixed(2)}) is at ${g.height[k] / 100 + g.base}, not ${L.floor}`);
        assert.ok(x > L.outer.x0 - 0.05 && x < L.outer.x1 + 0.05 && z > L.outer.z0 - 0.05 && z < L.outer.z1 + 0.05, `open floor outside the railing at (${x.toFixed(2)}, ${z.toFixed(2)})`);
        assert.ok(!(x > L.inner.x0 && x < L.inner.x1 && z > L.inner.z0 && z < L.inner.z1), `open floor within the storey's walls at (${x.toFixed(2)}, ${z.toFixed(2)})`);
      }
      // nothing else can be stood on from up there: the summit's ground, the stair, are shut
      const below = [0, LEVELS[2].zS - 2]; assert.ok(walker.blocked(below[0], below[1]), "from the balcony the summit's ground is not floor");
    });
    assert.ok(open * g.step * g.step > 20, `${(open * g.step * g.step).toFixed(1)} m² of balcony`);
    // From the ground, wherever the balcony is overhead the floor is the ground's own (or none): a tap aimed at the pavilion does not land up there.
    for (let k = 0; k < g.nx * g.nz; k += 7) { if (g.state[k]) continue; const x = xOf(g, k), z = zOf(g, k); assert.ok(walker.heightAt(x, z) < L.floor - 3, `from the ground, the floor at (${x.toFixed(2)}, ${z.toFixed(2)}) is the balcony's`); }
  }
});

// In a room: the columns, the altar's table and the cushions he walks round are each ringed by open floor (he can walk
// round them), and each stops him its own shape and his reach off.
test("in every room he can walk round each column, and the grid stops him his reach off it", () => {
  for (const [id, r] of Object.entries(rooms.rooms)) within({ room: r.room }, () => {
    const g = grids.rooms[id], cols = r.room.frame?.cols || []; let n = 0;
    for (const c of cols) {
      const cx = c.x ?? c[0], cz = c.z ?? c[1];
      if (!(cx > r.room.x0 + 1.5 && cx < r.room.x1 - 1.5 && cz > r.room.z0 + 1.5 && cz < r.room.z1 - 1.5)) continue;   // (a column in a wall is not walked round)
      n++;
      assert.ok(walker.blocked(cx, cz), `${id}: the column at (${cx.toFixed(2)}, ${cz.toFixed(2)}) is walked through`);
      // He is stopped his own reach off its shaft at the least (its base is wider), and somewhere within a stride of that there is open floor all the way round.
      const N = 24, at = (R, a) => [cx + Math.cos((a / N) * 6.283) * R, cz + Math.sin((a / N) * 6.283) * R], least = 0.15 + reach(0, BAKE.CLEAR) - 0.05;
      for (let a = 0; a < N; a++) assert.ok(walker.blocked(...at(least, a)), `${id}: his sleeve enters the column at (${cx.toFixed(2)}, ${cz.toFixed(2)})`);
      let ring = 0; for (let R = least; R <= least + 0.75 && ring < N / 2; R += 0.05) { ring = 0; for (let a = 0; a < N; a++) if (!walker.blocked(...at(R, a))) ring++; }
      assert.ok(ring >= N / 2, `${id}: no way past the column at (${cx.toFixed(2)}, ${cz.toFixed(2)}): ${ring} of ${N} points open`);
    }
    assert.ok(g.nx > 0); if (process.env.ROUND_LOG) console.log(id, n, "columns walked round");
  });
});

// The great hall's two back flights (#148, #272): in its east and west bays next to the middle, each is walked up from the
// court behind the hall onto the platform and down again, and its foot and its head are both on the floor he walks to from
// where he comes in (so neither leads into a pocket he cannot leave).
test("#272: the great hall's two back flights come down into the court behind it, and lead to the floor he arrives on", () => {
  const b = site.buildings.find((q) => q.name === "大雄宝殿"), floor = (b.y || 0) + 1.5;
  const back = site.walk.ramps.filter((r) => Math.abs(r.high[1] - b.z0) < 0.6 && r.low[1] < r.high[1]).sort((p, q) => p.low[0] - q.low[0]);
  assert.equal(back.length, 2, `the back flights found: ${back.map((r) => r.low.map((v) => v.toFixed(2))).join(" ")}`);
  assert.ok(Math.abs(back[0].low[0] + 8.85) < 0.05 && Math.abs(back[1].low[0] - 8.85) < 0.05, "in the east and west bays next to the middle");
  const meta = file.header.grids.find((q) => q.id === "outdoors"), g = G, seen = new Uint8Array(g.nx * g.nz), todo = [], CLIMB = BAKE.CLIMB * 100 + 1e-6;
  for (const [sx, sz] of meta.seeds) { const k = cellOf(g, sx, sz); if (k >= 0 && !g.state[k]) { seen[k] = 1; todo.push(k); } }
  while (todo.length) { const k = todo.pop(), i = k % g.nx, j = (k - i) / g.nx;
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + c; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.nz) continue; const kk = jj * g.nx + ii;
      if (!seen[kk] && !g.state[kk] && Math.abs(g.height[kk] - g.height[k]) <= CLIMB) { seen[kk] = 1; todo.push(kk); } } }
  for (const r of back) {
    const foot = [r.low[0], r.low[1] - 0.8], head = [r.high[0], r.high[1] + 0.3], kf = cellOf(g, ...foot), kh = cellOf(g, ...head);
    assert.ok(kf >= 0 && seen[kf] && walker.heightAt(...foot) < 0.05, `the foot of the flight at x=${r.low[0]} is not on the court's floor he walks to`);
    assert.ok(kh >= 0 && seen[kh] && Math.abs(walker.heightAt(...head) - floor) < 0.05, `the head of the flight at x=${r.low[0]} is not on the platform he walks to`);
  }
});

// Round the summit pavilion's ground gallery as a visitor walks it (#278; the lead, by real keys on abe89fe): along one side
// as close to the railing as he gets, held on until he can go no farther, then turned along the next side. At every corner,
// from both of its sides, he gets round; a step of the page (2.1 m/s at 60 frames a second) at a time.
test("#278: round each corner of the summit pavilion's gallery, along the railing from either side, he gets on along the next", () => {
  const b = site.buildings.find((q) => q.name === "凌霄阁" && q.frame && !q.frame.storey), floor = (b.y || 0) + 0.9, step = 2.1 / 60;
  const on = (x, z) => !walker.blocked(x, z) && Math.abs(walker.heightAt(x, z) - floor) < 0.05;
  const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2, stuck = [];
  // the line along each side nearest the railing: the outermost open cell on the platform, across the side's middle
  const edge = (side) => { const out = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }[side], far = 3; let best = null;
    for (let t = 0; t < far; t += 0.01) { const x = side === "E" ? b.x1 - t : side === "W" ? b.x0 + t : mx + toward * 5, z = side === "N" ? b.z0 + t : side === "S" ? b.z1 - t : mz; if (on(x, z)) { best = [x, z]; break; } }
    return { at: best, out }; };
  let toward = 0;   // (the front's middle is its stair: along the front he starts between the stair and the corner he goes to)
  const corners = [["E", "N"], ["N", "E"], ["N", "W"], ["W", "N"], ["W", "S"], ["S", "W"], ["S", "E"], ["E", "S"]];
  for (const [from, to] of corners) {
    toward = from === "S" ? (to === "E" ? 1 : -1) : 0;
    const a = edge(from); toward = 0;
    const pos = { x: a.at[0], z: a.at[1] }, along = edge(to).out.map((v) => v * step), next = a.out.map((v) => -v * step);
    // hold the key that runs him along `from` toward `to`'s side until he goes no farther
    for (let n = 0; n < 1200; n++) { const x = pos.x, z = pos.z; stride(walker, pos, along[0], along[1]); if (Math.hypot(pos.x - x, pos.z - z) < 1e-4) break; }
    // then turn and hold the key that runs him along `to`, back across the pavilion
    const sx = pos.x, sz = pos.z;
    for (let n = 0; n < 100; n++) stride(walker, pos, next[0], next[1]);
    const went = Math.hypot(pos.x - sx, pos.z - sz);
    if (went < 2.5 || !on(pos.x, pos.z)) stuck.push(`along ${from} then ${to}: from (${sx.toFixed(2)}, ${sz.toFixed(2)}) only ${went.toFixed(2)} m, to (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
  }
  assert.deepEqual(stuck, [], "he is held at a corner of the gallery");
});

// Into a hall by its door as a visitor walks it (#294; the owner: from 0.7 m off the door's middle, W stopped him on its
// frame). From the porch before each hall's door, at 0.3, 0.5, 0.7 and 0.9 m either side of its middle, he holds the key
// that walks him at the door, a step of the page (2.1 m/s at 60 frames a second) at a time, and comes in.
test("#294: from as far as 0.9 m either side of the middle of every hall's door, holding on at it, he comes in", () => {
  const step = 2.1 / 60, missed = [];
  for (const h of site.halls) {
    const ix = h.door[0] - h.out[0], iz = h.door[1] - h.out[1], d = Math.hypot(ix, iz), ux = ix / d, uz = iz / d, lx = -uz, lz = ux;   // in through the door, and across it
    for (const off of [0.3, 0.5, 0.7, 0.9]) for (const side of [1, -1]) {
      const pos = { x: h.out[0] + lx * off * side, z: h.out[1] + lz * off * side };
      if (walker.blocked(pos.x, pos.z)) { missed.push(`${h.id} ${side * off}: the spot before the door is shut`); continue; }
      let came = false;
      for (let n = 0; n < 240 && !came; n++) { stride(walker, pos, ux * step, uz * step); came = h.inside(pos.x, pos.z); }
      if (!came) missed.push(`${h.id} ${(side * off).toFixed(1)}: held at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
    }
  }
  assert.deepEqual(missed, [], "held outside a hall's door");
});

// Held on from right against the door's frame (#294, the lead on the preview of 9c07c63, at the owner's own address
// ?cam=0.7,-5.699988: in the pocket just past the door's line beside the doorway, he slid outward along the frame and
// never came in). From there, and from such a pocket at every hall's door, holding on at it takes him in.
test("#294: from against the frame, just past the door's line 0.7 or 0.9 m off its middle, holding on at it, he comes in", () => {
  const step = 2.1 / 60, missed = [], main = site.halls.find((h) => h.id === "main");
  // the owner's address, put down as the page puts down an address (`settle`). Since the Tripo body's wider shoes (#163)
  // the baked floor keeps them off the doorway's riser where what lies across it is shut, and the great hall's pocket
  // past the door's line is shut through: the spot is moved back to the door's line beside the doorway (about 11 cm)
  const starts = [[0.7, -5.699988], [0.9, -5.699988]].map(([x, z]) => { const p = settle(walker, x, z); assert.ok(p && Math.hypot(p.x - x, p.z - z) <= 0.15, `the owner's spot (${x}, ${z}) is put down ${p ? Math.hypot(p.x - x, p.z - z).toFixed(2) + " m" : "nowhere"} from where it was`); return [main, p.x, p.z]; });
  for (const h of site.halls) {
    const ix = h.door[0] - h.out[0], iz = h.door[1] - h.out[1], d = Math.hypot(ix, iz), ux = ix / d, uz = iz / d, lx = -uz, lz = ux;
    for (const off of [0.7, 0.9]) for (const side of [1, -1]) for (const past of [0, 0.06, 0.11]) {
      const x = h.door[0] + ux * past + lx * off * side, z = h.door[1] + uz * past + lz * off * side;
      if (!walker.blocked(x, z)) starts.push([h, x, z]);
    }
    // and a few centimetres short of the sill, in the doorway's middle (where, on the preview, the page brought him from 0.9 m and held him)
    for (const off of [0, 0.3, -0.3]) { const x = h.door[0] - ux * 0.03 + lx * off, z = h.door[1] - uz * 0.03 + lz * off; if (!walker.blocked(x, z)) starts.push([h, x, z]); }
  }
  // at a frame's step at 60 frames a second and at the page's longest (its frame time is held to 0.05 s), and held all but
  // straight in, as the owner's address has him (yaw 0.009), to either hand
  for (const [h, x, z] of starts) for (const len of [step, 2.1 * 0.05]) for (const turn of [0, 0.009, -0.009]) {
    const ix = h.door[0] - h.out[0], iz = h.door[1] - h.out[1], d = Math.hypot(ix, iz), c = Math.cos(turn), s = Math.sin(turn), pos = { x, z };
    const dx = ((ix * c - iz * s) / d) * len, dz = ((ix * s + iz * c) / d) * len;
    let came = h.inside(pos.x, pos.z);
    for (let n = 0; n < 240 && !came; n++) { stride(walker, pos, dx, dz); came = h.inside(pos.x, pos.z); }
    if (!came) missed.push(`${h.id} from (${x.toFixed(2)}, ${z.toFixed(2)}), ${(len * 100).toFixed(1)} cm a step, turned ${turn}: held at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
  }
  assert.ok(starts.length >= 3, "no spot against a frame was found");
  assert.deepEqual(missed, [], "held against a door's frame");
});

// Off a low edge as a visitor walks it (#294; the owner, on the tea house's porch facing along its edge, could not get down):
// at an unrailed edge no deeper than his leg (STEP_DOWN), walking out over it steps him down, at a walk; walking along it,
// or across it at a slant, does not; a deeper edge still asks for the jump (Space), and a railed one has no way down.
// (The path pavilions have no such edge: the half-way one stands on a podium over the slope, and the river-view one is
// shut in on three sides and comes down to its landing by its steps. The gate's side platforms are 0.50 m, at the limit.)
test("#294: off the tea house's porch, the gate's and a hall's low platform he steps down by walking out; along the edge he does not", async () => {
  const { stepOff, stepPose, findDrop, STEP_DOWN } = await import("../../app/src/drop.js");
  const near = (name) => { const b = site.buildings.find((q) => q.name === name); assert.ok(b, `no ${name}`); return walker.drops.filter((e) => [e.a, e.b].every(([x, z]) => x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1)); };
  // where he stands as near the edge's middle as the porch lets him
  const at = (e) => { const ax = e.b[0] - e.a[0], az = e.b[1] - e.a[1], span = Math.hypot(ax, az), [nx, nz] = e.normal;
    for (let back = 0; back < 0.65; back += 0.01) { const x = e.a[0] + ax / 2 - nx * back, z = e.a[1] + az / 2 - nz * back; if (!walker.blocked(x, z)) return { x, z, ux: ax / span, uz: az / span }; } return null; };
  const fallOf = (e) => { const p = at(e); return p ? e.top - walker.heightAt(e.a[0] / 2 + e.b[0] / 2 + e.normal[0] * 0.9, e.a[1] / 2 + e.b[1] / 2 + e.normal[1] * 0.9) : Infinity; };
  const bad = [];
  for (const name of ["茶寮", "万年正续", "禅堂"]) {
    const low = near(name).filter((e) => at(e) && fallOf(e) <= STEP_DOWN + 0.005 && fallOf(e) > 0.2);
    if (!low.length) { bad.push(`${name}: no low unrailed edge found`); continue; }
    const e = low[0], p = at(e), [nx, nz] = e.normal;
    const plan = stepOff(walker, p.x, p.z, nx, nz);
    if (!plan) { bad.push(`${name}: walking out over the edge at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) does not step him down`); continue; }
    if (plan.fall > STEP_DOWN + 0.005 || walker.blocked(plan.to[0], plan.to[2])) bad.push(`${name}: the step comes down where he cannot stand`);
    // along the edge, or out at 60° to it: no step (he goes on along the porch)
    for (const [dx, dz, what] of [[p.ux, p.uz, "along it"], [-p.ux, -p.uz, "along it the other way"], [nx * 0.5 + p.ux * 0.866, nz * 0.5 + p.uz * 0.866, "out at 60°"]]) if (stepOff(walker, p.x, p.z, dx, dz)) bad.push(`${name}: walking ${what} steps him down`);
    // a step, not a leap: level, then down, no faster than a walk, the body never jumping between frames
    let last = stepPose(plan, 0), maxStep = 0, rose = false;
    for (let t = 1 / 60; t <= plan.duration + 1e-9; t += 1 / 60) { const q = stepPose(plan, t); maxStep = Math.max(maxStep, Math.hypot(q.x - last.x, q.z - last.z), Math.abs(q.y - last.y)); if (q.y > last.y + 1e-9) rose = true; last = q; }
    if (plan.duration < 0.45 || maxStep > 0.06 || rose) bad.push(`${name}: the step down is not a step (${plan.duration.toFixed(2)} s, ${maxStep.toFixed(3)} m a frame, rose ${rose})`);
  }
  // a deeper unrailed edge: no step, though the jump is offered there
  const deep = walker.drops.filter((e) => at(e) && fallOf(e) > STEP_DOWN + 0.05 && fallOf(e) < 1.5);
  for (const e of deep.slice(0, 3)) { const p = at(e); if (stepOff(walker, p.x, p.z, e.normal[0], e.normal[1])) bad.push(`an edge ${fallOf(e).toFixed(2)} m deep at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) is stepped down`); if (!findDrop(walker, walker.drops, p.x, p.z, e.normal[0], e.normal[1])) bad.push(`no jump offered off the edge ${fallOf(e).toFixed(2)} m deep at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`); }
  // the great hall's railed porch: walking out at its railing, no way down
  const main = site.halls.find((h) => h.id === "main"), mp = { x: main.out[0] + 2.0, z: main.out[1] + 0.4 };
  if (!walker.blocked(mp.x, mp.z) && stepOff(walker, mp.x, mp.z, 0, 1)) bad.push("the great hall's railed porch is stepped off");
  assert.deepEqual(bad, []);
});

// Held into a wall, a column or a door's frame (#294): at a slant he slides along it and does not stop; straight at it he
// stands still rather than shuffling to and fro; before a door he is drawn in without going back and forth.
test("#294: held at a slant into a wall or a column he slides along it, straight into a wall he stands, and before a door he never goes to and fro", () => {
  const step = 2.1 / 60, bad = [], { z: wz } = { z: 55 };   // the screen wall before the gate (SCREEN in site.js: z 55, 11 m long)
  const walk = (x, z, dx, dz, n) => { const pos = { x, z }, path = [{ ...pos }]; for (let k = 0; k < n; k++) { stride(walker, pos, dx * step, dz * step); path.push({ ...pos }); } return path; };
  // its south face, from 2 m before it: at 30° to it he comes up to it and goes on along it, east, the whole way
  const slant = walk(-3, wz + 2.0, Math.sin(Math.PI / 6), -Math.cos(Math.PI / 6), 180), east = slant.map((p) => p.x);
  if (east[east.length - 1] - east[0] < 2.5) bad.push(`at a slant into the screen wall he went only ${(east[east.length - 1] - east[0]).toFixed(2)} m along it`);
  if (east.some((x, k) => k && x < east[k - 1] - 1e-6)) bad.push("at a slant into the screen wall he went back along it");
  // straight at it: he stops at it, and does not shuffle to and fro along it
  const head = walk(0.3, wz + 2.0, 0, -1, 180).slice(90), xs = head.map((p) => p.x);
  let turns = 0; for (let k = 2; k < xs.length; k++) if ((xs[k] - xs[k - 1]) * (xs[k - 1] - xs[k - 2]) < -1e-8) turns++;
  if (turns > 1) bad.push(`straight into the screen wall he shuffled to and fro ${turns} times`);
  // the columns standing free in the halls' rooms: held at one, 0.15 m off its middle, he goes round it and on
  let tried = 0;
  for (const [id, r] of Object.entries(rooms.rooms)) within({ room: r.room }, () => {
    for (const c of r.room.frame?.cols || []) {
      const cx = c.x ?? c[0], cz = c.z ?? c[1];
      if (!(cx > r.room.x0 + 1.5 && cx < r.room.x1 - 1.5 && cz > r.room.z0 + 2.5 && cz < r.room.z1 - 2.5)) continue;
      for (const off of [0.15, -0.15]) {
        const x = cx + off, z = cz + 1.6; if (walker.blocked(x, z) || walker.blocked(x, cz - 1.0)) continue;   // (open floor before it and beyond)
        tried++; const p = walk(x, z, 0, -1, 140), e = p[p.length - 1];
        if (e.z > cz - 0.4) bad.push(`${id}: held at the column at (${cx.toFixed(2)}, ${cz.toFixed(2)}) from ${off > 0 ? "its right" : "its left"} he stopped at (${e.x.toFixed(2)}, ${e.z.toFixed(2)})`);
      }
    }
  });
  if (tried < 4) bad.push(`only ${tried} columns were walked at`);
  // before each hall's door from 0.9 m off its middle: drawn in, never turning back across the door, nor backing off it more than once
  for (const h of site.halls) {
    const ix = h.door[0] - h.out[0], iz = h.door[1] - h.out[1], d = Math.hypot(ix, iz), ux = ix / d, uz = iz / d, lx = -uz, lz = ux;
    const pos = { x: h.out[0] + lx * 0.9, z: h.out[1] + lz * 0.9 }; let across = 0.9, wider = 0, backs = 0, along = 0;
    for (let n = 0; n < 240 && !h.inside(pos.x, pos.z); n++) { const x = pos.x, z = pos.z; stride(walker, pos, ux * step, uz * step);
      const a = (pos.x - h.out[0]) * lx + (pos.z - h.out[1]) * lz, f = (pos.x - x) * ux + (pos.z - z) * uz; if (Math.abs(a) > across + 1e-6) wider++; across = Math.min(across, Math.abs(a)); if (f < -1e-6) backs++; along += f; }
    if (wider) bad.push(`${h.id}: drawn to its door he went back across it ${wider} times`);
    if (backs > 3) bad.push(`${h.id}: drawn to its door he backed off ${backs} times`);
  }
  assert.deepEqual(bad, []);
});
