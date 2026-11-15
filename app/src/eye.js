// The eye that follows him in the third person: a few steps behind, as low as a child and a little to one side, so
// that he stands small in the lower left of the picture and the place fills the rest. It comes in close rather than
// pass through anything solid.
//
// `x, z` is where he stands, `foot` the floor under him, `eyeY` the height the view rides at (over a stair, the slope);
// `yaw, pitch` the way the view looks, `side` how far to his right the eye would like to be, `reach` how far behind.
// Returns the point the eye backs away from (`ox, ty, oz`), the way it looks (`lx, ly, lz`), how far it may back off
// (`d`), what stopped it there (`stop`: "post" for a column or a trunk, true for anything larger, null for nothing),
// whether the eye could stand at a given distance (`open(dist)`), how much it would rise there to see his feet over a
// platform's edge (`liftAt(dist)`), and `at(dist)`, where the eye stands when it is `dist` behind with that whole rise.
export function followEye(walker, { x, z, foot, eyeY, yaw, pitch, side, reach }) {
  const cp = Math.cos(pitch), lx = Math.sin(yaw) * cp, ly = Math.sin(pitch), lz = -Math.cos(yaw) * cp, rx = Math.cos(yaw), rz = Math.sin(yaw), ty = eyeY + 1.18;
  // A retaining wall: bare ground (not a stair or a floor he can walk on) standing higher than a step. The eye does not
  // climb it to look at his feet over the top (that is a rise of several metres, and he drops out of the picture
  // below it); it stays on his side of it, as it would against any wall.
  const tall = (px, pz) => walker.onGround?.(px, pz) && walker.landAt(px, pz) - foot > 1.2;
  const shut = (px, py, pz) => walker.eyeShut(px, py, pz, foot) || (tall(px, pz) ? true : null);
  // First to his side, only as far as is open: on a porch that side may be a column, the lattice or a roof's edge.
  let s0 = 0;
  for (let k = Math.min(0.2, side); k > 0 && s0 < side; k = Math.min(side, k + 0.2)) { if (shut(x + rx * k, ty, z + rz * k)) break; s0 = k; }
  // Then back, in short steps, and no farther than the last that was open: right against a wall it stays at his shoulder.
  const back = (sd) => {
    const ox = x + rx * sd, oz = z + rz * sd; let d = 0, stop = null;
    for (let s = 0.25; s <= reach + 1e-3; s += 0.25) { const h = shut(ox - lx * s, ty - ly * s, oz - lz * s); if (h) { stop = h; break; } d = s; }
    return { d, stop };
  };
  // From his side the line back may pass behind a tower that straight behind him it would clear: then nearer behind
  // him it stands, as far to the side as still lets it stand back as far.
  let { d, stop } = back(s0);
  for (let k = s0 - 0.3; d < reach - 0.25 && k > -0.3; k -= 0.3) { const sd = Math.max(0, k), b = back(sd); if (b.d > d + 0.5) { s0 = sd; d = b.d; stop = b.stop; } }
  const ox = x + rx * s0, oz = z + rz * s0;
  // Where the eye stands `dist` behind and `sd` to his side (by default, the side found open just now).
  const base = (dist, sd = s0) => [x + rx * sd - lx * dist, ty - ly * dist, z + rz * sd - lz * dist];
  // Over a platform or a stair higher than his feet it rises to see them over the edge. The rise needed at one spot.
  const need = (dist, sd, y) => { const [cx, , cz] = base(dist, sd), under = tall(cx, cz) ? foot : walker.landAt(cx, cz); return Math.max(0, under + 0.35 + Math.max(0, under - foot) * 1.6 - y); };
  const liftAt = (dist, sd = s0) => {
    // Looking a little to either side of where the eye stands, so that it is already rising when it comes to the edge
    // of a platform, not climbing out of the stone after it has crossed into it.
    const y = base(dist, sd)[1]; let L = 0;
    for (let s = Math.max(0, dist - 0.5); s <= dist + 1.0 + 1e-6; s += 0.25) L = Math.max(L, need(s, sd, y));
    return L;
  };
  const open = (dist, sd = s0) => { const [cx, cy, cz] = base(dist, sd); return !shut(cx, cy, cz); };
  // The floor the eye must never be under, at a distance: whatever is there to stand on, and a hand's breadth.
  const floorAt = (dist, sd = s0) => { const [cx, , cz] = base(dist, sd); return walker.landAt(cx, cz) + 0.12; };
  const at = (dist) => {
    const [cx, y, cz] = base(dist), lifted = y + need(dist, s0, y);
    return [cx, lifted > y && shut(cx, lifted, cz) ? y : lifted, cz];   // never up into an eave
  };
  return { ox, oz, ty, lx, ly, lz, d, stop, side: s0, base, open, liftAt, floorAt, at, shut };
}

