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
//   1b. (#286) draws the fingers together and the thumb in, in the palm's plane (SPREAD, PIVOT, THUMB);
//   3a. (#286, ARMS_IN > 0 only) turns the arms in about the shoulder, for the outline (tools/novice-outline.mjs);
//   7b. (#286) adds the helper bones under the arms (tools/novice-rig.mjs, weighed by bone heat with the robe) and keeps
//       the arms' weights off the robe's body below the shoulder;
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
  tripo_part_0: { hand: "right", what: "right hand", part: "skin", tile: 256, keep: 0.8 },
  tripo_part_15: { hand: "left", what: "left hand", part: "skin", tile: 256, keep: 0.8 },
  tripo_part_14: { arm: "left", what: "left forearm", part: "skin", tile: 256, keep: 0.8 },
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

// ---- 1a. the hands, made to the skeleton's hands ----
// Tripo's hands hang with the palm to the thigh and the fingers spread front to back, larger than the hands of the
// figure built in code and some 3 cm off the line of its hand bones. Every observance turns the hand bone so that the
// code hand's palm (forward in the bind pose) faces where it should, so these palms came out facing forward or back, did
// not meet when he put his palms together, and covered his face at the tea and the incense (#246, second round). Each
// hand is turned about the forearm so that its palm faces forward, scaled toward the code hand's length, width and
// thickness (HAND: 1 is the code hand's size; 0, the default since the lead's review of #255, leaves Tripo's size: shrunk,
// the fingers came out thin and flat), and its middle moved onto the bone's line; all of it
// comes in over the first 2.5 cm past the wrist, so the wrist still meets the forearm. Past the knuckles the fingers are
// bent CURL degrees toward the palm at their tips, baked in (the skeleton has one bone to a hand, as VRM requires and no more).
const HAND = +(process.env.HAND ?? 0), CURL = +(process.env.CURL ?? 18);
const SPREAD = +(process.env.SPREAD ?? 0.45), THUMB = +(process.env.THUMB ?? 50), PIVOT = +(process.env.PIVOT ?? 0.035), THUMB_FROM = +(process.env.THUMB_FROM ?? -0.03), THUMB_EDGE = +(process.env.THUMB_EDGE ?? 0.016);
const { createMonk } = await import("../app/src/monk.js");
const { rig, HELPERS } = await import("./novice-rig.mjs");
// The helper bones under the arms (tools/novice-rig.mjs, #286; ARMPIT=0 leaves them out): added to the skeleton after
// monk.js's own bones, weighed by bone heat with the upper robe and the sleeves, listed under extras.helpers.
const ARMPIT = +(process.env.ARMPIT ?? 1), ARMPIT_LEN = +(process.env.ARMPIT_LEN ?? 0.07);
const monk = createMonk(); if (ARMPIT) rig(monk, HELPERS); monk.update(1 / 30, 0, "bind", 0); monk.group.updateMatrixWorld(true);
const handReport = {};
{
  const at = (n) => monk.bones[n].getWorldPosition(new THREE.Vector3());
  const codeHand = (side) => {   // the code hand: length past the wrist, width across, thickness front to back, middle from the bone
    const g = monk.parts.skin.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, hb = monk.skeleton.bones.findIndex((b) => b.name === side + "Hand");
    const wr = at(side + "Hand"), d = wr.clone().sub(at(side + "LowerArm")).normalize(), z = new THREE.Vector3(0, 0, 1), a = d.clone().cross(z).normalize(), pts = [];
    for (let i = 0; i < p.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hb) w += sw.getComponent(i, k); if (w > 0.6) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).sub(wr)); }
    const ext = (v) => { const t = pts.map((q) => q.dot(v)); return [Math.min(...t), Math.max(...t)]; }, c = pts.reduce((s, q) => s.add(q), new THREE.Vector3()).divideScalar(pts.length);
    return { d, a, z, len: ext(d)[1], wid: ext(a)[1] - ext(a)[0], thick: ext(z)[1] - ext(z)[0], c: { a: c.dot(a), z: c.dot(z) } };
  };
  for (const p of Object.values(pieces).filter((q) => q.hand)) {
    const side = p.hand, C = codeHand(side), wr = at(side + "Hand"), { d, a, z } = C, n = p.P.length / 3, v = new THREE.Vector3();
    // the wrist: where the bone's wrist lies across this arm (Tripo's hand pieces run some way up the forearm)
    const t = Array.from({ length: n }, (_, i) => v.fromArray(p.P, i * 3).sub(wr).dot(d)), W = new THREE.Vector3(); let m = 0;
    for (let i = 0; i < n; i++) if (Math.abs(t[i]) < 0.012) { W.add(v.fromArray(p.P, i * 3)); m++; }
    W.divideScalar(m); W.sub(d.clone().multiplyScalar(W.clone().sub(wr).dot(d)));   // on the wrist's plane
    // the palm's normal: the direction in which the hand is thinnest, across the forearm, turned toward his middle
    const pts = Array.from({ length: n }, (_, i) => new THREE.Vector3().fromArray(p.P, i * 3).sub(W)), past = pts.filter((r) => r.dot(d) > 0);
    let best = null, bestW = Infinity; for (let k = 0; k < 180; k += 2) { const ang = k * Math.PI / 180, u = a.clone().applyAxisAngle(d, ang), e = past.map((q) => q.dot(u)), w = Math.max(...e) - Math.min(...e); if (w < bestW) { bestW = w; best = u; } }
    if (best.x * (side === "left" ? -1 : 1) < 0) best.negate();   // toward his middle: that is where the palm faces, hanging
    const q = new THREE.Quaternion().setFromUnitVectors(best, z);   // both lie across the forearm, so this turns about it
    const turned = pts.map((r) => r.clone().applyQuaternion(q));
    const ext = (u) => { const e = turned.filter((r) => r.dot(d) > 0).map((r) => r.dot(u)); return [Math.min(...e), Math.max(...e)]; };
    const [, l1] = ext(d), [a0, a1] = ext(a), [z0, z1] = ext(z), mix = (from, to) => 1 + HAND * (to / from - 1);
    if (process.env.HAND_DEBUG) console.log(side, "code", JSON.stringify(C, (k, x) => (typeof x === "number" ? +x.toFixed(3) : x)), "tripo len", l1.toFixed(3), "wid", (a1 - a0).toFixed(3), "thick", (z1 - z0).toFixed(3), "wrist from bone", W.clone().sub(wr).toArray().map((x) => x.toFixed(3)), "n", n);
    const sd = mix(l1, C.len), sa = mix(a1 - a0, C.wid), sz = mix(z1 - z0, C.thick);
    const scaled = turned.map((r) => d.clone().multiplyScalar(r.dot(d) * sd).add(a.clone().multiplyScalar(r.dot(a) * sa)).add(z.clone().multiplyScalar(r.dot(z) * sz)));
    // its middle onto the bone's line, as the code hand's is (across and front to back; along the arm it stays)
    const fwd = scaled.filter((r, i) => pts[i].dot(d) > 0), mid = fwd.reduce((s, r) => s.add(r), new THREE.Vector3()).divideScalar(fwd.length).add(W).sub(wr);
    const shift = a.clone().multiplyScalar(C.c.a - mid.dot(a)).add(z.clone().multiplyScalar(C.c.z - mid.dot(z)));
    const sm = (x0, x1, x) => { const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0))); return u * u * (3 - 2 * u); };
    // The turn is spread along the last 10 cm of the forearm, as a forearm rolls over; the size and the move come in over
    // the wrist. The forearm's own pieces go with it, so nothing parts at the wrist.
    // The fingers drawn together and the thumb drawn in (#286, from the 3D review on #246). Tripo's fingers lie nearly
    // straight but wide apart (roots and tips alike some 5.5 cm from first to last) and its thumb stands straight out from
    // the wrist, so the hand is 10.7 cm across where the code hand is 5.8, and at the tea the spread fingers came up over his
    // eyes. Past the knuckles the hand falls apart, by its shared points, into its four fingers (as
    // tools/novice-measure-fingers.mjs finds them). Each is turned in the palm's plane about its root so that its tip comes
    // in toward the middle of the hand: the tips' spread becomes SPREAD of what it was. The thumb, which belongs to the palm,
    // is turned in the same plane about its root by the wrist, THUMB degrees toward the fingers. The turns come in over the
    // knuckles (and the thumb's root), so nothing creases; nothing is shortened or made smaller, and the palm stays flat, so
    // the palms still meet when he puts them together.
    const bend = { w: new Float32Array(n), mix: [], of: new Map() }, fingers = [], thumb = { w: new Float32Array(n), root: null, sgn: 1 };
    {
      const T = scaled.map((r) => r.dot(d)), A = scaled.map((r) => r.dot(a)), L = Math.max(...T), tf = 0.45 * L, key = (i) => `${p.P[i * 3]},${p.P[i * 3 + 1]},${p.P[i * 3 + 2]}`;
      const id = new Map(), par = [], find = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
      const node = (i) => { const k = key(i); if (!id.has(k)) { id.set(k, par.length); par.push(par.length); } return id.get(k); };
      const past = (i) => T[i] > tf;
      for (let t = 0; t < p.I.length; t += 3) { const c = [p.I[t], p.I[t + 1], p.I[t + 2]]; if (!c.every(past)) continue; const [x, y, w] = c.map(node); par[find(y)] = find(x); par[find(w)] = find(x); }
      const comps = new Map(); for (let i = 0; i < n; i++) if (past(i) && id.has(key(i))) { const r = find(id.get(key(i))); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); }
      for (const c of [...comps.values()].filter((q) => q.length > 8)) {
        const t0 = Math.min(...c.map((i) => T[i])), root = new THREE.Vector3(); let m = 0; for (const i of c) if (T[i] < t0 + 0.006) { root.add(scaled[i]); m++; } root.divideScalar(m);
        let tip = c[0]; for (const i of c) if (T[i] > T[tip]) tip = i;
        fingers.push({ c, root, tip: scaled[tip].clone(), across: root.dot(a) });
      }
      fingers.sort((x, y) => x.across - y.across);
      if (fingers.length === 4) {
        const tips = fingers.map((f) => f.tip.dot(a)), mid = (tips[1] + tips[2]) / 2;
        fingers.forEach((f, k) => {
          const pv = f.root.clone().addScaledVector(d, -PIVOT), v = f.tip.clone().sub(pv), l = Math.hypot(v.dot(d), v.dot(a)), want = mid + (tips[k] - mid) * SPREAD - pv.dot(a);
          f.turn = Math.asin(Math.max(-1, Math.min(1, want / l))) - Math.atan2(v.dot(a), v.dot(d));   // + turns d toward +a
        });
        // Each finger turns with the bone of the palm behind it, from PIVOT behind the knuckles, so that the knuckles come
        // in a little too and the turn is spread over the palm rather than folded at the knuckle. A point of a finger goes
        // with its finger; a point of the palm, with the fingers nearest it across, each by how near (a soft blend, so the
        // palm between two fingers is drawn, not torn, between their turns).
        for (const f of fingers) { f.pivot = f.root.clone().addScaledVector(d, -PIVOT); f.set = new Set(f.c); }
        for (let i = 0; i < n; i++) {
          const k = sm(tf - PIVOT, tf + 0.006, T[i]); if (k <= 0) continue;
          const own = fingers.findIndex((f) => f.set.has(i)), w = fingers.map((f, j) => (own >= 0 ? (j === own ? 1 : 0) : Math.exp(-(((A[i] - f.across) / 0.008) ** 2))));
          const s = w.reduce((x, y) => x + y, 0); if (s < 1e-3) continue;
          bend.w[i] = k * Math.min(1, s); bend.mix.push([i, w.map((x) => x / s)]);
        }
        // the thumb: on the far side of the first finger from the rest, between the wrist and the knuckles
        const pinky = fingers[0].tip.dot(d) < fingers[3].tip.dot(d) ? 0 : 3, index = 3 - pinky, sgn = Math.sign(fingers[index].across - fingers[pinky].across), edge = fingers[index].across + sgn * THUMB_EDGE, root = new THREE.Vector3(); let m = 0;
        for (const [i, w] of bend.mix) bend.of.set(i, w);
        for (let i = 0; i < n; i++) { if (bend.w[i] > 0 || T[i] < THUMB_FROM || T[i] > tf) continue; const s = sgn * (A[i] - edge); thumb.w[i] = sm(-0.008, 0.01, s) * sm(THUMB_FROM, THUMB_FROM + 0.01, T[i]); if (Math.abs(s) < 0.003 && T[i] > -0.006) { root.add(scaled[i]); m++; } }
        root.divideScalar(Math.max(1, m)); thumb.root = d.clone().multiplyScalar(THUMB_FROM).addScaledVector(a, edge).addScaledVector(z, root.dot(z)); thumb.sgn = sgn;   // its root: at the wrist, on the palm's edge
      }
    }
    const I0 = new THREE.Quaternion(), qk = new THREE.Quaternion();
    for (const piece of Object.values(pieces).filter((o) => o.hand === side || o.arm === side)) {
      for (let i = 0; i < piece.P.length / 3; i++) {
        const r = new THREE.Vector3().fromArray(piece.P, i * 3).sub(W), tt = r.dot(d), kr = sm(-0.1, 0, tt), ks = sm(-0.005, 0.02, tt);
        if (kr <= 0) continue;
        qk.slerpQuaternions(I0, q, kr); r.applyQuaternion(qk);
        const S = d.clone().multiplyScalar(r.dot(d) * sd).add(a.clone().multiplyScalar(r.dot(a) * sa)).add(z.clone().multiplyScalar(r.dot(z) * sz));
        r.lerp(S, ks);
        let close = null;
        if (piece === p) {
          // the fingers together and the thumb in, in the palm's plane: about z, the palm's normal (a turn of +θ takes d toward
          // -a, so a finger's turn toward +a is -θ; it takes -a toward -d and +a toward +d, so the thumb's is its side's sign)
          const mix = bend.of.get(i), th = thumb.w[i];
          if (mix) {
            // the blend of the fingers' turns about their pivots, each a turn of -turn·k about z
            const o = new THREE.Vector3(), one = new THREE.Vector3(); let ang = 0;
            fingers.forEach((f, j) => { if (!mix[j]) return; const qf = new THREE.Quaternion().setFromAxisAngle(z, -f.turn * bend.w[i]); o.addScaledVector(one.copy(r).sub(f.pivot).applyQuaternion(qf).add(f.pivot), mix[j]); ang += -f.turn * bend.w[i] * mix[j]; });
            r.copy(o); close = new THREE.Quaternion().setFromAxisAngle(z, ang);
          } else if (th > 0 && THUMB) { close = new THREE.Quaternion().setFromAxisAngle(z, thumb.sgn * THUMB * Math.PI / 180 * th); r.sub(thumb.root).applyQuaternion(close).add(thumb.root); }
        }
        // past the knuckles the fingers bend toward the palm, CURL at the tips, as the code hand's fingers do (no finger
        // bones: the hand is baked in this one natural shape, and the one hand bone carries it)
        const tk = 0.5 * C.len, tt2 = r.dot(d); let curl = null;
        if (piece.hand && tt2 > tk) { const ph = (CURL * Math.PI / 180) * Math.min(1, (tt2 - tk) / (C.len - tk)) * ks; curl = new THREE.Quaternion().setFromAxisAngle(a, ph); r.sub(d.clone().multiplyScalar(tk)).applyQuaternion(curl).add(d.clone().multiplyScalar(tk)); }
        r.add(W).addScaledVector(shift, ks); piece.P.set([r.x, r.y, r.z], i * 3);
        const nn = new THREE.Vector3().fromArray(piece.N, i * 3).applyQuaternion(qk); if (close) nn.applyQuaternion(close); if (curl) nn.applyQuaternion(curl); nn.normalize(); piece.N.set([nn.x, nn.y, nn.z], i * 3);
      }
    }
    handReport[side] = { fingers: fingers.map((f) => +((f.turn || 0) * 180 / Math.PI).toFixed(1)), thumbDeg: THUMB, turnDeg: +(2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI).toFixed(0), scale: [sd, sa, sz].map((x) => +x.toFixed(2)), shiftCm: +(shift.length() * 100).toFixed(1) };
  }
  console.log(`hands (HAND ${HAND}): ${JSON.stringify(handReport)}`);
}

