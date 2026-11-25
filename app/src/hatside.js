// Where the novice lays his hat when he sits down on a cushion (#664): at his right, unless something stands there and
// his left is open. What stands there is asked of the walker a step and a half from the cushion's middle, past the
// cushion's own ring (a wall of the tea house beside its mats, the stand between the two cushions before an altar).
// Returns -1 for his right, 1 for his left, as monk.update's `grounding.hat` takes it.
export const HAT_ASK = 0.75;
export function hatSide(walker, x, z, face) {
  const shut = (s) => walker.blocked(x + s * HAT_ASK * Math.cos(face), z - s * HAT_ASK * Math.sin(face));
  return shut(-1) && !shut(1) ? 1 : -1;
}
