// The novice cross-legged on a cushion (#664): what refs/monk-poses-v6-2026-11-23-sitting.webp shows, held as numbers.
// His outline from the front and from his side lies over the sheet's (tools/novice-sit-lib.mjs); there are legs under
// the robe, knees out as high as the hips, and the robe lies on them down to the cushion's rim; the hands lie on that
// cloth against his belly, palms up, the left on the right, the thumbs' tips together; the sleeves hang past the elbows;
// the hat stays on his back (the owner, 2026-11-25).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { TOP, V, baked } = await import("./monk-sit-lib.mjs");
const { createMonk, SEAT_LEGS, LAP_HAND } = await import("../../app/src/monk.js");
const { CUSHION, radiusAt } = await import("../../app/src/geo.js");
const { VIEWS, refMask, seat, triangles, overlay } = await import("../../tools/novice-sit-lib.mjs");

const BACK = SEAT_LEGS.back;   // (he sits BACK behind the cushion's middle, which is the origin)
const world = (o) => o.getWorldPosition(V());
// Seated on a cushion whose crown is the origin's height: the seat's frame is the world's.
function seated(frames = 120) {
  const m = createMonk();
  for (let i = 0; i < frames; i++) m.update(1 / 30, 0, "sit", i / 30, () => -TOP, {});
  m.group.updateMatrixWorld(true); m.skeleton.update();
  return m;
}
const points = (mesh, keep = () => true) => { const out = [], v = V(); for (let i = 0; i < mesh.geometry.attributes.position.count; i++) if (keep(i)) out.push(mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).clone()); return out; };
// Which points of a skinned mesh mostly hang from the bones named.
const weighted = (m, mesh, names) => { const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, bones = m.skeleton.bones.map((b) => b.name); return (i) => { let w = 0; for (let k = 0; k < 4; k++) if (names.test(bones[si.getComponent(i, k)])) w += sw.getComponent(i, k); return w > 0.5; }; };
const SKIRT = /^(hips|robeFront|robeBack|robeLeft|robeRight)$/, TRUNK = /^(hips|spine|chest|robeFront|robeBack|robeLeft|robeRight)$/;

test("seated, his outline is the design sheet's: intersection over union at least 0.90 from the front and from his side", async () => {
  const tris = triangles(seat(createMonk, TOP));
  for (const [name, { across }] of Object.entries(VIEWS)) {
    const o = overlay(tris, across, await refMask(name));
    assert.ok(o.iou >= 0.9, `${name}: ${o.iou.toFixed(4)}`);
  }
});

test("there are legs under the robe: knees out to the sides as high as the hips, far wider than his shoulders, shins crossed before him", () => {
  const m = seated(), B = m.bones, knees = [], ankles = [];
  for (const s of ["left", "right"]) {
    const hip = world(B[s + "UpperLeg"]), knee = world(B[s + "LowerLeg"]), ankle = world(B[s + "Foot"]);
    assert.ok(hip.y > 0.03 && hip.y < 0.11, `${s} hip ${hip.y.toFixed(3)} m above the cushion`);
    assert.ok(Math.abs(knee.y - hip.y) <= 0.03, `${s} knee within 3 cm of the hip's height (knee ${knee.y.toFixed(3)}, hip ${hip.y.toFixed(3)})`);
    assert.ok(Math.abs(knee.x) > 0.17 && knee.z > 0.08, `${s} knee out to the side and forward (${knee.toArray().map((v) => v.toFixed(2))})`);
    assert.ok(Math.abs(ankle.x) < 0.1 && ankle.z > 0.1 && Math.abs(ankle.y - knee.y) < 0.06, `${s} shin folded in before him (${ankle.toArray().map((v) => v.toFixed(2))})`);
    knees.push(knee); ankles.push(ankle);
  }
  assert.ok(ankles[0].z > ankles[1].z + 0.02, "the left shin lies in front of the right");
  // The legs as drawn (the trousers), knee to knee, against his shoulders: the robe's own width where the arms leave it.
  const legs = points(m.parts.legs), kneeWidth = Math.max(...legs.map((v) => v.x)) - Math.min(...legs.map((v) => v.x));
  const robe = m.parts.robe, trunk = weighted(m, robe, TRUNK), armY = world(B.leftUpperArm).y;
  const shoulders = points(robe, trunk).filter((v) => Math.abs(v.y - armY) < 0.02), shoulderWidth = Math.max(...shoulders.map((v) => v.x)) - Math.min(...shoulders.map((v) => v.x));
  assert.ok(kneeWidth >= 1.6 * shoulderWidth, `knees ${kneeWidth.toFixed(3)} m across, shoulders ${shoulderWidth.toFixed(3)} m (${(kneeWidth / shoulderWidth).toFixed(2)} times)`);
});

