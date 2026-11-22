// The opening after 入山 (issue #110): the eye starts on the summit in the mist, comes down the mountain over the roofs
// and the bamboo, and settles behind him where the eye that follows him stands, before the walk is his. Built on the
// real plan: every point of the way stands clear of walls, eaves, columns and the ground; it never turns or moves
// faster in a frame than a swing of the director's may (director.test.mjs); it ends on the following eye to the
// centimetre and the degree, so that the frame the walk is handed back on does not jump; and a visitor who will not
// wait is brought down the rest of the same way in about a second, never cut. Who sees it is decided here too.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker, SCREEN, GROVE, terrain } from "../../app/src/site.js";
import { followEye } from "../../app/src/eye.js";
import { DIRECT, turnBetween, inWay } from "../../app/src/director.js";
import { OPENING, openingFor, openingPlan, createOpening, atGate, SILENT } from "../../app/src/opening.js";
const level = (await import("../../app/levels/t00/level.js")).default;

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site);
const DT = 1 / 60, deg = THREE.MathUtils.radToDeg;

// The eye that follows him at the start of the path, as yard.js has it before he takes a step (pitch 0.04 from behind).
function follower() {
  const [x, z, yaw] = site.start, foot = walker.heightAt(x, z);
  const e = followEye(walker, { x, z, foot, eyeY: walker.eyeAt(x, z), yaw, pitch: 0.04, side: 1.2, reach: 6.2 });
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 2000); cam.position.fromArray(e.at(e.d)); cam.rotation.set(0.04, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
  return { p: cam.position.clone(), q: cam.quaternion.clone(), fov: 50 };
}
const A = follower(), plan = openingPlan(A);

test("who sees the opening: a first visit only, again after 从头走起, never a test or tool that names its own place", () => {
  const start = site.start, none = new URLSearchParams("");
  assert.deepEqual(openingFor({ seals: 0, place: null, start, params: none }), { eye: "fly", bell: true });
  assert.equal(openingFor({ seals: 1, place: null, start, params: none }).eye, "none", "a visitor with a seal goes on (接着走)");
  assert.equal(openingFor({ seals: 1, place: null, start, params: none }).bell, false);
  assert.equal(openingFor({ seals: 0, place: { x: 0, z: 20 }, start, params: none }).eye, "none", "a visitor who left up the mountain goes on");
  assert.equal(openingFor({ seals: 0, place: { x: start[0] + 1, z: start[1] }, start, params: none }).eye, "fly", "a place kept at the foot of the path is no progress");
  assert.deepEqual(openingFor({ seals: 3, place: { x: 0, z: 20 }, start, params: none, again: true }), { eye: "fly", bell: true }, "从头走起 plays it again");
  for (const k of SILENT) assert.deepEqual(openingFor({ seals: 0, place: null, start, params: new URLSearchParams(`${k}=1`) }), { eye: "none", bell: false }, `?${k}`);
  for (const k of ["cam", "show", "shot", "in", "enter", "tour", "at", "play"]) assert.ok(SILENT.includes(k), `?${k} is among the silent parameters`);
  assert.deepEqual(openingFor({ seals: 0, place: null, start, params: none, autocam: false }), { eye: "none", bell: true }, "自动镜头 off: from behind him at once, the bell as ever");
  assert.deepEqual(openingFor({ seals: 0, place: null, start, params: none, reduced: true }), { eye: "ink", bell: true }, "reduced motion: the ink, the bell as ever");
});

// Every frame of the whole opening at sixty frames a second, from the moment it starts to move.
function frames(play = (t) => plan.poseAt(t)) {
  const out = []; for (let t = 0; t <= plan.secs + 1e-9; t += DT) out.push(play(t)); out.push(play(plan.secs)); return out;
}

test("every point of the way stands clear of walls, eaves, columns, railings and the ground", () => {
  const bad = [];
  for (const o of frames()) {
    const { x, y, z } = o.p, foot = walker.landAt(x, z);
    if (o.p.distanceTo(A.p) <= DIRECT.near) continue;   // where the following eye itself stands, it is let stand
    if (inWay(walker, x, y, z, foot) || y < foot + 0.3) bad.push(o.p.toArray().map((v) => +v.toFixed(2)));
  }
  assert.deepEqual(bad.slice(0, 6), [], `${bad.length} points of the way are inside something`);
});

