// Builds a body for the novice from the layered model made with Tripo (issue #246; #163, #80 route B): the segmented and
// completed model is turned into the four skinned parts monk.dress() wears, bound to the skeleton monk.js builds in code.
//
//   node tools/novice-tripo.mjs <dir> [out.glb]
//
// <dir> holds what Tripo gave for one model (as kept in hf://buckets/bolechen/temple-walk-render/keep/tripo-2026-11-19/monk2/):
// `seg-model.glb` (mesh_segmentation: sixteen pieces, each with its own three textures) and `comp-model.glb`
// (mesh_completion of three of them). Nothing is written into app/: the file is a trial, kept in the bucket under
// keep/novice-b/<date>/, until the owner decides whether he wears it.
//
// What it does, in order:
//   1. takes each piece from the model PIECES names (the segmented one, or the completed one for the trousers), with its
//      node's transform, and turns him to face +z with his left on +x, 1.18 m tall, soles on y = 0, centred;
//   2. on the completed trousers, finds the faces the completion made (more than a millimetre or so from the segmented
//      trousers' surface): those that close the cuffs inside the leg wraps are dropped, the rest (the waist and the crotch,
//      which came without texture and are black) are drawn in the trousers' own mean colour;
//   3. moves the bare forearm that the segmentation left inside his right sleeve to the skin, by the colour under it, so
//      that both arms are the same: skin from the cuff down;
//   4. cuts the hanging end of the sash out of the skirt it was segmented with (SASH: the angles on his left front between
//      which it hangs, and only what stands proud of the skirt there), and lays a copy of it a few millimetres further in, weighted with the
//      skirt, so the skirt stays whole when the end swings away from it;
//   5. thins every piece with meshoptimizer, keeping its borders and texture seams (KEEP: the fraction of each kept);
//   6. lays the pieces' textures side by side in one atlas (colour and normal; the metal-roughness maps become one
//      constant, as cloth and skin here are neither metal nor glossy) and moves each piece's texture coordinates onto
//      its tile;
//   7. gives every vertex the weights of the figure built in code, as tools/novice.mjs does (tools/novice-weights.mjs:
//      the nearest vertices of the same part, then along the arm; then one weight to each point, NOVICE_WELD), and the
//      sash's end wholly to the `sashTail` bone;
//   8. writes four meshes (skin, robe, legs, shoes) in novice.glb's format: the same attributes, joints numbered as
//      `createMonk().skeleton.bones` (listed under extras.bones), one material with two WebP textures.
// The same inputs give the same bytes (sharp's WebP and glTF-Transform's writer are deterministic; nothing is random).
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as THREE from "three";
import sharp from "sharp";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { MeshoptSimplifier } from "meshoptimizer";
import { transferWeights, armWeights, robeWeights } from "./novice-weights.mjs";
import { weldWeights } from "./novice-weld.mjs";

const HEIGHT = 1.18, PARTS = ["skin", "robe", "legs", "shoes"];
// Tripo's pieces, by node name: what each is, which of the four parts it belongs to, from which file, how big its tile
// in the atlas is (px of a 2048 atlas) and what fraction of its triangles is kept. Tripo numbers the pieces anew each
// time it segments a model: after a new generation only this table should need to change.
const PIECES = {
  tripo_part_8: { what: "head", part: "skin", tile: 1024, keep: 0.8 },
  tripo_part_2: { what: "right ear", part: "skin", tile: 128, keep: 0.6 },
  tripo_part_12: { what: "left ear", part: "skin", tile: 128, keep: 0.6 },
  tripo_part_0: { what: "right hand", part: "skin", tile: 256, keep: 0.8 },
  tripo_part_15: { what: "left hand", part: "skin", tile: 256, keep: 0.8 },
  tripo_part_14: { what: "left forearm", part: "skin", tile: 256, keep: 0.8 },
  tripo_part_6: { robeBody: true, what: "upper robe", part: "robe", tile: 512, keep: 0.7 },
  tripo_part_1: { what: "right sleeve", part: "robe", tile: 512, keep: 0.7, skinInside: true },
  tripo_part_13: { what: "left sleeve", part: "robe", tile: 512, keep: 0.7 },
  tripo_part_9: { robeBody: true, what: "belt", part: "robe", tile: 256, keep: 0.7 },
  tripo_part_5: { robeBody: true, what: "skirt", part: "robe", tile: 1024, keep: 0.7, sash: true },
  tripo_part_7: { what: "trousers", part: "legs", tile: 512, keep: 0.45, from: "comp" },
  tripo_part_4: { what: "right leg wrap", part: "legs", tile: 256, keep: 0.7 },
  tripo_part_10: { what: "left leg wrap", part: "legs", tile: 256, keep: 0.7 },
  tripo_part_3: { what: "right shoe", part: "shoes", tile: 256, keep: 0.6 },
  tripo_part_11: { what: "left shoe", part: "shoes", tile: 256, keep: 0.6 },
};
// The hanging end of the sash, in metres on him (x to his left, z forward, y up): a box round it, and how far proud of
// the skirt a point must stand to be the sash rather than the skirt under it.
const SASH = { a: [30, 72], y: [0.355, 0.6], proud: 0.006, inset: 0.004 };
const ATLAS = 2048, OUT_BASE = 2048, OUT_NORMAL = 1024;

