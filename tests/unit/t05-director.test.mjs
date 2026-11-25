// T05's own observances and the eye that goes to their shots (src/director.js): the copy of the stele and the two places where
// the observation's stroke is written (app/levels/t05/stele.js, page.js). The same holds as for the prologue's (director.test.mjs),
// on T05's own plan: every shot stands clear of what is built and of the ground through its drift; he, the leaf and the brush in
// his hands, and the stele's face he reads, stay inside the picture's safe area (NDC drawn in by a tenth) on a wide screen, a
// laptop's and a phone held either way; resting, the eye turns no more than a degree a second; and from twelve directions round
// each place the swing there and back is made, never cut, within the turn and speed limits, and through nothing.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker } from "../../app/levels/t05/site.js";
import { PAGE } from "../../app/levels/t05/page.js";
import { followEye } from "../../app/src/eye.js";
import { DIRECT, shotPose, createDirector, placePoint, turnBetween, durations, planSwing, blendPose, pose } from "../../app/src/director.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site);
for (const [k, p] of Object.entries(PAGE.places)) site.places[k] ??= { ...p, r: 0 };   // as src/levelpage.js adds them
const IDS = ["copy", ...Object.keys(PAGE.places)];
const DT = 1 / 60, SAFE = 0.9;
const at = (p) => walker.heightAt(p.at[0], p.at[1]);
function follower(p, foot, yaw) {
  const e = followEye(walker, { x: p.at[0], z: p.at[1], foot, eyeY: walker.eyeAt(p.at[0], p.at[1]), yaw, pitch: 0.04, side: 1.2, reach: 6.2 });
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 500); cam.position.fromArray(e.at(e.d)); cam.rotation.set(0.04, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
  return cam;
}
const centreOf = (p, foot) => new THREE.Vector3(p.at[0], foot + 0.85, p.at[1]);

test("every one of T05's observances has a shot and a view, and stands where he can stand", () => {
  for (const id of IDS) {
    const p = site.places[id], s = p.shot; assert.ok(s, `${id}: no shot`);
    for (const k of ["at", "look", "keep"]) assert.ok(Array.isArray(s[k]), `${id}: shot.${k}`);
    const d = durations(s); assert.equal(d.in, s.in, `${id}: shot.in outside 1.6–2.4 s`); assert.equal(d.out, s.out, `${id}: shot.out outside 0.8–1.2 s`);
    assert.ok(site.views[`shot-${id}`], `${id}: no shot-${id} view`);
    assert.ok(!walker.blocked(p.at[0], p.at[1]), `${id}: he cannot stand at ${p.at}`);
  }
  assert.ok(site.places.copy.stele && site.places.copy.act === "抄碑" && site.places.copy.r > 0.5, "the stele's place is offered with E");
  for (const id of Object.keys(PAGE.places)) assert.equal(site.places[id].r, 0, `${id}: the observation's place is offered only once its looks are met, never by standing there`);
});

test("no shot stands in anything or at the ground, from its first moment to the end of its drift", () => {
  for (const id of IDS) {
    const p = site.places[id], foot = at(p), s = p.shot;
    for (const t of [0, (s.drift?.for ?? 20) / 2, s.drift?.for ?? 20]) {
      const o = shotPose(p, s, foot, t);
      assert.ok(!walker.eyeShut(o.p.x, o.p.y, o.p.z, foot), `${id} at ${t} s: the eye is inside something at ${o.p.toArray().map((v) => v.toFixed(2))}`);
      assert.ok(o.p.y > walker.landAt(o.p.x, o.p.z) + 0.15, `${id} at ${t} s: the eye is at the ground`);
    }
  }
});

test("he, what his hands hold and the stele's face stay inside the safe area at 16:9, 4:3, 9:16 and 19.5:9", () => {
  for (const id of IDS) {
    const p = site.places[id], foot = at(p), s = p.shot;
    for (const aspect of [16 / 9, 4 / 3, 9 / 16, 19.5 / 9]) for (const t of [0, s.drift?.for ?? 20]) {
      const o = shotPose(p, s, foot, t, aspect), cam = new THREE.PerspectiveCamera(o.fov, aspect, 0.05, 500);
      cam.position.copy(o.p); cam.quaternion.copy(o.q); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      for (const k of s.keep) {
        const w = placePoint(p, foot, k), v = w.clone().project(cam), ahead = w.clone().applyMatrix4(cam.matrixWorldInverse).z < 0;
        assert.ok(ahead && Math.abs(v.x) <= SAFE && Math.abs(v.y) <= SAFE, `${id} (${aspect.toFixed(2)}, ${t} s): [${k}] falls at (${v.x.toFixed(2)}, ${v.y.toFixed(2)})`);
      }
    }
  }
});

