// What the end-to-end scenarios share: a server for app/, a browser that can draw without a GPU, and a page that records its own errors.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = require("../../tools/site.cjs").site(), out = path.join(__dirname, "..", "..", "tools", "out");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css", ".woff2": "font/woff2" };

async function serve() {
  const srv = http.createServer((req, res) => {
    let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}   // a bad escape, or a path that climbs out of the app, is not served
    if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() };
}
const launch = () => chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });

// A page on the temple. `errors` collects everything the page complains about; a scenario fails if it is not empty at the end.
async function open(browser, base, query, opts = {}) {
  const { enter, observeLoading, route, ...ctxOpts } = opts;
  // The page speaks the browser's language (src/i18n.js); the scenarios are written against the Chinese, so their
  // browser speaks Chinese unless one asks otherwise (`locale`, or ?lang=).
  const ctx = await browser.newContext({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 1, locale: "zh-CN", ...ctxOpts });
  const page = await ctx.newPage(), errors = [];
  if (route) await route(page);   // before the first request: a file that is made to fail
  if (opts.init) await page.addInitScript(opts.init);   // before the page's own scripts: a stub for an API, a way to hide it
  page.on("pageerror", (e) => errors.push("page error: " + String(e.stack || e).slice(0, 400)));
  page.on("console", (m) => {
    if (m.type() !== "error" || /GPU stall/.test(m.text())) return;
    const at = m.location();
    errors.push("console: " + m.text().slice(0, 300) + (at.url ? ` (${at.url}:${at.lineNumber ?? at.line ?? 0})` : ""));
  });
  page.on("requestfailed", (r) => !/fonts\.g/.test(r.url()) && errors.push("request failed: " + r.url()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()}: ${r.url()}`));
  if (observeLoading) await page.addInitScript(() => {
    window.__loadingHistory = [];
    new MutationObserver(() => {
      const bar = document.getElementById("loadProgress");
      if (!bar) return;
      const value = bar.hasAttribute("value") ? Number(bar.getAttribute("value")) : null;
      if (window.__loadingHistory.at(-1) !== value || !window.__loadingHistory.length) window.__loadingHistory.push(value);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["value"] });
  });
  await page.goto(base + "?" + query, { waitUntil: "commit", timeout: 120000 });   // the page builds the whole temple before it reports itself loaded
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
  // A visitor arriving meets the title first and steps in from it; a scenario may ask to be left at the title.
  if (opts.enter !== false && (await page.isVisible("#title"))) { await page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 }); await page.click("#enterBtn"); await page.waitForFunction(() => document.body.classList.contains("entered")); }
  // A first visitor is shown the mountain before the walk is theirs (src/opening.js); a scenario stepping in this way passes
  // over it as a visitor may, with Esc, and begins once the walk is handed back (the `opening` scenario watches it whole).
  if (opts.enter !== false && (await page.evaluate(() => !!window.__opening && window.__opening().active))) { await page.keyboard.press("Escape"); await page.waitForFunction(() => !window.__opening().active, null, { timeout: 120000 }); }
  const t = {
    page, errors, close: () => ctx.close(),
    state: () => page.evaluate(() => window.__yard()),
    probe: () => page.evaluate(() => window.__probe()),
    journey: () => page.evaluate(() => window.__journey()),
    inHall: () => page.evaluate(() => window.__yard().inside),
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
