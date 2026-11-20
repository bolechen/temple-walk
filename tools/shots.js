// Renders every named view of the site (see `views` in app/src/site.js) to tools/out/<name>.png.
// usage: node tools/shots.js [--size=WxH] [--off=part,…] [--tag=-x] [name ...]     e.g. node tools/shots.js gate library; --size=1280x536 for the 2.39:1 art views
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = require("./site.cjs").site(), out = path.join(__dirname, "out");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}   // a bad escape, or a path that climbs out of the app, is not served
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  fs.mkdirSync(out, { recursive: true });
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const sized = process.argv.find((a) => a.startsWith("--size=")), [vw0, vh0] = sized ? sized.slice(7).split("x").map(Number) : [1280, 720];
  const p = await b.newPage({ viewport: { width: vw0, height: vh0 }, deviceScaleFactor: 1, locale: "zh-CN" });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.stack ? e.stack.slice(0, 500) : e.message));
  p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 400)));
  let names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const off = (process.argv.find((a) => a.startsWith("--off=")) || "").slice(6), tag = (process.argv.find((a) => a.startsWith("--tag=")) || "").slice(6);   // --off=doorway: a part left out; --tag: added to the file's name
  for (let i = 0; i < Math.max(1, names.length); i++) {
    // A name may carry a season and hour and a view: "court@autumn-dusk@third".
    const [vname, when = "", vw = ""] = (names[i] || "arrive").split("@"), [season, time] = when.split("-");
    await p.goto(`${base}?shot=1&q=high&show=${vname}` + (season ? `&season=${season}` : "") + (time ? `&time=${time}` : "") + (vw ? `&view=${vw}` : "") + (off ? `&off=${off}` : ""), { waitUntil: "commit", timeout: 180000 });   // the page builds the whole temple before it reports itself loaded
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 }).catch((e) => errs.push(String(e).slice(0, 160)));
    if (!names.length) names = await p.evaluate(() => window.__views);
    // The rooms seen through the doors are taken a face a frame once the page is up (doorway.js): wait until they are in.
    await p.waitForFunction(() => { const r = window.__doorways?.(); return !r || (!r.busy && !r.queued.length && Object.values(r.halls).every((h) => !h.want || h.fade === 1)); }, null, { timeout: 240000, polling: 500 }).catch((e) => errs.push(String(e).slice(0, 160)));
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(out, names[i].replace(/@/g, "_") + tag + ".png"), timeout: 240000 });
    console.log(names[i], JSON.stringify(await p.evaluate(() => { const y = window.__yard(); return { tris: y.tris, calls: y.calls }; })));
  }
  console.log("errors:", [...new Set(errs)].slice(0, 6));
  await b.close(); srv.close();
})();
