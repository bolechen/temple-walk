// Every 10th pixel of the sakya view at 1920x1080 asked of the page (__pick): which part of Shakyamuni, if any, is the first thing hit.
const path = require("path"), top = process.cwd();
const { site, serve } = require(path.join(top, "tools/site.cjs")); const { chromium } = require(path.join(top, "node_modules/playwright"));
(async () => {
  const srv = await serve(site()); const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, locale: "zh-CN" }); const page = await ctx.newPage();
  await page.goto(`${srv.base}?level=t05&shot=1&q=high&view=first&show=sakya`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
  const res = await page.evaluate(() => {
    const fx = -16.45, a = -7 * Math.PI / 180, top = 3.87, c = { lotus: 0, base: 0, body: 0, halo: 0, n: 0 };
    for (let y = 5; y < 1080; y += 10) for (let x = 5; x < 1920; x += 10) {
      c.n++; const h = window.__pick(x, y)[0]; if (!h || !h.at) continue;
      const [X, Y, Z] = h.at, dx = X - fx, dz = Z + 16.9, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
      if (Math.abs(lx) > 2.4) continue;
      if (lz < -1.9 && lz > -2.4 && Y > top + 3) c.halo++;
      else if (Math.abs(lz) <= 1.75 && Y >= top - 0.01 && Y < top + 2) c.base++;
      else if (Math.abs(lz) <= 1.75 && Y >= top + 2 && Y < top + 3) c.lotus++;
      else if (Math.abs(lz) <= 1.75 && Y >= top + 3) c.body++;
    }
    return c;
  });
  const p = (k) => (100 * res[k] / res.n).toFixed(1) + "%";
  console.log(JSON.stringify(res), "lotus", p("lotus"), "sumeru base", p("base"), "body", p("body"), "halo", p("halo"));
  await b.close(); srv.close();
})();
