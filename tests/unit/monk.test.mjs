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
  assert.ok(Math.abs(m.bones.robeFront.rotation.z) > 0.02, "and swing out as he turns (the side panels, over the thighs, hardly: #284)");
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
  assert.ok(lo > top - 0.4, `his lowest point is ${(top - lo).toFixed(2)} m under the treads`);
  assert.ok(hi > top + 1.05, `his head is only ${(hi - top).toFixed(2)} m over the treads`);
});

test("each shoe that comes down says how late in the frame it did, so its sound keeps time on a slow frame", () => {
  for (const dt of [1 / 60, 1 / 20, 1 / 8]) {
    const m = createMonk(), got = [];
    for (let i = 0; i < Math.round(6 / dt); i++) { m.update(dt, 2.1, false, i * dt, () => 0, {}); got.push(...m.steps.splice(0)); }
    assert.ok(got.length >= 8, `at ${Math.round(1 / dt)} frames a second only ${got.length} steps in six seconds`);
    for (const s of got) assert.ok(s.late >= 0 && s.late <= dt + 1e-9, `a step ${s.late} s late in a frame of ${dt} s`);
    if (dt > 0.1) assert.ok(got.some((s) => s.late > dt * 0.2), "on slow frames some steps should come down well inside the frame");
  }
});

// Standing up: his body rises off the seat over a second, and his shoes must find the floor all the way, not hang
// through it while the seated legs let go. The group is moved as yard.js moves it: on the seat's top while seated,
// on the floor the moment he is sent away, and he walks off.
for (const [pose, top] of [["chair", 0.44], ["sit", 0.1]]) {
  test(`getting up from ${pose === "chair" ? "a stool" : "a cushion"}, his shoes never go under the floor`, () => {
    const m = createMonk(), shoes = m.parts.shoes, n = shoes.geometry.attributes.position.count, floor = () => 0;
    m.group.position.set(0, top, 0);
    for (let i = 0; i < 90; i++) m.update(1 / 30, 0, pose, i / 30, floor, { heightAt: floor });
    m.group.position.set(0, 0, 0);
    let worst = Infinity, at = -1;
    for (let i = 0; i < 60; i++) {
      m.group.position.z += 1.5 / 30;
      m.update(1 / 30, i < 3 ? 0 : 1.5, false, 3 + i / 30, floor, { heightAt: floor });
      m.group.updateMatrixWorld(true); m.skeleton.update();
      let low = Infinity; for (let k = 0; k < n; k += 3) low = Math.min(low, skinnedWorld(shoes, k).y);
      if (low < worst) { worst = low; at = i; }
    }
    assert.ok(worst > -0.02, `${(-worst * 100).toFixed(1)} cm of his shoe went under the floor, ${at} frames after he got up`);
  });
}

// At the tea table (site.js: top 0.78 m high and 5 cm thick, its near edge 0.39 m before him, a rail 0.06 m deep under
// that edge 0.43 m before him), on a stool 0.44 m high: his knees go under the table and touch neither top nor rail.
test("at the tea table his knees go under the top and clear the rail beneath its edge", () => {
  const m = seated("chair", 0.44), seatTop = 0.44, T = 0.78;
  const boxes = [["top", [-0.65, 0.65], [T - 0.05 - seatTop, T - seatTop], [0.39, 1.09]], ["rail", [-0.6, 0.6], [T - 0.12 - seatTop, T - 0.06 - seatTop], [0.41, 0.45]]];
  for (const [name, [x0, x1], [y0, y1], [z0, z1]] of boxes) {
    let worst = -Infinity, where = null;
    for (const [n, v] of body(m)) { const d = Math.min(v.x - x0, x1 - v.x, v.y - y0, y1 - v.y, v.z - z0, z1 - v.z); if (d > worst) { worst = d; where = `${n} at (${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`; } }
    assert.ok(worst < 0.005, `his ${where} is ${(worst * 1000).toFixed(0)} mm inside the table's ${name}`);
  }
});

// #144: the four cushions on the tea house porch lie 1.12 m out from the middle of each table, so the table's end is 0.37 m
// before his knees; its top is 0.31–0.37 m over the porch and its legs stand 0.5 m out, 0.07 m thick.
test("on a tea house cushion his knees go under the end of the table and clear its legs", () => {
  const m = seated("sit", 0.104), cushion = 0.104;
  const boxes = [["top", [-0.26, 0.26], [0.31 - cushion, 0.37 - cushion], [0.37, 1.87]], ["leg", [-0.22, 0.22], [-cushion, 0.31 - cushion], [0.465, 0.535]]];
  for (const [name, [x0, x1], [y0, y1], [z0, z1]] of boxes) {
    let worst = -Infinity, where = null;
    for (const [n, v] of body(m)) { const d = Math.min(v.x - x0, x1 - v.x, v.y - y0, y1 - v.y, v.z - z0, z1 - v.z); if (d > worst) { worst = d; where = `${n} at (${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`; } }
    assert.ok(worst < 0.005, `his ${where} is ${(worst * 1000).toFixed(0)} mm inside the table's ${name}`);
  }
});

