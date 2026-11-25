// The great hall's altar and what stands on it (#432, docs/t05/PLAN.md item 7): the altar's size and place, the seven
// on the middle of their bays with the middle one reading tallest from the threshold, the fourteen attendants and the two
// kings, no column standing in any of them, the ways round them wide enough and walked on the floor baked from what is
// drawn, and from cam03's eyes the faces of the middle three seen past every column.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { inflateRawSync } from "node:zlib";
const { buildSite, createWalker, STATION } = await import("../../app/levels/t05/site.js");
const { HALL, XS, ZS, buildHall, HALL_DOORS } = await import("../../app/levels/t05/hall.js");
const { ALTAR, FIGURES, SEAT, ATTEND, KING, buildAltar } = await import("../../app/levels/t05/altar.js");
const { loadLevel } = await import("../../app/src/level.js");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const level = await loadLevel("t05"), site = buildSite(M), hall = buildHall(M), altar = buildAltar();
const file = ensure(prepare(level)), decoded = decode(file.bytes, (b) => inflateRawSync(b));
const walker = createGridWalker(createWalker(site), gridsByPlace(decoded), { doors: site.halls });
const top = HALL.floor + ALTAR.h, mid = (i) => (XS[i] + XS[i + 1]) / 2;
// The walls' inner faces (hall.js: the wall HALL.wall thick, its outer face HALL.out beyond the column line; the front wall's face just behind its line).
const IN = { x: XS[XS.length - 1] + HALL.out - HALL.wall, zF: ZS[0] + HALL.front - HALL.wall, zB: ZS[ZS.length - 1] - HALL.out + HALL.wall };
// cam03's eyes as the page has them (third person, upright third person, first person: __frame() on #425's commit).
const EYES = [[0, 3.66, 6.57], [0, 3.8, 6.58], [0, 4.3, 0.6]];

test("the altar is 37.5 × 4.8 × 0.87 m, its top at +3.87, its front 14.5 m in; the seven stand on the middle of their bays", () => {
  assert.deepEqual([ALTAR.w, ALTAR.d, ALTAR.h, ALTAR.zF], [37.5, 4.8, 0.87, -14.5]);
  assert.ok(Math.abs(ALTAR.zF - ALTAR.d - ALTAR.zB) < 1e-9 && Math.abs(top - 3.87) < 1e-9);
  const g = altar.parts.stone[0]; g.computeBoundingBox(); const b = g.boundingBox;
  assert.ok(Math.abs(b.max.x - b.min.x - ALTAR.w) < 1e-6 && Math.abs(b.max.z - ALTAR.zF) < 1e-6 && Math.abs(b.min.z - ALTAR.zB) < 1e-6, "the altar's body where ALTAR says");
  // east to west: 迦叶, 拘留孙, 尸弃, 毗婆尸, 毗舍浮, 拘那含牟尼, 释迦牟尼 on the middle seven bays (DECISIONS.md §3)
  assert.deepEqual(FIGURES.map((f) => f.x), [16.45, 11.33, 5.8, 0, -5.8, -11.33, -16.45]);
  FIGURES.forEach((f, k) => assert.ok(Math.abs(f.x - mid(7 - k)) < 0.01, `${f.id} on the middle of bay ${7 - k}`));
  // every base and halo within the altar, a figure's whole height from the altar's top where FIGURES says
  for (const t of altar.tops) assert.ok(Math.abs(t.top - top - FIGURES.find((f) => f.id === t.id).h) < 1e-6, `${t.id}'s top`);
  for (const g of [...altar.parts.clay, ...altar.parts.halo]) { g.computeBoundingBox(); const b = g.boundingBox; if (b.min.y < top - 0.01 || Math.abs(b.min.x + b.max.x) / 2 > KING.x - 0.1) continue;   // (the kings stand on the floor)
    assert.ok(b.min.x > -ALTAR.w / 2 - 0.15 && b.max.x < ALTAR.w / 2 + 0.15 && b.min.z > ALTAR.zB - 0.15 && b.max.z < ALTAR.zF + 0.15, "what stands on the altar stays on it"); }
});

test("the middle one is not lower than his neighbours, the six within 8.6–8.9 m; Shakyamuni turned 7° west", () => {
  const [mid3, ...rest] = [FIGURES[3], ...FIGURES.filter((_, k) => k !== 3)];
  assert.equal(mid3.id, "vipasyin");
  for (const f of rest) { assert.ok(f.h >= 8.6 && f.h <= 8.9, `${f.id} ${f.h}: 8.6–8.9 m (DECISIONS.md §3)`); assert.ok(mid3.h >= f.h, `Vipashyin not lower than ${f.id}`); }
  assert.ok(mid3.h <= 9.5, "within the public figures' 8.6–9.5 m");
  // Shakyamuni at the west end is turned 7° to the west.
  const sak = FIGURES[6]; assert.equal(sak.id, "sakyamuni"); assert.ok(sak.x < 0 && Math.abs(sak.yaw + (7 * Math.PI) / 180) < 1e-9);
  assert.ok(Math.sin(sak.yaw) < 0, "facing turned toward -x, the west");
});