test("the robe lies over the legs: nothing of them shows, its front edge is no higher than the knees, and the hem comes down to the cushion's rim all round", () => {
  const m = seated(), robe = m.parts.robe, skirt = weighted(m, robe, SKIRT), cloth = baked(robe), ray = new THREE.Raycaster(), down = V(0, -1, 0);
  // from above, the cloth is met before any point of the folded legs or the shoes that lies out in the lap
  let bare = 0, worst = 0;
  for (const part of ["legs", "shoes"]) for (const v of points(m.parts[part])) {
    if (Math.hypot(v.x, v.z) < 0.12) continue;
    ray.set(V(v.x, 0.6, v.z), down); const hit = ray.intersectObject(cloth)[0];
    if (!hit || hit.point.y < v.y - 0.001) { bare++; worst = Math.max(worst, hit ? v.y - hit.point.y : 1); }
  }
  assert.equal(bare, 0, `${bare} points of his folded legs or shoes stand out of the skirt (by up to ${worst.toFixed(3)} m)`);
  const pts = points(robe, skirt), kneeTop = Math.max(...pts.filter((v) => Math.abs(Math.abs(v.x) - SEAT_LEGS.knee[0]) < 0.03 && Math.abs(v.z + BACK - SEAT_LEGS.knee[2]) < 0.03).map((v) => v.y));
  const front = pts.filter((v) => v.z > 0.26 && Math.abs(v.x) < 0.1), frontTop = Math.max(...front.map((v) => v.y));
  assert.ok(front.length > 4 && frontTop <= kneeTop, `the skirt's front edge (${frontTop.toFixed(3)} m) is no higher than the cloth over the knees (${kneeTop.toFixed(3)} m)`);
  // all round: the lowest of the hem in each of sixteen directions lies on the cushion's shoulder or over its rim
  const rim = Math.max(...CUSHION.map(([r]) => r));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, slice = pts.filter((v) => Math.abs(Math.atan2(Math.sin(Math.atan2(v.x, v.z) - a), Math.cos(Math.atan2(v.x, v.z) - a))) < 0.2);
    const low = slice.reduce((p, v) => (v.y < p.y ? v : p)), far = Math.max(...slice.map((v) => Math.hypot(v.x, v.z)));
    assert.ok(low.y < 0.012, `at ${Math.round(a * 180 / Math.PI)}° the hem comes down onto the cushion (${low.y.toFixed(3)} m over its crown)`);
    if (Math.abs(a) < 1.7 || Math.abs(a) > 4.6) assert.ok(far > rim - 0.05, `at ${Math.round(a * 180 / Math.PI)}° it reaches the cushion's rim (${far.toFixed(3)} of ${rim} m)`);
    // (his knees lie out past a cushion of this size, as they do past a real one, and the robe over them: a hand's breadth at most)
    assert.ok(far < rim + 0.11, `at ${Math.round(a * 180 / Math.PI)}° it does not spread far past the rim (${far.toFixed(3)} m)`);
  }
  // nothing of the robe below the cushion's own surface where it lies on it, or under the floor
  for (const v of pts) { const r = Math.hypot(v.x, v.z); if (r < rim) assert.ok(v.y + TOP > radiusAt(CUSHION, v.y + TOP) - r - 0.006 || v.y > -0.016, `the robe is inside the cushion at (${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`); assert.ok(v.y > -TOP, "the robe is under the floor"); }
});

