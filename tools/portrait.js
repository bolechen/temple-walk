// Close views of the novice from the front, the side and behind, standing and with palms together.
// usage: node tools/portrait.js [season-time] [bind]   → tools/out/portrait.png
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = require("./site.cjs").site(), out = path.join(__dirname, "out");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".glb": "model/gltf-binary", ".css": "text/css", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}   // a bad escape, or a path that climbs out of the app, is not served
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  if (p.endsWith("index.html")) return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><body>' + fs.readFileSync(p, "utf8"));
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const [season = "summer", time = "day"] = (process.argv[2] || "").split("-");
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 760 }, deviceScaleFactor: 1 });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?shot=1&q=high&view=third&season=${season}&time=${time}&cam=0,24,0,-0.05`, { waitUntil: "commit", timeout: 180000 });   // the page builds the whole temple before it reports itself loaded
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
  await p.waitForFunction(() => window.__yard().dressed === true, null, { timeout: 60000 }).catch(() => console.log("the sculpted body did not arrive; he is shown as built in code"));   // his body is fetched after the first frames
  const shots = [];
  // `bind` as a second argument shows him front, side and back in the A-pose he is bound in, to set beside the drawing.
  const poses = process.argv[3] === "bind" ? [[Math.PI, "bind"], [Math.PI * 1.5, "bind"], [0, "bind"]] : [[Math.PI, false], [Math.PI + 0.9, false], [0, false], [Math.PI, true], [Math.PI - 0.7, true]];
  await p.evaluate(() => window.__photo(true, { dist: 4.2, lens: 30, aspect: "tall", monk: true })); await p.waitForTimeout(3000);   // let the photograph's eye settle before the first view
  for (const [yaw, pray] of poses) {
    await p.evaluate(([y, pr]) => { window.__photo(true, { dist: 4.2, lens: 30, pray: pr, aspect: "tall", monk: true }); window.__pose(0, 24, y, -0.1); document.body.classList.add("bare"); document.getElementById("frame").style.display = "none"; document.getElementById("photoBar").style.display = "none"; document.getElementById("photoClose").style.display = "none"; }, [yaw, pray]);
    await p.waitForTimeout(pray === true ? 4500 : 2500);
    shots.push(await p.screenshot({ clip: { x: pray === "bind" ? 525 : 600, y: 60, width: pray === "bind" ? 450 : 300, height: 640 }, timeout: 240000 }));
  }
  // Lay the five views side by side.
  await p.setContent(`<body style="margin:0;display:flex;background:#111">${shots.map((s) => `<img src="data:image/png;base64,${s.toString("base64")}">`).join("")}</body>`);
  await p.setViewportSize({ width: (process.argv[3] === "bind" ? 450 : 300) * shots.length, height: 640 }); await p.screenshot({ path: path.join(out, "portrait.png") });
  console.log("errors:", errs.slice(0, 5)); await b.close(); srv.close();
})();
