// The opening (issue #110). A first visitor presses 入山 and, for a dozen seconds, sees where the walk is going before it
// is theirs: the summit pavilion standing in the mist over the library's ridge, a bell far up the mountain, then the eye
// drawn back down the slope over the roofs of the halls, the gate and the tops of the bamboo, until it comes to rest
// behind the novice on the stone path, exactly where the eye that follows him stands, and the walk is handed back.
// After Journey (the far mountain shown once at the start, and that is the goal), Ghost of Tsushima and Firewatch, as
// critics describe them (docs/t00/SOURCES.md): short, skippable, giving control back soon, and showing the one thing
// that matters, the place to go.
//
// It is the director's (director.js) kind of move and is held to the director's limits: never turning faster than
// 144° a second nor travelling faster than 15 m/s (2.4° and 0.25 m a frame at sixty frames a second), every point of the
// way clear of walls, eaves, columns, railings and the ground (`inWay`), and no cut. Only a visitor whose system asks
// for reduced motion is given the ink (`veilAt`): the summit is held, the leaves close, and they open behind him. The
// visitor comes first: a click, a key, a tap or Esc brings the eye down the rest of the same way in about a second.
//
// Who sees it is decided here too (`openingFor`): a first visit, and again after 从头走起; not a visitor who goes on from
// where they were, and never a test or a tool that names its own place.
import * as THREE from "three";
import { DIRECT, smoother, veilAt, veilShut, veilDone } from "./director.js";
import { hasProgress } from "./resume.js";
import { SCREEN } from "./site.js";

export const OPENING = {
  secs: 12,                // the least the way down takes once it moves (longer if the way is too long for DIRECT.speed)
  ramp: [2.6, 3.6],        // seconds of gathering speed at the summit, and of losing it as it comes to him
  margin: 0.94,            // the share of DIRECT.speed the eye may reach at its fastest
  settle: 0.16,            // the share of the way, at its end, over which it is drawn onto the eye that follows him as he is then
  // It waits on the first picture until the page draws steadily (#107 measured 141 ms for a frame on a cold start):
  // `frames` frames in a row each within `ms`, but never less than `least` seconds (the title is fading meanwhile) nor
  // more than `most` (a page that never settles, software rendering, still gets its opening).
  hold: { frames: 6, ms: 50, least: 1.6, most: 3.5 },
  skip: [0.8, 1.2],        // seconds the rest of the way takes when the visitor will not wait
  still: 3.2,              // with reduced motion: seconds the summit is held before the ink closes
};
// The address parameters with which a test or a tool names its own place: no opening, no bell (game.js leaves such a page where it asked to be).
export const SILENT = ["cam", "show", "shot", "in", "enter", "tour", "at", "play", "seals"];

/**
 * Who sees what after 入山. `seals` earned, `place` kept (resume.js), `start` where the path begins, `params` the
 * address's; `again`: the visitor chose 从头走起; `autocam`: the pause menu's 自动镜头; `reduced`: the system's wish for less motion.
 * @returns {{ eye: "fly" | "ink" | "none", bell: boolean }}
 */
export function openingFor({ seals = 0, place = null, start, params, again = false, autocam = true, reduced = false }) {
  if (SILENT.some((k) => params.has(k))) return { eye: "none", bell: false };
  if (!again && hasProgress(seals, place, start)) return { eye: "none", bell: false };
  return { eye: !autocam ? "none" : reduced ? "ink" : "fly", bell: true };
}

// The way down, in the world (1 unit = 1 m, north is -z). The first point stands in the gap between the main hall and
// the library, below the library's ridge (19.3 m), so that the ridge hides the summit's terrace and only the pavilion's
// upper storeys show over it, in the mist; then back and up over the main hall's ridge (16.4 m), the first court and
// the gate (14.6 m), down over the forecourt and the tops of the bamboo (GROVE.top, 15 m over the land), into the clear
// way of the zigzag stair at its landing, down its last flight, over his head, and in behind him. What it looks at stays the summit until the end, where it becomes the way the following eye looks.
const WAY = [[0, 18.2, -28.5], [0, 21, -20], [0, 22.5, -6], [0, 21.5, 22], [0, 20.5, 44], [2, 19.5, 60], [7, 16, 70], [14.5, 11, 77.5], [21.3, 2.5, 83.5], [21.6, -8.6, 90.5]];
const SUMMIT = [0, 33, -131];

