// The eye that goes to a place's own shot while an observance is made (src/director.js), and comes back. Built on the
// real plan and the real rooms: every shot stands clear of walls, eaves and columns; he and what his hands are at stay
// inside the picture's safe area (NDC drawn in by a tenth) from first to last; the swing there and back turns the eye
// no faster than the following eye's own limits allow (follow.test.mjs) and never passes through anything; and where it
// would (a wall, a turn of more than about 120°, or a visitor who asks for less motion), the ink is drawn first.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker } from "../../app/src/site.js";
import { buildInteriors } from "../../app/src/interior.js";
import { followEye } from "../../app/src/eye.js";
import { DIRECT, shotPose, blendPose, needsCut, createDirector, placePoint, turnBetween, durations, veilAt, veilShut, veilDone, pose, smoother } from "../../app/src/director.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls), walker = createWalker(site);
site.places.incense = rooms.places.incense;
const IDS = ["bell", "incense", "tea", "sutra", "well", "lamp", "sit"];
const DT = 1 / 60, SAFE = 0.9;
// Stand the walker where a place is: in its hall's room if it has one, out of doors otherwise.
const at = (p) => { walker.setRoom(p.room ? rooms.rooms[p.room].room : null); return p.y ?? walker.heightAt(p.at[0], p.at[1]); };
// The eye that follows him as yard.js places it, he standing at the place and the view looking `yaw`.
function follower(p, foot, yaw) {
  const e = followEye(walker, { x: p.at[0], z: p.at[1], foot, eyeY: walker.eyeAt(p.at[0], p.at[1]), yaw, pitch: 0.04, side: 1.2, reach: 6.2 });
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 500); cam.position.fromArray(e.at(e.d)); cam.rotation.set(0.04, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
  return cam;
}
const centreOf = (p, foot) => new THREE.Vector3(p.at[0], foot + 0.85, p.at[1]);

test("every observance has a shot, and the shots and their views are all there", () => {
  for (const id of IDS) {
    const s = site.places[id].shot; assert.ok(s, `${id}: no shot in its place's data`);
    for (const k of ["at", "look", "keep"]) assert.ok(Array.isArray(s[k]), `${id}: shot.${k}`);
    const d = durations(s); assert.ok(d.in >= 1.6 && d.in <= 2.4 && d.out >= 0.8 && d.out <= 1.2, `${id}: in ${d.in} s, out ${d.out} s`);
    assert.equal(d.in, s.in, `${id}: shot.in is outside 1.6–2.4 s`); assert.equal(d.out, s.out, `${id}: shot.out is outside 0.8–1.2 s`);
    if (!site.places[id].room) assert.ok(site.views[`shot-${id}`], `${id}: no shot-${id} view`);
  }
  assert.ok(rooms.places.incense.room, "the incense is offered in a hall: its shot is the room's data");
});

test("no shot stands in a wall, under an eave, in a column or in the ground, from its first moment to the end of its drift", () => {
  for (const id of IDS) {
    const p = site.places[id], foot = at(p), s = p.shot;
    for (const t of [0, (s.drift?.for ?? 20) / 2, s.drift?.for ?? 20]) {
      const o = shotPose(p, s, foot, t);
      assert.ok(!walker.eyeShut(o.p.x, o.p.y, o.p.z, foot), `${id} at ${t} s: the eye is inside something at ${o.p.toArray().map((v) => v.toFixed(2))}`);
      assert.ok(o.p.y > walker.landAt(o.p.x, o.p.z) + 0.15, `${id} at ${t} s: the eye is at the ground`);
    }
  }
  walker.setRoom(null);
});

test("he and what his hands are at stay inside the safe area, on a wide screen, a laptop's and a phone held either way", () => {
  for (const id of IDS) {
    const p = site.places[id], foot = at(p), s = p.shot;
    for (const aspect of [16 / 9, 4 / 3, 9 / 16, 19.5 / 9]) for (const t of [0, s.drift?.for ?? 20]) {
      const o = shotPose(p, s, foot, t, aspect), cam = new THREE.PerspectiveCamera(o.fov, aspect, 0.05, 500);
      cam.position.copy(o.p); cam.quaternion.copy(o.q); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      for (const k of s.keep) {
        const w = placePoint(p, foot, k), v = w.clone().project(cam), ahead = w.clone().applyMatrix4(cam.matrixWorldInverse).z < 0;
        assert.ok(ahead && Math.abs(v.x) <= SAFE && Math.abs(v.y) <= SAFE, `${id} (${aspect.toFixed(2)}, ${t} s): [${k}] falls at (${v.x.toFixed(2)}, ${v.y.toFixed(2)}), outside the safe area`);
      }
    }
  }
  walker.setRoom(null);
});

