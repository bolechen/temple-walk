// The eye that goes to a place's own shot while an observance is made (src/director.js), and comes back. Built on the
// real plan and the real rooms: every shot stands clear of walls, eaves and columns; he and what his hands are at stay
// inside the picture's safe area (NDC drawn in by a tenth) from first to last; the swing there and back turns the eye
// no faster than the following eye's own limits allow (follow.test.mjs) and never passes through anything; and where it
// would, it goes another way round, more slowly if it must; only for a visitor who asks for less motion is the ink drawn.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker } from "../../app/src/site.js";
import { buildInteriors } from "../../app/src/interior.js";
import { followEye } from "../../app/src/eye.js";
import { DIRECT, shotPose, blendPose, planSwing, planSteps, createDirector, placePoint, turnBetween, durations, veilAt, veilShut, veilDone, pose, smoother } from "../../app/src/director.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls), walker = createWalker(site);
site.places.incense = rooms.places.incense; site.places["incense-yaoshi"] = rooms.places["incense-yaoshi"]; site.places["incense-guanyin"] = rooms.places["incense-guanyin"];
site.places["main-box"] = rooms.spots["main-box"];   // the 功德箱 is a spot before a thing, not a seal's place, and has a shot of its own (#202)
const IDS = ["bell", "incense", "incense-yaoshi", "incense-guanyin", "tea", "sutra", "well", "lamp", "sit", "main-box"];
// The places the eye is gone to now: the well's shot is kept in the data but not gone to until #99 (its niche is unlit).
const GONE = IDS.filter((id) => !site.places[id].shot?.off);
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
// The fastest the picture may turn on a swing: DIRECT.rate (144° a second at the steepest going there, 2.4° a frame;
// 190° coming back, 3.2°), plus the most a shot drifts; and it travels no faster than DIRECT.speed (0.25 m a frame).
const TURN = THREE.MathUtils.radToDeg(DIRECT.rate.in) * DT + 0.05, TURN_BACK = THREE.MathUtils.radToDeg(DIRECT.rate.out) * DT + 0.05;
const MOVE = DIRECT.speed * DT + 0.01;

// What a slow frame does to a swing (#233): the picture turns at the swing's own rate, so a frame that took longer turns it
// further, not faster. The night run saw 3.75° in one frame on a loaded machine; the same swing turns about 28° a second.
// A test that bounds the turn of one frame therefore measures the machine; `rateMax` is the picture's own speed.
test("a slow frame turns the picture further but not faster: the way home is held to a rate, not to a turn a frame", () => {
  const id = "bell", p = site.places[id], foot = at(p), centre = centreOf(p, foot), got = {};
  for (const dt of [DT, 0.135]) {
    const cam = follower(p, foot, 0), d = createDirector({ walker, veil: () => {} });
    const go = (secs) => { const base = { p: cam.position.clone(), q: cam.quaternion.clone() }; for (let i = 0; i < Math.ceil(secs / dt); i++) { cam.position.copy(base.p); cam.quaternion.copy(base.q); d.apply(cam, dt, centre, 50); } };
    assert.ok(d.go(id, p, foot));
    let n = 0; do { go(dt); n++; } while (d.state().planning && n < 600);
    go(d.state().in + 0.5); assert.equal(d.state().phase, "hold");
    const before = d.state().turnMax;   // (what the way there turned is not the question: reset the way home's own record)
    d.back(); n = 0; do { go(dt); n++; } while (d.state().planning && n < 600);
    go(d.state().out + 0.5); assert.equal(d.state().phase, "idle");
    got[dt] = { ...d.state(), before };
  }
  const fast = got[DT], slow = got[0.135];
  assert.equal(fast.cuts, 0); assert.equal(slow.cuts, 0);
  const limit = THREE.MathUtils.radToDeg(DIRECT.rate.out) + 0.5;
  assert.ok(fast.rateMax > 5 && fast.rateMax <= limit && slow.rateMax <= limit, `the way home turned at ${fast.rateMax} and ${slow.rateMax} °/s, over ${limit}`);
  assert.ok(slow.turnMax > 2 * fast.turnMax, `a frame of 135 ms should turn the picture further (${slow.turnMax}° against ${fast.turnMax}°), or this test says nothing about the machine`);
});

