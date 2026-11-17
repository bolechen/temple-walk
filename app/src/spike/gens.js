// The #162 trial: the court's west maple and one cedar grown by an existing tree generator instead of by hand, so the
// three can be set side by side. A generator gives only the wood and where the leaves go; the wood is drawn in this
// project's bark and the leaves are this project's own cards (trees.js hangs them), so the seasons, the snow and the
// wind are the same whichever grew the tree.
//
// `grow(gen, kind, x, y, z, h, seed)` returns { wood: [geometry], leaves: [{ p, w }], stems, trunks: [{ x, z, r }] }.
// gen: "three" (three.js r186's TreeGenerator) or "ez" (@dgreenheck/ez-tree 1.1.0). Both are vendored beside this file.
import * as THREE from "three";
import { TreeGenerator } from "./three-tree.js";
import { Tree } from "./ez-tree/tree.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// A small chance of its own, so a tree grown twice is the same tree.
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

// The ends of the finest wood, and points along it: where leaves hang on a tree that a generator grew bare.
function tipsOfTubes(tubes, level, step = 0.34) {
  const out = [];
  for (const t of tubes) {
    if (t.level < level) continue;
    for (let u = 0.3; u <= 1.001; u += step) { const r = t.rings[Math.min(t.rings.length - 1, Math.round(u * (t.rings.length - 1)))]; out.push(r.pos.clone()); }
  }
  return out;
}

// What three's generator is asked for. A cedar: one straight shaft, many boughs nearly level and hanging. A maple:
// two or three stems leaning out from one foot, forking low and spreading.
function threeTree(kind, h, seed, r0) {
  const out = { wood: [], tips: [], trunks: [] }, rnd = seeded(seed * 7 + 3);
  const one = (opts, at, lean) => {
    const g = /** @type {any} */ (new TreeGenerator(null)); for (const [k, v] of Object.entries(opts)) g["set" + k[0].toUpperCase() + k.slice(1)](v);
    g.setDirection(lean); const m = g.build(), geo = m.geometry.translate(at.x, 0, at.z);
    const tubes = m.userData.tubes;
    for (const t of tubes) for (const r of t.rings) r.pos.add(at);
    out.wood.push(geo); out.tubes = (out.tubes || []).concat(tubes); out.trunks.push({ x: at.x, z: at.z, r: opts.trunkRadius * (1 + opts.rootFlare) });
  };
  if (kind === "cedar") {
    one({ seed, levels: 3, children: [46, 4], branchAngle: [96, 38], angleVariance: 10, lengthRatio: 0.24, trunkLength: h, trunkRadius: r0, taper: 0.88, taperCurve: 0.8, rootFlare: 0.5, flareFrac: 0.06,
      radiusExponent: 2.6, minRadius: 0.012, minLength: 0.4, droop: 0.22, upPull: 0.0, gnarl: [0.01, 0.06, 0.1], radialSegments: 6, sectionLength: 1.0, childStart: 0.2, trunkClear: 0.34 }, V(0, 0, 0), [0, 1, 0]);
    out.leafLevel = 1;
  } else {
    const n = 3, a0 = rnd() * 6.283;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * 6.283, d = [Math.cos(a) * 0.32, 1, Math.sin(a) * 0.32];
      one({ seed: seed + i * 17, levels: 4, children: [3, 3, 3], branchAngle: [34, 40, 46], angleVariance: 12, lengthRatio: 0.72, trunkLength: h * 0.42, trunkRadius: 0.1, taper: 0.4, taperCurve: 0.7,
        rootFlare: 0.35, flareFrac: 0.12, radiusExponent: 2.2, minRadius: 0.008, minLength: 0.3, droop: 0.06, upPull: 0.12, gnarl: [0.06, 0.14, 0.2, 0.24], radialSegments: 8, sectionLength: 0.5,
        childStart: 0.35, trunkClear: 0.55 }, V(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), d);
    }
    out.leafLevel = 2;
  }
  out.tips = tipsOfTubes(out.tubes, out.leafLevel);
  return out;
}