test("resting on a shot, the eye turns of itself no more than a degree a second", () => {
  for (const id of IDS) {
    const p = site.places[id], foot = at(p), s = p.shot;
    let prev = shotPose(p, s, foot, 0), prevP = prev.p.clone();
    for (let t = 0.5; t <= (s.drift?.for ?? 20) + 1; t += 0.5) {
      const o = shotPose(p, s, foot, t);
      assert.ok(THREE.MathUtils.radToDeg(turnBetween(prev.q, o.q)) <= 0.5 + 1e-6, `${id}: turned faster than 1°/s at ${t} s`);
      assert.ok(o.p.distanceTo(prevP) <= DIRECT.glide * 0.5 + 1e-6, `${id}: glided faster than ${DIRECT.glide} m/s at ${t} s`);
      prev = o; prevP = o.p.clone();
    }
  }
  walker.setRoom(null);
});

// Run the director at sixty frames a second against a camera that stays where the following eye put it.
function run(director, cam, centre, frames, onFrame = () => {}) {
  const base = { p: cam.position.clone(), q: cam.quaternion.clone() };
  for (let i = 0; i < frames; i++) {
    cam.position.copy(base.p); cam.quaternion.copy(base.q);
    director.apply(cam, DT, centre, 50); onFrame(i, cam);
  }
  cam.position.copy(base.p); cam.quaternion.copy(base.q);
}
// The fastest the picture may turn on a swing: the largest turn made over the shortest swing, at smootherstep's
// steepest (1.875 times the mean), plus the most a shot drifts. 120° over 1.6 s is 2.3° a frame.
// Coming back it may be quicker: the full 120° over 1.2 s, 3.1° a frame.
const TURN = THREE.MathUtils.radToDeg(DIRECT.turn) * 1.875 / DIRECT.in[0] * DT + 0.05, TURN_BACK = THREE.MathUtils.radToDeg(DIRECT.turn) * 1.875 / DIRECT.out[1] * DT + 0.05;
const MOVE = DIRECT.speed * DT + 0.01;   // metres a frame (0.25): the swing travels no faster than DIRECT.speed

test("the swing there and back turns the eye no faster than the limit, goes round him and never through anything; otherwise the ink is drawn", () => {
  let cuts = 0, blends = 0;
  for (const id of IDS) {
    const p = site.places[id], foot = at(p), centre = centreOf(p, foot);
    for (let k = 0; k < 12; k++) {
      const yaw = (k / 12) * Math.PI * 2, cam = follower(p, foot, yaw), base = { p: cam.position.clone(), q: cam.quaternion.clone() };
      let veil = 0, last = null, lastQ = null, jumps = 0;
      const d = createDirector({ walker, veil: (v) => { veil = v; } });
      assert.ok(d.go(id, p, foot));
      const check = (i, c) => {
        if (last) {
          const turn = THREE.MathUtils.radToDeg(turnBetween(lastQ, c.quaternion)), move = c.position.distanceTo(last);
          if (turn > (d.state().phase === "out" ? TURN_BACK : TURN) || move > MOVE) { jumps++; assert.ok(veil >= 0.999, `${id} from yaw ${k * 30}°: the picture jumped ${turn.toFixed(1)}° / ${move.toFixed(2)} m with the ink at ${veil.toFixed(2)}`); }
        }
        if (!d.state().cut && d.state().w > 0) {
          assert.ok(walker.eyeShut(c.position.x, c.position.y, c.position.z, foot) !== true, `${id} from yaw ${k * 30}°: the swing passed through something at ${c.position.toArray().map((v) => v.toFixed(2))}`);
          const r = Math.hypot(c.position.x - centre.x, c.position.z - centre.z), ra = Math.hypot(base.p.x - centre.x, base.p.z - centre.z), rb = Math.hypot(shotPose(p, p.shot, foot).p.x - centre.x, shotPose(p, p.shot, foot).p.z - centre.z);
          // (the shot itself may drift nearer while it is swung to: by at most DIRECT.glide a second)
          if (Math.min(ra, rb) >= 0.35) assert.ok(r >= Math.min(ra, rb) - 0.05 - DIRECT.glide * d.state().t, `${id} from yaw ${k * 30}°: the swing came nearer him (${r.toFixed(2)} m) than either end`);
        }
        last = c.position.clone(); lastQ = c.quaternion.clone();
      };
      run(d, cam, centre, Math.ceil(2.6 / DT), check);
      const st = d.state(); assert.equal(st.phase, "hold", `${id} from yaw ${k * 30}°: not on the shot after 2.6 s`);
      if (st.cuts) cuts++; else blends++;
      d.back(); run(d, cam, centre, Math.ceil(1.6 / DT), check);
      assert.equal(d.state().phase, "idle", `${id} from yaw ${k * 30}°: not back with him after 1.6 s`);
      assert.ok(jumps <= 2 * st.cuts + 2 * (d.state().cuts - st.cuts), `${id}: more jumps than cuts`);
    }
  }
  walker.setRoom(null);
  assert.ok(blends > 20, `only ${blends} swings were made: the shots should mostly be reached by swinging`);
  assert.ok(cuts > 0, "no swing needed the ink: the fallback is never exercised");
});

