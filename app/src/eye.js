// The eye that follows him in the third person: a few steps behind and as low as a child, so that he stands small in
// the middle of the picture, a little below its centre, and the place fills the rest (#271, the owner's and the lead's
// choice of 2026-11-19; until then it stood a little to his right and he stood in the lower left). It comes in close
// rather than pass through anything solid.
//
// `x, z` is where he stands, `foot` the floor under him, `eyeY` the height the view rides at (over a stair, the slope);
// `yaw, pitch` the way the view looks, `side` how far to his right the eye would like to be, `reach` how far behind.
// Returns the point the eye backs away from (`ox, ty, oz`), the way it looks (`lx, ly, lz`), how far it may back off
// (`d`), what stopped it there (`stop`: "post" for a column or a trunk, true for anything larger, null for nothing),
// whether the eye could stand at a given distance (`open(dist)`), how much it would rise there to see his feet over a
// platform's edge (`liftAt(dist)`), and `at(dist)`, where the eye stands when it is `dist` behind with that whole rise.
//
// `arm` (issue #271, `?frame=a|b`, not the default yet; `frameArm` below): where he stands across the picture is fixed
// instead, as a fraction of it, and kept there however near the eye has to come. The eye stands on one straight arm out
// of a point over his head (`h`, 1.3 m over his feet: above a porch's railing, 1.29 m, when he stands with his back to it), its direction fixed against the view: `kx` of each metre back
// goes to his right, `ky` up the picture. Something in the way only shortens the arm; it never swings it in behind him,
// and the side step below is not taken. Across, he stays put at every length of the arm; up and down he is where the
// frame says at the eye's usual distance and a little lower in the picture when it has had to come in (an arm out of his
// middle would hold that too, but it would bring the eye down to his hip by every wall, under a stair's cheek).
export function frameArm(frame, fov, aspect, at = 6.2, h = 1.3) {
  const tv = Math.tan((fov * Math.PI) / 360);
  return { kx: -frame.nx * tv * aspect, ky: -frame.ny * tv - (h - frame.hold) / at, h };
}
export function followEye(walker, { x, z, foot, eyeY, yaw, pitch, side, reach, arm = DEFAULT_ARM }) {
  const cp = Math.cos(pitch), lx = Math.sin(yaw) * cp, ly = Math.sin(pitch), lz = -Math.cos(yaw) * cp, rx = Math.cos(yaw), rz = Math.sin(yaw), ty = arm ? eyeY + arm.h : eyeY + 1.18;
  // The picture's own up, square to the way it looks (the arm's `ky` is along it).
  const ux = -Math.sin(yaw) * Math.sin(pitch), uy = cp, uz = Math.cos(yaw) * Math.sin(pitch);
  if (arm) side = 1;   // with an arm, `side` is how much of its sideways lean is taken (1 all, 0 none: straight behind him)
  // How far the eye would have to rise to see his feet over the ground at a point (see `need` below), and the most
  // it may: past that it is not a platform's edge but a terrace wall or a flight of stairs far above him, and an eye
  // sent up it stands metres over his head and loses him below the frame. Such a point is closed to the eye, as a wall is.
  const MAXRISE = 1.5;
  const rise = (px, y, pz) => { const under = walker.landAt(px, pz); return under + 0.35 + Math.max(0, under - foot) * 1.6 - y; };
  // (An arm, B's or A's, also keeps the near plane off a porch's railing, as the director's swings do: straight behind
  // him on a balcony it would otherwise come down to the rail's top.)
  const shut = (px, py, pz) => walker.eyeShut(px, py, pz, foot) || (rise(px, py, pz) > MAXRISE ? true : null) || (arm && walker.railNear?.(px, py, pz, 0.25) ? true : null);
  // Where the eye stands `dist` behind and `sd` to his side (by default, the side found open below).
  const base = arm
    ? (dist, sd = s0) => [x + (rx * arm.kx * sd + ux * arm.ky - lx) * dist, ty + (uy * arm.ky - ly) * dist, z + (rz * arm.kx * sd + uz * arm.ky - lz) * dist]
    : (dist, sd = s0) => [x + rx * sd - lx * dist, ty - ly * dist, z + rz * sd - lz * dist];
  // First to his side, only as far as is open: on a porch that side may be a column, the lattice or a roof's edge.
  let s0 = 0;
  if (!arm) for (let k = Math.min(0.2, side); k > 0 && s0 < side; k = Math.min(side, k + 0.2)) { if (shut(x + rx * k, ty, z + rz * k)) break; s0 = k; }
  // Then back, in short steps, and no farther than the last that was open: right against a wall it stays at his shoulder.
  // (An arm rising at a slant, as B's does looking down, is asked every eighth of a metre: an eave's beam lies thinner
  // across a slanting line than across a level one.)
  const back = (sd) => {
    const ox = x + rx * sd, oz = z + rz * sd; let d = 0, stop = null;
    for (let s = 0.25; s <= reach + 1e-3; s += 0.25) { const h = arm ? shut(...base(s - 0.125, sd)) || shut(...base(s, sd)) : shut(ox - lx * s, ty - ly * s, oz - lz * s); if (h) { stop = h; break; } d = s; }
    return { d, stop };
  };
  // From his side the line back may pass behind a tower that straight behind him it would clear: then nearer behind
  // him it stands, as far to the side as still lets it stand back as far.
  let { d, stop } = back(s0);
  // With an arm leaning to his right (A), a wall or a column on that side would bring it all the way in to him: then it
  // leans less, as Cinemachine's third-person follow draws its shoulder in, by as little as lets it stand back farthest.
  if (arm && arm.kx) for (let f = 1; f >= -1e-6; f -= 0.25) { const b = back(Math.max(0, f)); if (b.d > d + 0.25 || f === 1) { s0 = Math.max(0, f); d = b.d; stop = b.stop; } if (d >= reach - 0.25) break; }
  if (!arm) for (let k = s0 - 0.3; d < reach - 0.25 && k > -0.3; k -= 0.3) { const sd = Math.max(0, k), b = back(sd); if (b.d > d + 0.5) { s0 = sd; d = b.d; stop = b.stop; } }
  const ox = x + rx * s0, oz = z + rz * s0;
  // Over a platform or a stair higher than his feet it rises to see them over the edge. The rise needed at one spot.
  const need = (dist, sd, y) => { const [cx, , cz] = base(dist, sd), under = walker.landAt(cx, cz); return Math.max(0, under + 0.35 + Math.max(0, under - foot) * 1.6 - y); };
  const liftAt = (dist, sd = s0) => {
    // Looking a little to either side of where the eye stands, so that it is already rising when it comes to the edge
    // of a platform, not climbing out of the stone after it has crossed into it. Only as far as it can ever stand: ground
    // beyond a wall that stops it is none of its business.
    const y = base(dist, sd)[1]; let L = 0;
    for (let s = Math.max(0, dist - 0.5); s <= Math.min(dist + 1.0, Math.max(d, dist)) + 1e-6; s += 0.25) L = Math.max(L, need(s, sd, y));
    return Math.min(L, MAXRISE);
  };
  const open = (dist, sd = s0) => { const [cx, cy, cz] = base(dist, sd); return !shut(cx, cy, cz); };
  // The floor the eye must never be under, at a distance: whatever is there to stand on, and a hand's breadth.
  const floorAt = (dist, sd = s0) => { const [cx, , cz] = base(dist, sd); return walker.landAt(cx, cz) + 0.12; };
  const at = (dist) => {
    const [cx, y, cz] = base(dist), lifted = y + need(dist, s0, y);
    return [cx, lifted > y && shut(cx, lifted, cz) ? y : lifted, cz];   // never up into an eave
  };
  return { ox, oz, ty, lx, ly, lz, d, stop, side: s0, base, open, liftAt, floorAt, at, shut, arm };
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
  turnSpeed: 20,    // or this, coming in ahead of a wall that the visitor is swinging the view towards (they are turning it)
  ahead: 0.25,      // how far ahead along a turn of the view the eye looks for what it is about to swing into, in seconds
  outTime: 0.4,     // backing out again once the way is clear
  outSpeed: 5,      // and unhurried about it
  sideTime: 0.3,    // stepping to his side or back behind him
  leanTime: 1.2,    // with ?frame=a, drawing the arm's lean in by a wall and out again: slow, so he drifts across the picture unnoticed (#271)
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
  let fresh = true, through = 0, dist = null, vd = 0, side = 0, vs = 0, lift = 0, vl = 0, held = 0, waited = 0, forced = 0;
  return {
    // Back to rest at a distance (a door passed, the view changed): the next frame starts from there.
    reset(d = null) { fresh = true; dist = d; vd = vs = vl = lift = held = waited = through = 0; side = null; },
    get dist() { return dist; },
    // True from a reset until the next step: the eye has just been put somewhere and nothing it did before carries over.
    get fresh() { return fresh; },
    get side() { return side; },
    // How far the eye last had to be put straight out of something it would otherwise have been inside.
    get forced() { return forced; },
    // One frame: `eye` is this frame's followEye. Returns where the eye stands. `ahead`, if given, is followEye for
    // where the view will have turned a moment from now: while the visitor swings the view round, a wall that the arm
    // is about to sweep into brings the eye in before it gets there, not after it is inside (then it can only be put
    // straight out, and that is a jump of metres).
    step(dt, eye, ahead = null) {
      forced = 0; fresh = false;
      if (dist === null) dist = eye.d;
      if (side === null) side = eye.side;
      // To his side: back behind him at once only if where it stands has become a column or a wall.
      if (eye.side < side && eye.shut(...eye.base(0, side))) { forced = Math.max(forced, side - eye.side); side = eye.side; vs = 0; }
      else {
        const [ns, nv] = damp(side, eye.side, vs, eye.arm ? T.leanTime : T.sideTime, dt);
        if (ns <= side || eye.open(dist, ns)) [side, vs] = [ns, nv]; else vs = 0;   // stepping out sideways only into the open
      }
      // Behind him. If the eye would stand inside something (the view has swung it into a trunk, or he has walked it
      // into the side of a tower), it is put out by the shortest way: nearer him or farther, or in behind him.
      // Unless the view is swinging round and the arm will be clear of it a moment from now: then it is something
      // narrow sweeping past (a wall's end, a tree, the corner of an eave), and like a column it is let through, for
      // no longer than a column is.
      const clears = !!ahead && ahead.open(dist, side);
      const inside = !eye.open(dist, side), passing = inside && clears && through < T.postWait;
      through = passing ? through + dt : 0;
      if (inside && !passing) {
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
      const soon = ahead && ahead.d < eye.d, want = soon ? ahead.d : eye.d, stop = soon ? ahead.stop : eye.stop;
      if (want < dist - 1e-4) {
        waited += dt;
        // A column or a trunk crossing the line of sight is let pass; anything larger, or one that stays, is not.
        if ((stop !== "post" && !clears) || waited >= T.postWait) [dist, vd] = damp(dist, want, vd, T.inTime, dt, soon ? T.turnSpeed : T.inSpeed);
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

// The two ways of holding him in the picture put to the owner in issue #271 (`?frame=a|b`), as fractions of the
// picture from its middle (`nx` to the right, `ny` upward; -1 is the left or bottom edge) and the point in him that
// is held there (`hold`, metres over his feet: the middle of the box `__probe().monkBox` measures, 0 to 1.22 m).
// A: over his shoulder as the default eye stands on open ground (measured there: his middle 38% across and 61% down a
// 16:9 picture), but fixed: on every screen and however near the eye comes. B, the default: in the middle across, his
// middle a little below the picture's (58% down; the lead asked for 55–62%), so that his whole body and the way ahead show.
export const FRAMES = {
  a: { nx: -0.25, ny: -0.21, hold: 0.61 },
  b: { nx: 0, ny: -0.16, hold: 0.61 },
};
// The eye's default since the owner's and the lead's choice of 2026-11-19 (#271): B, him in the middle. Asked without an
// arm, followEye stands on B's at the walk's 50° on a wide screen (the page passes its own fov and aspect); `arm: null`
// is the eye as it was before, over his right shoulder by 1.2 m (`?frame=old`).
export const DEFAULT_ARM = frameArm(FRAMES.b, 50, 16 / 9);

// The tilt of the view from behind him that holds his middle where the frame says (#271), from where the eye stands
// (`eye`, [x, y, z]) and where he is drawn (`at`, his feet), looking the way the view looks (`yaw`): as a rotation
// composer does after its follow. On a flight of steps the eye stands above him going down and below him going up, and
// looking level from there would put him at the foot of the picture or over its top; on open ground the arm already puts
// him there and this is the view's own pitch. Null when the eye is too near him for it to mean anything.
export function aimPitch(eye, at, yaw, frame, fov) {
  const dx = at[0] - eye[0], dz = at[2] - eye[2], dy = at[1] + frame.hold - eye[1], ahead = dx * Math.sin(yaw) - dz * Math.cos(yaw);
  return ahead > 0.5 ? Math.atan2(dy, ahead) - Math.atan(frame.ny * Math.tan((fov * Math.PI) / 360)) : null;
}
