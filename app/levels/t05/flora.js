// The trees of 奉明寺 (T05), grown and not drawn as placeholders: the Chinese pine (油松), the oriental arborvitae (ce bai), the bare broadleaf
// and the Chinese white poplar (mao bai yang) of an old county town on the plain of north-east China, on an early-winter morning (J01): the
// pines and arborvitae keep their needles, a dusty olive grey, and the bare broadleaves and poplars stand bare, every bough and twig against
// the sky (docs/t05/ART.md §4.2: "院树落叶，枝干清楚"; the prologue's bamboo and cryptomerias are not grown here).
//
// What is known and what is ours (docs/t00/SOURCES.md, T05 rows): "old pines and cypresses tower in the court" (docs/t05/SOURCES.md §15) is a news
// report quoted second-hand; "the way between the gates, cypresses either side" is the scope's own invention (docs/t05/SCOPE-OPTIONS.md
// §二 B); old arborvitae with some Chinese pines inside the walls is quoted second-hand (Ming arborvitae and Qing pines along the way before the hall, the general
// director's winter research of 2026-11-25); the bare broadleaf (its species unrecorded) and the poplar (by common sense) as the town's trees, and every shape and number below, are the project's own, by common knowledge of
// the north China plain and not from any record of Yixian.
//
// The wood is grown by three's TreeGenerator (../../src/three-tree.js, as the prologue's cedars and ginkgoes are): the same seed gives the
// same tree in Node and in the browser, point for point (`floraHash`; tests/unit/t05-flora.test.mjs and the `t05-treeseed` scenario). The
// needles are lumps of the level's own dry evergreen material (./dry.js: an olive grey on a dry day, the art director's lines of #686),
// shaded as one mass round the crown and stirred a little by the breeze (wind.js's `uWind`, as the prologue's crowns stir). A tree's seed
// is taken from where it stands, so that no tree's shape depends on another's.
//
// Everything is merged by material: one draw for the wood, one for the poplars' pale bark, one for the needles, in each set the caller
// asks for (the near set casts shadows, the far one does not). That is fewer draws than instancing would be, and the shared materials
// read the world position for their grain, snow and shelter, which an instance's own matrix would not give them.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TreeGenerator } from "../../src/three-tree.js";
import { U } from "../../src/glsl.js";
import { mesh } from "../../src/geo.js";
import { dryMaterials } from "./dry.js";

/** The kinds grown here, by their botanical names (油松, ce bai, mao bai yang). */
export const KINDS = Object.freeze({ pine: "Pinus tabuliformis", cypress: "Platycladus orientalis", broad: "a deciduous broadleaf, no species recorded", poplar: "Populus tomentosa" });

/** A number in [0, 1) from where a tree stands (a hash: the layouts' own seeded streams are not touched, so that nothing the art director passed moves). */
export const hashAt = (x, z, salt = 0) => { const v = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453; return v - Math.floor(v); };
const seedAt = (x, z, k) => (Math.abs(Math.round(x * 211 + z * 37)) + k * 7919) % 2147483647 || 1;
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/**
 * What each kind is grown with, near (`n`) and far (`f`). The pine: a trunk bare for its lower part, boughs that leave it nearly level and
 * spread, the crown widest in its middle layers and flat on top, as an old 油松 is. The arborvitae: a short trunk and many boughs turned up,
 * the needles a dense flame. The bare broadleaf: a short, thick trunk dividing into boughs that spread into a round head of fine twigs. The poplar:
 * one straight leader to the top and short boughs climbing steeply along it, a narrow oval. Ours, by common knowledge of the four (no record).
 */
