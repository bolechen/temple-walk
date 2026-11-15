// The novice stands on a humanoid skeleton, bound in the A-pose he was drawn in: skin and cloth are skinned to it, the
// legs reach for the floor, the arms reach to pray, and what hangs off him swings.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "../../app/vendor/three/build/three.module.js";
const { createMonk } = await import("../../app/src/monk.js");
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
  assert.ok(loose <= 2, `${loose} parts hang from no bone (only his shadow and his seated lap may)`);
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

test("to pray he brings his palms together before his chest; seated, his legs fold away", () => {
  const m = createMonk(); for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {});
  m.group.updateMatrixWorld(true);
  const l = world(m.bones.leftHand), r = world(m.bones.rightHand), chest = world(m.bones.chest);
  assert.ok(l.distanceTo(r) < 0.04, `the hands should meet (${l.distanceTo(r).toFixed(3)} m apart)`);
  assert.ok(l.z > chest.z + 0.12 && Math.abs(l.y - chest.y) < 0.06, "before his chest");
  const palm = new THREE.Vector3(0, 0, 1).applyQuaternion(m.bones.leftHand.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(palm.x < -0.8, "the left palm should face the right one");
  const s = createMonk(); for (let i = 0; i < 100; i++) s.update(1 / 30, 0, "sit", i / 30, () => 0);
  assert.ok(!s.parts.legs.visible && !s.parts.shoes.visible, "seated, the legs are folded under the robe");
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
