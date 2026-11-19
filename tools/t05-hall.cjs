// Pictures and a film of the white-box hall of seven Buddhas (issue #280), with any statues stood on its altar.
//
//   node tools/t05-hall.cjs <spec.json>
//
// The spec says which statues stand where and what to draw:
//   { "out": "tools/out/t05", "size": [1600, 900], "ao": true,
//     "statues": [ { "url": "<path to .glb>", "x": 0, "h": 9.0, "turn": 0, "halo": { "rings": 3, "tips": 0 } }, … ],
//     "shots": [ { "name": "door-summer", "view": "door", "mood": "summer", "paint": true }, { "name": "a", "ortho": { "i": 0, "side": "front" } }, … ],
//     "film": { "name": "walk-winter", "mood": "winter", "fps": 24, "size": [1280, 720] },
//     "cost": 60 }
// Statue paths are files on this machine; the page fetches them as /s/<n>.glb. Views and moods are those in
// tools/t05-hall/stage.js (VIEWS, MOODS). Each picture's triangles and draw calls go to <out>/report.json, with the
// browser's renderer string, so a software picture is never mistaken for a GPU measurement. The film is drawn frame by
// frame (deterministic, any frame rate) and encoded with ffmpeg. The page is bundled with the site's own three.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const here = __dirname, root = path.join(here, "..");

(async () => {
  const specPath = process.argv[2]; if (!specPath) { console.error("usage: node tools/t05-hall.cjs <spec.json>"); process.exit(2); }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const out = path.resolve(root, spec.out || "tools/out/t05"); fs.mkdirSync(out, { recursive: true });
  const { build } = await import("vite");
  const stageOut = path.join(here, "out", "t05-hall-page");
  await build({ configFile: false, logLevel: "error", root: path.join(here, "t05-hall"), base: "./", publicDir: false, build: { outDir: stageOut, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 } });
  const files = (spec.statues || []).map((s) => path.resolve(root, s.url));
  const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary" };
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]), m = /^\/s\/(\d+)\.glb$/.exec(rel);
    const p = m ? files[+m[1]] : path.join(stageOut, path.posix.normalize("/" + (rel === "/" ? "index.html" : rel)));
    if (!p || (!m && !p.startsWith(stageOut)) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const gpu = process.env.T05_GPU === "1";
  const args = gpu ? ["--enable-gpu", "--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"] : ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  const browser = await chromium.launch({ args });
  const report = { spec: path.relative(root, specPath), shots: [], film: null, cost: null, statues: [] };
  const errs = [];
  async function page(w, h) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
    await p.goto(`http://127.0.0.1:${srv.address().port}/?w=${w}&h=${h}&ao=${spec.ao === false ? 0 : 1}`);
    await p.waitForFunction(() => window.hall?.ready, null, { timeout: 120000 });
    const list = (spec.statues || []).map((s, i) => ({ ...s, url: `/s/${i}.glb` }));
    const st = await p.evaluate((l) => window.hall.setStatues(l), list);
    report.statues = st.map((s, i) => ({ file: path.relative(root, files[i]), tris: s.tris }));
    report.renderer = await p.evaluate(() => window.hall.info());
    return p;
  }
  const [W, H] = spec.size || [1600, 900];
  if (spec.shots?.length) {
    const p = await page(W, H);
    for (const s of spec.shots) {
      const t0 = Date.now();
      const r = s.ortho ? await p.evaluate(([o, paint]) => { if (paint !== undefined) window.hall.paint(paint); window.hall.ortho(o.i ?? 0, o.side || "front", o); return {}; }, [s.ortho, s.paint])
        : await p.evaluate(({ v, m, over, paint }) => { window.hall.setMood(m); if (paint !== undefined) window.hall.paint(paint); window.hall.view(v, over || {}); const r = window.hall.stats(); window.hall.render(); return r; }, { v: s.view, m: s.mood || "summer", over: s.over, paint: s.paint });
      const file = path.join(out, `${s.name}.png`); await p.locator("canvas").screenshot({ path: file });
      report.shots.push({ ...s, file: path.relative(root, file), ...r, ms: Date.now() - t0 }); console.log(`${s.name}: ${r.tris} tris, ${r.calls} calls, ${Date.now() - t0} ms`);
    }
    if (spec.cost) { report.cost = { view: spec.costView || "door3", ms: await p.evaluate(([n, v]) => { window.hall.view(v); return window.hall.cost(n); }, [spec.cost, spec.costView || "door3"]) }; console.log("cost", report.cost); }
    await p.close();
  }
  if (spec.film) {
    const [fw, fh] = spec.film.size || [1280, 720], fps = spec.film.fps || 24, dir = path.join(out, `${spec.film.name}-frames`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const p = await page(fw, fh); await p.evaluate((m) => window.hall.setMood(m), spec.film.mood || "winter");
    const dur = await p.evaluate(() => window.hall.walk(0)); const n = Math.round(Math.min(dur, spec.film.secs || 20) * fps);
    for (let i = 0; i < n; i++) {
      await p.evaluate((t) => { window.hall.walk(t); window.hall.render(); }, i / fps);
      await p.locator("canvas").screenshot({ path: path.join(dir, `${String(i).padStart(4, "0")}.png`) });
      if (i % 48 === 0) console.log(`film ${i}/${n}`);
    }
    const mp4 = path.join(out, `${spec.film.name}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", mp4]);
    report.film = { file: path.relative(root, mp4), frames: n, fps, secs: n / fps, size: [fw, fh] }; await p.close();
    if (!spec.film.keepFrames) fs.rmSync(dir, { recursive: true, force: true });
  }
  report.errors = errs; fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close(); srv.close();
  if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