test("nothing built stands between the eye on a shot and what it keeps in the picture (a column, the stele's stone)", () => {
  // The written plan's walls (solids without a floor on top): the pavilion's columns and the stele on its plinth. The last 0.6 m of
  // each line is not asked (the stele's face lies inside its plinth's rectangle, and he stands within his own width of it).
  const walls = site.walk.solids.filter((s) => s.top === undefined);
  for (const id of IDS) {
    const p = site.places[id], foot = at(p), s = p.shot, o = shotPose(p, s, foot, 0);
    for (const k of s.keep) {
      const w = placePoint(p, foot, k), n = Math.ceil(o.p.distanceTo(w) / 0.05);
      for (let i = 1; i < n; i++) {
        const q = o.p.clone().lerp(w, i / n); if (q.distanceTo(w) < 0.6) break;
        const hit = walls.find((r) => q.x > r.x0 && q.x < r.x1 && q.z > r.z0 && q.z < r.z1 && q.y < (r.eyeTop ?? 3.5));
        assert.ok(!hit, `${id}: the line from the eye to [${k}] passes through ${JSON.stringify(hit)} at ${q.toArray().map((v) => v.toFixed(2))}`);
      }
    }
  }
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
});

function run(director, cam, centre, frames, onFrame = () => {}) {
  const base = { p: cam.position.clone(), q: cam.quaternion.clone() };
  for (let i = 0; i < frames; i++) { cam.position.copy(base.p); cam.quaternion.copy(base.q); director.apply(cam, DT, centre, 50); onFrame(i, cam); }
  cam.position.copy(base.p); cam.quaternion.copy(base.q);
}
const TURN = THREE.MathUtils.radToDeg(DIRECT.rate.in) * DT + 0.05, TURN_BACK = THREE.MathUtils.radToDeg(DIRECT.rate.out) * DT + 0.05, MOVE = DIRECT.speed * DT + 0.01;
const deep = (v, foot) => [[0, 0], [0.03, 0], [-0.03, 0], [0, 0.03], [0, -0.03]].every(([dx, dz]) => walker.eyeShut(v.x + dx, v.y, v.z + dz, foot) === true);
const grazes = (v) => walker.railNear(v.x, v.y, v.z, 0.1);
function planned(d, cam, centre, check) { let n = 0; do { run(d, cam, centre, 1, check); n++; } while (d.state().planning && n < 600); return n; }

test("every swing there and back is made, never cut: within the turn and speed limits, and never through anything", () => {
  for (const id of IDS) {
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
        if (d.state().w > 0 && d.state().w < 0.95 && c.position.distanceTo(start) > DIRECT.near + 0.05) {
          assert.ok(!deep(c.position, foot), `${id} from yaw ${k * 30}°: the swing passed through something at ${c.position.toArray().map((v) => v.toFixed(2))} (${JSON.stringify(d.state().route)})`);
          assert.ok(!grazes(c.position), `${id} from yaw ${k * 30}°: the swing passed by a railing at ${c.position.toArray().map((v) => v.toFixed(2))}`);
        }
        last = c.position.clone(); lastQ = c.quaternion.clone();
      };
      const waited = planned(d, cam, centre, check), secs = d.state().in;
      assert.ok(waited < 600, `${id} from yaw ${k * 30}°: the way was never worked out`);
      assert.ok(secs <= 6, `${id} from yaw ${k * 30}°: a swing of ${secs.toFixed(1)} s is too slow`);
      run(d, cam, centre, Math.ceil((secs + 0.2) / DT), check);
      const st = d.state(); assert.equal(st.phase, "hold", `${id} from yaw ${k * 30}°: not on the shot`);
      assert.ok(!st.blocked, `${id} from yaw ${k * 30}°: no clear route round him`);
      d.back(); planned(d, cam, centre, check); const home = d.state().out;
      assert.ok(home <= 6, `${id} from yaw ${k * 30}°: a way back of ${home.toFixed(1)} s is too slow`);
      run(d, cam, centre, Math.ceil((home + 0.2) / DT), check);
      assert.equal(d.state().phase, "idle", `${id} from yaw ${k * 30}°: not back with him`);
      assert.equal(d.state().cuts, 0, `${id} from yaw ${k * 30}°: a swing was cut`); assert.equal(veil, 0, "the ink was drawn");
    }
  }
});