const dir = process.argv[2], dst = process.argv[3] || path.join(path.dirname(new URL(import.meta.url).pathname), "out", "novice-tripo.glb");
if (!dir) { console.error("usage: node tools/novice-tripo.mjs <dir with seg-model.glb and comp-model.glb> [out.glb]"); process.exit(1); }
const files = { seg: path.join(dir, "seg-model.glb"), comp: path.join(dir, "comp-model.glb") };
const shas = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")]));
for (const [k, s] of Object.entries(shas)) console.log("source", path.basename(files[k]), "sha256", s);

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const docs = { seg: await io.read(files.seg), comp: await io.read(files.comp) };

// ---- 1. the pieces, turned and stood ----
/** A piece as plain arrays, in Tripo's frame (y up, facing +x, his left on -z). */
function readPiece(doc, name) {
  const node = doc.getRoot().listNodes().find((n) => n.getName() === name); if (!node) throw new Error(`no ${name} in the model`);
  const prim = node.getMesh().listPrimitives()[0], M = node.getWorldMatrix(), mat = prim.getMaterial();
  const a = prim.getAttribute("POSITION").getArray(), na = prim.getAttribute("NORMAL").getArray(), n = a.length / 3;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
    for (let k = 0; k < 3; k++) P[i * 3 + k] = M[k] * x + M[4 + k] * y + M[8 + k] * z + M[12 + k];
    const u = na[i * 3], v = na[i * 3 + 1], w = na[i * 3 + 2];
    for (let k = 0; k < 3; k++) N[i * 3 + k] = M[k] * u + M[4 + k] * v + M[8 + k] * w;
  }
  return { P, N, UV: Float32Array.from(prim.getAttribute("TEXCOORD_0").getArray()), I: Uint32Array.from(prim.getIndices().getArray()),
    base: mat.getBaseColorTexture().getImage(), normal: mat.getNormalTexture().getImage(), mr: mat.getMetallicRoughnessTexture().getImage() };
}
const pieces = {};
for (const [name, spec] of Object.entries(PIECES)) pieces[name] = { ...spec, name, ...readPiece(docs[spec.from || "seg"], name) };
// Tripo faces +x with his left on -z; he faces +z with his left on +x: (x, y, z) → (-z, y, x).
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
const turn = (A) => { for (let i = 0; i < A.length; i += 3) { const x = A[i], z = A[i + 2]; A[i] = -z; A[i + 2] = x; } };
for (const p of Object.values(pieces)) { turn(p.P); turn(p.N); for (let i = 0; i < p.P.length; i++) { lo[i % 3] = Math.min(lo[i % 3], p.P[i]); hi[i % 3] = Math.max(hi[i % 3], p.P[i]); } }
const scale = HEIGHT / (hi[1] - lo[1]), cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
const stand = (P) => { for (let i = 0; i < P.length; i += 3) { P[i] = (P[i] - cx) * scale; P[i + 1] = (P[i + 1] - lo[1]) * scale; P[i + 2] = (P[i + 2] - cz) * scale; } };
for (const p of Object.values(pieces)) { stand(p.P); for (let i = 0; i < p.N.length; i += 3) { const l = Math.hypot(p.N[i], p.N[i + 1], p.N[i + 2]) || 1; p.N[i] /= l; p.N[i + 1] /= l; p.N[i + 2] /= l; } }
console.log(`scale ${scale.toFixed(4)}, ${((hi[0] - lo[0]) * scale).toFixed(3)} x ${HEIGHT} x ${((hi[2] - lo[2]) * scale).toFixed(3)} m`);

