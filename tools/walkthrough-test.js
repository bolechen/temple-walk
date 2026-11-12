// Walks the whole visit and fails loudly if any step does not happen:
//   A. from the approach, straight up the axis with the keyboard: gate house, front court, main court, steps, door
//   B. inside: offer incense, leave
//   C. from the court at real walking speed: tap the hall, arrive at the door, enter
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

  // A. up the axis
  await p.goto(base + "?q=low&fast=1"); await ready();
  await p.keyboard.down("w");
  let maxH = 0; const seen = [];
  await until(async () => { const s = await state(); maxH = Math.max(maxH, s.h); seen.push(s.z); return inHall(); }, 240000, "axis walk never reached the hall");
  await p.keyboard.up("w");
  console.log("A: z samples", seen.filter((_, i) => i % 3 === 0).join(" "), "max height", maxH);
  // B. inside
  await p.waitForTimeout(4000); await p.screenshot({ path: path.join(out, "walk-hall.png") });
  if (await p.isVisible("#offer")) { await p.click("#offer"); await p.waitForTimeout(3000); } else fail("offer button not visible");
  await p.click("#leave");
  await until(async () => !(await inHall()), 30000, "never left the hall");
  await p.waitForTimeout(3000); await p.screenshot({ path: path.join(out, "walk-out.png") });
  // C. tap the hall at walking speed
  await p.goto(base + "?q=low&cam=0.3,2.2,0,0.05"); await ready();
  await p.mouse.click(210, 300);
  await until(inHall, 240000, "tap on the hall never led inside");
  console.log(errs.length ? "errors: " + JSON.stringify(errs) : "PASS");
  await b.close(); srv.close();
  process.exit(errs.length ? 1 : 0);
})();
