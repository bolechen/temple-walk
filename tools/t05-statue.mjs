// Thin a generated or scanned statue for the T05 white-box hall (issue #280): weld, simplify with meshoptimizer to
// about the triangles asked for, and write a GLB the hall page can stand on its altar. The same file at several budgets
// shows what the figure loses at each (tools/t05-hall.cjs draws them).
//
//   node tools/t05-statue.mjs <in.glb> <out.glb> [--tris=60000] [--error=0.02] [--keepuv]
//
// Without --keepuv the texture coordinates are dropped (an untextured Tripo mesh carries them for nothing).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, dedup, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import fs from "node:fs"; import crypto from "node:crypto";

const [src, dst] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const target = +arg("tris", 60000), err = +arg("error", 0.02), keepUV = process.argv.includes("--keepuv");   // --error: the simplifier's limit as a share of the mesh's size; 0.02 stops near 60k on these figures, the far levels need more (#370)
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const tris = () => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3; return t; };
const before = tris();
if (!keepUV) for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const uv = p.getAttribute("TEXCOORD_0"); if (uv && !p.getMaterial()?.getBaseColorTexture()) { p.setAttribute("TEXCOORD_0", null); uv.dispose(); } }
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, target / before), error: err, lockBorder: false }), dedup(), prune());
// Smooth normals of the thinned surface. (Until #370 this ran gltf-transform's
// normals(), which writes flat normals and unwelds every triangle: the thinned figures of #280/#287 were drawn faceted
// for that, more than for their triangle count.) Smooth, area-weighted normals are worked out here from the thinned surface.
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {   // always fresh: a welded point keeps one of its copies' normals, which left black specks
  const P = p.getAttribute("POSITION"), I = p.getIndices(), n = new Float32Array(P.getCount() * 3), a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  for (let t = 0; t < I.getCount(); t += 3) { const i = I.getScalar(t), j = I.getScalar(t + 1), k = I.getScalar(t + 2); P.getElement(i, a); P.getElement(j, b); P.getElement(k, c);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const q of [i, j, k]) for (let x = 0; x < 3; x++) n[q * 3 + x] += f[x]; }
  for (let q = 0; q < n.length; q += 3) { const l = Math.hypot(n[q], n[q + 1], n[q + 2]) || 1; n[q] /= l; n[q + 1] /= l; n[q + 2] /= l; }
  const old = p.getAttribute("NORMAL"); p.setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(n).setBuffer(P.getBuffer())); if (old && !old.listParents().some((x) => x !== doc.getRoot())) old.dispose();
}
await io.write(dst, doc);
const buf = fs.readFileSync(dst);
console.log(JSON.stringify({ src, dst, before, after: tris(), bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") }));