/** Keep only the triangles `keep(t)` says, and the vertices they use. */
function filter(p, keep) {
  const map = new Int32Array(p.P.length / 3).fill(-1), I = [], P = [], N = [], UV = [], extra = p.flag ? [] : null;
  for (let t = 0; t < p.I.length / 3; t++) {
    if (!keep(t)) continue;
    for (let k = 0; k < 3; k++) {
      const v = p.I[t * 3 + k];
      if (map[v] < 0) { map[v] = P.length / 3; P.push(p.P[v * 3], p.P[v * 3 + 1], p.P[v * 3 + 2]); N.push(p.N[v * 3], p.N[v * 3 + 1], p.N[v * 3 + 2]); UV.push(p.UV[v * 2], p.UV[v * 2 + 1]); if (extra) extra.push(p.flag[v]); }
      I.push(map[v]);
    }
  }
  return { P: Float32Array.from(P), N: Float32Array.from(N), UV: Float32Array.from(UV), I: Uint32Array.from(I), flag: extra ? Uint8Array.from(extra) : undefined };
}
/** Distance from each triangle's centre to the nearest point of surface `S` (positions and triangles). */
function distanceTo(S, p) {
  const E = 0.012, cell = new Map(), tri = new THREE.Triangle(), q = new THREE.Vector3(), r = new THREE.Vector3();
  const key = (x, y, z) => `${Math.floor(x / E)},${Math.floor(y / E)},${Math.floor(z / E)}`;
  for (let t = 0; t < S.I.length; t += 3) {
    const ks = new Set(); for (let k = 0; k < 3; k++) { const v = S.I[t + k]; ks.add(key(S.P[v * 3], S.P[v * 3 + 1], S.P[v * 3 + 2])); }
    for (const k of ks) { if (!cell.has(k)) cell.set(k, []); cell.get(k).push(t); }
  }
  const out = new Float32Array(p.I.length / 3);
  for (let t = 0; t < out.length; t++) {
    q.set(0, 0, 0); for (let k = 0; k < 3; k++) { const v = p.I[t * 3 + k]; q.x += p.P[v * 3] / 3; q.y += p.P[v * 3 + 1] / 3; q.z += p.P[v * 3 + 2] / 3; }
    const c = [q.x, q.y, q.z].map((v) => Math.floor(v / E)); let best = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const s of cell.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) || []) {
      const A = S.I[s], B = S.I[s + 1], C = S.I[s + 2];
      tri.a.fromArray(S.P, A * 3); tri.b.fromArray(S.P, B * 3); tri.c.fromArray(S.P, C * 3); tri.closestPointToPoint(q, r); best = Math.min(best, r.distanceTo(q));
    }
    out[t] = best;
  }
  return out;
}

// ---- 2. the completed trousers: drop the closed cuffs, colour what came without texture ----
{
  const p = pieces.tripo_part_7, orig = readPiece(docs.seg, "tripo_part_7"); turn(orig.P); stand(orig.P);
  const d = distanceTo(orig, p), made = (t) => d[t] > 0.003;
  let lowest = Infinity; for (let i = 1; i < orig.P.length; i += 3) lowest = Math.min(lowest, orig.P[i]);
  const cy = (t) => (p.P[p.I[t * 3] * 3 + 1] + p.P[p.I[t * 3 + 1] * 3 + 1] + p.P[p.I[t * 3 + 2] * 3 + 1]) / 3;
  p.flag = new Uint8Array(p.P.length / 3);
  // a vertex is "made" when every triangle round it is: it then takes the plain colour
  const any = new Uint8Array(p.P.length / 3);
  for (let t = 0; t < d.length; t++) for (let k = 0; k < 3; k++) { const v = p.I[t * 3 + k]; if (!made(t)) any[v] = 1; }
  for (let v = 0; v < any.length; v++) p.flag[v] = any[v] ? 0 : 1;
  const nMade = d.filter((x) => x > 0.003).length, before = d.length;
  Object.assign(p, filter(p, (t) => !(made(t) && cy(t) < lowest + 0.05)));
  console.log(`trousers: ${nMade} of ${before} triangles made by the completion; ${before - p.I.length / 3} closing the cuffs dropped`);
}

// ---- 2a. the trousers are slimmed where the skirt hides them ----
// Tripo's trousers are as baggy under the skirt as below it. Seated, monk.js lifts the front of the skirt onto his lap,
// and thighs this full came up through it; nothing of them shows standing above the hem, so there they are drawn in
// towards each leg's own line (SLIM: by how much, from 0.40 m up; none below 0.36, where the bulge over the leg wraps shows).
const SLIM = { k: +(process.env.SLIM ?? 0.75), from: 0.36, full: 0.4, top: 0.6 };
{
  const p = pieces.tripo_part_7, sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let v = 0; v < p.P.length / 3; v++) {
    const x = p.P[v * 3], y = p.P[v * 3 + 1], z = p.P[v * 3 + 2], s = 1 - (1 - SLIM.k) * sm(SLIM.from, SLIM.full, y) * sm(SLIM.top, SLIM.top - 0.08, y);
    const ax = Math.sign(x || 1) * 0.085 * sm(0.62, 0.5, y);   // each leg's own line, meeting at his middle by the waist
    p.P[v * 3] = ax + (x - ax) * s; p.P[v * 3 + 2] = z * s;
  }
}

