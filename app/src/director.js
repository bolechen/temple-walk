// Where the eye goes while an observance is made. Walking, it follows him (eye.js); when he takes the bell's rope,
// lifts the bowl, raises the incense, it leaves his shoulder and goes, without hurry, to the place the moment is best
// seen from, and comes back to him the moment the visitor wants to walk on.
//
// Two layers, mixed (after Unity's Cinemachine blends and Unreal's camera director): beneath, the eye that follows him,
// worked out every frame as if nothing else were happening; above, the shot that belongs to the place
// (`site.places[id].shot`, written in the place's own frame: x to his left, z the way he faces, y up from the floor he
// stands on). One weight goes from the first to the second over 1.6–2.4 s and back over 0.8–1.2 s, eased in and out
// (smootherstep: it gathers speed slowly and loses it slowly, as a critically damped spring does), and the eye swings
// round him on an arc rather than through him. The way back always ends on the eye that follows him as he is then, so
// that a step he took meanwhile (the incense stand is a step nearer than the cushion) is not undone by a jump at the end.
//
// When the swing would carry the eye through a wall, a roof or the ground, or turn it more than about 120°, it is not
// made: two leaves of ink close over the picture, the eye is put where it is going, and they open again. A visitor whose
// system asks for reduced motion is always given the leaves. The visitor comes first: any step, a drag of the view or
// Esc sends the eye back at once (yard.js), and a toggle in the pause menu turns the whole thing off.
import * as THREE from "three";

export const DIRECT = {
  in: [1.6, 2.4],          // seconds from the following eye to the shot
  out: [0.8, 1.2],         // and back
  turn: (120 * Math.PI) / 180,   // a swing that turns the eye further than this is cut behind the ink instead
  drift: (1 * Math.PI) / 180,    // the most the eye may turn of itself, per second, while it rests on a shot
  glide: 0.08,             // and the most it may move of itself, metres a second
  samples: 48,             // points along a swing tested against walls and roofs
  speed: 15,               // the fastest the eye may travel at the steepest of a swing, metres a second (0.25 m a frame)
  wide: 16 / 9,            // the shape of picture a shot's angle of view is written for
  veil: { close: 0.2, held: 0.12, open: 0.26 },   // the ink: how long it takes to close, stays shut, opens (s)
};
const UP = new THREE.Vector3(0, 1, 0), clamp01 = (u) => Math.min(1, Math.max(0, u));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const smoother = (u) => { u = clamp01(u); return u * u * u * (u * (u * 6 - 15) + 10); };
/** The angle between two orientations, in radians. @param {THREE.Quaternion} a @param {THREE.Quaternion} b */
export const turnBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
/** @typedef {{ p: THREE.Vector3, q: THREE.Quaternion, fov: number }} Pose */
export const pose = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50 });

// How long a shot takes to come and to go, kept within the ranges above whatever the data says.
/** @returns {{ in: number, out: number, back?: number }} */
export const durations = (shot = {}) => ({
  in: Math.min(DIRECT.in[1], Math.max(DIRECT.in[0], shot.in ?? 2)),
  out: Math.min(DIRECT.out[1], Math.max(DIRECT.out[0], shot.out ?? 1)),
});

// A point of a place's own frame in the world. `foot` is the floor under the place.
export function placePoint(place, foot, [x, y, z], out = new THREE.Vector3()) {
  const f = place.face || 0, c = Math.cos(f), s = Math.sin(f);
  return out.set(place.at[0] + x * c + z * s, foot + y, place.at[1] - x * s + z * c);
}

// Where the shot stands `t` seconds after it was reached, and which way it looks. The drift (`push` toward what it looks
// at, `side` to the right, `rise`, in metres a second; `turn` and `tilt` in degrees a second; `for` how many seconds it
// keeps going) is held to DIRECT.drift and DIRECT.glide: a slow push or pan, never a shake. The angle of view is written
// for a wide picture; on a narrower one it is opened so that as much is seen from side to side.
/** @returns {Pose} */
export function shotPose(place, shot, foot, t = 0, aspect = DIRECT.wide, out = pose()) {
  const p = placePoint(place, foot, shot.at, out.p), look = placePoint(place, foot, shot.look, new THREE.Vector3());
  const m = new THREE.Matrix4().lookAt(p, look, UP); out.q.setFromRotationMatrix(m);
  const d = shot.drift || {}, T = Math.max(0, Math.min(t, d.for ?? 20));
  const lim = (v, max) => Math.max(-max, Math.min(max, v || 0));
  const glide = Math.hypot(d.push || 0, d.side || 0, d.rise || 0), gk = glide > DIRECT.glide ? DIRECT.glide / glide : 1;
  if (T > 0) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(out.q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(out.q);
    p.addScaledVector(fwd, (d.push || 0) * gk * T).addScaledVector(right, (d.side || 0) * gk * T); p.y += (d.rise || 0) * gk * T;
    const turn = THREE.MathUtils.degToRad(d.turn || 0), tilt = THREE.MathUtils.degToRad(d.tilt || 0), rate = Math.hypot(turn, tilt), k = rate > DIRECT.drift ? DIRECT.drift / rate : 1;
    const qy = new THREE.Quaternion().setFromAxisAngle(UP, -lim(turn * k, DIRECT.drift) * T), qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lim(tilt * k, DIRECT.drift) * T);
    out.q.premultiply(qy).multiply(qx);
  }
  const fov = shot.fov ?? 45;
  out.fov = aspect >= DIRECT.wide ? fov : Math.min(90, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * (DIRECT.wide / aspect))));
  return out;
}

