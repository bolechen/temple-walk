// Route A of issue #80, measured: what giving every copy of one point the same weights (tools/novice-weld.mjs) would do
// to the sculpted body as it ships, without writing anything.
//
//   node tools/novice-weld-trial.mjs [--smooth=n] [--json=out.json] [--file=another.glb in the same format]
//
// The Meshy original is not in git, so this works on app/shared/models/novice.glb itself: its four parts are laid end to
// end, copies within 1e-5 m of each other are gathered, and he is moved through standing, palms together, a whole walking
// stride, a climb up a flight, a stool and a cushion, once with the weights as shipped and once welded. For each it reports
//   - how far apart copies that start at one point come (the tears seen at the cuffs and hem when he walks);
//   - how far the robe's own edges stretch beyond their length in the bind pose (what is left of the tears when he sits:
//     the robe stays whole but is pulled open over legs that the model does not have under it). Edges under 5 mm are
//     left out of the stretch, and an edge counts as torn open when it is over twice its length and a centimetre longer.
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import * as THREE from "three";
import { weldWeights } from "./novice-weld.mjs";
const { createMonk } = await import("../app/src/monk.js");
const { readNovice } = await import("../tests/unit/novice-glb.mjs");

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.split("=")[1] : d; };
const SMOOTH = +arg("smooth", 0), OUT = arg("json", null), EPS = 1e-5;
const PARTS = ["skin", "robe", "legs", "shoes"];

// ---- the body as shipped, its four parts end to end ----
const FILE = arg("file", null), { geometries } = FILE ? readNovice(FILE) : readNovice();
const offs = {}; let n = 0; for (const p of PARTS) { offs[p] = n; n += geometries[p].attributes.position.count; }
const P = new Float32Array(n * 3), J = new Uint16Array(n * 4), W = new Float32Array(n * 4), idx = [];
for (const p of PARTS) {
  const g = geometries[p], o = offs[p];
  P.set(g.attributes.position.array, o * 3); J.set(g.attributes.skinIndex.array, o * 4); W.set(g.attributes.skinWeight.array, o * 4);
  for (const i of g.index.array) idx.push(i + o);
}
const partOf = (i) => PARTS.findLast((p) => offs[p] <= i);
const welded = weldWeights(P, J, W, { eps: EPS, smooth: SMOOTH, index: idx });

// ---- the copies, and how many of them disagree as shipped ----
const members = new Map(); for (let i = 0; i < n; i++) { const g = welded.group[i]; if (!members.has(g)) members.set(g, []); members.get(g).push(i); }
const shared = [...members.values()].filter((m) => m.length > 1);
const dense = (i) => { const m = new Map(); for (let k = 0; k < 4; k++) if (W[i * 4 + k] > 0) m.set(J[i * 4 + k], (m.get(J[i * 4 + k]) || 0) + W[i * 4 + k]); return m; };
const differ = (a, b) => { const A = dense(a), B = dense(b); let d = 0; for (const k of new Set([...A.keys(), ...B.keys()])) d = Math.max(d, Math.abs((A.get(k) || 0) - (B.get(k) || 0))); return d; };
let pairs = 0, differing = 0, crossPart = 0, crossDiffering = 0, worstDiff = 0;
for (const m of shared) for (let a = 0; a < m.length; a++) for (let b = a + 1; b < m.length; b++) {
  pairs++; const cross = partOf(m[a]) !== partOf(m[b]), d = differ(m[a], m[b]); if (cross) crossPart++;
  if (d > 1e-4) { differing++; if (cross) crossDiffering++; } worstDiff = Math.max(worstDiff, d);
}

// ---- the robe's edges, for stretch ----
const robe = geometries.robe, rEdges = new Map();
for (let t = 0; t < robe.index.count; t += 3) for (let k = 0; k < 3; k++) { const a = robe.index.array[t + k], b = robe.index.array[t + (k + 1) % 3]; rEdges.set(a < b ? a * 1e6 + b : b * 1e6 + a, [Math.min(a, b), Math.max(a, b)]); }
const rp = robe.attributes.position.array, rest = [...rEdges.values()].map(([a, b]) => [a, b, Math.hypot(rp[a * 3] - rp[b * 3], rp[a * 3 + 1] - rp[b * 3 + 1], rp[a * 3 + 2] - rp[b * 3 + 2])]);

