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
// Every swing is made, never cut (the owner asked for animation at the observances, not hard cuts; 2026-11-16). Where the short way round him
// would carry the eye through a wall, a roof or the ground, it goes the long way, over, wide or in by his shoulder, or
// along a way found through the clear air round him (planSwing, wayRound); where it would turn far or travel far, it
// takes longer, so that it never turns faster than 144° a second at its steepest going there (190° coming back) nor
// travels faster than 15 m/s. Only a visitor whose system asks for reduced motion is given the two leaves of ink: they
// close, the eye is put where it is going, and they open again. The visitor comes first: any step, a drag of the view or
// Esc sends the eye back at once (yard.js), and a toggle in the pause menu turns the whole thing off.
import * as THREE from "three";

export const DIRECT = {
  in: [1.6, 2.4],          // seconds from the following eye to the shot
  out: [0.8, 1.2],         // and back
  turn: (120 * Math.PI) / 180,   // (kept for the record: a swing turning further than this used to be cut behind the ink)
  rate: { in: (144 * Math.PI) / 180, out: (190 * Math.PI) / 180 },   // the fastest the eye may turn at the steepest of a swing there, and back (2.4° and 3.2° a frame)
  near: 0.35,              // metres round where the following eye stood within which a swing's first points are not tested
  beat: 0.6,               // seconds a swing that arrives after its observance is over rests on the shot before coming home
  longest: 4,              // a swing that would need longer than this, on every clear route, takes the clear route that needs least
  drift: (1 * Math.PI) / 180,    // the most the eye may turn of itself, per second, while it rests on a shot
  glide: 0.08,             // and the most it may move of itself, metres a second
  samples: 48,             // the fewest points along a swing tested against walls and roofs (more on a long one: one every 4 cm)
  speed: 15,               // the fastest the eye may travel at the steepest of a swing, metres a second (0.25 m a frame)
  wide: 16 / 9,            // the shape of picture a shot's angle of view is written for
  veil: { close: 0.2, held: 0.12, open: 0.26 },   // the ink, only for a visitor who asks for reduced motion: close, shut, open (s)
};
const UP = new THREE.Vector3(0, 1, 0), clamp01 = (u) => Math.min(1, Math.max(0, u));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const smoother = (u) => { u = clamp01(u); return u * u * u * (u * (u * 6 - 15) + 10); };
/** The angle between two orientations, in radians. @param {THREE.Quaternion} a @param {THREE.Quaternion} b */
export const turnBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
/** @typedef {{ p: THREE.Vector3, q: THREE.Quaternion, fov: number }} Pose */
export const pose = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50 });

// How long a shot takes to come and to go, kept within the ranges above whatever the data says.
/** @returns {{ in: number, out: number, back?: number, inNow?: number }} */
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

