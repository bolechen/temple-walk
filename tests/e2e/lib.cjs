// What the end-to-end scenarios share: a server for app/, a browser that can draw without a GPU, and a page that records its own errors.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "..", "app"), out = path.join(__dirname, "..", "..", "tools", "out");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png" };

async function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    // The page is published without a document shell (the host supplies one); give it the same minimum here.
    if (p.endsWith("index.html")) return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><body>' + fs.readFileSync(p, "utf8"));
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => srv.listen(0, r));
  return { base: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() };
}
const launch = () => chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });

// A page on the temple. `errors` collects everything the page complains about; a scenario fails if it is not empty at the end.
async function open(browser, base, query, opts = {}) {
  const { enter, ...ctxOpts } = opts;
  const ctx = await browser.newContext({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 1, ...ctxOpts });
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push("page error: " + String(e.stack || e).slice(0, 400)));
  page.on("console", (m) => m.type() === "error" && !/GPU stall|favicon/.test(m.text()) && errors.push("console: " + m.text().slice(0, 300)));
  page.on("requestfailed", (r) => !/fonts\.g/.test(r.url()) && errors.push("request failed: " + r.url()));
  page.on("response", (r) => r.status() >= 400 && !/favicon/.test(r.url()) && errors.push(`HTTP ${r.status()}: ${r.url()}`));
  await page.goto(base + "?" + query, { waitUntil: "commit", timeout: 120000 });   // the page builds the whole temple before it reports itself loaded
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
  // A visitor arriving meets the title first and steps in from it; a scenario may ask to be left at the title.
  if (opts.enter !== false && (await page.isVisible("#title"))) { await page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 }); await page.click("#enterBtn"); await page.waitForFunction(() => document.body.classList.contains("entered")); }
  const t = {
    page, errors, close: () => ctx.close(),
    state: () => page.evaluate(() => window.__yard()),
    probe: () => page.evaluate(() => window.__probe()),
    journey: () => page.evaluate(() => window.__journey()),
    inHall: () => page.evaluate(() => !document.getElementById("hallView").hidden),
    // Poll until `fn` is true; throw with the walker's state if it never is.
    async until(fn, ms, what) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await page.waitForTimeout(1200); } throw new Error(what + " | " + JSON.stringify(await t.state())); },
    // Let the page draw `n` more frames: under software rendering a second may hold one frame or ten.
    async frames(n) { const f0 = (await t.state()).frames; await t.until(async () => (await t.state()).frames >= f0 + n, 240000, `the page stopped drawing (wanted ${n} more frames)`); },
    shot: (name) => { fs.mkdirSync(out, { recursive: true }); return page.screenshot({ path: path.join(out, name + ".png"), timeout: 240000 }); },
  };
  return t;
}
function expect(cond, what) { if (!cond) throw new Error(what); }
module.exports = { serve, launch, open, expect, out };
