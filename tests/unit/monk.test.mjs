// The novice stands on a humanoid skeleton, bound in the A-pose he was drawn in: skin and cloth are skinned to it, the
// legs reach for the floor, the arms reach to pray, and what hangs off him swings.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../../app/src/monk.js");
const { STOOL, CUSHION, radiusAt } = await import("../../app/src/geo.js");
const HUMANOID = ["hips", "spine", "chest", "neck", "head", ...["left", "right"].flatMap((s) => ["Shoulder", "UpperArm", "LowerArm", "Hand", "UpperLeg", "LowerLeg", "Foot"].map((b) => s + b))];
const world = (o) => o.getWorldPosition(new THREE.Vector3());
const skinnedWorld = (mesh, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);

test("he has a humanoid skeleton under a root bone, with bones for what hangs off him", () => {
  const m = createMonk(), B = m.bones;
  for (const n of [...HUMANOID, "root", "robeFront", "robeBack", "robeLeft", "robeRight", "sashTail", "hat"]) assert.ok(B[n]?.isBone, n);
  assert.equal(m.group.children[0], B.root, "the root bone carries his height above the step");
  for (const [c, p] of [["hips", "root"], ["spine", "hips"], ["chest", "spine"], ["neck", "chest"], ["head", "neck"], ["leftShoulder", "chest"], ["leftUpperArm", "leftShoulder"], ["leftLowerArm", "leftUpperArm"],
    ["leftHand", "leftLowerArm"], ["rightHand", "rightLowerArm"], ["leftUpperLeg", "hips"], ["leftLowerLeg", "leftUpperLeg"], ["leftFoot", "leftLowerLeg"], ["hat", "chest"]]) assert.equal(B[c].parent, B[p], `${c} should hang from ${p}`);
  assert.equal(m.skeleton.boneInverses.length, m.skeleton.bones.length, "the bind pose should be recorded");
  m.group.updateMatrixWorld(true);
  assert.ok(world(B.leftHand).x > 0.2 && world(B.rightHand).x < -0.2, "facing +z, his left hand is on +x");
});

test("he is bound in an A-pose: arms 30–45° from his sides, legs straight down", () => {
  const m = createMonk(); m.group.updateMatrixWorld(true);
  for (const s of ["left", "right"]) {
    const d = world(m.bones[s + "Hand"]).sub(world(m.bones[s + "UpperArm"])).normalize(), deg = THREE.MathUtils.radToDeg(Math.acos(-d.y));
    assert.ok(deg > 30 && deg < 45, `${s} arm bound at ${deg.toFixed(1)}°`);
    assert.ok(world(m.bones[s + "Foot"]).sub(world(m.bones[s + "UpperLeg"])).normalize().y < -0.999, `${s} leg should be bound straight`);
  }
  // and the "bind" pose returns him to it from anything
  for (let i = 0; i < 30; i++) m.update(1 / 30, 2.1, "pray", i / 30, () => 0);
  m.update(1 / 30, 0, "bind", 1); m.group.updateMatrixWorld(true);
  const d = world(m.bones.leftHand).sub(world(m.bones.leftUpperArm)).normalize();
  assert.ok(Math.abs(THREE.MathUtils.radToDeg(Math.acos(-d.y)) - 37.8) < 0.5, "bind should restore the A-pose");
});

test("skin and cloth are skinned to the skeleton, the weights whole; nothing else hangs loose", () => {
  const m = createMonk(); let loose = 0, skinned = 0;
  m.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh) {
      skinned++; assert.equal(o.skeleton, m.skeleton);
      const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
      for (let i = 0; i < si.count; i++) {
        let sum = 0; for (let k = 0; k < 4; k++) { sum += sw.getComponent(i, k); assert.ok(si.getComponent(i, k) < m.skeleton.bones.length); }
        assert.ok(Math.abs(sum - 1) < 1e-4, `weights at vertex ${i} sum to ${sum}`);
      }
      return;
    }
    let p = o.parent, on = false; while (p) { if (p.isBone) on = true; p = p.parent; } if (!on) loose++;
  });
  assert.ok(skinned >= 4, "skin, robe, trousers and shoes should be skinned meshes");
  assert.ok(loose <= 2, `${loose} parts hang from no bone (only his shadow may)`);
});

