// T05's grown trees (app/levels/t05/flora.js): the pines, cypresses, bare broadleaves and poplars inside and outside the walls. The same seed grows
// the same tree point for point (the page grows them again and the `t05-treeseed` scenario compares its fingerprint with Node's); no tree stands
// over the ceiling its place was given; the axis's crowns stay inside the ellipsoids the views along it are cleared against; and the whole is held
// to a budget of triangles and draws.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { createMaterials } = await import("../../app/src/materials.js");
const { growTree, buildFlora, floraHash, KINDS } = await import("../../app/levels/t05/flora.js");
const { buildSite, COURT_TREES, COMPOUND } = await import("../../app/levels/t05/site.js");
const T05S = await import("../../app/levels/t05/site.js");
const { AXIS_TREES, TRUNKS, treeBlocks, SIGHTS, PATH } = await import("../../app/levels/t05/axis.js");
const { RIDGE } = await import("../../app/levels/t05/hall.js");
const { planSurround, eaveCap, growKind, growHeight, LIMITS, KIND_AT, ARRIVAL_POPLARS, POPLAR_H } = await import("../../app/levels/t05/surround.js");
const { TRUNK_MAX } = await import("../../app/levels/t05/flora.js");

const M = createMaterials(), site = buildSite(M);

test("the same tree twice is the same tree, to a tenth of a millimetre; a tree elsewhere is another", () => {
  for (const kind of Object.keys(KINDS)) for (const far of [false, true]) {
    const t = { kind, x: 31.3, z: 12.7, h: 10, r: 0.38 }, a = growTree(t, far), b = growTree(t, far), c = growTree({ ...t, x: 33.1 }, far);
    const fa = floraHash([a.trunk, a.wood, ...a.needles]), fb = floraHash([b.trunk, b.wood, ...b.needles]), fc = floraHash([c.trunk, c.wood, ...c.needles]);
    assert.equal(fa, fb, `${kind} (${far ? "far" : "near"}) grows the same twice`);
    assert.notEqual(fa, fc, `${kind} (${far ? "far" : "near"}) grows differently a little further on`);
  }
  const again = buildSite(createMaterials());
  assert.deepEqual(again.flora.census.map((c) => c.hash), site.flora.census.map((c) => c.hash), "the whole place grows the same trees on a second build");
  assert.equal(typeof globalThis.__flora, "function", "the page can be asked what it grew"); assert.equal(globalThis.__flora().inner.hash, again.flora.inner.hash);
});

test("every tree of the plan is grown, each of its kind: the court's four, the axis's fourteen, the town's 151 and the arrival's group of poplars", () => {
  const plan = planSurround(COMPOUND), census = site.flora.census;
  assert.equal(census.length, COURT_TREES.length + AXIS_TREES.length + T05S.EAST_WALL_TREES.length + plan.trees.length + ARRIVAL_POPLARS.length);
  const kinds = new Set(census.map((c) => c.kind)); for (const k of Object.keys(KINDS)) assert.ok(kinds.has(k), `${KINDS[k]} grows`);
  assert.ok(AXIS_TREES.filter((t) => t.y === 0).every((t) => t.kind === "cypress"), "the way between the gates is lined with cypresses");
  const terrace = AXIS_TREES.filter((t) => t.y > 0);
  assert.ok(terrace.every((t) => t.old && ["cypress", "pine"].includes(t.kind)) && [-1, 1].every((sx) => { const row = terrace.filter((t) => Math.sign(t.x) === sx); return row.filter((t) => t.kind === "pine").length >= 1 && row.filter((t) => t.kind === "cypress").length >= 4; }), "the terrace is two rows of old arborvitae with a pine or two among them (the art director and the general director's research, 2026-11-25)");
  assert.ok(![...AXIS_TREES, ...COURT_TREES].some((t) => t.kind === "broad"), "no bare broadleaf among the temple's own trees (none is on record there; the small ones at the platform's foot are the art director's, from the owner's photograph)");
  const byHand = (t) => KIND_AT.some(([x, z]) => Math.abs(t.x - x) < 0.05 && Math.abs(t.z - z) < 0.05);
  assert.equal(plan.trees.filter(byHand).length, KIND_AT.length, "every tree set by hand is one of the plan's");
  for (const t of plan.trees) if (!byHand(t)) assert.equal(growKind(t), t.kind === "bare" ? growKind(t) : t.kind, "a pine stays a pine, a cypress a cypress");
  assert.ok(plan.trees.filter((t) => t.kind === "bare").every((t) => ["broad", "poplar"].includes(growKind(t))), "a bare broadleaf outside the walls is grown as a broadleaf or a poplar");
});

test("no tree stands over its height: the plan's (the eave line in cam01 and cam07, 13 m, 10 m beside the hall), the court's under the eave line too", () => {
  for (const c of site.flora.census) assert.ok(c.top <= c.h + 1e-6, `the ${c.kind} at (${c.at}) reaches ${c.top} m, over its ${c.h} m`);
  for (const t of COURT_TREES) assert.ok(Math.min(t.h, eaveCap(t.x, t.z)) <= LIMITS.treeMax, "the court's trees keep to the town's ceiling");
});

