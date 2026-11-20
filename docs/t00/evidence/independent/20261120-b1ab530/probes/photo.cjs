// PHOTO-02 recheck: on the high tier, does the raised camera (P key, real input) turn depth of field on?
const { chromium } = require("/home/user/temple-walk/node_modules/playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const dist = "/home/user/temple-walk/dist";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".bin": "application/octet-stream", ".mjs": "text/javascript" };
const srv = http.createServer((q, r) => { let p = path.join(dist, decodeURIComponent(q.url.split("?")[0])); if (p.endsWith("/")) p += "index.html"; fs.readFile(p, (e, b) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader("content-type", types[path.extname(p)] || "application/octet-stream"); r.end(b); }); }).listen(0, "127.0.0.1", async () => {
  const port = srv.address().port, out = [];
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const pg = await (await b.newContext({ viewport: { width: 1280, height: 720 }, locale: "zh-CN" })).newPage();
  const errs = []; pg.on("pageerror", (e) => errs.push(String(e))); pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await pg.goto(`http://127.0.0.1:${port}/?q=high&enter&season=summer&time=day`);
  await pg.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
  const rec = async (k) => { const p = await pg.evaluate(() => window.__probe()); out.push({ k, tier: p.tier, post: p.post, photo: p.photo }); };
  await rec("before"); await pg.keyboard.press("p"); await pg.waitForFunction(() => window.__probe().photo === true || window.__probe().photo?.on, null, { timeout: 120000 }).catch(() => {}); const f0 = (await pg.evaluate(() => window.__yard().frames)); await pg.waitForFunction((f) => window.__yard().frames >= f + 3, f0, { timeout: 180000 }); await rec("after-P");
  console.log(JSON.stringify(out)); try { await pg.screenshot({ path: "/home/user/temple-walk/tools/out/photo-raised-b1ab530.png", timeout: 240000 }); } catch (e) { out.push({ shotError: String(e).slice(0, 80) }); }
  console.log(JSON.stringify({ out, errs }, null, 1)); await b.close(); srv.close();
});
