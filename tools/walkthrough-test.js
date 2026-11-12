// Walks the whole visit and fails loudly if any step does not happen:
//   A. from the foot of the approach stair: round the screen wall, through the gate, across the court, in at the door
//   B. inside: offer incense, leave
//   C. from the court at real walking speed: tap the hall, arrive at the door, enter
//   D. round the hall, up both terraces and the stair between the tea rows, to the summit
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app"), out = path.join(__dirname, "out");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp" };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!p.startsWith(root) || !fs.existsSync(p)) { console.log("404", req.url); res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  if (p.endsWith("index.html")) return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}</style><body>' + fs.readFileSync(p, "utf8"));
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, r));
  fs.mkdirSync(out, { recursive: true });
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 1 });
  const errs = [], fail = (m) => { errs.push(m); console.log("FAIL", m); };
  p.on("pageerror", (e) => errs.push(e.stack ? e.stack.slice(0, 400) : e.message));
  p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 300)));
  const ready = () => p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
  const state = () => p.evaluate(() => window.__yard());
  const inHall = () => p.evaluate(() => !document.getElementById("hallView").hidden);
  const until = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await p.waitForTimeout(1500); } fail(what + " | " + JSON.stringify(await state())); return false; };

  // A. the whole way in: up the stair from the grove, round the screen wall, through the gate, across the court, into the hall
  await p.goto(base + "?q=low&fast=1"); await ready();
  await p.evaluate(() => window.__walk([[0, 62.5], [8.5, 60], [8.5, 49], [0, 46.5], [0, 2], [0, -5.4]]));
  let minH = 0, maxH = 0; const seen = [];
  await until(async () => { const s = await state(); minH = Math.min(minH, s.h); maxH = Math.max(maxH, s.h); seen.push(s.z); return inHall(); }, 300000, "the walk in never reached the hall");
  console.log("A: z samples", seen.filter((_, i) => i % 3 === 0).join(" "), "height from", minH, "to", maxH);
  if (minH > -5) fail("did not start at the foot of the approach stair");
  // B. inside
  await p.waitForTimeout(4000); await p.screenshot({ path: path.join(out, "walk-hall.png") });
  if (await p.isVisible("#offer")) { await p.click("#offer"); await p.waitForTimeout(3000); } else fail("offer button not visible");
  await p.click("#leave");
  await until(async () => !(await inHall()), 30000, "never left the hall");
  await p.waitForTimeout(3000); await p.screenshot({ path: path.join(out, "walk-out.png") });
  // C. tap the hall at walking speed
  await p.goto(base + "?q=low&cam=0.3,2.2,0,0.05"); await ready();
  await p.mouse.click(210, 300);
  await until(inHall, 300000, "tap on the hall never led inside");
  // D. past the hall, up both terraces, to the porch of the summit pavilion
  await p.goto(base + "?q=low&fast=1&cam=16.5,0,0,0"); await ready();
  await p.evaluate(() => window.__walk([[16.5, -23], [0, -23], [0, -30], [13.6, -30], [13.6, -54], [0, -54.5], [0, -91], [0, -94.3]]));
  await until(async () => (await state()).h > 20.8, 300000, "never reached the summit porch");
  console.log("D: summit", JSON.stringify(await state()));
  console.log(errs.length ? "errors: " + JSON.stringify(errs) : "PASS");
  await b.close(); srv.close();
  process.exit(errs.length ? 1 : 0);
})();
