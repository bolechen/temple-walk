// The novice cross-legged on a cushion (#664): what refs/monk-poses-v6-2026-11-23-sitting.webp shows, held as numbers.
// His outline from the front and from his side lies over the sheet's (tools/novice-sit-lib.mjs); there are legs under
// the robe, knees out as high as the hips, and the robe lies on them down to the cushion's rim; the hands lie on that
// cloth against his belly, palms up, the left on the right, the thumbs' tips together; the sleeves hang past the elbows;
// the hat is off his back and beside the cushion, and goes back when he gets up.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { createMonk, SEAT_LEGS, HAT_OFF } = await import("../../app/src/monk.js");
const { CUSHION, radiusAt } = await import("../../app/src/geo.js");
const { VIEWS, refMask, seat, triangles, overlay } = await import("../../tools/novice-sit-lib.mjs");

const TOP = 0.104, BACK = SEAT_LEGS.back, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);   // (he sits BACK behind the cushion's middle, which is the origin)
const world = (o) => o.getWorldPosition(V());
// Seated on a cushion whose crown is the origin's height: the seat's frame is the world's.
function seated(frames = 120) {
  const m = createMonk();
  for (let i = 0; i < frames; i++) m.update(1 / 30, 0, "sit", i / 30, () => -TOP, {});
  m.group.updateMatrixWorld(true); m.skeleton.update();
  return m;
}
const points = (mesh, keep = () => true) => { const out = [], v = V(); for (let i = 0; i < mesh.geometry.attributes.position.count; i++) if (keep(i)) out.push(mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).clone()); return out; };
/** A skinned mesh as it is drawn this frame, for rays: all of it, or the triangles whose three points `keep` takes. */
function baked(mesh, keep = () => true) {
  const p = mesh.geometry.attributes.position, pos = new Float32Array(p.count * 3), v = V(), ix = mesh.geometry.index.array, idx = [];
  for (let i = 0; i < p.count; i++) { mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }
  for (let k = 0; k < ix.length; k += 3) if (keep(ix[k]) && keep(ix[k + 1]) && keep(ix[k + 2])) idx.push(ix[k], ix[k + 1], ix[k + 2]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeBoundingSphere(); g.computeBoundingBox();
  const out = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); out.updateMatrixWorld(true); return out;
}
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
  const palm = (s) => world(B[s + "Hand"]).addScaledVector(fingers(s), 0.03);
  for (const [s, side] of [["left", 1], ["right", -1]]) {
    assert.ok(palmUp(s).y > 0.95, `${s} palm faces up (${palmUp(s).y.toFixed(2)})`);
    assert.ok(fingers(s).x * side < -0.9, `${s} fingers run in toward the other hand (${fingers(s).toArray().map((v) => v.toFixed(2))})`);
  }
  const pl = palm("left"), pr = palm("right");
  assert.ok(pl.y > pr.y + 0.01 && pl.y < pr.y + 0.035, `the left hand lies on the right (${(pl.y - pr.y).toFixed(3)} m higher)`);
  assert.ok(Math.abs(pl.x + pr.x) < 0.01 && pl.x - pr.x < 0.08, `the two lie over each other about his middle (palms ${pl.x.toFixed(3)} and ${pr.x.toFixed(3)})`);
  // the hands' middle against his belly: the front of the robe at that height, straight behind it
  const mid = pl.clone().add(pr).multiplyScalar(0.5);
  ray.set(V(0, mid.y, 0.6), V(0, 0, -1)); const belly = ray.intersectObject(trunk)[0];
  assert.ok(belly && mid.z - belly.point.z <= 0.03 && mid.z > belly.point.z, `the hands' middle is ${(mid.z - belly.point.z).toFixed(3)} m before his belly (at most 0.03)`);
  // every point of the hands (the hand bones' own skin): nothing of the robe's body over it (it is neither under the
  // cloth of the lap nor in his belly), and the cloth of the lap under it
  const body = baked(robe, (i) => i < m.robeBody), hands = points(skin, weighted(m, skin, /Hand$/)), up = V(0, 1, 0), down = V(0, -1, 0);
  let under = 0; const gap = { left: Infinity, right: Infinity };
  for (const v of hands) {
    ray.set(v, up); ray.far = 0.1; if (ray.intersectObject(body).some((h) => h.distance > 0.001)) under++;
    ray.set(v, down); ray.far = 0.2; const h = ray.intersectObject(lap)[0]; if (h) { const s = v.x > 0 ? "left" : "right"; gap[s] = Math.min(gap[s], h.distance); }
  }
  assert.equal(under, 0, `${under} points of his hands lie under the cloth of the lap or in his belly`);
  assert.ok(gap.right <= 0.02, `the right hand rests on the cloth (its lowest point ${gap.right.toFixed(3)} m over it, at most 0.02)`);
  // the thumbs
  const { left, right } = m.lap.hands, tipOf = (h, s) => B[s + "Hand"].localToWorld(V(h.thumb.tip[0] - 0.0045, h.thumb.tip[1] - 0.002, h.thumb.tip[2]).multiply(V(h.s, 1, 1)));
  const tl = tipOf(left, "left"), tr = tipOf(right, "right");
  assert.ok(tl.distanceTo(tr) < 0.013, `the thumbs' tips touch (${tl.distanceTo(tr).toFixed(4)} m between their middles)`);
  assert.ok(Math.abs(tl.y - tr.y) < 0.004 && tl.y > pl.y + 0.015, `level with each other and raised over the palms, an open oval (${tl.y.toFixed(3)}, ${tr.y.toFixed(3)}; the left palm ${pl.y.toFixed(3)})`);
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
    // and the forearm is not a stick held out: the elbow is beside his trunk, the wrist in his lap no higher than it by more than a finger
    assert.ok(Math.abs(elbow.x) < 0.24 && elbow.z < 0.06 && wrist.y < elbow.y + 0.03, `${s} elbow hangs beside him (${elbow.toArray().map((v) => v.toFixed(2))})`);
  }
});

