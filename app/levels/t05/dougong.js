// The great hall's bracket sets, as a Liao hall of this rank carries its eave (docs/t05/ARCHITECTURE.md §0 item 5, §4.1):
// seven-puzuo, two plain arms out and then two slanting arms (双抄双下昂), the arms crossed by double cross-arms only on
// alternate steps (重栱偷心造). One set on every column head and one in the middle of every bay, and at each corner a set
// whose arms reach out along both sides and along the diagonal. Every size is in fen, the fifteenth of the timber's depth
// (Yingzao Fashi, juan 4: a timber 15 fen deep and 10 thick, the gap between two timbers 6), and the timber's depth is
// whatever brings the eave purlin up under the roof at its place (hall.js works it out; it comes to about 0.28 m, which
// is S04's measured timber).
//
// A set is built in its own frame: x along the wall, z out from the column line toward the court, y up from the top of
// the cap board it stands on. What runs along the wall from set to set (the column-head beams, and the eave purlin on the
// outermost arms) is not part of a set: hall.js lays it whole along each side.
import * as THREE from "three";
import { plain } from "../../src/geo.js";

/**
 * Fen. `dou`: the great block on the column head (width, height, the foot's width and height); `small`: the small blocks
 * on the arms' ends; `arm`: a plain arm's depth and thickness; `tier`: how far one arm stands above the one below (a timber
 * and a gap); `jump`: how far each step reaches out; `ni`, `man`, `gua`, `ling`: the cross-arms' lengths along the wall
 * (the first on the column line, the long one over it, the short cross-arm, the last one under the purlin); `ang`: the
 * slanting arms (how far the tail lies in and how high, how far the beak hangs below its tier); `purlin`: the eave purlin's
 * depth and thickness; `shy`: what an arm along the wall leaves off top and bottom where it crosses an arm going out, so
 * that two faces never lie on one plane (#688).
 */
export const DOU = Object.freeze({
  dou: { w: 32, h: 20, foot: 24, footH: 8 },
  small: { w: 14, h: 10, d: 16 },
  arm: { h: 15, t: 10 },
  tier: 21,
  jump: 30,
  ni: 62, man: 92, gua: 62, ling: 72,
  ang: { tail: 60, rise: 34, drop: 12 },
  purlin: { h: 30, t: 10 },
  shy: 0.003,
});
/** How many steps out (each side's step, measured along either side) the corner set's two diagonal slanting arms reach: within the
 *  sides' four, not out to the eave purlins' crossing. */
export const CORNER_REACH = Object.freeze([2.6, 3.3]);
/** The number of steps out (four: two plain arms, two slanting) and the height, in fen, from the cap board to the eave purlin's top. */
export const STEPS = 4;
export const HEIGHT = (f = 1) => (DOU.dou.h - 8 + DOU.tier * STEPS + DOU.arm.h + 6 + DOU.purlin.h) * f;   // (the first arm sits 8 fen down into the great block)
/** How far out from the column line the eave purlin's middle lies. */
export const REACH = (f = 1) => DOU.jump * STEPS * f;

/**
 * An arm: a timber `len` long and `h` deep, its two ends rounded off underneath (juansha, the Yingzao Fashi's curved cut),
 * laid along x (or along z), its middle at (cx, y-bottom, cz).
 */
function arm(len, h, t, along, cx, y, cz) {
  const L = len / 2, e = Math.min(h * 1.1, len * 0.22), sh = new THREE.Shape([[-L, h], [L, h], [L, h * 0.55], [L - e * 0.4, h * 0.2], [L - e, 0], [-L + e, 0], [-L + e * 0.4, h * 0.2], [-L, h * 0.55]].map(([a, b]) => new THREE.Vector2(a, b)));
  const g = plain(new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -t / 2));
  if (along === "z") g.rotateY(-Math.PI / 2);
  return g.translate(cx, y, cz);
}
const block = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
/**
 * A slanting arm (下昂) running out along `dir` (a unit vector in the plan), from its tail `tail` fen in from the column line
 * and `rise` over its tier, down through the tier at the step before its own, to its beak `out` fen out and `drop` under the
 * tier: a timber a depth deep, its outer end cut to a point that hangs down (the beak).
 */
