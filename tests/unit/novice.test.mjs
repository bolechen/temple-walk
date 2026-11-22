// The novice's sculpted body (tools/novice.mjs → app/shared/models/novice.glb) is worn on the skeleton monk.js builds.
// These hold it to what that skeleton and the walker expect of any body: made for these bones, his height, standing on the
// floor, weighted so that the cloth hangs where it should, and sole to the floor, the robe over the trousers.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../../app/src/monk.js");
const { readNovice, sculpted: dressed } = await import("./novice-glb.mjs");   // Meshy's body (?body=sculpt); Tripo's is novice-tripo.test.mjs
const { geometries, extras, json } = readNovice();
const PARTS = ["skin", "robe", "legs", "shoes"];
const skinnedWorld = (mesh, i, v = new THREE.Vector3()) => mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);

test("the file is made for this skeleton: its joints are numbered as monk.js's bones are", () => {
  const names = createMonk().skeleton.bones.map((b) => b.name);
  assert.deepEqual(extras.bones, names);
  assert.deepEqual(json.nodes.map((n) => n.name), PARTS, "one mesh for each part he is built of");
  assert.ok(json.images.length === 3 && json.images.every((i) => i.mimeType === "image/webp"), "three textures, as WebP");
});

test("he stands 1.18 m tall on the floor, centred, as wide as the one built in code", () => {
  const box = new THREE.Box3(); for (const n of PARTS) { geometries[n].computeBoundingBox(); box.union(geometries[n].boundingBox); }
  const size = box.getSize(new THREE.Vector3()), built = new THREE.Box3();
  const m = createMonk(); m.update(1 / 30, 0, "bind", 0); m.group.updateMatrixWorld(true);
  for (const n of PARTS) { const mesh = m.parts[n], v = new THREE.Vector3(); for (let i = 0; i < mesh.geometry.attributes.position.count; i++) built.expandByPoint(skinnedWorld(mesh, i, v)); }
  assert.ok(Math.abs(size.y - 1.18) < 0.005, `${size.y.toFixed(3)} m tall`);
  assert.ok(Math.abs(box.min.y) < 0.003, `his soles are ${box.min.y.toFixed(3)} m from y = 0`);
  assert.ok(Math.abs(box.min.x + box.max.x) < 0.01 && Math.abs(box.min.z + box.max.z) < 0.04, "centred on the axis he turns about");
  const bs = built.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - bs.x) < 0.06 && Math.abs(size.z - bs.z) < 0.06, `${size.x.toFixed(3)} × ${size.z.toFixed(3)} m beside ${bs.x.toFixed(3)} × ${bs.z.toFixed(3)} for the one built in code`);
});

test("the four parts are skinned to the skeleton, every weight whole, and he wears them", () => {
  const m = dressed(createMonk), bones = m.skeleton.bones.length;
  assert.equal(m.dressed, true);
  for (const n of PARTS) {
    const mesh = m.parts[n]; assert.ok(mesh.isSkinnedMesh && mesh.skeleton === m.skeleton, n);
    assert.ok(mesh.geometry.index.count / 3 > 500, `${n} has faces`);
    const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < si.count; i++) {
      let sum = 0; for (let k = 0; k < 4; k++) { sum += sw.getComponent(i, k); assert.ok(si.getComponent(i, k) < bones, `${n} vertex ${i} names a bone that is not there`); }
      assert.ok(Math.abs(sum - 1) < 1e-4, `${n} weights at vertex ${i} sum to ${sum}`);
    }
  }
  assert.ok(m.parts.straps.visible, "the hat's straps stay, now that the robe that carried them is gone");
  const tris = PARTS.reduce((s, n) => s + m.parts[n].geometry.index.count / 3, 0); assert.ok(tris > 15000 && tris < 30000, `${tris} triangles`);
});

test("the robe is weighted where it hangs, as the one built in code is: the chest above, the hem on the skirt's bones", () => {
  const m = dressed(createMonk), g = m.parts.robe.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = m.skeleton.bones.map((b) => b.name);
  const share = (i, is) => { let w = 0; for (let k = 0; k < 4; k++) if (is(names[si.getComponent(i, k)])) w += sw.getComponent(i, k); return w; };
  let chest = 0, hem = 0, n1 = 0, n2 = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    if (y > 0.78 && y < 0.84 && Math.abs(x) < 0.04) { n1++; chest += share(i, (n) => n === "chest" || n === "spine"); }
    if (y < 0.3) { n2++; hem += share(i, (n) => n.startsWith("robe")); }
  }
  assert.ok(n1 > 10 && chest / n1 > 0.9, `the robe over the chest follows the chest (${(chest / n1).toFixed(2)} of ${n1} vertices)`);
  assert.ok(n2 > 50 && hem / n2 > 0.9, `the hem hangs from the skirt bones (${(hem / n2).toFixed(2)} of ${n2} vertices)`);
});