/** The way down to `end` (the following eye: { p, q }), timed. `poseAt(t)` is the eye `t` seconds after it starts to move. */
export function openingPlan(end) {
  const pts = [...WAY.map((v) => new THREE.Vector3(...v)), end.p.clone()];
  const path = new THREE.CatmullRomCurve3(pts, false, "centripetal"); path.arcLengthDivisions = 4000;   // (fine enough that equal steps of arc length are equal to a millimetre)
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(end.q), summit = new THREE.Vector3(...SUMMIT);
  const far = end.p.clone().addScaledVector(fwd, summit.distanceTo(end.p));   // the following eye's line of sight, out as far as the summit
  const length = path.getLength(), [r0, r1] = OPENING.ramp, vmax = DIRECT.speed * OPENING.margin;
  const secs = Math.max(OPENING.secs, length / vmax + (r0 + r1) / 2), vp = length / (secs - (r0 + r1) / 2);
  // Metres along the way `t` seconds in: speed gathered over r0 and lost over r1 on half a cosine each (no jolt at either end).
  const sAt = (t) => {
    t = Math.min(secs, Math.max(0, t));
    if (t < r0) return vp * (t / 2 - (r0 / (2 * Math.PI)) * Math.sin((Math.PI * t) / r0));
    const s0 = (vp * r0) / 2;
    if (t < secs - r1) return s0 + vp * (t - r0);
    const u = t - (secs - r1);
    return s0 + vp * (secs - r1 - r0) + vp * (u / 2 + (r1 / (2 * Math.PI)) * Math.sin((Math.PI * u) / r1));
  };
  const m = new THREE.Matrix4(), look = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  /** The eye `s` metres along the way. */
  const poseAtS = (s, out = { p: new THREE.Vector3(), q: new THREE.Quaternion() }) => {
    const u = Math.min(1, Math.max(0, s / length));
    path.getPointAt(u, out.p);
    look.copy(summit).lerp(far, smoother((u - 0.55) / 0.45));
    out.q.setFromRotationMatrix(m.lookAt(out.p, look, UP));
    if (u >= 1) out.q.copy(end.q);
    return out;
  };
  return { end: { p: end.p.clone(), q: end.q.clone() }, length, secs, sAt, poseAtS, poseAt: (t, out) => poseAtS(sAt(t), out), speed: (t) => (sAt(t + 0.01) - sAt(t)) / 0.01 };
}

/**
 * The opening as it plays. `now()` is the wall clock in milliseconds (the way down keeps time on a slow page, as the
 * director keeps the observances' clock); `veil(k)` draws the ink. Each frame `apply(camera, A)` is handed the camera
 * holding the following eye and the following eye itself (`A`: { p, q }); it moves the camera and returns whether the
 * opening still has the eye.
 */