// #432's second criterion as the art director set it on #493: at cam03 (third person, 1080 lines) the middle one's head
// stands 25–38 px over his neighbours' (2.3% to 3.5% of the picture's height): read as the tallest, not towering.
test("the middle one reads tallest from the threshold, and no more: 25–38 px over his neighbours at cam03", () => {
  // cam03 in third person as the page draws it at 1920 × 1080 (__frame() on #493's commit): eye (0, 3.66, 6.57), a fixed
  // view's 44° lens, pitched up 0.056. At 9.3 m the middle one stood 38.3 px over his neighbours, 0.3 px over the band, and
  // came down to 9.28 (the T05 lead, 2026-11-21): 37.2 px, 0.8 px under it, so a camera moved later turns this red first.
  const cam = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 400);
  cam.position.set(0, 3.66, 6.57); cam.rotation.set(0.056, 0, 0, "YXZ"); cam.updateMatrixWorld();
  const y = (id) => { const t = altar.tops.find((q) => q.id === id); return ((1 - new THREE.Vector3(t.x, t.top, t.z).project(cam).y) / 2) * 1080; };
  for (const n of ["sikhin", "visvabhu"]) { const d = y(n) - y("vipasyin"); assert.ok(d >= 25 && d <= 38, `cam03 third person: ${d.toFixed(1)} px over ${n} (25–38)`); }
});

test("every halo keeps 0.15 m from the frames' beams either side of it, Shakyamuni's turned too (#493)", () => {
  const beams = hall.parts.frame.map((g) => (g.computeBoundingBox(), g.boundingBox));
  let least = Infinity;
  for (const g of altar.parts.halo) {
    g.computeBoundingBox(); const h = g.boundingBox;
    for (const b of beams) {
      if (b.max.y <= h.min.y || b.min.y >= h.max.y || b.max.z <= h.min.z || b.min.z >= h.max.z) continue;   // not beside it
      const gap = Math.max(b.min.x - h.max.x, h.min.x - b.max.x);
      least = Math.min(least, gap);
      assert.ok(gap >= 0.15, `a halo (x ${h.min.x.toFixed(2)} to ${h.max.x.toFixed(2)}) runs into a beam (x ${b.min.x.toFixed(2)} to ${b.max.x.toFixed(2)})`);
    }
  }
  assert.ok(least < Infinity, "the halos stand beside the frames");
});

test("fourteen attendants, two to each, either side and a little in front, 2.5–2.7 m; two kings at the altar's ends, 3.5–4.0 m", () => {
  assert.equal(altar.attendants.length, 14);
  for (const f of FIGURES) {
    const two = altar.attendants.filter((a) => a.of === f.id); assert.equal(two.length, 2, f.id);
    assert.ok(two.some((a) => a.x < f.x) && two.some((a) => a.x > f.x), `${f.id}'s attendants either side`);
    for (const a of two) { assert.ok(a.z > SEAT.z + SEAT.d / 2 - 0.4, `${f.id}'s attendant in front of the base's middle`); assert.ok(a.z < ALTAR.zF, "on the altar"); }
  }
  assert.ok(ATTEND.h >= 2.5 && ATTEND.h <= 2.7);
  for (const a of altar.attendants) assert.ok(Math.abs(a.top - top - ATTEND.h) < 1e-9);
  assert.equal(altar.kings.length, 2);
  for (const k of altar.kings) { assert.ok(Math.abs(k.x) >= 19.5 && Math.abs(k.x) <= 20.5, `a king at x ${k.x}`); assert.ok(Math.abs(k.x) - KING.w / 2 > ALTAR.w / 2, "beyond the altar's end"); }
  assert.ok(KING.h >= 3.5 && KING.h <= 4.0);
});

test("no column stands in the altar, a base or a king, and the ways round them are each at least 3 m", () => {
  // every column, eave and inner, as a circle on the plan
  const cols = [...hall.columns.map(([x, z]) => [x, z, HALL.colR]), ...hall.inner.map(([x, z]) => [x, z, HALL.innerR])];
  const boxes = [["the altar", -ALTAR.w / 2 - 0.15, ALTAR.w / 2 + 0.15, ALTAR.zB - 0.15, ALTAR.zF + 0.15],
    ...altar.kings.map((k) => ["a king", k.x - KING.w / 2, k.x + KING.w / 2, k.z - KING.w / 2, k.z + KING.w / 2])];
  for (const [name, x0, x1, z0, z1] of boxes) for (const [x, z, r] of cols) {
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
    assert.ok(Math.hypot(dx, dz) > r + 0.2, `the column at (${x.toFixed(2)}, ${z.toFixed(2)}) stands in or against ${name}`);
  }
  // the back inner columns stand behind the altar, 0.38 m clear of its back (the structural review of #432)
  assert.ok(Math.abs(ALTAR.zB - (ZS[4] + HALL.innerR) - 0.384) < 0.01);
  const front = ALTAR.zF - IN.zF, side = IN.x - Math.max(ALTAR.w / 2, KING.x + KING.w / 2), back = ALTAR.zB - IN.zB;
  assert.ok(-front >= 3, `before the altar ${(-front).toFixed(2)} m`); assert.ok(side >= 3, `east and west ${side.toFixed(2)} m`); assert.ok(back >= 3, `behind ${back.toFixed(2)} m`);
  assert.ok(-front >= 8 && -front <= 14, "the band of worship before it 8 m deep at least (ARCHITECTURE.md §2.3: 8–10)");
});

