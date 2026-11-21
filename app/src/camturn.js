// Turning the view back behind him (#295, group B). The owner: in a narrow corner the mouse is hard to turn the view
// with, and it takes a while to get out. Two ways, both turns of the view's yaw only:
//
// The key (R, the middle mouse button, or the ring on a touch screen) swings the view round to look the way he faces,
// by the short way, quickly but never cut (the lead's searches: Unreal's and Roblox's recentring, TV Tropes' "Camera
// Centering"), on a smootherstep whose steepest is held to the director's 144° a second; while it swings, a drag of the
// view is not taken (the two would pull against each other), and where he faces is taken once, when it is pressed, so
// that walking sideways does not keep it turning.
//
// The drift (镜头跟随, on by default, the pause menu turns it off): while he walks a tapped way and the visitor's hand has
// been off the view for FOLLOW_TURN.wait, the view drifts round behind the way he goes, no faster than FOLLOW_TURN.speed,
// gathering speed and losing it; a hand on the view stops it at once and starts the wait again (Cinemachine's recentring,
// a wait then a turn; Project Gorgon's auto-align time; players who feel sick asked for it to be slow and to be switched off).
// Walking by keys or the stick it does not drift: those walk by the view, and following the way he goes would chase it round.

export const RECENTER = Object.freeze({ rate: 144, min: 0.35 });   // degrees a second at the steepest; the shortest swing
export const FOLLOW_TURN = Object.freeze({ wait: 2.0, speed: 30, ease: 0.6 });   // seconds of no hand; degrees a second; seconds to gather speed

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** The view's yaw that looks the way he faces (yard.js: his heading is atan2(sin yaw, -cos yaw) from behind him). */
export const yawBehind = (heading) => wrap(Math.PI - heading);

/** A swing of the view from `from` to `to` by the short way: its time from how far it goes. */
export function planRecenter(from, to) {
  const d = wrap(to - from), mean = (RECENTER.rate / 1.875) * (Math.PI / 180);   // smootherstep's steepest is 1.875 times its mean
  return { from, to: from + d, dur: Math.max(RECENTER.min, Math.abs(d) / mean) };
}
/** Where the swing has the view at `t` seconds. */
export function recenterYaw(plan, t) {
  const u = Math.min(1, Math.max(0, t / plan.dur)), k = u * u * u * (u * (u * 6 - 15) + 10);
  return plan.from + (plan.to - plan.from) * k;
}

/** The drift. `hand()` when the visitor turns the view; `step(dt, yaw, { going, by })` gives the view's yaw this frame. */
export function createFollowTurn() {
  let since = 0, v = 0;
  return {
    hand() { since = 0; v = 0; },
    get idle() { return since; },
    step(dt, yaw, { going = null, by = null } = {}) {
      since += dt;
      if (going === null || by !== "route" || since < FOLLOW_TURN.wait) { v = 0; return yaw; }
      const want = yawBehind(going), d = wrap(want - yaw), top = (FOLLOW_TURN.speed * Math.PI) / 180;
      // gathering speed over `ease`, and slowing as it comes round (never past it)
      const cap = Math.min(top, Math.sqrt(2 * (top / FOLLOW_TURN.ease) * Math.abs(d)));
      v = Math.min(cap, v + (top / FOLLOW_TURN.ease) * dt);
      const step = Math.min(Math.abs(d), v * dt);
      return yaw + Math.sign(d) * step;
    },
  };
}
