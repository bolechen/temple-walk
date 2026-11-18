// The breath of sitting on the summit as pictures (#156): the ring on the ground and the word at the foot, at the moment
// of a full breath in and of the breath gone out, on a wide screen (16:9), a laptop's (4:3) and a phone held upright,
// from the sitting's own shot (自动镜头) and from behind him, and the phone's picture in each of the four languages.
//   node tools/breath-views.cjs [outdir] [--prefix=after]
// The observances' clock is held (__riteClock) so each moment is the same on any machine; the file name carries the prefix.
const path = require("path"), fs = require("fs");
const { serve, launch } = require("../tests/e2e/lib.cjs");
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "breath"));
const prefix = (process.argv.find((a) => a.startsWith("--prefix=")) || "--prefix=after").slice(9);
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean).map(Number);   // which of SHOTS, by number
const SIZES = { "16x9": [1600, 900, 1], "4x3": [1200, 900, 1], phone: [390, 844, 2] };
const SHOTS = [["16x9", true, "zh"], ["4x3", true, "zh"], ["phone", true, "zh"], ["16x9", false, "zh"], ["phone", true, "en"], ["phone", true, "ja"], ["phone", true, "ko"]];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch();
  for (const [n, [size, autocam, lang]] of SHOTS.entries()) {
    if (only.length && !only.includes(n)) continue;
    const [w, h, dsf] = SIZES[size];
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, locale: "zh-CN" }), p = await ctx.newPage(), errors = [];
    await p.addInitScript(`try{localStorage.setItem("yunjing.settings.v1",JSON.stringify({autocam:${autocam}}))}catch{}`);
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto(`${srv.base}?q=low&enter&view=third&season=summer&time=day&seed=4&lang=${lang}`, { waitUntil: "commit", timeout: 120000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    if (await p.isVisible("#title")) { await p.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 }); await p.click("#enterBtn"); }
    if (await p.evaluate(() => !!window.__opening && window.__opening().active)) { await p.keyboard.press("Escape"); await p.waitForFunction(() => !window.__opening().active, null, { timeout: 120000 }); }
    await p.evaluate(() => { const q = window.__places.sit; window.__pose(q.at[0] + 0.3, q.at[1] + 0.3, 0, 0); });
    await p.waitForFunction(() => { const a = document.getElementById("act"); return !a.hidden && a.dataset.word === "静坐"; }, null, { timeout: 120000 });
    await p.evaluate(() => document.getElementById("act").click());
    await p.waitForFunction(() => { const e = document.getElementById("breathWord") || document.getElementById("breath"); return e && !e.hidden; }, null, { timeout: 120000 });
    await p.evaluate(() => window.__riteClock(0));
    // The eye's way to the shot is planned a little at a time, on real frames: wait for it to be known (the clock is held, so he has not breathed on).
    if (autocam) await p.waitForFunction(() => { const d = window.__director(); return !d.planning && (d.phase === "in" || d.phase === "hold"); }, null, { timeout: 300000 });
    const frames = async (n) => { const f0 = await p.evaluate(() => window.__yard().frames); await p.waitForFunction((f) => window.__yard().frames >= f, f0 + n, { timeout: 300000 }); };
    // Stepped on a quarter second at a time until the breath is full (it has just been taken in), then until it is gone out.
    let held = 0;   // a page from before the ring on the ground (main at #156) reports no fill: the breath's own timing stands in
    const fill = async () => { const f = await p.evaluate(() => window.__rites().sit.fill); if (f !== undefined) return f; const e = held / 1000; return Math.max(0, e < 4 ? e / 4 : (9 - e) / 5); };
    for (const [name, done] of [["full", (f) => f >= 0.9], ["empty", (f) => f <= 0.06]]) {
      for (let i = 0; i < 300; i++) { await p.evaluate(() => window.__riteClock(400)); held += 400; await frames(1); const f = await fill(), there = !autocam || (await p.evaluate(() => window.__director().w)) >= 0.98; if (there && done(f) && (name === "full" || i > 1)) break; }   // the eye must be on the shot, however slow the frames, as well as the breath where it is wanted
      await frames(3); await p.waitForTimeout(4600);   // (a screen's own transitions, in the old picture, run on the wall clock)
      const file = `${prefix}-${size}${autocam ? "" : "-behind"}${lang === "zh" ? "" : "-" + lang}-${name}.png`;
      await p.screenshot({ path: path.join(out, file), timeout: 300000 }); console.log(file, "fill", await fill(), JSON.stringify(await p.evaluate(() => { const d = window.__director ? window.__director() : {}; return { phase: d.phase, w: d.w, ended: window.__rites().ended }; })));
    }
    if (errors.length) console.log("errors:", errors);
    await ctx.close();
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
