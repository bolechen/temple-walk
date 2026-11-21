// Turning by the keys (#295, group C). The owner: "when I hold W, can he walk straight on, the view following him, so
// that I need not keep turning it with the mouse? It is tiring." By default A and D turn him and the view together, as
// role-playing games long did (World of Warcraft's default for years was A/D to turn and Q/E to step aside, later the
// other way round with the old one kept as an option; second-hand, the sources disagree on today's default), so W walks
// on the way he looks; the side arrows step sideways. The old way (A and D step sideways, nothing turns) is a setting.
// The stick is untouched: it walks where it is pushed.
//
// The turn gathers to its rate over KEY_TURN.ease and lets go as quickly, as a hand on a wheel does, rather than
// starting and stopping dead, which is what a jerk of the whole picture feels like.

export const KEY_TURN = Object.freeze({ rate: 120, ease: 0.15 });   // degrees a second held; seconds to gather or let go

/**
 * Which way he walks (`f` forward, `s` to his right) and turns (`turn`, +1 to his right) for the keys held and the stick.
 * @param {Record<string, boolean>} keys @param {{ x: number, y: number }} joy @param {"turn" | "strafe"} mode
 */
export function keyAxes(keys, joy, mode) {
  const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - joy.y;
  const arrows = (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0), ad = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const s = (mode === "turn" ? arrows : arrows + ad) + joy.x, turn = mode === "turn" ? ad : 0;
  return { f: f || 0, s: s || 0, turn };   // (no negative zero)
}

/** The turn's own spring. `step(dt, yaw, turn, speed = 1)` gives the view's yaw this frame. */
export function createKeyTurn() {
  let v = 0;   // radians a second, as it stands
  return {
    get rate() { return v; },
    stop() { v = 0; },
    step(dt, yaw, turn, speed = 1) {
      const top = ((KEY_TURN.rate * Math.PI) / 180) * speed, want = Math.sign(turn) * top, accel = top / KEY_TURN.ease;
      if (v < want) v = Math.min(want, v + accel * dt); else if (v > want) v = Math.max(want, v - accel * dt);
      return yaw + v * dt;
    },
  };
}