function slant(f, dir, y, out, tailIn, rise, drop) {
  const D = DOU, a = new THREE.Vector3(-dir[0] * tailIn * f, (y + rise) * f, -dir[1] * tailIn * f), b = new THREE.Vector3(dir[0] * out * f, (y - drop) * f, dir[1] * out * f);
  const v = b.clone().sub(a), L = v.length(), h = D.arm.h * f, t = D.arm.t * f;
  // its side, in (along, up), the beak cut back on its underside
  const sh = new THREE.Shape([[0, 0], [L - 1.6 * h, 0], [L, -0.15 * h], [L - 0.15 * h, h * 0.55], [L - 0.5 * h, h], [0, h]].map(([p, q]) => new THREE.Vector2(p, q)));
  const g = plain(new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 1 }).translate(0, -h / 2, -t / 2));
  const flat = new THREE.Vector3(v.x, 0, v.z).normalize(), pitch = Math.atan2(v.y, Math.hypot(v.x, v.z));
  g.rotateZ(pitch).rotateY(-Math.atan2(flat.z, flat.x));
  return g.translate(a.x, a.y, a.z);
}

/**
 * One set on a column head or in a bay, in its own frame, at fen size `f` (metres). Returns its geometries.
 * @param {number} f
 */
export function bracketSet(f) {
  const D = DOU, out = [], A = D.arm, s = D.shy, b = (k) => (D.dou.h - 8 + D.tier * k) * f;   // the bottom of the arm k tiers up
  // the great block, narrower at its foot
  out.push(block(D.dou.foot * f, D.dou.footH * f, D.dou.foot * f, 0, 0, 0), block(D.dou.w * f, (D.dou.h - D.dou.footH) * f, D.dou.w * f, 0, D.dou.footH * f, 0));
  const small = (x, y, z) => out.push(block(D.small.w * f, D.small.h * f, D.small.d * f, x * f, y, z * f));
  const along = (len, k, z) => { out.push(arm(len * f, A.h * f - 2 * s, A.t * f, "x", 0, b(k) + s, z * f)); for (const e of [-1, 1]) small(e * (len / 2 - D.small.w / 2), b(k) + A.h * f, z); };
  // Along the wall: the first cross-arm on the column line, the long one over it (the beams above them are hall.js's).
  along(D.ni, 0, 0); along(D.man, 1, 0);
  // Out and in: two plain arms, the first one step each way, the second two; only the second carries cross-arms at its outer
  // end (the first is left bare: 偷心), the short and the long one over it. Inward the same two arms, bare, under the frame.
  out.push(arm(2 * D.jump * f, A.h * f, A.t * f, "z", 0, b(0), 0)); small(0, b(0) + A.h * f, D.jump); small(0, b(0) + A.h * f, -D.jump);
  out.push(arm(4 * D.jump * f, A.h * f, A.t * f, "z", 0, b(1), 0)); small(0, b(1) + A.h * f, 2 * D.jump); small(0, b(1) + A.h * f, -2 * D.jump);
  along(D.gua, 2, 2 * D.jump); along(D.man, 3, 2 * D.jump);
  // The two slanting arms: their beaks hang out at the third and fourth steps; their tails rise in over the wall.
  out.push(slant(f, [0, 1], D.dou.h - 8 + D.tier * 2, 3 * D.jump, D.ang.tail, D.ang.rise, D.ang.drop));
  out.push(slant(f, [0, 1], D.dou.h - 8 + D.tier * 3, 4 * D.jump, D.ang.tail * 0.7, D.ang.rise, D.ang.drop));
  small(0, b(3) + A.h * f * 0.4, 3 * D.jump);
  // The last cross-arm under the purlin, at the fourth step, crossed by the beam-head (shuatou) that runs out past it.
  along(D.ling, 4, 4 * D.jump);
  out.push(arm((D.jump * 2 + 24) * f, A.h * f, A.t * f, "z", 0, b(4), (3 * D.jump + 12) * f));
  return out;
}

/**
 * A corner set, in the frame of the east end of the front (x out along the end, z out along the front): the plain arms and
 * the slanting arms reach out along both, and a third run of them along the diagonal, each step root-2 as long; the cross-arms of
 * each side become the other's arms going out, so nothing is laid twice.
 * @param {number} f
 */
