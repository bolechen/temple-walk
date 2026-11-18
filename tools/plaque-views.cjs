// Close views of the name boards for comparing two builds of the site (#192): one page load, then the eye stood at each place
// by __pose, so a software renderer boots once. usage: node tools/plaque-views.cjs <out dir> [q=medium]
// The poses are the named views `plaque` (the main hall's board from the foot of its stair), `cam03` (the screen wall and the gate
// from the forecourt), `gate` (the gate's two boards from behind the screen wall) and `teahouse`.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const out = process.argv[2], q = (process.argv[3] || "").startsWith("--") ? "medium" : process.argv[3] || "medium", flag = (f) => process.argv.indexOf(f), root = require("./site.cjs").site();
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), p = path.join(root, rel);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
const POSES = Object.entries({ plaque: [0, 6, 0, 0.5], screen: [0, 63.8, 0, 0.14], gate: [0, 49.5, 0, 0.2], teahouse: [-5, 16, -1.35, 0.1] }).map(([name, pose]) => ({ name, pose }));
const jobs = flag("--poses") > 0 ? JSON.parse(fs.readFileSync(process.argv[flag("--poses") + 1], "utf8")) : POSES;
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: "zh-CN" });
  await p.goto(`http://127.0.0.1:${srv.address().port}/?shot=1&q=${q}&view=first&season=summer&time=day&show=plaque`, { waitUntil: "commit", timeout: 600000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 900000 });
  const take = async (j) => {
    await p.evaluate((j) => { if (j.look) window.__look(j.look.at, j.look.to); else { window.__look(); window.__pose(...j.pose); } }, j); await p.waitForTimeout(2500);
    await p.evaluate(() => window.__probe()); await p.screenshot({ path: path.join(out, j.name + ".png"), timeout: 240000 }); console.log(j.name);
  };
  if (flag("--watch") > 0) {
    const dir = path.join(out, "jobs"); fs.mkdirSync(dir, { recursive: true });
    while (!fs.existsSync(path.join(dir, "stop"))) {
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) { const full = path.join(dir, f); const list = JSON.parse(fs.readFileSync(full, "utf8")); fs.renameSync(full, full + ".done"); for (const j of list) await take(j); }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } else for (const j of jobs) await take(j);
  await b.close(); srv.close();
})();
