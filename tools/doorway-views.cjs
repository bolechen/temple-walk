// The room seen through a hall's open door from outside (#218): from 12 m, 6 m and 2 m before the door, square on and
// 30° to either side, drawn with the room painted in the doorway and (`--before`) without, into tools/out/doorway/.
// usage: node tools/doorway-views.cjs [hall=main] [--before] [--dists=12,6,2] [--angles=-30,0,30] [--mood=summer-day] [--size=640x400]
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = require("./site.cjs").site(), out = path.join(__dirname, "out", "doorway");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const base = `http://127.0.0.1:${srv.address().port}/`, hallId = process.argv.slice(2).find((a) => !a.startsWith("--")) || "main", before = process.argv.includes("--before");
  const dists = arg("dists", "12,6,2").split(",").map(Number), angles = arg("angles", "-30,0,30").split(",").map(Number), [season, time] = arg("mood", "summer-day").split("-");
  const [vw, vh] = arg("size", "640x400").split("x").map(Number);
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, locale: "zh-CN" }), errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
  await p.goto(`${base}?shot=1&q=${arg("q", "high")}&view=${arg("view", "first")}&season=${season}&time=${time}` + (before ? "&off=doorway" : ""), { waitUntil: "commit", timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
  if (!before) await p.evaluate(() => window.__doorways(true));   // every room taken now, not on the way there
  const door = await p.evaluate((id) => { const h = window.__halls.find((x) => x.id === id); return { out: h.out, yaw: h.outYaw }; }, hallId);
  const fx = -Math.sin(door.yaw), fz = Math.cos(door.yaw);   // from the door outward is the way he faces coming out
  const ox = door.out[0] + Math.sin(door.yaw) * 0.66, oz = door.out[1] - Math.cos(door.yaw) * 0.66;   // the door's own plane
  const shots = [];
  for (const d of dists) for (const a of angles) {
    const A = (a * Math.PI) / 180, c = Math.cos(A), s = Math.sin(A);
    const dx = -(fx * c - fz * s), dz = -(fz * c + fx * s);   // outward, turned by a
    const x = ox + dx * d, z = oz + dz * d, yaw = Math.atan2(-dx, dz);
    await p.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.04), [x, z, yaw]);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const name = `${hallId}-${d}m-${a}${before ? "-before" : ""}${arg("tag", "")}.png`; await p.screenshot({ path: path.join(out, name) }); shots.push(name);
  }
  console.log(JSON.stringify({ shots, doorways: await p.evaluate(() => window.__doorways?.()), errors: [...new Set(errs)].slice(0, 6) }));
  await b.close(); srv.close();
})();
