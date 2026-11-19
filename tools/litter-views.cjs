// What the ground keeps (#267, litter.js): one place drawn as he arrives and again after the leaves have come down
// for a while, the clock run on by the page's own hook (`__litter(secs)`), not waited out.
// usage: node tools/litter-views.cjs [--cam=x,z,yaw,pitch] [--when=autumn-day] [--at=0,60,180] [--size=WxH] [--q=high] [--tag=]
//   → tools/out/litter/<tag><season>-<hour>-<secs>.png, and what the record held at each (kept, heap, landed, slid, lifted…)
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = require("./site.cjs").site(), out = path.join(__dirname, "out", "litter");
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=")[1];
const cam = arg("cam", "-7.5,33,-0.6,-0.32"), [season, time] = arg("when", "autumn-day").split("-"), at = arg("at", "0,60,180").split(",").map(Number);
const [W, H] = arg("size", "960x540").split("x").map(Number), q = arg("q", "high"), tag = arg("tag", "");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" }), errs = [];
  p.on("pageerror", (e) => errs.push(e.stack ? e.stack.slice(0, 500) : e.message));
  p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 400)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?shot=1&q=${q}&cam=${cam}&season=${season}&time=${time}&off=doorway`, { waitUntil: "commit", timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
  let done = 0; const rows = [];
  for (const s of at) {
    const r = await p.evaluate(([n]) => window.__litter(n), [s - done]); done = s;
    await p.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    await p.waitForTimeout(800);
    const file = path.join(out, `${tag}${season}-${time}-${s}.png`); await p.screenshot({ path: file });
    rows.push({ secs: s, ...r }); console.log(path.relative(process.cwd(), file), JSON.stringify(r));
  }
  fs.writeFileSync(path.join(out, `${tag}${season}-${time}.json`), JSON.stringify(rows, null, 1));
  console.log("errors:", [...new Set(errs)].slice(0, 6));
  await b.close(); srv.close();
})();
