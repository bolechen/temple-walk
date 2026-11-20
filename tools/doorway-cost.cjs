// What the rooms in the doorways cost (#218): time from opening the page to its first ready frame, the JavaScript heap,
// and the doorways' cubes, with them and without (`?off=doorway`), standing in the first court before the great hall.
// Software rendering: compare the two runs with each other, not with a phone. usage: node tools/doorway-cost.cjs [runs=2]
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = require("./site.cjs").site();
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}/`, runs = +(process.argv[2] || 2), rows = [];
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
  for (let k = 0; k < runs; k++) for (const off of ["doorway", ""]) {
    const ctx = await b.newContext({ viewport: { width: 640, height: 400 }, locale: "zh-CN" }), p = await ctx.newPage(), t0 = Date.now();
    await p.goto(`${base}?q=high&view=third&season=summer&time=day&cam=0,0,0,0.04` + (off ? `&off=${off}` : ""), { waitUntil: "commit" });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000, polling: 200 });
    const ready = Date.now() - t0;
    if (!off) await p.waitForFunction(() => window.__doorways().halls.main.fade === 1, null, { timeout: 300000, polling: 500 });
    const m = await p.evaluate(() => { const f0 = window.__yard().frames; return new Promise((r) => { const go = () => window.__yard().frames >= f0 + 10 ? r({ heap: performance.memory.usedJSHeapSize, doors: window.__doorways?.() }) : requestAnimationFrame(go); go(); }); });
    rows.push({ doorways: !off, readyMs: ready, heapMB: +(m.heap / 2 ** 20).toFixed(1), cubesMB: m.doors ? m.doors.mb : 0, taken: m.doors ? Object.entries(m.doors.halls).filter(([, x]) => x.taken).map(([k]) => k) : [], worstFaceMs: m.doors ? m.doors.worstFaceMs : null });
    await ctx.close();
  }
  console.log(JSON.stringify(rows, null, 1));
  await b.close(); srv.close();
})();
