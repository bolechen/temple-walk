// The back of a face drawn as dark cloth, tried on the white-box hall's page without touching it (issue #578, the cheap way).
//
//   node tools/t05-statue/closed/backside.cjs <spec.json>
//
// spec: { "out": "tools/out/t05/578-back", "size": [1280, 720],
//         "variants": [ { "name": "f1", "url": "tools/out/t05/tripo-370/sakyamuni-f1.60000.glb", "colour": "sakyamuni-f1", "back": 0 },
//                       { "name": "v81", "url": "...", "colour": "sakyamuni-v2", "back": 0 },
//                       { "name": "v81-back", "url": "...", "colour": "sakyamuni-v2", "back": 0.42 } ],
//         "statue": { x, h, base, plinth, turn, headAt, maxW, halo, paint },   (as tools/t05-hall.cjs's spec)
//         "shots": [ { "name": "aisle", "shoot": { ... } } ] }
// `back` > 0 makes each painted material of the figure draw both sides (three turns the normal over for a back, as it does for
// any DoubleSide material) and darkens the light a back face gives back by that factor: what a line of sight sees through an
// opening is then the inside of cloth, not a bright shard. The stage (tools/t05-hall/stage.js, paint.js) is not edited: the
// change is made on its page after the figure is stood, by wrapping each material's own onBeforeCompile.
// Pictures go to <out>/<variant>-<shot>.png.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const here = __dirname, root = path.join(here, "..", "..", "..");
(async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const out = path.resolve(root, spec.out); fs.mkdirSync(out, { recursive: true });
  const { build } = await import("vite");
  const stageOut = path.join(root, "tools", "out", "t05-hall-page-back");
  await build({ configFile: false, logLevel: "error", root: path.join(root, "tools", "t05-hall"), base: "./", publicDir: false, build: { outDir: stageOut, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 } });
  const files = spec.variants.map((v) => path.resolve(root, v.url));
  const { serve } = require(path.join(root, "tools", "site.cjs"));
  const srv = await serve(stageOut, { api: false, handler: (req, res, rel) => { const m = /^\/s\/(\d+)\.glb$/.exec(rel); if (!m) return false; const p = files[+m[1]]; if (!p || !fs.existsSync(p)) { res.writeHead(404); res.end(); return true; } res.writeHead(200, { "content-type": "model/gltf-binary" }); fs.createReadStream(p).pipe(res); return true; } });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const [W, H] = spec.size || [1280, 720]; const errs = [];
  for (let i = 0; i < spec.variants.length; i++) {
    const v = spec.variants[i];
    const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
    await p.goto(`http://127.0.0.1:${srv.address().port}/?w=${W}&h=${H}&ao=1`);
    await p.waitForFunction(() => window.hall?.ready, null, { timeout: 120000 });
    await p.evaluate((l) => window.hall.setStatues(l), [{ ...spec.statue, colour: v.colour, url: `/s/${i}.glb` }]);
    if (v.back > 0) {
      const n = await p.evaluate((k) => {
        let count = 0;
        window.hall.scene.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          for (const m of [].concat(o.material)) {
            if (m.userData.backDark) continue; m.userData.backDark = k; m.side = 2;   // THREE.DoubleSide
            const prev = m.onBeforeCompile; const prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => "";
            m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", `if (!gl_FrontFacing) outgoingLight *= ${k.toFixed(3)};\n#include <opaque_fragment>`); };
            m.customProgramCacheKey = () => prevKey() + "|back" + k; m.needsUpdate = true; count++;
          }
        }); return count;
      }, v.back);
      console.log(v.name, "materials made double-sided:", n);
    }
    for (const s of spec.shots) {
      await p.evaluate((sh) => window.hall.shoot(sh), s.shoot);
      await p.locator("canvas").screenshot({ path: path.join(out, `${v.name}-${s.name}.png`) });
    }
    await p.close();
  }
  await browser.close(); srv.close();
  if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
