// Builds the novice's sculpted body, app/shared/models/novice.glb, from the textured model the owner made with Meshy
// (image to 3D, from the owner's A-pose drawing with the hat and the beads taken out of it).
//
//   node tools/novice.mjs <Meshy .glb> [out.glb]
//
// What it does, in order:
//   1. thins the model to about twenty thousand triangles with meshoptimizer, keeping its texture coordinates;
//   2. stands it at his real height (1.18 m) on y = 0, centred on x and z, in the A-pose it was made in;
//   3. cuts it into the four parts monk.js already has (skin, robe, legs, shoes) by the colour of the texture under each
//      triangle: the texture is made of flat islands of one colour each, so the colour says what a surface is;
//   4. gives every vertex the bone weights of the nearest vertices of the same part on the novice that monk.js builds in
//      code, which was drawn from the same turnaround, is the same height and is bound in the same pose: so the skirt
//      bones, the sleeves that follow the arm and the legs all keep the weights they were tuned with;
//   5. packs the three textures as 1024 px WebP.
// (Between 4 and 5: the arms are weighted along the arm (4a), and with NOVICE_WELD=<n> copies of one point take one
// weight, then are smoothed (4b): issue #80.)
// (extras.robeColor is the robe's average colour as sRGB hex, for the cloth of the lap he sits on.)
//
// The file written holds four meshes named after the parts, each with POSITION, NORMAL, TEXCOORD_0, JOINTS_0 and
// WEIGHTS_0 (joint numbers are the order of `createMonk().skeleton.bones`, listed under extras.bones), and one material.
// The Meshy original (24 MB) is not kept in git; its SHA-256 is printed and written in docs/t00/asset-register.csv.
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as THREE from "three";
import sharp from "sharp";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const HEIGHT = 1.18, TARGET_RATIO = 0.036, TEXTURE = 1024, K = 4;
const PARTS = ["skin", "robe", "legs", "shoes"];
const src = process.argv[2], dst = process.argv[3] || new URL("../app/shared/models/novice.glb", import.meta.url).pathname;
if (!src) { console.error("usage: node tools/novice.mjs <Meshy .glb> [out.glb]"); process.exit(1); }
const sha = crypto.createHash("sha256").update(fs.readFileSync(src)).digest("hex");
console.log("source", path.basename(src), "sha256", sha);

// ---- 1. read and thin ----
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const before = doc.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: TARGET_RATIO, error: 0.002, lockBorder: true }));
const mesh0 = doc.getRoot().listMeshes()[0], prim0 = mesh0.listPrimitives()[0], mat0 = prim0.getMaterial();
if (doc.getRoot().listMeshes().length !== 1 || mesh0.listPrimitives().length !== 1) throw new Error("expected one mesh with one primitive");
const P0 = Float32Array.from(prim0.getAttribute("POSITION").getArray()), N0 = Float32Array.from(prim0.getAttribute("NORMAL").getArray()), UV0 = Float32Array.from(prim0.getAttribute("TEXCOORD_0").getArray());
const I0 = Uint32Array.from(prim0.getIndices().getArray()), nv = P0.length / 3, nt = I0.length / 3;
console.log(`thinned ${before} -> ${nt} triangles, ${nv} vertices`);

// ---- 2. stand him at his height ----
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < nv; i++) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P0[i * 3 + a]); hi[a] = Math.max(hi[a], P0[i * 3 + a]); }
const scale = HEIGHT / (hi[1] - lo[1]), cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
for (let i = 0; i < nv; i++) { P0[i * 3] = (P0[i * 3] - cx) * scale; P0[i * 3 + 1] = (P0[i * 3 + 1] - lo[1]) * scale; P0[i * 3 + 2] = (P0[i * 3 + 2] - cz) * scale; }
console.log(`scale ${scale.toFixed(4)}, ${((hi[0] - lo[0]) * scale).toFixed(3)} x ${HEIGHT} x ${((hi[2] - lo[2]) * scale).toFixed(3)} m`);