test("his forearms and hands go with his arms, his head with his head, his shoes with his feet", () => {
  const m = dressed(createMonk), names = m.skeleton.bones.map((b) => b.name), mean = (part, test) => {
    const g = m.parts[part].geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight; let w = 0, n = 0;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); if (!test(x, y)) continue; n++; for (let k = 0; k < 4; k++) if (/Arm|Hand/.test(names[si.getComponent(i, k)]) || names[si.getComponent(i, k)] === "head" || /Foot/.test(names[si.getComponent(i, k)])) w += sw.getComponent(i, k) * (names[si.getComponent(i, k)] === "head" ? 1 : 1); }
    return { n, w: w / Math.max(n, 1) };
  };
  const hands = mean("skin", (x, y) => Math.abs(x) > 0.3 && y < 0.6), head = mean("skin", (x, y) => y > 1.0), shoes = mean("shoes", () => true);
  assert.ok(hands.n > 20 && hands.w > 0.95, `hands: ${hands.n} vertices, ${hands.w.toFixed(2)} on the arm`);
  assert.ok(head.n > 100 && head.w > 0.95, `head: ${head.n} vertices, ${head.w.toFixed(2)} on the head`);
  assert.ok(shoes.n > 100 && shoes.w > 0.95, `shoes: ${shoes.n} vertices, ${shoes.w.toFixed(2)} on the feet`);
  // a shoe never takes the other foot's weights
  const g = m.parts.shoes.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  for (let i = 0; i < p.count; i++) for (let k = 0; k < 4; k++) { const n = names[si.getComponent(i, k)]; if (sw.getComponent(i, k) > 0.01 && /Foot/.test(n)) assert.equal(n.startsWith("left"), p.getX(i) > 0, `a ${p.getX(i) > 0 ? "left" : "right"} shoe takes the ${n} weight`); }
});

test("walking: a sole is always on the floor, through the whole stride", () => {
  const m = dressed(createMonk), shoes = m.parts.shoes, n = shoes.geometry.attributes.position.count; let planted = 0, frames = 0;
  for (let i = 0; i < 120; i++) {
    m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); m.group.updateMatrixWorld(true);
    if (i < 30) continue; frames++;
    let low = Infinity; for (let k = 0; k < n; k += 3) low = Math.min(low, skinnedWorld(shoes, k).y);
    if (Math.abs(low) < 0.015) planted++;
  }
  assert.ok(planted / frames > 0.95, `a sole should be on the floor (${planted} of ${frames} frames)`);
});

test("the robe covers the trousers above its hem, standing and through a walking stride", () => {
  const m = dressed(createMonk), { robe, legs } = m.parts, v = new THREE.Vector3(), ray = new THREE.Raycaster();
  const pos = new Float32Array(robe.geometry.attributes.position.count * 3), baked = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  baked.geometry.setIndex(robe.geometry.index); baked.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const through = () => {
    m.group.updateMatrixWorld(true);
    for (let i = 0; i < robe.geometry.attributes.position.count; i++) { robe.getVertexPosition(i, v).applyMatrix4(robe.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }
    baked.geometry.attributes.position.needsUpdate = true; baked.geometry.computeBoundingSphere(); baked.geometry.computeBoundingBox();
    // Rays go out from the leg's own axis, not his middle: between his legs the robe has an inner face of its own, which a
    // ray from the middle meets first.
    const axis = [m.bones.leftUpperLeg, m.bones.rightUpperLeg].map((b) => b.getWorldPosition(new THREE.Vector3())); let worst = 0;
    for (let i = 0; i < legs.geometry.attributes.position.count; i++) {   // every vertex: the worst few decide it, and a sample would miss them
      legs.getVertexPosition(i, v).applyMatrix4(legs.matrixWorld); if (v.y < 0.3) continue;
      const a = axis[v.x > 0 ? 0 : 1], o = new THREE.Vector3(a.x, v.y, a.z), d = v.clone().sub(o), len = d.length(); if (len < 0.01) continue;
      ray.set(o, d.normalize()); const hit = ray.intersectObject(baked)[0]; if (hit && hit.distance < len) worst = Math.max(worst, len - hit.distance);
    }
    return worst;
  };
  // The model as it was made has its baggy trousers push out through the robe's side a few centimetres (left thigh, just
  // above the hem); that much shows in the bind pose. Moving must not show more than that by a centimetre (the strictest the built figure passes is 2 mm over nothing; this one starts from a bulge the model has).
  m.update(1 / 30, 0, "bind", 0); const base = through(), seen = [];
  for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {});
  assert.ok(through() < base + 0.01, `standing, the trousers show ${(through() * 1000).toFixed(1)} mm through the robe (${(base * 1000).toFixed(1)} in the bind pose)`);
  for (let i = 0; i < 60; i++) { m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); if (i >= 44 && i % 2 === 0) { const w = through(); seen.push(+(w * 1000).toFixed(1)); assert.ok(w < base + 0.01, `walking (frame ${i}), the trousers show ${(w * 1000).toFixed(1)} mm through the robe (${(base * 1000).toFixed(1)} in the bind pose)`); } }
  assert.ok(Math.max(...seen) < 50, `walking, at worst ${Math.max(...seen)} mm of trousers show through the robe`);
});

