// The seven Buddhas' paint worked out in Node, point by point, as the page's shader works it out pixel by pixel (#763): which zone of
// app/levels/t05/figures/recipe.json a point of a figure's surface takes, from that figure's anchors and its masks. The shapes below are
// paint.js's GLSL written again in JavaScript, line for line (pEll, pCap, pBox, pHalf, pBand, pMap); a zone is taken where its expression
// is at least a half, and the last such zone in the recipe wins, as the page's zone picture has it (uIdMode 1).
//
// It reads the shipped files (app/shared/models/t05/, fetched by tools/setup.mjs, not in git) with glTF Transform and the meshopt decoder,
// lays each figure in the frame its anchors are written in exactly as figures/load.js does (scaled to its stage height above the plinth,
// centred, its foot at y = 0), and can cast a ray at it. tests/unit/t05-figure-paint.test.mjs holds the hairline and Sakyamuni's forearm
// with it; `node tools/t05-figure-zones.mjs` draws any figure's zones from any side in a few seconds, with no browser.
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { FIGURE_FILES, PLINTH } from "../app/levels/t05/figures/registry.js";

const APP = new URL("../app/", import.meta.url);
export const recipe = JSON.parse(fs.readFileSync(new URL("levels/t05/figures/recipe.json", APP), "utf8"));
export const anchorsOf = (id) => JSON.parse(fs.readFileSync(new URL(`levels/t05/figures/anchors/${id}.json`, APP), "utf8")).anchors;
export const filesThere = () => FIGURE_FILES.every((f) => fs.existsSync(new URL(`shared/models/t05/${f.file}`, APP)));

/** A figure's triangles in its own frame: positions and normals (three numbers a point) and the index. */
export async function loadFigure(id) {
  const d = FIGURE_FILES.find((f) => f.id === id); if (!d) throw new Error(`no figure ${id}`);
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(new URL(`shared/models/t05/${d.file}`, APP).pathname);
  const P = [], N = [], I = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION"), nor = prim.getAttribute("NORMAL"), idx = prim.getIndices(), base = P.length / 3, e = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, e); const [x, y, z] = e;
        P.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        nor.getElement(i, e); const [a, b, c] = e, nx = m[0] * a + m[4] * b + m[8] * c, ny = m[1] * a + m[5] * b + m[9] * c, nz = m[2] * a + m[6] * b + m[10] * c, l = Math.hypot(nx, ny, nz) || 1;
        N.push(nx / l, ny / l, nz / l);
      }
      if (idx) for (let i = 0; i < idx.getCount(); i++) I.push(base + idx.getScalar(i)); else for (let i = 0; i < pos.getCount(); i++) I.push(base + i);
    }
  }
  // as load.js: the file scaled to the stage's height above the plinth, then centred across and in depth with its foot at 0
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
  const s = (d.stageH - PLINTH.h) / (hi[1] - lo[1]), cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  for (let i = 0; i < P.length; i += 3) { P[i] = (P[i] - cx) * s; P[i + 1] = (P[i + 1] - lo[1]) * s; P[i + 2] = (P[i + 2] - cz) * s; }
  return { id, pos: new Float32Array(P), nor: new Float32Array(N), index: new Uint32Array(I) };
}