// The eye `w` of the way from `a` to `b`: round `centre` (his chest), its distance from him and its height each going
// straight from one to the other and its bearing turning the short way, so that it never passes nearer to him than the
// nearer of the two. Its orientation turns evenly between them, as does the angle of view. From his own eyes (`a` all
// but on him) the arc has no bearing to start from, and the eye simply goes out along the straight line.
/** @param {Pose} a @param {Pose} b @param {number} w @param {THREE.Vector3} centre @param {Pose} out */
export function blendPose(a, b, w, centre, out = pose()) {
  const ax = a.p.x - centre.x, az = a.p.z - centre.z, bx = b.p.x - centre.x, bz = b.p.z - centre.z;
  const ra = Math.hypot(ax, az), rb = Math.hypot(bx, bz);
  if (Math.min(ra, rb) < 0.35) out.p.lerpVectors(a.p, b.p, w);
  else {
    const ta = Math.atan2(az, ax), th = ta + wrap(Math.atan2(bz, bx) - ta) * w, r = ra + (rb - ra) * w;
    out.p.set(centre.x + r * Math.cos(th), a.p.y + (b.p.y - a.p.y) * w, centre.z + r * Math.sin(th));
  }
  out.q.slerpQuaternions(a.q, b.q, w); out.fov = a.fov + (b.fov - a.fov) * w;
  return out;
}

// Whether the swing from `a` to `b` must be cut behind the ink rather than made, and why: "turn" when it would turn the
// eye more than DIRECT.turn, "solid" when a point along it is in a wall, among the timbers of a roof, or under the
// ground (`walker.eyeShut`, which answers "post" for a column it may pass: that is let through, as the following eye lets it).
// Given `secs` for the swing, also "far" when it is so long that the eye would have to travel faster than DIRECT.speed at
// its steepest (smootherstep's steepest is 1.875 times its mean).
export function needsCut(walker, a, b, centre, foot, secs = Infinity) {
  if (turnBetween(a.q, b.q) > DIRECT.turn) return "turn";
  const p = pose(), prev = a.p.clone(); let length = 0;
  for (let k = 1; k <= DIRECT.samples; k++) {
    blendPose(a, b, k / DIRECT.samples, centre, p); length += p.p.distanceTo(prev); prev.copy(p.p);
    if (walker.eyeShut(p.p.x, p.p.y, p.p.z, foot) === true) return "solid";
    if (p.p.y < walker.landAt(p.p.x, p.p.z) + 0.1) return "solid";
  }
  if ((length * 1.875) / secs > DIRECT.speed) return "far";
  return null;
}

// How far the ink covers the picture `s` seconds into a cut (0 open, 1 shut), and whether the eye has been moved yet.
export function veilAt(s) {
  const V = DIRECT.veil, e = (u) => u * u * (3 - 2 * u);
  if (s < V.close) return e(s / V.close);
  if (s < V.close + V.held) return 1;
  return 1 - e(clamp01((s - V.close - V.held) / V.open));
}
export const veilShut = () => DIRECT.veil.close + DIRECT.veil.held / 2;   // the moment the eye is moved
export const veilDone = () => DIRECT.veil.close + DIRECT.veil.held + DIRECT.veil.open;

