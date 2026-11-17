import { JUMP } from "./stride.js";
// Deliberate hops from authored, unrailed porch edges; not a general wall/cliff jump.
export const MAX_DROP = 1.5;
export function findDrop(walker, edges, x, z, dx, dz) {
  if (walker.room || Math.hypot(dx, dz) < 0.01) return null;
  const length = Math.hypot(dx, dz); dx /= length; dz /= length;
  for (const edge of edges) {
    const [nx, nz] = edge.normal, ax = edge.b[0] - edge.a[0], az = edge.b[1] - edge.a[1], span = Math.hypot(ax, az);
    if (dx * nx + dz * nz < 0.65 || span < 0.6) continue;
    const along = ((x - edge.a[0]) * ax + (z - edge.a[1]) * az) / span;
    const back = (x - edge.a[0]) * nx + (z - edge.a[1]) * nz;
    if (along < 0.25 || along > span - 0.25 || back > 0.01 || back < -0.65 || Math.abs(walker.heightAt(x, z) - edge.top) > 0.03) continue;
    const tx = edge.a[0] + ax * along / span + nx * 0.9, tz = edge.a[1] + az * along / span + nz * 0.9, y = walker.heightAt(tx, tz), fall = edge.top - y;
    if (fall < 0.2 || fall > MAX_DROP) continue;
    let clear = true;
    for (const [ox, oz] of [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25], [0.17, 0.17], [0.17, -0.17], [-0.17, 0.17], [-0.17, -0.17]]) if (walker.blocked(tx + ox, tz + oz) || Math.abs(walker.heightAt(tx + ox, tz + oz) - y) > 0.04) clear = false;
    if (!clear) continue;
    // Clear the ledge and the trailing foot before descending below the takeoff plane.
    const travel = 0.9 - back, fraction = (-back + 0.3) / travel, gravity = 9.8;
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
const FOOT = 0.3, LAND = 0.4;   // his leading foot reaches this far ahead of him; he comes down this far in from the edge
export function findClimb(walker, edges, x, z, dx, dz) {
  if (walker.room || Math.hypot(dx, dz) < 0.01) return null;
  const length = Math.hypot(dx, dz); dx /= length; dz /= length;
  const ground = walker.heightAt(x, z);
  for (const edge of edges) {
    const [nx, nz] = edge.normal, ax = edge.b[0] - edge.a[0], az = edge.b[1] - edge.a[1], span = Math.hypot(ax, az), rise = edge.top - ground;
    if (dx * nx + dz * nz > -0.65 || span < 0.6 || rise < 0.1 || rise > REACH * 0.995) continue;   // facing the edge, a platform he can reach
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
    const v = JUMP.speed, g = JUMP.gravity, duration = (v + Math.sqrt(v * v - 2 * g * rise)) / g;
    const need = Math.min(rise + 0.04, rise + 0.5 * (REACH - rise)), tUp = (v - Math.sqrt(v * v - 2 * g * need)) / g, travel = out + LAND, cross = (out - FOOT) / travel;
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