// The art review of #728 (the strip of the swing to the stele, 2026-11-25): from where the following eye stands as he comes up the
// pavilion's steps (behind him), the eye swung round past the south-west column, which then stood between it and him for a part
// of a second, filling the picture. Not "through" anything, so the test above passed it. Here: on the swing there from behind him
// and on the way back, no column stands between the eye and his head.
test("swung to the stele from behind him and back, no column ever stands between the eye and him", () => {
  const p = site.places.copy, foot = at(p), centre = centreOf(p, foot), head = new THREE.Vector3(p.at[0], foot + 1.05, p.at[1]);
  const cols = site.walk.solids.filter((r) => r.top === undefined && r.x1 - r.x0 < 0.5 && r.z1 - r.z0 < 0.5);   // the pavilion's four columns, as stele.js writes them
  assert.equal(cols.length, 4, "the four columns");
  const hidden = (eye) => { const n = Math.ceil(eye.distanceTo(head) / 0.04); for (let i = 1; i < n; i++) { const q = eye.clone().lerp(head, i / n); if (cols.some((r) => q.x > r.x0 - 0.05 && q.x < r.x1 + 0.05 && q.z > r.z0 - 0.05 && q.z < r.z1 + 0.05)) return true; } return false; };
  for (const yaw of [0, -0.4, 0.4]) {   // behind him, and a little to either side, as he comes up the steps
    const cam = follower(p, foot, Math.PI - p.face + yaw), a = pose(); a.p.copy(cam.position); a.q.copy(cam.quaternion); a.fov = 50;
    const b = shotPose(p, p.shot, foot, 0), plan = planSwing(walker, a, b, centre, foot), o = pose();
    for (const [from, to] of [[a, b], [b, a]]) for (let k = 0; k <= 60; k++) {
      blendPose(from, to, k / 60, centre, o, plan.route);
      assert.ok(!hidden(o.p), `from yaw ${yaw}: at ${(k / 60).toFixed(2)} of the swing a column stands between the eye at ${o.p.toArray().map((v) => v.toFixed(2))} and him (${JSON.stringify(plan.route)})`);
    }
  }
});

// The art director's final review (#728, 2026-11-25): the copy's shot rests a dozen seconds, so its top edge must not cut a
// character in two, least of all in the column he is copying. The face seen from his left shoulder slants each row across the
// picture, so one tilt cannot lay the edge in the gap between characters in every column at once: the whole inscription is in
// the picture instead, every character wholly inside it on a wide screen.
test("the copy's shot rests with every character of the inscription whole in a wide picture, none cut by its edge", async () => {
  const { steleLayout } = await import("../../app/levels/t05/stele.js");
  const p = site.places.copy, st = p.stele, fw = st.w, fh = st.y1 - st.y0, px = 1024, ph = Math.round((px * fh) / fw);
  const o = shotPose(p, p.shot, at(p), 0, 16 / 9), cam = new THREE.PerspectiveCamera(o.fov, 16 / 9, 0.05, 500); cam.position.copy(o.p); cam.quaternion.copy(o.q); cam.updateMatrixWorld();
  const onFace = (x, y) => new THREE.Vector3(st.x - fw / 2 + (x / px) * fw, st.y1 - (y / ph) * fh, st.face + 0.001).project(cam);
  for (const c of steleLayout(px, ph)) for (const [dx, dy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const v = onFace(c.x + dx * c.size, c.y + dy * c.size);
    assert.ok(Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1, `「${c.ch}」 (column ${c.col}, row ${c.row}) has a corner outside the picture at (${v.x.toFixed(3)}, ${v.y.toFixed(3)})`);
  }
  assert.ok(!(p.shot.drift?.tilt || p.shot.drift?.push || p.shot.drift?.rise || p.shot.drift?.turn), "it rests: no drift that would carry the edge across a character");
});