test("the robe is weighted where it hangs: the chest above, the hem on the skirt's own bones", () => {
  const m = createMonk(), g = m.parts.robe.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = m.skeleton.bones.map((b) => b.name);
  const share = (i, is) => { let w = 0; for (let k = 0; k < 4; k++) if (is(names[si.getComponent(i, k)])) w += sw.getComponent(i, k); return w; };
  let chest = 0, hem = 0, n1 = 0, n2 = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    if (y > 0.78 && y < 0.84 && Math.abs(x) < 0.04) { n1++; chest += share(i, (n) => n === "chest"); }
    if (y < 0.3) { n2++; hem += share(i, (n) => n.startsWith("robe")); }
  }
  assert.ok(n1 > 10 && chest / n1 > 0.95, "the robe over the chest should follow the chest");
  assert.ok(n2 > 50 && hem / n2 > 0.99, "the hem should hang from the skirt bones");
});

test("walking: a sole is always on the floor, each foot steps through, the knees fold the right way", () => {
  const m = createMonk(), shoes = m.parts.shoes, n = shoes.geometry.attributes.position.count, zs = [[], []];
  let planted = 0, frames = 0, minKnee = Infinity, maxKnee = -Infinity;
  for (let i = 0; i < 120; i++) {
    m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); m.group.updateMatrixWorld(true);
    if (i < 30) continue;
    frames++;
    let low = Infinity; for (let k = 0; k < n; k += 5) low = Math.min(low, skinnedWorld(shoes, k).y);
    if (Math.abs(low) < 0.01) planted++;
    zs[0].push(world(m.bones.leftFoot).z); zs[1].push(world(m.bones.rightFoot).z);
    for (const s of ["left", "right"]) { const k = m.bones[s + "LowerLeg"].rotation.x; minKnee = Math.min(minKnee, k); maxKnee = Math.max(maxKnee, k); }
  }
  assert.ok(planted / frames > 0.95, `a sole should be on the floor (${planted} of ${frames} frames)`);
  for (const z of zs) assert.ok(Math.max(...z) - Math.min(...z) > 0.2, "each foot should step forward and back");
  assert.ok(minKnee >= -1e-3 && maxKnee > 0.3, `the knees fold only one way (${minKnee.toFixed(2)}…${maxKnee.toFixed(2)})`);
});

test("to pray he brings his palms together before his chest", () => {
  const m = createMonk(); for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {});
  m.group.updateMatrixWorld(true);
  const l = world(m.bones.leftHand), r = world(m.bones.rightHand), chest = world(m.bones.chest);
  assert.ok(l.distanceTo(r) < 0.04, `the hands should meet (${l.distanceTo(r).toFixed(3)} m apart)`);
  assert.ok(l.z > chest.z + 0.12 && Math.abs(l.y - chest.y) < 0.06, "before his chest");
  const palm = new THREE.Vector3(0, 0, 1).applyQuaternion(m.bones.leftHand.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(palm.x < -0.8, "the left palm should face the right one");
});

// Seated, he is drawn with his origin on the seat's top (yard.js lifts him there), so the floor is `top` below him.
function seated(pose, top, frames = 100) {
  const m = createMonk();
  for (let i = 0; i < frames; i++) m.update(1 / 30, 0, pose, i / 30, () => -top, {});
  m.group.updateMatrixWorld(true); m.skeleton.update();
  return m;
}
const body = (m) => { const out = []; for (const n of ["skin", "robe", "legs", "shoes"]) { const mesh = m.parts[n]; if (!mesh.visible) continue; for (let i = 0; i < mesh.geometry.attributes.position.count; i++) out.push([n, skinnedWorld(mesh, i)]); } return out; };
// How far a point lies inside a turned seat whose top is at y = 0 (the outline is measured up from its own foot).
const into = (outline, top, v) => { const r = radiusAt(outline, v.y + top); return r > 0 ? r - Math.hypot(v.x, v.z) : -1; };
const deg = (a, b) => THREE.MathUtils.radToDeg(a.angleTo(b));
// Nothing of him below the floor, and nothing in the seat but where he rests on its top (a centimetre and a half of it).
function keepsOut(m, outline, top, what) {
  let low = Infinity, deepest = 0, where = null;
  for (const [n, v] of body(m)) { low = Math.min(low, v.y + top); if (v.y < -0.015) { const d = into(outline, top, v); if (d > deepest) { deepest = d; where = `${n} at (${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`; } } }
  assert.ok(low > -0.002, `part of him is ${(-low * 1000).toFixed(0)} mm under the floor`);
  assert.ok(deepest < 0.008, `his ${where} is ${(deepest * 1000).toFixed(0)} mm inside the ${what}`);
}

