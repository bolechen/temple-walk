import { JUMP } from "./stride.js";
// Deliberate hops from authored, unrailed porch edges; not a general wall/cliff jump.
export const MAX_DROP = 1.5;
/** How far out from a porch's edge he may come down, nearest last: the first of these where the ground is clear (#274). */
export const LAND_OUT = Object.freeze([0.9, 0.75, 0.6]);
export function findDrop(walker, edges, x, z, dx, dz) {
  if (walker.room || Math.hypot(dx, dz) < 0.01) return null;
  const length = Math.hypot(dx, dz); dx /= length; dz /= length;
  for (const edge of edges) {
    const [nx, nz] = edge.normal, ax = edge.b[0] - edge.a[0], az = edge.b[1] - edge.a[1], span = Math.hypot(ax, az);
    if (dx * nx + dz * nz < 0.65 || span < 0.6) continue;
    const along = ((x - edge.a[0]) * ax + (z - edge.a[1]) * az) / span;
    const back = (x - edge.a[0]) * nx + (z - edge.a[1]) * nz;
    if (along < 0.25 || along > span - 0.25 || back > 0.01 || back < -0.65 || Math.abs(walker.heightAt(x, z) - edge.top) > 0.03) continue;
    // Where he comes down: 0.9 m out, on ground clear a quarter of a metre round; or, where that is a wall (a lane between a
    // platform and the court's wall, #274: the tea house's back), nearer, on ground clear a quarter of a metre along the edge.
    let tx = 0, tz = 0, y = 0, out = 0;
    for (const o of LAND_OUT) {
      const px = edge.a[0] + ax * along / span + nx * o, pz = edge.a[1] + az * along / span + nz * o, py = walker.heightAt(px, pz), fall = edge.top - py;
      if (fall < 0.2 || fall > MAX_DROP) continue;
      const round = o === LAND_OUT[0] ? [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25], [0.17, 0.17], [0.17, -0.17], [-0.17, 0.17], [-0.17, -0.17]] : [[0, 0], [ax / span * 0.25, az / span * 0.25], [-ax / span * 0.25, -az / span * 0.25]];
      if (round.some(([ox, oz]) => walker.blocked(px + ox, pz + oz) || Math.abs(walker.heightAt(px + ox, pz + oz) - py) > 0.04)) continue;
      tx = px; tz = pz; y = py; out = o; break;
    }
    if (!out) continue;
    const fall = edge.top - y;
    // Clear the ledge and the trailing foot before descending below the takeoff plane.
    const travel = out - back, fraction = (-back + 0.3) / travel, gravity = 9.8;
    const lift = Math.max(1.7, Math.sqrt(gravity * fall * fraction * fraction / (2 * (1 - fraction))) + 0.25);
    const duration = (lift + Math.sqrt(lift * lift + 2 * gravity * fall)) / gravity;
    return { from: [x, edge.top, z], to: [tx, y, tz], normal: edge.normal, lift, gravity, duration };
  }
  return null;
}
export function dropPose(plan, elapsed) {
  const time = Math.min(plan.duration, Math.max(0, elapsed)), f = time / plan.duration, done = time >= plan.duration;
  return { x: done ? plan.to[0] : plan.from[0] + (plan.to[0] - plan.from[0]) * f, z: done ? plan.to[2] : plan.from[2] + (plan.to[2] - plan.from[2]) * f,
    y: done ? plan.to[1] : plan.from[1] + plan.lift * time - plan.gravity * time * time / 2, done };
}
// A hop up onto a seat too high for him to step onto (a stool is a grown man's sitting height and he is a child): his
// own jump (JUMP in stride.js, after 《小王子》's player, which jumps by its own gravity), or a harder one if the seat asks
// it, so that he comes down on the seat's top, at its middle, just after the top of his rise. `dropPose` walks it.
export function seatHop(from, to, speed = 3.0, gravity = 9.8) {
  const rise = to[1] - from[1], lift = Math.max(speed, Math.sqrt(2 * gravity * (rise + 0.03)));
  const duration = (lift + Math.sqrt(Math.max(0, lift * lift - 2 * gravity * rise))) / gravity;
  return { from: [...from], to: [...to], lift, gravity, duration };
}

