// Mends a baked figure of the great hall before it is packed (#763, after the art director's review of 2026-11-26: pale and dark
// patches on Sakyamuni's bare right forearm, black fragments at his wrist). Two things are mended, the pictures and the surface.
//
//   node tools/t05-statue/mend.mjs <figure id> <baked.glb> <out.glb> [--spec=tools/t05-statue/<id>/mend.json] [--report=<file.json>]
//
// The pictures (`specks` in the spec; every figure may have it). The bake (bake.py) casts from the low surface to the full-detail
// one, and where the full-detail one is folded on itself or was cut and joined (Sakyamuni's right hand is a graft, #514) a ray
// finds the wrong sheet: the texel is written with a normal that points into the surface, and in the hall that spot is lit from
// the wrong side. Every texel under a triangle whose normal leans more than acos(`below`) from the surface (0.3: 72°; no relief on
// these figures is that steep, and a normal past 90° is no relief at all) is taken out with `grow` texels round it and filled in
// from the sound texels beside it. The margin round each changed patch is written again from the nearest texel under a triangle,
// as the bake left it. Making the forearm's texels neutral instead was tried and is wrong: the low surface then shows its facets,
// because the picture also carries the smooth surface's normals.
//
// The surface (`shape` in the spec, for one part of the figure; numbers in the figure's own frame, as the anchors are written:
// metres at its stage height, centred, foot at 0). Where a limb was grafted the low surface kept what the cut left: scraps that
// touch nothing, a sheet whose edge is a row of long thin triangles, a rim that stands up in shreds, a shell with no underside.
// Seen from the floor of the hall these are spikes across the wrist, robe-coloured shreds on bare skin and black where the eye
// goes in. The spec names them one by one, by the component they belong to (its number of triangles in the file the spec was
// written for, which the tool checks) and a box:
//   scraps   whole components taken away;
//   trims    of a component, the triangles whose middle is in a box (with `thin`: only those whose height is under `thin` of their
//            longest edge, that edge over `longer`);
//   press    of a component, the points in a box brought down to the box's floor, a ragged rim laid flat; a triangle left
//            hanging between a pressed point and one more than `over` above that floor goes. What is laid flat is not given
//            an underside: from the west aisle the flat rim's other side stood as dark strokes before the forearm;
//   tube     a round skin with a domed end set `inset` inside the circles fitted to a limb's cross-sections (x, y, z of the middle,
//            radius): the underside a shell lacks.
// Every point made here takes one place in the picture, `neutral`, where the picture must be neutral: it is lit by its own normal.
// Nothing here may move the figure's bounding box: the page stands the figure by it and the anchors are measured from it.
import fs from "node:fs"; import crypto from "node:crypto";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { FIGURE_FILES, PLINTH } from "../../app/levels/t05/figures/registry.js";

const MARGIN = 8;   // bake.py's margin, in texels of the picture as baked

/**
 * The file's primitives with their points in the figure's frame (load.js's: scaled to the stage height above the plinth, centred,
 * foot at 0), and `frame`, which takes a point of that frame back to the file's: `[x / s + cx, y / s + lo, z / s + cz]`.
 */
export async function readBaked(file, id) {
  const d = FIGURE_FILES.find((f) => f.id === id); if (!d) throw new Error(`no figure ${id}`);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(file), prims = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute("POSITION"), n = P.getCount(), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), e = [0, 0, 0];
      for (let i = 0; i < n; i++) { P.getElement(i, e); const [x, y, z] = e; pos[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; pos[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; pos[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]; prim.getAttribute("TEXCOORD_0").getElement(i, e); uv[i * 2] = e[0]; uv[i * 2 + 1] = e[1]; }
      prims.push({ name: node.getName(), prim, pos, uv, index: Uint32Array.from(prim.getIndices().getArray()), texture: prim.getMaterial().getNormalTexture(), plain: m.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-9) });
    }
  }
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const p of prims) for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.pos[i + k]); hi[k] = Math.max(hi[k], p.pos[i + k]); }
  const s = (d.stageH - PLINTH.h) / (hi[1] - lo[1]), cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  for (const p of prims) for (let i = 0; i < p.pos.length; i += 3) { p.pos[i] = (p.pos[i] - cx) * s; p.pos[i + 1] = (p.pos[i + 1] - lo[1]) * s; p.pos[i + 2] = (p.pos[i + 2] - cz) * s; }
  return { io, doc, prims, frame: { s, cx, lo: lo[1], cz, box: [...lo, ...hi] } };
}

