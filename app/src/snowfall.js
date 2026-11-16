// How snow lies on the paving of the courts. The paving shader (ground.js) draws it; this is the same arithmetic in
// JavaScript, so that his steps (steps.js) and the tests know what the picture shows.
//
// Down the middle of every court the monks sweep a lane each morning: its stone shows through the night's dusting,
// snow stays packed in the joints, and what was swept lies in a low bank along both sides. Off the lane the snow lies
// deeper against walls and platforms, where the wind leaves it, and thinner, in long low waves, out in the open; none
// lies under a roof.
import { n2, fbm2 } from "./steps.js";

export const LANE = 1.7;   // half the width of the swept lane, on the court's axis (x = 0)
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// `dB`: how far the spot lies from the nearest wall or platform (the paving's light map: below nought under a roof);
// `joint`: 1 in a joint between slabs. Returns how much of the stone the snow hides (`cover`), how deep it reads
// (`depth`, about 1 for a full covering), and whether the spot is in the swept lane.
export function snowAt(x, z, { dB = 5, joint = 0 } = {}) {
  const lane = Math.abs(x) - LANE, bank = Math.exp(-(((lane - 0.32) / 0.3) ** 2)), open = smooth(-0.15, 0.2, lane);
  const deep = 0.5 + 0.6 * fbm2(x * 0.09 + 4, z * 0.09 + 4) + 0.25 * fbm2(x * 0.35 + 8, z * 0.35 + 8) + 0.45 * smooth(0, 0.2, dB) * Math.exp(-Math.max(dB, 0) * 0.7) + 0.35 * bank;
  const dust = 0.15 + 0.14 * fbm2(x * 1.3 + 2, z * 1.3 + 2) + 0.22 * smooth(-0.6, 0, lane) + joint * 0.6, grain = (n2(x * 38, z * 38) * 0.6 + n2(x * 90, z * 90) * 0.4) * 0.35;
  const roof = smooth(-0.3, 0.1, dB);
  return { cover: mix(smooth(0.46, 0.475, dust + grain), smooth(0.15, 0.3, deep), open) * roof, depth: mix(dust, deep, open) * roof, lane: lane < 0 };
}