test("on a stool he sits as on a chair: thighs level, knees bent, feet hanging together, hands on his thighs", () => {
  // A stool is the height a grown man sits at; a child of 1.18 m on it does not reach the floor, and his feet hang.
  const m = seated("chair", 0.44), B = m.bones;
  assert.ok(m.parts.legs.visible && m.parts.shoes.visible, "his legs are seen");
  const feet = [];
  for (const s of ["left", "right"]) {
    const hip = world(B[s + "UpperLeg"]), knee = world(B[s + "LowerLeg"]), ankle = world(B[s + "Foot"]), thigh = knee.clone().sub(hip), shin = ankle.clone().sub(knee);
    assert.ok(hip.y > 0.03 && hip.y < 0.11, `${s} hip ${hip.y.toFixed(3)} m above the seat`);
    assert.ok(thigh.z > 0.18 && Math.abs(THREE.MathUtils.radToDeg(Math.asin(thigh.y / thigh.length()))) < 15, `${s} thigh should lie level and forward (${thigh.toArray().map((v) => v.toFixed(2))})`);
    assert.ok(shin.y < -0.19, `${s} shin should hang down`);
    const k = deg(thigh, shin); assert.ok(k > 75 && k < 105, `${s} knee bent ${k.toFixed(0)}°`);
    const hand = world(B[s + "Hand"]);
    assert.ok(Math.sign(hand.x) === (s === "left" ? 1 : -1) && hand.y > hip.y - 0.01 && hand.y < hip.y + 0.13 && hand.z > 0.05 && hand.z < 0.28, `${s} hand should rest on the thigh (${hand.toArray().map((v) => v.toFixed(2))})`);
    feet.push(ankle);
  }
  assert.ok(Math.abs(feet[0].x - feet[1].x) < 0.22, "his feet hang together");
  keepsOut(m, STOOL, 0.44, "stool");
});

test("on a cushion he sits cross-legged upon it: knees out and low, shins before him, hands in his lap, left over right", () => {
  const m = seated("sit", 0.104), B = m.bones, ankles = [];
  assert.ok(m.parts.legs.visible && m.parts.shoes.visible, "his legs are seen, folded");
  for (const s of ["left", "right"]) {
    const hip = world(B[s + "UpperLeg"]), knee = world(B[s + "LowerLeg"]), ankle = world(B[s + "Foot"]), shin = ankle.clone().sub(knee);
    assert.ok(hip.y > 0.03 && hip.y < 0.11, `${s} hip ${hip.y.toFixed(3)} m above the cushion`);
    assert.ok(knee.y <= hip.y && knee.y > -0.03, `${s} knee should rest low on the cushion (${knee.y.toFixed(3)})`);
    assert.ok(Math.abs(knee.x) > 0.15 && knee.z > 0.05 && Math.hypot(knee.x, knee.z) < 0.3, `${s} knee should be out to the side and forward, on the cushion (${knee.toArray().map((v) => v.toFixed(2))})`);
    assert.ok(Math.abs(shin.y) < 0.06 && ankle.z > 0.02 && Math.abs(ankle.x) < 0.12, `${s} shin should lie folded before him (${ankle.toArray().map((v) => v.toFixed(2))})`);
    ankles.push(ankle);
  }
  assert.ok(Math.abs(ankles[0].z - ankles[1].z) > 0.015, "one shin lies in front of the other");
  const l = world(B.leftHand), r = world(B.rightHand), hips = world(B.hips);
  assert.ok(l.distanceTo(r) < 0.05 && l.y > r.y, `the left hand lies on the right (${l.distanceTo(r).toFixed(3)} m apart)`);
  assert.ok(l.y > hips.y - 0.02 && l.y < hips.y + 0.15 && l.z > hips.z + 0.06, "in his lap, below the navel");
  keepsOut(m, CUSHION, 0.104, "cushion");
});

