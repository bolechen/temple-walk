// The top storey of the Lingxiao pavilion, walked round on its balcony (issue #101; docs/t00/decisions.md, 登凌霄阁).
// The gallery is floor on the plan, but floor only while he is up there (`walker.setLoft`): from the summit below, a
// tap or a look aimed at the pavilion must not land on it. Up there it goes all the way round, the corners turn, and
// nothing lets him off it: not the railing, not a jump, not the wall.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker, LOFT } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { stride } = await import("../../app/src/stride.js");
const { findDrop } = await import("../../app/src/drop.js");
const { sanitizePlace } = await import("../../app/src/resume.js");
const { BODY } = await import("../../app/src/geo.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site), L = site.lofts?.lingxiao;

// Every spot on a 4 cm grid round the pavilion where he can stand while he is up there.
const S = 0.04, key = (i, j) => i * 100000 + j;
function standable() {
  walker.setLoft("lingxiao"); const cells = new Map();
  for (let i = -150; i <= 150; i++) for (let j = -150; j <= 150; j++) { const x = L.at[0] + i * S, z = L.at[1] + j * S; if (!walker.blocked(x, z)) cells.set(key(i, j), [x, z]); }
  walker.setLoft(null); return cells;
}

test("the pavilion's top storey is registered as a gallery to walk round", () => {
  assert.ok(L, "site.lofts.lingxiao is missing");
  // 35.31 m when every storey was cut at the 0.21 m grade; the second storey at 0.186 (#133) brings it down 0.28 m
  assert.ok(Math.abs(L.floor - 35.03) < 0.05, `its floor stands at ${L.floor}`);
  assert.equal(L.half.wall, 3.4); assert.ok(LOFT.out >= 1.6 && Math.abs(L.half.edge - (3.4 + LOFT.out)) < 1e-6, `the balcony reaches ${L.half.edge} from the middle, not 3.4 + ${LOFT.out}`);
  assert.ok(Math.abs(L.face - Math.PI) < 1e-6, "he comes out facing south, the way he came");
});

test("the gallery is floor only while he is up there", () => {
  const [x, z] = L.door;
  assert.ok(walker.blocked(x, z), "from the summit, the gallery's floor must not be there to walk on");
  assert.ok(walker.heightAt(x, z) < L.floor - 5, "nor to land a tap on");
  walker.setLoft("lingxiao");
  try {
    assert.ok(!walker.blocked(x, z), "the door of the top storey is somewhere to stand");
    assert.ok(Math.abs(walker.heightAt(x, z) - L.floor) < 1e-6);
    assert.equal(walker.floorAt(x, z), "wood");
    assert.ok(!walker.onGround(x, z) && !walker.onStairs(x, z));
  } finally { walker.setLoft(null); }
});

test("round the gallery: one piece, every corner turned, room enough before each column", () => {
  const cells = standable(); assert.ok(cells.size > 4000, `only ${cells.size} spots to stand on`);
  const start = [...cells.keys()].find((k) => { const [x, z] = cells.get(k); return Math.abs(x - L.door[0]) < S && Math.abs(z - L.door[1]) < S; });
  assert.ok(start !== undefined, "the door is not on the gallery");
  const seen = new Set([start]), todo = [start];
  while (todo.length) { const k = todo.pop(), i = Math.round(k / 100000), j = k - i * 100000; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = key(i + a, j + b); if (cells.has(n) && !seen.has(n)) { seen.add(n); todo.push(n); } } }
  assert.equal(seen.size, cells.size, "part of the gallery cannot be reached from its door");
  const near = (x, z) => [...cells.values()].some(([a, b]) => Math.abs(a - x) < S && Math.abs(b - z) < S);
  const r = (L.half.wall + L.half.edge) / 2;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) assert.ok(near(L.at[0] + sx * r, L.at[1] + sz * r), `the corner ${sx},${sz} cannot be turned`);
  // Before each column of the south face, how wide the way past it is.
  for (const cx of [-1.2, 1.2]) { let n = 0; for (const [x] of cells.values()) if (Math.abs(x - (L.at[0] + cx)) < S / 2) n++; assert.ok(n / 2 * S >= 0.3, `${(n / 2 * S).toFixed(2)} m past the column at x ${cx}`); }
});