test("the hands lie on the lap against his belly in the meditation seal: palms up, the left on the right, the thumbs' tips together", () => {
  const m = seated(), B = m.bones, robe = m.parts.robe, skin = m.parts.skin, ray = new THREE.Raycaster();
  const lap = baked(robe, weighted(m, robe, SKIRT)), trunk = baked(robe, (i) => i < m.robeBody);
  const q = (s) => B[s + "Hand"].getWorldQuaternion(new THREE.Quaternion()), palmUp = (s) => V(0, 0, 1).applyQuaternion(q(s)), fingers = (s) => V(0, -1, 0).applyQuaternion(q(s));
  const palm = (s) => world(B[s + "Hand"]).addScaledVector(fingers(s), m.lap.handMid);   // the middle of the hand's length
  for (const [s, side] of [["left", 1], ["right", -1]]) {
    assert.ok(palmUp(s).y > 0.95, `${s} palm faces up (${palmUp(s).y.toFixed(2)})`);
    assert.ok(fingers(s).x * side < -0.9, `${s} fingers run in toward the other hand (${fingers(s).toArray().map((v) => v.toFixed(2))})`);
  }
  const pl = palm("left"), pr = palm("right");
  assert.ok(pl.y > pr.y + 0.01 && pl.y < pr.y + 0.035, `the left hand lies on the right (${(pl.y - pr.y).toFixed(3)} m higher)`);
  // deep over each other: the middles of the two hands (each hand's own skin) no more than 3.6 cm apart across (the first art review measured 3.8 and asked for no more than 4)
  const centre = (side) => { const q = points(skin, weighted(m, skin, new RegExp(`^${side}Hand$`))); return q.reduce((a, v) => a.add(v), V()).divideScalar(q.length); };
  const cl = centre("left"), cr = centre("right");
  assert.ok(Math.abs(cl.x - cr.x) <= 0.036 && Math.abs(cl.x + cr.x) < 0.012, `the two hands lie over each other about his middle (their middles ${cl.x.toFixed(3)} and ${cr.x.toFixed(3)}, ${(Math.abs(cl.x - cr.x) * 100).toFixed(2)} cm apart across)`);
  // the hands' middle against his belly: half way between the middles of the two palms (where layHands lays them), and
  // the front of the robe at that height straight behind it
  const mid = palm("left").add(palm("right")).multiplyScalar(0.5);
  ray.set(V(0, mid.y, 0.6), V(0, 0, -1)); const belly = ray.intersectObject(trunk)[0];
  assert.ok(belly && mid.z - belly.point.z <= 0.03 && mid.z > belly.point.z, `the hands' middle is ${(mid.z - belly.point.z).toFixed(3)} m before his belly (at most 0.03; ${(mid.z - belly.point.z).toFixed(4)})`);
  // every point of the hands (the hand bones' own skin): not under the cloth of the lap (nothing of the skirt straight
  // above it), not in his belly (a point inside the trunk meets its front within a few centimetres straight ahead; one
  // before it meets nothing), and the cloth of the lap under it. (Tucked under the belly's swell is touching, not in it.)
  const body = baked(robe, (i) => i < m.robeBody), hands = points(skin, weighted(m, skin, /Hand$/)), up = V(0, 1, 0), down = V(0, -1, 0), ahead = V(0, 0, 1);
  let under = 0, inside = 0; const gap = { left: Infinity, right: Infinity };
  for (const v of hands) {
    ray.set(v, up); ray.far = 0.1; if (ray.intersectObject(lap).some((h) => h.distance > 0.001)) under++;
    ray.set(v, ahead); ray.far = 0.04; if (ray.intersectObject(body).some((h) => h.distance > 0.001 && h.point.y > v.y - 0.01)) inside++;
    ray.set(v, down); ray.far = 0.2; const h = ray.intersectObject(lap)[0]; if (h) { const s = v.x > 0 ? "left" : "right"; gap[s] = Math.min(gap[s], h.distance); }
  }
  assert.equal(under, 0, `${under} points of his hands lie under the cloth of the lap`);
  assert.equal(inside, 0, `${inside} points of his hands are in his belly`);
  assert.ok(gap.right <= 0.02, `the right hand rests on the cloth (its lowest point ${gap.right.toFixed(3)} m over it, at most 0.02)`);
  // the thumbs
  const { left, right } = m.lap.hands, tipOf = (h, s) => B[s + "Hand"].localToWorld(V(...h.thumb.tip).multiplyScalar(LAP_HAND.big).add(V(-0.0045, -0.002, 0)).multiply(V(h.s, 1, 1)));   // (as buildHand lays it: drawn at `big`, then set against the wrist)
  const tl = tipOf(left, "left"), tr = tipOf(right, "right");
  assert.ok(tl.distanceTo(tr) < 0.02, `the thumbs' tips touch (two tip balls of 0.011 m, so under 0.022 between their middles is touching; (${tl.distanceTo(tr).toFixed(4)} m between their middles)`);
  assert.ok(Math.abs(tl.y - tr.y) < 0.004 && tl.y > pl.y + 0.008, `level with each other and raised over the palms, an open oval (${tl.y.toFixed(3)}, ${tr.y.toFixed(3)}; the left palm ${pl.y.toFixed(3)})`);
});

