// One step of his walk, and his jump, as the page takes them: the walk and the tests share these.
//
// He takes the step; if something is in the way he slides along it, and failing that closes the last gap in smaller
// steps. Something round or cornered square in his way (a column, a table) he goes round, turning aside by as little
// as will let him pass, to whichever hand is nearer the way he was going. In the air it is the same: what stands in
// his way on the ground stands in his way above it, so a jump never takes him into a table or through a wall.

/** @param {{ blocked(x: number, z: number): boolean }} walker @param {{ x: number, z: number }} pos @returns {boolean} whether he moved */
export function stride(walker, pos, vx, vz) {
  let moved = false;
  for (let k = 1; k > 0.1 && !moved; k /= 2) {
    const sx = vx * k, sz = vz * k;
    if (!walker.blocked(pos.x + sx, pos.z + sz)) { pos.x += sx; pos.z += sz; moved = true; }
    else if (Math.abs(sx) > 1e-4 && !walker.blocked(pos.x + sx, pos.z)) { pos.x += sx; moved = true; }
    else if (Math.abs(sz) > 1e-4 && !walker.blocked(pos.x, pos.z + sz)) { pos.z += sz; moved = true; }
  }
  for (const a of moved ? [] : [0.5, -0.5, 0.95, -0.95, 1.35, -1.35]) {
    const c = Math.cos(a), s = Math.sin(a), sx = (vx * c - vz * s) * 0.8, sz = (vx * s + vz * c) * 0.8;
    if (!walker.blocked(pos.x + sx, pos.z + sz)) { pos.x += sx; pos.z += sz; moved = true; break; }
  }
  // Something no wider than a hand stands just across his way along a wall or a railing (a railing's post, #278): he
  // steps aside, by as little as lets the step go on, to either hand. Only when the way past it is open: walking into a
  // wall he does not shuffle along it.
  const v = Math.hypot(vx, vz);
  for (const off of moved || v < 1e-6 ? [] : [0.02, 0.04, 0.06]) for (const hand of [1, -1]) {
    const px = (-vz / v) * off * hand, pz = (vx / v) * off * hand;
    if (!walker.blocked(pos.x + px, pos.z + pz) && !walker.blocked(pos.x + px + vx, pos.z + pz + vz)) { pos.x += px + vx; pos.z += pz + vz; return true; }
  }
  return moved;
}

// Space: a child's jump, a hand and a half high. He can be steered in the air and lands on whatever is under him.
export const JUMP = { speed: 3.0, gravity: 9.8 };
/** One frame of a jump over the ground at `ground`. @param {{ y: number, v: number }} leap @returns {{ y: number, landed: boolean }} */
export function leapStep(leap, ground, dt) {
  leap.v -= JUMP.gravity * dt; leap.y += leap.v * dt;
  return leap.y <= ground ? { y: ground, landed: true } : { y: leap.y, landed: false };   // down again, on whatever he has come over
}
