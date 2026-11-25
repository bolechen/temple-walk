// The novice stands on a humanoid skeleton, bound in the A-pose he was drawn in: skin and cloth are skinned to it, the
// legs reach for the floor, the arms reach to pray, and what hangs off him swings.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { createMonk, THUMB } = await import("../../app/src/monk.js");
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
      // A morph moves each point by its number, and three.js does not check the counts: one that differs reads the wrong
      // points and pulls the skin into spikes (#664: a thumb laid in two pieces in the lap and one standing).
      for (const [k, list] of Object.entries(o.geometry.morphAttributes || {})) for (const a of list) assert.equal(a.count, o.geometry.attributes[k].count, `${k} morph of a ${o.name || "part"} has as many points as the part`);
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
  // Left over right is said of the palms, not the wrists: the wrists lie out at the sides of the lap, as wide apart as
  // the drawing has them, and each palm reaches in over the middle, the left one above the right (#664).
  const palm = (s) => world(B[s + "Hand"]).add(new THREE.Vector3(0, -0.045, 0).applyQuaternion(B[s + "Hand"].getWorldQuaternion(new THREE.Quaternion())));
  const pl = palm("left"), pr = palm("right");
  assert.ok(Math.hypot(pl.x - pr.x, pl.z - pr.z) < 0.04 && pl.y > pr.y + 0.01, `the left palm lies on the right (${Math.hypot(pl.x - pr.x, pl.z - pr.z).toFixed(3)} m apart across, ${(pl.y - pr.y).toFixed(3)} m above)`);
  assert.ok(l.x - r.x > 0.06 && l.x - r.x < 0.14, `the wrists lie apart at the sides of the lap (${(l.x - r.x).toFixed(3)} m)`);
  assert.ok(l.y > hips.y - 0.02 && l.y < hips.y + 0.15 && l.z > hips.z + 0.06, "in his lap, below the navel");
  keepsOut(m, CUSHION, 0.104, "cushion");
  // Seated drape (#664): hands rest above the lap cloth, front and back hems settle onto the cushion, no trouser knees poke through.
  const robeMesh = m.parts.robe, rc = robeMesh.geometry.attributes.position.count;
  let lapMaxY = -Infinity, frontHemMinY = Infinity, backHemMinY = Infinity;
  for (let i = 0; i < rc; i++) {
    const v = skinnedWorld(robeMesh, i);
    if (Math.abs(v.x) < 0.05 && v.z > 0.155 && v.z < 0.22 && v.y < hips.y + 0.1) lapMaxY = Math.max(lapMaxY, v.y);
    if (v.z > 0.18) frontHemMinY = Math.min(frontHemMinY, v.y);
    if (v.z < -0.14) backHemMinY = Math.min(backHemMinY, v.y);
  }
  assert.ok(lapMaxY < r.y + 0.005, `lap cloth (${lapMaxY.toFixed(3)}) must stay beneath his hands (${r.y.toFixed(3)})`);
  assert.ok(frontHemMinY < 0.03, `front hem (${frontHemMinY.toFixed(3)}) must drape down to the cushion`);
  assert.ok(backHemMinY < 0.03, `back hem (${backHemMinY.toFixed(3)}) must rest on the cushion`);
});