/** Which triangle each texel's middle lies under (-1: none), the triangles' own edges counted in. */
export function owners(uv, index, W) {
  const own = new Int32Array(W * W).fill(-1);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 2, b = index[t + 1] * 2, c = index[t + 2] * 2, X = [uv[a] * W, uv[b] * W, uv[c] * W], Y = [uv[a + 1] * W, uv[b + 1] * W, uv[c + 1] * W];
    const d = (X[1] - X[0]) * (Y[2] - Y[0]) - (X[2] - X[0]) * (Y[1] - Y[0]); if (Math.abs(d) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...X) - 0.5)), x1 = Math.min(W - 1, Math.ceil(Math.max(...X))), y0 = Math.max(0, Math.floor(Math.min(...Y) - 0.5)), y1 = Math.min(W - 1, Math.ceil(Math.max(...Y)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - X[0], py = y + 0.5 - Y[0], u = (px * (Y[2] - Y[0]) - (X[2] - X[0]) * py) / d, v = ((X[1] - X[0]) * py - px * (Y[1] - Y[0])) / d;
      if (u >= -0.01 && v >= -0.01 && u + v <= 1.01) own[y * W + x] = t / 3;
    }
  }
  return own;
}

/** One picture mended in place (rgb, three bytes a texel); returns what was done. */
export function mendMap(rgb, W, own, { below = 0.3, grow = 3 } = {}) {
  const N = W * W, used = (i) => own[i] >= 0, changed = new Uint8Array(N), nb = [-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, 1, -1, -1, 1, 1, 1];
  // specks: normals that lean past the limit, grown, then filled from the sound texels round them
  let bad = new Uint8Array(N), specks = 0;
  for (let i = 0; i < N; i++) { if (!used(i)) continue; const x = rgb[i * 3] / 127.5 - 1, y = rgb[i * 3 + 1] / 127.5 - 1, z = rgb[i * 3 + 2] / 127.5 - 1; if (z / (Math.hypot(x, y, z) || 1) < below) { bad[i] = 1; specks++; } }
  for (let g = 0; g < grow; g++) { const more = bad.slice(); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (bad[i] || !used(i)) continue; for (let k = 0; k < 8; k += 2) { const xx = x + nb[k], yy = y + nb[k + 1]; if (xx >= 0 && yy >= 0 && xx < W && yy < W && bad[yy * W + xx]) { more[i] = 1; break; } } } bad = more; }
  const val = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) val[i] = rgb[i] / 127.5 - 1;
  const todo = []; for (let i = 0; i < N; i++) if (bad[i]) todo.push(i);
  const filled = todo.length, open = bad.slice(); let ring = todo, lost = 0;
  while (ring.length) {
    const next = [], got = [];
    for (const i of ring) { const x = i % W, y = (i - x) / W; let sx = 0, sy = 0, sz = 0, n = 0; for (let k = 0; k < 16; k += 2) { const xx = x + nb[k], yy = y + nb[k + 1]; if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue; const j = yy * W + xx; if (!used(j) || open[j]) continue; sx += val[j * 3]; sy += val[j * 3 + 1]; sz += val[j * 3 + 2]; n++; }
      if (n) got.push([i, sx / n, sy / n, sz / n]); else next.push(i); }
    if (!got.length) { lost = next.length; for (const i of next) { val[i * 3] = 0; val[i * 3 + 1] = 0; val[i * 3 + 2] = 1; open[i] = 0; } break; }   // an island with no sound texel beside it: neutral
    for (const [i, a, b, c] of got) { val[i * 3] = a; val[i * 3 + 1] = b; val[i * 3 + 2] = c; open[i] = 0; }
    ring = next;
  }
  for (let pass = 0; pass < 24; pass++) for (const i of todo) {   // and let the filling settle between its edges
    const x = i % W, y = (i - x) / W; let sx = 0, sy = 0, sz = 0, n = 0;
    for (let k = 0; k < 8; k += 2) { const xx = x + nb[k], yy = y + nb[k + 1]; if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue; const j = yy * W + xx; if (!used(j)) continue; sx += val[j * 3]; sy += val[j * 3 + 1]; sz += val[j * 3 + 2]; n++; }
    if (n) { val[i * 3] = sx / n; val[i * 3 + 1] = sy / n; val[i * 3 + 2] = sz / n; }
  }
  for (const i of todo) { let x = val[i * 3], y = val[i * 3 + 1], z = Math.max(0.05, val[i * 3 + 2]); const l = Math.hypot(x, y, z); rgb[i * 3] = Math.round((x / l + 1) * 127.5); rgb[i * 3 + 1] = Math.round((y / l + 1) * 127.5); rgb[i * 3 + 2] = Math.round((z / l + 1) * 127.5); changed[i] = 1; }
  // the margin: every texel under no triangle within MARGIN of a changed one takes the nearest texel that is under one
  const near = new Int32Array(N).fill(-1); let front = [];
  for (let i = 0; i < N; i++) if (used(i)) { near[i] = i; front.push(i); }
  let margin = 0;
  for (let step = 0; step < MARGIN && front.length; step++) { const nf = []; for (const i of front) { const x = i % W, y = (i - x) / W; for (let k = 0; k < 16; k += 2) { const xx = x + nb[k], yy = y + nb[k + 1]; if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue; const j = yy * W + xx; if (near[j] >= 0) continue; near[j] = near[i]; nf.push(j); if (changed[near[i]]) { rgb[j * 3] = rgb[near[i] * 3]; rgb[j * 3 + 1] = rgb[near[i] * 3 + 1]; rgb[j * 3 + 2] = rgb[near[i] * 3 + 2]; margin++; } } } front = nf; }
  return { specks, filled, lost, margin };
}


