// Where the things that fall come from, and where they come down. Leaves and petals do not fall out of the open air: they
// come off the maples and ginkgos, thickest under the crown and gone a dozen metres away; the few narrow leaves of bamboo
// come off the grove. Under a roof nothing falls (the same map that keeps the snow off, shelter.js). A leaf then falls to
// the ground, to the height the walker says the ground is there, lies on it for a few seconds and fades.
// All of it is worked out here from the plan and baked once into one small map seen from above (three channels of
// density, one byte each, and the height of the ground, four points to the metre); drift.js reads that map in its
// vertex shader, and the unit tests and the page's `__drift()` read the same numbers in Node through `leafAt`, which
// follows the shader's sums line for line.
import { shelterAt } from "./shelter.js";

// Which trees let go of what: an autumn maple and ginkgo drop leaves, a spring maple its pale flowers (the ginkgo is
// only green then). Snow and fireflies have no source: they come from the whole sky.
export const SOURCES = { leaf: ["maple", "ginkgo"], petal: ["maple"] };
export const CHANNEL = { leaf: 0, petal: 1, bamboo: 2 };
export const REACH = 14;               // metres from a trunk beyond which nothing falls from it
export const BAMBOO_REACH = 4;         // and from the edge of the grove
export const PER_M = 4;                // points of the map to a metre (a leaf comes to rest at the middle of one)
// A leaf's life: it starts HEIGHT over the ground, falls at its own speed, lies REST seconds (3.2 to 6.2) and fades over FADE.
export const LAND = { HEIGHT: 6, REST: [3.2, 3.0], FADE: 1.5, IN: 0.6, LIE: 0.02 };
export const NO_GROUND = -1000;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

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
// Full inside the grove's areas, gone BAMBOO_REACH beyond them.
export function bambooFrom(areas, x, z) {
  let d = 0;
  for (const a of areas) { const r = Math.hypot(Math.max(a.x0 - x, 0, x - a.x1), Math.max(a.z0 - z, 0, z - a.z1)); d = Math.max(d, 1 - smooth(0, BAMBOO_REACH, r)); }
  return d;
}

// The map. `land(x, z)` (the walker's landAt) fills the ground channel when it is given; the tests go without.
export function bakeFall(trees, areas = [], land = null) {
  const own = trees.filter((t) => SOURCES.leaf.includes(t[3]));
  const xs = [...own.map((t) => [t[0] - REACH, t[0] + REACH]), ...areas.map((a) => [a.x0 - BAMBOO_REACH, a.x1 + BAMBOO_REACH])], zs = [...own.map((t) => [t[2] - REACH, t[2] + REACH]), ...areas.map((a) => [a.z0 - BAMBOO_REACH, a.z1 + BAMBOO_REACH])];
  if (!xs.length) return null;
  const x0 = Math.floor(Math.min(...xs.map((r) => r[0]))) - 1, z0 = Math.floor(Math.min(...zs.map((r) => r[0]))) - 1;
  const W = Math.ceil((Math.max(...xs.map((r) => r[1])) + 1 - x0) * PER_M), H = Math.ceil((Math.max(...zs.map((r) => r[1])) + 1 - z0) * PER_M);
  const data = new Uint8Array(W * H * 4), ground = land ? new Float32Array(W * H) : null;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) / PER_M, z = z0 + (j + 0.5) / PER_M, o = (j * W + i) * 4;
    data[o] = Math.round(255 * fallFrom(trees, "leaf", x, z)); data[o + 1] = Math.round(255 * fallFrom(trees, "petal", x, z)); data[o + 2] = Math.round(255 * bambooFrom(areas, x, z)); data[o + 3] = 255;
    if (ground) ground[j * W + i] = land(x, z);
  }
  return { data, ground, W, H, box: [x0, z0, 1 / (W / PER_M), 1 / (H / PER_M)] };
}

const cell = (map, x, z) => {
  const u = (x - map.box[0]) * map.box[2], v = (z - map.box[1]) * map.box[3];
  return u <= 0 || u >= 1 || v <= 0 || v >= 1 ? -1 : Math.min(map.H - 1, Math.floor(v * map.H)) * map.W + Math.min(map.W - 1, Math.floor(u * map.W));
};
// What the cloud shows at a point, 0 to 1, as the vertex shader works it out: the source map (nearest point) for one of
// leaf, petal and bamboo, and nothing where a roof keeps it off. `y` is the height of the thing falling.
export function fallAt(map, kind, shelter, x, y, z) {
  const c = map ? cell(map, x, z) : -1; if (c < 0) return 0;
  return (map.data[c * 4 + CHANNEL[kind]] / 255) * (1 - shelterAt(shelter, x, y, z));
}
export const groundAt = (map, x, z) => { const c = cell(map, x, z); return c < 0 || !map.ground ? NO_GROUND : map.ground[c]; };

// Where one leaf of the cloud is at time `t`, and how it lies. The same sums as drift.js's vertex shader, in doubles:
// `s` is its four seeds, `fall` and `sway` its kind's. It begins a cycle high over a spot picked from the golden-ratio
// sequence (a new spot every cycle), snapped to the middle of a map point, drops and loses its sway as it comes down,
// lies on the ground for REST seconds and fades. (The grove's own narrow leaves pass their own `fall` and `sway`.)
export function leafAt(map, s, t, { fall, sway, B = [34, 13, 34] }, cam = [0, 0, 0]) {
  const v = fall * (0.6 + 0.8 * s[3]), Tf = LAND.HEIGHT / v, Tr = LAND.REST[0] + LAND.REST[1] * fract(s[1] * 13.7), P = Tf + Tr + LAND.FADE;
  const off = fract(s[1] * 7.7) * P, ph = (t + off) % P, cyc = Math.floor((t + off) / P);
  let bx = fract(s[0] + cyc * 0.7548776) * B[0], bz = fract(s[2] + cyc * 0.5698403) * B[2];
  bx = (Math.floor(bx * PER_M) + 0.5) / PER_M; bz = (Math.floor(bz * PER_M) + 0.5) / PER_M;
  bx = ((bx - cam[0] + B[0] / 2) % B[0] + B[0]) % B[0] - B[0] / 2 + cam[0]; bz = ((bz - cam[2] + B[2] / 2) % B[2] + B[2]) % B[2] - B[2] / 2 + cam[2];
  const k = Math.min(ph / Tf, 1), g = map && map.ground ? groundAt(map, bx, bz) : NO_GROUND;
  const rest = ph >= Tf, alpha = smooth(0, LAND.IN, ph) * (1 - smooth(Tf + Tr, P, ph));
  return { x: bx + Math.sin(ph * 0.7 + s[3] * 40) * sway * (1 - k), y: g + LAND.LIE + LAND.HEIGHT * (1 - k), z: bz + Math.cos(ph * 0.53 + s[3] * 31) * sway * 0.7 * (1 - k), ground: g, bx, bz, rest, alpha, ph, Tf, Tr, P, live: g > NO_GROUND / 2 };
}