test("what hangs off him swings: the skirt trails his walk and flares as he turns", () => {
  const m = createMonk();
  for (let i = 0; i < 60; i++) { m.group.rotation.y = i * 0.05; m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); }
  assert.ok(m.bones.robeBack.rotation.x > 0.03, "the skirt should trail behind him");
  assert.ok(Math.abs(m.bones.robeLeft.rotation.z) > 0.02, "and swing out as he turns");
});

test("the robe covers the trousers above its hem, standing and through a walking stride", () => {
  // Rays from his middle out through each point of the trousers: if the robe is met before the point, the trousers
  // show through it. A point no robe lies over is below the hem (a knee as it swings forward), which is allowed.
  const m = createMonk(), { robe, legs } = m.parts, v = new THREE.Vector3(), ray = new THREE.Raycaster();
  const pos = new Float32Array(robe.geometry.attributes.position.count * 3), baked = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  baked.geometry.setIndex(robe.geometry.index); baked.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const through = () => {
    m.group.updateMatrixWorld(true);
    for (let i = 0; i < robe.geometry.attributes.position.count; i++) { robe.getVertexPosition(i, v).applyMatrix4(robe.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }
    baked.geometry.attributes.position.needsUpdate = true; baked.geometry.computeBoundingSphere(); baked.geometry.computeBoundingBox();
    const hips = m.bones.hips.getWorldPosition(new THREE.Vector3()); let worst = 0;
    for (let i = 0; i < legs.geometry.attributes.position.count; i += 3) {
      legs.getVertexPosition(i, v).applyMatrix4(legs.matrixWorld); if (v.y < 0.3) continue;
      const o = new THREE.Vector3(hips.x, v.y, hips.z), d = v.clone().sub(o), len = d.length(); if (len < 0.01) continue;
      ray.set(o, d.normalize()); const hit = ray.intersectObject(baked)[0]; if (hit && hit.distance < len) worst = Math.max(worst, len - hit.distance);
    }
    return worst;
  };
  for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {});
  assert.ok(through() < 0.002, "standing, the trousers show through the robe");
  for (let i = 0; i < 60; i++) { m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); if (i >= 44 && i % 2 === 0) { const w = through(); assert.ok(w < 0.002, `walking (frame ${i}), the trousers show ${(w * 1000).toFixed(1)} mm through the robe`); } }
});

test("at the side edge of a stair, where the ground under one shoe is metres lower, his body stays on the treads (it once sank 2 m into them and he vanished: cam 2.1,-66.63)", () => {
  const m = createMonk(), top = 4.68, low = 2.4;
  m.group.position.set(0, top, 0);
  // the flight under x < 0, the paving beside its cheek, 2.3 m lower, under x >= 0: his feet straddle the edge
  const surface = (x) => (x < 0 ? top : low);
  for (let i = 0; i < 60; i++) m.update(1 / 20, 0, false, i / 20, surface, { heightAt: () => top, stairs: true });
  m.group.updateMatrixWorld(true);
  let lo = Infinity, hi = -Infinity;
  m.group.traverse((o) => { if (!o.isSkinnedMesh) return; for (let i = 0; i < o.geometry.attributes.position.count; i += 5) { const y = skinnedWorld(o, i).y; lo = Math.min(lo, y); hi = Math.max(hi, y); } });
  assert.ok(lo > top - 0.45, `his lowest point is ${(top - lo).toFixed(2)} m under the treads`);
  assert.ok(hi > top + 0.8, `his head is only ${(hi - top).toFixed(2)} m over the treads`);
});
