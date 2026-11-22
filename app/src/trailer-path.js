// What a trailer script says, read as data (#610). The script (a level's `trailer.js`, or any object of this shape) names
// shots; this file knows how to sample the free camera of an `eye` shot, which shot a moment of the film belongs to, how the
// ink-coloured paper is laid over a cut, and which caption is up. It imports no level and no scene: the unit tests hold a
// script's cameras to the director's limits (director.js `DIRECT`) against a level's real walker, the player (trailer.js)
// draws it.
import * as THREE from "three";

/**
 * @typedef {{ t: number, p: [number, number, number], look: [number, number, number], fov?: number }} EyeKey
 * @typedef {{ at: number, strike?: string, flock?: boolean }} ShotEvent
 * @typedef {object} Shot
 * @property {string} id
 * @property {number} from @property {number} to seconds of the film
 * @property {"opening" | "follow" | "eye"} kind `opening` pins the opening after 入山; `follow` poses him at `at` and walks `walk`, the game's own eye following (or his own, `view: "first"`); `eye` is a free camera through `keys`
 * @property {string} season @property {string} time
 * @property {"first" | "third"} [view]
 * @property {[number, number, number, number]} [at] x, z, yaw, pitch where he stands (follow)
 * @property {[number, number][]} [walk] waypoints of the way he walks (follow); the page searches round whatever stands across a leg
 * @property {string} [hall] the room he is in (eye and follow), as `__inside(id)` takes it
 * @property {string} [up] the storey he is up on (`__up`)
 * @property {[number, number, number]} [stand] where he stands, drawn, while a free eye looks on (eye)
 * @property {number} [opening] the second of the opening the shot begins at
 * @property {EyeKey[]} [keys] @property {ShotEvent[]} [events]
 * @property {"hard"} [cut] no paper over the cut into this shot (a step out of a door)
 * @property {string} zone the music's place (score.js `zoneOf`)
 */

export const LIMITS = Object.freeze({ speed: 15, turn: 144 });   // director.js DIRECT.speed and the following eye's 144°/s

export const shotAt = (/** @type {{ shots: Shot[] }} */ script, /** @type {number} */ sec) => {
  const i = script.shots.findIndex((s, k) => sec >= s.from && (sec < s.to || (k === script.shots.length - 1 && sec <= s.to)));
  return i < 0 ? null : { shot: script.shots[i], index: i };
};

const V = (/** @type {number[]} */ a) => new THREE.Vector3(a[0], a[1], a[2]);
/** Catmull–Rom through the keys in time (centripetal tangents are not needed: the keys are seconds apart). */
function spline(/** @type {number[][]} */ pts, /** @type {number[]} */ ts, /** @type {number} */ t, /** @type {number} */ n) {
  let i = 0; while (i < pts.length - 2 && t >= ts[i + 1]) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
  const t1 = ts[i], t2 = ts[i + 1], h = Math.max(1e-6, t2 - t1), u = Math.min(1, Math.max(0, (t - t1) / h));
  const m = (/** @type {number} */ k) => {   // tangent at the segment's ends, in units per segment
    const a = k === 0 ? p0 : p1, b = k === 0 ? p2 : p3, ta = k === 0 ? ts[Math.max(0, i - 1)] : ts[i], tb = k === 0 ? ts[i + 1] : ts[Math.min(pts.length - 1, i + 2)];
    return [0, 1, 2].slice(0, n).map((c) => (b[c] - a[c]) / Math.max(1e-6, tb - ta) * h);
  };
  const m1 = m(0), m2 = m(1), u2 = u * u, u3 = u2 * u;
  return [0, 1, 2].slice(0, n).map((c) => (2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1[c] + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2[c]);
}

/** The free camera of an `eye` shot `t` seconds into it: where it stands, the point it looks at, its angle of view. */
export function eyeAt(/** @type {Shot} */ shot, /** @type {number} */ t) {
  const keys = shot.keys || [], ts = keys.map((k) => k.t), tt = Math.min(ts[ts.length - 1], Math.max(ts[0], t));
  if (keys.length === 1) return { p: V(keys[0].p), look: V(keys[0].look), fov: keys[0].fov ?? 50 };
  const p = spline(keys.map((k) => k.p), ts, tt, 3), look = spline(keys.map((k) => k.look), ts, tt, 3);
  const f = spline(keys.map((k) => [k.fov ?? 50, 0, 0]), ts, tt, 1);
  return { p: V(p), look: V(look), fov: f[0] };
}

const UP = new THREE.Vector3(0, 1, 0);
export const eyeQuat = (/** @type {THREE.Vector3} */ p, /** @type {THREE.Vector3} */ look) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p, look, UP));

/** Speed (m/s) and turning rate (°/s) of an `eye` shot, sampled every `dt` seconds. */
export function eyeMotion(/** @type {Shot} */ shot, dt = 1 / 60) {
  const t0 = shot.keys?.[0].t ?? 0, t1 = shot.keys?.[shot.keys.length - 1].t ?? 0;
  let speed = 0, turn = 0, a = eyeAt(shot, t0), qa = eyeQuat(a.p, a.look);
  for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) {
    const b = eyeAt(shot, t), qb = eyeQuat(b.p, b.look);
    speed = Math.max(speed, a.p.distanceTo(b.p) / dt);
    turn = Math.max(turn, 2 * Math.acos(Math.min(1, Math.abs(qa.dot(qb)))) * 180 / Math.PI / dt);
    a = b; qa = qb;
  }
  return { speed, turn };
}

const smoother = (/** @type {number} */ u) => { u = Math.min(1, Math.max(0, u)); return u * u * u * (u * (u * 6 - 15) + 10); };

/**
 * How much paper lies over the picture at `sec`: 1 is all paper. Each cut between shots is a dip (`script.dip` seconds out of
 * the shot that ends and as many into the next); the film's first frame is bare, and the last shot goes to paper over
 * `script.end.fade` seconds.
 */
export function coverAt(/** @type {any} */ script, /** @type {number} */ sec) {
  const dip = script.dip ?? 0.4; let c = 0;
  for (let i = 1; i < script.shots.length; i++) {
    if (script.shots[i].cut === "hard") continue;   // a cut on the frame, as a step out through a door is
    const cut = script.shots[i].from;
    if (sec > cut - dip && sec < cut + dip) c = Math.max(c, 1 - smoother(Math.abs(sec - cut) / dip));
  }
  const e = script.end; if (e) { const t0 = script.length - e.fade; if (sec > t0) c = Math.max(c, smoother((sec - t0) / e.fade)); }
  return c;
}

/** The caption up at `sec` and how opaque it is, or null. Each fades in and out over `script.captionFade`. */
export function captionAt(/** @type {any} */ script, /** @type {number} */ sec) {
  const f = script.captionFade ?? 0.8;
  for (const c of script.captions || []) if (sec >= c.from && sec <= c.to) return { ...c, alpha: Math.min(smoother((sec - c.from) / f), smoother((c.to - sec) / f)) };
  return null;
}

/** The title card at `sec`: how opaque, or 0. */
export function cardAt(/** @type {any} */ script, /** @type {number} */ sec) {
  const c = script.card; if (!c) return 0;
  return sec < c.from || sec > script.length ? 0 : Math.min(smoother((sec - c.from) / c.fade), 1);
}

/** The frame count of the film at `fps`, and the film second of frame `i`. */
export const framesOf = (/** @type {any} */ script, /** @type {number} */ fps) => Math.round(script.length * fps);