test("a body that is not made for this skeleton is refused, and he stays as he was", () => {
  const m = createMonk(), bad = { ...geometries, shoes: new THREE.BufferGeometry() };
  assert.throws(() => m.dress(bad, new THREE.MeshStandardMaterial()), /not skinned/);
});

// Issue #80: where the texture has a seam, or one part of him meets another, two or three copies of a vertex lie at one
// point. If they take different weights they part when the bones move, and the cloth opens at the cuffs, the wrists and
// the hem. Every copy of one point must take the same weights, and copies that start together must stay together.
const coincident = () => {
  const offs = {}, P = []; let n = 0;
  for (const p of PARTS) { offs[p] = n; const a = geometries[p].attributes.position.array; for (let i = 0; i < a.length; i++) P.push(a[i]); n += a.length / 3; }
  const cell = new Map(), groups = new Map(), EPS = 1e-5;
  for (let i = 0; i < n; i++) {
    const c = [0, 1, 2].map((k) => Math.round(P[i * 3 + k] / EPS)); let home = -1;
    for (let dx = -1; dx <= 1 && home < 0; dx++) for (let dy = -1; dy <= 1 && home < 0; dy++) for (let dz = -1; dz <= 1 && home < 0; dz++)
      for (const j of cell.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) || []) if (Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]) < EPS) { home = j; break; }
    const k = c.join(","); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(i);
    if (home >= 0) { const g = groups.get(home) || [home]; g.push(i); groups.set(home, g); groups.set(i, g); }
  }
  const at = (i) => { const p = PARTS.findLast((q) => offs[q] <= i); return [p, i - offs[p]]; };
  return { groups: [...new Set(groups.values())].map((g) => g.map(at)), offs };
};

test("every copy of one point takes the same weights, across a seam and where one part meets another", () => {
  const { groups } = coincident(); let bad = 0, worst = 0, where = null;
  const dense = ([p, i]) => { const g = geometries[p].attributes, m = new Map(); for (let k = 0; k < 4; k++) { const w = g.skinWeight.getComponent(i, k); if (w > 0) m.set(g.skinIndex.getComponent(i, k), (m.get(g.skinIndex.getComponent(i, k)) || 0) + w); } return m; };
  for (const g of groups) {
    const a = dense(g[0]);
    for (const c of g.slice(1)) {
      const b = dense(c); let d = 0; for (const k of new Set([...a.keys(), ...b.keys()])) d = Math.max(d, Math.abs((a.get(k) || 0) - (b.get(k) || 0)));
      if (d > 1e-6) { bad++; if (d > worst) { worst = d; where = `${g[0][0]} ${g[0][1]} / ${c[0]} ${c[1]}`; } }
    }
  }
  assert.ok(groups.length > 1000, `${groups.length} points with more than one copy`);
  assert.equal(bad, 0, `${bad} copies take other weights than the first copy of their point (worst ${worst.toFixed(3)}, ${where})`);
});

test("copies that start at one point stay within a millimetre standing, through a whole stride and up a flight", () => {
  const { groups } = coincident(), v = new THREE.Vector3(), a = new THREE.Vector3();
  const look = (m, what) => {
    m.group.updateMatrixWorld(true); let worst = 0, n = 0;
    for (const g of groups) {
      m.parts[g[0][0]].getVertexPosition(g[0][1], a).applyMatrix4(m.parts[g[0][0]].matrixWorld); let s = 0;
      for (const [p, i] of g.slice(1)) s = Math.max(s, m.parts[p].getVertexPosition(i, v).applyMatrix4(m.parts[p].matrixWorld).distanceTo(a));
      worst = Math.max(worst, s); if (s > 0.001) n++;
    }
    assert.ok(worst <= 0.001, `${what}: ${n} points come apart, at worst ${(worst * 1000).toFixed(1)} mm`);
  };
  const m = dressed(createMonk);
  for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {});
  look(m, "standing");
  // one whole stride: the gait settles in the first second, and the next three hold more than one step of each foot
  const w = dressed(createMonk);
  for (let i = 0; i < 120; i++) { w.update(1 / 30, 2.1, false, i / 30, () => 0, {}); if (i >= 30 && i % 3 === 0) look(w, `walking, frame ${i}`); }
  // up a flight of 15 cm risers and 30 cm treads, as the stairs of the courts are
  const c = dressed(createMonk), step = (z) => Math.max(0, Math.floor(-z / 0.3)) * 0.15, ramp = (z) => Math.max(0, -z) * 0.5;
  for (let i = 0; i < 90; i++) {
    const z = -i / 30 * 1.2; c.group.position.set(0, ramp(z), z);
    c.update(1 / 30, 1.2, false, i / 30, (x, zz) => step(zz), { heightAt: (x, zz) => ramp(zz), stairs: true });
    if (i >= 30 && i % 3 === 0) look(c, `climbing, frame ${i}`);
  }
});