// ---- 2. the completed trousers: drop the closed cuffs, colour what came without texture ----
{
  const p = pieces.tripo_part_7, orig = readPiece(docs.seg, "tripo_part_7"); turn(orig.P); stand(orig.P);
  const d = distanceTo(orig, p), made = (t) => d[t] > 0.003;
  let lowest = Infinity; for (let i = 1; i < orig.P.length; i += 3) lowest = Math.min(lowest, orig.P[i]);
  const cy = (t) => (p.P[p.I[t * 3] * 3 + 1] + p.P[p.I[t * 3 + 1] * 3 + 1] + p.P[p.I[t * 3 + 2] * 3 + 1]) / 3;
  // Each triangle is either made (drawn plain) or not: a made triangle gets corners of its own, so that no triangle has
  // some corners on the plain colour and some on the texture (their texture coordinates would sweep across the whole
  // atlas between them, and drew red and cream zigzags on his thighs).
  const P = [...p.P], N = [...p.N], UV = [...p.UV], I = Array.from(p.I), copy = new Map(), flag = new Array(p.P.length / 3).fill(0);
  for (let t = 0; t < d.length; t++) if (made(t)) for (let k = 0; k < 3; k++) {
    const v = p.I[t * 3 + k]; if (!copy.has(v)) { copy.set(v, P.length / 3); P.push(p.P[v * 3], p.P[v * 3 + 1], p.P[v * 3 + 2]); N.push(p.N[v * 3], p.N[v * 3 + 1], p.N[v * 3 + 2]); UV.push(p.UV[v * 2], p.UV[v * 2 + 1]); flag.push(1); }
    I[t * 3 + k] = copy.get(v);
  }
  Object.assign(p, { P: Float32Array.from(P), N: Float32Array.from(N), UV: Float32Array.from(UV), I: Uint32Array.from(I), flag: Uint8Array.from(flag) });
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
  // islands smaller than a forearm are flecks in the cloth: only the largest island of skin-coloured triangles (joined by
  // shared points) is the forearm (FLECKS=0 keeps every island, as before #286; the flecks, light patches of the robe's
  // own texture, went to the skin and came out as pale shards on the sleeve once the forearm's texture was repainted)
  if (+(process.env.FLECKS ?? 1)) {
    const key = (v) => `${p.P[v * 3]},${p.P[v * 3 + 1]},${p.P[v * 3 + 2]}`, byPoint = new Map(), comp = new Int32Array(nt).fill(-1);
    for (let t = 0; t < nt; t++) if (skinT[t]) for (let k = 0; k < 3; k++) { const q = key(p.I[t * 3 + k]); if (!byPoint.has(q)) byPoint.set(q, []); byPoint.get(q).push(t); }
    let best = -1, bestN = 0, c = 0, flecks = 0;
    for (let t0 = 0; t0 < nt; t0++) { if (!skinT[t0] || comp[t0] >= 0) continue; const st = [t0]; comp[t0] = c; let m = 0;
      while (st.length) { const t = st.pop(); m++; for (let k = 0; k < 3; k++) for (const u of byPoint.get(key(p.I[t * 3 + k]))) if (comp[u] < 0) { comp[u] = c; st.push(u); } }
      if (m > bestN) { bestN = m; best = c; } c++; }
    for (let t = 0; t < nt; t++) if (skinT[t] && comp[t] !== best) { skinT[t] = 0; flecks++; }
    console.log(`${p.what}: ${c - 1} flecks of ${flecks} triangles left in the cloth`);
  }
  const n = skinT.reduce((a, b) => a + b, 0);
  const skin = filter(p, (t) => skinT[t]), cloth = filter(p, (t) => !skinT[t]);
  pieces[p.name + "_skin"] = { ...p, name: p.name + "_skin", what: "right forearm", part: "skin", arm: "right", ...skin, shareTile: p.name };
  Object.assign(p, cloth);
  console.log(`${p.what}: ${n} triangles of bare forearm moved to the skin`);
}

