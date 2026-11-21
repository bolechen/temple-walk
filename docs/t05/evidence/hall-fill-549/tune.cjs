// Trial settings of the hall's fill drawn in one page (software), each from the views its limits are read from; the page
// must carry the temporary hook window.__fills (never committed). Writes <out>/<cfg>-<view>.png and <out>/frames.json.
const path = require("path"), fs = require("fs"), top = process.cwd();
const { site, serve } = require(path.join(top, "tools/site.cjs")); const { chromium } = require(path.join(top, "node_modules/playwright"));
const [out, cfgFile] = process.argv.slice(2), cfgs = JSON.parse(fs.readFileSync(cfgFile, "utf8"));
const VIEWS = { e: [0, -9, 0, 1.15], f: [0, -2, 0, 0.17], front: [0, -8, 3.1416, 0.12], ne: [10, -12, 2.4, 0.45], chest: [0, -3, 0, 0.05], fig: [0, -6, 0, 0.35], near: [0, 6, 0, 0.08] };
(async () => {
  const srv = await serve(site()); const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, locale: "zh-CN" })).newPage();
  await page.goto(`${srv.base}?level=t05&shot=1&q=high&season=summer&time=day&view=first&cam=0,-9,0,1.15`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.body.dataset.ready === "1" && window.__fills, null, { timeout: 900000 });
  const frames = {};
  for (const [name, c] of Object.entries(cfgs)) {
    await page.evaluate((c) => { const F = window.__fills; F.forEach((l, i) => {
      const k = i < 2 ? "door" : "up"; if (c[k] != null) l.userData.full = c[k];
      if (i >= 2 && c.angle) l.angle = c.angle;
      if (i >= 2 && c.aimY != null) { l.target.position.y = c.aimY; l.target.updateMatrixWorld(); }
      if (i >= 2 && c.aimZ != null) { l.target.position.z = c.aimZ; l.target.updateMatrixWorld(); }
      if ((i === 2 || i === 4) && c.aimZs != null) { l.target.position.z = c.aimZs; l.target.updateMatrixWorld(); } }); }, c);
    for (const [v, p] of Object.entries(VIEWS)) {
      await page.evaluate((p) => window.__pose(...p), p);
      await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n > 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
      frames[v] ||= await page.evaluate(() => ({ ...window.__frame(), fov: window.__probe().fov }));
      await page.screenshot({ path: path.join(out, `${name}-${v}.png`), timeout: 600000 });
    }
    console.log("done", name);
  }
  fs.writeFileSync(path.join(out, "frames.json"), JSON.stringify(frames)); await b.close(); srv.close();
})();
