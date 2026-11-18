import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../../app/src/site.js");
const { createTrees } = await import("../../app/src/trees.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M);
const inCourt = site.cedars.filter((c) => !c[5]);   // the hill cedars stand on slopes; their spot is not the ground under every bough

// Each cedar in the courts grown on its own, so that every leaf card corner found is its own. Only cedars are grown,
// so the foliage is the one mesh drawn with a leaf sheet; the wood has none.
const grown = inCourt.map((c) => {
  const scene = new THREE.Group(); createTrees(scene, M, [c]);
  const out = [];
  for (const m of scene.children.filter((o) => o.isMesh && o.material.map)) {
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) out.push({ y: P.getY(i) - c[1], r: Math.hypot(P.getX(i) - c[0], P.getZ(i) - c[2]) });
  }
  return { tree: c, corners: out };
});

test("the cedars in the courts are grown, and their foliage found", () => {
  assert.ok(inCourt.length >= 9, `${inCourt.length} cedars in the courts`);
  for (const { tree: c, corners } of grown) assert.ok(corners.length > 100, `no foliage found on the cedar at ${c[0]}, ${c[2]}`);
});
test("no cedar's boughs hang into the paving: every spray clears the ground it stands on", () => {
  for (const { tree: c, corners } of grown) {
    const low = Math.min(...corners.map((k) => k.y));
    assert.ok(low >= 0.3, `the ${c[4]} m cedar at ${c[0]}, ${c[2]} lowest spray is ${low.toFixed(2)} m above its ground`);
  }
});
test("a young cedar is narrower than it is tall", () => {
  for (const { tree: c, corners } of grown.filter((g) => g.tree[4] < 10)) {
    const reach = Math.max(...corners.map((k) => k.r));
    assert.ok(reach * 2 < c[4], `the ${c[4]} m cedar at ${c[0]}, ${c[2]} spreads ${(reach * 2).toFixed(1)} m across`);
  }
});
test("a young cedar is clothed nearly to the ground, not bare below like an old one", () => {
  for (const { tree: c, corners } of grown.filter((g) => g.tree[4] < 10)) {
    const low = Math.min(...corners.map((k) => k.y));
    assert.ok(low < 1.0, `the ${c[4]} m cedar at ${c[0]}, ${c[2]} is bare to ${low.toFixed(2)} m`);
  }
});