const GROW = {
  pine: (h, r, far) => ({ levels: far ? 2 : 3, trunkLength: h * 0.9, trunkRadius: r * 1.15, trunkClear: 0.56, children: far ? [6] : [8, 3], childRadius: far ? [0.32] : [0.32, 0.45], branchAngle: [82, 40], angleVariance: 10, lengthRatio: [0.62, 0.4], branchLengthFalloff: 0.5, taper: [0.82, 0.6], taperCurve: 0.8, rootFlare: 0.45, flareFrac: 0.06, droop: 0.05, upPull: 0.06, gnarl: [0.05, 0.14, 0.2], radialSegments: far ? [6, 3] : [8, 4, 3], sectionLength: 1.0, childStart: 0.3, minRadius: 0.012, minLength: 0.4, collar: 0.18, radiusExponent: 2.4 }),
  cypress: (h, r, far) => ({ levels: 2, trunkLength: h * 0.82, trunkRadius: r * 1.1, trunkClear: 0.06, children: [far ? 7 : 12], childRadius: [0.34], branchAngle: [34], angleVariance: 10, lengthRatio: [0.3], branchLengthFalloff: 0.55, taper: [0.85, 0.6], taperCurve: 0.85, rootFlare: 0.4, flareFrac: 0.06, droop: 0.01, upPull: 0.45, gnarl: [0.05, 0.12], radialSegments: far ? [6, 3] : [9, 4], sectionLength: 1.0, minRadius: 0.012, minLength: 0.4, collar: 0.15, radiusExponent: 2.4 }),
  // (the bare broadleaf's trunk is short and divides at 3 to 4 m into four or five thick limbs that spread and crook; its crown wider than it is tall)
  broad: (h, r, far) => ({ levels: far ? 3 : 4, trunkLength: 4.2, trunkRadius: Math.min(r * 1.2, TRUNK_MAX), trunkClear: 0.78, children: far ? [4, 5] : [5, 5, 4], childRadius: far ? [0.62, 0.42] : [0.62, 0.42, 0.42], branchAngle: [46, 40, 44], angleVariance: 14, lengthRatio: [1.25, 0.5, 0.5], branchLengthFalloff: 0, taper: [0.45, 0.65, 0.75], taperCurve: 0.75, rootFlare: 0.45, flareFrac: 0.12, droop: 0.015, upPull: 0.24, gnarl: [0.04, 0.26, 0.3, 0.32], radialSegments: far ? [7, 4, 3] : [10, 5, 4, 3], sectionLength: 0.9, childStart: 0.25, minRadius: 0.008, minLength: 0.3, collar: 0.15, radiusExponent: 2.4 }),
  poplar: (h, r, far) => ({ levels: 3, trunkLength: h, trunkRadius: Math.min(r * 1.05, TRUNK_MAX), trunkClear: 0.3, children: far ? [12, 4] : [16, 5], childRadius: [0.3, 0.45], branchAngle: [36, 28], angleVariance: 8, lengthRatio: [0.4, 0.5], branchLengthFalloff: 0.62, taper: [0.9, 0.7], taperCurve: 0.85, rootFlare: 0.35, flareFrac: 0.05, droop: 0.01, upPull: 0.42, gnarl: [0.02, 0.1, 0.18], radialSegments: far ? [7, 3] : [10, 4, 3], sectionLength: 1.0, childStart: 0.25, minRadius: 0.008, minLength: 0.35, collar: 0.12, radiusExponent: 2.4 }),
};

/** The thickest a bare broadleaf's or a poplar's trunk may be (radius, m): on the three judged pictures no trunk of a bare tree is wider than a house's door (the art director, 2026-11-25). */
export const TRUNK_MAX = 0.32;
/** How grey each kind's bark is (0: the shared red-brown, the pine's scaly bark; 1: the bare broadleaf's grey-brown), carried to the bark in the wood's second texture coordinate. */
const GREY = { pine: 0, cypress: 0.55, broad: 1, poplar: 0 };

/** A tube's point at `u` (0 at its foot, 1 at its tip). */
const along = (tube, u) => { const R = tube.rings, f = Math.min(0.999, Math.max(0, u)) * (R.length - 1), i = Math.floor(f); return R[i].pos.clone().lerp(R[i + 1].pos, f - i); };

/** The trunk's own tube (the first `tubes[0]` rings) cut out of the generator's one geometry, and the rest: the trunk can then be what the baked floor and the eye meet while the boughs are not. */
function splitTrunk(geo, tube0) {
  const nv = tube0.rings.length * tube0.radial + 1, ni = (tube0.rings.length - 1) * tube0.radial * 6 + tube0.radial * 3, idx = geo.index.array, pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
  const uv = geo.attributes.uv.array, trunk = new THREE.BufferGeometry(); trunk.setAttribute("position", new THREE.BufferAttribute(pos.slice(0, nv * 3), 3)); trunk.setAttribute("normal", new THREE.BufferAttribute(nor.slice(0, nv * 3), 3)); trunk.setAttribute("uv", new THREE.BufferAttribute(uv.slice(0, nv * 2), 2)); trunk.setIndex(new THREE.BufferAttribute(new Uint32Array(idx.slice(0, ni)), 1));
  const rest = new THREE.BufferGeometry(); rest.setAttribute("position", new THREE.BufferAttribute(pos.slice(nv * 3), 3)); rest.setAttribute("normal", new THREE.BufferAttribute(nor.slice(nv * 3), 3)); rest.setAttribute("uv", new THREE.BufferAttribute(uv.slice(nv * 2), 2)); rest.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.slice(ni), (v) => v - nv), 1));
  return [trunk, rest];
}

/** An ellipsoid the crown is kept inside: centre and radii. */
const inEllipsoid = (p, c, rx, ry) => Math.hypot((p.x - c.x) / rx, (p.y - c.y) / ry, (p.z - c.z) / rx);

/**
 * One lump of needles: an icosahedron made uneven (each corner pushed in or out by a hash of where it points, so that the copies of a
 * corner move together), scaled to (sx, sy, sz), turned by `yaw` and set at `at`. Its normals lean toward the crown's own round mass (from
 * `centre`, as the prologue's cards borrow theirs), and its first texture coordinate carries how deep in the crown it lies (`shade`, read into the
 * occlusion when the crown is merged).
 */
