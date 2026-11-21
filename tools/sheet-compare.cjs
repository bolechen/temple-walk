// The offering box's sheet beside the credits' sheet, on a phone held upright and on a desktop window, for judging that the
// two papers are one family (torn edge, the foot's fade, type). Software rendering is enough.
//   node tools/sheet-compare.cjs <label>   → tools/out/sheets/<label>-{phone,desk}-{credits,offering}.png and a line each of their --deckle
const fs = require("fs"), path = require("path"), http = require("http"), { chromium } = require("playwright");
const root = require("./site.cjs").site(), out = path.join(__dirname, "out", "sheets"), label = process.argv[2] || "now";
const { serve } = require("./site.cjs");
let srv;
(async () => {
  srv = await serve(root); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [shape, vw, vh, touch] of [["phone", 390, 844, true], ["desk", 1280, 720, false]]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch, locale: "zh-CN" }), p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${srv.address().port}/?q=low&season=summer&time=day&lang=zh`, { waitUntil: "commit", timeout: 180000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1" && !document.getElementById("enterBtn").disabled, null, { timeout: 300000 });
    await p.waitForFunction(() => window.__offeringSheet, null, { timeout: 60000 });
    for (const [name, open, shut, sel] of [["credits", "document.getElementById('menuCredits').click()", "document.getElementById('creditsClose').click()", ".credits-card"], ["offering", "window.__offeringSheet()", "document.getElementById('offeringClose').click()", ".offering-card"]]) {
      if (name === "credits") await p.evaluate(() => window.__menu(true));
      await p.evaluate((c) => { (0, eval)(c); }, open); await p.waitForTimeout(2500);
      const d = await p.evaluate((s) => (document.querySelector(s).style.getPropertyValue("--deckle") || "").slice(0, 16) || "FALLBACK", sel);
      await p.screenshot({ path: path.join(out, `${label}-${shape}-${name}.png`) }); console.log(`${label} ${shape} ${name}: --deckle ${d}`);
      await p.evaluate((c) => { (0, eval)(c); }, shut); await p.waitForTimeout(600);
    }
    await ctx.close();
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