// ---- 3. the bare forearm inside the right sleeve goes to the skin ----
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx ? d / mx : 0, mx]; };
const rawOf = async (img) => { const { data, info } = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const sample = (tex, u, v) => { const x = Math.min(tex.w - 1, Math.max(0, Math.round(u * (tex.w - 1)))), y = Math.min(tex.h - 1, Math.max(0, Math.round(v * (tex.h - 1)))), o = (y * tex.w + x) * 3; return [tex.data[o], tex.data[o + 1], tex.data[o + 2]]; };
for (const p of Object.values(pieces).filter((q) => q.skinInside)) {
  const tex = await rawOf(p.base), nt = p.I.length / 3, skinT = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    let u = 0, v = 0; for (let k = 0; k < 3; k++) { u += p.UV[p.I[t * 3 + k] * 2] / 3; v += p.UV[p.I[t * 3 + k] * 2 + 1] / 3; }
    const [h, s, val] = hsv(...sample(tex, u, v).map((c) => c / 255));
    skinT[t] = h > 12 && h < 45 && s > 0.18 && s < 0.6 && val > 0.55 ? 1 : 0;   // peach, not the robe's brick red
  }
  // islands smaller than a forearm are flecks in the cloth
  const n = skinT.reduce((a, b) => a + b, 0);
  const skin = filter(p, (t) => skinT[t]), cloth = filter(p, (t) => !skinT[t]);
  pieces[p.name + "_skin"] = { ...p, name: p.name + "_skin", what: "right forearm", part: "skin", ...skin, shareTile: p.name };
  Object.assign(p, cloth);
  console.log(`${p.what}: ${n} triangles of bare forearm moved to the skin`);
}

// ---- 4. the sash's hanging end, cut from the skirt ----
// Tripo gave the sash's end as part of the skirt's one surface, standing 2-3 cm proud of it. Round his middle, at each
// height, the skirt's own radius is taken either side of the sash (SASH.a: the angles, to his left of straight ahead,
// that bound it) and drawn straight across; a vertex standing more than SASH.proud beyond that line, inside SASH's box,
// is the sash. Its triangles become a piece of their own; a copy of them, pressed back onto that line (less SASH.inset)
// where they do not touch the rest of the skirt, fills the skirt where they were.
for (const p of Object.values(pieces).filter((q) => q.sash)) {
  const nv = p.P.length / 3; let cx = 0, cz = 0; for (let i = 0; i < nv; i++) { cx += p.P[i * 3] / nv; cz += p.P[i * 3 + 2] / nv; }
  const ang = (i) => Math.atan2(p.P[i * 3] - cx, p.P[i * 3 + 2] - cz) * 180 / Math.PI, rad = (i) => Math.hypot(p.P[i * 3] - cx, p.P[i * 3 + 2] - cz);
  const band = (y) => Math.floor(y / 0.01), rIn = new Map(), rOut = new Map();
  for (let i = 0; i < nv; i++) { const a = ang(i), b = band(p.P[i * 3 + 1]), r = rad(i); if (a > SASH.a[0] - 6 && a < SASH.a[0]) rIn.set(b, Math.max(rIn.get(b) || 0, r)); if (a > SASH.a[1] && a < SASH.a[1] + 6) rOut.set(b, Math.max(rOut.get(b) || 0, r)); }
  const baseR = (i) => { const b = band(p.P[i * 3 + 1]), r0 = rIn.get(b) ?? rIn.get(b - 1) ?? rIn.get(b + 1), r1 = rOut.get(b) ?? rOut.get(b - 1) ?? rOut.get(b + 1); if (r0 == null || r1 == null) return Infinity; const k = (ang(i) - SASH.a[0]) / (SASH.a[1] - SASH.a[0]); return r0 + (r1 - r0) * k; };
  const proud = new Uint8Array(nv);
  for (let i = 0; i < nv; i++) { const a = ang(i), y = p.P[i * 3 + 1]; if (a > SASH.a[0] && a < SASH.a[1] && y > SASH.y[0] && y < SASH.y[1] && rad(i) > baseR(i) + SASH.proud) proud[i] = 1; }
  // the same point may have two copies (a texture seam): a point is proud if any copy is
  const key = (i) => `${p.P[i * 3]},${p.P[i * 3 + 1]},${p.P[i * 3 + 2]}`, pk = new Set(); for (let i = 0; i < nv; i++) if (proud[i]) pk.add(key(i)); for (let i = 0; i < nv; i++) if (pk.has(key(i))) proud[i] = 1;
  const nt = p.I.length / 3; let isSash = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) isSash[t] = proud[p.I[t * 3]] && proud[p.I[t * 3 + 1]] && proud[p.I[t * 3 + 2]] ? 1 : 0;
  // keep the largest island (by shared points): flecks elsewhere in the box stay skirt
  { const owner = new Map(), comp = new Int32Array(nt).fill(-1); let best = -1, bestN = 0, c = 0;
    const byPoint = new Map(); for (let t = 0; t < nt; t++) if (isSash[t]) for (let k = 0; k < 3; k++) { const q = key(p.I[t * 3 + k]); if (!byPoint.has(q)) byPoint.set(q, []); byPoint.get(q).push(t); }
    for (let t0 = 0; t0 < nt; t0++) { if (!isSash[t0] || comp[t0] >= 0) continue; const st = [t0]; comp[t0] = c; let n = 0;
      while (st.length) { const t = st.pop(); n++; for (let k = 0; k < 3; k++) for (const u of byPoint.get(key(p.I[t * 3 + k]))) if (comp[u] < 0) { comp[u] = c; st.push(u); } }
      if (n > bestN) { bestN = n; best = c; } c++; }
    for (let t = 0; t < nt; t++) if (isSash[t] && comp[t] !== best) isSash[t] = 0; void owner; }
  const usedBySkirt = new Set(); for (let t = 0; t < nt; t++) if (!isSash[t]) for (let k = 0; k < 3; k++) usedBySkirt.add(key(p.I[t * 3 + k]));
  const sash = filter(p, (t) => isSash[t]);
  // the backing: the sash's triangles again, inside the skirt; corners shared with the skirt stay put, the rest go back
  const P = [...p.P], N = [...p.N], UV = [...p.UV], I = [], copy = new Map();
  for (let t = 0; t < nt; t++) {
    if (!isSash[t]) { I.push(p.I[t * 3], p.I[t * 3 + 1], p.I[t * 3 + 2]); continue; }
    for (let k = 0; k < 3; k++) {
      const v = p.I[t * 3 + k]; if (usedBySkirt.has(key(v))) { I.push(v); continue; }
      if (!copy.has(v)) { const r = rad(v), to = Math.max(0.02, baseR(v) - SASH.inset), s = to / r, o = P.length / 3;
        P.push(cx + (p.P[v * 3] - cx) * s, p.P[v * 3 + 1], cz + (p.P[v * 3 + 2] - cz) * s); N.push(p.N[v * 3], p.N[v * 3 + 1], p.N[v * 3 + 2]); UV.push(p.UV[v * 2], p.UV[v * 2 + 1]); copy.set(v, o); }
      I.push(copy.get(v));
    }
  }
  Object.assign(p, filter({ P: Float32Array.from(P), N: Float32Array.from(N), UV: Float32Array.from(UV), I: Uint32Array.from(I) }, () => true));
  let top = -Infinity; for (let i = 1; i < sash.P.length; i += 3) top = Math.max(top, sash.P[i]);
  pieces[p.name + "_sash"] = { ...p, ...sash, name: p.name + "_sash", what: "sash end", part: "robe", isSash: true, sashTop: top, shareTile: p.name, sash: false, robeBody: true, keep: 0.8 };
  console.log(`sash: ${sash.I.length / 3} triangles cut from the ${p.what}, top at ${top.toFixed(3)} m; ${copy.size} points pressed back to fill it`);
}