// ---- 3. parts, by the colour of the texture ----
const baseImg = await sharp(Buffer.from(mat0.getBaseColorTexture().getImage())).resize(TEXTURE, TEXTURE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const tex = baseImg.data, TW = baseImg.info.width, TH = baseImg.info.height;
function hsv(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx ? d / mx : 0, mx]; }
/** What a point is, from its colour and where it is on him. Skin is only the head, the neck and the forearms. */
function classify(r, g, b, y, ax) {
  const [h, s, v] = hsv(r / 255, g / 255, b / 255);
  if (y > 0.93) return "skin";                                           // head and face: lashes, brows and lips are dark but skin
  const dark = v < 0.34, cream = s < 0.2 && v > 0.74, grey = s < 0.22 && v >= 0.34 && v <= 0.74, red = s >= 0.5 && v < 0.8 && (h < 22 || h > 340);
  if (y < 0.032) return "shoes";                                         // the pale sole
  if (dark) return y < 0.12 ? "shoes" : "robe";
  if (cream) return y > 0.45 ? "robe" : "legs";                          // the collar's lining, or the leg wraps
  if (grey) return y < 0.36 ? "legs" : "robe";                            // the trousers (above the hem a grey fleck is a shadow in the cloth)
  if (red) return "robe";
  return ax > 0.2 && y > 0.4 ? "skin" : y > 0.84 ? "skin" : "robe";      // peach: the hands and forearms, the neck
}
const vlabel = new Uint8Array(nv), robeSum = [0, 0, 0]; let robeN = 0;
for (let i = 0; i < nv; i++) {
  const px = Math.min(TW - 1, Math.max(0, Math.round(UV0[i * 2] * (TW - 1)))), py = Math.min(TH - 1, Math.max(0, Math.round(UV0[i * 2 + 1] * (TH - 1)))), o = (py * TW + px) * 3;
  vlabel[i] = PARTS.indexOf(classify(tex[o], tex[o + 1], tex[o + 2], P0[i * 3 + 1], Math.abs(P0[i * 3])));
  if (vlabel[i] === 1) { robeN++; for (let k = 0; k < 3; k++) robeSum[k] += tex[o + k]; }
}
const robeColor = (Math.round(robeSum[0] / robeN) << 16) | (Math.round(robeSum[1] / robeN) << 8) | Math.round(robeSum[2] / robeN);   // sRGB, for the lap he sits on
// A triangle belongs to the part most of its corners do; then a triangle whose three neighbours all agree on another part joins them.
const tlabel = new Uint8Array(nt);
for (let t = 0; t < nt; t++) { const c = [0, 0, 0, 0]; for (let k = 0; k < 3; k++) c[vlabel[I0[t * 3 + k]]]++; tlabel[t] = c.indexOf(Math.max(...c)); }
const edge = new Map(), nbr = Array.from({ length: nt }, () => []);
for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const a = I0[t * 3 + k], b = I0[t * 3 + (k + 1) % 3], key = a < b ? a * nv + b : b * nv + a; if (edge.has(key)) { const u = edge.get(key); nbr[t].push(u); nbr[u].push(t); } else edge.set(key, t); }
for (let pass = 0; pass < 3; pass++) for (let t = 0; t < nt; t++) { const n = nbr[t]; if (n.length >= 2 && n.every((u) => tlabel[u] === tlabel[n[0]]) && tlabel[n[0]] !== tlabel[t]) tlabel[t] = tlabel[n[0]]; }
// A fleck of one part inside another (a grey crease in the robe) is not a part: islands of fewer than 60 triangles join
// the part that most surrounds them.
{
  const seen = new Uint8Array(nt);
  for (let t0 = 0; t0 < nt; t0++) {
    if (seen[t0]) continue;
    const comp = [t0], around = [0, 0, 0, 0]; seen[t0] = 1;
    for (let q = 0; q < comp.length; q++) for (const u of nbr[comp[q]]) { if (tlabel[u] === tlabel[t0]) { if (!seen[u]) { seen[u] = 1; comp.push(u); } } else around[tlabel[u]]++; }
    if (comp.length < 60 && Math.max(...around) > 0) { const to = around.indexOf(Math.max(...around)); for (const t of comp) tlabel[t] = to; }
  }
}
// A vertex's own part is the majority of its triangles; vertices on a border also remember the other part(s).
const vparts = Array.from({ length: nv }, () => new Set());
for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) vparts[I0[t * 3 + k]].add(tlabel[t]);
const tcount = PARTS.map((_, p) => { let n = 0; for (let t = 0; t < nt; t++) n += tlabel[t] === p; return n; });
console.log("parts", PARTS.map((n, p) => `${n} ${tcount[p]}`).join(", "), "| vertices on a border", vparts.filter((s) => s.size > 1).length);