// The eye `w` of the way from `a` to `b`, along `route` ({ long, lift, pinch }): round `centre` (his chest), its
// distance from him and its height each going from one to the other and its bearing turning the short way round him,
// or the long way (`long`); lifted over what stands between by `lift` metres at the middle of the swing, or drawn in
// toward him by `pinch` (a share of its distance) at the middle, to pass by his shoulder, or let out by `widen`, to pass
// outside what stands near him (a lamp table, a stair's cheek). From
// his own eyes (`a` all but on him) the arc has no bearing to start from, and the eye goes out along the straight line.
/** @typedef {{ long?: boolean, lift?: number, pinch?: number, widen?: number, via?: number[][], curve?: THREE.CatmullRomCurve3 }} Route */
const lookOf = (q, from, toward, out) => out.set(0, 0, -1).applyQuaternion(q).multiplyScalar(Math.max(1, from.distanceTo(toward))).add(from);
const _la = new THREE.Vector3(), _lb = new THREE.Vector3(), _m = new THREE.Matrix4();
/** @param {Pose} a @param {Pose} b @param {number} w @param {THREE.Vector3} centre @param {Pose} out @param {Route} [route] */
export function blendPose(a, b, w, centre, out = pose(), route = {}) {
  const ax = a.p.x - centre.x, az = a.p.z - centre.z, bx = b.p.x - centre.x, bz = b.p.z - centre.z;
  const ra = Math.hypot(ax, az), rb = Math.hypot(bx, bz), bump = Math.sin(Math.PI * w);
  if (route.via) {   // through clear points, on a smooth curve (a tight place where no arc round him is clear)
    const c = route.curve ||= new THREE.CatmullRomCurve3([a.p.clone(), ...route.via.map((v) => new THREE.Vector3().fromArray(v)), b.p.clone()], false, "centripetal");
    c.points[0].copy(a.p); c.points[c.points.length - 1].copy(b.p); c.getPoint(w, out.p);
  } else if (Math.min(ra, rb) < 0.35) { out.p.lerpVectors(a.p, b.p, w); out.p.y += (route.lift || 0) * bump; }
  else {
    const ta = Math.atan2(az, ax); let dt = wrap(Math.atan2(bz, bx) - ta);
    if (route.long) dt -= Math.sign(dt || 1) * Math.PI * 2;
    const th = ta + dt * w, r = (ra + (rb - ra) * w) * (1 - (route.pinch || 0) * bump + (route.widen || 0) * bump);
    out.p.set(centre.x + r * Math.cos(th), a.p.y + (b.p.y - a.p.y) * w + (route.lift || 0) * bump, centre.z + r * Math.sin(th));
  }
  // Turning: evenly from the one orientation to the other; but on a way round that leaves the short arc (the long way,
  // wide of it, or in by his shoulder) an even turn would look away from him, so there the eye looks at a point going from what it
  // first looked at to what the shot looks at.
  if (w <= 0) out.q.copy(a.q); else if (w >= 1) out.q.copy(b.q);
  else if (route.via || (!route.long && !route.pinch && !route.widen)) out.q.slerpQuaternions(a.q, b.q, w);   // (through a point in a tight place: evenly, since a point so near him turns the eye too fast)
  else { lookOf(a.q, a.p, centre, _la).lerp(lookOf(b.q, b.p, centre, _lb), w); out.q.setFromRotationMatrix(_m.lookAt(out.p, _la, UP)); }
  out.fov = a.fov + (b.fov - a.fov) * w;
  return out;
}