test("the sleeves hang past the elbows, and the forearms come out under them", () => {
  const m = seated(), B = m.bones, robe = m.parts.robe;
  for (const [s, side] of [["left", 1], ["right", -1]]) {
    const shoulder = world(B[s + "UpperArm"]), elbow = world(B[s + "LowerArm"]), wrist = world(B[s + "Hand"]), arm = elbow.clone().sub(shoulder).normalize();
    const sleeve = points(robe, weighted(m, robe, new RegExp(`^${s}(UpperArm|Shoulder)$`)));
    const past = Math.max(...sleeve.map((v) => v.clone().sub(elbow).dot(arm)));
    assert.ok(past >= 0.03, `${s} sleeve hangs ${past.toFixed(3)} m past the elbow`);
    // the elbow itself is within the sleeve: cloth on its outer side and behind it
    const outer = sleeve.filter((v) => Math.abs(v.clone().sub(elbow).dot(arm)) < 0.02);
    assert.ok(outer.some((v) => (v.x - elbow.x) * side > 0.03) && outer.some((v) => v.z < elbow.z - 0.03), `${s} elbow is covered on its outer side and behind`);
    // and the forearm is not a stick held out: the elbow is beside his trunk, the wrist in his lap no higher than it by more than two fingers (the left lies on the right, so its forearm is nearly level)
    assert.ok(Math.abs(elbow.x) < 0.24 && elbow.z < 0.06 && wrist.y < elbow.y + 0.05, `${s} elbow hangs beside him (${elbow.toArray().map((v) => v.toFixed(2))}; the wrist ${(wrist.y - elbow.y).toFixed(3)} m over it)`);
  }
});

test("seated on a cushion his hat stays on his back by its straps, as standing (the owner, 2026-11-25: 「改回去」)", () => {
  const m = createMonk(), box = () => { m.group.updateMatrixWorld(true); return new THREE.Box3().setFromObject(m.parts.hat, true); };
  for (let i = 0; i < 30; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {});
  const standing = box().getCenter(V()).sub(world(m.bones.chest));
  m.group.position.y = TOP; for (let i = 0; i < 120; i++) m.update(1 / 30, 0, "sit", i / 30, () => 0, {});
  const at = box().getCenter(V()), off = at.clone().sub(world(m.bones.chest));
  assert.ok(m.parts.straps.visible, "its straps are drawn");
  assert.ok(off.z < -0.05 && off.distanceTo(standing) < 0.06, `it hangs behind his chest as it does standing (${off.toArray().map((v) => v.toFixed(3))}, standing ${standing.toArray().map((v) => v.toFixed(3))})`);
  assert.ok(box().min.y > TOP + 0.02, `it is clear of the cushion (its lowest ${box().min.y.toFixed(3)} m, the cushion's crown ${TOP} m)`);
});

