// The far view at the close of the chapter as pictures (#147): the eye on the pavilion with the one line at the foot, on a wide
// screen (16:9), a laptop's (4:3) and a phone held upright; and the book opened from it (B), the pavilion seen behind its paper.
//   node tools/far-views.cjs [outdir]
// The close is played fast (?fast=1) for a first visitor who sits on the summit with an empty book; one page is put through the
// three screens, the eye keeping the shot as the picture changes shape.
const path = require("path"), fs = require("fs");
const { serve, launch } = require("../tests/e2e/lib.cjs");
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "far"));
const SIZES = { "16x9": [1280, 720], "4x3": [1024, 768], phone: [390, 844] };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: "zh-CN" }), p = await ctx.newPage();
  await p.goto(`${srv.base}?q=low&enter&fast=1&seed=4&view=third&season=summer&time=day`, { waitUntil: "commit", timeout: 120000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
  if (await p.isVisible("#title")) { await p.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 }); await p.click("#enterBtn"); }
  if (await p.evaluate(() => !!window.__opening && window.__opening().active)) { await p.keyboard.press("Escape"); await p.waitForFunction(() => !window.__opening().active, null, { timeout: 120000 }); }
  await p.evaluate(() => { const q = window.__places.sit; window.__pose(q.at[0] + 0.3, q.at[1] + 0.3, 0, 0); });
  await p.waitForFunction(() => { const a = document.getElementById("act"); return !a.hidden && a.dataset.word === "静坐"; }, null, { timeout: 120000 });
  await p.evaluate(() => document.getElementById("act").click());
  await p.waitForFunction(() => window.__rites().ended === 1, null, { timeout: 600000, polling: 1000 });
  await p.waitForFunction(() => document.getElementById("hint").classList.contains("on") && !document.getElementById("say").classList.contains("on"), null, { timeout: 120000, polling: 500 });
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    await p.setViewportSize({ width: w, height: h });
    const f0 = await p.evaluate(() => window.__yard().frames); await p.waitForFunction((f) => window.__yard().frames >= f, f0 + 4, { timeout: 300000 });
    await p.waitForTimeout(1500);
    const file = `far-${name}.png`; await p.screenshot({ path: path.join(out, file) }); console.log(file, JSON.stringify(await p.evaluate(() => ({ director: window.__director().phase, hint: document.getElementById("hint").textContent }))));
  }
  await p.setViewportSize({ width: 390, height: 844 }); await p.keyboard.press("b");
  await p.waitForFunction(() => window.__ui().modal, null, { timeout: 60000 }); await p.waitForTimeout(3000);
  await p.screenshot({ path: path.join(out, "far-phone-book.png") }); console.log("far-phone-book.png");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