// ---- 4. weights, from the novice monk.js builds in code ----
const { createMonk } = await import("../app/src/monk.js");
const monk = createMonk(); monk.update(1 / 30, 0, "bind", 0); monk.group.updateMatrixWorld(true);
const boneNames = monk.skeleton.bones.map((b) => b.name);
const ref = PARTS.map((n) => { const g = monk.parts[n].geometry; return { p: g.attributes.position.array, si: g.attributes.skinIndex.array, sw: g.attributes.skinWeight.array, n: g.attributes.position.count }; });
/** The weights a point would take if it belonged to part `part`: the K nearest vertices of that part, on the same side of him. */
function weightsFor(x, y, z, part) {
  const R = ref[part], best = [];
  for (let i = 0; i < R.n; i++) {
    const dx = R.p[i * 3] - x, dy = R.p[i * 3 + 1] - y, dz = R.p[i * 3 + 2] - z;
    if (Math.abs(x) > 0.02 && R.p[i * 3] * x < -0.004) continue;   // an inner thigh never takes the other leg's weights
    const d = dx * dx + dy * dy + dz * dz;
    if (best.length < K || d < best[best.length - 1][0]) { best.push([d, i]); best.sort((a, b) => a[0] - b[0]); if (best.length > K) best.pop(); }
  }
  const w = new Map(); let sum = 0;
  for (const [d, i] of best) { const k = 1 / (d + 1e-5); sum += k; for (let j = 0; j < 4; j++) { const bw = R.sw[i * 4 + j]; if (bw > 0) w.set(R.si[i * 4 + j], (w.get(R.si[i * 4 + j]) || 0) + k * bw); } }
  return w;   // not yet normalised
}
const J = new Uint16Array(nv * 4), W = new Float32Array(nv * 4);
for (let i = 0; i < nv; i++) {
  const total = new Map(); let n = 0;
  for (const part of vparts[i]) { n++; const w = weightsFor(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2], part); let s = 0; for (const v of w.values()) s += v; for (const [b, v] of w) total.set(b, (total.get(b) || 0) + v / s); }
  const top = [...total].sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((a, [, v]) => a + v, 0);
  top.forEach(([b, v], k) => { J[i * 4 + k] = b; W[i * 4 + k] = v / s; });
}
// ---- 4a. the arms: along the arm, not from the nearest neighbour (issue #80) ----
// The sculpt holds its arms wider than the figure built in code (at the wrist about 10 cm higher), and its sleeve is sewn to
// the forearm where the built figure's hangs loose from the upper arm. So the nearest vertices of that figure to a point
// of the sculpt's forearm or cuff can be its upper arm or its hand: a strip of forearm hung wholly on the upper arm beside
// skin hung on the hand, and was drawn out 25 cm long when he put his palms together. On the arm, skin and sleeve take
// their weights from how far along it they lie instead, measured from the shoulder joint against the skeleton's own upper
// arm (0.20 m) and forearm (0.15 m): upper arm, then forearm across the elbow, then hand across the wrist, each crossing
// blended over a few centimetres. "On the arm" is within 7 cm of the line from the shoulder joint to the middle of the
// sculpt's hand (fading out by 10 cm), and more than 8 cm out along it (fully by 14 cm), so the shoulder, the collar and
// the body of the robe keep the weights they took.
{
  const at = (n) => monk.bones[n].getWorldPosition(new THREE.Vector3());
  const ramp = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  let n = 0;
  for (const side of ["left", "right"]) {
    const sh = at(side + "UpperArm"), el = at(side + "LowerArm"), wr = at(side + "Hand");
    const upper = sh.distanceTo(el), fore = el.distanceTo(wr), idx = ["UpperArm", "LowerArm", "Hand"].map((b) => boneNames.indexOf(side + b));
    const on = (i) => (side === "left") === (P0[i * 3] > 0);
    // the middle of the sculpt's own hand: its skin beyond the built figure's wrist
    const hand = new THREE.Vector3(); let hn = 0;
    for (let i = 0; i < nv; i++) if (on(i) && vparts[i].has(0) && Math.abs(P0[i * 3]) > Math.abs(wr.x) && P0[i * 3 + 1] < 0.7) { hand.x += P0[i * 3]; hand.y += P0[i * 3 + 1]; hand.z += P0[i * 3 + 2]; hn++; }
    hand.divideScalar(hn); const dir = hand.clone().sub(sh).normalize(), p = new THREE.Vector3();
    for (let i = 0; i < nv; i++) {
      if (!on(i) || !(vparts[i].has(0) || vparts[i].has(1)) || vparts[i].has(2) || vparts[i].has(3)) continue;   // skin and robe
      p.set(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]).sub(sh);
      // how far out along the arm (the line runs on behind the shoulder, past his neck: that is not the arm)
      const r = p.length(), t = p.dot(dir), d = p.clone().sub(dir.clone().multiplyScalar(t)).length();
      const k = ramp(t, 0.08, 0.14) * (1 - ramp(d, 0.07, 0.1)); if (k <= 0) continue;
      const toFore = ramp(r, upper - 0.03, upper + 0.03), toHand = ramp(r, upper + fore - 0.03, upper + fore + 0.02);
      const along = [1 - toFore, toFore * (1 - toHand), toHand], m = new Map();
      for (let j = 0; j < 4; j++) if (W[i * 4 + j] > 0) m.set(J[i * 4 + j], (m.get(J[i * 4 + j]) || 0) + (1 - k) * W[i * 4 + j]);
      along.forEach((w, j) => m.set(idx[j], (m.get(idx[j]) || 0) + k * w));
      const top = [...m].sort((x, y) => y[1] - x[1]).slice(0, 4), s = top.reduce((t, [, w]) => t + w, 0);
      for (let j = 0; j < 4; j++) { J[i * 4 + j] = top[j] ? top[j][0] : 0; W[i * 4 + j] = top[j] ? top[j][1] / s : 0; }
      n++;
    }
  }
  console.log(`arms: ${n} vertices weighted along the arm`);
}
// ---- 4b. one weight for every copy of one point (issue #80, route A; NOVICE_WELD=<n>) ----
// Copies of a point on either side of a texture seam took their weights apart and parted when he moved: the tears at the
// cuffs, the wrists and the hem. NOVICE_WELD=1 gives every copy of a point the same weights (tools/novice-weld.mjs);
// NOVICE_WELD=<n> also smooths them n - 1 times along the surface, within each part. Where two parts meet, the point
// takes the weights of one: a shoe over the trousers, the robe over the skin and the trousers. The novice.glb that ships
// was built with NOVICE_WELD=8 (docs/t00/asset-register.csv); without it the copies keep weights of their own and part again.
const RANK = { skin: 1, robe: 2, legs: 0, shoes: 3 };
if (process.env.NOVICE_WELD) {
  const { weldWeights } = await import("./novice-weld.mjs");
  const rank = Int8Array.from(vparts, (s) => Math.max(...[...s].map((p) => RANK[PARTS[p]])));
  const r = weldWeights(P0, J, W, { smooth: Math.max(0, (+process.env.NOVICE_WELD || 1) - 1), index: I0, rank });
  J.set(r.J); W.set(r.W);
  console.log(`welded weights: ${nv} vertices in ${r.groups} points, smoothed ${Math.max(0, (+process.env.NOVICE_WELD || 1) - 1)} times`);
}