test("it keeps over the tops of the bamboo, except down the clear way of the path, so that no culm crosses the picture", () => {
  const bad = [];
  for (const o of frames()) {
    const { x, y, z } = o.p; if (Math.hypot(x - A.p.x, z - A.p.z) < 6) continue;   // where the following eye stands among the culms at the start, as ever
    const grows = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => GROVE.grows(x + dx, z + dz));   // (a culm leans, and its leaves reach a metre)
    if (grows && y < terrain(x, z) + GROVE.top + 0.5) bad.push([x, y, z].map((v) => +v.toFixed(1)));
    if (level.eyeKeepOut(x, y, z, 0.25)) bad.push(["in the level's keep-out (#515)", ...[x, y, z].map((v) => +v.toFixed(1))]);   // (the volume the eye from behind him keeps out of, which the way must agree with)
  }
  assert.deepEqual(bad.slice(0, 6), [], `${bad.length} points of the way are down among the bamboo`);
});

test("it never turns or moves faster in a frame than a swing of the director's may", () => {
  const f = frames(); let turn = 0, move = 0;
  for (let k = 1; k < f.length; k++) { turn = Math.max(turn, turnBetween(f[k - 1].q, f[k].q)); move = Math.max(move, f[k - 1].p.distanceTo(f[k].p)); }
  assert.ok(deg(turn) <= deg(DIRECT.rate.in) * DT + 1e-6, `turns ${deg(turn).toFixed(2)}° in a frame`);
  assert.ok(move <= DIRECT.speed * DT + 1e-6, `moves ${move.toFixed(3)} m in a frame`);
  assert.ok(plan.secs >= 10 && plan.secs <= 15, `takes ${plan.secs.toFixed(1)} s to come down`);
});

test("it starts on the summit and ends on the eye that follows him, to the centimetre and the degree", () => {
  const first = plan.poseAt(0), last = plan.poseAt(plan.secs);
  assert.ok(first.p.z < -20 && first.p.y > 10, `starts at ${first.p.toArray().map((v) => v.toFixed(1))}`);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(first.q), summit = new THREE.Vector3(0, 36, site.summitPorch[1] - 7.5).sub(first.p).normalize();
  assert.ok(deg(fwd.angleTo(summit)) < 12, "the summit pavilion is before the eye at the first frame");
  assert.ok(first.fov < 40 && Math.abs(last.fov - A.fov) < 1e-6, `the angle of view goes from ${first.fov}° to ${last.fov}° (the following eye's ${A.fov}°)`);
  for (let t = 0; t < plan.secs; t += DT) { const a = plan.poseAt(t).fov, b = plan.poseAt(t + DT).fov; assert.ok(Math.abs(b - a) <= 0.25, `the lens widens ${(b - a).toFixed(2)}° in a frame at ${t.toFixed(2)} s`); }
  assert.ok(last.p.distanceTo(A.p) < 0.05, `ends ${last.p.distanceTo(A.p).toFixed(3)} m from the following eye`);
  assert.ok(deg(turnBetween(last.q, A.q)) < 1, `ends ${deg(turnBetween(last.q, A.q)).toFixed(2)}° from the following eye`);
});

test("the frame it hands the walk back on does not jump: the director's opening gives way to the following eye", () => {
  let clock = 0; const o = createOpening({ now: () => clock * 1000 }), cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 2000);
  o.start("fly");
  let prev = null, turn = 0, move = 0, done = false;
  for (let k = 0; k < 60 * 30 && !done; k++) {
    clock += DT; cam.position.copy(A.p); cam.quaternion.copy(A.q);
    done = !o.apply(cam, A);
    if (prev) { turn = Math.max(turn, turnBetween(prev.q, cam.quaternion)); move = Math.max(move, prev.p.distanceTo(cam.position)); }
    prev = { p: cam.position.clone(), q: cam.quaternion.clone() };
  }
  assert.ok(done, "the opening ends");
  assert.ok(prev.p.distanceTo(A.p) < 0.05 && deg(turnBetween(prev.q, A.q)) < 1, "the last frame is the following eye");
  assert.ok(deg(turn) <= deg(DIRECT.rate.in) * DT + 1e-6 && move <= DIRECT.speed * DT + 1e-6, `a frame turned ${deg(turn).toFixed(2)}° or moved ${move.toFixed(3)} m`);
  const s = o.state(); assert.equal(s.phase, "done"); assert.ok(s.waited >= OPENING.hold.least * 1000 - 1, "it waits on the first frame before moving");
});