// The ways round tried first, in order: the short way, the long way, over what stands between, wide of it, then in by
// his shoulder; then a way found through the clear air round him (wayRound).
export const ROUTES = /** @type {Route[]} */ ([{}, { long: true }, { lift: 1 }, { lift: 2 }, { widen: 0.5 }, { widen: 1 }, { lift: 3 }, { long: true, lift: 1.5 }, { long: true, widen: 0.5 }, { long: true, lift: 3 }, { widen: 0.5, lift: 1.5 }, { pinch: 0.5 }, { pinch: 0.8 }, { long: true, pinch: 0.8 }, { pinch: 0.8, lift: 1 }, { widen: 1.5 }, { long: true, widen: 1 }]);
// A way from `from` to `to` through the air round him that nothing stands in: a grid of points half a metre apart, seven
// metres each way from his chest and at three heights, each kept only where the eye could stand with 15 cm to spare;
// the shortest path over it (A*, each step tested at its middle), then pulled taut (a point left out wherever the line
// past it is clear). Returns the points between, or null when the two cannot be joined.
export function wayRound(walker, from, to, centre, foot) {
  const S = 0.5, N = 14, lo = Math.min(from.y, to.y), hi = Math.max(from.y, to.y), heights = [lo, (lo + hi) / 2 + 0.4, hi + 1.0];
  const free = (x, y, z) => y > walker.landAt(x, z) + 0.3 && [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].every(([dx, dz]) => walker.eyeShut(x + dx, y, z + dz, foot) !== true);
  const key = (i, j, l) => (l * (2 * N + 1) + (j + N)) * (2 * N + 1) + (i + N), cell = new Map();
  const at = (i, j, l) => { const k = key(i, j, l); if (!cell.has(k)) cell.set(k, free(centre.x + i * S, heights[l], centre.z + j * S)); return cell.get(k); };
  const pos = (k) => { const i = (k % (2 * N + 1)) - N, j = (Math.floor(k / (2 * N + 1)) % (2 * N + 1)) - N, l = Math.floor(k / (2 * N + 1) ** 2); return new THREE.Vector3(centre.x + i * S, heights[l], centre.z + j * S); };
  const lineClear = (p, q, skipNear = null) => { const n = Math.max(2, Math.ceil(p.distanceTo(q) / 0.1)), v = new THREE.Vector3();
    for (let k = 1; k < n; k++) { v.lerpVectors(p, q, k / n); if (skipNear && v.distanceTo(skipNear) <= DIRECT.near) continue; if (!free(v.x, v.y, v.z)) return false; } return true; };
  // The nearest grid points the two ends can reach in a clear line.
  const reach = (p, skip) => { let best = null, bd = Infinity;
    for (let l = 0; l < 3; l++) for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
      const q = new THREE.Vector3(centre.x + i * S, heights[l], centre.z + j * S), d = q.distanceTo(p); if (d > 2 || d >= bd || !at(i, j, l)) continue;
      if (lineClear(p, q, skip)) { best = key(i, j, l); bd = d; } }
    return best; };
  const s0 = reach(from, from), s1 = reach(to, null); if (s0 === null || s1 === null) return null;
  const goal = pos(s1), open = new Map([[s0, pos(s0).distanceTo(goal)]]), g = new Map([[s0, 0]]), came = new Map();
  for (let guard = 0; open.size && guard < 6000; guard++) {
    let k = null, fk = Infinity; for (const [kk, f] of open) if (f < fk) { fk = f; k = kk; }
    open.delete(k); if (k === s1) break;
    const i = (k % (2 * N + 1)) - N, j = (Math.floor(k / (2 * N + 1)) % (2 * N + 1)) - N, l = Math.floor(k / (2 * N + 1) ** 2), pk = pos(k);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dl = -1; dl <= 1; dl++) {
      const ni = i + di, nj = j + dj, nl = l + dl; if ((!di && !dj && !dl) || Math.abs(ni) > N || Math.abs(nj) > N || nl < 0 || nl > 2 || !at(ni, nj, nl)) continue;
      const nk = key(ni, nj, nl), pn = pos(nk), mid = pk.clone().lerp(pn, 0.5); if (!free(mid.x, mid.y, mid.z)) continue;
      const ng = g.get(k) + pk.distanceTo(pn); if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); came.set(nk, k); open.set(nk, ng + pn.distanceTo(goal)); }
    }
  }
  if (!came.has(s1) && s0 !== s1) return null;
  const path = [s1]; while (path[0] !== s0) path.unshift(came.get(path[0]));
  const pts = [from.clone(), ...path.map(pos), to.clone()], taut = [pts[0]];
  for (let k = 1; k < pts.length - 1; k++) if (!lineClear(taut[taut.length - 1], pts[k + 1], k === 1 ? from : null)) taut.push(pts[k]);
  return taut.slice(1).map((v) => v.toArray());
}