// ---- 5. thin each piece, keeping borders and seams ----
let trisIn = 0, trisOut = 0;
for (const p of Object.values(pieces)) {
  trisIn += p.I.length / 3;
  const target = Math.floor(p.I.length * (p.keep ?? 0.7) / 3) * 3;
  // weld exact copies that share position and texture coordinate first (Tripo writes each triangle's corners apart at seams)
  const map = new Map(), remap = new Uint32Array(p.P.length / 3), keepV = [];
  for (let i = 0; i < remap.length; i++) {
    const k = `${p.P[i * 3]},${p.P[i * 3 + 1]},${p.P[i * 3 + 2]},${p.UV[i * 2]},${p.UV[i * 2 + 1]}`;
    if (!map.has(k)) { map.set(k, keepV.length); keepV.push(i); } remap[i] = map.get(k);
  }
  const P = new Float32Array(keepV.length * 3), N = new Float32Array(keepV.length * 3), UV = new Float32Array(keepV.length * 2), F = p.flag ? new Uint8Array(keepV.length) : null;
  keepV.forEach((i, j) => { P.set(p.P.subarray(i * 3, i * 3 + 3), j * 3); N.set(p.N.subarray(i * 3, i * 3 + 3), j * 3); UV.set(p.UV.subarray(i * 2, i * 2 + 2), j * 2); if (F) F[j] = p.flag[i]; });
  const I = p.I.map((v) => remap[v]);
  const [simple] = MeshoptSimplifier.simplify(I, P, 3, target, 0.01, ["LockBorder"]);
  Object.assign(p, filter({ P, N, UV, I: simple, flag: F }, () => true));
  trisOut += p.I.length / 3;
}
console.log(`thinned ${trisIn} -> ${trisOut} triangles`);