test("it waits for the picture to settle before it moves: slow frames hold it on the first picture, up to a limit", () => {
  let clock = 0; const o = createOpening({ now: () => clock }), cam = new THREE.PerspectiveCamera();
  o.start("fly");
  for (let k = 0; k < 20; k++) { clock += 140; cam.position.copy(A.p); cam.quaternion.copy(A.q); o.apply(cam, A); }   // 140 ms a frame: a cold start
  assert.equal(o.state().phase, "hold", "still waiting while frames take 140 ms");
  for (let k = 0; k < OPENING.hold.frames + 2; k++) { clock += 16; o.apply(cam, A); }
  assert.equal(o.state().phase, "fly", "moves once frames come quickly");
  const p = createOpening({ now: () => clock }); p.start("fly");
  for (let k = 0; k < 60; k++) { clock += 200; p.apply(cam, A); }   // a page that never settles (software rendering)
  assert.equal(p.state().phase, "fly", `moves after at most ${OPENING.hold.most} s`);
});

test("skipped at any moment, it comes down the rest of the same way in 0.8–1.2 s, ending on him, never cut", () => {
  for (const at of [0, 0.5, 2, 5, 8, plan.secs - 1]) {
    let clock = 0; const o = createOpening({ now: () => clock * 1000 }), cam = new THREE.PerspectiveCamera();
    o.start("fly");
    const run = (n) => { for (let k = 0; k < n; k++) { clock += DT; cam.position.copy(A.p); cam.quaternion.copy(A.q); if (!o.apply(cam, A)) return false; } return true; };
    run(Math.round((OPENING.hold.least + at) * 60));
    o.skip();
    const t0 = clock; let prev = { p: cam.position.clone(), q: cam.quaternion.clone() }, turn = 0, gap = 0, going = true, bad = 0;
    while (going) {
      going = run(1);
      turn = Math.max(turn, turnBetween(prev.q, cam.quaternion)); gap = Math.max(gap, prev.p.distanceTo(cam.position));
      const { x, y, z } = cam.position, foot = walker.landAt(x, z);
      if (cam.position.distanceTo(A.p) > DIRECT.near && (inWay(walker, x, y, z, foot) || y < foot + 0.3)) bad++;
      prev = { p: cam.position.clone(), q: cam.quaternion.clone() };
    }
    const took = clock - t0, left = plan.length - plan.sAt(at);
    if (left > 1) assert.ok(took >= OPENING.skip[0] - 0.05 && took <= OPENING.skip[1] + 0.05, `skipped at ${at} s: took ${took.toFixed(2)} s`);
    assert.equal(bad, 0, `skipped at ${at} s: ${bad} frames inside something`);
    assert.ok(cam.position.distanceTo(A.p) < 0.05 && deg(turnBetween(cam.quaternion, A.q)) < 1, `skipped at ${at} s: ends on him`);
    assert.ok(deg(turn) < 8, `skipped at ${at} s: turned ${deg(turn).toFixed(1)}° in one frame`);
    // Quick, but travelled: no frame steps farther than the eased pace over the rest of the way allows (a cut would).
    assert.ok(gap <= (1.6 * left) / took / 60 + 0.05, `skipped at ${at} s: a jump of ${gap.toFixed(2)} m in one frame (a cut)`);
    assert.equal(o.state().cuts, 0);
  }
});

test("with reduced motion it holds the summit, then the ink closes, the eye is moved behind him, and the ink opens", () => {
  let clock = 0, most = 0; const o = createOpening({ now: () => clock * 1000, veil: (k) => { most = Math.max(most, k); } }), cam = new THREE.PerspectiveCamera();
  o.start("ink");
  let n = 0; while (o.apply(cam, A) && n++ < 60 * 20) { clock += DT; cam.position.copy(A.p); cam.quaternion.copy(A.q); }
  assert.equal(most, 1, "the ink shut");
  assert.equal(o.state().cuts, 1);
  assert.ok(cam.position.distanceTo(A.p) < 0.05);
});

test("the prologue's title: once round the screen wall, the gate before him; not walking backwards, not before the wall", () => {
  const gateYaw = (x, z) => Math.atan2(0 - x, z - 40);   // the view's yaw that looks at the gate's middle (yaw 0 looks north, -z)
  assert.ok(atGate({ x: 6.6, z: 53.4, yaw: gateYaw(6.6, 53.4) }), "cam04: the gate once round the wall");
  assert.ok(atGate({ x: -6, z: 52, yaw: gateYaw(-6, 52) }), "round the other side");
  assert.ok(!atGate({ x: 6.6, z: 53.4, yaw: gateYaw(6.6, 53.4) + Math.PI }), "facing away (walked there backwards)");
  assert.ok(!atGate({ x: 0, z: SCREEN.z + 3, yaw: 0 }), "before the screen wall");
  assert.ok(!atGate({ x: 0, z: 30, yaw: 0 }), "already through the gate");
});
