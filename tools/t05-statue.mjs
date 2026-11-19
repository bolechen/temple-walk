// Thin a generated or scanned statue for the T05 white-box hall (issue #280): weld, simplify with meshoptimizer to
// about the triangles asked for, and write a GLB the hall page can stand on its altar. The same file at several budgets
// shows what the figure loses at each (tools/t05-hall.cjs draws them).
//
//   node tools/t05-statue.mjs <in.glb> <out.glb> [--tris=60000] [--keepuv]
//
// Without --keepuv the texture coordinates are dropped (an untextured Tripo mesh carries them for nothing).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, dedup, prune, normals } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import fs from "node:fs"; import crypto from "node:crypto";

const [src, dst] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const target = +arg("tris", 60000), keepUV = process.argv.includes("--keepuv");
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const tris = () => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3; return t; };
const before = tris();
if (!keepUV) for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const uv = p.getAttribute("TEXCOORD_0"); if (uv && !p.getMaterial()?.getBaseColorTexture()) { p.setAttribute("TEXCOORD_0", null); uv.dispose(); } }
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, target / before), error: 0.02, lockBorder: false }), dedup(), prune());
await doc.transform(normals({ overwrite: true }));   // smooth normals of the thinned surface
await io.write(dst, doc);
const buf = fs.readFileSync(dst);
console.log(JSON.stringify({ src, dst, before, after: tris(), bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") }));
