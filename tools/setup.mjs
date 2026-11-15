// What `pnpm install` leaves ready besides node_modules: the parts of the page that are not kept in git because
// they can be had from where they come from.
//
//     node tools/setup.mjs            (run by pnpm after an install; safe to run again)
//     node tools/setup.mjs --force    (fetch and copy everything afresh)
//
// 1. The Basis transcoder. three.js itself is imported from node_modules and bundled by Vite; only the transcoder,
//    which a worker fetches by name, is copied out of the installed package into app/vendor/basis/.
// 2. The statue and its pedestal for the halls of level T00 (app/shared/models/). These ARE kept in git, as
//    published (meshopt and Basis packed, 3.9 MB): the CDN they come from (如是我闻 /zen) turns GitHub's runners
//    away with a 403, so a publication cannot depend on fetching them. Here they are only checked against the
//    hashes below, and fetched if someone has removed them.
import fs from "node:fs"; import { execFileSync } from "node:child_process"; import path from "node:path"; import crypto from "node:crypto"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), FORCE = process.argv.includes("--force");
const say = (...a) => console.log("setup:", ...a);

// ---- the Basis transcoder ----
// The one part of three.js the page fetches by name instead of importing: KTX2Loader starts it in a worker.
function vendor() {
  const require = createRequire(import.meta.url); let pkg;
  try { pkg = path.join(path.dirname(require.resolve("three")), ".."); } catch { throw new Error("three is not installed: run `pnpm install`"); }   // its package.json is not exported; its entry point is build/three.cjs
  const version = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8")).version, out = path.join(ROOT, "app/vendor/basis"), stamp = path.join(out, "VERSION"), files = ["basis_transcoder.js", "basis_transcoder.wasm"];
  if (!FORCE && fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8").trim() === version && files.every((f) => fs.existsSync(path.join(out, f)))) return say(`the Basis transcoder of three ${version} is already in app/vendor/basis`);
  fs.rmSync(path.join(ROOT, "app/vendor"), { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(pkg, "examples/jsm/libs/basis", f), path.join(out, f));
  fs.copyFileSync(path.join(pkg, "LICENSE"), path.join(out, "LICENSE")); fs.writeFileSync(stamp, version + "\n");
  say(`the Basis transcoder of three ${version} copied to app/vendor/basis`);
}

// ---- the statues of level T00 ----
const MODELS = [
  { file: "buddha.glb", url: "https://static.rushiwowen.co/models/zen-v2/buddha-2ec9117a3416.glb", sha256: "2ec9117a34166e952a1af5a4be25ef1a86248bb9a2374fccf1ec7b7ecb278858" },
  { file: "pedestal.glb", url: "https://static.rushiwowen.co/models/zen-v2/pedestal-49ccf1d43981.glb", sha256: "49ccf1d439810d3ba6c57cd2ad991fb95337bf859de3e9961a862e94cba80619" },
];
async function models() {
  const out = path.join(ROOT, "app/shared/models"); fs.mkdirSync(out, { recursive: true });
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