test("the ink: from straight behind him to a shot before him is too far a turn, through a wall is closed, and reduced motion always", () => {
  const C = new THREE.Vector3(0, 1, 0), a = pose(), b = pose();
  a.p.set(0, 1.5, 4); a.q.setFromEuler(new THREE.Euler(0, 0, 0)); b.p.set(0, 1.5, -4); b.q.setFromEuler(new THREE.Euler(0, Math.PI, 0));
  const open = { eyeShut: () => null, landAt: () => 0 };
  assert.equal(needsCut(open, a, b, C, 0), "turn");
  b.p.set(4, 1.5, 0); b.q.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  assert.equal(needsCut(open, a, b, C, 0), null, "a quarter turn round him is swung");
  const wall = { eyeShut: (x, y, z) => (x > 2 && z > 2 ? true : null), landAt: () => 0 };
  assert.equal(needsCut(wall, a, b, C, 0), "solid", "an arc through a wall is cut");
  const post = { eyeShut: (x, y, z) => (x > 2 && z > 2 ? "post" : null), landAt: () => 0 };
  assert.equal(needsCut(post, a, b, C, 0), null, "a column passing across is let through, as the following eye lets it");
  const ground = { eyeShut: () => null, landAt: () => 3 };
  assert.equal(needsCut(ground, a, b, C, 0), "solid", "an arc under the ground is cut");
  assert.equal(needsCut(open, a, b, C, 0, 0.3), "far", "an arc too long for its time is cut");
  // With reduced motion, the director moves the eye only behind the ink, and the ink does not draw itself across.
  const p = site.places.lamp, foot = at(p), cam = follower(p, foot, 0.8), seen = [];
  const d = createDirector({ walker, reduced: () => true, veil: (v) => seen.push(v) });
  d.go("lamp", p, foot); let moved = null;
  run(d, cam, centreOf(p, foot), 60, (i, c) => { if (moved === null && d.state().w > 0) moved = d.state(); });
  assert.ok(moved && moved.w === 1 && moved.cut, "with reduced motion the eye should go to the shot at once, behind the ink");
  assert.equal(d.state().why, "reduced");
  walker.setRoom(null);
});

test("the ink closes, holds while the eye is moved, and opens; sent back while it is closing, nothing moves", () => {
  assert.equal(veilAt(0), 0); assert.equal(veilAt(veilShut()), 1); assert.ok(veilAt(veilDone()) === 0);
  for (let s = 0; s < veilDone(); s += 0.01) assert.ok(veilAt(s) >= 0 && veilAt(s) <= 1);
  const p = site.places.lamp, foot = at(p), cam = follower(p, foot, Math.PI - p.face + Math.PI), centre = centreOf(p, foot);   // from in front of him: the shot is behind the eye
  const d = createDirector({ walker, reduced: () => true });
  d.go("lamp", p, foot); run(d, cam, centre, 3); d.back();
  let w = 0; run(d, cam, centre, 60, () => { w = Math.max(w, d.state().w); });
  assert.equal(w, 0, "the eye moved although the visitor walked on before the ink had closed");
  assert.equal(d.state().phase, "idle");
  walker.setRoom(null);
});

test("turned off, it does nothing; sent back half way, it comes back from where it is; let go, it is gone at once", () => {
  const p = site.places.sutra, foot = at(p), cam = follower(p, foot, Math.PI - p.face + 0.9), centre = centreOf(p, foot);
  assert.equal(createDirector({ walker, enabled: () => false }).go("sutra", p, foot), false);
  const d = createDirector({ walker });
  d.go("sutra", p, foot); run(d, cam, centre, Math.round(0.8 / DT));
  const half = d.state().w; assert.ok(half > 0.1 && half < 0.9, `half way should be part way: ${half}`);
  d.back(); const st = []; run(d, cam, centre, Math.round(1.3 / DT), () => st.push(d.state().w));
  assert.ok(st[0] <= half + 1e-6 && st.every((w, i) => i === 0 || w <= st[i - 1] + 1e-9), "coming back should only ever go back");
  assert.equal(d.state().phase, "idle");
  d.go("sutra", p, foot, { now: true }); assert.equal(d.state().phase, "hold"); d.drop(); assert.equal(d.state().phase, "idle");
  assert.equal(smoother(0), 0); assert.equal(smoother(1), 1); assert.equal(smoother(0.5), 0.5);
  walker.setRoom(null);
});

test("a swing round him from behind his shoulder never comes nearer than it started", () => {
  const C = new THREE.Vector3(0, 1, 0), a = pose(), b = pose(), o = pose();
  a.p.set(1, 2, 5); b.p.set(4, 1, -1); a.q.identity(); b.q.identity();
  for (let w = 0; w <= 1; w += 0.05) { blendPose(a, b, w, C, o); assert.ok(Math.hypot(o.p.x, o.p.z) >= Math.min(Math.hypot(1, 5), Math.hypot(4, 1)) - 1e-6); }
});
