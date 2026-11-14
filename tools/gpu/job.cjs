// Runs inside a Hugging Face Job that has a real graphics card: opens the temple in Chromium with the GPU,
// measures how many frames a second each quality tier really draws, and takes the pictures asked for.
//   node job.cjs <app dir> <out dir> '<json spec>'
// spec: { tour: { runs, size, q, film, filmSize }, shots: ["court@autumn-dusk@third", ...], size: [w, h], scale: 1, bench: [{ view, q, size, season, time, off }], seconds: 6 }
// `off` switches parts of the scene off (see ?off= in app/yard.js), to learn what each costs.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const [root, out, specArg = "{}"] = process.argv.slice(2);
const spec = JSON.parse(specArg.trim().startsWith("{") ? specArg : Buffer.from(specArg, "base64").toString("utf8"));   // the launcher sends it as base64: a job's variables are single lines
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".glb": "model/gltf-binary", ".ktx2": "image/ktx2", ".wasm": "application/wasm" };
const sh = (c) => { try { return execSync(c, { stdio: ["ignore", "pipe", "pipe"], timeout: 20000 }).toString().trim(); } catch (e) { return "(failed) " + String(e.stderr || e.message).slice(0, 200); } };

// Ways of asking Chromium for the graphics card, most direct first. The first that reports a real GPU is used.
const FLAGS = {
  "angle-vulkan": ["--use-angle=vulkan", "--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE", "--disable-vulkan-surface"],
  "angle-egl": ["--use-gl=angle", "--use-angle=gl-egl"],
  "egl": ["--use-gl=egl"],
  "swiftshader": ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
};
const COMMON = ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-gpu", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--autoplay-policy=no-user-gesture-required", "--enable-webgl", "--disable-gpu-driver-bug-workarounds"];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const report = { started: new Date().toISOString(), host: { gpu: sh("nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader"), cpu: sh("nproc"), egl: sh("ls /usr/share/glvnd/egl_vendor.d 2>&1"), vulkan: sh("ls /usr/share/vulkan/icd.d /etc/vulkan/icd.d 2>&1"), libs: sh("ldconfig -p | grep -i -E 'nvidia|libEGL|libvulkan' | cut -c1-90 | head -30"), dev: sh("ls /dev | grep -i -E 'nvidia|dri' ; ls /dev/dri 2>&1") }, tried: {}, bench: [], shots: [], errors: [] };
  const srv = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    if (p.endsWith("index.html")) return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><body>' + fs.readFileSync(p, "utf8"));
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => srv.listen(0, r)); const base = `http://127.0.0.1:${srv.address().port}/`;

  let browser = null, how = null;
  pick: for (const [name, flags] of Object.entries(FLAGS)) for (const channel of ["chromium", undefined]) {
    const key = name + (channel ? "+new-headless" : "+headless-shell"); let b = null;
    try {
      b = await chromium.launch({ channel, args: [...COMMON, ...flags] });
      const p = await b.newPage(); await p.goto(base + "v/build/three.module.js");   // any same-origin page will do
      const gl = await p.evaluate(() => { const c = document.createElement("canvas"), g = c.getContext("webgl2"); if (!g) return "no webgl2"; const e = g.getExtension("WEBGL_debug_renderer_info"); return String(g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER)); });
      report.tried[key] = gl; await p.close();
      if ((/NVIDIA|Tesla|GeForce|RTX|Quadro|AMD|Radeon/i.test(gl) && !/SwiftShader|llvmpipe/i.test(gl)) || name === "swiftshader") { browser = b; how = key; break pick; }
      await b.close();
    } catch (e) { report.tried[key] = "launch failed: " + String(e.message).split("\n")[0].slice(0, 160); if (b) await b.close().catch(() => {}); }
  }
  report.using = how; report.renderer = report.tried[how]; console.log("renderer:", how, "→", report.renderer);
  const save = () => fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  save();
  if (!browser) { console.log("no browser could be started"); process.exit(1); }

  const open = async (query, [w, h], scale = 1, extra = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, ...extra }), page = await ctx.newPage();
    // The hall's statue is deliberately not sent to the job, so its absence is not an error here.
    const ours = (t) => !/hall\.js|plate\.webp|\/m\/|404|Failed to load resource|Failed to fetch dynamically/.test(t);
    page.on("pageerror", (e) => ours(String(e.message)) && report.errors.push(String(e.message).slice(0, 300)));
    page.on("console", (m) => m.type() === "error" && ours(m.text()) && report.errors.push(m.text().slice(0, 300)));
    const t0 = Date.now(); await page.goto(base + "?" + query, { waitUntil: "commit", timeout: 120000 });
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    return { ctx, page, loadMs: Date.now() - t0 };
  };
  const q = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${v}`).join("&");

  // How fast does it really draw? Time runs, nothing is frozen, and the governor is held off by fixing the tier.
  for (const b of spec.bench || []) {
    const size = b.size || [1920, 1080], secs = spec.seconds || 6;
    try {
      const { ctx, page, loadMs } = await open(q({ q: b.q, show: b.view, view: b.as || "third", season: b.season, time: b.time, off: b.off }), size, b.scale || 1);
      await page.waitForTimeout(1500);
      const a = await page.evaluate(() => ({ f: window.__yard().frames, t: performance.now() })); await page.waitForTimeout(secs * 1000);
      const z = await page.evaluate(() => ({ f: window.__yard().frames, t: performance.now(), y: window.__yard(), buf: [document.getElementById("yardGl").width, document.getElementById("yardGl").height] }));
      const cost = await page.evaluate(() => (window.__cost ? window.__cost(40) : null));   // drawing alone, without the browser's presenting
      const fps = +(((z.f - a.f) * 1000) / (z.t - a.t)).toFixed(1), row = { ...b, size, fps, ms: +(1000 / Math.max(fps, 0.01)).toFixed(2), cost, loadMs, tris: z.y.tris, calls: z.y.calls, buffer: z.buf, tier: z.y.tier };
      report.bench.push(row); console.log("bench", JSON.stringify(row)); await ctx.close();
    } catch (e) { report.bench.push({ ...b, error: String(e.message).slice(0, 200) }); console.log("bench failed", b, String(e.message).slice(0, 200)); }
    save();
  }
  // The measured walk (app/src/tour.js) and a film of it: spec.tour = { runs: "120x3", size: [1920, 1080], q: "high", film: 95, filmSize: [960, 540] }.
  // The numbers and the film come from separate passes, so that recording does not slow what is being measured.
  if (spec.tour) {
    const T = spec.tour, size = T.size || [1920, 1080], query = (runs) => `tour=${runs}&enter&view=first&q=${T.q || "high"}&season=summer&time=day`;
    try {
      const { ctx, page, loadMs } = await open(query(T.runs || "120x3"), size, 1);
      await page.waitForFunction(() => window.__tour().done, null, { timeout: 900000, polling: 2000 });
      const r = await page.evaluate(() => window.__tour().result);
      r.environment = { host_gpu: report.host.gpu, browser: browser.version(), how: report.using, renderer: report.renderer, headless: true, vsync: "off (--disable-gpu-vsync --disable-frame-rate-limit)", page_load_ms: loadMs };
      fs.writeFileSync(path.join(out, "performance.json"), JSON.stringify(r, null, 1));
      fs.writeFileSync(path.join(out, "frame-times.csv"), "run,frame,ms\n" + r.runs.map((x, i) => x.frame_ms.map((ms, k) => `${i + 1},${k},${ms}`).join("\n")).join("\n") + "\n");
      report.tour = r.runs.map(({ frame_ms, ...x }) => x); console.log("tour", JSON.stringify(report.tour)); await ctx.close();
    } catch (e) { report.tour = { error: String(e.message).slice(0, 300) }; console.log("tour failed", report.tour.error); }
    save();
    if (T.film) try {
      const fs2 = T.filmSize || [960, 540], { ctx, page } = await open(query(`${T.film}x1`), fs2, 1, { recordVideo: { dir: out, size: { width: fs2[0], height: fs2[1] } } });
      await page.waitForFunction(() => window.__tour().done, null, { timeout: 600000, polling: 2000 });
      const v = page.video(); await ctx.close(); const from = await v.path(); fs.renameSync(from, path.join(out, "walkthrough.webm")); report.film = { file: "walkthrough.webm", seconds: T.film + 10, size: fs2 }; console.log("film", fs.statSync(path.join(out, "walkthrough.webm")).size);
    } catch (e) { report.film = { error: String(e.message).slice(0, 300) }; console.log("film failed", report.film.error); }
    fs.writeFileSync(path.join(out, "console.txt"), (report.errors.length ? report.errors.join("\n") : "no page errors, console errors or failed requests during the walk") + "\n");
    save();
  }
  // The pictures: a named view, optionally a season and hour and a point of view, drawn large.
  for (const name of spec.shots || []) {
    const [view, when = "", as = ""] = name.split("@"), [season, time] = when.split("-"), size = spec.size || [1920, 1080];
    try {
      const { ctx, page } = await open(q({ shot: 1, q: spec.q || "high", show: view, season, time, view: as }), size, spec.scale || 1);
      await page.waitForTimeout(800);
      const file = name.replace(/@/g, "_") + ".png"; await page.screenshot({ path: path.join(out, file), timeout: 120000 });
      const y = await page.evaluate(() => window.__yard()); report.shots.push({ name, file, tris: y.tris, calls: y.calls }); console.log("shot", file); await ctx.close();
    } catch (e) { report.shots.push({ name, error: String(e.message).slice(0, 200) }); console.log("shot failed", name, String(e.message).slice(0, 200)); }
    save();
  }
  report.finished = new Date().toISOString(); report.errors = [...new Set(report.errors)].slice(0, 20); save();
  await browser.close(); srv.close(); console.log("done:", report.bench.length, "measurements,", report.shots.length, "pictures,", report.errors.length, "page errors");
})().catch((e) => { console.error(e); process.exit(1); });
