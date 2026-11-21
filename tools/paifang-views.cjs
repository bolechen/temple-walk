// The archway's three drawings and three looks (issue #433; AGENTS.md「改形体的，从几个方向看」), drawn with the real materials
// on a bare stage in software Chromium: front, side and top as flat drawings, then from three-quarters, from the way in
// (the target picture's place, refs/t05-concept-2026-11-20/03-axis-from-inner-gate.webp), from under the eaves, and from near.
//   node tools/paifang-views.cjs [outdir]        → <outdir>/paifang-<view>.png and census.json (tools/out/paifang by default)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const here = __dirname, root = path.join(here, ".."), out = path.resolve(process.argv[2] || path.join(here, "out", "paifang"));
(async () => {
  const { build } = await import("vite"); const stageOut = path.join(here, "out", "paifang-stage");
  await build({ configFile: false, logLevel: "error", root: path.join(here, "paifang-stage"), base: "./", publicDir: false, build: { outDir: stageOut, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 } });
  fs.cpSync(path.join(root, "app", "shared", "textures"), path.join(stageOut, "shared", "textures"), { recursive: true });
  const { serve } = require("./site.cjs"); const srv = await serve(stageOut, { api: false }); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } }); const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
  await p.goto(srv.base); await p.waitForFunction(() => window.stage?.ready, null, { timeout: 120000 });
  // the scanned surfaces arrive and replace their mean colours
  await p.waitForTimeout(1500);
  const names = await p.evaluate(() => window.stage.views);
  for (const n of names) { const png = await p.evaluate((n) => window.stage.shoot(n), n); fs.writeFileSync(path.join(out, `paifang-${n}.png`), Buffer.from(png.split(",")[1], "base64")); }
  const census = await p.evaluate(() => ({ census: window.stage.census, size: window.stage.size }));
  fs.writeFileSync(path.join(out, "census.json"), JSON.stringify(census, null, 1) + "\n");
  console.log("wrote", names.length, "views to", out, JSON.stringify(census), errs.length ? "errors: " + errs.join(" | ") : "");
  await b.close(); srv.close(); if (errs.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