test("he cannot get off the gallery: walking, hurrying or jumping outward ends on it", () => {
  const cells = standable(); walker.setLoft("lingxiao");
  try {
    let n = 0;
    for (const [x0, z0] of cells.values()) {
      if (n++ % 7) continue;   // every seventh spot: some six hundred
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, p = new THREE.Vector3(x0, 0, z0);
        for (let s = 0; s < 40; s++) stride(walker, p, Math.sin(a) * 0.07, -Math.cos(a) * 0.07);
        assert.ok(Math.abs(walker.heightAt(p.x, p.z) - L.floor) < 1e-6 && !walker.blocked(p.x, p.z), `from (${x0.toFixed(2)}, ${z0.toFixed(2)}) heading ${k}/8 he ended at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}), off the gallery`);
        const lx = Math.abs(p.x - L.at[0]), lz = Math.abs(p.z - L.at[1]);
        assert.ok(Math.max(lx, lz) <= L.half.edge - 0.16 - BODY + 0.01, "he stands into the railing");
      }
    }
    assert.ok(!site.walk.drops.some((d) => Math.abs(d.top - L.floor) < 1), "the top storey offers a hop down");
    for (const [x, z] of [...cells.values()].filter((_, i) => i % 97 === 0)) for (let k = 0; k < 8; k++) assert.equal(findDrop(walker, site.walk.drops, x, z, Math.sin(k), -Math.cos(k)), null, `a drop is offered at (${x.toFixed(2)}, ${z.toFixed(2)})`);
  } finally { walker.setLoft(null); }
});

test("up there the eye stays inside the railing and out of the wall", () => {
  walker.setLoft("lingxiao");
  try {
    const f = L.floor, [cx, cz] = L.at;
    assert.equal(walker.eyeShut(L.door[0], f + 1.3, L.door[1], f), false, "his own eyes at the door");
    assert.ok(walker.eyeShut(cx, f + 1.3, cz + L.half.edge + 0.3, f), "out past the railing, in the air");
    assert.ok(walker.eyeShut(cx, f + 1.3, cz + L.half.wall - 0.2, f), "inside the wall");
  } finally { walker.setLoft(null); }
});

test("each run of the top storey's railing has an odd number of bays, so no post stands in the middle", () => {
  const top = site.buildings.find((b) => b.name === "凌霄阁" && b.frame.storey === 2);
  assert.ok(top && top.rail && top.rail.length === 4, "the top storey's railing is not recorded, four runs");
  for (const r of top.rail) assert.equal(r.n % 2, 1, `a run of ${r.n} bays from ${r.a.toFixed(2)} to ${r.b.toFixed(2)}`);
});

test("the second storey's skirt roof, as the eye knows it, stays below the top storey's floor", () => {
  const sk = site.walk.roofs.filter((r) => Math.abs((r.z0 + r.z1) / 2 - L.at[1]) < 1 && Math.abs((r.x0 + r.x1) / 2 - L.at[0]) < 0.1 && r.floor > 25 && r.floor < L.floor - 1);
  assert.equal(sk.length, 1, "the second storey's roof is not found");
  assert.ok(sk[0].top <= L.floor + 1e-6, `it reaches ${sk[0].top.toFixed(2)}, over the floor at ${L.floor.toFixed(2)}`);
});

test("a child's eyes clear the hand rail", () => {
  // He is 1.18 m tall and his eyes are at the middle of his head (monk.js: the skull's centre at 1.04, its radius 0.14).
  // The hand rail's top: building.js, a bar 0.09 high centred 0.88 over the floor.
  const eyes = 1.04 - 0.02, rail = 0.88 + 0.045;
  assert.ok(eyes - rail > 0.05, `his eyes are ${((eyes - rail) * 100).toFixed(0)} cm over the hand rail`);
});

test("the ground-floor room has a stair in its north-west corner, out of the way of every frame and the door", () => {
  const built = buildInteriors(M, site.halls), R = built.rooms.lingxiao.room;
  assert.ok(R.stair, "the room has no stair"); const [sx, sz] = R.stair.at, ox = R.cx;
  assert.ok(sx - ox < -2 && sz < -6, `its foot stands at (${(sx - ox).toFixed(2)}, ${sz.toFixed(2)})`);
  const room = { ...R, solids: R.solids }; walker.setRoom(room);
  try {
    assert.ok(!walker.blocked(sx, sz), "its foot is somewhere to stand");
    // A flood from the door reaches its foot and every frame.
    const T = 0.1, k2 = (i, j) => i * 10000 + j, seen = new Set(), [dx, dz] = R.door, todo = [[Math.round(dx / T), Math.round(dz / T)]]; seen.add(k2(...todo[0]));
    while (todo.length) { const [i, j] = todo.pop(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = k2(i + a, j + b); if (seen.has(n) || walker.blocked((i + a) * T, (j + b) * T)) continue; seen.add(n); todo.push([i + a, j + b]); } }
    const got = (x, z) => seen.has(k2(Math.round(x / T), Math.round(z / T)));
    assert.ok(got(sx, sz), "the stair's foot cannot be walked to from the door");
    for (const s of Object.values(built.spots).filter((s) => s.room === "lingxiao")) assert.ok(got(s.at[0], s.at[1]), `the frame ${s.item.id} cannot be walked to`);
  } finally { walker.setRoom(null); }
});

test("a place kept upstairs is kept as upstairs", () => {
  assert.equal(sanitizePlace({ x: 0, z: -127.2, yaw: 3.1, up: "lingxiao" }).up, "lingxiao");
  assert.equal(sanitizePlace({ x: 0, z: -127.2, yaw: 3.1 }).up, null);
  assert.equal(sanitizePlace({ x: 0, z: -127.2, yaw: 3.1, up: "<b>" }).up, null);
});