test("on the baked floor the altar, the figures and the kings stop him, and from the threshold he walks before the altar, down both aisles and round behind it", () => {
  for (const [x, z, what] of [[0, (ALTAR.zF + ALTAR.zB) / 2, "the altar"], [16.45, SEAT.z, "a base"], [-16.45, ATTEND.z, "an attendant's place"], [KING.x, KING.z, "the east king"], [-KING.x, KING.z, "the west king"]]) assert.ok(walker.blocked(x, z), `${what} at (${x}, ${z}) stops him`);
  // a flood over the baked floor from the threshold, a fifth of a metre at a step, within the walls
  const step = 0.2, key = (i, j) => `${i},${j}`, seen = new Set(), queue = [[0, Math.round(STATION.C[1] / step)]];
  const open = (i, j) => { const x = i * step, z = j * step; return Math.abs(x) < IN.x && z < STATION.C[1] + 0.01 && z > IN.zB && !walker.blocked(x, z) && Math.abs(walker.heightAt(x, z) - HALL.floor) < 0.3; };
  seen.add(key(...queue[0]));
  while (queue.length) { const [i, j] = queue.pop(); for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { const k = key(a, b); if (!seen.has(k) && open(a, b)) { seen.add(k); queue.push([a, b]); } } }
  const reached = (x, z) => seen.has(key(Math.round(x / step), Math.round(z / step)));
  for (const [x, z, what] of [[0, ALTAR.zF + 1, "before Vipashyin"], [0, ALTAR.zF + 9, "the band of worship's south edge"], [16.45, ALTAR.zF + 2, "before Kasyapa"], [-16.45, ALTAR.zF + 2, "before Shakyamuni"],
    [21.4, -17, "the east aisle"], [-21.4, -17, "the west aisle"], [0, ALTAR.zB - 2.5, "behind the altar"], ...["D", "E", "F"].map((k) => [...STATION[k], k])]) {
    // (while the doors are shut, the first release: nothing inside is reached from the threshold, which is the point; HALL_DOORS in hall.js)
    if (HALL_DOORS.shut) assert.ok(!reached(x, z), `${what} (${x}, ${z}) is not reached from the threshold: the doors are shut`);
    else assert.ok(reached(x, z), `${what} (${x}, ${z}) reached from the threshold`);
  }
});

test("from cam03's three eyes the faces of the middle three are seen past every column, and the lowest beam is still over every head", () => {
  const cols = [...hall.columns.map(([x, z]) => [x, z, HALL.colR, HALL.floor + HALL.column]), ...hall.inner.map(([x, z]) => [x, z, HALL.innerR, HALL.beams[0]])];
  for (const [ex, ey, ez] of EYES) for (const t of altar.tops) {
    // the face: a hand's breadth either side of the head's middle, at the eyes' height of the head
    const blocked = [];
    for (const dx of [-0.25, 0, 0.25]) {
      const hx = t.x + dx, hy = t.head, hz = t.z + 0.6;
      for (const [cx, cz, r, ctop] of cols) {
        // nearest approach on the plan of the line from the eye to the face, and its height there
        const vx = hx - ex, vz = hz - ez, s = Math.max(0, Math.min(1, ((cx - ex) * vx + (cz - ez) * vz) / (vx * vx + vz * vz)));
        const d = Math.hypot(ex + s * vx - cx, ez + s * vz - cz), y = ey + s * (hy - ey);
        if (s > 0 && s < 1 && d < r + 0.02 && y < ctop) blocked.push(`(${cx.toFixed(2)}, ${cz.toFixed(2)})`);
      }
    }
    if (Math.abs(t.x) < 6) assert.deepEqual(blocked, [], `from (${ex}, ${ey}, ${ez}) ${t.id}'s face is crossed by the column at ${blocked.join(", ")}`);
  }
  // and from those eyes the line to each head's top passes under the lowest beam wherever it crosses a frame (#425's test, now with the figures' own heights and place)
  for (const [ex, ey, ez] of EYES) for (const t of altar.tops) for (const fx of XS.slice(1, -1)) {
    const s = (fx - ex) / (t.x - ex); if (!(s > 0 && s < 1)) continue;
    const y = ey + s * (t.top - ey), z = ez + s * (t.z - ez);
    const runs = hall.parts.frame.some((g) => { g.computeBoundingBox(); const b = g.boundingBox; return Math.abs((b.min.x + b.max.x) / 2 - fx) < 0.01 && Math.abs(b.min.y - HALL.beams[0]) < 0.01 && z >= b.min.z && z <= b.max.z; });
    if (runs) assert.ok(y < HALL.beams[0] - 0.3, `from (${ex}, ${ey}, ${ez}) to ${t.id}'s top the line crosses the frame at x ${fx} at ${y.toFixed(2)}`);
  }
});