// How a swing from `a` to `b` is to be made: by which route, and how long it must take so that at its steepest
// (smootherstep's steepest is 1.875 times its mean) the eye turns no faster than `rate` (radians a second) and travels
// no faster than DIRECT.speed; never quicker than `base` seconds. The first route along which no point is in a wall,
// among the timbers of a roof, in a column's bulk or under the ground (`walker.eyeShut`; a thin column, "post", is let
// pass, as the following eye lets it) is taken; sampled at least every 4 cm (8 cm stepped over a lamp table's corner). If none is clear, the one that passes
// through least is taken and the plan says so (`blocked`): the eye is never cut from one place to another.
export function planSwing(walker, a, b, centre, foot, { base = 2, rate = DIRECT.rate.in } = {}) {
  const p = pose(), prev = pose(); let best = null;
  // After the set ways round: a way found through the clear air round him (wayRound), on a smooth curve.
  const found = wayRound(walker, a.p, b.p, centre, foot), vias = found ? [{ via: found }] : [];
  let quickestClear = null, plainClear = null;   // (plainClear: clear at its points, though it grazes within the margin)
  for (const route of [...ROUTES, ...vias]) {
    let length = 0; prev.p.copy(a.p);
    for (let k = 1; k <= DIRECT.samples; k++) { blendPose(a, b, k / DIRECT.samples, centre, p, route); length += p.p.distanceTo(prev.p); prev.p.copy(p.p); }
    const n = Math.max(DIRECT.samples, Math.ceil(length / 0.04));
    let shut = 0, turnRate = 0, moveRate = 0; prev.p.copy(a.p); prev.q.copy(a.q);
    for (let k = 1; k <= n; k++) {
      blendPose(a, b, k / n, centre, p, route);
      // (Within DIRECT.near of where the following eye already stood, wherever it was let stand, nothing is counted:
      // it may stand close against the padding drawn round a low thing, a lamp table, and leaving it the way the shot lies
      // crosses that padding at once.)
      if (p.p.distanceTo(a.p) > DIRECT.near && (walker.eyeShut(p.p.x, p.p.y, p.p.z, foot) === true || p.p.y < walker.landAt(p.p.x, p.p.z) + 0.1)) shut++;
      turnRate = Math.max(turnRate, turnBetween(prev.q, p.q) * n); moveRate = Math.max(moveRate, p.p.distanceTo(prev.p) * n);
      prev.p.copy(p.p); prev.q.copy(p.q);
    }
    const secs = Math.max(base, (turnRate * 1.875) / rate, (moveRate * 1.875) / DIRECT.speed);
    // A route about to be taken is looked at once more with a margin of 6 cm round each point, so that one which only
    // grazes the corner of a table between two points is not taken either.
    if (!shut && (!plainClear || secs < plainClear.secs)) plainClear = { route, secs, shut, length };
    if (!shut && (secs <= DIRECT.longest || !quickestClear || secs < quickestClear.secs)) {
      for (let k = 1; k <= n && !shut; k++) {
        if (p.p.distanceTo(a.p) <= DIRECT.near) { blendPose(a, b, k / n, centre, p, route); if (p.p.distanceTo(a.p) <= DIRECT.near) continue; }
        blendPose(a, b, k / n, centre, p, route);
        for (const [dx, dz] of [[0.06, 0], [-0.06, 0], [0, 0.06], [0, -0.06]]) if (walker.eyeShut(p.p.x + dx, p.p.y, p.p.z + dz, foot) === true) { shut = 1; break; }
      }
    }
    const plan = { route, secs, shut, length };
    if (!shut && secs <= DIRECT.longest) return plan;
    if (!shut && (!quickestClear || secs < quickestClear.secs)) quickestClear = plan;
    if (!best || shut < best.shut || (shut === best.shut && secs < best.secs)) best = plan;
  }
  return quickestClear || plainClear || { ...best, blocked: true };
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
  let ink = null, plan = { route: {}, secs: 0 }, softBack = false, beat = 0;
  const A = pose(), B = pose(), O = pose(), last = new THREE.Quaternion(), stats = { cuts: 0, blends: 0, backs: 0, turnMax: 0, frames: 0, why: null, route: {}, blocked: false };
  const reset = () => { phase = "idle"; u = 0; t = 0; ink = null; plan = { route: {}, secs: 0 }; softBack = false; beat = 0; decided = false; hadLast = false; veil(0); quiet(false); };
  return {
    /** Go to the shot of `where` (named `name`), whose floor is at `floorY`; `now`: be there already (a picture tool). */
    go(name, where, floorY, { now = false } = {}) {
      if (!where || !where.shot || where.shot.off || !enabled()) return false;   // `off`: a shot kept in the data but not gone to (it says why)
      if (phase === "idle") { t = 0; hadLast = false; }
      beat = 0; softBack = false;
      id = name; place = where; shot = where.shot; foot = floorY; dur = durations(shot);
      if (now) { ink = null; veil(0); u = 1; phase = "hold"; decided = true; }
      else if (ink && !ink.moved) { ink.to = 1; phase = "in"; decided = true; }
      else { phase = "in"; decided = false; }
      quiet(true);
      return true;
    },
    // Back to the eye that follows him. Called early by an observance (`out` seconds before its hands are done), by any
    // step, drag or Esc of the visitor's, and when the observance ends.
    // `soft`: the observance is over, or nearly (the visitor did not move): a swing still on its way in goes on to the
    // shot, and none comes home before it has rested there a beat (DIRECT.beat), rather than turning back half way or on
    // the frame it arrives.
    back({ soft = false } = {}) {
      if (phase === "idle" || phase === "out") return false;
      if (soft && (phase === "in" || beat < DIRECT.beat)) { softBack = true; return true; }   // (on its way, or only just arrived)
      softBack = false;
      stats.backs++; phase = "out"; quiet(false);   // what stepped aside over the picture comes back as the eye starts home
      if (ink && !ink.moved) { ink.to = 0; decided = true; }   // the ink is still closing: it opens on him again, nothing moved
      else decided = false;                                       // (if it is opening on the shot, the way back is decided once it has)
      return true;
    },
    // Be on the shot now (the camera is raised in the middle of a swing: what is photographed is the shot).
    finish() { if (phase !== "in") return false; ink = null; veil(0); u = 1; phase = "hold"; beat = 0; decided = true; hadLast = false; return true; },
    // Let go at once, without a swing: the walk has moved him somewhere else (a door, a journey, a passage that takes the eye).
    drop() { if (phase !== "idle") reset(); },
    active: () => phase !== "idle",
    holding: () => phase === "hold" || phase === "in",
    out: () => dur.back || dur.out,   // how long the way back is planned to take (an observance sends the eye home that early)
    // One frame. `camera` holds the following eye as yard.js worked it out (position and orientation; `fov` its angle of
    // view); this moves it to the mix and returns the angle of view to draw with, or null when there is nothing to do.
    /** @param {THREE.PerspectiveCamera} camera @param {number} dt @param {THREE.Vector3} centre @param {number} fov */
    apply(camera, dt, centre, fov) {
      if (phase === "idle") return null;
      A.p.copy(camera.position); A.q.copy(camera.quaternion); A.fov = fov;
      if (phase === "hold") t += dt;   // the shot drifts only while it is rested on: a swing goes to, or from, a shot that stands still
      if (phase === "hold") beat += dt;   // how long it has rested on the shot
      if (phase === "hold" && softBack && beat >= DIRECT.beat) { softBack = false; stats.backs++; phase = "out"; decided = false; quiet(false); }
      shotPose(place, shot, foot, t, camera.aspect || DIRECT.wide, B);
      if (!decided && !ink) {
        // Every swing is made, never cut: a route round him that stands clear of everything, as long as it needs to be
        // to keep within the turn and speed above (planSwing). Only a visitor who asks for reduced motion is given the
        // ink. A swing turned back half way keeps the route it was on.
        decided = true;
        if (reduced()) { ink = { s: 0, moved: false, to: phase === "out" ? 0 : 1 }; stats.cuts++; stats.why = "reduced"; }
        else if (phase === "in" || u >= 1) {
          plan = planSwing(walker, A, B, centre, foot, phase === "out" ? { base: dur.out, rate: DIRECT.rate.out } : { base: dur.in, rate: DIRECT.rate.in });
          if (phase === "out") dur.back = plan.secs; else { dur.inNow = plan.secs; dur.back = planSwing(walker, A, B, centre, foot, { base: dur.out, rate: DIRECT.rate.out }).secs; }
          stats.blends++; stats.route = { ...plan.route, curve: undefined, via: plan.route.via && plan.route.via.map((v) => v.map((c) => +c.toFixed(2))) }; stats.blocked = !!plan.blocked;
        }
      }
      let jumped = false;
      if (ink) {
        ink.s += dt; veil(veilAt(ink.s));
        if (!ink.moved && ink.s >= veilShut()) { ink.moved = true; u = ink.to; jumped = true; }
        if (ink.s >= veilDone()) { ink = null; veil(0); if (phase === "in" && u >= 1) phase = "hold"; }
      } else if (phase === "in") { u = Math.min(1, u + dt / (dur.inNow || dur.in)); if (u >= 1) phase = "hold"; }
      else if (phase === "out") u -= dt / (dur.back || dur.out);
      if (phase === "out" && u <= 0 && !ink) { reset(); return null; }
      blendPose(A, B, smoother(u), centre, O, plan.route);
      camera.position.copy(O.p); camera.quaternion.copy(O.q);
      // The most the picture turned from one frame to the next where the ink did not hide it (the following eye's own
      // turning included), for the tests.
      if (hadLast && !jumped) stats.turnMax = Math.max(stats.turnMax, turnBetween(last, O.q));
      last.copy(O.q); hadLast = true; stats.frames++;
      return O.fov;
    },
    state: () => ({ phase, id, w: +smoother(u).toFixed(3), cut: !!ink, veil: ink ? +veilAt(ink.s).toFixed(3) : 0, t: +t.toFixed(2), in: dur.inNow || dur.in, out: dur.back || dur.out, ...stats, turnMax: +THREE.MathUtils.radToDeg(stats.turnMax).toFixed(2) }),
  };
}