// Where the foot takes over from the trunk (#91): at the top of the foot, its ring is the trunk's ring at that height,
// the same radius within a hundredth and the same centre within a centimetre, so that the tree is one piece from the
// ground up. The trunk is measured on its own curve, the foot on its own geometry.
const everyTree = (() => { const scene = new THREE.Group(); return createTrees(scene, M, site.trees.filter((t) => !t[5])); })();
const trunkAt = (j, y) => { let lo = 0, hi = 1; const P = new THREE.Vector3(); for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; j.curve.getPoint(mid, P); if (P.y < y) lo = mid; else hi = mid; } j.curve.getPoint(lo, P); return { r: j.r0 + (j.r1 - j.r0) * lo, x: P.x, z: P.z }; };
const footTop = (j) => { const P = j.foot.attributes.position, R = j.ring, pts = []; for (let k = 0; k < R; k++) pts.push([P.getX(k), P.getY(k), P.getZ(k)]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / R, cz = pts.reduce((s, p) => s + p[2], 0) / R, r = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[2] - cz), 0) / R; return { y: pts[0][1], r, x: cx, z: cz }; };
test("at the top of every tree's foot, the foot is the trunk: radius within 1%, centre within 1 cm", () => {
  // every ginkgo and maple stands on a foot; a cedar's trunk is grown flaring into its roots in one piece and has none
  assert.ok(everyTree.joints && everyTree.joints.length >= 9, `only ${everyTree.joints ? everyTree.joints.length : 0} feet reported`);
  assert.equal(everyTree.joints.filter((j) => j.kind === "cedar").length, 0, "a cedar should have no separate foot");
  const wrong = [];
  for (const j of everyTree.joints) { const f = footTop(j), t = trunkAt(j, f.y), dr = Math.abs(f.r / t.r - 1), dc = Math.hypot(f.x - t.x, f.z - t.z);
    if (dr > 0.01 || dc > 0.01) wrong.push(`${j.kind} ${j.h} m at ${j.at.join(", ")}: radius ${(dr * 100).toFixed(1)}% off, centre ${(dc * 100).toFixed(1)} cm off`); }
  assert.deepEqual(wrong, []);
});
test("the trunk is drawn with as many sides as its foot where they meet", () => {
  for (const j of everyTree.joints) assert.equal(j.sides, j.ring, `${j.kind} ${j.h} m: a ${j.sides}-sided trunk on a ${j.ring}-sided foot`);
});
// The cedars' wood is grown by three's TreeGenerator (#162): read its skeleton.
const shaftAt = (c, yy) => { const rings = c.tubes.find((t) => t.level === 0).rings; for (let i = 1; i < rings.length; i++) if (rings[i].pos.y >= yy) { const a = rings[i - 1], b = rings[i], f = (yy - a.pos.y) / (b.pos.y - a.pos.y); return a.radius + (b.radius - a.radius) * f; } return rings[rings.length - 1].radius; };
const groundOf = (c) => site.cedars.find((t) => t[0] === c.at[0] && t[2] === c.at[1])[1];
test("a young cedar's trunk is slender: 0.12 to 0.2 m across", () => {
  const young = everyTree.cedars.filter((c) => c.young); assert.ok(young.length >= 2, `only ${young.length} young cedars grown`);
  for (const c of young) { const d = 2 * shaftAt(c, groundOf(c) + 1.3); assert.ok(d >= 0.12 && d <= 0.2, `the ${c.h} m cedar is ${d.toFixed(3)} m across at breast height`); }
});
test("a cedar's trunk swells into its roots in one piece: wider at the ground than at breast height, with no foot drawn to meet it", () => {
  for (const c of everyTree.cedars) { const y0 = groundOf(c), foot = shaftAt(c, y0 + 0.05), breast = shaftAt(c, y0 + 1.3); assert.ok(foot > breast * 1.15, `the ${c.h} m cedar at ${c.at}: ${foot.toFixed(3)} m at the ground, ${breast.toFixed(3)} m at breast height`); }
});
test("at every fork of every cedar the boughs carry 0.8-1.2 of the wood that comes in", () => {
  let n = 0; const off = [];
  for (const c of everyTree.cedars) for (const t of c.tubes) if (t.kids && t.kids.length) { n++; const r = t.kids.reduce((a, k) => a + k * k, 0) / (t.base * t.base); if (r < 0.8 || r > 1.2) off.push(`${c.h} m cedar at ${c.at}: ${r.toFixed(2)}`); }
  assert.ok(n >= 50, `only ${n} forks`); assert.deepEqual(off.slice(0, 6), []);
});
test("a cedar grown twice is the same cedar, point for point", () => {
  const again = createTrees(new THREE.Group(), M, site.trees.filter((t) => !t[5]));
  for (let i = 0; i < everyTree.cedars.length; i++) { const a = everyTree.cedars[i].geometry.attributes.position.array, b = again.cedars[i].geometry.attributes.position.array; assert.equal(a.length, b.length); assert.ok(a.every((v, k) => v === b[k]), `cedar ${i} differs`); }
});
test("a cedar's branches end inside the foliage they carry", () => {
  assert.ok(everyTree.branches && everyTree.branches.length > 50, "no branches reported");
  const out = everyTree.branches.filter((b) => b.inside > 1e-3);
  assert.deepEqual(out.map((b) => `${b.h} m cedar: ${(b.inside * 100).toFixed(0)} cm beyond its spray`).slice(0, 8), []);
});
test("every tree's foot is lit from outside: its normals face away from the trunk, and its top ring's are the trunk's own", () => {
  const wrong = [];
  for (const j of everyTree.joints) {
    const P = j.foot.attributes.position, N = j.foot.attributes.normal, R = j.ring + 1, rings = P.count / R; let worst = 1, top = 0;
    for (let i = 0; i < rings; i++) for (let k = 0; k < R; k++) {
      const v = i * R + k, y = P.getY(v); let lo = 0, hi = 1; const C = new THREE.Vector3(); for (let n = 0; n < 40; n++) { const mid = (lo + hi) / 2; j.curve.getPoint(mid, C); if (C.y < Math.max(y, j.curve.getPoint(0).y)) lo = mid; else hi = mid; }
      j.curve.getPoint(lo, C); const out = new THREE.Vector3(P.getX(v) - C.x, 0, P.getZ(v) - C.z).normalize(), n = new THREE.Vector3(N.getX(v), N.getY(v), N.getZ(v)).normalize();
      worst = Math.min(worst, n.dot(out));
      if (i === 0) { const T = j.curve.getTangent(lo), tube = out.clone().addScaledVector(T, -out.dot(T)).normalize(); top = Math.max(top, (Math.acos(Math.min(1, n.dot(tube))) * 180) / Math.PI); }
    }
    if (worst <= 0.5 || top >= 5) wrong.push(`${j.kind} ${j.h} m at ${j.at.join(", ")}: least outward ${worst.toFixed(2)}, top ring ${top.toFixed(1)}° off the trunk`);
  }
  assert.deepEqual(wrong.slice(0, 8), []);
});
test("a trunk begins at the top of its foot and shares that ring's corners: nothing of it shows through the foot", () => {
  const wrong = [];
  for (const j of everyTree.joints) {
    const T = j.curve.geo.attributes.position, F = j.foot.attributes.position, top = F.getY(0); let low = Infinity, far = 0;
    for (let i = 0; i < T.count; i++) low = Math.min(low, T.getY(i));
    for (let k = 0; k < j.ring; k++) { let near = Infinity; for (let i = 0; i <= j.ring; i++) near = Math.min(near, Math.hypot(T.getX(i) - F.getX(k), T.getY(i) - F.getY(k), T.getZ(i) - F.getZ(k))); far = Math.max(far, near); }
    // and the trunk's first ring turns the way its second does: corner k of each above the other, not a quarter turn round,
    // which would twist the tube's first band inside out
    const centre = (r) => { let cx = 0, cz = 0; for (let k = 0; k < j.ring; k++) { cx += T.getX(r + k); cz += T.getZ(r + k); } return [cx / j.ring, cz / j.ring]; };
    const c0 = centre(0), c1 = centre(j.ring + 1), ang = (i, c) => Math.atan2(T.getZ(i) - c[1], T.getX(i) - c[0]);
    let twist = 0; for (let k = 0; k < j.ring; k++) { let d = Math.abs(ang(k, c0) - ang(j.ring + 1 + k, c1)); d = Math.min(d, 2 * Math.PI - d); twist = Math.max(twist, d); }
    if (twist > Math.PI / j.ring) wrong.push(`${j.kind} ${j.h} m at ${j.at.join(", ")}: the trunk's first band twists ${(twist * 180 / Math.PI).toFixed(0)} degrees`);
    if (low < top - 0.001 || far > 0.001) wrong.push(`${j.kind} ${j.h} m at ${j.at.join(", ")}: trunk reaches ${((top - low) * 100).toFixed(1)} cm into its foot, corners ${(far * 1000).toFixed(1)} mm apart`);
  }
  assert.deepEqual(wrong.slice(0, 8), []);
});
test("a trunk is drawn facing outward: from outside, a ray meets its near side, not the inside of its far side", () => {
  const rc = new THREE.Raycaster(), wrong = [];
  for (const j of everyTree.joints) {
    const mesh = new THREE.Mesh(j.curve.geo, new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
    for (const dy of [1.3, 2.0]) {
      const P = new THREE.Vector3(); let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; j.curve.getPoint(mid, P); if (P.y < j.y + dy) lo = mid; else hi = mid; } j.curve.getPoint(lo, P);
      rc.set(P.clone().add(new THREE.Vector3(0, 0, 3)), new THREE.Vector3(0, 0, -1)); const h = rc.intersectObject(mesh)[0];
      if (!h || h.point.z < P.z) wrong.push(`${j.kind} ${j.h} m at ${j.at.join(", ")}: at ${dy} m the first face met is ${h ? "the inside of the far side" : "none"}`);
    }
  }
  assert.deepEqual(wrong.slice(0, 6), []);
});

