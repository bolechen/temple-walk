// His shadow in a jump (#141): the court seen low from beside and behind him at the top of a jump, to set before and after
// side by side. usage: node tools/jump-shadow.cjs <outdir> [season-hour ...]   (default: summer-day autumn-dusk)
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = require("./site.cjs").site(), out = path.resolve(process.argv[2] || path.join(__dirname, "out", "jump-shadow"));
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  const base = path.resolve(root), full = path.resolve(base, "." + decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!full.startsWith(base) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(full)] || "application/octet-stream" }); fs.createReadStream(full).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, locale: "zh-CN" });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  for (const when of process.argv.slice(3).length ? process.argv.slice(3) : ["summer-day", "autumn-dusk"]) {
    const [season, time] = when.split("-");
    await p.goto(`http://127.0.0.1:${srv.address().port}/?q=low&enter&view=third&cam=0,-4,0,0.02&season=${season}&time=${time}`, { waitUntil: "load" });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(out, `${when}-standing.png`) });
    await p.keyboard.press("Space");
    // the top of the jump: the first frame that is more than 30 cm up; the picture is then frozen as it stands
    await p.evaluate(() => new Promise((ok) => { const f = () => (window.__yard().footY - window.__yard().h > 0.3 ? ok() : requestAnimationFrame(f)); f(); }));
    await p.evaluate(() => window.__photo(true));
    const s = await p.evaluate(() => { const y = window.__yard(); return { up: +(y.footY - y.h).toFixed(3), shadowY: y.shadowY, shadowOp: y.shadowOp, ground: y.h }; });
    await p.screenshot({ path: path.join(out, `${when}-top.png`) });
    console.log(when, JSON.stringify(s));
  }
  console.log("errors:", [...new Set(errs)]); await b.close(); srv.close();
})();