/**
 * The triangles' components, their points welded by place (to a twentieth of a millimetre): `of[t]` is triangle t's component,
 * `size[c]` how many triangles it has, `box[c]` its bounds as `[x0, x1, y0, y1, z0, z1]`.
 */
export function components(pos, index) {
  const key = new Map(), w = new Int32Array(pos.length / 3);
  for (let i = 0; i < w.length; i++) { const k = `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`; let v = key.get(k); if (v === undefined) { v = key.size; key.set(k, v); } w[i] = v; }
  const par = new Int32Array(key.size).map((_, i) => i), find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < index.length; t += 3) { const a = find(w[index[t]]); par[find(w[index[t + 1]])] = a; par[find(w[index[t + 2]])] = a; }
  const id = new Map(), of = new Int32Array(index.length / 3), size = [], box = [];
  for (let t = 0; t < index.length; t += 3) {
    const r = find(w[index[t]]); let c = id.get(r); if (c === undefined) { c = id.size; id.set(r, c); size.push(0); box.push([Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]); }
    of[t / 3] = c; size[c]++;
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { const v = pos[index[t + j] * 3 + k]; box[c][k * 2] = Math.min(box[c][k * 2], v); box[c][k * 2 + 1] = Math.max(box[c][k * 2 + 1], v); }
  }
  return { of, size, box };
}

const perp = (n) => { const t = Math.abs(n[2]) < 0.9 ? [-n[1], n[0], 0] : [1, 0, 0], d = t[0] * n[0] + t[1] * n[1] + t[2] * n[2], q = [t[0] - n[0] * d, t[1] - n[1] * d, t[2] - n[2] * d], l = Math.hypot(...q); return [q[0] / l, q[1] / l, q[2] / l, 1]; };

/**
 * A round skin along z with a domed far end: rings every `step` from the first station to the last (each station `[x, y, z, r]`, the
 * middle and radius of a circle; between stations they are mixed), `inset` inside the circles, then five rings closing over `dome`.
 * Open at its near end, which lies inside the limb. Returns `{ pos, nor, index }`, wound to be seen from outside.
 */