// The director. `walker` answers what is solid; `enabled()` is the visitor's setting, `reduced()` the system's wish for
// less motion; `veil(k)` draws the ink at cover `k` (0 takes it away); `quiet(on)` fades the marks over the picture.
export function createDirector({ walker, enabled = () => true, reduced = () => false, veil = (/** @type {number} */ k) => {}, quiet = (/** @type {boolean} */ on) => {} }) {
  /** "idle" | "in" | "hold" | "out" */
  let phase = "idle", u = 0, t = 0, id = null, place = null, shot = null, foot = 0, dur = durations(), decided = false, hadLast = false;
  /** A cut behind the ink: `s` seconds into it, whether the eye has been moved yet, and to which end (1 the shot, 0 him). @type {null | { s: number, moved: boolean, to: number }} */
  let ink = null;
  const A = pose(), B = pose(), O = pose(), last = new THREE.Quaternion(), stats = { cuts: 0, blends: 0, backs: 0, turnMax: 0, frames: 0, why: null };
  const reset = () => { phase = "idle"; u = 0; t = 0; ink = null; decided = false; hadLast = false; veil(0); quiet(false); };
  return {
    /** Go to the shot of `where` (named `name`), whose floor is at `floorY`; `now`: be there already (a picture tool). */
    go(name, where, floorY, { now = false } = {}) {
      if (!where || !where.shot || !enabled()) return false;
      if (phase === "idle") { t = 0; hadLast = false; }
      id = name; place = where; shot = where.shot; foot = floorY; dur = durations(shot);
      if (now) { ink = null; veil(0); u = 1; phase = "hold"; decided = true; }
      else if (ink && !ink.moved) { ink.to = 1; phase = "in"; decided = true; }
      else { phase = "in"; decided = false; }
      quiet(true);
      return true;
    },
    // Back to the eye that follows him. Called early by an observance (`out` seconds before its hands are done), by any
    // step, drag or Esc of the visitor's, and when the observance ends.
    back() {
      if (phase === "idle" || phase === "out") return false;
      stats.backs++; phase = "out"; quiet(false);   // what stepped aside over the picture comes back as the eye starts home
      if (ink && !ink.moved) { ink.to = 0; decided = true; }   // the ink is still closing: it opens on him again, nothing moved
      else decided = false;                                       // (if it is opening on the shot, the way back is decided once it has)
      return true;
    },
    // Be on the shot now (the camera is raised in the middle of a swing: what is photographed is the shot).
    finish() { if (phase !== "in") return false; ink = null; veil(0); u = 1; phase = "hold"; decided = true; hadLast = false; return true; },
    // Let go at once, without a swing: the walk has moved him somewhere else (a door, a journey, a passage that takes the eye).
    drop() { if (phase !== "idle") reset(); },
    active: () => phase !== "idle",
    holding: () => phase === "hold" || phase === "in",
    out: () => dur.out,
    // One frame. `camera` holds the following eye as yard.js worked it out (position and orientation; `fov` its angle of
    // view); this moves it to the mix and returns the angle of view to draw with, or null when there is nothing to do.
    /** @param {THREE.PerspectiveCamera} camera @param {number} dt @param {THREE.Vector3} centre @param {number} fov */
    apply(camera, dt, centre, fov) {
      if (phase === "idle") return null;
      A.p.copy(camera.position); A.q.copy(camera.quaternion); A.fov = fov;
      if (phase === "hold") t += dt;   // the shot drifts only while it is rested on: a swing goes to, or from, a shot that stands still
      shotPose(place, shot, foot, t, camera.aspect || DIRECT.wide, B);
      if (!decided && !ink) {
        // The swing back covers the same arc as the swing in (or the part of it already made), so one test serves both.
        decided = true;
        // The way back is quicker than the way there, but the further it has to turn the longer it takes, within its
        // range: a full 120° comes round over 1.2 s, never faster than about 190° a second at its steepest.
        if (phase === "out") dur.back = Math.max(dur.out, Math.min(DIRECT.out[1], DIRECT.out[0] + (DIRECT.out[1] - DIRECT.out[0]) * turnBetween(A.q, B.q) / DIRECT.turn));
        const why = reduced() ? "reduced" : needsCut(walker, A, B, centre, foot, (phase === "out" ? dur.back ?? dur.out : dur.in) * (phase === "out" ? u : 1 - u || 1));
        if (why) { ink = { s: 0, moved: false, to: phase === "out" ? 0 : 1 }; stats.cuts++; stats.why = why; } else stats.blends++;
      }
      let jumped = false;
      if (ink) {
        ink.s += dt; veil(veilAt(ink.s));
        if (!ink.moved && ink.s >= veilShut()) { ink.moved = true; u = ink.to; jumped = true; }
        if (ink.s >= veilDone()) { ink = null; veil(0); if (phase === "in" && u >= 1) phase = "hold"; }
      } else if (phase === "in") { u = Math.min(1, u + dt / dur.in); if (u >= 1) phase = "hold"; }
      else if (phase === "out") u -= dt / (dur.back || dur.out);
      if (phase === "out" && u <= 0 && !ink) { reset(); return null; }
      blendPose(A, B, smoother(u), centre, O);
      camera.position.copy(O.p); camera.quaternion.copy(O.q);
      // The most the picture turned from one frame to the next where the ink did not hide it (the following eye's own
      // turning included), for the tests.
      if (hadLast && !jumped) stats.turnMax = Math.max(stats.turnMax, turnBetween(last, O.q));
      last.copy(O.q); hadLast = true; stats.frames++;
      return O.fov;
    },
    state: () => ({ phase, id, w: +smoother(u).toFixed(3), cut: !!ink, veil: ink ? +veilAt(ink.s).toFixed(3) : 0, t: +t.toFixed(2), in: dur.in, out: dur.out, ...stats, turnMax: +THREE.MathUtils.radToDeg(stats.turnMax).toFixed(2) }),
  };
}
