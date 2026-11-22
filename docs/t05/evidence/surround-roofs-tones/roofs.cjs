const path = require("path"), fs = require("fs"), top = "/home/user/temple-walk";
const { site, serve } = require(path.join(top, "tools/site.cjs")); const { chromium } = require(path.join(top, "node_modules/playwright"));
const out = process.argv[2], query = process.env.QUERY || "season=winter&time=day"; fs.mkdirSync(out, { recursive: true });
const VIEWS = JSON.parse(process.env.VIEWS || '{"east":[0,8,-1.5708,0.06],"west":[0,8,1.5708,0.06],"south":[0,10,3.1416,0.06],"eastA":[0,44,-1.5708,0.04]}');
(async () => {
  const srv = await serve(site()); const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, locale: "zh-CN" })).newPage();
  await page.goto(`${srv.base}?level=t05&shot=1&q=high&view=first&${query}&cam=0,8,0,0.06`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 900000 });
  for (const [name, p] of Object.entries(VIEWS)) {
    await page.evaluate((p) => window.__pose(...p), p);
    await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n > 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    await page.screenshot({ path: path.join(out, `${name}.png`), timeout: 600000 });
    const pick = await page.evaluate(() => { const o = []; for (let y = 4; y < 720; y += 6) for (let x = 4; x < 1280; x += 6) { const r = window.__pick(x, y, 1)[0]; if (r && /^surround/.test(r.material)) o.push([x, y, r.material]); } return o; });
    fs.writeFileSync(path.join(out, `${name}.pick.json`), JSON.stringify(pick)); console.log("done", name, pick.length);
  }
  await b.close(); srv.close();
})();
