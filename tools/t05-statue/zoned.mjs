// Thin a statue by zones (issue #701, the art director: the pained look is made by thinning: at 60k faces the brow, the eyelids and the mouth's corners are folded facets): the face keeps
// more of the 60k than its share, the body, the back of the head and the robes give it up.
//
//   node tools/t05-statue/zoned.mjs <in.glb> <out.glb> --scale=<stage metres per file unit> --y0=<m> --y1=<m> --x=<half width m> --zmin=<depth m> [--face=24000] [--rest=36000] [--error=0.5]
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
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? +a.slice(k.length + 3) : d; };
const S = arg("scale", 8.45), Y0 = arg("y0", 6.3), Y1 = arg("y1", 7.7), X = arg("x", 0.62), ZMIN = arg("zmin", -0.45), FACE = arg("face", 24000), REST = arg("rest", 36000), ERR = arg("error", 0.5);
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src); await doc.transform(weld());
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]; const P = prim.getAttribute("POSITION"), I = prim.getIndices();
const pos = new Float32Array(P.getArray()), idx = new Uint32Array(I.getArray());
const inFace = (cx, cy, cz) => cy * S >= Y0 && cy * S <= Y1 && Math.abs(cx * S) < X && cz * S > ZMIN;
const fa = [], ra = [];
for (let t = 0; t < idx.length; t += 3) {
  const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
  const cx = (pos[a] + pos[b] + pos[c]) / 3, cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
  (inFace(cx, cy, cz) ? fa : ra).push(idx[t], idx[t + 1], idx[t + 2]);
}
const run = (list, target) => { const [out, err] = MeshoptSimplifier.simplify(new Uint32Array(list), pos, 3, Math.max(3, Math.round(target) * 3), ERR, ["LockBorder"]); return { out, err }; };
const f = run(fa, FACE), r = run(ra, REST);
const joined = new Uint32Array(f.out.length + r.out.length); joined.set(f.out, 0); joined.set(r.out, f.out.length);
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
console.log(JSON.stringify({ face_before: fa.length / 3, face_after: f.out.length / 3, rest_before: ra.length / 3, rest_after: r.out.length / 3, total_after: nidx.length / 3, points: n, face_error: f.err, rest_error: r.err, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }));