// ---- 5. write: one mesh per part, one material ----
const out = new Document(); out.createBuffer();
out.createExtension(EXTTextureWebP).setRequired(true);
const buf = out.getRoot().listBuffers()[0], scene = out.createScene("novice");
const webp = async (img, q) => new Uint8Array(await sharp(Buffer.from(img)).resize(TEXTURE, TEXTURE).webp({ quality: q }).toBuffer());
const tBase = out.createTexture("base").setImage(await webp(mat0.getBaseColorTexture().getImage(), 90)).setMimeType("image/webp");
const tNormal = out.createTexture("normal").setImage(await webp(mat0.getNormalTexture().getImage(), 92)).setMimeType("image/webp");
const tRough = out.createTexture("metalRough").setImage(await webp(mat0.getMetallicRoughnessTexture().getImage(), 85)).setMimeType("image/webp");
const material = out.createMaterial("novice").setBaseColorTexture(tBase).setNormalTexture(tNormal).setMetallicRoughnessTexture(tRough)
  .setMetallicFactor(mat0.getMetallicFactor()).setRoughnessFactor(mat0.getRoughnessFactor()).setDoubleSided(true);
const acc = (type, array) => out.createAccessor().setType(type).setArray(array).setBuffer(buf);
const counts = {};
PARTS.forEach((name, part) => {
  const map = new Map(), idx = [], pos = [], nor = [], uv = [], jj = [], ww = [];
  for (let t = 0; t < nt; t++) {
    if (tlabel[t] !== part) continue;
    for (let k = 0; k < 3; k++) {
      const v = I0[t * 3 + k]; let o = map.get(v);
      if (o === undefined) { o = pos.length / 3; map.set(v, o); pos.push(P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]); nor.push(N0[v * 3], N0[v * 3 + 1], N0[v * 3 + 2]); uv.push(UV0[v * 2], UV0[v * 2 + 1]); for (let j = 0; j < 4; j++) { jj.push(J[v * 4 + j]); ww.push(W[v * 4 + j]); } }
      idx.push(o);
    }
  }
  counts[name] = { triangles: idx.length / 3, vertices: pos.length / 3 };
  const prim = out.createPrimitive().setAttribute("POSITION", acc("VEC3", new Float32Array(pos))).setAttribute("NORMAL", acc("VEC3", new Float32Array(nor)))
    .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(uv))).setAttribute("JOINTS_0", acc("VEC4", new Uint16Array(jj))).setAttribute("WEIGHTS_0", acc("VEC4", new Float32Array(ww)))
    .setIndices(acc("SCALAR", new Uint32Array(idx))).setMaterial(material);
  scene.addChild(out.createNode(name).setMesh(out.createMesh(name).addPrimitive(prim)));
});
out.getRoot().setExtras({ generator: "tools/novice.mjs", source: { file: path.basename(src), sha256: sha }, height: HEIGHT, robeColor, bones: boneNames, parts: PARTS, counts });
fs.mkdirSync(path.dirname(dst), { recursive: true });
await io.write(dst, out);
console.log("wrote", dst, (fs.statSync(dst).size / 1e6).toFixed(2), "MB", JSON.stringify(counts));

// For looking at the cut: the thinned model's positions, triangles and each triangle's part, beside the file.
if (process.env.NOVICE_DEBUG) {
  const d = process.env.NOVICE_DEBUG; fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "P.f32"), Buffer.from(P0.buffer)); fs.writeFileSync(path.join(d, "I.u32"), Buffer.from(I0.buffer)); fs.writeFileSync(path.join(d, "T.u8"), Buffer.from(tlabel.buffer));
}
