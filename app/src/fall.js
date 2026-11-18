// Where the things that fall come from. Leaves and petals do not fall out of the open air: they come off the maples and
// ginkgos, thickest under the crown and gone a dozen metres away, so the bamboo and the stair, which have no such tree,
// stay clear of them. Under a roof nothing falls (the same map that keeps the snow off, shelter.js). The density is worked
// out here from the plan's trees and baked once into a small map seen from above; drift.js reads that map in its vertex
// shader, and the unit tests read the same numbers in Node.
import { shelterAt } from "./shelter.js";

// Which trees let go of what: an autumn maple and ginkgo drop leaves, a spring maple its pale flowers (the ginkgo is
// only green then). Snow and fireflies have no source: they come from the whole sky.
export const SOURCES = { leaf: ["maple", "ginkgo"], petal: ["maple"] };
export const REACH = 14;               // metres from a trunk beyond which nothing falls from it
export const PER_M = 2;                // points of the map to a metre
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Full under the crown (its radius grows with the tree), falling to nothing at REACH.
export function fallFrom(trees, drift, x, z) {
  const kinds = SOURCES[drift]; if (!kinds) return 1;
  let d = 0;
  for (const [tx, , tz, kind, h] of trees) {
    if (!kinds.includes(kind)) continue;
    const r = Math.hypot(x - tx, z - tz), crown = 2.5 + 0.2 * h;
    d = Math.max(d, 1 - smooth(crown, REACH, r));
  }
  return d;
}

// The map for one kind, one byte a point (so that it may be filtered everywhere).
export function bakeFall(trees, drift) {
  const kinds = SOURCES[drift]; if (!kinds) return null;
  const own = trees.filter((t) => kinds.includes(t[3])); if (!own.length) return null;
  const x0 = Math.floor(Math.min(...own.map((t) => t[0])) - REACH) - 1, z0 = Math.floor(Math.min(...own.map((t) => t[2])) - REACH) - 1;
  const W = Math.ceil((Math.max(...own.map((t) => t[0])) + REACH + 1 - x0) * PER_M), H = Math.ceil((Math.max(...own.map((t) => t[2])) + REACH + 1 - z0) * PER_M);
  const data = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) data[j * W + i] = Math.round(255 * fallFrom(own, drift, x0 + (i + 0.5) / PER_M, z0 + (j + 0.5) / PER_M));
  return { data, W, H, box: [x0, z0, 1 / (W / PER_M), 1 / (H / PER_M)] };
}

// What the cloud shows at a point, 0 to 1, as the vertex shader works it out: the source map (nearest point), and
// nothing where a roof keeps it off. `y` is the height of the thing falling.
export function fallAt(map, shelter, x, y, z) {
  if (!map) return 1 - shelterAt(shelter, x, y, z);
  const u = (x - map.box[0]) * map.box[2], v = (z - map.box[1]) * map.box[3];
  if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0;
  const d = map.data[Math.min(map.H - 1, Math.floor(v * map.H)) * map.W + Math.min(map.W - 1, Math.floor(u * map.W))] / 255;
  return d * (1 - shelterAt(shelter, x, y, z));
}
