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

// A tube through `pts` for the wood drawn here (the maple's trunk and great limbs): rings carried along the curve so
// it never twists, `rad(t, P)` thick at each, closed at its far end in a short point.
function tube(pts, rad, radial) {
  const curve = new THREE.CatmullRomCurve3(pts), n = (pts.length - 1) * 3, pos = [], nor = [], idx = [], T = V(0, 0, 0), N = V(0, 0, 0), B = V(0, 0, 0), P = V(0, 0, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n; curve.getPoint(t, P); curve.getTangent(t, T);
    if (i === 0) { N.crossVectors(T, Math.abs(T.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).normalize(); } else { N.addScaledVector(T, -N.dot(T)).normalize(); }
    B.crossVectors(T, N); const r = rad(t, P);
    for (let k = 0; k < radial; k++) { const a = (k / radial) * 6.283, ox = N.x * Math.cos(a) + B.x * Math.sin(a), oy = N.y * Math.cos(a) + B.y * Math.sin(a), oz = N.z * Math.cos(a) + B.z * Math.sin(a); pos.push(P.x + ox * r, P.y + oy * r, P.z + oz * r); nor.push(ox, oy, oz); }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < radial; k++) { const a = i * radial + k, b = a + radial, k1 = i * radial + ((k + 1) % radial), b1 = k1 + radial; idx.push(a, b1, b, a, k1, b1); }
  curve.getTangent(1, T); curve.getPoint(1, P); const r1 = rad(1, P), tip = pos.length / 3; P.addScaledVector(T, r1 * 1.5); pos.push(P.x, P.y, P.z); nor.push(T.x, T.y, T.z);
  for (let k = 0; k < radial; k++) idx.push(n * radial + k, n * radial + ((k + 1) % radial), tip);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}

// What three's generator is asked for. A cedar: one straight shaft, many boughs nearly level and hanging. A maple:
// one short trunk dividing low into great limbs and a broad, layered crown.
function threeTree(kind, h, seed, r0) {
  const out = { wood: [], tips: [], trunks: [] }, rnd = seeded(seed * 7 + 3);
  const one = (opts, at, lean) => {
    const g = /** @type {any} */ (new TreeGenerator(null)); for (const [k, v] of Object.entries(opts)) if (k in TreeGenerator.defaults) g["set" + k[0].toUpperCase() + k.slice(1)](v);
    g.setDirection(lean); const m = g.build(), geo = m.geometry.translate(at.x, at.y, at.z);
    const tubes = m.userData.tubes;
    for (const t of tubes) for (const r of t.rings) r.pos.add(at);
    out.wood.push(geo); out.tubes = (out.tubes || []).concat(tubes); if (!opts.limb) out.trunks.push({ x: at.x, z: at.z, r: opts.trunkRadius * (1 + opts.rootFlare) });
  };
  if (kind === "cedar") {
    one({ seed, levels: 3, children: [46, 4], branchAngle: [96, 38], angleVariance: 10, lengthRatio: 0.24, trunkLength: h, trunkRadius: r0, taper: 0.88, taperCurve: 0.8, rootFlare: 0.5, flareFrac: 0.06,
      radiusExponent: 2.6, minRadius: 0.012, minLength: 0.4, droop: 0.22, upPull: 0.0, gnarl: [0.01, 0.06, 0.1], radialSegments: 6, sectionLength: 1.0, childStart: 0.2, trunkClear: 0.34, collar: 0.25 }, V(0, 0, 0), [0, 1, 0]);
    out.leafLevel = 1;
    out.sprays = out.tubes.filter((t) => t.level >= 1).map((t) => ({ from: t.rings[0].pos.clone(), to: t.rings[t.rings.length - 1].pos.clone() }));
  } else {
    // A court maple, the two lowest orders of its wood drawn here and the rest grown by the generator from them
    // (the structure review's table on #186): one short trunk swelling into its roots, dividing at 1.0-1.4 m into three
    // to five great limbs, each as thick as its share of the trunk asks, leaning out 40-65 degrees from upright and
    // flattening as they go, in two or three tiers; from each limb's end, and from two points along it, the generator
    // grows the finer wood, bending and closing at every tip.
    for (let i = 0; i < 4; i++) rnd();   // (a small seed's first draws are all near nothing)
    const F = 1.0 + rnd() * 0.4, r0b = 0.115, n = 3 + Math.floor(rnd() * 3), tierN = n >= 5 ? 3 : 2, top = F + (tierN - 1) * 0.15 + 0.06, lean = V((rnd() - 0.5) * 0.08, 0, (rnd() - 0.5) * 0.08);
    const trunkR = (y) => r0b * (1 - 0.08 * Math.min(1, Math.max(0, y) / top)) * (1 + 0.6 * Math.exp(-Math.max(0, y) / 0.22));
    const tpts = [V(0, -0.15, 0), V(lean.x * 0.3, 0.5, lean.z * 0.3), V(lean.x * 0.8, F, lean.z * 0.8), V(lean.x, top, lean.z)];
    out.wood.push(tube(tpts, (t, P) => trunkR(P.y), 10)); out.trunks.push({ x: 0, z: 0, r: trunkR(0) });
    const ratio = Math.min(0.58, Math.max(0.46, 1 / Math.sqrt(n))), a0 = rnd() * 6.283, limbs = [];   // (the trunk ends just above its highest limb: no stump stands over the fork)
    for (let i = 0; i < n; i++) {
      const tier = i % tierN, y0 = F + tier * 0.15, a = a0 + (i / n) * 6.283 + (rnd() - 0.5) * 0.4, dir = V(Math.cos(a), 0, Math.sin(a)), side = V(-dir.z, 0, dir.x);
      const th = ((50 + rnd() * 12) * Math.PI) / 180, reach = h * 0.22 * (0.85 + rnd() * 0.3) * (1 - tier * 0.12), from = V(lean.x * (y0 / top), y0, lean.z * (y0 / top)).addScaledVector(dir, r0b * 0.3);
      const pts = [];
      for (let k = 0; k < 5; k++) { const u = k / 4, rise = (reach / Math.tan(th)) * u * (1 - 0.45 * u); pts.push(from.clone().addScaledVector(dir, reach * u).addScaledVector(side, Math.sin(u * 3 + a) * reach * 0.06 * u).add(V(0, rise, 0))); }
      const rs = trunkR(y0) * ratio, rad = (t) => rs * (1 - 0.4 * t) * (1 + 0.25 * Math.exp(-(t * reach) / 0.1));
      out.wood.push(tube(pts, rad, 7)); const curve = new THREE.CatmullRomCurve3(pts);
      limbs.push({ ratio: rs / trunkR(y0), area: (rs * rs) / (trunkR(y0) * trunkR(y0)), angle: (th * 180) / Math.PI, tier, end: pts[4].y, reach });
      // the finer wood: on from the limb's end, and out from two points along it
      const crown = (at, d, len, r) => one({ seed: seed + i * 31 + Math.round(len * 100), limb: true, levels: 4, children: [3, 3, 2], branchAngle: [34, 38, 42], angleVariance: 12, lengthRatio: [0.55, 0.55, 0.5], childRadius: [0.577, 0.577, 0.707],
        trunkLength: len, trunkRadius: r, taper: 0.3, taperCurve: 0.8, rootFlare: 0, flareFrac: 0.1, minRadius: 0.005, minLength: 0.2, droop: 0.06, upPull: 0.26, gnarl: [0.06, 0.18, 0.24, 0.3],
        radialSegments: 4, sectionLength: 0.5, childStart: 0.15, trunkClear: 0.12, collar: 0.25 }, at, [d.x, d.y, d.z]);
      crown(curve.getPoint(0.97), curve.getTangent(1).clone().add(V(0, 1.4, 0)).normalize(), h * 0.42, rs * 0.6);
      for (const u of n > 3 ? [0.62] : [0.5, 0.78]) { const p = curve.getPoint(u), d = curve.getTangent(u).clone().add(side.clone().multiplyScalar(u < 0.6 ? 1 : -1)).add(V(0, 0.6, 0)).normalize(); crown(p, d, h * 0.22, rad(u) * 0.55); }
    }
    out.leafLevel = 2;
    const forks = out.tubes.filter((t) => t.kids && t.kids.length).map((t) => t.kids.reduce((n, k) => n + k * k, 0) / (t.base * t.base));
    out.skeleton = { forks, forkHeight: F, trunkD03: 2 * trunkR(0.3), limbs, tiers: tierN, areaSum: limbs.reduce((t, l) => t + l.area, 0) };
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

// ez-tree as its author means it to be used: its own presets (ash_medium for a broad-leaved tree, pine_medium for a
// conifer, copied as published in @dgreenheck/ez-tree 1.1.0, src/lib/presets/, MIT), grown at their own size and
// scaled to the tree's height. Only for setting beside the tuned version (#162, second round).
const EZ_PRESET = { maple: {"seed":36330,"type":"deciduous","bark":{"type":"oak","tint":13552830,"flatShading":false,"textured":false,"textureScale":{"x":0.5,"y":5.0}},"branch":{"levels":3,"angle":{"1":48,"2":75,"3":60},"children":{"0":7,"1":4,"2":3},"force":{"direction":{"x":0,"y":1,"z":0},"strength":-0.06},"gnarliness":{"0":0.03,"1":0.25,"2":0.2,"3":0.09},"length":{"0":43.47,"1":27.14,"2":9.51,"3":4.6},"radius":{"0":2,"1":0.63,"2":0.76,"3":0.7},"sections":{"0":12,"1":8,"2":6,"3":4},"segments":{"0":12,"1":6,"2":4,"3":3},"start":{"1":0.23,"2":0.33,"3":0},"taper":{"0":0.7,"1":0.7,"2":0.7,"3":0.7},"twist":{"0":0.09,"1":-0.07,"2":0,"3":0}},"leaves":{"type":"ash","billboard":"double","angle":55,"count":16,"start":0,"size":2.67,"sizeVariance":0.72,"tint":16777215,"alphaTest":0.5},"trellis":{"enabled":false}}, cedar: {"seed":13977,"type":"evergreen","bark":{"type":"pine","tint":16777215,"flatShading":false,"textured":false,"textureScale":{"x":1,"y":1}},"branch":{"levels":1,"angle":{"1":110,"2":16,"3":60},"children":{"0":82,"1":3,"2":5},"force":{"direction":{"x":0,"y":1,"z":0},"strength":-0.003},"gnarliness":{"0":0.05,"1":0.08,"2":0,"3":0},"length":{"0":50,"1":23.87,"2":14.08,"3":1},"radius":{"0":1.05,"1":0.36,"2":0.7,"3":0.7},"sections":{"0":12,"1":10,"2":8,"3":6},"segments":{"0":8,"1":6,"2":4,"3":3},"start":{"1":0.27,"2":0.14,"3":0.3},"taper":{"0":0.7,"1":0.7,"2":0.7,"3":0.7},"twist":{"0":0,"1":0,"2":0,"3":0}},"leaves":{"type":"pine","billboard":"double","angle":39,"count":30,"start":0.09,"size":1.435,"sizeVariance":0.201,"tint":16777215,"alphaTest":0.3},"trellis":{"enabled":false}} };
function ezPreset(kind, h, seed) {
  const t = new Tree(); t.options.copy(JSON.parse(JSON.stringify(EZ_PRESET[kind]))); t.options.seed = seed; t.options.bark.textured = false; t.generate();
  const geo = t.branchesMesh.geometry.clone(); geo.computeBoundingBox(); const k = h / Math.max(0.1, geo.boundingBox.max.y); geo.scale(k, k, k);
  return { wood: [geo], tips: t.leafSpots.map((s) => s.origin.clone().multiplyScalar(k)), trunks: [{ x: 0, z: 0, r: t.options.branch.radius[0] * k }] };
}

export function grow(gen, kind, x, y, z, h, seed, r0) {
  const t = gen === "ezp" ? ezPreset(kind, h, seed) : gen === "ez" ? ezTree(kind, h, seed, r0) : threeTree(kind, h, seed, r0), at = V(x, y, z);
  for (const g of t.wood) g.translate(x, y, z);
  // as many leaf clumps as the hand-made tree of that kind carries, spread over every place the generator offers
  const want = kind === "cedar" ? 120 : 80, step = Math.max(1, t.tips.length / want), leaves = [];
  for (let i = 0; i < t.tips.length && leaves.length < want; i += step) leaves.push({ p: t.tips[Math.floor(i)].clone().add(at), w: kind === "cedar" ? 1.6 : 1.1 });
  return { sprays: (t.sprays || []).map((k) => ({ from: k.from.clone().add(at), to: k.to.clone().add(at) })), skeleton: t.skeleton || null, wood: t.wood, leaves, stems: t.trunks.length, trunks: t.trunks.map((k) => ({ x: k.x + x, z: k.z + z, r: k.r })) };
}
