// Where the novice lays his hat when he sits down on a cushion (#664): beside it, on the side away from the middle of
// the place (a hall's way from its door to its altar, the courts' axis), so that it does not lie in the way; where the
// cushion is on that middle line, at his right. If something stands on that side and the other is open, the other:
// what stands there is asked of the walker a step and a half from the cushion's middle, past the cushion's own ring
// (a wall of the tea house beside its mats, the stand between the two cushions before an altar).
// `axis` is the x of the middle of the place he is in. Returns -1 for his right, 1 for his left, as monk.update's
// `grounding.hat` takes it.
export const HAT_ASK = 0.75;
export function hatSide(walker, x, z, face, axis = 0) {
  const leftX = Math.cos(face), shut = (s) => walker.blocked(x + s * HAT_ASK * leftX, z - s * HAT_ASK * Math.sin(face));
  const want = Math.abs(x - axis) > 0.5 && Math.abs(leftX) > 0.5 ? ((x - axis) * leftX > 0 ? 1 : -1) : -1;
  return shut(want) && !shut(-want) ? -want : want;
}