export function tubeMesh(stations, { inset = 0.008, dome = 0.05, segments = 28, step = 0.03 } = {}) {
  const at = (z) => { let i = 0; while (i + 2 < stations.length && z > stations[i + 1][2]) i++; const A = stations[i], B = stations[i + 1], f = (z - A[2]) / (B[2] - A[2]); return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[3] + (B[3] - A[3]) * f]; };
  const z0 = stations[0][2], z1 = stations[stations.length - 1][2], rings = [], pos = [], nor = [], index = [];
  for (let i = 1; z0 + i * step < z1 + 1e-9; i++) { const z = z0 + i * step, [cx, cy, r] = at(z); rings.push({ cx, cy, z, r: r - inset, tilt: 0 }); }
  const [cx, cy, r] = at(z1); for (let i = 1; i <= 5; i++) { const a = ((i / 5) * Math.PI) / 2; rings.push({ cx, cy, z: z1 + dome * Math.sin(a), r: Math.max(0.004, (r - inset) * Math.cos(a)), tilt: a }); }
  rings.forEach((R, ri) => {
    for (let k = 0; k < segments; k++) { const a = (k / segments) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a); pos.push(R.cx + c * R.r, R.cy + s * R.r, R.z); nor.push(c * Math.cos(R.tilt), s * Math.cos(R.tilt), Math.sin(R.tilt)); }
    if (ri) for (let k = 0; k < segments; k++) { const a = (ri - 1) * segments + k, b = (ri - 1) * segments + ((k + 1) % segments), c = ri * segments + k, d = ri * segments + ((k + 1) % segments); index.push(a, b, c, b, d, c); }
  });
  for (let t = 0; t < index.length; t += 3) {   // each triangle wound to show the side its points' normals look out of
    const [a, b, c] = [index[t] * 3, index[t + 1] * 3, index[t + 2] * 3], u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], v = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    if ((u[1] * v[2] - u[2] * v[1]) * nor[a] + (u[2] * v[0] - u[0] * v[2]) * nor[a + 1] + (u[0] * v[1] - u[1] * v[0]) * nor[a + 2] < 0) { const s = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = s; }
  }
  return { pos: Float32Array.from(pos), nor: Float32Array.from(nor), index: Uint32Array.from(index) };
}

/**
 * One part's surface mended by a spec's `shape` (see the head of this file). `part` is `{ pos, nor, tan, uv, index }` in the figure's
 * frame and is not changed; returns the same five mended, `moved` (the points whose place changed), `first` (where the new points
 * begin) and `did`, the count of each thing done.
 */
