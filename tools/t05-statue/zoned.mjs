// Thin a statue by zones (issue #701, the art director: the pained look is made by thinning: at 60k faces the brow, the eyelids and the mouth's corners are folded facets): the face keeps
// more of the 60k than its share, the body, the back of the head and the robes give it up.
//
//   node tools/t05-statue/zoned.mjs <in.glb> <out.glb> [--tiers=<tiers.json>] --scale=<stage metres per file unit> --y0=<m> --y1=<m> --x=<half width m> --zmin=<depth m> [--face=24000] [--rest=36000] [--error=0.5]
//
// The mesh is welded; every triangle whose centre lies in the face's box (stage metres: y from y0 up to y1, |x| < x, depth over zmin, in the file's own frame) is the face's; the others are
// the rest's. Each part is simplified by meshoptimizer on its own to its own target with its borders locked (the two parts' shared edge keeps its points, so the seam stays closed), the
// two index lists are joined over the same points, unused points are dropped and smooth, area-weighted normals are worked out. Prints the triangle counts of each part before and after.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import fs from "node:fs"; import crypto from "node:crypto";
const [src, dst] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const TIERS = process.argv.find((a) => a.startsWith("--tiers=")); const tiersCfg = TIERS ? JSON.parse(fs.readFileSync(TIERS.slice(8), "utf8")) : null;
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? +a.slice(k.length + 3) : d; };
const S = arg("scale", 8.45), Y0 = arg("y0", 6.3), Y1 = arg("y1", 7.7), X = arg("x", 0.62), ZMIN = arg("zmin", -0.45), FACE = arg("face", 24000), REST = arg("rest", 36000), ERR = arg("error", 0.5);
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src); await doc.transform(weld());
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]; const P = prim.getAttribute("POSITION"), I = prim.getIndices();
const pos = new Float32Array(P.getArray()), idx = new Uint32Array(I.getArray());
// Tiers (--tiers=<json>): [{ name, boxes: [{ y0, y1, x0, x1, absx, z0, z1 }], keep: true | target: n }, ...] in order; a triangle belongs to the first tier whose box holds its centre; the rest (the last tier, "rest", `target`) takes what is left.
// Without --tiers: one face box (the arguments above) and the rest.
const inBox = (b, cx, cy, cz) => { const x = b.absx ? Math.abs(cx * S) : cx * S; return cy * S >= b.y0 && cy * S <= b.y1 && x >= b.x0 && x <= b.x1 && cz * S >= b.z0 && cz * S <= b.z1; };
const cfg = tiersCfg ? tiersCfg : { tiers: [{ name: "face", boxes: [{ y0: Y0, y1: Y1, x0: 0, x1: X, absx: true, z0: ZMIN, z1: 99 }], target: FACE }], rest: REST };
const parts = cfg.tiers.map(() => []); const restList = [];
for (let t = 0; t < idx.length; t += 3) {
  const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
  const cx = (pos[a] + pos[b] + pos[c]) / 3, cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
  let k = cfg.tiers.findIndex((tr) => tr.boxes.some((bx) => inBox(bx, cx, cy, cz)));
  (k < 0 ? restList : parts[k]).push(idx[t], idx[t + 1], idx[t + 2]);
}
const run = (list, target) => { if (target === "keep" || target * 3 >= list.length) return { out: new Uint32Array(list), err: 0 }; const [out, err] = MeshoptSimplifier.simplify(new Uint32Array(list), pos, 3, Math.max(3, Math.round(target) * 3), ERR, ["LockBorder"]); return { out, err }; };
const results = cfg.tiers.map((tr, i) => ({ name: tr.name, before: parts[i].length / 3, ...run(parts[i], tr.keep ? "keep" : tr.target) }));
const rr = run(restList, cfg.rest);
const f = { out: (() => { const all = [...results.map((r) => r.out), rr.out]; const n = all.reduce((q, a) => q + a.length, 0); const o = new Uint32Array(n); let q = 0; for (const a of all) { o.set(a, q); q += a.length; } return o; })(), err: 0 }, r = { out: new Uint32Array(0), err: rr.err }; const fa = [], ra = restList;
// Simplifying can leave a two-face sliver hanging on the body (a doubled triangle on a non-manifold edge); drop every piece of ten faces or fewer. Pieces are found with points welded by position (a texture seam splits indices, not the surface).
const joined = (() => { const o = f.out, key = new Map(), id = (v) => { const k = `${pos[v * 3]}|${pos[v * 3 + 1]}|${pos[v * 3 + 2]}`; if (!key.has(k)) key.set(k, key.size); return key.get(k); };
  const w = Array.from(o, id), par = Array.from({ length: key.size }, (_, i) => i); const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < w.length; t += 3) for (const v of [w[t + 1], w[t + 2]]) { const x = find(w[t]), y = find(v); if (x !== y) par[y] = x; }
  const cnt = new Map(); for (let t = 0; t < w.length; t += 3) { const r = find(w[t]); cnt.set(r, (cnt.get(r) || 0) + 1); }
  const keep = []; for (let t = 0; t < w.length; t += 3) if (cnt.get(find(w[t])) > 10) keep.push(o[t], o[t + 1], o[t + 2]);
  return new Uint32Array(keep); })();
const map = new Int32Array(pos.length / 3).fill(-1); let n = 0; const np = [];
const nidx = new Uint32Array(joined.length);
for (let i = 0; i < joined.length; i++) { const v = joined[i]; if (map[v] < 0) { map[v] = n++; np.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); } nidx[i] = map[v]; }
const nP = new Float32Array(np), nrm = new Float32Array(nP.length);
for (let t = 0; t < nidx.length; t += 3) { const i = nidx[t] * 3, j = nidx[t + 1] * 3, k = nidx[t + 2] * 3;
  const u = [nP[j] - nP[i], nP[j + 1] - nP[i + 1], nP[j + 2] - nP[i + 2]], v = [nP[k] - nP[i], nP[k + 1] - nP[i + 1], nP[k + 2] - nP[i + 2]], g = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  for (const q of [i, j, k]) for (let x = 0; x < 3; x++) nrm[q + x] += g[x]; }
for (let q = 0; q < nrm.length; q += 3) { const l = Math.hypot(nrm[q], nrm[q + 1], nrm[q + 2]) || 1; nrm[q] /= l; nrm[q + 1] /= l; nrm[q + 2] /= l; }
const buf = P.getBuffer();
prim.getAttribute("POSITION").setArray(nP); prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(nidx).setBuffer(buf));
for (const sem of prim.listSemantics()) if (sem !== "POSITION") { const a = prim.getAttribute(sem); prim.setAttribute(sem, null); }
prim.setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nrm).setBuffer(buf));
await io.write(dst, doc); const bytes = fs.readFileSync(dst);
console.log(JSON.stringify({ tiers: results.map((q) => ({ name: q.name, before: q.before, after: q.out.length / 3, error: q.err })), rest: { before: restList.length / 3, after: rr.out.length / 3, error: rr.err }, total_after: nidx.length / 3, points: n, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }));
