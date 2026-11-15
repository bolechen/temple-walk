// What `pnpm install` leaves ready besides node_modules: the parts of the page that are not kept in git because
// they can be had from where they come from.
//
//     node tools/setup.mjs            (run by pnpm after an install; safe to run again)
//     node tools/setup.mjs --force    (fetch and copy everything afresh)
//
// 1. three.js. The page is plain ES modules with no bundler, so the files it imports are copied out of the installed
//    package into app/vendor/three/, with `from "three"` turned into the relative path a browser can follow.
// 2. The statue and its pedestal for the halls of level T00, fetched from the product they belong to
//    (如是我闻 /zen) into app/levels/t00/models/ and checked against the hashes below. They are the owner's own
//    assets on the owner's own CDN; they are not redistributed through this repository.
import fs from "node:fs"; import { execFileSync } from "node:child_process"; import path from "node:path"; import crypto from "node:crypto"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), FORCE = process.argv.includes("--force");
const say = (...a) => console.log("setup:", ...a);

// ---- three.js ----
const JSM = [
  "postprocessing/Pass.js", "postprocessing/EffectComposer.js", "postprocessing/RenderPass.js", "postprocessing/ShaderPass.js", "postprocessing/MaskPass.js",
  "postprocessing/UnrealBloomPass.js", "postprocessing/OutputPass.js", "shaders/CopyShader.js", "shaders/LuminosityHighPassShader.js", "shaders/OutputShader.js",
  "loaders/GLTFLoader.js", "loaders/KTX2Loader.js", "utils/BufferGeometryUtils.js", "utils/SkeletonUtils.js", "utils/WorkerPool.js",
  "math/ColorSpaces.js", "libs/meshopt_decoder.module.js", "libs/ktx-parse.module.js", "libs/zstddec.module.js", "libs/basis/basis_transcoder.js", "libs/basis/basis_transcoder.wasm",
];
function vendor() {
  const require = createRequire(import.meta.url); let pkg;
  try { pkg = path.join(path.dirname(require.resolve("three")), ".."); } catch { throw new Error("three is not installed: run `pnpm install`"); }   // its package.json is not exported; its entry point is build/three.cjs
  const version = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8")).version, out = path.join(ROOT, "app/vendor/three"), stamp = path.join(out, "VERSION");
  if (!FORCE && fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8").trim() === version && JSM.every((f) => fs.existsSync(path.join(out, "jsm", f)))) return say(`three ${version} already in app/vendor/three`);
  fs.rmSync(out, { recursive: true, force: true });
  const put = (from, to, text) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (!text) return fs.copyFileSync(from, to);
    const up = path.relative(path.dirname(to), path.join(out, "build/three.module.js")).split(path.sep).join("/");
    fs.writeFileSync(to, fs.readFileSync(from, "utf8").replace(/(from\s*)(['"])three\2/g, `$1$2${up}$2`).replace(/(from\s*)(['"])three\/addons\//g, `$1$2${path.relative(path.dirname(to), path.join(out, "jsm")).split(path.sep).join("/") || "."}/`));
  };
  for (const f of ["three.module.js", "three.core.js"]) put(path.join(pkg, "build", f), path.join(out, "build", f), false);
  for (const f of JSM) put(path.join(pkg, "examples/jsm", f), path.join(out, "jsm", f), /\.js$/.test(f) && !/basis_transcoder/.test(f));
  fs.copyFileSync(path.join(pkg, "LICENSE"), path.join(out, "LICENSE")); fs.writeFileSync(stamp, version + "\n");
  say(`three ${version} copied to app/vendor/three (${JSM.length + 2} files)`);
}

// ---- the statues of level T00 ----
const MODELS = [
  { file: "buddha.glb", url: "https://static.rushiwowen.co/models/zen-v2/buddha-2ec9117a3416.glb", sha256: "2ec9117a34166e952a1af5a4be25ef1a86248bb9a2374fccf1ec7b7ecb278858" },
  { file: "pedestal.glb", url: "https://static.rushiwowen.co/models/zen-v2/pedestal-49ccf1d43981.glb", sha256: "49ccf1d439810d3ba6c57cd2ad991fb95337bf859de3e9961a862e94cba80619" },
];
async function models() {
  const out = path.join(ROOT, "app/levels/t00/models"); fs.mkdirSync(out, { recursive: true });
  for (const m of MODELS) {
    const to = path.join(out, m.file), sum = (b) => crypto.createHash("sha256").update(b).digest("hex");
    if (!FORCE && fs.existsSync(to) && sum(fs.readFileSync(to)) === m.sha256) { say(`${m.file} already there`); continue; }
    let got = null, why = "";
    for (let k = 0; k < 4 && !got; k++) {
      try {
        let b;
        try { const r = await fetch(m.url); if (!r.ok) throw new Error("HTTP " + r.status); b = Buffer.from(await r.arrayBuffer()); }
        catch (e) { b = execFileSync("curl", ["-fsSL", "--max-time", "180", m.url], { maxBuffer: 64e6 }); }   // behind a proxy that node's fetch does not use, curl still gets through
        if (sum(b) !== m.sha256) throw new Error("the file fetched is not the one expected (sha256 " + sum(b).slice(0, 12) + "…)"); got = b;
      }
      catch (e) { why = e.message; await new Promise((r) => setTimeout(r, 1500 * 2 ** k)); }
    }
    if (!got) throw new Error(`could not fetch ${m.file} from ${m.url}: ${why}\n(the halls need it; with no network, copy the file to ${path.relative(ROOT, to)} by hand)`);
    fs.writeFileSync(to, got); say(`${m.file} fetched, ${(got.length / 1e6).toFixed(1)} MB`);
  }
}

vendor(); await models();