// Every tree near enough to walk up to stands in a bed of earth (#199 lost the cedars' when their wood came to be grown
// by the generator, which never called `root()`): the bed round the trunk, and wide enough that the wood's spread at the
// paving, roots and flare, comes down into earth and not onto the stone.
test("every near tree stands in a bed of earth as wide as its wood at the ground", () => {
  const wrong = [];
  for (const t of site.trees.filter((s) => !s[5])) {
    const scene = new THREE.Group(); createTrees(scene, M, [t]);
    const soil = scene.children.find((o) => o.material === M.earth), bark = scene.children.find((o) => o.material === M.bark);
    if (!soil) { wrong.push(`the ${t[3]} at ${t[0]}, ${t[2]} has no bed`); continue; }
    const S = soil.geometry.attributes.position, B = bark.geometry.attributes.position;
    let cx = 0, cz = 0; for (let i = 0; i < S.count; i++) { cx += S.getX(i); cz += S.getZ(i); } cx /= S.count; cz /= S.count;
    let inner = Infinity; for (let i = 0; i < S.count; i++) if (Math.abs(S.getY(i) - t[1] - 0.012) < 1e-4) inner = Math.min(inner, Math.hypot(S.getX(i) - t[0], S.getZ(i) - t[2]));
    let spread = 0; for (let i = 0; i < B.count; i++) { const y = B.getY(i) - t[1]; if (y >= 0 && y < 0.05) spread = Math.max(spread, Math.hypot(B.getX(i) - t[0], B.getZ(i) - t[2])); }
    if (Math.hypot(cx - t[0], cz - t[2]) > 0.15) wrong.push(`the ${t[3]} at ${t[0]}, ${t[2]}: its bed is centred ${Math.hypot(cx - t[0], cz - t[2]).toFixed(2)} m off`);
    if (inner < spread) wrong.push(`the ${t[3]} at ${t[0]}, ${t[2]}: its bed reaches ${inner.toFixed(2)} m, its wood ${spread.toFixed(2)} m at the ground`);
  }
  assert.deepEqual(wrong, []);
});