function lump(out, at, sx, sy, sz, yaw, centre, crownR, detail, salt, rough = 0.3, own = 0.4) {
  const g = new THREE.IcosahedronGeometry(1, detail), P = g.attributes.position, N = g.attributes.normal, uv = new Float32Array(P.count * 2), c = Math.cos(yaw), s = Math.sin(yaw), v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.set(P.getX(i), P.getY(i), P.getZ(i)); const k = 1 + rough * (hashAt(v.x * 3.1 + salt, v.y * 2.7 + v.z * 1.9, salt) - 0.5) + (rough > 0.3 ? 0.5 * rough * (hashAt(v.x * 7.3 - salt, v.z * 6.1 + v.y * 5.3, salt + 1) - 0.5) : 0);   // (an old arborvitae's tuft: ragged, two scales of unevenness, not a pebble)
    const lx = v.x * sx * k, ly = v.y * sy * k, lz = v.z * sz * k, wx = at.x + lx * c - lz * s, wy = at.y + ly, wz = at.z + lx * s + lz * c;
    P.setXYZ(i, wx, wy, wz);
    const dx = wx - centre.x, dy = (wy - centre.y) * 1.3 + 0.25 * crownR, dz = wz - centre.z, dl = Math.hypot(dx, dy, dz) || 1;
    n.set(v.x * c - v.z * s, v.y, v.x * s + v.z * c).normalize().multiplyScalar(own).add(v.set(dx / dl, dy / dl, dz / dl).multiplyScalar(1 - own)).normalize(); N.setXYZ(i, n.x, n.y, n.z);
    const deep = Math.min(1, Math.hypot(wx - centre.x, (wy - centre.y) * 1.2, wz - centre.z) / Math.max(0.5, crownR));
    uv[i * 2] = 0.5 + 0.5 * deep * (0.75 + 0.25 * Math.max(0, n.y));
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); out.push(g);
}

/**
 * Grows one tree: `{ kind, x, y, z, h, r, yaw }` and, for a tree whose crown must keep inside a given room (the axis's trees, whose crowns
 * the views along it are cleared against: axis.js `treeBlocks`), `env: { base, rx, ry }`, the crown's ellipsoid standing `base` over its foot.
 * `far`: fewer boughs and coarser lumps. Returns `{ trunk, wood, needles, tris, top }`: the trunk's tube, the rest of the wood, the needle
 * lumps (none for a bare tree), how many triangles, and how high its highest point stands over its foot (never over `h`).
 */