// ---- 3a. the arms drawn in (ARMS_IN, #286; 0, the default, leaves them) ----
// One of the two ways the 3D review offered to keep his reach within BODY (0.38 m) without widening BODY: the arms of the
// A-pose turned in about the shoulder's ball until the hands stand ARMS_IN nearer his middle. At 50-55 cm above his soles
// the hands and cuffs are the widest of him (0.391 m on the fourth round, over BODY by 1.1 cm). The sleeve keeps its seam:
// the turn comes in over the first ARMS_RAMP of its surface from where it is sewn to the robe's body, and is whole past
// it; forearms and hands turn whole, except where they are sewn into a sleeve, where they go as the sleeve does there.
const ARMS_IN = +(process.env.ARMS_IN ?? 0), ARMS_RAMP = +(process.env.ARMS_RAMP ?? 0.06);
if (ARMS_IN > 0) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const key = (P, i) => `${P[i * 3]},${P[i * 3 + 1]},${P[i * 3 + 2]}`, torsoKeys = new Set(); { const t = pieces.tripo_part_6; for (let i = 0; i < t.P.length / 3; i++) torsoKeys.add(key(t.P, i)); }
  for (const [side, sleeve, skins] of [["left", "tripo_part_13", ["tripo_part_14", "tripo_part_15"]], ["right", "tripo_part_1", ["tripo_part_1_skin", "tripo_part_0"]]]) {
    const sl = pieces[sleeve], n = sl.P.length / 3, J = monk.bones[side + "UpperArm"].getWorldPosition(new THREE.Vector3());
    // the sleeve's distance along its surface from its seam (Dijkstra over its edges, copies of a point joined)
    const dist = new Float64Array(n).fill(Infinity), nbr = Array.from({ length: n }, () => []), same = new Map();
    for (let i = 0; i < n; i++) { const k = key(sl.P, i); if (!same.has(k)) same.set(k, []); same.get(k).push(i); if (torsoKeys.has(k)) dist[i] = 0; }
    for (const l of same.values()) for (let a = 1; a < l.length; a++) { nbr[l[0]].push([l[a], 0]); nbr[l[a]].push([l[0], 0]); }
    for (let t = 0; t < sl.I.length; t += 3) for (let k = 0; k < 3; k++) { const x = sl.I[t + k], y = sl.I[t + (k + 1) % 3], d = Math.hypot(sl.P[x * 3] - sl.P[y * 3], sl.P[x * 3 + 1] - sl.P[y * 3 + 1], sl.P[x * 3 + 2] - sl.P[y * 3 + 2]); nbr[x].push([y, d]); nbr[y].push([x, d]); }
    const heap = [...dist.keys()].filter((i) => dist[i] === 0), done = new Uint8Array(n);
    while (heap.length) { let bi = 0; for (let k = 1; k < heap.length; k++) if (dist[heap[k]] < dist[heap[bi]]) bi = k; const x = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop(); if (done[x]) continue; done[x] = 1; for (const [y, d] of nbr[x]) if (dist[x] + d < dist[y]) { dist[y] = dist[x] + d; heap.push(y); } }
    const wOf = new Map(); for (let i = 0; i < n; i++) wOf.set(key(sl.P, i), sm(0, ARMS_RAMP, dist[i]));
    // the turn: about z through the shoulder's ball, by as much as brings the hands' middle ARMS_IN nearer his middle
    const hand = pieces[skins[1]], hc = new THREE.Vector3(); for (let i = 0; i < hand.P.length / 3; i++) hc.add(new THREE.Vector3().fromArray(hand.P, i * 3)); hc.divideScalar(hand.P.length / 3);
    const angle = (side === "left" ? -1 : 1) * ARMS_IN / Math.max(0.05, J.y - hc.y), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3();
    for (const [name, wFor] of [[sleeve, (P, i) => wOf.get(key(P, i))], ...skins.map((s) => [s, (P, i) => wOf.get(key(P, i)) ?? 1])]) {
      const pc = pieces[name];
      for (let i = 0; i < pc.P.length / 3; i++) { const w = wFor(pc.P, i); if (!w) continue; q.setFromAxisAngle(Z, angle * w); v.fromArray(pc.P, i * 3).sub(J).applyQuaternion(q).add(J); pc.P.set([v.x, v.y, v.z], i * 3); v.fromArray(pc.N, i * 3).applyQuaternion(q); pc.N.set([v.x, v.y, v.z], i * 3); }
    }
    console.log(`arms drawn in: ${side} turned ${(angle * 180 / Math.PI).toFixed(2)}° about the shoulder (hands ${(ARMS_IN * 100).toFixed(1)} cm in)`);
  }
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
    const k = `${p.P[i * 3]},${p.P[i * 3 + 1]},${p.P[i * 3 + 2]},${p.UV[i * 2]},${p.UV[i * 2 + 1]},${p.flag ? p.flag[i] : 0}`;
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