test("seated on a cushion his hat is off his back and stands on its rim beside the cushion; when he gets up it is on his back again", () => {
  const m = createMonk(), hat = m.parts.hat, box = (k = m) => { k.group.updateMatrixWorld(true); return new THREE.Box3().setFromObject(k.parts.hat, true); };
  const stand = (n) => { for (let i = 0; i < n; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); };
  stand(30); const onBack = box(), backAt = onBack.getCenter(V());
  assert.ok(backAt.z < -0.05 && backAt.y > 0.5 && m.parts.straps.visible, "standing, the hat hangs on his back by its straps");
  // sat down on a cushion: the group stands on its crown, the floor a cushion's height below
  m.group.position.y = TOP; for (let i = 0; i < 120; i++) m.update(1 / 30, 0, "sit", i / 30, () => 0, {});
  const laid = box(), at = laid.getCenter(V()), rim = Math.max(...CUSHION.map(([r]) => r));
  assert.ok(Math.abs(laid.min.y) < 0.012, `its rim is on the floor (${laid.min.y.toFixed(3)} m)`);
  assert.ok(laid.max.y - laid.min.y < 0.17 && laid.max.x - laid.min.x > 0.38, "it stands on its rim, crown up");
  assert.ok(Math.hypot(at.x, at.z) - 0.2 > rim + 0.01 && Math.hypot(at.x, at.z) < 0.7 && at.x * Math.sign(HAT_OFF.x) > 0, `beside the cushion, clear of it, within reach (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`);
  assert.equal(m.parts.straps.visible, false, "its straps are not drawn while it is off");
  // where no floor is given, or the floor beside the seat is a drop, it lies a cushion's height under the seat
  for (const floor of [undefined, () => -3]) { const k = createMonk(); k.group.position.y = 2; for (let i = 0; i < 120; i++) k.update(1 / 30, 0, "sit", i / 30, floor, {}); assert.ok(Math.abs(box(k).min.y - (2 - TOP)) < 0.012, "the hat lies a cushion's height under the seat"); }
  // on a stool it stays on his back
  const c = createMonk(); for (let i = 0; i < 100; i++) c.update(1 / 30, 0, "chair", i / 30, () => -0.44, {});
  assert.ok(box(c).getCenter(V()).z < -0.05 && c.parts.straps.visible, "on a stool the hat stays on his back");
  // up again
  m.group.position.y = 0; stand(90); const again = box().getCenter(V());
  assert.ok(again.distanceTo(backAt) < 0.01 && m.parts.straps.visible, `standing again, the hat is on his back (${again.distanceTo(backAt).toFixed(3)} m from where it hung)`);
});

test("asked to, he lays the hat at his left; and beside every cushion of the level the side the page chooses is clear of everything drawn there", async () => {
  const m = createMonk(); m.group.position.y = TOP; for (let i = 0; i < 120; i++) m.update(1 / 30, 0, "sit", i / 30, () => 0, { hat: 1 });
  m.group.updateMatrixWorld(true); assert.ok(new THREE.Box3().setFromObject(m.parts.hat, true).getCenter(V()).x > 0.4, "the hat is at his left");
  const { buildSite, createWalker } = await import("../../app/src/site.js"), { buildInteriors } = await import("../../app/src/interior.js"), { hatSide } = await import("../../app/src/hatside.js");
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const site = buildSite(M), walker = createWalker(site), rooms = buildInteriors(M, site.halls), meshes = [];
  for (const g of [site.root, rooms.group]) { g.updateMatrixWorld(true); g.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) { o.geometry.boundingBox || o.geometry.computeBoundingBox(); meshes.push([o, o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)]); } }); }
  const a = V(), b = V(), c = V(), tri = new THREE.Box3(); let cushions = 0, lefts = 0;
  for (const s of [...site.seats, ...rooms.seats]) {
    if (s.kind !== "cushion") continue; cushions++;
    walker.setRoom(s.room ? rooms.rooms[s.room].room : null);
    const side = hatSide(walker, s.at[0], s.at[1], s.face), lx = -side * HAT_OFF.x; if (side > 0) lefts++;
    const x = s.at[0] + lx * Math.cos(s.face) + HAT_OFF.z * Math.sin(s.face), z = s.at[1] - lx * Math.sin(s.face) + HAT_OFF.z * Math.cos(s.face), floor = s.top - TOP;
    // the hat's own space over the floor: a hand's breadth inside its rim, from just over the floor to its crown
    const space = new THREE.Box3(V(x - 0.17, floor + 0.03, z - 0.17), V(x + 0.17, floor + 0.15, z + 0.17)); let hits = 0;
    for (const [o, box] of meshes) { if (!box.intersectsBox(space)) continue; const p = o.geometry.attributes.position, ix = o.geometry.index?.array, n = ix ? ix.length : p.count;
      for (let k = 0; k < n; k += 3) { a.fromBufferAttribute(p, ix ? ix[k] : k).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(p, ix ? ix[k + 1] : k + 1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(p, ix ? ix[k + 2] : k + 2).applyMatrix4(o.matrixWorld); if (tri.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c).intersectsBox(space)) hits++; } }
    assert.equal(hits, 0, `beside the cushion at (${s.at.map((q) => q.toFixed(2))}) in ${s.room || "the open"}, something drawn stands where the hat is laid (at his ${side > 0 ? "left" : "right"})`);
  }
  walker.setRoom(null);
  assert.ok(cushions >= 30 && lefts >= 3, `${cushions} cushions, the hat at his left beside ${lefts} of them`);
});