export function growTree(t, far = false) {
  const { kind, x, z, h } = t, y = t.y ?? 0, env = t.env || null, yaw = t.yaw ?? hashAt(x, z, 9) * 6.283, rnd = mulberry(seedAt(x, z, 3));
  const r = t.r ?? h * 0.037, gen = /** @type {any} */ (new TreeGenerator(null)), P = GROW[kind](h, r, far);
  if (env) { const top = env.base + 2 * env.ry; Object.assign(P, { trunkRadius: r, rootFlare: t.old ? 0.45 : 0.3, gnarl: [t.old ? 0.02 : 0, ...P.gnarl.slice(1)], trunkLength: env.base + env.ry * (kind === "pine" ? 0.9 : 1.2), trunkClear: (env.base + 0.3) / (env.base + env.ry * (kind === "pine" ? 0.9 : 1.2)), lengthRatio: [Math.min(0.5, (env.rx * 1.05) / (env.base + env.ry)), 0.42], branchLengthFalloff: 0.3 }); P.top = top; }
  if (t.crownFrom) P.trunkClear = Math.min(0.6, (t.crownFrom + 0.2) / P.trunkLength);   // (no bough below where its needles start: he walks the earth beside it)
  const lean = env ? (t.old ? 0.025 : 0) : kind === "pine" ? 0.07 + 0.06 * hashAt(x, z, 4) : kind === "broad" ? 0.05 : 0.015;   // (a tree on the axis stands straight: its trunk is cleared against the views as an upright post)
  for (const [k, v] of Object.entries({ seed: seedAt(x, z, 1), direction: [Math.sin(yaw) * lean, 1, Math.cos(yaw) * lean], ...P })) if (k !== "top") gen["set" + k[0].toUpperCase() + k.slice(1)](v);
  const m = gen.build(), tubes = m.userData.tubes, geo = m.geometry;
  // each tube's fineness (0 the trunk, 1 the finest twig) and the kind's greyness, for the bark (`treeBark`: twigs paler and warmer than limbs)
  { const uv = new Float32Array(geo.attributes.position.count * 2), top = Math.max(1, P.levels - 1); let o = 0;
    for (const tb of tubes) { const n = tb.rings.length * tb.radial + 1, f = tb.level / top; for (let i = 0; i < n; i++, o++) { uv[o * 2] = f; uv[o * 2 + 1] = GREY[kind]; } }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); }
  // Keep it to its height (and, on the axis, its crown to its ellipsoid): what it grew is scaled about its foot, all ways alike, so that no
  // tree stands over the ceiling its place was given (surround.js LIMITS, the eave line in cam01 and cam07).
  geo.computeBoundingBox(); const grown = geo.boundingBox.max.y, want = env ? env.base + 2 * env.ry : h, s = grown > 0 ? Math.min(env ? 1 : 1.12, want / grown) : 1;   // (an axis tree is never scaled up: its trunk would grow out of the post it is cleared as)
  const ready = (g) => { g.scale(s, s, s); g.translate(x, y - 0.2 * s, z); return g; };
  for (const tb of tubes) for (const ring of tb.rings) ring.pos.multiplyScalar(s).add(new THREE.Vector3(x, y - 0.2 * s, z));
  let [trunk, wood] = splitTrunk(geo, tubes[0]); trunk = ready(trunk); wood = ready(wood);
  // A bare broadleaf's limbs spread and crook, and a tip can sag low: none comes below 2.5 m out beyond his reach of the trunk (he walks under the court's two)
  if (kind === "broad" && h > 6) { const A = wood.attributes.position, floor = y + 2.5; for (let i = 0; i < A.count; i++) { const d = Math.hypot(A.getX(i) - x, A.getZ(i) - z), yy = A.getY(i); if (d > 0.9 && yy < floor) A.setY(i, floor - (floor - yy) * 0.08 * Math.max(0, 1.6 - d)); } }
  // a column (the way's arborvitae) keeps its boughs inside its needles' radius
  if (t.crownR) { const A = wood.attributes.position, R0 = t.crownR * 0.9; for (let i = 0; i < A.count; i++) { const dx = A.getX(i) - x, dz = A.getZ(i) - z, d = Math.hypot(dx, dz); if (d > R0) { A.setX(i, x + (dx * R0) / d); A.setZ(i, z + (dz * R0) / d); } } }
  const centre = new THREE.Vector3(x, y + (env ? env.base + env.ry : kind === "pine" ? h * 0.72 : kind === "cypress" ? h * 0.52 : h * 0.6), z);
  if (env) {   // what reaches out of the ellipsoid is drawn back into it, and nothing of the boughs comes below its underside
    const c = new THREE.Vector3(x, y + env.base + env.ry, z), p = new THREE.Vector3(), A = wood.attributes.position;
    for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i); const e = inEllipsoid(p, c, env.rx, env.ry); if (e > 0.97) { p.sub(c).multiplyScalar(0.97 / e).add(c); A.setXYZ(i, p.x, p.y, p.z); } }
    centre.copy(c);
  }
  const needles = [], detail = far ? 0 : 1;   // (far off a lump of twenty faces reads as one of eighty)
  if (kind === "pine") {
    // Pads of needles along the outer part of each bough and on its twigs, flat and wide, lying a little above the wood; the topmost kept
    // under a flat top. An old pine's crown is a few broad layers with sky between, not a cone.
    const crownR = env ? env.rx : h * 0.42, flat = y + (env ? env.base + 2 * env.ry : h) - 0.25;
    for (const tb of tubes) {
      if (tb.level === 0) continue;
      const us = tb.level === 1 ? (far ? [0.62, 0.95] : [0.62, 0.85, 1]) : [1];
      for (const u of us) {
        const p = along(tb, u), w = (env ? 0.62 : far ? 1.35 : tb.level === 1 ? 1.05 : 0.8) * (0.85 + 0.4 * rnd()) * Math.max(0.7, Math.min(1.25, h / 10)) * (0.75 + 0.25 * u), th = w * (0.22 + 0.08 * rnd());
        p.y += th * 0.35; if (p.y + th > flat) p.y = flat - th;
        if (env) { const e = inEllipsoid(p, centre, env.rx - w, env.ry - th); if (e > 1) p.sub(centre).multiplyScalar(1 / e).add(centre); }
        lump(needles, p, w * 1.25, th, w * 1.05, rnd() * 6.283, centre, crownR, detail, tb.level + u);
      }
    }
    // the crown's top: a broad flat pad over the leader
    const top = along(tubes[0], 1); top.y = Math.min(top.y, flat - 0.3); lump(needles, top, crownR * 0.42, 0.38, crownR * 0.36, yaw, centre, crownR, detail, 7);
  } else if (kind === "cypress") {
    // Lumps of needles packed into a flame (the old placeholder's outline, surround.js: fullest a little under the middle, tapering to a tip),
    // each taller than it is wide, as the arborvitae's sprays stand on edge; deep ones darker. On the axis, packed into its ellipsoid instead,
    // in three or four clumps, as an old temple cypress's crown breaks up.
    const R = Math.min(t.crownR ?? Infinity, h * (0.095 + 0.02 * (Math.abs(Math.round(x * 7 + z * 3)) % 3))), prof = [[0.78, 0], [0.96, 0.15], [1, 0.4], [0.94, 0.65], [0.72, 0.85], [0.42, 1]];   // (a narrow egg to a column, the top a little loose, not a point: the art director)
    const radiusAt = (f) => { for (let i = 1; i < prof.length; i++) if (f <= prof[i][1]) { const [a, fa] = prof[i - 1], [b, fb] = prof[i]; return R * (a + ((b - a) * (f - fa)) / (fb - fa)); } return 0; };
    const count = far ? 16 : env ? Math.round(t.old ? (t.back && !t.near ? 0.7 * (28 + 3.6 * env.ry) : 3.4 * (34 + 4.4 * env.ry)) : 26 + 3.2 * env.ry) : 30, fine = !far && env && t.old && !(t.back && !t.near);   // (a near old crown: four times the tufts at half the size and a fifth of the faces each, the grain of sprays rather than of stones)   // (an old tree's tall crown takes more, smaller tufts; one of the outer row, behind the inner from the path, fewer and a little larger)   // (an old tree's tall crown takes more, smaller: dense, not a stack of balls)
    if (env) {
      // An old cypress with its lower boughs long gone: the head broken into four or five masses held out on the boughs, the widest low and
      // spread to the ellipsoid's rim, one over the leader, with sky between them (not a ball on a pole).
      // (an old tree's tall crown: the masses stacked from its underside to its top, one or two to each storey of it, so that it is full from 3.5-4.5 m up, not a head on a pole)
      const clumps = t.old ? Math.max(5, Math.round(env.ry * (t.back && !t.near ? 1.3 : 4))) : 4 + (hashAt(x, z, 5) < 0.5 ? 1 : 0), cs = [];
      for (let k = 0; k < clumps; k++) {
        const top = k === clumps - 1, a = yaw + k * 2.39996 + rnd() * 0.5;
        const d = top ? 0.1 : t.old ? 0.35 + 0.3 * rnd() : 0.55 + 0.2 * rnd(), lift = top ? 0.6 : t.old ? -0.8 + (1.4 * k) / (clumps - 1) + 0.1 * (rnd() - 0.5) : -0.35 + 0.5 * (k / clumps) + 0.15 * rnd();
        const w = Math.sqrt(Math.max(0.15, 1 - lift * lift));   // (narrower toward the crown's ends, as the ellipsoid is)
        cs.push({ at: new THREE.Vector3(centre.x + Math.cos(a) * d * env.rx * w, centre.y + lift * env.ry, centre.z + Math.sin(a) * d * env.rx * w), r: env.rx * (top ? 0.38 : (t.old ? (t.back && !t.near ? 0.5 : 0.26) : 0.42) + 0.1 * rnd()) * (t.old ? 0.6 + 0.4 * w : 1) });
      }
      if (fine) {
        // A near old crown is drawn as its masses, not as tufts (the art director's final review of #722: tufts read as torn black paper against the light):
        // each mass a finely divided round body overlapping its neighbours, so that the crown is one dark mass; on each a smaller one where it faces out,
        // so that the outline goes in bays. The material frays the rim into small round scallops and opens small windows of sky (RAGGED, WINDOWS).
        for (const [k, c0] of cs.entries()) {
          const R = c0.r * 1.25, p = c0.at.clone(), e = inEllipsoid(p, centre, env.rx - R * 0.55, env.ry - R * 0.5); if (e > 1) p.sub(centre).multiplyScalar(1 / e).add(centre);
          lump(needles, p, R, R * 1.15, R, rnd() * 6.283, centre, env.rx, 1, k, 0.25, 0.55);
          for (let m = 0; m < 2; m++) {
            const out = p.clone().sub(centre); out.y *= 0.4; out.applyAxisAngle(new THREE.Vector3(0, 1, 0), (m ? 1 : -1) * (0.5 + 0.4 * rnd())); const ol = out.length() || 1; out.multiplyScalar(1 / ol);
            const q = p.clone().addScaledVector(out, R * (0.6 + 0.25 * rnd())).add(new THREE.Vector3(0, (rnd() - 0.4) * R * 0.7, 0)), r2 = R * (0.38 + 0.14 * rnd()), e2 = inEllipsoid(q, centre, env.rx - r2 * 0.5, env.ry - r2 * 0.5); if (e2 > 1) q.sub(centre).multiplyScalar(1 / e2).add(centre);
            lump(needles, q, r2, r2 * 1.1, r2, rnd() * 6.283, centre, env.rx, 0, k * 2 + m + 50, 0.25, 0.55);
          }
        }
      } else for (let i = 0; i < count; i++) {
        const c0 = cs[i % clumps], w = c0.r * (t.old ? (t.back && !t.near ? 0.46 + 0.24 * rnd() : 0.24 + 0.14 * rnd()) : 0.55 + 0.25 * rnd()), sp = t.old && !(t.back && !t.near) ? 1.6 : 1.4, p = c0.at.clone().add(new THREE.Vector3((rnd() - 0.5) * c0.r * sp, (rnd() - 0.5) * c0.r * (t.old ? (t.back && !t.near ? 1.6 : 1.7) : 0.6), (rnd() - 0.5) * c0.r * sp));   // (an old crown's tufts spread up and down their mass too, so that the masses run into one another)
        const e = inEllipsoid(p, centre, env.rx - w * 0.7, env.ry - w * 0.45); if (e > 1) p.sub(centre).multiplyScalar(1 / e).add(centre);
        if (t.old && !(t.back && !t.near)) {
          // the near old crowns (#722 first art review: they read as mossy stones, smooth and round): every third tuft goes out to its clump's rim as a spray
          // reaching outward and up past the mass, ragged, so that the outline breaks into sprays with sky between them
          if (i % 3 === 0) {
            const out = p.clone().sub(c0.at); out.y *= 0.5; const ol = out.length() || 1; out.multiplyScalar(1 / ol);
            p.copy(c0.at).addScaledVector(out, c0.r * (0.8 + 0.25 * rnd())); p.y += c0.r * 0.15 * rnd();
            const e2 = inEllipsoid(p, centre, env.rx - w * 0.3, env.ry - w * 0.3); if (e2 > 1) p.sub(centre).multiplyScalar(1 / e2).add(centre);
            lump(needles, p, w * 0.62, w * 0.78, w * 0.6, rnd() * 6.283, centre, env.rx, 0, i, 0.35, 0.45);   // (a small round bump at the rim, not a leaf: the art director's final review)
          } else lump(needles, p, w * 0.78, w * 1.15, w * 0.68, rnd() * 6.283, centre, env.rx, 0, i, 0.5, 0.5);
        } else if (t.old) lump(needles, p, w * 0.8, w * 1.15, w * 0.7, rnd() * 6.283, centre, env.rx, detail, i);   // (an arborvitae's sprays stand on edge: an old crown is a mass of upright tufts, not of pads)
        else lump(needles, p, w, w * 0.62, w * 0.85, rnd() * 6.283, centre, env.rx, detail, i);
      }
    } else {
      const base = y + (t.crownFrom ?? h * 0.06), span = h - (base - y);   // (the way's columns start their needles at `crownFrom`)
      for (let i = 0; i < count; i++) {
        const f = Math.pow((i + 0.5) / count, 0.8), a = i * 2.39996 + rnd() * 0.7, rad = radiusAt(f), w = Math.max(0.35, rad * (0.55 + 0.25 * rnd())), d = Math.max(0, rad - w * 0.75) * (0.55 + 0.45 * rnd());
        const p = new THREE.Vector3(x + Math.cos(a) * d, base + f * span - w * 0.2, z + Math.sin(a) * d);
        if (f > 0.86) { p.x += (rnd() - 0.5) * R * 0.5; p.z += (rnd() - 0.5) * R * 0.5; }   // the top's sprays stand apart
        lump(needles, p, w * 0.8, Math.min(w * 1.45, span * 0.2), w * 0.62, a, centre, R, detail, i);
      }
    }
  }
  // an arborvitae's needles are browner in winter than a pine's (the art director): marked in the second texture coordinate, read by the needles' material
  if (kind === "cypress") for (const g of needles) { const U2 = g.attributes.uv; for (let i = 0; i < U2.count; i++) U2.setY(i, 1); }
  // No lump stands over the tree's height, nor (on the axis) out of its ellipsoid: a corner pushed out by its unevenness is drawn back.
  { const c = env ? new THREE.Vector3(x, y + env.base + env.ry, z) : null, cap = y + want, p = new THREE.Vector3();
    for (const g of needles) { const A = g.attributes.position; for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i); if (c) { const e = inEllipsoid(p, c, env.rx, env.ry); if (e > 0.97) p.sub(c).multiplyScalar(0.97 / e).add(c); } if (p.y > cap - 0.02) p.y = cap - 0.02; A.setXYZ(i, p.x, p.y, p.z); } } }
  const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  let topY = 0; for (const g of [trunk, wood, ...needles]) { g.computeBoundingBox(); topY = Math.max(topY, g.boundingBox.max.y - y); }
  return { trunk, wood, needles, tris: tris(trunk) + tris(wood) + needles.reduce((n, g) => n + tris(g), 0), top: topY, tubes, scale: s };
}

