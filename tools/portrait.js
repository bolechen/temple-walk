// Close views of the novice from the front, the side and behind, standing and with palms together (or, with `bind`,
// in the A-pose he is bound in), found in the picture wherever the photograph's eye has him.
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
  const p = await b.newPage({ viewport: { width: 1500, height: 760 }, deviceScaleFactor: 2 });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?shot=1&q=high&view=third&season=${season}&time=${time}&cam=0,24,0,-0.05`, { waitUntil: "commit", timeout: 180000 });   // the page builds the whole temple before it reports itself loaded
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
  // `bind` as a second argument shows him front, side and back in the A-pose he is bound in, to set beside the drawing.
  const bind = process.argv[3] === "bind", W = bind ? 225 : 150, H = 320;   // each view, in page pixels (drawn at twice that)
  const poses = bind ? [[Math.PI, "bind"], [Math.PI * 1.5, "bind"], [0, "bind"]] : [[Math.PI, false], [Math.PI + 0.9, false], [0, false], [Math.PI, true], [Math.PI - 0.7, true]];
  // The photograph keeps the eye where the walk left it, a few steps behind him and to one side: turn it round him
  // with the view, zoom until he fills the panel (no further than keeps him in the picture), and cut the panel round him.
  const photo = (yaw, pray, zoom) => p.evaluate(([y, pr, z]) => {
    window.__pose(0, 24, y, -0.1); window.__photo(true, { aspect: "screen", monk: true, pray: pr, zoom: z });
    document.body.classList.add("bare"); for (const id of ["frame", "photoBar", "photoClose", "photoSettings"]) document.getElementById(id).style.display = "none";
  }, [yaw, pray, zoom]);
  const box = () => p.evaluate(() => window.__probe().monkBox);
  const inView = (b) => b && b[0] > 4 && b[1] > 4 && b[0] + b[2] < 1496 && b[1] + b[3] < 756;
  const shots = [];
  for (const [yaw, pray] of poses) {
    await photo(yaw, pray, 1); await p.waitForTimeout(shots.length ? (pray === true ? 4500 : 2500) : 5000);   // the first also waits for the eye to settle
    let b = await box(); if (!b) throw new Error("the novice is not in the picture");
    let zoom = Math.min(6, (H * 0.86) / b[3]);
    for (;;) { await photo(yaw, pray, zoom); await p.waitForTimeout(800); const z = await box(); if (inView(z) || zoom <= 1) { b = z || b; break; } zoom = Math.max(1, zoom * 0.85); }
    const x = Math.min(Math.max(0, b[0] + b[2] / 2 - W / 2), 1500 - W), y = Math.min(Math.max(0, b[1] + b[3] / 2 - H / 2), 760 - H);
    shots.push(await p.screenshot({ clip: { x, y, width: W, height: H }, timeout: 240000 }));
    console.log(`view ${shots.length}: zoom ${zoom.toFixed(2)}, he stands ${b[3].toFixed(0)} px tall in a ${H} px panel`);
  }
  // Lay the views side by side.
  await p.setContent(`<body style="margin:0;display:flex;background:#111">${shots.map((s) => `<img style="width:${W}px;height:${H}px" src="data:image/png;base64,${s.toString("base64")}">`).join("")}</body>`);
  await p.setViewportSize({ width: W * shots.length, height: H }); await p.screenshot({ path: path.join(out, "portrait.png") });
  console.log("errors:", errs.slice(0, 5)); await b.close(); srv.close();
})();
