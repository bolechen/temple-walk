// The opening after 入山 (src/opening.js, issue #110) as pictures: its first frame (起), the eye coming down over the
// roofs (承), settling behind him (落), and the prologue's title at the gate, each on a wide screen (16:9), a laptop's
// (4:3) and a phone held upright; and the first frame in four moods (summer day, autumn dusk, winter day, summer night).
//   node tools/opening-views.cjs [outdir] [--only=frames|moods]
// The eye is held at each moment with __openingAt (the page's own way down, not a copy of it); time is frozen (?shot).
const path = require("path"), fs = require("fs");
const { serve, launch } = require("../tests/e2e/lib.cjs");
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "opening"));
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
const SIZES = { "16x9": { width: 1600, height: 900 }, "4x3": { width: 1200, height: 900 }, phone: { width: 390, height: 844, dsf: 2 } };
const MOODS = ["summer-day", "autumn-dusk", "winter-day", "summer-night"];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch(), log = [];
  const page = async (size, mood, extra = "") => {
    const [season, time] = mood.split("-"), v = SIZES[size];
    const ctx = await b.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dsf || 1, locale: "zh-CN" }), p = await ctx.newPage(), errors = [];
    p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errors.push(m.text()));
    await p.goto(`${srv.base}?q=high&shot=1&view=third&season=${season}&time=${time}${extra}`, { waitUntil: "commit", timeout: 120000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    return { p, ctx, errors };
  };
  const frames = async (p, n) => { const f0 = await p.evaluate(() => window.__yard().frames); await p.waitForFunction((f) => window.__yard().frames >= f, f0 + n, { timeout: 300000 }); };
  const snap = async (t, name, info) => { await t.p.screenshot({ path: path.join(out, name + ".png"), timeout: 300000 }); log.push({ name, ...info, errors: t.errors.slice() }); console.log(name, JSON.stringify(info)); };
  if (only !== "moods") for (const size of Object.keys(SIZES)) {
    const t = await page(size, "summer-day", "&show=arrive");
    const secs = await t.p.evaluate(() => { window.__openingAt(0); return null; }); await frames(t.p, 3);
    const plan = await t.p.evaluate(() => window.__opening());
    for (const [label, at] of [["1-qi", 0], ["2-cheng", plan.secs * 0.42], ["3-luo", plan.secs - 2.0]]) {
      await t.p.evaluate((s) => window.__openingAt(s), at); await frames(t.p, 3);
      await snap(t, `opening-${label}-${size}`, { at: +at.toFixed(2), eye: await t.p.evaluate(() => window.__yard()) });
    }
    await t.ctx.close();
    // The title: he has come round the screen wall, the gate before him (cam04).
    const g = await page(size, "summer-day", "&cam=6.6,53.4,-0.42,0.3");
    await g.p.evaluate(() => window.__prologue(true)); await g.p.waitForTimeout(1700); await frames(g.p, 2);
    const box = await g.p.evaluate(() => { const r = document.getElementById("prologue").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, monk: window.__probe().monkBox }; });
    await snap(g, `opening-4-title-${size}`, { title: box });
    await g.ctx.close();
  }
  if (only !== "frames") for (const mood of MOODS) {
    const t = await page("16x9", mood, "&show=arrive");
    await t.p.evaluate(() => window.__openingAt(0)); await frames(t.p, 4);
    await snap(t, `opening-1-qi-${mood}`, { mood });
    await t.ctx.close();
  }
  fs.writeFileSync(path.join(out, "views.json"), JSON.stringify(log, null, 1));
  await b.close(); srv.close();
  const bad = log.filter((l) => l.errors.length); if (bad.length) { console.error("page errors:", JSON.stringify(bad.map((l) => [l.name, l.errors]))); process.exit(1); }
})();
