// Walk-through test: yard -> tap hall -> walk in -> interior -> offer incense -> leave.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp" };
const seen = new Set();
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), p = path.join(root, rel);
  if (!p.startsWith(root) || !fs.existsSync(p)) { console.log("404", req.url); res.writeHead(404); return res.end(); }
  seen.add(rel.slice(1));
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  if (p.endsWith("index.html")) return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}</style><body>' + fs.readFileSync(p, "utf8"));
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, r));
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.stack ? e.stack.slice(0, 400) : e.message));
  p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fast=1&cam=2.5,9,-0.15,0.05`);
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 120000 });
  await p.waitForTimeout(1500); await p.screenshot({ path: "walk-1-yard.png" });
  await p.mouse.click(210, 230);                                    // tap the hall
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) { if (!(await p.evaluate(() => document.getElementById('hallView').hidden))) break; await p.waitForTimeout(12000); console.log(JSON.stringify(await p.evaluate(() => window.__yard()))); }
  await p.waitForFunction(() => !document.getElementById("hallView").hidden, null, { timeout: 60000 }).catch((e) => errs.push("never entered: " + String(e).slice(0, 120)));
  console.log("entered after", Math.round((Date.now() - t0) / 1000), "s");
  await p.waitForTimeout(5000); await p.screenshot({ path: "walk-2-hall.png" });
  if (await p.isVisible("#offer")) { await p.click("#offer"); await p.waitForTimeout(6000); } else errs.push("offer hidden");
  if (await p.isVisible("#leave")) await p.click("#leave"); else errs.push("leave hidden");
  await p.waitForFunction(() => !document.getElementById("yardView").hidden, null, { timeout: 30000 }).catch((e) => errs.push("never left"));
  await p.waitForTimeout(4000); await p.screenshot({ path: "walk-3-out.png" });
  console.log("errors:", errs);
  fs.writeFileSync(path.join(__dirname, "served-files.json"), JSON.stringify([...seen].filter((f) => f !== "index.html").sort()));
  await b.close(); srv.close();
})();
