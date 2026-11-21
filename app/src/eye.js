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
export function followEye(walker, { x, z, foot, eyeY, yaw, pitch, side, reach, arm = DEFAULT_ARM, space = null }) {
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
  // With `space` (#295, eyespace.js) what is in the way is asked of what is drawn, with a sphere as big as the near plane's
  // corners (a railing is drawn, so it keeps off that too); without it, of the written plan.
  const drawn = space ? (px, py, pz) => (space.shut(px, py, pz) ? true : null) : (px, py, pz) => walker.eyeShut(px, py, pz, foot);
  const shut = space
    ? (px, py, pz) => drawn(px, py, pz) || (rise(px, py, pz) > MAXRISE ? true : null)
    : (px, py, pz) => walker.eyeShut(px, py, pz, foot) || (rise(px, py, pz) > MAXRISE ? true : null) || (arm && walker.railNear?.(px, py, pz, 0.25) ? true : null);
  // Asked of what is drawn (#295), how far the eye must rise to see his feet is worked out from the line of sight itself:
  // the ground along the arm is sampled once a quarter-metre, and the eye must stand where the line from it to his feet
  // clears every sample between (and a little over the ground under it). Over a platform's edge that is the rise the
  // written plan's rule gave (a fixed 1.6 of the edge's height); down a flight of steps, where the treads behind him rise
  // as a slope and hide nothing of him, it is next to none, and the arm is not drawn in to his back (#295: the lead
  // measured it at 1.3 m by the half-way pavilion).
  const prof = new Map();
  const groundAt = (gx, gz) => (walker.answers?.(gx, gz) ? Math.max(walker.heightAt(gx, gz), walker.landAt(gx, gz)) : walker.landAt(gx, gz));   // (the drawn floor where the grid has it: its treads, not the written ramp)
  const groundAlong = (sd) => { let g = prof.get(sd); if (!g) { g = []; for (let k = 0; k * 0.25 <= reach + 0.5; k++) { const [gx, , gz] = base(k * 0.25, sd); g.push(groundAt(gx, gz)); } prof.set(sd, g); } return g; };
  const sightNeed = (dist, sd, y) => {
    // (seen down to his shins, 0.3 m over his feet, past the ground from half a metre behind him: the tread he has just
    // stepped down from hides his heels from any eye that is not over him, and is not there to be cleared)
    const g = groundAlong(sd), K = Math.min(g.length - 1, Math.max(0, Math.round(dist / 0.25))), shin = foot + 0.3; let Y = g[K] + 0.35;
    for (let j = 2; j <= K; j++) if (g[j] + 0.05 > shin) Y = Math.max(Y, shin + ((g[j] + 0.05 - shin) * dist) / (j * 0.25));
    return Y - y;
  };
  // Where the eye stands `dist` behind and `sd` to his side (by default, the side found open below).
  const base = arm
    ? (dist, sd = s0) => { const o = (arm.kx ? arm.kx * sd : sd / reach) * dist; return [x + rx * o + (ux * arm.ky - lx) * dist, ty + (uy * arm.ky - ly) * dist, z + rz * o + (uz * arm.ky - lz) * dist]; }
    : (dist, sd = s0) => [x + rx * sd - lx * dist, ty - ly * dist, z + rz * sd - lz * dist];
  // At a distance along the arm (with `space`): something drawn there, or ground the line of sight cannot clear without
  // the eye rising more than it may.
  // (Asked where the eye would stand once risen to see him: down a flight the arm itself runs into the treads behind him,
  // and the eye goes over them, not in to his back.)
  // Something low and drawn where the eye would stand (a porch's railing, the balustrade round a platform's edge) the eye
  // rises over, as it rises to see him over the edge, by as little as clears it and no more than it may rise at all;
  // `riseAt` is that rise (null where there is none: a wall, an eave).
  const rises = new Map();
  const riseAt = (dist, sd = s0) => {
    const key = sd + ":" + dist; if (rises.has(key)) return rises.get(key);
    const p = base(dist, sd), n = sightNeed(dist, sd, p[1]); let r = null;
    // (risen over something, or standing over ground higher than his, the eye must also see him past it, his waist from
    // where it stands (he is a child of 1.22 m: a line to his chest cleared a balustrade that hid all of him below the
    // head): from on a platform behind him its balustrade hid him, #396; where no rise it may take sees him, that point is
    // closed to it)
    const over = groundAt(p[0], p[2]) > foot + 0.3;
    const sees = (k) => (k < 0.01 && !over) || !space?.sees || space.sees([p[0], p[1] + k, p[2]], [x, foot + 0.5, z]);
    if (n <= MAXRISE) for (let k = Math.max(0, n); k <= MAXRISE + 1e-6; k += 0.15) if (!drawn(p[0], p[1] + k, p[2]) && sees(k)) { r = k; break; }
    rises.set(key, r); return r;
  };
  const shutAt = (dist, sd = s0) => (riseAt(dist, sd) === null ? true : null);
  // and whether the eye there, risen as far as it may, would be inside something drawn (not only too low to see him)
  const solidAt = (dist, sd = s0) => { const p = base(dist, sd), n = Math.max(0, Math.min(MAXRISE, sightNeed(dist, sd, p[1]))); return riseAt(dist, sd) === null && !!drawn(p[0], p[1] + n, p[2]); };
  // First to his side, only as far as is open: on a porch that side may be a column, the lattice or a roof's edge.
  let s0 = 0;
  if (!arm) for (let k = Math.min(0.2, side); k > 0 && s0 < side; k = Math.min(side, k + 0.2)) { if (shut(x + rx * k, ty, z + rz * k)) break; s0 = k; }
  // Then back, in short steps, and no farther than the last that was open: right against a wall it stays at his shoulder.
  // (An arm rising at a slant, as B's does looking down, is asked every eighth of a metre: an eave's beam lies thinner
  // across a slanting line than across a level one.)
  const back = (sd) => {
    const ox = x + rx * sd, oz = z + rz * sd; let d = 0, stop = null;
    let thing = false;   // what stopped it was something built or set down, not the lie of the ground
    if (space && arm) space.along(base(0, sd), base(reach, sd));   // (what lies along this arm, gathered once)
    for (let s = 0.25; s <= reach + 1e-3; s += 0.25) {
      const pts = arm ? [base(s - 0.125, sd), base(s, sd)] : [[ox - lx * s, ty - ly * s, oz - lz * s]];
      const h = space && arm ? [s - 0.125, s].map((q) => shutAt(q, sd)).find(Boolean) : pts.map((p) => shut(...p)).find(Boolean);
      if (h) {
        stop = h; thing = space && arm ? [s - 0.125, s].some((q) => solidAt(q, sd)) : pts.some((p) => drawn(p[0], p[1], p[2]));
        // Asked of what is drawn, a column or a trunk is not told from a wall by name but by its thickness: what the arm
        // is clear of again within half a metre beyond is let pass a moment, as a column was (`FOLLOW.postWait`).
        if (space && arm && thing && s + 0.75 <= reach && !shutAt(s + 0.5, sd) && !shutAt(s + 0.75, sd)) stop = "post";
        break;
      }
      d = s;
    }
    return { d, stop, thing };
  };
  // From his side the line back may pass behind a tower that straight behind him it would clear: then nearer behind
  // him it stands, as far to the side as still lets it stand back as far.
  let { d, stop, thing } = back(s0);
  const firstThing = thing;
  // With an arm leaning to his right (A), a wall or a column on that side would bring it all the way in to him: then it
  // leans less, as Cinemachine's third-person follow draws its shoulder in, by as little as lets it stand back farthest.
  // With an arm straight behind him (B), something standing behind him that he is walking past (the censer, a stair's
  // cheek) would otherwise cross the arm, and the eye could only come in to him through it: then the arm swings over
  // about the point over his head, as little as lets it stand back farthest (`side` is then how many metres to his right
  // it stands at its full length, either way; nearer in, proportionally less), and comes back
  // behind him on its spring once the way behind is clear (#271: never put straight out by metres in a frame).
  if (arm && !arm.kx && thing && d < reach - 1.5) {
    // (asked of what is drawn, past a trunk or a column that stands right behind him it swings over as soon as that lets it
    // stand two metres farther back, the court beyond may hold more of them)
    const enough = space ? Math.min(reach - 0.25, d + 2) : reach - 0.25;
    for (const o of [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5]) { const b = back(o); if (b.d >= enough) { s0 = o; d = b.d; stop = b.stop; break; } }   // (only past something it can clear entirely: a wall or the slope of a flight is not gone round, it is come in under)
    // and a little farther over, if that is open too, so that the eye passes the thing with room to spare
    if (s0) { const o = s0 + Math.sign(s0) * 0.3, b = back(o); if (b.d >= d) { s0 = o; d = b.d; stop = b.stop; } }
  }
  if (arm && arm.kx) for (let f = 1; f >= -1e-6; f -= 0.25) { const b = back(Math.max(0, f)); if (b.d > d + 0.25 || f === 1) { s0 = Math.max(0, f); d = b.d; stop = b.stop; } if (d >= reach - 0.25) break; }
  if (!arm) for (let k = s0 - 0.3; d < reach - 0.25 && k > -0.3; k -= 0.3) { const sd = Math.max(0, k), b = back(sd); if (b.d > d + 0.5) { s0 = sd; d = b.d; stop = b.stop; } }
  const ox = x + rx * (arm ? 0 : s0), oz = z + rz * (arm ? 0 : s0);   // (an arm turns about the point over his head; it is not set over beside him)
  // Over a platform or a stair higher than his feet it rises to see them over the edge. The rise needed at one spot.
  const need = space && arm ? (dist, sd, y) => Math.max(0, sightNeed(dist, sd, y), riseAt(dist, sd) ?? 0) : (dist, sd, y) => { const [cx, , cz] = base(dist, sd), under = walker.landAt(cx, cz); return Math.max(0, under + 0.35 + Math.max(0, under - foot) * 1.6 - y); };
  const liftAt = (dist, sd = s0) => {
    // Looking a little to either side of where the eye stands, so that it is already rising when it comes to the edge
    // of a platform, not climbing out of the stone after it has crossed into it. Only as far as it can ever stand: ground
    // beyond a wall that stops it is none of its business.
    const y = base(dist, sd)[1]; let L = 0;
    for (let s = Math.max(0, dist - 0.5); s <= Math.min(dist + 1.0, Math.max(d, dist)) + 1e-6; s += 0.25) L = Math.max(L, need(s, sd, y));
    return Math.min(L, MAXRISE);
  };
  // Where it will stand, risen by `liftAt` (more than `riseAt` asked at that one spot: it rises ahead of a platform's edge),
  // over ground higher than his feet, it must still see him past what it rose over: else it comes in a quarter-metre at a
  // time until it does (#396: on the platform behind him, risen, the balustrade hid all but the top of his head).
  if (space?.sees && arm) {
    const seen = (dd) => { const b = base(dd); return !(groundAt(b[0], b[2]) > foot + 0.3) || space.sees([b[0], b[1] + liftAt(dd), b[2]], [x, foot + 0.5, z]); };
    while (d > 0.25 && !seen(d)) { d -= 0.25; stop = stop || true; }
  }
  const open = space && arm ? (dist, sd = s0) => !shutAt(dist, sd) : (dist, sd = s0) => { const [cx, cy, cz] = base(dist, sd); return !shut(cx, cy, cz); };
  // The floor the eye must never be under, at a distance: whatever is there to stand on, and a hand's breadth.
  const floorAt = (dist, sd = s0) => { const [cx, , cz] = base(dist, sd); return walker.landAt(cx, cz) + 0.12; };
  const at = (dist) => {
    const [cx, y, cz] = base(dist), lifted = y + need(dist, s0, y);
    return [cx, lifted > y && shut(cx, lifted, cz) ? y : lifted, cz];   // never up into an eave
  };
  // (createFollow asks `shut` of single points: whether the eye there would be in something. With `space` that is what is
  // drawn; how high it must stand to see him is already in `open` and `liftAt`.)
  // With `space`, whether the eye at a distance would be inside something drawn (risen as far as it may), as against only
  // too low to see him: the first is put right at once, the second is come in from on the spring, as the ground behind him
  // rises step by step (a flight he goes down), and never by a jump.
  const solid = space && arm ? solidAt : null;
  // (and whether what holds the arm in is only the lie of the ground: then it comes in as slowly as it rises, FOLLOW.liftSpeed)
  const ground = !!(space && arm && stop && !firstThing);
  return { ox, oz, ty, lx, ly, lz, d, stop, ground, side: s0, base, open, solid, liftAt, floorAt, at, shut: space && arm ? drawn : shut, arm };
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
  inDrawn: 6,       // or this, asked of what is drawn (#295): its eaves, trunks and railings stand finer than the written plan's boxes and come between more often, by less
  turnDrawn: 10,    // and this, ahead of a turn, asked of what is drawn
  turnSpeed: 20,    // or this, coming in ahead of a wall that the visitor is swinging the view towards (they are turning it)
  ahead: 0.25,      // how far ahead along a turn of the view the eye looks for what it is about to swing into, in seconds
  outTime: 0.4,     // backing out again once the way is clear
  outSpeed: 5,      // and unhurried about it
  sideTime: 0.3,    // stepping to his side or back behind him
  slideTime: 0.15,   // with B, moving the arm over sideways past something behind him and back (#271)
  slideSpeed: 5,     // and never faster than this, in metres a second
  slideBack: 1.2,    // coming back in behind him once past it: slowly, so that he drifts back to the middle unnoticed
  leanTime: 1.2,    // with ?frame=a, drawing the arm's lean in by a wall and out again: slow, so he drifts across the picture unnoticed (#271)
  liftUp: 0.22,     // rising to see his feet over a platform's edge
  liftSpeed: 1.0,   // and, asked of what is drawn (#295), never faster than this, up or down, in metres a second: down a flight the rise comes on as he steps off its head and goes as he steps off its foot, and the view tipped half a degree a frame
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
      forced = 0; const first = fresh; fresh = false;
      if (dist === null) dist = eye.d;
      if (first && eye.solid) lift = eye.liftAt(dist, eye.side);   // (put down somewhere, it starts already risen as far as it would rise there)
      if (side === null) side = eye.side;
      // To his side: back behind him at once only if where it stands has become a column or a wall.
      // (With B's arm `side` may lie either way; the side nearer behind him is the smaller one.)
      const slide = eye.arm && !eye.arm.kx, inward = (a, b) => (slide ? Math.abs(a) <= Math.abs(b) && a * b >= 0 : a <= b);
      if (inward(eye.side, side) && eye.side !== side && eye.shut(...eye.base(0, side))) { forced = Math.max(forced, slide ? 0 : side - eye.side); side = eye.side; vs = 0; }
      else {
        const [ns, nv] = damp(side, eye.side, vs, eye.arm ? (eye.arm.kx ? T.leanTime : inward(eye.side, side) ? T.slideBack : T.slideTime) : T.sideTime, dt, slide ? T.slideSpeed : Infinity);
        if (inward(ns, side) || eye.open(dist, ns) || (slide && !eye.open(dist, side))) [side, vs] = [ns, nv]; else vs = 0;   // stepping out sideways only into the open (or, B's arm, out of where it already grazes something)
      }
      // Behind him. If the eye would stand inside something (the view has swung it into a trunk, or he has walked it
      // into the side of a tower), it is put out by the shortest way: nearer him or farther, or in behind him.
      // Unless the view is swinging round and the arm will be clear of it a moment from now: then it is something
      // narrow sweeping past (a wall's end, a tree, the corner of an eave), and like a column it is let through, for
      // no longer than a column is.
      const clears = !!ahead && ahead.open(dist, side);
      const inside = eye.solid ? eye.solid(dist, side) : !eye.open(dist, side), passing = inside && clears && through < T.postWait;
      through = passing ? through + dt : 0;
      if (inside && !passing) {
        const [px, , pz] = eye.base(dist, side); let best = null;
        for (let i = 0, sg = Math.sign(side); i <= Math.ceil(Math.abs(side) / 0.1); i++) for (let k = 0; k <= 2; k += 0.05) for (const to of [dist - k, dist + k]) {
          const sd = sg * Math.max(0, Math.abs(side) - 0.1 * i);
          if (to < 0 || to > eye.d + 1e-6 || (best && k > best.k)) continue;
          if (!eye.open(to, sd)) continue;
          const [qx, , qz] = eye.base(to, sd), m = Math.hypot(qx - px, qz - pz);
          if (!best || m < best.m) best = { to, sd, m, k };
        }
        if (!best) best = { to: Math.min(dist, eye.d), sd: eye.side, m: Math.abs(dist - Math.min(dist, eye.d)) };
        forced = Math.max(forced, best.m); dist = best.to; side = best.sd; vd = Math.min(vd, 0); vs = 0;
      }
      const soon = ahead && ahead.d < eye.d, want = soon ? ahead.d : eye.d, stop = soon ? ahead.stop : eye.stop;
      if (want < dist - 1e-4) {
        waited += dt;
        // A column or a trunk crossing the line of sight is let pass; anything larger, or one that stays, is not.
        if ((stop !== "post" && !clears) || waited >= T.postWait) [dist, vd] = damp(dist, want, vd, T.inTime, dt, soon ? (eye.solid ? T.turnDrawn : T.turnSpeed) : eye.ground ? T.liftSpeed : eye.solid ? T.inDrawn : T.inSpeed);
        else vd = 0;
      } else {
        waited = 0;
        const [nd, nv] = damp(dist, want, vd, T.outTime, dt, T.outSpeed);
        if (eye.open(nd, side)) [dist, vd] = [nd, nv]; else vd = 0;               // and backing only into the open
      }
      const [cx, y, cz] = eye.base(dist, side);
      const wantLift = eye.liftAt(dist, side);
      if (wantLift > lift) { [lift, vl] = damp(lift, wantLift, vl, T.liftUp, dt, eye.solid ? T.liftSpeed : Infinity); held = T.liftHold; }
      else if (held > 0) { held -= dt; vl = 0; }
      else [lift, vl] = damp(lift, wantLift, vl, T.liftDown, dt, eye.solid ? T.liftSpeed : Infinity);
      let cy = y + lift;
      // Never up into an eave: down to the highest it may be under it, by as little as will do.
      if (lift > 0 && eye.shut(cx, cy, cz)) { const was = lift; while (lift > 0 && eye.shut(cx, y + lift, cz)) lift = Math.max(0, lift - 0.05); forced = Math.max(forced, was - lift); vl = 0; cy = y + lift; }
      // Asked of what is drawn, something low that it has come into (a railing it was rising over too slowly) it is put
      // over, by as little as clears it: down under it there is nothing but the railing itself.
      if (eye.solid && eye.shut(cx, cy, cz)) { const was = lift; for (let k = lift + 0.05; k <= wantLift + 0.3 + 1e-6; k += 0.05) if (!eye.shut(cx, y + k, cz)) { lift = k; break; } if (lift !== was) { forced = Math.max(forced, lift - was); vl = 0; cy = y + lift; } }
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

// Which way the view from behind him looks, [yaw, pitch], so that his middle is held where the frame says (#271), from
// where the eye stands (`eye`, [x, y, z]) and where he is drawn (`at`, his feet), the visitor's view turned `yaw`: as a
// rotation composer does after its follow. Up and down always: on a flight of steps the eye stands above him going down
// and below him going up, and looking level from there would put him at the foot of the picture or over its top. Across
// only with B (him in the middle): while its arm has moved over to pass something behind him (followEye, `side`), the
// view turns just as much as keeps him in the middle. On open ground both are the visitor's own. Null when the eye is
// too near him for it to mean anything.
export function aimAt(eye, at, yaw, frame, fov) {
  const dx = at[0] - eye[0], dz = at[2] - eye[2], dy = at[1] + frame.hold - eye[1];
  const turn = frame.nx ? yaw : Math.atan2(dx, -dz), ahead = dx * Math.sin(turn) - dz * Math.cos(turn);
  return ahead > 0.5 ? [turn, Math.atan2(dy, ahead) - Math.atan(frame.ny * Math.tan((fov * Math.PI) / 360))] : null;
}