// Inside something by more than a graze: in it at the point and 3 cm to every side. (A swing sampled every 4 cm may
// brush the edge of the padding drawn round a low thing, 38 cm out from a lamp table and 5.5 m up, by less than that.)
const deep = (v, foot) => [[0, 0], [0.03, 0], [-0.03, 0], [0, 0.03], [0, -0.03]].every(([dx, dz]) => walker.eyeShut(v.x + dx, v.y, v.z + dz, foot) === true);
// Nearer a column, a stool, a tea table or a railing than the near edge of the lens (a tenth of a metre) can stand off:
// the following eye lets a column cross the view, but an eye on a swing of its own goes round.
const grazes = (v, foot) => walker.eyeShut(v.x, v.y, v.z, foot) === "post" || walker.railNear(v.x, v.y, v.z, 0.1);
// Run frames until the swing's way is worked out (the eye waits where it is meanwhile); how many it took.
function planned(d, cam, centre, check) { let n = 0; do { run(d, cam, centre, 1, check); n++; } while (d.state().planning && n < 600); return n; }

// Every swing is made, never cut (the owner, 2026-11-16: 「打卡时用动画，不要硬切转场」): from twelve directions round each
// place, there and back, the picture never jumps, never turns or travels faster than the limits, never passes through
// anything, and the ink is never drawn. A route may go the long way round, over what stands between, or in by his
// shoulder; it only takes longer.
test("every swing there and back is made, never cut: within the turn and speed limits, and never through anything", () => {
  const routes = new Set();
  for (const id of GONE) {
    const p = site.places[id], foot = at(p), centre = centreOf(p, foot);
    for (let k = 0; k < 12; k++) {
      const yaw = (k / 12) * Math.PI * 2, cam = follower(p, foot, yaw), start = cam.position.clone();
      let veil = 0, last = null, lastQ = null;
      const d = createDirector({ walker, veil: (v) => { veil = Math.max(veil, v); } });
      assert.ok(d.go(id, p, foot));
      const check = (i, c) => {
        if (last) {
          const turn = THREE.MathUtils.radToDeg(turnBetween(lastQ, c.quaternion)), move = c.position.distanceTo(last), lim = d.state().phase === "out" ? TURN_BACK : TURN;
          assert.ok(turn <= lim && move <= MOVE, `${id} from yaw ${k * 30}°: the picture moved ${turn.toFixed(2)}° / ${move.toFixed(3)} m in a frame (${JSON.stringify(d.state().route)})`);
        }
        // (Beyond where the following eye stood, the planner's DIRECT.near and 5 cm more, so that the planner is the
        // stricter of the two; and short of the shot itself.)
        if (d.state().w > 0 && d.state().w < 0.95 && c.position.distanceTo(start) > DIRECT.near + 0.05) {
          assert.ok(!deep(c.position, foot), `${id} from yaw ${k * 30}°: the swing passed through something at ${c.position.toArray().map((v) => v.toFixed(2))} (${JSON.stringify(d.state().route)})`);
          assert.ok(!grazes(c.position, foot), `${id} from yaw ${k * 30}°: the swing passed through a column, a stool, a tea table or by a railing at ${c.position.toArray().map((v) => v.toFixed(2))} (${JSON.stringify(d.state().route)})`);
        }
        last = c.position.clone(); lastQ = c.quaternion.clone();
      };
      const waited = planned(d, cam, centre, check), planned_ = d.state().in;   // the first frames work out the route and how long it takes
      assert.ok(waited < 600, `${id} from yaw ${k * 30}°: the way was never worked out`);
      assert.equal(d.state().w, 0, `${id} from yaw ${k * 30}°: the eye moved before its way was known`);
      assert.ok(planned_ <= 6, `${id} from yaw ${k * 30}°: a swing of ${planned_.toFixed(1)} s is too slow`);
      run(d, cam, centre, Math.ceil((planned_ + 0.2) / DT), check);
      const st = d.state(); assert.equal(st.phase, "hold", `${id} from yaw ${k * 30}°: not on the shot after ${planned_.toFixed(1)} s`);
      assert.ok(!st.blocked, `${id} from yaw ${k * 30}°: no clear route round him was found`);
      routes.add(JSON.stringify(st.route));
      d.back(); planned(d, cam, centre, check); const home = d.state().out;
      assert.ok(home <= 6, `${id} from yaw ${k * 30}°: a way back of ${home.toFixed(1)} s is too slow`);
      run(d, cam, centre, Math.ceil((home + 0.2) / DT), check);
      assert.equal(d.state().phase, "idle", `${id} from yaw ${k * 30}°: not back with him`);
      assert.equal(d.state().cuts, 0, `${id} from yaw ${k * 30}°: a swing was cut`); assert.equal(veil, 0, "the ink was drawn");
    }
  }
  walker.setRoom(null);
  assert.ok(routes.size > 1, "every swing went the same way: the other routes are never exercised");
});

