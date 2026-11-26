// A baked statue as the hall would fetch it (issue #701): geometry quantized and meshopt-compressed, the normal maps kept as the bake wrote them (PNG) or recoded as WebP when sharp is installed.
//
//   node tools/t05-statue/pack.mjs <baked.glb> <out.glb> [--webp]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { quantize, meshopt, textureCompress } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import fs from "node:fs";
const [src, dst] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const steps = [quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: "high" })];
if (process.argv.includes("--webp")) { const sharp = (await import("sharp")).default; steps.unshift(textureCompress({ encoder: sharp, targetFormat: "webp", quality: 92 })); }
await doc.transform(...steps); await io.write(dst, doc);
console.log(JSON.stringify({ src: fs.statSync(src).size, out: fs.statSync(dst).size }));
