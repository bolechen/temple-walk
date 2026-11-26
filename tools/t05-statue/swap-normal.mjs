// Put another PNG in as the normal map of one material of a glb, leaving everything else as it is (issue #701):
//   node tools/t05-statue/swap-normal.mjs <in.glb> <normal.png> <out.glb> <material name>
import { NodeIO } from "@gltf-transform/core";
import { readFileSync } from "node:fs";
const [inp, png, out, name] = process.argv.slice(2);
const io = new NodeIO(); const doc = await io.read(inp);
const mat = doc.getRoot().listMaterials().find((m) => m.getName() === name);
if (!mat || !mat.getNormalTexture()) { console.error("no normal texture on material " + name); process.exit(1); }
mat.getNormalTexture().setImage(new Uint8Array(readFileSync(png))).setMimeType("image/png");
await io.write(out, doc);