// ---- dressing him, with the weights as shipped or welded ----
function dress(weld) {
  const m = createMonk(), gs = {};
  for (const p of PARTS) {
    const g = geometries[p].clone(), o = offs[p], c = g.attributes.position.count;
    if (weld) { g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(welded.J.slice(o * 4, (o + c) * 4), 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(welded.W.slice(o * 4, (o + c) * 4), 4)); }
    gs[p] = g;
  }
  m.dress(gs, new THREE.MeshStandardMaterial());
  return m;
}
const world = new Float32Array(n * 3), v = new THREE.Vector3();
function look(m) {
  m.group.updateMatrixWorld(true); m.skeleton.update();
  for (const p of PARTS) { const mesh = m.parts[p]; for (let i = 0, c = mesh.geometry.attributes.position.count; i < c; i++) { mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld); world.set([v.x, v.y, v.z], (offs[p] + i) * 3); } }
  let sep = 0, over1mm = 0;
  for (const g of shared) { const a = g[0]; let s = 0; for (const b of g) s = Math.max(s, Math.hypot(world[a * 3] - world[b * 3], world[a * 3 + 1] - world[b * 3 + 1], world[a * 3 + 2] - world[b * 3 + 2])); sep = Math.max(sep, s); if (s > 0.001) over1mm++; }
  const o = offs.robe; let stretch = 0, over2 = 0;
  for (const [a, b, l] of rest) { if (l < 0.005) continue;   // edges under 5 mm: a ratio on them says nothing
    const A = (o + a) * 3, B = (o + b) * 3, r = Math.hypot(world[A] - world[B], world[A + 1] - world[B + 1], world[A + 2] - world[B + 2]) / l; stretch = Math.max(stretch, r); if (r > 2 && r * l - l > 0.01) over2++; }
  return { sep, over1mm, stretch, over2 };
}
// Each pose: frames to settle, then the frames looked at. A climb moves him up a flight of 15 cm risers and 30 cm treads.
const POSES = {
  bind: (m, f) => { m.update(1 / 30, 0, "bind", 0); f(); },
  stand: (m, f) => { for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); f(); },
  pray: (m, f) => { for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {}); f(); },
  walk: (m, f) => { for (let i = 0; i < 120; i++) { m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); if (i >= 30 && i % 2 === 0) f(); } },
  climb: (m, f) => {
    const step = (z) => Math.max(0, Math.floor(-z / 0.3)) * 0.15, smooth = (z) => Math.max(0, -z) * 0.5;
    for (let i = 0; i < 120; i++) { const z = -i / 30 * 1.2; m.group.position.set(0, smooth(z), z); m.update(1 / 30, 1.2, false, i / 30, (x, zz) => step(zz), { heightAt: (x, zz) => smooth(zz), stairs: true }); if (i >= 30 && i % 2 === 0) f(); }
  },
  chair: (m, f) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "chair", i / 30, () => -0.44, {}); f(); },
  sit: (m, f) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "sit", i / 30, () => -0.104, {}); f(); },
};
const result = { file: FILE || "app/shared/models/novice.glb", eps: EPS, smooth: SMOOTH, vertices: n, points: welded.groups, sharedPoints: shared.length, pairs, differing, crossPart, crossDiffering, worstWeightDiff: +worstDiff.toFixed(3), poses: {} };
for (const [name, run] of Object.entries(POSES)) {
  const row = {};
  for (const weld of [false, true]) {
    const m = dress(weld), worst = { sep: 0, over1mm: 0, stretch: 0, over2: 0 };
    run(m, () => { const r = look(m); for (const k in worst) worst[k] = Math.max(worst[k], r[k]); });
    row[weld ? "welded" : "shipped"] = { maxSeparationMm: +(worst.sep * 1000).toFixed(2), pointsOver1mm: worst.over1mm, robeMaxStretch: +worst.stretch.toFixed(2), robeEdgesOver2x: worst.over2 };
  }
  result.poses[name] = row;
}
// What lies under the robe: the top of the trousers and the hem, in the bind pose.
const top = (g) => { let y = -Infinity; for (let i = 1; i < g.attributes.position.array.length; i += 3) y = Math.max(y, g.attributes.position.array[i]); return y; };
const low = (g) => { let y = Infinity; for (let i = 1; i < g.attributes.position.array.length; i += 3) y = Math.min(y, g.attributes.position.array[i]); return y; };
result.bind = { trousersTopM: +top(geometries.legs).toFixed(3), robeHemM: +low(robe).toFixed(3) };
console.log(JSON.stringify(result, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n");