// ---- 6. one atlas ----
const order = Object.values(pieces).filter((p) => !p.shareTile).sort((a, b) => b.tile - a.tile || a.name.localeCompare(b.name, "en", { numeric: true }));
const tiles = {}; let sx = 0, sy = 0, rowH = 0;
const place = (key, size) => { if (sx + size > ATLAS) { sx = 0; sy += rowH; rowH = 0; } tiles[key] = { x: sx, y: sy, s: size }; sx += size; rowH = Math.max(rowH, size); if (sy + size > ATLAS) throw new Error("the atlas is full"); };
for (const p of order) place(p.name, p.tile);
const PATCH = 32; place("plain:legs", PATCH);
const GUT = 4;
const tileOf = async (img, s) => sharp(Buffer.from(img)).resize(s - 2 * GUT, s - 2 * GUT, { kernel: "lanczos3" }).extend({ top: GUT, bottom: GUT, left: GUT, right: GUT, extendWith: "copy" }).removeAlpha().png().toBuffer();
async function atlas(kind, fallback) {
  const layers = [];
  for (const p of order) layers.push({ input: await tileOf(p[kind], p.tile), left: tiles[p.name].x, top: tiles[p.name].y });
  return { layers, fallback };
}
// the trousers' plain colour: the mean of the trousers' own texture under the faces it was given for
let legColor = [90, 84, 78];
{
  const p = pieces.tripo_part_7, tex = await rawOf(p.base), sum = [0, 0, 0]; let n = 0;
  for (let v = 0; v < p.P.length / 3; v++) if (!p.flag[v] && p.P[v * 3 + 1] > 0.3 && p.P[v * 3 + 1] < 0.42) { const c = sample(tex, p.UV[v * 2], p.UV[v * 2 + 1]); for (let k = 0; k < 3; k++) sum[k] += c[k]; n++; }
  if (n) legColor = sum.map((s) => Math.round(s / n));
}
const plain = (rgb) => sharp({ create: { width: PATCH, height: PATCH, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
const baseL = await atlas("base"), normalL = await atlas("normal");
baseL.layers.push({ input: await plain(legColor), left: tiles["plain:legs"].x, top: tiles["plain:legs"].y });
normalL.layers.push({ input: await plain([128, 128, 255]), left: tiles["plain:legs"].x, top: tiles["plain:legs"].y });
const compose = async (L, bg, size, q) => {
  const big = await sharp({ create: { width: ATLAS, height: ATLAS, channels: 3, background: bg } }).composite(L.layers).png().toBuffer();
  return new Uint8Array(await sharp(big).resize(size, size, { kernel: "lanczos3" }).webp({ quality: q, effort: 6 }).toBuffer());
};
const baseImg = await compose(baseL, { r: 0, g: 0, b: 0 }, OUT_BASE, 88), normalImg = await compose(normalL, { r: 128, g: 128, b: 255 }, OUT_NORMAL, 90);
// the metal-roughness maps, as one number: the mean roughness (green) of every piece, by its area in the atlas
let roughness = 0.8;
{ let s = 0, w = 0; for (const p of order) { const t = await rawOf(p.mr); let g = 0; for (let i = 1; i < t.data.length; i += 3) g += t.data[i]; s += (g / (t.data.length / 3) / 255) * p.tile * p.tile; w += p.tile * p.tile; } roughness = +(s / w).toFixed(3); }
for (const p of Object.values(pieces)) {
  const T = tiles[p.shareTile || p.name], P = tiles["plain:legs"];
  for (let v = 0; v < p.UV.length / 2; v++) {
    const plainV = p.flag && p.flag[v], t = plainV ? P : T;
    const u = plainV ? 0.5 : Math.min(1, Math.max(0, p.UV[v * 2])), w = plainV ? 0.5 : Math.min(1, Math.max(0, p.UV[v * 2 + 1]));
    p.UV[v * 2] = (t.x + GUT + u * (t.s - 2 * GUT)) / ATLAS; p.UV[v * 2 + 1] = (t.y + GUT + w * (t.s - 2 * GUT)) / ATLAS;
  }
}
console.log(`atlas: ${order.length} tiles, base ${OUT_BASE} px ${(baseImg.length / 1e3).toFixed(0)} kB, normal ${OUT_NORMAL} px ${(normalImg.length / 1e3).toFixed(0)} kB, roughness ${roughness}, trousers' plain colour rgb(${legColor})`);

// ---- 7. weights ----
const { createMonk } = await import("../app/src/monk.js");
const monk = createMonk(); monk.update(1 / 30, 0, "bind", 0); monk.group.updateMatrixWorld(true);
const boneNames = monk.skeleton.bones.map((b) => b.name);
// all pieces as one surface, to weigh and weld together
const all = { P: [], I: [], part: [], piece: [] }; let base = 0;
const list = Object.values(pieces);
for (const p of list) { p.offset = base; for (const v of p.P) all.P.push(v); for (const i of p.I) all.I.push(i + base); for (let v = 0; v < p.P.length / 3; v++) { all.part.push(PARTS.indexOf(p.part)); all.piece.push(p.name); } base += p.P.length / 3; }
const P0 = Float32Array.from(all.P), I0 = Uint32Array.from(all.I), nv = P0.length / 3;
const vparts = all.part.map((x) => new Set([x]));
const { J, W } = transferWeights(P0, vparts, monk, PARTS);
// The body of the robe (the upper robe, the belt, the skirt and what fills it behind the sash) takes the robe's weights
// as monk.js gives them, by height and by the way each point faces (ROBE_BODY): the built figure's robe has an opening
// down its front where this skirt is closed, and the nearest of its vertices tore this one open there when he sat.
// Seated on a stool, monk.js lifts the front of its skirt on the robeFront bone onto his lap. This skirt hangs further
// before that bone's pivot than the built figure's and over fuller thighs: lifted, it stood level some 9 cm above the
// knees, or (where the thighs are full) inside them, and from before him one looked under it at the trousers.
// So the front half below his hips is weighted (#246, second round):
//   - either side of his middle, with the thigh under it (THIGH, full beyond 7 cm from the middle): cloth that turns with
//     the thigh it lies on stays outside it;
//   - in the middle, between the thighs, robeFront still, with HEM_HIPS of it left on the hips toward the hem, so that
//     lifted it slopes down from the sash onto the lap rather than standing out above it.
// Walking, the two thighs swing either way and the middle keeps robeFront's motion, so the hem moves much as before.
const THIGH = +(process.env.THIGH ?? 1), HEM_HIPS = +(process.env.HEM_HIPS ?? 0.45);
function thighFront(w, x, y, z) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const c = Math.cos(Math.atan2(x, z)), front = sm(-0.1, 0.5, c);
  const hold = HEM_HIPS * front * sm(0.47, 0.31, y) * sm(0.09, 0.02, Math.abs(x));
  if (hold > 0) { const t = w.reduce((a, [, v]) => a + v, 0); w = w.map(([n, v]) => [n, v * (1 - hold)]); w.push(["hips", hold * t]); }
  const k = THIGH * front * sm(0.53, 0.42, y) * sm(0.0, 0.07, Math.abs(x)); if (k <= 0) return w;
  const left = sm(-0.05, 0.05, x), out = w.map(([n, v]) => [n, v * (1 - k)]), tot = w.reduce((a, [, v]) => a + v, 0);
  out.push(["leftUpperLeg", k * tot * left], ["rightUpperLeg", k * tot * (1 - left)]);
  return out.filter(([, v]) => v > 1e-5);
}
for (const p of list) if (p.robeBody) for (let i = p.offset; i < p.offset + p.P.length / 3; i++) {
  const w = thighFront(robeWeights(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]), P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]).sort((a, b) => b[1] - a[1]).slice(0, 4), s = w.reduce((a, [, v]) => a + v, 0);
  for (let j = 0; j < 4; j++) { J[i * 4 + j] = w[j] ? boneNames.indexOf(w[j][0]) : 0; W[i * 4 + j] = w[j] ? w[j][1] / s : 0; }
}
const nArm = armWeights(P0, vparts, J, W, monk);
console.log(`weights from the figure built in code; ${nArm} vertices weighted along the arm`);
// The sash's end hangs from the knot on its own bone: within 8 cm of its top it goes over from the weights it took (the
// skirt's and the hips') to the sashTail bone, below that wholly on it. It is kept out of the welding, so that its edge
// is free of the skirt it lay on.
const sashBone = boneNames.indexOf("sashTail"), sashV = new Uint8Array(nv);
for (const p of list) if (p.isSash) sashV.fill(1, p.offset, p.offset + p.P.length / 3);
const RANK = { skin: 1, robe: 2, legs: 0, shoes: 3 }, WELD = +(process.env.NOVICE_WELD || 8);
{
  const rank = Int8Array.from(all.part, (p) => RANK[PARTS[p]]), Pw = Float32Array.from(P0);
  for (let i = 0; i < nv; i++) if (sashV[i]) Pw[i * 3 + 1] += 100;
  const r = weldWeights(Pw, J, W, { smooth: Math.max(0, WELD - 1), index: I0, rank });
  J.set(r.J); W.set(r.W);
  console.log(`welded weights: ${nv} vertices in ${r.groups} points, smoothed ${Math.max(0, WELD - 1)} times`);
}
{
  const p = list.find((q) => q.isSash), ramp = (v) => { const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t); };
  for (let i = p.offset; i < p.offset + p.P.length / 3; i++) {
    const k = ramp((p.sashTop - P0[i * 3 + 1]) / 0.08), m = new Map();
    for (let j = 0; j < 4; j++) if (W[i * 4 + j] > 0) m.set(J[i * 4 + j], (m.get(J[i * 4 + j]) || 0) + (1 - k) * W[i * 4 + j]);
    m.set(sashBone, (m.get(sashBone) || 0) + k);
    const top = [...m].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4), s = top.reduce((a, [, w]) => a + w, 0);
    for (let j = 0; j < 4; j++) { J[i * 4 + j] = top[j] ? top[j][0] : 0; W[i * 4 + j] = top[j] ? top[j][1] / s : 0; }
  }
}