export function cornerSet(f) {
  const D = DOU, out = [], A = D.arm, s = D.shy, b = (k) => (D.dou.h - 8 + D.tier * k) * f, r2 = Math.SQRT2;
  out.push(block(D.dou.foot * f * 1.1, D.dou.footH * f, D.dou.foot * f * 1.1, 0, 0, 0), block(D.dou.w * f * 1.1, (D.dou.h - D.dou.footH) * f, D.dou.w * f * 1.1, 0, D.dou.footH * f, 0));
  const small = (x, y, z) => out.push(block(D.small.w * f, D.small.h * f, D.small.d * f, x * f, y, z * f));
  // out along z (the front) and along x (the end): the x ones a hair shallower, where they cross the z ones
  for (const [ax, sh] of /** @type {[string, number][]} */ ([["z", 0], ["x", s]])) {
    const at = (u) => (ax === "z" ? [0, u] : [u, 0]);
    for (const [k, n] of [[0, 1], [1, 2]]) {
      out.push(arm((n * D.jump + D.jump) * f, A.h * f - 2 * sh, A.t * f, ax, ...(ax === "z" ? [0, b(k) + sh, (n * D.jump - D.jump) / 2 * f] : [(n * D.jump - D.jump) / 2 * f, b(k) + sh, 0])));
      const [x, z] = at(n * D.jump); small(x, b(k) + A.h * f, z);
    }
    const dir = ax === "z" ? [0, 1] : [1, 0];
    out.push(slant(f, dir, D.dou.h - 8 + D.tier * 2 + (sh ? 0.4 : 0), 3 * D.jump, D.ang.tail * 0.5, D.ang.rise, D.ang.drop));
    out.push(slant(f, dir, D.dou.h - 8 + D.tier * 3 + (sh ? 0.4 : 0), 4 * D.jump, D.ang.tail * 0.4, D.ang.rise, D.ang.drop));
    // the last cross-arm at the fourth step of this side, reaching from the corner back along it
    const [x4, z4] = at(4 * D.jump);
    out.push(ax === "z" ? arm(D.ling * f, A.h * f - 2 * s, A.t * f, "x", -D.ling * f / 2 + 4 * D.jump * f, b(4) + s, z4 * f) : arm(D.ling * f, A.h * f - 2 * s, A.t * f, "z", x4 * f, b(4) + s, -D.ling * f / 2 + 4 * D.jump * f));
    // and the short cross-arm at the second step
    const [x2, z2] = at(2 * D.jump);
    out.push(ax === "z" ? arm(D.gua * f, A.h * f - 2 * s, A.t * f, "x", 0, b(2) + s, z2 * f) : arm(D.gua * f, A.h * f - 2 * s, A.t * f, "z", x2 * f, b(2) + s, 0));
  }
  // the diagonal: two plain arms and two slanting ones, each step root-2 as long, standing a little lower than the sides'
  // tiers' tops (the corner's arms are deeper, 角栱), so that no top lies on theirs
  const d = [Math.SQRT1_2, Math.SQRT1_2];
  for (const [k, n] of [[0, 1], [1, 2]]) {
    const len = n * D.jump * r2 + D.jump * 0.4, g = arm(len * f, A.h * f * 1.15, A.t * f * 1.2, "x", len * f / 2 - D.jump * 0.2 * f, b(k) - 0.004, 0);
    out.push(g.rotateY(-Math.PI / 4)); small(n * D.jump, b(k) + A.h * f * 1.15, n * D.jump);
  }
  // (held in among the sides' arms and hanging their beaks steeply: carried out to the eave purlins' crossing, a metre and a half
  // under it with nothing beside them out there, the last one stuck out flat from the corner like a pole, the handover of #741)
  out.push(slant(f, d, D.dou.h - 8 + D.tier * 2 - 0.5, CORNER_REACH[0] * D.jump * r2, D.ang.tail * 0.4, D.ang.rise, D.ang.drop * 2));
  out.push(slant(f, d, D.dou.h - 8 + D.tier * 3 - 0.5, CORNER_REACH[1] * D.jump * r2, D.ang.tail * 0.3, D.ang.rise, D.ang.drop * 2));
  return out;
}
