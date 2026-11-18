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
const trunkAt = (j, y) => { let lo = 0, hi = 1; const P = new THREE.Vector3(); for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; j.curve.getPoint(mid, P); if (P.y < y) lo = mid; else hi = mid; } j.curve.getPoint(lo, P); return { r: j.rad(lo), x: P.x, z: P.z }; };   // as thick as the trunk is drawn there
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

// #92, #93: the wood is one system from the foot to the twigs, and a maple is a Japanese maple.
test("at every fork of every tree, the wood that goes on is 0.8 to 1.2 of the wood that comes in", () => {
  assert.ok(everyTree.forks && everyTree.forks.length > 300, `only ${everyTree.forks ? everyTree.forks.length : 0} forks reported`);
  const wrong = everyTree.forks.filter((f) => f.ratio < 0.8 || f.ratio > 1.2).map((f) => `${f.kind} ${f.h} m: ${f.ratio.toFixed(2)}`);
  assert.deepEqual(wrong.slice(0, 8), [], `${wrong.length} forks out of balance`);
});
test("no branch is wider than 0.7 of its parent where it leaves, and each starts inside it: every point of its first ring within the parent's radius (#200)", () => {
  const wide = everyTree.forks.filter((f) => f.width > 0.7 + 1e-9).map((f) => `${f.kind} ${f.h} m: ${f.width.toFixed(2)}`);
  assert.deepEqual(wide.slice(0, 8), []);
  const set = everyTree.limbs.filter((l) => l.first); assert.ok(set.length > 300, `only ${set.length} branches report their first ring`);
  // 2 cm inside the parent's surface, or a third of its radius on a twig too thin for that
  const out = set.filter((l) => l.first.radial > l.first.R - Math.min(0.02, 0.3 * l.first.R) || (l.first.end && l.first.along > 0)).map((l) => `${l.kind} ${l.h} m, depth ${l.depth}${l.first.end ? " (out of a fork)" : ""}: first ring reaches ${l.first.radial.toFixed(3)} of a parent ${l.first.R.toFixed(3)}, ${l.first.along.toFixed(3)} along`);
  assert.deepEqual(out.slice(0, 8), [], `${out.length} branches begin outside their parent`);
  // and the collar swells where the branch comes out of the parent's surface, not where it starts inside it
  const lost = set.filter((l) => !(l.first.exit > 0)).map((l) => `${l.kind} ${l.h} m, depth ${l.depth}: comes out at ${l.first.exit}`);
  assert.deepEqual(lost.slice(0, 8), []);
});
test("below 2 m no two stems of a maple grow against each other: their centres at least 1.2 times their radii together apart (#200)", () => {
  const close = [];
  for (const c of everyTree.census.filter((t) => t.kind === "maple")) {
    const stems = everyTree.limbs.filter((l) => l.kind === "maple" && l.at[0] === c.at[0] && l.at[1] === c.at[1] && l.depth === 0);
    for (let i = 0; i < stems.length; i++) for (let j = i + 1; j < stems.length; j++) for (let k = 0; k < stems[i].axis.length; k++) {
      const [y, x1, z1, r1] = stems[i].axis[k], [, x2, z2, r2] = stems[j].axis[k];
      if (Math.hypot(x1 - x2, z1 - z2) < 1.2 * (r1 + r2)) close.push(`the maple at ${c.at}: stems ${i} and ${j} at ${y.toFixed(1)} m, ${Math.hypot(x1 - x2, z1 - z2).toFixed(3)} apart, radii ${r1.toFixed(3)} + ${r2.toFixed(3)}`);
    }
  }
  assert.deepEqual(close.slice(0, 8), [], `${close.length} places where two stems touch`);
});
test("the great boughs of the ginkgo and the maple bend through at least five points", () => {
  const great = everyTree.limbs.filter((l) => (l.kind === "ginkgo" && l.depth === 1) || (l.kind === "maple" && l.depth <= 1));
  assert.ok(great.length > 60, `only ${great.length} great boughs`);
  assert.deepEqual(great.filter((l) => l.points < 5).map((l) => `${l.kind} ${l.h} m, depth ${l.depth}: ${l.points} points`).slice(0, 8), []);
});
const maples = everyTree.census.filter((c) => c.kind === "maple");
test("every maple grows as a Japanese maple: two to four stems from the ground, each 15 to 25 cm across, forking three deep", () => {
  assert.ok(maples.length >= 5);
  for (const c of maples) {
    const mine = everyTree.limbs.filter((l) => l.kind === "maple" && l.at[0] === c.at[0] && l.at[1] === c.at[1]), stems = mine.filter((l) => l.depth === 0);
    assert.ok(stems.length >= 2 && stems.length <= 4, `the maple at ${c.at} has ${stems.length} stems`);
    for (const s of stems) assert.ok(2 * s.r >= 0.15 && 2 * s.r <= 0.25, `a stem of the maple at ${c.at} is ${(2 * s.r).toFixed(3)} m across`);
    assert.ok(Math.max(...mine.map((l) => l.depth)) >= 2, `the maple at ${c.at} forks only ${Math.max(...mine.map((l) => l.depth))} deep`);
    assert.equal(everyTree.joints.filter((j) => j.kind === "maple" && j.at[0] === c.at[0] && j.at[1] === c.at[1]).length, stems.length, `not every stem of the maple at ${c.at} has a foot`);
  }
});
test("no two maples are alike, and each grows the same every time", () => {
  const shape = (T, c) => { const mine = T.limbs.filter((l) => l.kind === "maple" && l.at[0] === c.at[0] && l.at[1] === c.at[1]), y0 = Math.min(...mine.map((l) => l.ends[1])); return mine.map((l) => [l.ends[0] - c.at[0], l.ends[1] - y0, l.ends[2] - c.at[1]].map((v) => v.toFixed(2)).join(" ")).join(); };   // where each limb ends, from where the tree stands
  const again = createTrees(new THREE.Group(), M, site.trees.filter((t) => !t[5]));
  const shapes = maples.map((c) => shape(everyTree, c));
  assert.deepEqual(maples.map((c) => shape(again, c)), shapes);
  assert.equal(new Set(shapes).size, shapes.length);
});
test("a maple's wood is under 8,000 triangles, and the woodland's under 116,000 (it was 101,004)", () => {
  for (const c of maples) assert.ok(c.tris <= 8000, `the maple at ${c.at} is ${c.tris} triangles of wood`);
  const all = everyTree.census.reduce((t, c) => t + c.tris, 0); assert.ok(all <= 116004, `the woodland is ${all} triangles of wood`);
});
test("a maple in autumn carries as many leaves as it did, over a crown as broad", () => {
  for (const c of maples) {
    const t = site.trees.find((s) => s[0] === c.at[0] && s[2] === c.at[1]), scene = new THREE.Group(); createTrees(scene, M, [t]);
    const leaves = scene.children.filter((o) => o.isMesh && o.material.map), cards = leaves.reduce((n, m) => n + m.geometry.attributes.position.count, 0) / 4, box = new THREE.Box3(); leaves.forEach((m) => box.expandByObject(m));
    const size = box.getSize(new THREE.Vector3());
    assert.ok(cards >= 340, `the maple at ${c.at} hangs ${cards} cards (it hung 354)`);
    assert.ok(Math.min(size.x, size.z) >= 0.95 * c.h, `the maple at ${c.at} is ${size.x.toFixed(1)} by ${size.z.toFixed(1)} m across`);
  }
});
test("below head height every maple's wood keeps inside the post that stops a visitor", () => {
  for (const t of site.trees.filter((s) => s[3] === "maple")) {
    const scene = new THREE.Group(); createTrees(scene, M, [t]); const P = scene.children.find((o) => o.material === M.bark).geometry.attributes.position, post = site.walk.posts.find((p) => p.x === t[0] && p.z === t[2]);
    let far = 0; for (let i = 0; i < P.count; i++) { const y = P.getY(i) - t[1]; if (y > 0.3 && y < 1.9) far = Math.max(far, Math.hypot(P.getX(i) - t[0], P.getZ(i) - t[2])); }
    assert.ok(post && far <= post.r, `the maple at ${t[0]}, ${t[2]} reaches ${far.toFixed(2)} m, its post ${post ? post.r : "none"}`);
  }
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