// How the eye moves from one frame to the next, after the third-person camera of 《小王子》 (its
// ThirdPersonCamera: zoom smoothed over 0.15 s, the rise over a platform smoothed over 0.22 s, held 0.35 s and let down
// over 0.5 s; docs/LITTLEPRINCE-TEARDOWN.md). Nothing the eye does may jump: a friend who walked the temple felt sick,
// and the eye leaping in to his back whenever a column passed between, and bobbing up and down at every platform's
// edge, was most of it (docs/t00/KNOWN-ISSUES.md). Times are the time it takes to cover most of the way (1 - 1/e).
export const FOLLOW = {
  postWait: 0.25,   // a column or a trunk may stand between him and the eye this long before it comes in
  inTime: 0.15,     // coming in, past something larger or after that wait
  inSpeed: 8,       // and never faster than this, in metres a second
  outTime: 0.4,     // backing out again once the way is clear
  outSpeed: 5,      // and unhurried about it
  sideTime: 0.3,    // stepping to his side or back behind him
  liftUp: 0.22,     // rising to see his feet over a platform's edge
  liftHold: 0.35,   // and staying up a while, so that walking along an edge does not make it bob
  liftDown: 0.5,    // coming down again
};
// Unity's SmoothDamp: a critically damped spring, so that the eye gathers speed and loses it again instead of
// starting at full speed (an easing by a fixed fraction a frame starts fastest, and that start is the jolt).
export function damp(cur, target, vel, time, dt, maxSpeed = Infinity) {
  const omega = 2 / Math.max(1e-4, time), x = omega * dt, exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const lim = maxSpeed * time, change = Math.max(-lim, Math.min(lim, cur - target)), to = cur - change;
  const temp = (vel + omega * change) * dt;
  let v = (vel - omega * temp) * exp, out = to + (change + temp) * exp;
  if (target - cur > 0 === out > target) { out = target; v = 0; }   // never past where it was going
  return [out, v];
}

export function createFollow(T = FOLLOW) {
  let dist = null, vd = 0, side = 0, vs = 0, lift = 0, vl = 0, held = 0, waited = 0, forced = 0;
  return {
    // Back to rest at a distance (a door passed, the view changed): the next frame starts from there.
    reset(d = null) { dist = d; vd = vs = vl = lift = held = waited = 0; side = null; },
    get dist() { return dist; },
    get side() { return side; },
    // How far the eye last had to be put straight out of something it would otherwise have been inside.
    get forced() { return forced; },
    // One frame: `eye` is this frame's followEye. Returns where the eye stands.
    step(dt, eye) {
      forced = 0;
      if (dist === null) dist = eye.d;
      if (side === null) side = eye.side;
      // To his side: back behind him at once only if where it stands has become a column or a wall.
      if (eye.side < side && eye.shut(...eye.base(0, side))) { forced = Math.max(forced, side - eye.side); side = eye.side; vs = 0; }
      else {
        const [ns, nv] = damp(side, eye.side, vs, T.sideTime, dt);
        if (ns <= side || eye.open(dist, ns)) [side, vs] = [ns, nv]; else vs = 0;   // stepping out sideways only into the open
      }
      // Behind him. If the eye would stand inside something (the view has swung it into a trunk, or he has walked it
      // into the side of a tower), it is put out by the shortest way: nearer him or farther, or in behind him.
      if (!eye.open(dist, side)) {
        const [px, , pz] = eye.base(dist, side); let best = null;
        for (let sd = side; sd >= -1e-6; sd -= 0.1) for (let k = 0; k <= 2; k += 0.05) for (const to of [dist - k, dist + k]) {
          if (to < 0 || to > eye.d + 1e-6 || (best && k > best.k)) continue;
          if (!eye.open(to, Math.max(0, sd))) continue;
          const [qx, , qz] = eye.base(to, Math.max(0, sd)), m = Math.hypot(qx - px, qz - pz);
          if (!best || m < best.m) best = { to, sd: Math.max(0, sd), m, k };
        }
        if (!best) best = { to: Math.min(dist, eye.d), sd: eye.side, m: Math.abs(dist - Math.min(dist, eye.d)) };
        forced = Math.max(forced, best.m); dist = best.to; side = best.sd; vd = Math.min(vd, 0); vs = 0;
      }
      const want = eye.d;
      if (want < dist - 1e-4) {
        waited += dt;
        // A column or a trunk crossing the line of sight is let pass; anything larger, or one that stays, is not.
        if (eye.stop !== "post" || waited >= T.postWait) [dist, vd] = damp(dist, want, vd, T.inTime, dt, T.inSpeed);
        else vd = 0;
      } else {
        waited = 0;
        const [nd, nv] = damp(dist, want, vd, T.outTime, dt, T.outSpeed);
        if (eye.open(nd, side)) [dist, vd] = [nd, nv]; else vd = 0;               // and backing only into the open
      }
      const [cx, y, cz] = eye.base(dist, side);
      const wantLift = eye.liftAt(dist, side);
      if (wantLift > lift) { [lift, vl] = damp(lift, wantLift, vl, T.liftUp, dt); held = T.liftHold; }
      else if (held > 0) { held -= dt; vl = 0; }
      else [lift, vl] = damp(lift, wantLift, vl, T.liftDown, dt);
      let cy = y + lift;
      // Never up into an eave: down to the highest it may be under it, by as little as will do.
      if (lift > 0 && eye.shut(cx, cy, cz)) { const was = lift; while (lift > 0 && eye.shut(cx, y + lift, cz)) lift = Math.max(0, lift - 0.05); forced = Math.max(forced, was - lift); vl = 0; cy = y + lift; }
      const floor = eye.floorAt(dist, side);
      if (cy < floor && !eye.shut(cx, floor, cz)) { lift = floor - y; vl = 0; cy = floor; }   // nor down into the stone
      return [cx, cy, cz];
    },
  };
}
