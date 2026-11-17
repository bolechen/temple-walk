// What the observances ask of him and of the place: a hand sent somewhere arrives, a bow and a breath show, the bell's
// log touches the bronze and goes no further, every cushion and stool is a seat he can come to, and the incense stand
// is within his reach.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker, BODY } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createMonk } = await import("../../app/src/monk.js");
const { logSwing } = await import("../../app/src/rites.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site), rooms = buildInteriors(M, site.halls);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

test("a hand sent to a place within his reach arrives there, and one sent too far goes as far as the arm does", () => {
  const monk = createMonk(), act = { hands: { left: { at: V(0.05, 0.8, 0.27), w: 1 }, right: { at: V(-0.05, 0.8, 0.27), w: 1 } } };
  for (let i = 0; i < 20; i++) monk.update(0.05, 0, false, i * 0.05, () => 0, { act });
  for (const n of ["left", "right"]) { const d = monk.bones[n + "Hand"].getWorldPosition(V(0, 0, 0)).distanceTo(act.hands[n].at); assert.ok(d < 0.02, `${n} hand is ${(d * 100).toFixed(1)} cm from where it was sent`); }
  act.hands.left.at.set(0.1, 0.8, 1.5); monk.update(0.05, 0, false, 2, () => 0, { act });
  const sh = monk.bones.leftUpperArm.getWorldPosition(V(0, 0, 0)), far = monk.bones.leftHand.getWorldPosition(V(0, 0, 0));
  assert.ok(far.distanceTo(sh) < 0.36 && far.z > 0.3, "an arm does not stretch");
  act.hands.left.w = act.hands.right.w = 0; monk.update(0.05, 0, false, 3, () => 0, { act });
  assert.ok(monk.bones.leftHand.getWorldPosition(V(0, 0, 0)).y < 0.55, "a hand let go hangs at his side again");
});
test("a bow carries his head forward and down, and a breath taken on purpose fills his chest", () => {
  const monk = createMonk(), head = () => monk.bones.head.getWorldPosition(V(0, 0, 0));
  monk.update(0.05, 0, false, 0, () => 0, {}); const up = head();
  monk.update(0.05, 0, false, 0, () => 0, { act: { bow: 0.5 } }); const down = head();
  assert.ok(down.z > up.z + 0.08 && down.y < up.y - 0.015, `bowed: the head moved ${(down.z - up.z).toFixed(3)} forward, ${(up.y - down.y).toFixed(3)} down`);
  monk.update(0.05, 0, "sit", 0, () => 0, { act: { breath: -1 } }); const out = monk.bones.chest.scale.z;
  monk.update(0.05, 0, "sit", 0, () => 0, { act: { breath: 1 } }); const full = monk.bones.chest.scale.z;
  assert.ok(Math.abs(out - 1) < 1e-6 && full > 1.04, "the chest does not fill"); assert.ok(Math.abs(monk.bones.neck.scale.z * full - 1) < 1e-6, "the head should keep its size");
});
test("the bell's log is drawn back, touches the bronze and goes no further, and comes to rest", () => {
  const s = { t0: 10000, lead: 1300, gap: 0.18 }; let lo = 0, hi = 0;
  for (let t = 8000; t < 22000; t += 5) { const z = logSwing(s, t); lo = Math.min(lo, z); hi = Math.max(hi, z); }
  assert.ok(Math.abs(lo + 0.18) < 1e-9, `the log reached ${lo}`); assert.ok(hi > 0.2 && hi < 0.3, `it was drawn back ${hi}`);
  assert.equal(logSwing(s, 8600), 0); assert.ok(Math.abs(logSwing(s, 10000) + 0.18) < 1e-9, "it should meet the bell at the moment it sounds"); assert.equal(logSwing(s, 19500), 0);
  const tap = { t0: 10000, lead: 0, gap: 0.18 }; assert.equal(logSwing(tap, 9990), 0); assert.ok(Math.abs(logSwing(tap, 10080) + 0.18) < 1e-9 && logSwing(tap, 10040) < -0.05, "a tap should send the log to the bell");
  const bellS = site.strikers.find((k) => k.kind === "bell"); assert.ok(bellS.rope && bellS.gap > 0.1, "the bell's log has no rope to pull");
  const p = site.places.bell; assert.ok(!walker.blocked(p.at[0], p.at[1]) && walker.blocked(p.at[0], p.at[1] + 0.06), "he should stand at the edge of what he can reach, before the rope");
});
test("every cushion and every stool is a seat, and he can come within a step or two of each", () => {
  const all = [...site.seats, ...rooms.seats]; assert.ok(all.length >= 30, `only ${all.length} seats`);
  for (const id of ["main", "chan", "tea", "library", "yaoshi", "guanyin", "dahui", "lingxiao"]) assert.ok(rooms.seats.some((s) => s.room === id), `nothing to sit on in ${id}`);
  assert.equal(site.seats.filter((s) => s.room === null).length, 8, "out of doors: three stools, the summit mat and the four cushions of the tea house porch");
  for (const [x, z] of site.drawnSeats) assert.ok(site.seats.some((q) => q.room === null && Math.hypot(q.at[0] - x, q.at[1] - z) < 0.05), `a cushion or stool is drawn at (${x.toFixed(2)}, ${z.toFixed(2)}) and is no seat`);   // #144: drawn and walked round, but nothing to sit on
  // How he sits follows what the seat is: on a stool as on a chair, on a cushion cross-legged. A stool stands at a grown
  // man's sitting height, a cushion low.
  assert.deepEqual(site.seats.filter((s) => s.room === null).map((s) => s.kind), ["stool", "stool", "stool", "cushion", "cushion", "cushion", "cushion", "cushion"]);
  assert.ok(rooms.seats.some((s) => s.kind === "stool") && rooms.seats.some((s) => s.kind === "cushion"), "the rooms have stools and cushions");
  for (const s of all) {
    assert.ok(s.kind === "stool" || s.kind === "cushion", `a seat in ${s.room || "the open"} of no kind (${s.kind})`);
    walker.setRoom(s.room ? rooms.rooms[s.room].room : null);
    const floor = s.room ? rooms.rooms[s.room].room.y : walker.heightAt(s.at[0] + 0.45, s.at[1]), h = s.top - floor;   // beside it: the summit mat is itself a floor, walked onto
    const onBench = s.room === "chan" && Math.abs(h - 0.104 - 0.42) < 0.02;   // the meditation hall's cushions lie on its long platforms
    assert.ok(s.kind === "stool" ? h > 0.4 && h < 0.5 : (h > 0.08 && h < 0.13) || onBench, `a ${s.kind} ${h.toFixed(2)} m high in ${s.room || "the open"}`);
  }
  for (const s of all) {
    walker.setRoom(s.room ? rooms.rooms[s.room].room : null);
    let near = false; for (let a = 0; a < 24 && !near; a++) for (const r of [0.5, 0.9, 1.3]) { const x = s.at[0] + Math.sin((a / 24) * 6.283) * r, z = s.at[1] + Math.cos((a / 24) * 6.283) * r; if (!walker.blocked(x, z)) { near = true; break; } }
    assert.ok(near, `the seat at ${s.at.map((v) => v.toFixed(1))} in ${s.room || "the open"} cannot be come to`);
    const floor = s.room ? rooms.rooms[s.room].room.y : walker.heightAt(s.at[0] + 0.45, s.at[1]);   // beside it: the summit mat is itself a floor, walked onto
    assert.ok(Number.isFinite(s.face) && s.top - floor > 0.05 && s.top - floor < 1.0, `a seat ${(s.top - floor).toFixed(2)} m above the floor in ${s.room || "the open"}`);
  }
  walker.setRoom(null);
});
test("the incense stand is before the cushion, within his reach from where he steps up to it", () => {
  const p = rooms.places.incense; assert.ok(p && p.front && p.bowl, "the great hall has no stand for a visitor's incense");
  walker.setRoom(rooms.rooms.main.room);
  assert.ok(!walker.blocked(p.at[0], p.at[1]) && !walker.blocked(p.front[0], p.front[1]), "he cannot stand at the cushion or before the stand");
  assert.ok(walker.blocked(p.bowl[0], p.bowl[2]), "the stand should be in the way, not walked through");
  const d = Math.hypot(p.bowl[0] - p.front[0], p.bowl[2] - p.front[1]); assert.ok(d > BODY && d < 0.62, `the bowl is ${d.toFixed(2)} m from where he stands`);
  assert.ok(p.bowl[1] - p.y > 0.5 && p.bowl[1] - p.y < 0.75, "the bowl should stand below his shoulders");
  walker.setRoom(null);
});
test("a stroke begun while the log still swings draws it back from where it is, without a jump, and still stops at the bronze", () => {
  const s = { t0: 10000, lead: 1000, gap: 0.18 };
  const at = 11500, mid = logSwing(s, at); assert.ok(Math.abs(mid) > 0.02, `the log should still be swinging (${mid})`);
  s.from = mid; s.t0 = at + 1000; s.lead = 1000;   // the next press, while it swings
  assert.ok(Math.abs(logSwing(s, at) - mid) < 1e-6, `the log jumped from ${mid} to ${logSwing(s, at)}`);
  let prev = logSwing(s, at), lo = 0, jump = 0;
  for (let t = at; t < at + 9000; t += 5) { const z = logSwing(s, t); jump = Math.max(jump, Math.abs(z - prev)); prev = z; lo = Math.min(lo, z); }
  assert.ok(jump < 0.02, `the log moved ${jump} in 5 ms`); assert.ok(lo >= -0.18 - 1e-9, `the log went into the bell: ${lo}`);
});

// An observance made sitting (the tea on its stool, the breaths on the summit mat) sets him on the seat's own top,
// as sitting down on any seat does: on the summit he used to be lifted a further 0.1 m over a mat whose top the floor
// under him already was, and from before him he was seen hanging over it (review of #87).
test("an observance made sitting sets him on the top of its seat, not above it", async () => {
  const { placeLift } = await import("../../app/src/site.js");
  for (const id of ["tea", "sit"]) {
    const p = site.places[id], at = p.at, lift = placeLift(p, site.seats, walker.heightAt);
    const seat = site.seats.find((s) => (s.room || null) === (p.room || null) && Math.hypot(s.at[0] - (p.seat || at)[0], s.at[1] - (p.seat || at)[1]) < 0.3);
    assert.ok(seat, `${id}: no seat registered where it is made`);
    assert.ok(Math.abs(walker.heightAt(at[0], at[1]) + lift - seat.top) < 0.005, `${id}: he sits ${(walker.heightAt(at[0], at[1]) + lift - seat.top).toFixed(3)} m off the seat's top`);
  }
});

test("the closing shot leaves air over the pavilion: its top stays a twelfth of the picture under the upper edge, upright or wide", async () => {
  const { aimToFrame } = await import("../../app/src/rites.js");
  assert.equal(typeof aimToFrame, "function", "rites.js has no aimToFrame");
  const cam = new THREE.Vector3(9, 60, 34), aim = new THREE.Vector3(0, 48, -6), top = new THREE.Vector3(0, 66, -12);
  for (const [fov, aspect] of [[50, 16 / 9], [50, 9 / 19.5], [65, 4 / 3]]) {
    const a = aimToFrame(cam, aim, top, fov, aspect, 0.08), c = new THREE.PerspectiveCamera(fov, aspect, 0.1, 500);
    c.position.copy(cam); c.lookAt(a); c.updateMatrixWorld(); c.updateProjectionMatrix();
    const y = top.clone().project(c).y;
    assert.ok(y <= 1 - 2 * 0.08 + 1e-3, `fov ${fov}, aspect ${aspect.toFixed(2)}: the top stands at ${y.toFixed(3)} of the half picture`);
    assert.ok(a.x === aim.x && a.z === aim.z && a.y >= aim.y, "only the height of the aim is raised");
  }
  const low = new THREE.Vector3(0, 50, -12);
  assert.ok(aimToFrame(cam, aim, low, 50, 16 / 9, 0.08).y === aim.y, "a top already well inside the picture moves nothing");
});

test("the closing shot keeps the ridge's end ornaments clear too, the one nearer the eye included", async () => {
  // A longer eave lengthens the ridge, and the ornament at its near end stands higher in the picture than its middle:
  // with the top storey 2.4 m out under a 3.2 m eave, framing the middle alone left 7.5% of a wide picture over it.
  const { aimToFrame } = await import("../../app/src/rites.js");
  const tall = site.walk.roofs.filter((r) => Math.hypot((r.x0 + r.x1) / 2 - site.lofts.lingxiao.at[0], (r.z0 + r.z1) / 2 - site.lofts.lingxiao.at[1]) < 2).sort((p, q) => q.top - p.top)[0];
  assert.ok(tall && tall.crest && tall.crest.length === 2, "the pavilion's top roof does not record the tips of its end ornaments");
  for (const [x, y, z] of tall.crest) assert.ok(y > tall.top - 0.3 && Math.abs(z - (tall.z0 + tall.z1) / 2) < 0.01 && Math.abs(x - (tall.x0 + tall.x1) / 2) > 2, `an ornament tip at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
  const tops = tall.crest.map(([x, y, z]) => new THREE.Vector3(x, y, z)), cx = (tall.x0 + tall.x1) / 2, cz = (tall.z0 + tall.z1) / 2;
  const cam = new THREE.Vector3(cx + 9, tall.top - 12, cz + 40), aim = new THREE.Vector3(cx, tall.top - 18, cz);
  for (const [fov, aspect] of [[50, 16 / 9], [50, 9 / 19.5], [65, 4 / 3]]) {
    const a = aimToFrame(cam, aim, tops, fov, aspect, 0.08), c = new THREE.PerspectiveCamera(fov, aspect, 0.1, 500);
    c.position.copy(cam); c.lookAt(a); c.updateMatrixWorld(); c.updateProjectionMatrix();
    for (const t of tops) assert.ok(t.clone().project(c).y <= 1 - 2 * 0.08 + 1e-3, `fov ${fov}, aspect ${aspect.toFixed(2)}: an ornament at ${t.clone().project(c).y.toFixed(3)}`);
  }
});