/** A short fingerprint of some geometry, every coordinate rounded to a tenth of a millimetre (as trees.js's own: the same plan grown in Node and in the browser gives the same one). */
export function floraHash(geos) {
  let hv = 2166136261;
  for (const g of geos) { const a = g.attributes.position.array; for (let i = 0; i < a.length; i++) { hv ^= Math.round(a[i] * 1e4) | 0; hv = Math.imul(hv, 16777619) >>> 0; } }
  return hv.toString(16);
}

/** The poplar's pale bark: the shared bark's grain, its colour taken to a grey-white with dark marks (mao bai yang's bark is smooth and pale, with diamond-shaped scars), pale but under the sky (L* 55-65, the art director). Ours. */
const made = new WeakMap();
function paleBark(M) {
  const base = M.bark, m = base.clone(), was = base.onBeforeCompile;
  m.onBeforeCompile = (sh, rr) => { was.call(base, sh, rr); sh.fragmentShader = sh.fragmentShader.replace("diffuseColor.rgb=col;", "{ float l_=dot(col,vec3(.2126,.7152,.0722)); float m_=smoothstep(.62,.7,fbm3(vWP*vec3(2.2,.9,2.2))); col=mix(vec3(l_)*vec3(4.4,4.42,4.3),vec3(.05,.045,.04),m_*.5); } diffuseColor.rgb=col;"); };
  m.customProgramCacheKey = () => "paleBark"; m.name = "paleBark"; return m;
}
/**
 * The bark of every tree but the poplar: the shared bark's grain; greyed by the kind (`uv.y`: the pine keeps the shared red-brown, the bare broadleaf is
 * grey-brown), and toward the twigs (`uv.x`, 0 at the trunk, 1 at the finest twig) paler and a warmer grey, so that a bare crown seen against the sky
 * reads as a haze of fine twigs over darker limbs, not a black tangle (the art director: limbs a dark grey-brown, the tips lighter and warmer). Ours.
 */
