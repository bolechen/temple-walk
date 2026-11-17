// How much each library adds to the published page: a minimal use of it bundled by the same Vite that builds the site
// (three left out, as the page already carries it), minified, then gzip -9. A .wasm the library loads as a separate
// file is counted on its own line; one inlined as base64 into the script is counted in the script.
import { build } from "vite";
import { gzipSync } from "node:zlib";
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const cases = {
  "three-mesh-bvh": `import { MeshBVH } from "three-mesh-bvh"; window.x = MeshBVH;`,
  "@dimforge/rapier3d-compat": `import R from "@dimforge/rapier3d-compat"; window.x = R;`,
  "recast-navigation": `import { init, NavMeshQuery } from "recast-navigation"; import { generateSoloNavMesh } from "recast-navigation/generators"; window.x = [init, NavMeshQuery, generateSoloNavMesh];`,
};
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const out = {};
for (const [name, src] of Object.entries(cases)) {
  const dir = mkdtempSync(join(process.cwd(), "tools/out/size-")), entry = join(dir, "entry.js"); writeFileSync(entry, src);
  await build({ configFile: false, logLevel: "silent", root: process.cwd(), build: { outDir: join(dir, "out"), emptyOutDir: true, minify: true, lib: { entry, formats: ["es"], fileName: "x" }, rollupOptions: { external: ["three"] } } });
  let raw = 0, gz = 0; const files = [];
  for (const f of walk(join(dir, "out"))) { const b = readFileSync(f), g = gzipSync(b, { level: 9 }).length; raw += b.length; gz += g; files.push(`${f.split("/").pop()} ${(b.length / 1024).toFixed(0)}/${(g / 1024).toFixed(0)}`); }
  out[name] = { rawKB: Math.round(raw / 1024), gzipKB: Math.round(gz / 1024) };
  console.log(name.padEnd(28), "raw", out[name].rawKB, "KB  gzip", out[name].gzipKB, "KB   ", files.join(", "));
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
