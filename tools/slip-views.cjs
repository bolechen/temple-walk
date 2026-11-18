// The slip of paper from the library as a picture (#203): the library's longest line in Korean (the one that ran wide on a phone on
// its side), upright, on its side, and on a wide screen. It is got the way a visitor gets it: `?seed=8`, then the rite at the library.
//   node tools/slip-views.cjs [outdir] [--prefix=after] [--lang=ko]
const path = require("path"), fs = require("fs");
const { serve, launch } = require("../tests/e2e/lib.cjs");
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=")[1];
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "slip")), prefix = arg("prefix", "after"), lang = arg("lang", "ko");
const SIZES = { upright: [390, 844, true], side: [844, 390, true], wide: [1280, 720, false] };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch();
  for (const [name, [w, h, touch]] of Object.entries(SIZES)) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, locale: lang === "ko" ? "ko-KR" : "zh-CN" }), p = await ctx.newPage();
    await p.goto(`${srv.base}?q=low&cam=0,30,0,0&season=summer&time=day&seed=8&fast=1&lang=${lang}`, { waitUntil: "commit", timeout: 120000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    await p.evaluate(() => { const q = window.__places.sutra; window.__pose(q.at[0] + 0.3, q.at[1] + 0.3, 0, 0); });
    await p.waitForFunction(() => { const a = document.getElementById("act"); return !a.hidden && a.offsetParent !== null; }, null, { timeout: 120000, polling: 500 });
    await p.evaluate(() => document.getElementById("act").click());
    await p.waitForFunction(() => document.getElementById("slip").open, null, { timeout: 120000, polling: 500 });
    await p.waitForTimeout(2500);
    const file = `${prefix}-${lang}-${name}.png`; await p.screenshot({ path: path.join(out, file) });
    console.log(file, JSON.stringify(await p.evaluate(() => ({ w: innerWidth, scrollW: document.documentElement.scrollWidth, flat: document.getElementById("slip").classList.contains("flat"), fs: getComputedStyle(document.getElementById("slipText")).fontSize }))));
    await ctx.close();
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
