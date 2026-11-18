// The 功德箱 (issue #202): a chest in the great hall that takes a free coin in every build; the address of the sponsor page
// is written once, in the web build's own file, in the shape the owner settled (standard UTM tags, the language as content).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { donateURL, DONATE_ORIGIN } = await import("../../app/src/donate.js");
const { channelOf, CHANNELS, CHANNEL, WEB } = await import("../../app/src/channel.js");
const { buildSite, createWalker } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { BODY } = await import("../../app/src/geo.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });

test("the sponsor page's address, per language, carries the standard campaign tags and the language as content", () => {
  const want = { zh: "/donate", en: "/en/donate", ja: "/ja/donate", ko: "/en/donate" };   // the sponsor page has no Korean page; the English one stands in
  for (const [lang, path] of Object.entries(want)) {
    const u = new URL(donateURL(lang));
    assert.equal(u.origin, DONATE_ORIGIN); assert.equal(u.protocol, "https:"); assert.equal(u.pathname, path, lang);
    assert.deepEqual(Object.fromEntries(u.searchParams), { utm_source: "temple-walk", utm_medium: "game", utm_campaign: "offering-box", utm_content: lang }, lang);
  }
  assert.equal(new URL(donateURL("fr")).pathname, "/en/donate", "an unknown language gets the English page");
});

test("the channel is one of three, the public page by default, and a wrong name fails the build", () => {
  assert.deepEqual([...CHANNELS], ["web", "steam", "platform"]);
  for (const c of CHANNELS) assert.equal(channelOf(c), c);
  assert.equal(channelOf(undefined), "web"); assert.equal(channelOf(""), "web");
  assert.throws(() => channelOf("itch"), /VITE_CHANNEL/);
  assert.equal(CHANNEL, "web", "sources run in Node are the public page"); assert.equal(WEB, true);
});

test("the great hall has a 功德箱 beside the offering table, standable before, with a slot above the floor, and it blocks nothing it should not", () => {
  const site = buildSite(M), built = buildInteriors(M, site.halls), main = built.rooms.main, box = built.spots["main-box"];
  assert.ok(box && box.item.offering, "no offering box in the great hall");
  for (const id of Object.keys(built.rooms)) if (id !== "main") assert.ok(!built.spots[`${id}-box`], `${id} has a box`);
  const w = createWalker(site); w.setRoom(main.room);
  assert.ok(box.slot[1] > main.room.y + 0.7 && box.slot[1] < main.room.y + 1.1, "the slot is not about waist high");
  assert.ok(!w.blocked(box.at[0], box.at[1]), "he cannot stand where it is offered");
  assert.ok(w.blocked(box.slot[0], box.slot[2]), "the box itself is open floor");
  const dx = box.slot[0] - box.at[0], dz = box.slot[2] - box.at[1];
  assert.ok(Math.hypot(dx, dz) < 1.0 + BODY, `the slot is ${Math.hypot(dx, dz).toFixed(2)} m from where he stands`);
  assert.ok(Math.abs(box.at[0] - main.room.cx) < 6, "it stands within the dais's width");
});

// ---- The coin goes in by his own hand (#202, the rework): he stands where his arm reaches the slot ----
const { createMonk } = await import("../../app/src/monk.js");
const world = (o) => o.getWorldPosition(new THREE.Vector3());
const standing = (bow = 0.6) => {
  const site2 = buildSite(M), built2 = buildInteriors(M, site2.halls), room = built2.rooms.main.room, spot = built2.spots["main-box"], monk = createMonk();
  monk.group.position.set(spot.at[0], room.y, spot.at[1]); monk.group.rotation.y = spot.face;
  for (let i = 0; i < 3; i++) monk.update(1 / 30, 0, "pray", i / 30, () => 0, { act: { bow } }); monk.group.updateMatrixWorld(true);
  return { spot, monk, room };
};

test("standing where it is offered, the pinch of his fingers over the slot is within his arm's reach, a bow of at most 0.6 leaning him in", () => {
  const { spot, monk } = standing(0.6), TIP = 0.068, HOLD = 0.04;
  const slot = new THREE.Vector3(...spot.slot), fingers = new THREE.Vector3(0, -0.447, 0.894).applyQuaternion(monk.group.quaternion);
  const wrist = slot.clone().setY(slot.y + HOLD).addScaledVector(fingers, -TIP), shoulder = world(monk.bones.rightUpperArm);
  assert.ok(shoulder.distanceTo(wrist) <= 0.2 + 0.15 - 0.02, `the wrist would have to be ${(shoulder.distanceTo(wrist) * 100).toFixed(1)} cm from his shoulder; an arm is ${(0.35 * 100).toFixed(0)} cm and should not be straight`);
});

const { carry, over, fallen, FALL, HOLD, TIP, FINGERS, PALM } = await import("../../app/src/coin.js");
// The right hand sent along the carry, as rites.dropCoin sends it, on the real monk standing where he stands to offer.
function carried(us, bowOf) {
  const { spot, monk, room } = standing(0.28), up = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.face), inv = up.clone().invert();
  const floor = new THREE.Vector3(spot.at[0], room.y, spot.at[1]), slotW = new THREE.Vector3(...spot.slot);
  const local = (w) => w.clone().sub(floor).applyQuaternion(inv), toWorld = (l) => l.clone().applyQuaternion(up).add(floor), way = (l) => l.clone().applyQuaternion(up);
  const SL = local(slotW), H0 = local(world(monk.bones.rightHand)), act = { bow: 0.28, hands: { left: { at: new THREE.Vector3(), w: 0 }, right: { at: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(1, 0, 0), w: 1 } } };
  return us.map((u) => {
    const c = carry(u, H0, SL); act.bow = bowOf(u); act.hands.right.at.copy(toWorld(c.at)); act.hands.right.fingers.copy(way(c.fingers)); act.hands.right.palm.copy(way(PALM));
    for (let i = 0; i < 2; i++) monk.update(1 / 60, 0, "pray", 0, () => 0, { act }); monk.group.updateMatrixWorld(true);
    const hand = world(monk.bones.rightHand), tip = hand.clone().addScaledVector(way(FINGERS.over.clone().lerp(FINGERS.pray, 0)).set(0, 0, 0), 0);
    const f = new THREE.Vector3(0, -1, 0).transformDirection(monk.bones.rightHand.matrixWorld);   // along his fingers: the hand bone's -y
    return { u, coin: toWorld(c.coin), target: toWorld(c.at), hand, pinch: hand.clone().addScaledVector(f, TIP), shoulder: world(monk.bones.rightUpperArm), slotW, SL, local };
  });
}
const us = Array.from({ length: 41 }, (_, i) => i / 40), bowOf = (u) => 0.28 + (0.55 - 0.28) * (u * u * (3 - 2 * u));