// From a stool to a cushion, as the game sends him (sitDown walks him over, so he stands between the two): he gets up,
// takes a few steps, and folds onto the cushion; nothing of him goes under the floor on the way.
test("from a stool, a few steps, and onto a cushion: nothing of him goes under the floor", () => {
  const m = createMonk(), floor = () => 0; let worst = Infinity, when = "";
  const look = (what) => { m.group.updateMatrixWorld(true); m.skeleton.update(); for (const [, v] of body(m)) if (v.y < worst) { worst = v.y; when = what; } };
  m.group.position.set(0, 0.44, 0);
  for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "chair", i / 30, floor, { heightAt: floor });
  m.group.position.set(0, 0, 0);
  for (let i = 0; i < 30; i++) { m.group.position.z += 1.2 / 30; m.update(1 / 30, i < 3 ? 0 : 1.2, false, 3 + i / 30, floor, { heightAt: floor }); look("walking over"); }
  for (let i = 0; i < 12; i++) { m.group.position.y = 0.1 * (i + 1) / 12; m.update(1 / 30, 0, "sit", 4 + i / 30, floor, { heightAt: floor }); look("sitting down"); }
  for (let i = 0; i < 60; i++) { m.update(1 / 30, 0, "sit", 4.4 + i / 30, floor, { heightAt: floor }); look("settling"); }
  assert.ok(worst > -0.02, `${(-worst * 100).toFixed(1)} cm of him went under the floor while ${when}`);
});

// #141: the patch is a child of him, and he is lifted as a whole when he jumps; it must stay on the ground below.
test("his shadow stays on the ground when he is in the air, fainter and a little wider, and is as before when he stands", () => {
  const m = createMonk(); m.setSun(new THREE.Vector3(0.3, 0.9, 0.2), 1);
  const base = () => { m.group.updateMatrixWorld(true); return { y: m.shadow.getWorldPosition(new THREE.Vector3()).y, op: m.shadow.material.opacity, w: m.shadow.scale.x }; };
  const floor = 1.2;
  m.group.position.y = floor; m.update(1 / 30, 0, false, 0, () => floor);
  const stand = base();
  assert.ok(Math.abs(stand.y - (floor + 0.03)) < 0.002, "standing, the patch lies 3 cm over the floor");
  let prev = stand;
  for (const h of [0.1, 0.25, 0.46]) {
    m.group.position.y = floor + h; m.update(1 / 30, 0, "hop", 0, () => floor);
    const s = base();
    assert.ok(Math.abs(s.y - (floor + 0.03)) < 0.02, `at ${h} m up the patch is at ${(s.y - floor).toFixed(3)} above the floor`);
    assert.ok(s.op < prev.op && s.w > prev.w, "the higher, the fainter and wider");
    prev = s;
  }
  assert.ok(Math.abs(prev.op / stand.op - 0.6) < 0.05 && Math.abs(prev.w - 1.2) < 0.03, "at the top: about six tenths as dark, a fifth wider");
  // down from a porch: the ground under him is a level lower, and the patch goes there
  m.group.position.y = floor + 0.2; m.update(1 / 30, 0, "hop", 0, () => floor - 0.9);
  assert.ok(Math.abs(base().y - (floor - 0.9 + 0.03)) < 0.02, "over the lower level the patch is on it");
  // landed: as before
  m.group.position.y = floor; m.update(1 / 30, 0, false, 0, () => floor);
  const back = base(); assert.ok(Math.abs(back.y - stand.y) < 1e-6 && Math.abs(back.op - stand.op) < 1e-6 && Math.abs(back.w - 1) < 1e-6, "landed, the same as standing");
  // seated, on a seat above the floor, it is as it was
  m.group.position.y = floor + 0.4; m.update(1 / 30, 0, "chair", 0, () => floor); for (let i = 0; i < 40; i++) m.update(1 / 30, 0, "chair", 0, () => floor);
  assert.ok(Math.abs(base().y - (floor + 0.4 + 0.03)) < 0.01, "seated, the patch goes with him as before");
});

// The sill-bench of the path's pavilions (#479): he sits on its board facing in, his back to the balustrade on its outer edge.
test("on a pavilion's sill-bench he sits clear of its board and its rail, his feet hanging over the front edge", async () => {
  const { BENCH } = await import("../../app/src/building.js");
  const m = seated("chair", BENCH.top), H = BENCH.depth, rc = -BENCH.back - (H / 2 - 0.03);   // the rail's centre, in his frame (z forward, the board's middle BENCH.back behind him)
  let low = Infinity, boardIn = 0, railIn = 0, lipIn = 0, where = "";
  for (const [n, v] of body(m)) {
    low = Math.min(low, v.y + BENCH.top);
    const onBoard = Math.abs(v.z + BENCH.back) < H / 2;
    if (onBoard && v.y < -0.015) boardIn = Math.max(boardIn, -v.y - 0.015);
    if (Math.abs(v.z - rc) < 0.025 + 0.004 && v.y > BENCH.rail - 0.05 && v.y < BENCH.rail) { railIn = Math.max(railIn, 1); where = `${n} at ${v.toArray().map((q) => q.toFixed(3))}`; }
    if (Math.abs(v.z - rc) < 0.035 && v.y > 0.1 && v.y < 0.16) { lipIn = Math.max(lipIn, 1); where ||= `${n} lip at ${v.toArray().map((q) => q.toFixed(3))}`; }
  }
  assert.ok(boardIn < 0.008, `part of him is ${(boardIn * 1000).toFixed(0)} mm into the board`);
  assert.ok(!railIn && !lipIn, `part of him is in the balustrade: ${where}`);
  const feet = ["left", "right"].map((s) => world(m.bones[s + "Foot"]));
  for (const f of feet) assert.ok(f.z > H / 2 - BENCH.back - 0.02, `a foot at z ${f.z.toFixed(2)} is under the board`);
});