test("a terrace tree's boughs and needles stay inside its ellipsoid, and its trunk inside the upright post the views are cleared against", async () => {
  for (const t of AXIS_TREES.filter((q) => q.env)) {
    const g = growTree(t), c = new THREE.Vector3(t.x, t.y + t.env.base + t.env.ry, t.z), p = new THREE.Vector3();
    for (const geo of [g.wood, ...g.needles]) { const A = geo.attributes.position; for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i); const e = Math.hypot((p.x - c.x) / t.env.rx, (p.y - c.y) / t.env.ry, (p.z - c.z) / t.env.rx); assert.ok(e <= 1.0001, `a point of the tree at (${t.x}, ${t.z}) is out of its ellipsoid (${e.toFixed(3)})`); } }
    // (an old tree's trunk twists and leans a little: it keeps within 0.35 m more than its radius, under its crown)
    const A = g.trunk.attributes.position; for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i); if (p.y > t.y + 1.2 && p.y < t.y + t.env.base) assert.ok(Math.hypot(p.x - t.x, p.z - t.z) <= t.r + (t.old ? 0.35 : 0) + 1e-6, `the trunk at (${t.x}, ${t.z}) leaves its post at ${p.y.toFixed(2)} m`); }
  }
  // and so treeBlocks, which the cam07 tests ask, still bounds them for the lines kept
  const { KEPT_SIGHTS } = await import("../../app/levels/t05/axis.js");
  const blocked = []; for (const l of KEPT_SIGHTS) for (const t of TRUNKS.list) if (treeBlocks(SIGHTS.eye, l.to, t)) blocked.push(l.kind);
  assert.deepEqual(blocked, []);
});

test("what he meets of a tree is its trunk only: boughs and needles are out of the bake and the eye, and nothing of the town's trees is", () => {
  let trunks = 0;
  site.root.traverse((o) => {
    if (!o.isMesh || !/(^|-)trees-/.test(o.name)) return;
    if (/-trunks$/.test(o.name)) { trunks++; assert.notEqual(o.userData.walk, false, `${o.name} is in his way`); assert.ok(!o.userData.surround); }
    else assert.equal(o.userData.walk, false, `${o.name} is over his head or outside the walls`);
    assert.ok(o.userData.keep, `${o.name} is merged already and kept out of the static merge`);
  });
  assert.ok(trunks >= 1);
});