// The way up: from the ground below an unrailed porch edge, facing it, a jump onto a platform no higher than his own jump
// reaches. How high that is comes from JUMP (the top of the arc, v²/2g), not from a number of its own.
export const REACH = JUMP.speed * JUMP.speed / (2 * JUMP.gravity);
// How far over a platform's drawn top the arc keeps him, and so how much higher than REACH a top may be found and still be
// offered (#265, the migration's list for #143): the floor baked from the drawn meshes is the drawn porch (0.454 m drawn,
// 0.45 in the grid's centimetres) and his plain jump tops out at 0.459, too thin a margin to hang the way up on. Over
// REACH - CLEARANCE he jumps that little harder, so that he always clears the edge by CLEARANCE.
export const CLEARANCE = 0.02;
const FOOT = 0.3, LAND = 0.4;   // his leading foot reaches this far ahead of him; he comes down this far in from the edge
export function findClimb(walker, edges, x, z, dx, dz) {
  if (walker.room || Math.hypot(dx, dz) < 0.01) return null;
  const length = Math.hypot(dx, dz); dx /= length; dz /= length;
  const ground = walker.heightAt(x, z);
  for (const edge of edges) {
    const [nx, nz] = edge.normal, ax = edge.b[0] - edge.a[0], az = edge.b[1] - edge.a[1], span = Math.hypot(ax, az), rise = edge.top - ground;
    if (dx * nx + dz * nz > -0.65 || span < 0.6 || rise < 0.1 || rise > REACH + CLEARANCE) continue;   // facing the edge, a platform he can reach
    const along = ((x - edge.a[0]) * ax + (z - edge.a[1]) * az) / span, out = (x - edge.a[0]) * nx + (z - edge.a[1]) * nz;
    if (along < 0.25 || along > span - 0.25 || out < FOOT || out > 1.2) continue;   // outside the edge, near enough to reach it
    const tx = edge.a[0] + ax * along / span - nx * LAND, tz = edge.a[1] + az * along / span - nz * LAND, y = walker.heightAt(tx, tz);
    if (Math.abs(y - edge.top) > 0.03) continue;
    // The porch strip along an edge is narrow (the apron is walled off), so the landing is only held to be clear along it.
    let clear = true;
    for (const k of [0, 0.15, -0.15]) { const px = tx + ax / span * k, pz = tz + az / span * k; if (walker.blocked(px, pz) || Math.abs(walker.heightAt(px, pz) - y) > 0.03) { clear = false; break; } }
    if (!clear) continue;
    // The arc is his own (JUMP): up, and down again to the platform's height. He gathers himself and goes over late, so that
    // the leading foot reaches the edge after the arc has risen above it (the nearer the top of his jump, the later).
    const g = JUMP.gravity, v = Math.max(JUMP.speed, Math.sqrt(2 * g * (rise + CLEARANCE))), top = v * v / (2 * g), duration = (v + Math.sqrt(v * v - 2 * g * rise)) / g;
    const need = Math.min(rise + 0.04, rise + 0.5 * (top - rise)), tUp = (v - Math.sqrt(v * v - 2 * g * need)) / g, travel = out + LAND, cross = (out - FOOT) / travel;
    const ease = Math.max(1, Math.log(Math.max(cross, 1e-3)) / Math.log(Math.min(0.999, tUp / duration)));
    return { from: [x, ground, z], to: [tx, y, tz], normal: edge.normal, rise, speed: v, gravity: g, duration, ease };
  }
  return null;
}
export function climbPose(plan, elapsed) {
  const time = Math.min(plan.duration, Math.max(0, elapsed)), done = time >= plan.duration, f = Math.pow(time / plan.duration, plan.ease);
  return { x: done ? plan.to[0] : plan.from[0] + (plan.to[0] - plan.from[0]) * f, z: done ? plan.to[2] : plan.from[2] + (plan.to[2] - plan.from[2]) * f,
    y: done ? plan.to[1] : plan.from[1] + plan.speed * time - plan.gravity * time * time / 2, done };
}