test("the coin is never more than 3 cm from his fingertips as the hand takes it to the slot", () => {
  for (const s of carried(us, bowOf)) assert.ok(s.coin.distanceTo(s.pinch) <= 0.03, `at ${s.u.toFixed(3)} of the way the coin is ${(s.coin.distanceTo(s.pinch) * 100).toFixed(1)} cm from the pinch of his fingers`);
});

test("the hand is let go over the middle of the slot (within 1 cm), the coin the height of HOLD over the lid, and the wrist asked for is within his arm's reach all the way", () => {
  const end = carried([1], bowOf)[0], flat = (v) => Math.hypot(v.x - end.slotW.x, v.z - end.slotW.z);
  assert.ok(flat(end.coin) <= 0.01, `the coin is let go ${(flat(end.coin) * 100).toFixed(1)} cm from the middle of the slot`);
  assert.ok(Math.abs(end.coin.y - end.slotW.y - HOLD) < 1e-6, "it falls the distance HOLD");
  assert.ok(flat(end.pinch) <= 0.03, `the fingers are ${(flat(end.pinch) * 100).toFixed(1)} cm off the slot's middle`);
  for (const s of carried(us, bowOf)) assert.ok(s.shoulder.distanceTo(s.target) <= 0.35 * 0.9995 + 1e-6, `at ${s.u.toFixed(3)} the wrist is sent ${(s.shoulder.distanceTo(s.target) * 100).toFixed(1)} cm from his shoulder, an arm is 35`);
});

test("the coin does not go through the lid and does not hang in the air: it is over the lid with room to spare, and falls to its top in a tenth of a second", () => {
  const spot = buildInteriors(M, buildSite(M).halls).spots["main-box"], lidTop = spot.slot[1];
  for (const s of carried(us, bowOf)) {
    const over_ = Math.abs(s.coin.x - spot.slot[0]) < 0.23 + 0.012 && Math.abs(s.coin.z - (spot.slot[2] - 0.12)) < 0.17 + 0.012;   // over the lid's footprint
    if (over_) assert.ok(s.coin.y >= lidTop + 0.012, `at ${s.u.toFixed(3)} the coin is ${(s.coin.y - lidTop) * 100} cm over a lid it is over`);
    assert.ok(s.coin.y > lidTop - 0.001 || !over_, "the coin is under the lid's top");
  }
  assert.ok(Math.abs(fallen(0) - HOLD) < 1e-9 && Math.abs(fallen(FALL)) < 1e-9, "it falls HOLD in FALL seconds");
  assert.ok(FALL > 0.05 && FALL < 0.15, `it takes ${(FALL * 1000).toFixed(0)} ms to fall`);
  assert.ok(Math.abs(over(new THREE.Vector3(0, 0.74, 0.44)).pinch.y - 0.74 - HOLD) < 1e-9);
});