// What ez-tree is asked for, in metres. It grows one trunk; the maple's stems are three of its trees, each leaned out.
function ezTree(kind, h, seed, r0) {
  const out = { wood: [], tips: [], trunks: [] }, rnd = seeded(seed * 5 + 11);
  const one = (set, at, tilt, turn) => {
    const t = new Tree(); t.options.seed = seed; set(t.options); t.options.bark.textured = false; t.generate();
    const M = new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, turn, 0, "YXZ")), V(1, 1, 1)), geo = t.branchesMesh.geometry.clone().applyMatrix4(M);
    out.wood.push(geo); for (const s of t.leafSpots) out.tips.push(s.origin.clone().applyMatrix4(M)); out.trunks.push({ x: at.x, z: at.z, r: t.options.branch.radius[0] });
  };
  if (kind === "cedar") {
    one((o) => { o.type = "evergreen"; Object.assign(o.branch, { levels: 1, angle: { 1: 104, 2: 16, 3: 60 }, children: { 0: 64, 1: 3, 2: 5 }, length: { 0: h, 1: 4.2, 2: 1, 3: 1 }, radius: { 0: r0, 1: 0.18, 2: 0.7, 3: 0.7 },
      sections: { 0: 14, 1: 5, 2: 4, 3: 3 }, segments: { 0: 24, 1: 5, 2: 4, 3: 3 }, start: { 1: 0.34, 2: 0.14, 3: 0.3 }, gnarliness: { 0: 0.01, 1: 0.05, 2: 0, 3: 0 }, force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.006 } });
      Object.assign(o.leaves, { count: 3, start: 0.3, size: 1.2 }); }, V(0, 0, 0), 0, 0);
  } else {
    const n = 3, a0 = rnd() * 6.283;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * 6.283;
      one((o) => { o.seed = seed + i * 17; o.type = "deciduous"; Object.assign(o.branch, { levels: 3, angle: { 1: 42, 2: 50, 3: 55 }, children: { 0: 3, 1: 3, 2: 3 }, length: { 0: h * 0.84, 1: h * 0.6, 2: h * 0.36, 3: h * 0.16 }   /* ez divides a broad-leaved tree's lengths by (levels - 1) */,
        radius: { 0: 0.1, 1: 0.7, 2: 0.7, 3: 0.7 }, sections: { 0: 8, 1: 6, 2: 4, 3: 3 }, segments: { 0: 12, 1: 6, 2: 4, 3: 3 }, start: { 1: 0.45, 2: 0.3, 3: 0.3 }, gnarliness: { 0: 0.06, 1: 0.2, 2: 0.25, 3: 0.1 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.02 }, taper: { 0: 0.6, 1: 0.7, 2: 0.7, 3: 0.7 } });
        Object.assign(o.leaves, { count: 2, start: 0.2, size: 1 }); }, V(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), 0.3, -a + Math.PI / 2);
    }
  }
  return out;
}

export function grow(gen, kind, x, y, z, h, seed, r0) {
  const t = gen === "ez" ? ezTree(kind, h, seed, r0) : threeTree(kind, h, seed, r0), at = V(x, y, z);
  for (const g of t.wood) g.translate(x, y, z);
  // as many leaf clumps as the hand-made tree of that kind carries, spread over every place the generator offers
  const want = kind === "cedar" ? 260 : 48, step = Math.max(1, t.tips.length / want), leaves = [];
  for (let i = 0; i < t.tips.length && leaves.length < want; i += step) leaves.push({ p: t.tips[Math.floor(i)].clone().add(at), w: kind === "cedar" ? 1.6 : 1.1 });
  return { wood: t.wood, leaves, stems: t.trunks.length, trunks: t.trunks.map((k) => ({ x: k.x + x, z: k.z + z, r: k.r })) };
}