/** A mask as the page's texture holds it: RGBA bytes, row 0 at the picture's foot (three's flipY). */
export async function loadMask(file) {
  const { data, info } = await sharp(new URL(`shared/models/t05/masks/${file}`, APP).pathname).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
export async function loadMasks(anchors) {
  const out = {};
  for (const [k, key] of [["front", "maskFront"], ["back", "maskBack"], ["right", "maskRight"], ["hair", "maskHair"]]) if (anchors[key]?.file) out[k] = await loadMask(anchors[key].file);
  return out;
}
// bilinear, clamped at the edge, v up from the picture's foot
function texel(m, u, v) {
  const x = Math.min(Math.max(u * m.w - 0.5, 0), m.w - 1), y = Math.min(Math.max((1 - v) * m.h - 0.5, 0), m.h - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, m.w - 1), y1 = Math.min(y0 + 1, m.h - 1), fx = x - x0, fy = y - y0, out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const a = m.data[(y0 * m.w + x0) * 4 + c], b = m.data[(y0 * m.w + x1) * 4 + c], e = m.data[(y1 * m.w + x0) * 4 + c], f = m.data[(y1 * m.w + x1) * 4 + c];
    out[c] = ((a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy) / 255;
  }
  return out;
}

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
function val(v, A) {
  if (typeof v === "string" && v[0] === "@") { const [name, comp] = v.slice(1).split("."); const a = A[name]; if (a === undefined) return undefined; return comp ? a["xyz".indexOf(comp)] : a; }
  if (Array.isArray(v)) { const r = v.map((x) => val(x, A)); return r.some((x) => x === undefined) ? undefined : r.flat(); }
  return v;
}
const add = (a, b) => a.map((x, i) => x + b[i]);

/** The recipe made ready for one figure: `zoneAt(p, n)` gives the zone's name at a point of its surface with that normal (figure's frame). */
export function painter(anchors, masks, rec = recipe) {
  const A = anchors, e = rec.edge ?? 0.02;
  const leaf = (type, s) => {
    const off = val(s.offset ?? [0, 0, 0], A) || [0, 0, 0];
    if (type === "ell") { const c = val(s.c, A), r = val(s.r, A); if (!c || !r) return () => 0; const cc = add(c, off), k = Math.min(...r);
      return (p) => 1 - smooth(-e, e, (Math.hypot((p[0] - cc[0]) / r[0], (p[1] - cc[1]) / r[1], (p[2] - cc[2]) / r[2]) - 1) * k); }
    if (type === "cap") { const a0 = val(s.a, A), b0 = val(s.b, A), r = val(s.r, A); if (!a0 || !b0 || r === undefined) return () => 0; const a = add(a0, off), b = add(b0, off), ba = b.map((x, i) => x - a[i]), bb = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2;
      return (p) => { const pa = p.map((x, i) => x - a[i]), h = Math.min(Math.max((pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / bb, 0), 1); return 1 - smooth(-e, e, Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - r); }; }
    if (type === "box") { const mn = val(s.min, A), mx = val(s.max, A); if (!mn || !mx) return () => 0;
      return (p) => 1 - smooth(-e, e, Math.max(mn[0] - p[0], p[0] - mx[0], mn[1] - p[1], p[1] - mx[1], mn[2] - p[2], p[2] - mx[2])); }
    if (type === "half") {
      let a, n;
      if (s.through) { a = val(s.through[0], A); const b = val(s.through[1], A); if (!a || !b) return () => 0; const dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dy, dz); n = [0, -dz / l, dy / l]; if (n[1] < 0) n = n.map((x) => -x); }
      else { a = val(s.p, A); const n0 = val(s.n, A); if (!a || !n0) return () => 0; const l = Math.hypot(...n0); n = n0.map((x) => x / l); }
      return (p) => smooth(-e, e, (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] + (p[2] - a[2]) * n[2]);
    }
    if (type === "band") { const y0 = val(s.y0, A), c = val(s.c ?? 0, A), h = val(s.h, A), w = val(s.w, A), z0 = val(s.z0 ?? -99, A); if ([y0, c, h, w, z0].some((x) => x === undefined)) return () => 0;
      return (p) => 1 - smooth(-e, e, Math.max(Math.abs(p[1] - (y0 + c * p[0] * p[0])) - h, Math.abs(p[0]) - w, z0 - p[2])); }
    if (type === "map") {
      const key = { front: "maskFront", back: "maskBack", right: "maskRight", hair: "maskHair" }[s.m], M = A[key], tex = masks[s.m]; if (!M || !M.rect || !tex) return () => 0;
      const [x0, y0, x1, y1] = M.rect, code = { front: 1, back: 2, right: 3, hair: 4 }[s.m], zMin = M.z ?? -99, depth = !!M.depth, ch = s.ch ?? 0;
      return (p, n) => {
        const fr = code === 1 || code === 4, qz = fr ? p[2] : code === 2 ? -p[2] : -p[0], nz = fr ? n[2] : code === 2 ? -n[2] : -n[0];
        const u = ((code === 3 ? p[2] : p[0]) - x0) / (x1 - x0), v = (p[1] - y0) / (y1 - y0);
        if (u < 0 || v < 0 || u > 1 || v > 1) return 0;
        if (qz < zMin || nz < -0.1) return 0;
        const t = texel(tex, code === 2 ? 1 - u : u, v);
        if (depth && qz < t[3] * 7 - 3.5 - 0.06 - 0.2 * (1 - nz)) return 0;
        return t[ch];
      };
    }
    throw new Error("paint: unknown shape " + type);
  };
  const expr = (node) => {
    if (node.and) { const fs_ = node.and.map(expr); return (p, n) => fs_.reduce((k, f) => k * f(p, n), 1); }
    if (node.or) { const fs_ = node.or.map(expr); return (p, n) => fs_.reduce((k, f) => Math.max(k, f(p, n)), 0); }
    if (node.not) { const f = expr(node.not); return (p, n) => 1 - f(p, n); }
    const type = Object.keys(node).find((k) => ["ell", "cap", "box", "half", "band", "map"].includes(k)); if (!type) throw new Error("paint: unknown shape " + JSON.stringify(node));
    return leaf(type, node[type]);
  };
  const zones = rec.zones.map((z) => ({ name: z.name, color: z.color, k: expr(z.where) }));
  const zoneIndex = (p, n) => { let zi = -1; for (let i = 0; i < zones.length; i++) if (zones[i].k(p, n) >= 0.5) zi = i; return zi; };
  return { zones, zoneIndex, zoneAt: (p, n) => { const i = zoneIndex(p, n); return i < 0 ? rec.base.name : zones[i].name; }, weight: (name, p, n) => zones.find((z) => z.name === name).k(p, n) };
}

/** The first point of the figure a ray meets: `{ t, p, n, tri }` (n the smooth normal there), or null. Every triangle is tried: tens of thousands, a few milliseconds a ray. */
export function cast(fig, o, d) {
  const { pos, nor, index } = fig; let best = null;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2], e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, tx = o[0] - pos[a], ty = o[1] - pos[a + 1], tz = o[2] - pos[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t <= 1e-6 || (best && t >= best.t)) continue;
    const w = 1 - u - v, n = [0, 1, 2].map((k) => nor[a + k] * w + nor[b + k] * u + nor[c + k] * v), l = Math.hypot(...n) || 1;
    best = { t, p: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], n: n.map((x) => x / l), tri: i / 3 };
  }
  return best;
}