// Walking off a low edge (#294): the owner stood on the tea house's porch, saw the court below, and could not get down
// without facing the edge squarely and pressing Space. A ledge no deeper than his leg he now walks down, as a child steps
// off a kerb: his leg, hip to sole, is 0.50 m (monk.js: the hips stand 0.50 m over the sole, thigh 0.22, shin 0.22, the
// ankle 0.06), and with the standing knee bent his leading foot reaches that far down. Deeper than that he jumps, by Space.
export const STEP_DOWN = 0.5;
// He steps down only when the way he walks points out over the edge within 45° (the outward part of his step at least
// cos 45° of it); along the edge, or across it at a slant, he goes on along the porch as before.
export const STEP_FACING = Math.SQRT1_2;
// Where his foot comes down: the nearest of these out from the edge where the ground is clear (a step, not a leap).
export const STEP_OUT = Object.freeze([0.6, 0.75, 0.9]);
const STEP_PACE = 1.6;   // metres a second over the step: a little slower than his walk, as one goes down a step

/**
 * The step down off a low edge before him, or null: as findDrop, but only for a ledge no deeper than STEP_DOWN, only when
 * he walks out over it within 45°, and coming down nearer, at a walk. `stepPose` walks it.
 */
export function findStep(walker, edges, x, z, dx, dz) {
  if (walker.room || walker.loft || Math.hypot(dx, dz) < 0.01) return null;
  const length = Math.hypot(dx, dz); dx /= length; dz /= length;
  for (const edge of edges) {
    const [nx, nz] = edge.normal, ax = edge.b[0] - edge.a[0], az = edge.b[1] - edge.a[1], span = Math.hypot(ax, az);
    if (dx * nx + dz * nz < STEP_FACING || span < 0.6) continue;
    const along = ((x - edge.a[0]) * ax + (z - edge.a[1]) * az) / span, back = (x - edge.a[0]) * nx + (z - edge.a[1]) * nz;
    if (along < 0.25 || along > span - 0.25 || back > 0.01 || back < -0.65 || Math.abs(walker.heightAt(x, z) - edge.top) > 0.03) continue;
    for (const o of STEP_OUT) {
      const px = edge.a[0] + ax * along / span + nx * o, pz = edge.a[1] + az * along / span + nz * o, py = walker.heightAt(px, pz), fall = edge.top - py;
      if (fall < 0.2 || fall > STEP_DOWN + 0.005) continue;
      if ([[0, 0], [ax / span * 0.25, az / span * 0.25], [-ax / span * 0.25, -az / span * 0.25]].some(([ox, oz]) => walker.blocked(px + ox, pz + oz) || Math.abs(walker.heightAt(px + ox, pz + oz) - py) > 0.04)) continue;
      // His body goes over the edge's line a third of the way through, and comes down as his leading foot takes his weight.
      const travel = o - back, duration = Math.max(0.45, travel / STEP_PACE), cross = Math.min(0.8, Math.max(0.2, -back / travel));
      return { step: true, from: [x, edge.top, z], to: [px, py, pz], normal: edge.normal, fall, duration, cross };
    }
  }
  return null;
}
export function stepPose(plan, elapsed) {
  const time = Math.min(plan.duration, Math.max(0, elapsed)), f = time / plan.duration, done = time >= plan.duration;
  // Level until his body is over the edge, then down, eased in and out, as his weight goes onto the lower foot.
  const d = Math.min(1, Math.max(0, (f - plan.cross) / (1 - plan.cross))), s = d * d * (3 - 2 * d);
  return { x: done ? plan.to[0] : plan.from[0] + (plan.to[0] - plan.from[0]) * f, z: done ? plan.to[2] : plan.from[2] + (plan.to[2] - plan.from[2]) * f,
    y: done ? plan.to[1] : plan.from[1] + (plan.to[1] - plan.from[1]) * s, done };
}
/**
 * Walking (keys, the stick, or a tapped way) at the edge of a low porch: the step down it, when the way ahead on the porch is
 * shut and he walks out over the edge; null otherwise. The keys, the stick and route.js ask this one question.
 */
export function stepOff(walker, x, z, dx, dz) {
  const l = Math.hypot(dx, dz); if (l < 1e-6) return null;
  if (!walker.blocked(x + (dx / l) * 0.1, z + (dz / l) * 0.1)) return null;   // the porch goes on that way: walk on
  return findStep(walker, walker.drops || [], x, z, dx, dz);
}
