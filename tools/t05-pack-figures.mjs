// Packs the seven baked figures of the great hall for the page (#701, docs/t05/asset-register.csv): each direct export (plain
// glTF, two 2048 px PNG normal maps, 77 k triangles, 12 MB) becomes one file of about 2.5 MB: the normal maps cut to 1024 px
// and written as UASTC KTX2 (zstd, mipmaps, transcoded on the card to BC7 or ASTC, 1.4 MB of card memory a map), the vertices
// quantised (position 14 bits, normal 10, uv 12) and meshopt compressed. Why this form and not WebP or a bigger map: the card
// holds 14 maps at 1 byte a pixel, not 4; at 2048 px they would cost 41 MB on the wire (docs/t05/evidence/701-pack-r24).
//
//   PACK_DIR=<dir where `npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer ktx2-encoder sharp`
//   was run; none of them is a dependency of the page> node tools/t05-pack-figures.mjs <dir of the seven direct .glb> <out dir> [size=1024]
import fs from "node:fs"; import path from "node:path"; import url from "node:url"; import { createRequire } from "node:module";
const dir = process.env.PACK_DIR; if (!dir) throw new Error("PACK_DIR: where the packers are installed (see the head of this file)");
const req = createRequire(path.resolve(dir) + "/");
// the ES-module builds, by their own entry file: ktx2-encoder imports glTF Transform that way, and two builds (cjs and esm) keep two separate document registries
const esm = (pkg) => import(url.pathToFileURL(path.resolve(dir, "node_modules", pkg, "dist/index.js")).href);
const imp = (m) => (m.startsWith("@gltf-transform/") ? esm(m) : import(req.resolve(m)));
const { NodeIO } = await imp("@gltf-transform/core"), { ALL_EXTENSIONS } = await imp("@gltf-transform/extensions");
const { quantize, meshopt, dedup, prune } = await imp("@gltf-transform/functions"), { MeshoptEncoder, MeshoptDecoder } = await imp("meshoptimizer");
const { ktx2 } = await import(url.pathToFileURL(path.resolve(dir, "node_modules/ktx2-encoder/dist/gltf-transform/index.js")).href);
const sharp = (await imp("sharp")).default;
const [inDir, outDir, size = "1024"] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const imageDecoder = async (b) => { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const FILES = { kasyapa: "kasyapa-B4H10b", krakucchanda: "krakucchanda-B4H10b", sikhin: "sikhin-M40vb", vipasyin: "vipasyin-B4H10b", visvabhu: "visvabhu-V3b", kanakamuni: "kanakamuni-K1Lb", sakyamuni: "sakyamuni-V14b" };
let total = 0;
for (const [id, file] of Object.entries(FILES)) {
  const doc = await io.read(path.join(inDir, `${file}.glb`));
  for (const t of doc.getRoot().listTextures()) {
    const small = await sharp(Buffer.from(t.getImage())).resize(+size, +size, { kernel: "lanczos3" }).png().toBuffer();
    t.setImage(new Uint8Array(small)); t.setMimeType("image/png");
  }
  await doc.transform(ktx2({ isUASTC: true, generateMipmap: true, enableRDO: true, needSupercompression: true, isNormalMap: true, imageDecoder }),
    dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
  const out = path.join(outDir, `${id}.glb`); await io.write(out, doc);
  const n = fs.statSync(out).size; total += n; console.log(id, n);
}
console.log("total", total);