// ---- 5a. the colours at the cuffs (#286, second round of the review) ----
// Tripo painted each forearm as it lay inside its sleeve: skin at the wrist, going over through brown to the robe's red
// up the arm, and the sleeves with patches of that skin where the forearm met them. Hanging, the sleeve hid both; with
// the arms raised (the incense, the tea) the forearm slides out of the cuff and the painted brown came out on it, and the
// skin on the sleeves showed at the cuffs ("skin-coloured smudges on both cuffs", the 3D review). Here, in each sleeve's
// texture, whatever lies under the sleeve's own triangles and is skin-coloured or pale is painted the sleeve's own red;
// in each forearm's, everything under the forearm's triangles is painted the forearm's own skin. Each
// texel keeps a little of its own lightness, so the cloth's weave and the skin's shading stay. CUFFS=0 leaves them.
const CUFFS = +(process.env.CUFFS ?? 1);
if (CUFFS) {
  const isSkin = ([h, s, v]) => h > 16 && h < 42 && s > 0.12 && s < 0.52 && v > 0.6, isPale = ([, s, v]) => s < 0.16 && v > 0.55;
  /** Which texels of a w×h image the triangles `tris` (indices into UV) cover, grown by `grow` px. */
  const cover = (w, h, UV, tris, grow = 2) => {
    const m = new Uint8Array(w * h);
    for (let t = 0; t < tris.length; t += 3) {
      const P = [0, 1, 2].map((k) => [UV[tris[t + k] * 2] * (w - 1), UV[tris[t + k] * 2 + 1] * (h - 1)]);
      const x0 = Math.max(0, Math.floor(Math.min(...P.map((q) => q[0])) - grow)), x1 = Math.min(w - 1, Math.ceil(Math.max(...P.map((q) => q[0])) + grow));
      const y0 = Math.max(0, Math.floor(Math.min(...P.map((q) => q[1])) - grow)), y1 = Math.min(h - 1, Math.ceil(Math.max(...P.map((q) => q[1])) + grow));
      const [[ax, ay], [bx, by], [cx, cy]] = P, d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (Math.abs(d) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const u = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / d, v = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / d, ww = 1 - u - v, e = grow / Math.sqrt(Math.abs(d));
        if (u > -e && v > -e && ww > -e) m[y * w + x] = 1;
      }
    }
    return m;
  };
  const median = (arr) => { const a = [...arr].sort((x, y) => x - y); return a[a.length >> 1] ?? 0; };
  // paint `mask`'s texels for which `wrong(hsv)` with the median colour of its texels for which `right(hsv)`
  const repaint = (tex, mask, wrong, right) => {
    const ok = [[], [], []], L = []; let n = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) { const c = [tex.data[i * 3], tex.data[i * 3 + 1], tex.data[i * 3 + 2]]; if (right(hsv(...c.map((k) => k / 255)))) { for (let k = 0; k < 3; k++) ok[k].push(c[k]); L.push(c[0] + c[1] + c[2]); } }
    const ref = ok.map(median), refL = median(L) || 1;
    for (let i = 0; i < mask.length; i++) if (mask[i]) { const c = [tex.data[i * 3], tex.data[i * 3 + 1], tex.data[i * 3 + 2]]; if (!wrong(hsv(...c.map((k) => k / 255)))) continue;
      const k = Math.min(1.05, Math.max(0.85, 0.85 + 0.2 * ((c[0] + c[1] + c[2]) / refL - 0.5))); for (let j = 0; j < 3; j++) tex.data[i * 3 + j] = Math.min(255, Math.round(ref[j] * k)); n++; }
    return { n, ref };
  };
  for (const [sleeve, arm] of [["tripo_part_13", "tripo_part_14"], ["tripo_part_1", "tripo_part_1_skin"]]) {
    const sl = pieces[sleeve], fa = pieces[arm];
    const tex = await rawOf(sl.base), clothM = cover(tex.w, tex.h, sl.UV, sl.I);
    // the right forearm was cut out of its sleeve and drew on the sleeve's texture: it is given a tile of its own (a copy
    // of that texture, 256 px as the left forearm's), so that each can be painted without the other's texels
    if (fa.shareTile === sleeve) { const core = cover(tex.w, tex.h, fa.UV, fa.I, 0); for (let i = 0; i < clothM.length; i++) if (core[i]) clothM[i] = 0; fa.base = sl.base; delete fa.shareTile; fa.tile = 256; }
    const a = repaint(tex, clothM, (c) => isSkin(c) || isPale(c), (c) => !isSkin(c) && !isPale(c) && c[2] > 0.25);
    sl.base = new Uint8Array(await sharp(Buffer.from(tex.data), { raw: { width: tex.w, height: tex.h, channels: 3 } }).png().toBuffer());
    const t2 = await rawOf(fa.base), b = repaint(t2, cover(t2.w, t2.h, fa.UV, fa.I, 3), () => true, isSkin);   // the whole forearm, one skin
    fa.base = new Uint8Array(await sharp(Buffer.from(t2.data), { raw: { width: t2.w, height: t2.h, channels: 3 } }).png().toBuffer());
    console.log(`cuffs: ${sl.what}: ${a.n} texels of skin or pale painted rgb(${a.ref}); ${fa.what}: ${b.n} texels painted skin rgb(${b.ref})`);
  }
  // the hands' pieces run some way up the forearm, painted brown there too: what is not skin under them is painted skin
  for (const h of ["tripo_part_0", "tripo_part_15"]) {
    const pc = pieces[h], t = await rawOf(pc.base), r = repaint(t, cover(t.w, t.h, pc.UV, pc.I, 3), (c) => !isSkin(c), isSkin);
    pc.base = new Uint8Array(await sharp(Buffer.from(t.data), { raw: { width: t.w, height: t.h, channels: 3 } }).png().toBuffer());
    console.log(`cuffs: ${pc.what}: ${r.n} texels painted skin rgb(${r.ref})`);
  }
}

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
// NOVICE_PIECES=<file>: write every piece as it stands now (bind pose, thinned), for an outside weigher such as
// tools/novice-heat.py (Blender's bone heat); NOVICE_HEAT=<file>: read the weights it gives back, for the pieces it names.
if (process.env.NOVICE_PIECES) { fs.writeFileSync(process.env.NOVICE_PIECES, JSON.stringify(Object.values(pieces).map((p) => ({ name: p.name, what: p.what, part: p.part, P: Array.from(p.P, (x) => +x.toFixed(6)), I: Array.from(p.I) })))); console.log("wrote the pieces to", process.env.NOVICE_PIECES); }
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
// Weights from Blender's bone heat for the pieces it was asked to weigh (tools/novice-heat.py): they replace the ones above.
const HEAT_LAP = +(process.env.HEAT_LAP ?? 1);
// NOVICE_BPY=<python with bpy>: run tools/novice-heat.py here, on the pieces as they now stand, so one command does it all.
let heatFile = process.env.NOVICE_HEAT;
if (!heatFile && process.env.NOVICE_BPY) {
  const { execFileSync } = await import("node:child_process"), os = await import("node:os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "novice-heat-")), here = path.dirname(new URL(import.meta.url).pathname);
  // a helper's own length for the heat: from the shoulder's ball down into the armpit, halfway between the way the arm
  // hangs and straight down
  const tailOf = (b) => { const h = monk.helpers?.find((x) => x.bone === b); if (!h) return undefined; const p = b.getWorldPosition(new THREE.Vector3()), arm = monk.bones[h.follow.name.replace("Upper", "Lower")].getWorldPosition(new THREE.Vector3()).sub(p).normalize(); return p.addScaledVector(arm.add(new THREE.Vector3(0, -1, 0)).normalize(), ARMPIT_LEN).toArray(); };
  fs.writeFileSync(path.join(tmp, "bones.json"), JSON.stringify(monk.skeleton.bones.map((b) => ({ name: b.name, parent: b.parent.isBone ? b.parent.name : null, p: b.getWorldPosition(new THREE.Vector3()).toArray(), tail: tailOf(b) }))));
  fs.writeFileSync(path.join(tmp, "pieces.json"), JSON.stringify(Object.values(pieces).map((p) => ({ name: p.name, part: p.part, P: Array.from(p.P, (x) => +x.toFixed(6)), I: Array.from(p.I) }))));
  const log = execFileSync(process.env.NOVICE_BPY, ["-I", path.join(here, "novice-heat.py"), path.join(tmp, "bones.json"), path.join(tmp, "pieces.json"), path.join(tmp, "heat.json")], { encoding: "utf8" });
  for (const line of log.split("\n")) if (/points|wrote/.test(line)) console.log("  bpy:", line.trim());
  heatFile = path.join(tmp, "heat.json");
}
const heat = heatFile ? JSON.parse(fs.readFileSync(heatFile, "utf8")) : null;
if (heatFile && !process.env.NOVICE_HEAT) fs.rmSync(path.dirname(heatFile), { recursive: true, force: true });
if (heat) {
  let n = 0;
  for (const p of list) { const h = heat[p.name]; if (!h) continue; if (h.length !== p.P.length / 3) throw new Error(`heat weights for ${p.name}: ${h.length} vertices, the piece has ${p.P.length / 3}`);
    h.forEach((ws, v) => { const i = p.offset + v, top = ws.filter(([b]) => boneNames.includes(b)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 4), s = top.reduce((a, [, w]) => a + w, 0);
      if (!s) return;
      // the skirt keeps the round-two lap: its front below the hips still goes with the thighs at the sides and partly
      // with the hips at the middle (HEAT_LAP=0 leaves the heat weights as they are)
      const fin = p.robeBody && HEAT_LAP ? thighFront(top.map(([b, w]) => [b, w / s]), P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]).sort((a, b) => b[1] - a[1]).slice(0, 4) : top, fs = fin.reduce((a, [, w]) => a + w, 0);
      for (let k = 0; k < 4; k++) { J[i * 4 + k] = fin[k] ? boneNames.indexOf(fin[k][0]) : 0; W[i * 4 + k] = fin[k] ? fin[k][1] / fs : 0; } n++; }); }
  console.log(`bone heat weights for ${Object.keys(heat).join(", ")}: ${n} vertices`);
}
console.log(`weights from the figure built in code; ${nArm} vertices weighted along the arm`);
// The sash's end hangs from the knot on its own bone: within 8 cm of its top it goes over from the weights it took (the
// skirt's and the hips') to the sashTail bone, below that wholly on it. It is kept out of the welding, so that its edge
// is free of the skirt it lay on.
const sashBone = boneNames.indexOf("sashTail"), sashV = new Uint8Array(nv);
for (const p of list) if (p.isSash) sashV.fill(1, p.offset, p.offset + p.P.length / 3);
let weldGroup = null;
const WRAPS = new Set(["tripo_part_4", "tripo_part_10"]), WRAP_RANK = +(process.env.WRAP_RANK ?? 3);
const RANK = { skin: 1, robe: 2, legs: 0, shoes: 3 }, WELD = +(process.env.NOVICE_WELD || 8);
{
  // The leg wraps rank with the shoes (WRAP_RANK): where a wrap's lower edge meets the shoe's collar, the point takes half of each,
// the shin's and the foot's (wholly the shoe's, the back foot of a stride pulled the wrap's edge out in white strips; wholly the
// wrap's, it pulled the shoe's heel up in grey ones; #256).
const rank = Int8Array.from(all.part, (p, i) => (WRAPS.has(all.piece[i]) ? WRAP_RANK : RANK[PARTS[p]])), Pw = Float32Array.from(P0);
  for (let i = 0; i < nv; i++) if (sashV[i]) Pw[i * 3 + 1] += 100;
  const r = weldWeights(Pw, J, W, { smooth: Math.max(0, WELD - 1), index: I0, rank });
  J.set(r.J); W.set(r.W); weldGroup = r.group;
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
  const rank = Int8Array.from(all.part, (p, i) => (WRAPS.has(all.piece[i]) ? WRAP_RANK : RANK[PARTS[p]]));
// Copies that fall in one cell of 0.01 mm but lie a hair further apart than the welding's reach take one weight too:
  // the highest-ranked copy's, as the welding gives (tests/unit/novice-tripo.test.mjs asks it of every such cell). The top
  // edge of the sash's end, where it has not yet gone over to its bone, is sewn to the knot the same way.
  const cell = new Map(); let fixed = 0;
  for (let i = 0; i < nv; i++) { if (sashV[i]) continue; const k = `${Math.round(P0[i * 3] * 1e5)},${Math.round(P0[i * 3 + 1] * 1e5)},${Math.round(P0[i * 3 + 2] * 1e5)}`; const h = cell.get(k); if (h === undefined || rank[i] > rank[h]) cell.set(k, i); }
  for (let i = 0; i < nv; i++) { if (sashV[i] && (W[i * 4] === 1 && J[i * 4] === sashBone || [0, 1, 2, 3].some((k) => J[i * 4 + k] === sashBone && W[i * 4 + k] > 0))) continue; const h = cell.get(`${Math.round(P0[i * 3] * 1e5)},${Math.round(P0[i * 3 + 1] * 1e5)},${Math.round(P0[i * 3 + 2] * 1e5)}`); if (h !== i) { for (let k = 0; k < 4; k++) { if (J[i * 4 + k] !== J[h * 4 + k] || W[i * 4 + k] !== W[h * 4 + k]) fixed++; J[i * 4 + k] = J[h * 4 + k]; W[i * 4 + k] = W[h * 4 + k]; } } }
  if (fixed) console.log(`  ${fixed} weights of copies just beyond the welding's reach made one`);
  }