test("on a cushion the robe is laid as the drawing has it, and the hands rest on it in the meditation seal", () => {
  // refs/monk-poses-v6-2026-11-23-sitting.webp (#664): from the front a wide, low shape, widest at the knees, the cloth
  // running down to them from under the arms without bulging out first (a bell is what it was); the hands lie on the lap
  // forward of his belly, nothing of hands or forearms under the cloth; the thumbs meet over the fingers in an open oval.
  const m = seated("sit", 0.104), B = m.bones, robe = m.parts.robe, skin = m.parts.skin, torso = [], names = m.skeleton.bones.map((b) => b.name);
  // The skirt of the robe, not its sleeves (which hang over the forearms, as they should) nor the sash and its knot above them.
  const si = robe.geometry.attributes.skinIndex, sw = robe.geometry.attributes.skinWeight, BODY = new Set(["hips", "robeFront", "robeBack", "robeLeft", "robeRight"]);
  const ofBody = (i) => { let w = 0; for (let k = 0; k < 4; k++) if (BODY.has(names[si.getComponent(i, k)])) w += sw.getComponent(i, k); return w > 0.5; };
  for (let i = 0; i < robe.geometry.attributes.position.count; i++) { if (!ofBody(i)) continue; const v = skinnedWorld(robe, i); if (v.y < 0.34) torso.push(v); }
  const half = (y0, y1) => Math.max(...torso.filter((v) => v.y >= y0 && v.y < y1).map((v) => Math.abs(v.x)));
  const widths = []; for (let y = 0.02; y < 0.16; y += 0.02) widths.push(half(y, y + 0.02));
  assert.ok(half(-0.04, 0.06) > 0.3, `widest at the knees, out to the cushion's rim (${half(-0.04, 0.06).toFixed(3)} m)`);
  widths.forEach((w, i) => i && assert.ok(w <= widths[i - 1] + 0.004, `narrower going up from the knees, no bulge (${widths.map((x) => x.toFixed(3)).join(" ")})`));
  // Not one smooth bun (the art review, 2026-11-25): each knee lifts the cloth into a swelling of its own, higher than the
  // cloth between the knees and at his sides, and the hem rolls out onto the cushion below a crease at its rim.
  const turn = (v) => Math.abs(Math.atan2(v.x, v.z)), out = (v) => Math.hypot(v.x, v.z);
  const top = (a0, a1) => Math.max(...torso.filter((v) => turn(v) >= a0 && turn(v) < a1 && out(v) > 0.2).map((v) => v.y));
  const kneeTop = top(0.85, 1.05);
  assert.ok(kneeTop > top(0.45, 0.6) + 0.012 && kneeTop > top(1.45, 1.7) + 0.012, `a swelling over each knee (${kneeTop.toFixed(3)} m, between the knees ${top(0.45, 0.6).toFixed(3)}, at his side ${top(1.45, 1.7).toFixed(3)})`);
  for (const [a0, a1, name] of [[0, 0.15, "before him"], [0.85, 1.05, "at the knees"]]) {
    const reach = (y0, y1) => Math.max(...torso.filter((v) => turn(v) >= a0 && turn(v) < a1 && v.y >= y0 && v.y < y1).map(out));
    assert.ok(reach(-0.05, 0) > reach(0.02, 0.04) + 0.015, `${name} the hem rolls out onto the cushion below the crease (${reach(-0.05, 0).toFixed(3)} against ${reach(0.02, 0.04).toFixed(3)} m)`);
  }
  const hips = world(B.hips), belly = Math.max(...torso.filter((v) => Math.abs(v.x) < 0.04 && v.y > hips.y + 0.08 && v.y < hips.y + 0.12).map((v) => v.z));
  for (const s of ["left", "right"]) assert.ok(world(B[s + "Hand"]).z > belly + 0.03, `${s} wrist forward of his belly (${world(B[s + "Hand"]).z.toFixed(3)} against ${belly.toFixed(3)})`);
  // Hands and forearms in front of him stay above the cloth under them, and rest on it within a few centimetres.
  const cloth = torso.filter((v) => v.z > 0.05);
  let under = 0, worst = 0; const lowest = { left: Infinity, right: Infinity };
  for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
    const v = skinnedWorld(skin, i); if (v.z < 0.12 || v.y > 0.25) continue;
    let top = -Infinity; for (const c of cloth) if (Math.abs(c.x - v.x) < 0.008 && Math.abs(c.z - v.z) < 0.008 && c.y < v.y + 0.06) top = Math.max(top, c.y);
    if (!Number.isFinite(top)) continue;
    if (top > v.y + 0.002) { under++; worst = Math.max(worst, top - v.y); }
    if (v.z > 0.17 && Math.abs(v.x) < 0.11) { const s = v.x > 0 ? "left" : "right"; lowest[s] = Math.min(lowest[s], v.y - top); }
  }
  assert.equal(under, 0, `${under} points of his hands and forearms under the lap cloth (by up to ${worst.toFixed(3)} m)`);
  // The right hand, below, lies on the lap; the left lies on the right (the palms' test above), not on the cloth.
  assert.ok(lowest.right < 0.015, `the right hand rests on the lap, not above it (its lowest point ${lowest.right.toFixed(3)} m over the cloth)`);
  // The folded legs stay under it: nothing of the trousers or shoes out in the lap shows through the skirt.
  let bare = 0; const legsAt = [];
  for (const part of ["legs", "shoes"]) for (let i = 0; i < m.parts[part].geometry.attributes.position.count; i++) { const v = skinnedWorld(m.parts[part], i); if (Math.hypot(v.x, v.z) > 0.14 && v.y > -0.03) legsAt.push(v); }
  for (const v of legsAt) { let top = -Infinity; for (const c of torso) if (Math.hypot(c.x - v.x, c.z - v.z) < 0.02) top = Math.max(top, c.y); if (top < v.y) bare++; }
  assert.equal(bare, 0, `${bare} points of his folded legs show through the skirt`);
  const tip = (s) => B[s + "Hand"].localToWorld(new THREE.Vector3(...THUMB[s].tip).multiply(new THREE.Vector3(s === "left" ? 1 : -1, 1, 1)));
  const palmAt = (s) => world(B[s + "Hand"]).add(new THREE.Vector3(0, -0.045, 0).applyQuaternion(B[s + "Hand"].getWorldQuaternion(new THREE.Quaternion())));
  const tl = tip("left"), tr = tip("right"), palms = (palmAt("left").y + palmAt("right").y) / 2;
  assert.ok(tl.distanceTo(tr) < 0.013, `the thumb tips touch (${tl.distanceTo(tr).toFixed(4)} m between their middles)`);
  assert.ok(Math.abs(tl.y - tr.y) < 0.006 && (tl.y + tr.y) / 2 > palms + 0.018, `level with each other and raised over the palms, an open oval (${tl.y.toFixed(3)}, ${tr.y.toFixed(3)}; palms ${palms.toFixed(3)})`);
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

// Getting up from a stool (#642): he pushes off its front edge and comes down over his feet, leaning forward as one does to
// rise, legs reaching down, and his knees take the landing — not a hop's tuck, and never backwards over the stool's back.
test("getting up from a stool he leans forward over his feet, reaches down and lands on his knees", async () => {
  const { seatHopOff, dropPose } = await import("../../app/src/drop.js");
  const m = createMonk(), floor = () => 0, top = 0.44, shoe = m.parts.shoes;
  for (let i = 0; i < 120; i++) { m.group.position.set(0, top, 0); m.update(1 / 30, 0, "chair", i / 30, floor, { heightAt: floor }); }
  let worst = Infinity, leastHang = Infinity;
  const lean = [], plan = seatHopOff([0, top, 0], [0, 0, 0.55]);
  for (let i = 0; i <= 30; i++) {
    const u = i / 30, p = dropPose(plan, plan.duration * u);
    m.group.position.set(p.x, p.y, p.z);
    m.update(1 / 30, 0, "rise", 4 + i / 30, floor, { heightAt: floor, rise: u });
    m.group.updateMatrixWorld(true); m.skeleton.update();
    for (let k = 0; k < shoe.geometry.attributes.position.count; k += 3) worst = Math.min(worst, skinnedWorld(shoe, k).y);
    if (u >= 0.3 && u <= 0.9) leastHang = Math.min(leastHang, world(m.bones.hips).y - world(m.bones.leftFoot).y);   // (in the air)
    lean.push(m.group.worldToLocal(m.bones.head.getWorldPosition(new THREE.Vector3())).z);
  }
  assert.ok(worst > -0.02, `${(-worst * 100).toFixed(1)} cm of his shoe went under the floor getting up`);
  assert.ok(leastHang > 0.3, `his legs should reach down as he comes down, not tuck up under him (feet only ${leastHang.toFixed(2)} m below his hips)`);
  assert.ok(lean[8] > lean.at(-1) + 0.02, `he should lean forward over his feet as he rises (head ${lean[8].toFixed(3)} m before him mid-rise, ${lean.at(-1).toFixed(3)} m stood)`);
  // Stood, a crouch of 4.5 cm (the landing) brings his hips down with his feet still on the floor.
  const hips = () => { m.group.updateMatrixWorld(true); return world(m.bones.hips).y; };
  for (let i = 0; i < 20; i++) m.update(1 / 30, 0, "rise", 6 + i / 30, floor, { heightAt: floor, rise: 1 });
  const up = hips(); m.update(1 / 30, 0, "rise", 7, floor, { heightAt: floor, rise: 1, crouch: 0.045 }); const down = hips();
  assert.ok(up - down > 0.03, `landing should bend his knees: his hips drop ${(up - down).toFixed(3)} m`);
});
