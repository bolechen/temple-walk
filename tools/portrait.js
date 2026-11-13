// Close views of the novice from the front, the side and behind, standing and with palms together.
// usage: node tools/portrait.js [season-time]   → tools/out/portrait.png
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app"), out = path.join(__dirname, "out");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".glb": "model/gltf-binary" };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  if (p.endsWith("index.html")) return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><body>' + fs.readFileSync(p, "utf8"));
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, r)); fs.mkdirSync(out, { recursive: true });
  const [season = "summer", time = "day"] = (process.argv[2] || "").split("-");
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 760 }, deviceScaleFactor: 1 });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?shot=1&q=high&view=third&season=${season}&time=${time}&cam=0,24,0,-0.05`);
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
  const shots = [];
  for (const [yaw, pray] of [[Math.PI, false], [Math.PI + 0.9, false], [0, false], [Math.PI, true], [Math.PI - 0.7, true]]) {
    await p.evaluate(([y, pr]) => { window.__photo(true, { dist: 4.2, lens: 30, pray: pr, aspect: "tall" }); window.__pose(0, 24, y, -0.1); document.body.classList.add("bare"); document.getElementById("frame").style.display = "none"; document.getElementById("photoBar").style.display = "none"; document.getElementById("photoClose").style.display = "none"; }, [yaw, pray]);
    await p.waitForTimeout(pray ? 4500 : 2500);
    shots.push(await p.screenshot({ clip: { x: 600, y: 60, width: 300, height: 640 }, timeout: 240000 }));
  }
  // Lay the five views side by side.
  await p.setContent(`<body style="margin:0;display:flex;background:#111">${shots.map((s) => `<img src="data:image/png;base64,${s.toString("base64")}">`).join("")}</body>`);
  await p.setViewportSize({ width: 1500, height: 640 }); await p.screenshot({ path: path.join(out, "portrait.png") });
  console.log("errors:", errs.slice(0, 5)); await b.close(); srv.close();
})();