// ---- 7b. under the arms (#286) ----
// This robe's sleeves are sewn on down a deep armhole: the seam runs from the top of the shoulder to some 15 cm below the
// shoulder's ball, 4 cm above the belt. Bone heat, the welding's smoothing after it, gave the robe's flanks and belt a
// share of the arm (and of its helper) down to the waist, and with the arm raised to the brow those shares, changing a
// little from one point to the next a long way from the shoulder, drew the flanks and the front of the robe out in streaks
// (#246, fourth round). Here, after the welding:
//   - the robe's body keeps the arms' weights (upper and lower arm, hand, helper) only round the shoulder's ball, whole
//     within ARM_REACH[0] of it and none beyond ARM_REACH[1] (the figure built in code gives its robe the arm's weight
//     only over the shoulder: monk.js, robeW), and what it keeps of the upper arm goes to the helper, so that the cloth
//     over the shoulder turns half as far as the arm;
//   - the belt, the skirt and the sash keep none;
//   - what is taken goes to the trunk's bones in the shares the point had of them (or to the chest).
// The sleeves keep their heat weights. The stretch that a raised arm must make somewhere (from the foot of the seam to
// the elbow is 9 cm hanging and 33 cm at the brow) is then all in the sleeve's underside, behind the arm, not on the robe.
// Copies of one point are given the least of their shares, so they keep one weight.
const ARM_REACH = (process.env.ARM_REACH ?? "0.045,0.09").split(",").map(Number);
if (ARM_REACH[1] > 0 && monk.helpers) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const army = new Set(boneNames.filter((b) => /UpperArm|LowerArm|Hand|Armpit/.test(b)).map((b) => boneNames.indexOf(b))), chestB = boneNames.indexOf("chest");
  const robeBody = new Set(list.filter((p) => p.robeBody).map((p) => p.name)), torso = (i) => all.piece[i] === "tripo_part_6";
  const joint = { left: monk.bones.leftUpperArm.getWorldPosition(new THREE.Vector3()), right: monk.bones.rightUpperArm.getWorldPosition(new THREE.Vector3()) };
  const f = new Float32Array(nv).fill(1), toHelper = new Uint8Array(nv);
  for (let i = 0; i < nv; i++) {
    if (!robeBody.has(all.piece[i])) continue;
    if (!torso(i)) { f[i] = 0; continue; }
    const j = joint[P0[i * 3] > 0 ? "left" : "right"]; f[i] = sm(ARM_REACH[1], ARM_REACH[0], Math.hypot(P0[i * 3] - j.x, P0[i * 3 + 1] - j.y, P0[i * 3 + 2] - j.z)); toHelper[i] = 1;
  }
  const members = new Map(); for (let i = 0; i < nv; i++) { const g = weldGroup[i]; if (!members.has(g)) members.set(g, []); members.get(g).push(i); }
  for (const l of members.values()) if (l.length > 1) { const lo = Math.min(...l.map((i) => f[i])), h = Math.max(...l.map((i) => toHelper[i])); for (const i of l) { f[i] = lo; toHelper[i] = h; } }
  let changed = 0;
  for (let i = 0; i < nv; i++) {
    if (f[i] >= 1 && !toHelper[i]) continue;
    const side = P0[i * 3] > 0 ? "left" : "right", upper = boneNames.indexOf(side + "UpperArm"), helper = boneNames.indexOf(side + "Armpit");
    let arm = 0, rest = 0; for (let k = 0; k < 4; k++) (army.has(J[i * 4 + k]) ? (arm += W[i * 4 + k]) : (rest += W[i * 4 + k])); if (arm <= 0) continue;
    const m = new Map();
    for (let k = 0; k < 4; k++) { const b = J[i * 4 + k], w = W[i * 4 + k]; if (w <= 0) continue; const to = toHelper[i] && b === upper ? helper : b; m.set(to, (m.get(to) || 0) + w * (army.has(b) ? f[i] : rest > 1e-6 ? 1 + arm * (1 - f[i]) / rest : 1)); }
    if (rest <= 1e-6) m.set(chestB, (m.get(chestB) || 0) + arm * (1 - f[i]));
    const top = [...m].filter(([, w]) => w > 1e-6).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4), s = top.reduce((a, [, w]) => a + w, 0);
    for (let k = 0; k < 4; k++) { J[i * 4 + k] = top[k] ? top[k][0] : 0; W[i * 4 + k] = top[k] ? top[k][1] / s : 0; }
    changed++;
  }
  console.log(`under the arms: the robe's body keeps the arms' weights within ${ARM_REACH.join("-")} m of the shoulder (the upper arm's on the helper), the belt and skirt none; ${changed} vertices changed`);
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
const counts = {}, ranges = {}; let robeSum = [0, 0, 0], robeN = 0;
for (const [pi, name] of PARTS.entries()) {
  const mine = list.filter((p) => p.part === name), pos = [], nor = [], uv = [], jj = [], ww = [], idx = [];
  for (const p of mine) {
    const o = pos.length / 3; (ranges[name] ||= []).push([p.name, o, p.P.length / 3]);
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
out.getRoot().setExtras({ generator: "tools/novice-tripo.mjs", source: { seg: shas.seg, comp: shas.comp }, height: HEIGHT, robeColor, bones: boneNames, helpers: (monk.helpers || []).map(({ name, parent, follow, k }) => ({ name, parent: parent.name, follow: follow.name, k })), parts: PARTS, counts, ranges,
  pieces: Object.fromEntries(list.map((p) => [p.name, p.what])) });
fs.mkdirSync(path.dirname(dst), { recursive: true });
await io.write(dst, out);
const bytes = fs.readFileSync(dst);
console.log("wrote", dst, (bytes.length / 1e6).toFixed(2), "MB", "sha256", crypto.createHash("sha256").update(bytes).digest("hex"), JSON.stringify(counts));