test("a budget: under 370 000 triangles of trees in the whole place, in under 30 meshes, merged by stretch so that only what is in view is drawn", () => {
  let tris = 0, meshes = 0;
  site.root.traverse((o) => { if (o.isMesh && /(^|-)trees-/.test(o.name)) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  console.log(`# T05 trees: ${Math.round(tris)} triangles in ${meshes} meshes`);
  assert.ok(tris < 370000, `${tris} triangles (the T05 lead, 2026-11-25: the trees as the art director drew them first, the cap from 340k to 370k, the T4 frame cost to decide)`); assert.ok(meshes < 30, `${meshes} meshes`);
  const one = buildFlora(M, [{ kind: "pine", x: 0, z: 0, h: 10 }]); assert.ok(one.group.children.length <= 2, "one tree's wood and needles in a draw each");
});

test("the art director's lines of 2026-11-25 that a number can hold", () => {
  const plan = planSurround(COMPOUND);
  // beyond the way's end, seen south from the arrival: six in ten bare or more, a quarter evergreen or fewer
  const south = [...plan.trees.filter((t) => t.z > 214 && Math.abs(t.x) < 45).map((t) => growKind(t)), ...ARRIVAL_POPLARS.map((t) => t.kind)];
  const ever = south.filter((k) => k === "pine" || k === "cypress").length / south.length;
  assert.ok(ever <= 0.25 && 1 - ever >= 0.6, `south of the arrival: ${(ever * 100).toFixed(0)}% evergreen of ${south.length}`);
  // the poplar is the one tall thing, 15 to 19 m, only where no picture's ceiling holds it down; every other tree keeps its plan's height
  for (const t of plan.trees) { const h = growHeight(t), set = KIND_AT.find(([x, z, , hh]) => hh && Math.abs(t.x - x) < 0.05 && Math.abs(t.z - z) < 0.05); if (h !== t.h) assert.ok(set ? h === set[3] && h < t.h : growKind(t) === "poplar" && h >= POPLAR_H[0] && h <= POPLAR_H[1] && eaveCap(t.x, t.z) >= 40, `${t.x}, ${t.z}`); }
  assert.ok(plan.trees.some((t) => growHeight(t) > LIMITS.treeMax), "some poplars stand over the roofs");
  // a bare tree's trunk is never wider than a house's door; a bare broadleaf's limbs keep over his head
  for (const c of [...COURT_TREES, ...ARRIVAL_POPLARS.map((t) => ({ ...t }))]) {
    if (c.kind !== "broad" && c.kind !== "poplar") continue;
    const g = growTree(c), rings = g.tubes[0].rings;
    for (const ring of rings) if (ring.pos.y - (c.y ?? 0) > 1.2) assert.ok(ring.radius * g.scale <= TRUNK_MAX * 1.12 + 1e-6, `the ${c.kind} at (${c.x}, ${c.z}) is ${(ring.radius * g.scale).toFixed(2)} m round its middle at ${ring.pos.y.toFixed(1)} m`);
    if (c.kind === "broad") { const W = g.wood.attributes.position; for (let i = 0; i < W.count; i++) if (Math.hypot(W.getX(i) - c.x, W.getZ(i) - c.z) > 1.6) assert.ok(W.getY(i) >= 2.45, `a limb of the bare broadleaf at (${c.x}, ${c.z}) hangs at ${W.getY(i).toFixed(2)} m`); }
  }
});

test("the way's arborvitae are narrow columns branched from low, their crowns a metre or more from the paved path (the art director, 2026-11-25)", () => {
  for (const t of AXIS_TREES.filter((q) => q.y === 0)) {
    const g = growTree(t); let lo = Infinity, reach = 0;
    for (const geo of [g.wood, ...g.needles]) { const A = geo.attributes.position; for (let i = 0; i < A.count; i++) { const d = Math.hypot(A.getX(i) - t.x, A.getZ(i) - t.z); if (d > 0.5) lo = Math.min(lo, A.getY(i) - t.y); reach = Math.max(reach, d); } }
    assert.ok(Math.abs(t.x) - reach - PATH.hw >= 1, `the cypress at (${t.x}, ${t.z}) comes ${(Math.abs(t.x) - reach - PATH.hw).toFixed(2)} m from the path`);
    assert.ok(lo >= 1.7 && lo <= 2.6, `its needles and boughs start ${lo.toFixed(2)} m up`);
    assert.ok(reach <= 1.6 && t.h >= 6 && t.h <= 10, `a narrow column (${reach.toFixed(2)} m round, ${t.h} m)`);
  }
});

test("no poplar's tip stands higher in the picture than the great hall's ridge, from any of the court's views (the art director, 2026-11-25)", () => {
  const plan = planSurround(COMPOUND), poplars = [...plan.trees.filter((t) => growKind(t) === "poplar").map((t) => ({ ...t, h: growHeight(t) })), ...ARRIVAL_POPLARS];
  const rows = [];
  for (const name of ["cam01", "cam02", "a-tall", "gateway", "terrace"]) {
    const [vx, vz, yaw] = site.views[name], eyeY = (name === "terrace" ? 3 : 0) + 1.6;
    // (only what is in the picture: within 50° either side of the way the view looks, north being yaw 0)
    const seen = poplars.filter((t) => { let a = Math.atan2(-(t.x - vx), -(t.z - vz)) - yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) < (50 * Math.PI) / 180; });
    const ridge = Math.atan2(RIDGE.height - eyeY, Math.max(1, vz - RIDGE.zm)), worst = Math.max(-1, ...seen.map((t) => Math.atan2(t.h - eyeY, Math.hypot(t.x - vx, t.z - vz))));
    rows.push(`${name}: ridge ${((ridge * 180) / Math.PI).toFixed(1)}°, highest poplar tip ${((worst * 180) / Math.PI).toFixed(1)}°`);
    assert.ok(worst < ridge, rows.at(-1));
  }
  console.log("# " + rows.join("; "));
});

test("north of the rows the court's trees are broad pines, scattered, two framing cam01 below the eave (the art director, #573 comment 7166589253)", () => {
  assert.ok(COURT_TREES.every((t) => t.kind === "pine"), "pines only in the court");
  const corners = COURT_TREES.filter((t) => t.old);
  assert.equal(corners.length, 2); for (const t of corners) assert.ok(t.rx >= 3.2 && Math.min(t.h, eaveCap(t.x, t.z)) <= eaveCap(t.x, t.z), `${t.x}: a wide crown under the eave`);
  assert.ok(new Set(COURT_TREES.map((t) => Math.round(t.h))).size >= 3, "of uneven heights");
});

test("no grown crown stops the low sun's rays to the archway's middle bay or the faces of its two middle posts (J01, the art director's 55% line; #722)", async () => {
  // The ellipsoid test in axis.js (sunClear) samples the bay between the posts; this asks the needles as they are grown, across the posts' faces too
  // (x ±2.65): the T4 of 2410f50 found the east post in the shade of the wall's last cypress, which the ellipsoid test had never sampled.
  const { SUN, AXIS } = await import("../../app/levels/t05/axis.js");
  const sun = new THREE.Vector3(...SUN), rc = new THREE.Raycaster(), stops = [];
  for (const t of [...AXIS_TREES, ...T05S.EAST_WALL_TREES]) {
    const g = growTree(t, false), meshes = g.needles.map((n) => new THREE.Mesh(n, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
    for (let x = -2.65; x <= 2.651; x += 0.265) for (let y = 1.5; y <= 8.51; y += 0.5) { rc.set(new THREE.Vector3(x, y, AXIS.paifangZ + 0.4), sun); if (rc.intersectObjects(meshes).length) stops.push(`${t.x},${t.z} at (${x.toFixed(2)}, ${y})`); }
  }
  assert.deepEqual(stops, [], "no crown in the sun's way to the archway's middle bay");
});