function treeBark(M) {
  const base = M.bark, m = base.clone(), was = base.onBeforeCompile;
  m.onBeforeCompile = (sh, rr) => { was.call(base, sh, rr); sh.fragmentShader = sh.fragmentShader.replace("diffuseColor.rgb=col;", "{ float l_=dot(col,vec3(.2126,.7152,.0722)); col=mix(col,vec3(l_)*vec3(1.06,1.,.9),.65*vUv2.y); float f_=clamp(vUv2.x,0.,1.); col=mix(col,vec3(.17,.15,.13),f_*f_*.75); } diffuseColor.rgb=col;"); };
  m.customProgramCacheKey = () => "treeBark"; m.name = "treeBark"; return m;
}
/** The needles: the level's dry evergreen (./dry.js), each lump stirred by the breeze, more as it blows (uWind, set each frame from wind.js). */
// Near the eye a lump's outline is frayed: where its surface turns away from the eye, holes are cut by the world-space grain, more of them the nearer the
// rim, so that a crown seen within some forty metres ends in sprays with sky between them rather than in a smooth arc (#722 first art review: the nearest
// cypresses read as mossy stones). Farther off the lumps are small enough on the screen that their outline is the crown's.
const RAGGED = "{ float nd_=abs(dot(normal,normalize(vViewPosition))), near_=1.-smoothstep(28.,45.,length(vViewPosition)); if(near_>0.){ float f_=fbm3(vWP*vec3(11.,13.,11.)); if(!(f_*near_<=.44+1.4*nd_)) discard; if(!((1.-sg_)*near_<=.66)) discard; } }";   // (fine and soft: small round scallops at the rim and small windows of sky where the sprays' grain is thin, the mass kept whole; the art director's final review of #722: not torn black paper; two noises a fragment, the grain's own reused for the windows)
function needleMat(M) {
  const base = dryMaterials(M).cedar, m = base.clone(), was = base.onBeforeCompile;
  m.onBeforeCompile = (sh, rr) => {
    was.call(base, sh, rr); sh.uniforms.uWindN = U.uWind; sh.uniforms.uTN = U.uT;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform vec2 uWindN; uniform float uTN;").replace("#include <begin_vertex>", `#include <begin_vertex>
      { float a_=.025+.02*min(length(uWindN),3.); transformed.x+=sin(uTN*1.1+position.x*.7+position.y*.5)*a_+uWindN.x*.012; transformed.z+=cos(uTN*.83+position.z*.6+position.y*.4)*a_+uWindN.y*.012; }`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", "float sg_=fbm3(vWP*vec3(9.,2.6,9.));\ndiffuseColor.rgb*=mix(vec3(1.),vec3(1.1,1.,.74)*(.5+.75*sg_),step(.5,vUv2.y));\n#include <normal_fragment_begin>\n" + RAGGED).replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.indirectDiffuse*=1.7;");   // (a crown's side away from the sun takes more of the sky than a solid would: its sprays let the light in; the shaded side of a backlit crown no darker than L* 8, the art director)   // (an arborvitae's lump: yellower-brown)
  };
  m.customProgramCacheKey = () => "dryNeedles"; m.name = "dryNeedles"; return m;
}
/** The materials, made once for a set of materials. */
export function floraMaterials(M) {
  if (!made.has(M)) made.set(M, { bark: treeBark(M), pale: paleBark(M), needles: needleMat(M) });
  return made.get(M);
}

/** Merge indexed wood (adding the texture coordinates the shared materials expect) or the needles' non-indexed lumps (their shade into `ao`). */
function mergeWood(list) {
  for (const g of list) if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return mergeGeometries(list);
}
function mergeNeedles(list) {
  const g = mergeGeometries(list), uv = g.attributes.uv, ao = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) { ao[i] = uv.getX(i); uv.setX(i, 0); }   // (the second coordinate stays: an arborvitae's lump)
  g.setAttribute("ao", new THREE.BufferAttribute(ao, 1)); return g;
}

/**
 * The trees of one set, merged by material, as a group: `trees` as for `growTree`, `far` coarser. `cast`: they cast into the sun's map.
 * `walk`: whether the baked floor and the eye meet the trunks (the trees inside the walls stand in his way; the boughs and needles never do,
 * they are over his head or outside the walls: `userData.walk = false`). Returns the group and a report (`census`, `hash`, `tris`).
 */
/**
 * @param {any} M @param {any[]} trees
 * @param {{ name?: string, far?: boolean | ((t: any) => boolean), cast?: boolean, walk?: boolean, chunk?: (t: any) => string }} [opts]
 */
export function buildFlora(M, trees, { name = "flora", far = false, cast = true, walk = false, chunk = () => "" } = {}) {
  const mats = floraMaterials(M), group = new THREE.Group(), chunks = new Map(), census = [];
  for (const t of trees) {
    const key = chunk(t); if (!chunks.has(key)) chunks.set(key, { bark: [], pale: [], trunkBark: [], trunkPale: [], needles: [] });
    const bins = chunks.get(key), g = growTree(t, typeof far === "function" ? far(t) : far), bark = t.kind === "poplar" ? "pale" : "bark";   // (the bare broadleaf takes the shared bark: one material, and a draw in every chunk, fewer)
    bins[bark].push(g.wood); (walk ? bins["trunk" + bark[0].toUpperCase() + bark.slice(1)] : bins[bark]).push(g.trunk); bins.needles.push(...g.needles);   // (where nothing walks, the trunk goes in with the rest of the wood: one draw fewer)
    census.push({ kind: t.kind, at: [t.x, t.z], h: t.h, top: +g.top.toFixed(3), tris: g.tris, hash: floraHash([g.trunk, g.wood, ...g.needles]) });
  }
  // Merged by material within each chunk (a stretch of the place, so that what is out of the picture is not drawn: one merged mesh over the
  // whole town would be drawn whenever any of it was in view).
  for (const [ck, bins] of chunks) {
    const put = (list, material, key, walkable, merged) => {
      if (!list.length) return;
      const m = mesh(merged(list), material, { cast }); m.userData.keep = true; m.name = `${name}-${ck ? ck + "-" : ""}${key}`;
      if (!walkable) m.userData.walk = false; group.add(m);
    };
    for (const [key, mat] of [["bark", mats.bark], ["pale", mats.pale]]) {
      put(bins[key], mat, key, false, mergeWood);
      put(bins["trunk" + key[0].toUpperCase() + key.slice(1)], mat, key + "-trunks", walk, mergeWood);
    }
    put(bins.needles, mats.needles, "needles", false, mergeNeedles);
  }
  const tris = census.reduce((n, c) => n + c.tris, 0);
  let hv = 2166136261; for (const ch of census.map((c) => c.hash).join(",")) { hv ^= ch.charCodeAt(0); hv = Math.imul(hv, 16777619) >>> 0; }
  return { group, census, tris, hash: hv.toString(16) };
}

/**
 * The ground under the trees inside the walls: a soft dark ring where each trunk goes into the earth (the shade and the damp a trunk's foot
 * keeps), and a patch of what has fallen reaching out under its crown, a bare broadleaf's dry leaves wide and warm, a pine's or an arborvitae's
 * needles narrower and darker; broken into leaves by the material, not a felt. One transparent mesh laid a finger over the earth or the paving,
 * one draw; under snow it is gone (`uSnow`). Ours.
 * @param {any[]} trees as for `growTree` @param {number} [lift] how far over the ground (m)
 */
export function buildTreeGround(trees, lift = 0.03) {
  const pos = [], col = [], idx = [];
  const disc = (x, y, z, r0, rgb, alphas, radii, seed) => {   // rings of vertices at `radii` (shares of r0) with `alphas`, wandering a little at the edge
    const R = 28, base = pos.length / 3; pos.push(x, y, z); col.push(...rgb, alphas[0]);
    for (let i = 1; i < radii.length; i++) for (let k = 0; k < R; k++) { const a = (k / R) * 6.283, rr = r0 * radii[i] * (1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7 + seed * 2)); pos.push(x + Math.cos(a) * rr, y - 0.0005 * i, z + Math.sin(a) * rr); col.push(...rgb, alphas[i]); }
    for (let k = 0; k < R; k++) idx.push(base, base + 1 + ((k + 1) % R), base + 1 + k);
    for (let i = 1; i < radii.length - 1; i++) for (let k = 0; k < R; k++) { const n = (k + 1) % R, a = base + 1 + (i - 1) * R, b = base + 1 + i * R; idx.push(a + k, a + n, b + k, a + n, b + n, b + k); }
  };
  trees.forEach((t, i) => {
    const y = (t.y ?? 0) + lift, r = t.r ?? 0.3, seed = hashAt(t.x, t.z, 21) * 6.283;
    const reach = t.kind === "broad" ? 3.4 : t.kind === "pine" ? 2.6 : t.crownR ? t.crownR + 0.5 : 1.6, warm = t.kind === "broad";
    // the litter first, the dark ring over it (later in the mesh: drawn over it)
    disc(t.x, y, t.z, reach, warm ? [0.5, 0.4, 0.26] : [0.36, 0.31, 0.22], [0.85, 0.85, 0.7, 0.3, 0], [0, 0.35, 0.65, 0.88, 1], seed + i);
    disc(t.x, y + 0.002, t.z, r + 1.0, [0.03, 0.025, 0.02], [0.75, 0.75, 0.4, 0], [0, (r + 0.2) / (r + 1.0), 0.7, 1], seed + 3);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
  const N = g.attributes.normal; for (let i = 0; i < N.count; i++) N.setXYZ(i, 0, 1, 0);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnowG = U.uSnow;
    sh.vertexShader = "varying vec3 vGroundP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vGroundP = position;");
    sh.fragmentShader = "varying vec3 vGroundP;\nuniform float uSnowG;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      { float lum = dot(diffuseColor.rgb, vec3(.33));
        if (lum > .08) {   // the litter (the dark ring is left whole): scattered leaves, denser where the patch is denser
          vec2 q = vGroundP.xz * 7.0, cell = floor(q); float n1 = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453), n2 = fract(sin(dot(cell, vec2(39.346, 11.135))) * 24634.6345), n3 = fract(sin(dot(cell, vec2(73.156, 52.235))) * 31415.9265);
          vec2 f = fract(q) - vec2(.25 + .5 * n1, .25 + .5 * n2); float an = n3 * 6.2832; f = vec2(cos(an) * f.x + sin(an) * f.y, -sin(an) * f.x + cos(an) * f.y);
          float leaf = step(length(vec2(f.x, f.y / .5)), .18 + .14 * n3), here = step(fract(n1 * 5.17 + n2 * 3.31), .5 + diffuseColor.a * .9);
          diffuseColor.rgb *= .8 + .45 * n2; diffuseColor.a = leaf * here * min(1., diffuseColor.a * 1.4);
        }
        diffuseColor.a *= 1. - smoothstep(.05, .4, uSnowG); }`);
  };
  m.customProgramCacheKey = () => "treeGround"; m.name = "treeGround";
  const mesh = new THREE.Mesh(g, m); mesh.name = "tree-ground"; mesh.receiveShadow = true; mesh.castShadow = false; mesh.renderOrder = 0;
  mesh.userData.walk = false; mesh.userData.keep = true; mesh.userData.soft = true;   // (a painted layer of leaves: nothing he walks into, tools/edges.mjs leaves it out)
  return mesh;
}