export function createOpening({ now = () => performance.now(), veil = (/** @type {number} */ k) => {} } = {}) {
  /** "idle" | "hold" | "fly" | "skip" | "ink" | "done" */
  let phase = "idle", mode = "fly", plan = null, t0 = 0, last = 0, steady = 0, began = 0, waited = 0, cuts = 0, skipped = false;
  let skip = null;   // { s0, v0, at, secs }: the rest of the way, quickly
  let pinned = null;  // a tool's: the eye held this many seconds into the way down (pin)
  let ink = null;    // { at, moved }
  const O = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, P = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, D = new THREE.Quaternion(), I = new THREE.Quaternion();
  const sNow = (clock) => {
    if (phase === "hold" || !plan) return 0;
    if (pinned !== null && !skip) return plan.sAt(pinned);
    if (skip) {
      const u = Math.min(1, (clock - skip.at) / 1000 / skip.secs), left = plan.length - skip.s0, d = skip.v0 * skip.secs;
      return Math.min(plan.length, skip.s0 + left * (3 * u * u - 2 * u * u * u) + d * (u - 2 * u * u + u * u * u));   // Hermite: from the speed it had, to rest on him
    }
    return plan.sAt((clock - t0) / 1000);
  };
  return {
    /** Begin: `fly` down the mountain, or `ink` (reduced motion: the summit held, then the leaves). */
    start(how = "fly") { mode = how; phase = "hold"; plan = null; began = last = now(); steady = 0; skip = ink = null; skipped = false; return true; },
    /** The visitor will not wait: the rest of the way in about a second (or the ink at once). */
    skip() {
      if (phase === "idle" || phase === "done" || skip || ink) return false;
      skipped = true; const clock = now();
      if (mode === "ink") { ink = { at: clock, moved: false }; cuts++; phase = "ink"; return true; }
      if (!plan) return (phase = "skip"), (skip = { s0: 0, v0: 0, at: clock, secs: OPENING.skip[1], pending: true }), true;
      const s0 = sNow(clock), v0 = phase === "fly" ? plan.speed((clock - t0) / 1000) : 0, left = plan.length - s0;
      const secs = Math.min(OPENING.skip[1], Math.max(OPENING.skip[0], left / 120));
      skip = { s0, v0: Math.min(v0, (2.5 * left) / secs), at: clock, secs }; phase = "skip"; waited ||= clock - began;
      return true;
    },
    active: () => phase !== "idle" && phase !== "done",
    /** For the picture tools: hold the eye `secs` seconds into the way down (null lets it go on from there). */
    pin(secs) { if (secs === null || secs === undefined) { if (pinned !== null && phase === "fly") t0 = now() - pinned * 1000; pinned = null; return; } pinned = Math.max(0, +secs); if (phase === "idle" || phase === "done" || phase === "hold") { mode = "fly"; phase = "fly"; plan = null; skip = ink = null; } },
    /** @param {THREE.Camera} camera @param {{ p: THREE.Vector3, q: THREE.Quaternion }} A */
    apply(camera, A) {
      if (phase === "idle" || phase === "done") return false;
      const clock = now(), gap = clock - last; last = clock;
      if (!plan) plan = openingPlan(A);
      if (skip && skip.pending) { skip.pending = false; skip.at = clock; skip.secs = Math.min(OPENING.skip[1], Math.max(OPENING.skip[0], plan.length / 120)); }
      if (phase === "hold") {
        steady = gap > 0 && gap <= OPENING.hold.ms ? steady + 1 : 0;
        const held = (clock - began) / 1000;
        if (mode === "ink" && held >= OPENING.still) { ink = { at: clock, moved: false }; cuts++; phase = "ink"; }
        else if (mode === "fly" && held >= OPENING.hold.least && (steady >= OPENING.hold.frames || held >= OPENING.hold.most)) { phase = "fly"; t0 = clock; waited = clock - began; }
      }
      let s = sNow(clock);
      if (ink) {
        const k = (clock - ink.at) / 1000; veil(veilAt(k));
        if (!ink.moved && k >= veilShut()) ink.moved = true;
        if (k >= veilDone()) { veil(0); phase = "done"; camera.position.copy(A.p); camera.quaternion.copy(A.q); return false; }
        if (ink.moved) { camera.position.copy(A.p); camera.quaternion.copy(A.q); return true; }
        s = 0;
      }
      plan.poseAtS(s, O);
      // Over the last of the way, whatever the following eye has moved since the way was planned (he cannot walk meanwhile,
      // but the eye's own springs may settle) is laid onto it, so that the end is the eye the walk goes on with.
      const w = smoother((s / plan.length - (1 - OPENING.settle)) / OPENING.settle);
      P.p.copy(A.p).sub(plan.end.p).multiplyScalar(w).add(O.p);
      D.copy(plan.end.q).invert().premultiply(A.q); P.q.copy(O.q).premultiply(I.identity().slerp(D, w));
      camera.position.copy(P.p); camera.quaternion.copy(P.q);
      if (s >= plan.length - 1e-6 && (phase === "fly" || phase === "skip")) { phase = "done"; camera.position.copy(A.p); camera.quaternion.copy(A.q); return false; }
      return true;
    },
    plan: () => plan,
    state: () => ({ phase, mode, skipped, cuts, waited: Math.round(waited), secs: plan ? +plan.secs.toFixed(2) : null, length: plan ? +plan.length.toFixed(1) : null, s: plan ? +sNow(now()).toFixed(1) : 0 }),
  };
}

// The prologue's title rises when the gate first stands whole in the picture: he has come round the screen wall (south
// of the gate, north of the wall) and the view looks at the gate's middle, within 30°. Walking there backwards, looking
// the other way, does not raise it. `w`: where he is and the view's yaw (yaw 0 looks north, -z).
export const GATE = { z: 40, zS: SCREEN.z - 0.6, zN: 45, x: 11, within: (30 * Math.PI) / 180 };
export function atGate({ x, z, yaw }) {
  if (!(z < GATE.zS && z > GATE.zN && Math.abs(x) < GATE.x)) return false;
  const want = Math.atan2(0 - x, z - GATE.z), d = Math.atan2(Math.sin(yaw - want), Math.cos(yaw - want));
  return Math.abs(d) < GATE.within;
}