test("beside every cushion of the level, his robe as he sits there passes into nothing drawn", async () => {
  const { buildSite } = await import("../../app/src/site.js"), { buildInteriors } = await import("../../app/src/interior.js");
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const site = buildSite(M), rooms = buildInteriors(M, site.halls), meshes = [];
  for (const g of [site.root, rooms.group]) { g.updateMatrixWorld(true); g.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) { o.geometry.boundingBox || o.geometry.computeBoundingBox(); meshes.push([o, o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)]); } }); }
  let cushions = 0;
  // and the robe, as he sits on each, passes into nothing drawn beside it (#664: the tea house's corner cushions lay so
  // near its wall that the lap went 4 cm into it): a point inside a closed thing meets it an odd number of times going
  // straight up within 0.8 m (a roof higher than that is not asked).
  const seated0 = createMonk(); for (let i = 0; i < 120; i++) seated0.update(1 / 30, 0, "sit", i / 30, () => -TOP, {}); seated0.group.updateMatrixWorld(true);
  const lapPts = points(seated0.parts.robe, (i) => i < seated0.robeBody).filter((q) => q.y < 0.12), ray = new THREE.Raycaster(), up = V(0, 1, 0);
  for (const s of [...site.seats, ...rooms.seats]) {
    if (s.kind !== "cushion") continue; cushions++;
    const c = Math.cos(s.face), sn = Math.sin(s.face), at = lapPts.map((q) => V(s.at[0] + q.x * c + q.z * sn, s.top + q.y, s.at[1] - q.x * sn + q.z * c)), box = new THREE.Box3().setFromPoints(at);
    const near = meshes.filter(([, b]) => b.intersectsBox(box) && !(b.max.y - b.min.y < 0.12 && Math.hypot((b.min.x + b.max.x) / 2 - s.at[0], (b.min.z + b.max.z) / 2 - s.at[1]) < 0.05)).map(([o]) => o);
    let inside = 0; for (const p of at) { ray.set(p, up); ray.far = 0.8; if (ray.intersectObjects(near, false).length % 2) inside++; }
    assert.equal(inside, 0, `seated on the cushion at (${s.at.map((q) => q.toFixed(2))}) in ${s.room || "the open"}, ${inside} points of his robe are inside something drawn there`);
  }
  assert.ok(cushions >= 30, `${cushions} cushions`);
});

test("where the robe comes down onto the cushion it is pressed into a crease and its hem rolls up (the art review's relief, #666)", () => {
  // Along every column of the skirt before him and at his sides, the last few centimetres dip and then rise again at
  // the hem by a few millimetres: not one smooth slope down to a sharp edge.
  // (Behind him the cloth comes straight down from his back onto the cushion, and there is no lap to lie out from.)
  const m = createMonk(), n = m.lap.lines.length - 1; let checked = 0;
  for (const [j, { pts }] of m.lap.lines.entries()) {
    if (Math.abs(-Math.PI + (2 * Math.PI * j) / n) > 2.2) continue;
    const tail = pts.filter((q) => q.rho > pts[pts.length - 1].rho - 0.03); if (tail.length < 6) continue;
    const ys = tail.map((q) => q.y), low = Math.min(...ys), at = ys.indexOf(low), rise = Math.max(...ys.slice(at)) - low;
    assert.ok(at < ys.length - 2 && rise >= 0.003, `a column's hem rises ${(rise * 1000).toFixed(1)} mm past its crease (its last 3 cm: ${ys.map((y) => (y * 1000).toFixed(0)).join(" ")} mm)`);
    checked++;
  }
  assert.ok(checked >= 40, `${checked} columns checked`);
});

test("seated on a cushion his shadow lies on the floor under it, not through his robe", () => {
  // (the shadow is a see-through sheet; at the seat's height it cut a dark ring round the skirt, the first art review's
  // 「袍下段一圈台阶折痕」)
  const m = seated(); const y = m.shadow.getWorldPosition(V()).y, robe = points(m.parts.robe, (i) => i < m.robeBody), low = Math.min(...robe.map((v) => v.y));
  assert.ok(y < low - 0.01 && y > -TOP, `the shadow at ${y.toFixed(3)} m, the robe's lowest ${low.toFixed(3)} m, the floor ${-TOP} m`);
});