test("the route: the short way when it is clear and slower when it turns far, round, over or past him when it is not; the ink only for reduced motion", () => {
  const C = new THREE.Vector3(0, 1, 0), a = pose(), b = pose();
  a.p.set(0, 1.5, 4); a.q.setFromRotationMatrix(new THREE.Matrix4().lookAt(a.p, C, new THREE.Vector3(0, 1, 0)));
  b.p.set(4, 1.5, 0); b.q.setFromRotationMatrix(new THREE.Matrix4().lookAt(b.p, C, new THREE.Vector3(0, 1, 0)));
  const open = { eyeShut: () => null, landAt: () => 0 };
  let plan = planSwing(open, a, b, C, 0, { base: 2 });
  assert.deepEqual(plan.route, {}, "a quarter turn round him in the open is swung the short way"); assert.equal(plan.secs, 2);
  const behind = pose(); behind.p.set(0, 1.5, -4); behind.q.setFromRotationMatrix(new THREE.Matrix4().lookAt(behind.p, C, new THREE.Vector3(0, 1, 0)));
  plan = planSwing(open, a, behind, C, 0, { base: 1.6 });
  assert.ok(plan.secs > 1.6, `half way round him the swing should take longer than its shortest (${plan.secs.toFixed(2)} s)`);
  const wall = { eyeShut: (x, y, z) => (x > 1.5 && z > 1.5 && y < 3 ? true : null), landAt: () => 0 };
  plan = planSwing(wall, a, b, C, 0, { base: 2 });
  assert.ok(plan.route.long || plan.route.lift || plan.route.pinch, "an arc through a wall should go another way: " + JSON.stringify(plan.route));
  assert.ok(!plan.blocked);
  const post = { eyeShut: (x, y, z) => (x > 1.5 && z > 1.5 ? "post" : null), landAt: () => 0 };
  assert.notDeepEqual(planSwing(post, a, b, C, 0).route, {}, "a column across the short way is gone round: the following eye lets one cross the view, a swing of its own does not");
  const shut = { eyeShut: () => true, landAt: () => 0 };
  assert.ok(planSwing(shut, a, b, C, 0).blocked, "with nothing clear the plan says so, and still swings");
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

// The dragon well is watched from where the eye follows him: its shot shows a black niche until the niche is lit and
// rebuilt (#76), so it is kept in the data, marked `off`, and not gone to. When #99 brings it back, this test changes
// to expect the shot like the others.
test("the well is not gone to: the eye stays with him there (until #99)", () => {
  const p = site.places.well; assert.ok(p.shot && p.shot.off === "#99", "the well's shot should be kept, marked off for #99");
  const d = createDirector({ walker }); assert.equal(d.go("well", p, at(p)), false, "the eye should not go to the well's shot");
  assert.equal(d.state().phase, "idle");
  assert.deepEqual(GONE, ["bell", "incense", "incense-yaoshi", "incense-guanyin", "tea", "sutra", "lamp", "sit", "main-box"]);
  walker.setRoom(null);
});

// When an observance is over before its swing has arrived (a swing round to a shot before him can take longer than the
// lamp), the swing goes on to the shot, rests there a beat and only then comes home; it is never turned back half way
// by the observance. A step of the visitor's still turns it back at once.
test("an observance over before its swing has arrived lets it arrive, rest a beat, and come home; a step turns it at once", () => {
  const p = site.places.lamp, foot = at(p), centre = centreOf(p, foot);
  const d = createDirector({ walker }), cam = follower(p, foot, Math.PI - p.face);
  d.go("lamp", p, foot); run(d, cam, centre, 20); const w0 = d.state().w;
  assert.ok(d.state().phase === "in" && w0 > 0 && w0 < 1, "should still be on its way in");
  d.back({ soft: true }); const ws = [];
  run(d, cam, centre, Math.ceil((d.state().in + DIRECT.beat + 0.3) / DT), () => ws.push([d.state().phase, d.state().w]));
  assert.ok(ws.some(([ph]) => ph === "hold"), "it should arrive on the shot"); assert.ok(ws.findIndex(([ph]) => ph === "out") > ws.findIndex(([ph]) => ph === "hold"), "and come home only after it");
  const holds = ws.filter(([ph]) => ph === "hold").length; assert.ok(holds >= Math.floor(DIRECT.beat / DT) - 1, `it should rest about ${DIRECT.beat} s (${holds} frames)`);
  assert.ok(ws.slice(0, ws.findIndex(([ph]) => ph === "hold")).every(([, w], i, a) => i === 0 || w >= a[i - 1][1] - 1e-9), "on its way in it never turned back");
  const e = createDirector({ walker }); e.go("lamp", p, foot); run(e, cam, centre, 20); const we = e.state().w;
  e.back(); run(e, cam, centre, 1); assert.ok(e.state().phase === "out" && e.state().w <= we, "a step should turn it back at once");
  walker.setRoom(null);
});

// The way is worked out a little at a time, so that the frame an observance begins on is not held up: from twelve
// directions round each place, there and back, the planner never asks the walker about more than a bounded number of
// points before it pauses to look at the clock (DIRECT.step, and what one step of the search or one point of a route
// asks beyond it).
test("a swing's way is worked out a little at a time: the planner pauses after a bounded amount of work", () => {
  let n = 0, most = 0, total = 0;
  const counting = Object.create(walker); counting.eyeShut = (...a) => { n++; return walker.eyeShut(...a); };
  for (const id of GONE) {
    const p = site.places[id], foot = at(p), centre = centreOf(p, foot), B = shotPose(p, p.shot, foot, 0);
    for (let k = 0; k < 12; k++) {
      const cam = follower(p, foot, (k / 12) * Math.PI * 2), A = pose(); A.p.copy(cam.position); A.q.copy(cam.quaternion);
      for (const opts of [{ base: p.shot.in }, { base: p.shot.out, rate: DIRECT.rate.out }]) {
        const it = planSteps(counting, A, B, centre, foot, opts);
        for (let r = (n = 0, it.next()); ; r = (n = 0, it.next())) { most = Math.max(most, n); total++; if (r.done) break; }
      }
    }
  }
  walker.setRoom(null);
  assert.ok(most <= DIRECT.step + 700, `the planner asked about ${most} points without pausing`);
  assert.ok(total > GONE.length * 24, "the planner never paused");
});

// The far view at the close of the chapter (#147): the eye stays where the close left it, on a shot made from that very pose,
// so that handing it to the director moves nothing, it drifts no faster than any shot may, and coming home is the usual swing.
test("a shot made from the eye's own pose is that pose on any screen, and drifts within the limits", async () => {
  const { holdShot, shotPose, turnBetween, DIRECT } = await import("../../app/src/director.js");
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.7, 0, "YXZ")), p = new THREE.Vector3(12, 40, 55);
  for (const [fov, aspect] of [[50, 16 / 9], [50, 4 / 3], [50, 9 / 19.5], [65, 9 / 16]]) {
    const { place, shot } = holdShot({ p, q, fov }, aspect), out = shotPose(place, shot, 0, 0, aspect);
    assert.ok(out.p.distanceTo(p) < 1e-3, `aspect ${aspect.toFixed(2)}: the eye moved ${out.p.distanceTo(p)} m`);
    assert.ok(turnBetween(out.q, q) < 0.002, `aspect ${aspect.toFixed(2)}: it turned ${turnBetween(out.q, q)} rad`);
    assert.ok(Math.abs(out.fov - fov) < 0.01, `aspect ${aspect.toFixed(2)}: the angle of view went from ${fov} to ${out.fov}`);
    let prev = out;
    for (let t = 1; t <= 120; t++) {
      const now = shotPose(place, shot, 0, t, aspect, { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50 });
      assert.ok(turnBetween(prev.q, now.q) <= DIRECT.drift + 1e-6, `second ${t}: it turned ${(turnBetween(prev.q, now.q) * 57.3).toFixed(2)}°`);
      assert.ok(prev.p.distanceTo(now.p) <= DIRECT.glide + 1e-6, `second ${t}: it moved ${prev.p.distanceTo(now.p)} m`);
      prev = now;
    }
  }
});
