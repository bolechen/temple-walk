// The leaves coming down with the gusts and lying where they fell (#267), filmed at the page's own time: the picture is
// held (`?shot`) and the falling is run on a frame's worth at a time by `__litter(secs)`, so a slow software browser
// films the minute as it would pass, frame for frame.
// usage: node tools/litter-film.cjs [--cam=x,z,yaw,pitch] [--when=autumn-day] [--from=40] [--secs=60] [--fps=8] [--size=WxH] [--out=tools/out/litter/film]
//   → <out>/f00000.png … and <out>.mp4 (ffmpeg), and <out>.json: the breeze and what lay on the ground at each second
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = require("./site.cjs").site();
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=")[1];
const cam = arg("cam", "-7.5,33,-0.38,-0.32"), [season, time] = arg("when", "autumn-day").split("-"), from = Number(arg("from", "40")), secs = Number(arg("secs", "60")), fps = Number(arg("fps", "8"));
const [W, H] = arg("size", "960x540").split("x").map(Number), out = path.resolve(arg("out", path.join(__dirname, "out", "litter", "film")));
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" }), errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?shot=1&q=high&cam=${cam}&season=${season}&time=${time}&off=doorway`, { waitUntil: "commit", timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
  await p.evaluate((s) => window.__litter(s), from);
  const log = [], { windAt } = await import(require("url").pathToFileURL(path.join(__dirname, "..", "app", "src", "wind.js")).href);
  for (let i = 0; i < secs * fps; i++) {
    const r = await p.evaluate((dt) => window.__litter(dt), 1 / fps);
    await p.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    await p.screenshot({ path: path.join(out, `f${String(i).padStart(5, "0")}.png`) });
    if (i % fps === 0) { const t = from + i / fps; log.push({ t, wind: +windAt(1.05, t).toFixed(2), kept: r.kept, landed: r.landed }); console.log(JSON.stringify(log.at(-1))); }
  }
  fs.writeFileSync(out + ".json", JSON.stringify(log, null, 1));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(out, "f%05d.png"), "-vf", "minterpolate=fps=24:mi_mode=blend", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", out + ".mp4"]);
  console.log("film:", out + ".mp4", "errors:", [...new Set(errs)].slice(0, 4));
  await b.close(); srv.close();
})();