{
  const rank = Int8Array.from(all.part, (p) => RANK[PARTS[p]]);
// Copies that fall in one cell of 0.01 mm but lie a hair further apart than the welding's reach take one weight too:
  // the highest-ranked copy's, as the welding gives (tests/unit/novice-tripo.test.mjs asks it of every such cell). The top
  // edge of the sash's end, where it has not yet gone over to its bone, is sewn to the knot the same way.
  const cell = new Map(); let fixed = 0;
  for (let i = 0; i < nv; i++) { if (sashV[i]) continue; const k = `${Math.round(P0[i * 3] * 1e5)},${Math.round(P0[i * 3 + 1] * 1e5)},${Math.round(P0[i * 3 + 2] * 1e5)}`; const h = cell.get(k); if (h === undefined || rank[i] > rank[h]) cell.set(k, i); }
  for (let i = 0; i < nv; i++) { if (sashV[i] && (W[i * 4] === 1 && J[i * 4] === sashBone || [0, 1, 2, 3].some((k) => J[i * 4 + k] === sashBone && W[i * 4 + k] > 0))) continue; const h = cell.get(`${Math.round(P0[i * 3] * 1e5)},${Math.round(P0[i * 3 + 1] * 1e5)},${Math.round(P0[i * 3 + 2] * 1e5)}`); if (h !== i) { for (let k = 0; k < 4; k++) { if (J[i * 4 + k] !== J[h * 4 + k] || W[i * 4 + k] !== W[h * 4 + k]) fixed++; J[i * 4 + k] = J[h * 4 + k]; W[i * 4 + k] = W[h * 4 + k]; } } }
  if (fixed) console.log(`  ${fixed} weights of copies just beyond the welding's reach made one`);
  }

