// The eye that follows him in the third person: a few steps behind, as low as a child and a little to one side, so
// that he stands small in the lower left of the picture and the place fills the rest. It comes in close rather than
// pass through anything solid.
//
// `x, z` is where he stands, `foot` the floor under him, `eyeY` the height the view rides at (over a stair, the slope);
// `yaw, pitch` the way the view looks, `side` how far to his right the eye would like to be, `reach` how far behind.
// Returns the point the eye backs away from (`ox, ty, oz`), the way it looks (`lx, ly, lz`), how far it may back off
// (`d`), and `at(dist)`, where the eye stands when it is `dist` behind: standing on something higher than he is (a
// platform, a stair above him), it rises enough to see his feet over its edge.
export function followEye(walker, { x, z, foot, eyeY, yaw, pitch, side, reach }) {
  const cp = Math.cos(pitch), lx = Math.sin(yaw) * cp, ly = Math.sin(pitch), lz = -Math.cos(yaw) * cp, rx = Math.cos(yaw), rz = Math.sin(yaw), ty = eyeY + 1.18;
  const shut = (px, py, pz) => walker.eyeShut(px, py, pz, foot);
  // First to his side, only as far as is open: on a porch that side may be a column, the lattice or a roof's edge.
  let s0 = 0;
  for (let k = Math.min(0.2, side); k > 0 && s0 < side; k = Math.min(side, k + 0.2)) { if (shut(x + rx * k, ty, z + rz * k)) break; s0 = k; }
  const ox = x + rx * s0, oz = z + rz * s0;
  // Then back, in short steps, and no farther than the last that was open: right against a wall it stays at his shoulder.
  let d = 0;
  for (let s = 0.25; s <= reach + 1e-3; s += 0.25) { if (shut(ox - lx * s, ty - ly * s, oz - lz * s)) break; d = s; }
  const at = (dist) => {
    const cx = ox - lx * dist, cz = oz - lz * dist, under = walker.landAt(cx, cz), y = ty - ly * dist;
    // Over a platform or a stair higher than his feet it rises to see them over the edge, but not up into an eave.
    const lifted = Math.max(y, under + 0.35 + Math.max(0, under - foot) * 1.6);
    return [cx, lifted > y && shut(cx, lifted, cz) ? y : lifted, cz];
  };
  return { ox, oz, ty, lx, ly, lz, d, side: s0, at };
}
