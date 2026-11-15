// Renders views inside the halls, which the named views of tools/shots.js cannot reach: each job names a hall, a pose
// and optionally a view and extra address parameters, and the picture's mean colour and the frame's load are printed.
// usage: node tools/inside.cjs <out dir> '[{"hall":"main","name":"caisson","abs":[120,-2,0,1.05]}, ...]'
//   abs = [x, z, yaw, pitch] in the room's own place (rooms stand sixty metres apart in the order of site.halls);
//   view = "first" | "third"; qs = more address parameters, e.g. "time=night".
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app"), out = process.argv[2];
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), p = path.join(root, rel);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  if (p.endsWith("index.html")) return res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0}</style><body>' + fs.readFileSync(p, "utf8"));
  fs.createReadStream(p).pipe(res);
});
const jobs = JSON.parse(process.argv[3]);   // [{hall, name, rel:[dx,dz], yaw, pitch, view}]
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  let cur = null;
  for (const j of jobs) {
    if (cur !== j.hall + j.view + (j.qs || "")) {
      await p.goto(`${base}?shot=1&q=high&in=${j.hall}&view=${j.view || "first"}${j.qs ? "&" + j.qs : ""}`, { waitUntil: "commit", timeout: 180000 });
      await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
      await p.waitForTimeout(4000); cur = j.hall + j.view + (j.qs || "");
    }
    const y0 = await p.evaluate(() => window.__yard());
    if (j.abs) await p.evaluate((a) => window.__pose(...a), j.abs);
    await p.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n > 6 ? r() : requestAnimationFrame(f)); f(); }));
    await p.screenshot({ path: path.join(out, j.name + ".png") });
    console.log(j.name, JSON.stringify(await p.evaluate(() => { const q = window.__probe(); return q.mean || q.color || q; })), JSON.stringify(await p.evaluate(() => { const y = window.__yard(); return [y.x, y.z, y.yaw, y.pitch, y.tris, y.calls]; })));
  }
  console.log("errors", errs.slice(0, 5)); await b.close(); srv.close();
})();