// ---- 8. write ----
const out = new Document(); out.createBuffer();
out.createExtension(EXTTextureWebP).setRequired(true);
const buf = out.getRoot().listBuffers()[0], scene = out.createScene("novice");
const material = out.createMaterial("novice")
  .setBaseColorTexture(out.createTexture("base").setImage(baseImg).setMimeType("image/webp"))
  .setNormalTexture(out.createTexture("normal").setImage(normalImg).setMimeType("image/webp"))
  .setMetallicFactor(0).setRoughnessFactor(roughness).setDoubleSided(true);
const acc = (type, array) => out.createAccessor().setType(type).setArray(array).setBuffer(buf);
const counts = {}; let robeSum = [0, 0, 0], robeN = 0;
for (const [pi, name] of PARTS.entries()) {
  const mine = list.filter((p) => p.part === name), pos = [], nor = [], uv = [], jj = [], ww = [], idx = [];
  for (const p of mine) {
    const o = pos.length / 3;
    for (let v = 0; v < p.P.length / 3; v++) { const g = p.offset + v; pos.push(...p.P.subarray(v * 3, v * 3 + 3)); nor.push(...p.N.subarray(v * 3, v * 3 + 3)); uv.push(p.UV[v * 2], p.UV[v * 2 + 1]); for (let k = 0; k < 4; k++) { jj.push(J[g * 4 + k]); ww.push(W[g * 4 + k]); } }
    for (const i of p.I) idx.push(i + o);
  }
  counts[name] = { triangles: idx.length / 3, vertices: pos.length / 3 };
  const prim = out.createPrimitive().setAttribute("POSITION", acc("VEC3", new Float32Array(pos))).setAttribute("NORMAL", acc("VEC3", new Float32Array(nor)))
    .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(uv))).setAttribute("JOINTS_0", acc("VEC4", new Uint16Array(jj))).setAttribute("WEIGHTS_0", acc("VEC4", new Float32Array(ww)))
    .setIndices(acc("SCALAR", new Uint32Array(idx))).setMaterial(material);
  scene.addChild(out.createNode(name).setMesh(out.createMesh(name).addPrimitive(prim)));
}
// the robe's colour, sRGB, as novice.glb's extras give it
{ const t = await rawOf(pieces.tripo_part_5.base); for (let i = 0; i < t.data.length; i += 3 * 97) { for (let k = 0; k < 3; k++) robeSum[k] += t.data[i + k]; robeN++; } }
const robeColor = (Math.round(robeSum[0] / robeN) << 16) | (Math.round(robeSum[1] / robeN) << 8) | Math.round(robeSum[2] / robeN);
out.getRoot().setExtras({ generator: "tools/novice-tripo.mjs", source: { seg: shas.seg, comp: shas.comp }, height: HEIGHT, robeColor, bones: boneNames, parts: PARTS, counts,
  pieces: Object.fromEntries(list.map((p) => [p.name, p.what])) });
fs.mkdirSync(path.dirname(dst), { recursive: true });
await io.write(dst, out);
const bytes = fs.readFileSync(dst);
console.log("wrote", dst, (bytes.length / 1e6).toFixed(2), "MB", "sha256", crypto.createHash("sha256").update(bytes).digest("hex"), JSON.stringify(counts));