export function mendShape(part, spec) {
  const pos = Float32Array.from(part.pos), nor = Float32Array.from(part.nor), tan = Float32Array.from(part.tan), { index, uv } = part, C = components(pos, index), nt = index.length / 3, gone = new Uint8Array(nt), did = {};
  const named = (of) => { const want = of === "main" ? Math.max(...C.size) : of, hits = []; C.size.forEach((n, c) => { if (n === want) hits.push(c); }); if (hits.length !== 1) throw new Error(`${hits.length} components of ${want} triangles: the spec was written for another surface`); return hits[0]; };
  const inBox = (b, x, y, z) => x > b[0] && x < b[1] && y > b[2] && y < b[3] && z > b[4] && z < b[5];
  const corner = (t, j) => { const v = index[t * 3 + j] * 3; return [pos[v], pos[v + 1], pos[v + 2]]; };
  if (spec.scraps) {
    did.scraps = 0;
    for (const n of spec.scraps.sizes) {
      const c = named(n), b = C.box[c], B = spec.scraps.box; if (b[0] < B[0] || b[1] > B[1] || b[2] < B[2] || b[3] > B[3] || b[4] < B[4] || b[5] > B[5]) throw new Error(`the scrap of ${n} triangles is not where the spec has it`);
      for (let t = 0; t < nt; t++) if (C.of[t] === c) { gone[t] = 1; did.scraps++; }
    }
  }
  did.trims = 0;
  for (const tr of spec.trims ?? []) {
    const c = named(tr.of);
    for (let t = 0; t < nt; t++) {
      if (gone[t] || C.of[t] !== c) continue;
      const P = [corner(t, 0), corner(t, 1), corner(t, 2)]; if (!inBox(tr.box, (P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3, (P[0][2] + P[1][2] + P[2][2]) / 3)) continue;
      if (tr.thin !== undefined) { const e = [0, 1, 2].map((j) => Math.hypot(P[j][0] - P[(j + 1) % 3][0], P[j][1] - P[(j + 1) % 3][1], P[j][2] - P[(j + 1) % 3][2])), s = (e[0] + e[1] + e[2]) / 2, L = Math.max(...e), h = (2 * Math.sqrt(Math.max(0, s * (s - e[0]) * (s - e[1]) * (s - e[2])))) / L; if (!(L > (tr.longer ?? 0) && h / L < tr.thin)) continue; }
      gone[t] = 1; did.trims++;
    }
  }
  const moved = new Uint8Array(pos.length / 3); did.pressed = 0; did.hanging = 0;
  for (const pr of spec.press ?? []) {
    const c = named(pr.of), here = new Uint8Array(pos.length / 3), floor = pr.box[2];
    for (let t = 0; t < nt; t++) if (C.of[t] === c) for (let j = 0; j < 3; j++) { const v = index[t * 3 + j]; if (!here[v] && inBox(pr.box, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])) { pos[v * 3 + 1] = floor; here[v] = moved[v] = 1; did.pressed++; } }
    for (let t = 0; t < nt; t++) { if (gone[t]) continue; const vs = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]]; if (vs.some((v) => here[v]) && vs.some((v) => !here[v] && pos[v * 3 + 1] > floor + (pr.over ?? 0.02))) { gone[t] = 1; did.hanging++; } }
    const sum = new Float64Array(pos.length);   // the pressed points' normals from the faces they are now part of
    for (let t = 0; t < nt; t++) { if (gone[t]) continue; const vs = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]]; if (!vs.some((v) => here[v])) continue; const A = corner(t, 0), B = corner(t, 1), D = corner(t, 2), u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [D[0] - A[0], D[1] - A[1], D[2] - A[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; for (const v of vs) if (here[v]) { sum[v * 3] += n[0]; sum[v * 3 + 1] += n[1]; sum[v * 3 + 2] += n[2]; } }
    for (let v = 0; v < here.length; v++) { if (!here[v]) continue; const l = Math.hypot(sum[v * 3], sum[v * 3 + 1], sum[v * 3 + 2]); if (l < 1e-12) continue; const n = [sum[v * 3] / l, sum[v * 3 + 1] / l, sum[v * 3 + 2] / l]; nor.set(n, v * 3); tan.set(perp(n), v * 4); }
  }
  const keep = []; for (let t = 0; t < nt; t++) if (!gone[t]) keep.push(index[t * 3], index[t * 3 + 1], index[t * 3 + 2]);
  const first = pos.length / 3; let out = { pos, nor, tan, uv: Float32Array.from(uv) };
  const add = (P, N) => { const n = P.length / 3, base = out.pos.length / 3, grow = (old, size, fill) => { const a = new Float32Array(old.length + n * size); a.set(old); for (let i = 0; i < n; i++) a.set(fill(i), old.length + i * size); return a; }; out = { pos: grow(out.pos, 3, (i) => P.slice(i * 3, i * 3 + 3)), nor: grow(out.nor, 3, (i) => N.slice(i * 3, i * 3 + 3)), tan: grow(out.tan, 4, (i) => perp(N.slice(i * 3, i * 3 + 3))), uv: grow(out.uv, 2, () => spec.neutral) }; return base; };
  if (spec.tube) {
    if (!spec.neutral) throw new Error("`neutral`: the place in the picture new points take");
    const T = tubeMesh(spec.tube.stations, spec.tube), base = add(Array.from(T.pos), Array.from(T.nor));
    for (const v of T.index) keep.push(v + base); did.tube = { points: T.pos.length / 3, triangles: T.index.length / 3 };
  }
  const list = []; moved.forEach((m, v) => { if (m) list.push(v); });
  return { ...out, index: Uint32Array.from(keep), moved: Int32Array.from(list), first, did };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""))) {
  const args = process.argv.slice(2), [id, src, dst] = args.filter((a) => !a.startsWith("--")), opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3);
  if (!id || !src || !dst) { console.error("usage: node tools/t05-statue/mend.mjs <figure id> <baked.glb> <out.glb> [--spec=<json>] [--report=<json>]"); process.exit(2); }
  const specFile = opt("spec") || new URL(`./${id}/mend.json`, import.meta.url).pathname, spec = fs.existsSync(specFile) ? JSON.parse(fs.readFileSync(specFile, "utf8")) : {};
  const sha = crypto.createHash("sha256").update(fs.readFileSync(src)).digest("hex");
  if (spec.source?.sha256 && spec.source.sha256 !== sha) throw new Error(`${src} is not the file this spec was written for (${spec.source.file}, ${spec.source.sha256}): its numbers are that surface's`);
  const { io, doc, prims, frame } = await readBaked(src, id), report = { figure: id, source: { file: src.replace(/.*\//, ""), sha256: sha }, maps: [] }, done = new Map();
  for (const p of prims) {
    if (done.has(p.texture)) throw new Error("two primitives share one normal map: mend them together");
    const img = await sharp(Buffer.from(p.texture.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true }), W = img.info.width; if (img.info.height !== W) throw new Error("a square picture is expected");
    const r = mendMap(img.data, W, owners(p.uv, p.index, W), spec.specks ?? {});
    p.texture.setImage(new Uint8Array(await sharp(img.data, { raw: { width: W, height: W, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer())); done.set(p.texture, { rgb: img.data, W });
    report.maps.push({ part: p.name, size: W, ...r });
  }
  if (spec.shape) {
    const p = prims.find((q) => q.name === spec.shape.part); if (!p) throw new Error(`no part ${spec.shape.part}`); if (!p.plain) throw new Error("a part whose node is turned or scaled is not written back here");
    const prim = p.prim, n0 = p.pos.length / 3, S = mendShape({ pos: p.pos, nor: prim.getAttribute("NORMAL").getArray(), tan: prim.getAttribute("TANGENT").getArray(), uv: p.uv, index: p.index }, spec.shape);
    if (S.pos.length / 3 > S.first) {   // the new points' one place in the picture must be neutral, and stay so when the pack halves the picture and cuts it into 4 × 4 blocks
      const { rgb, W } = done.get(p.texture), [u, v] = spec.shape.neutral, x0 = Math.floor(u * W), y0 = Math.floor(v * W);
      for (let y = y0 - 8; y <= y0 + 8; y++) for (let x = x0 - 8; x <= x0 + 8; x++) { const o = (y * W + x) * 3; if (Math.abs(rgb[o] - 128) > 1 || Math.abs(rgb[o + 1] - 128) > 1 || rgb[o + 2] < 254) throw new Error(`the picture is not neutral round ${u}, ${v}: the new points would be lit by another part's relief`); }
    }
    const back = (i) => [S.pos[i * 3] / frame.s + frame.cx, S.pos[i * 3 + 1] / frame.s + frame.lo, S.pos[i * 3 + 2] / frame.s + frame.cz], n1 = S.pos.length / 3;
    const P = new Float32Array(n1 * 3); P.set(prim.getAttribute("POSITION").getArray());   // every point that was not touched keeps the very numbers it was read with
    for (const v of S.moved) P.set(back(v), v * 3); for (let v = S.first; v < n1; v++) P.set(back(v), v * 3);
    prim.getAttribute("POSITION").setArray(P); prim.getAttribute("NORMAL").setArray(S.nor); prim.getAttribute("TANGENT").setArray(S.tan); prim.getAttribute("TEXCOORD_0").setArray(S.uv);
    prim.getIndices().setArray(n1 > 65535 ? S.index : Uint16Array.from(S.index));
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], e = [0, 0, 0];
    for (const q of prims) { const A = q.prim.getAttribute("POSITION"); for (let i = 0; i < A.getCount(); i++) { A.getElement(i, e); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], e[k]); hi[k] = Math.max(hi[k], e[k]); } } }
    if ([...lo, ...hi].some((v, k) => Math.abs(v - frame.box[k]) > 1e-7)) throw new Error("the figure's bounding box moved: the page stands it by that box and the anchors are measured from it");
    report.shape = { part: p.name, points: [n0, n1], triangles: [p.index.length / 3, S.index.length / 3], ...S.did };
  }
  await io.write(dst, doc); report.out = { file: dst.replace(/.*\//, ""), sha256: crypto.createHash("sha256").update(fs.readFileSync(dst)).digest("hex"), bytes: fs.statSync(dst).size };
  if (opt("report")) fs.writeFileSync(opt("report"), JSON.stringify(report, null, 1) + "\n");
  console.log(JSON.stringify(report));
}
